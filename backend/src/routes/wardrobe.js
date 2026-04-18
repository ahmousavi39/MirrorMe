const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const sharp = require('sharp');
const router = express.Router();

const { FieldValue } = require('firebase-admin/firestore');
const verifyToken = require('../middleware/verifyToken');
const { db, bucket } = require('../services/firebase');
const { extractClothingFromImage } = require('../services/gemini');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

/** Wardrobe document key — includes all 6 identifying fields so items that differ
 *  on even a single field are stored as separate wardrobe entries. */
function wardrobeKey(category, color, fit, material, pattern, style) {
  const fields = [category, color, fit, material, pattern, style];
  const raw = fields.map((s) => (s || '').trim()).join('|');
  // For non-ASCII input (e.g. Chinese, Japanese) use a deterministic content hash
  if (/[^\x00-\x7F]/.test(raw)) {
    return 'item_' + crypto.createHash('sha1').update(raw.toLowerCase()).digest('hex').slice(0, 24);
  }
  const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20);
  const parts = [
    clean(category) || 'item',
    clean(color),
    clean(fit),
    clean(material),
    clean(pattern),
    clean(style),
  ].filter(Boolean);
  return parts.join('_').slice(0, 120);
}

// ── GET /api/wardrobe ─────────────────────────────────────────────────────────────
// Returns all wardrobe items for the authenticated user, sorted by lastSeenAt desc.
router.get('/', verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection('users')
      .doc(req.uid)
      .collection('wardrobe')
      .orderBy('lastSeenAt', 'desc')
      .get();

    const seen = new Set();
    const items = snap.docs
      .map((doc) => {
        const { _geminiFilledFields, ...data } = doc.data();
        return { id: doc.id, ...data };
      })
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    return res.json({ items });
  } catch (error) {
    console.error('Wardrobe fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch wardrobe' });
  }
});

// ── POST /api/wardrobe/add ────────────────────────────────────────────────────────
// Premium-only: upload a clothing photo, detect the item, save to wardrobe.
router.post('/add', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    const { uid } = req;
    const userRef = db.collection('users').doc(uid);

    // ── Check premium status ──────────────────────────────────────────────────
    const userSnap = await userRef.get();
    const isSubscribed = userSnap.exists && userSnap.data().isSubscribed === true;
    if (!isSubscribed) {
      return res.status(403).json({ error: 'This feature is available for premium users only.', code: 'PREMIUM_REQUIRED' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded.' });
    }

    const mimeType = req.file.mimetype;
    const base64Image = req.file.buffer.toString('base64');

    // ── Compress & upload to Storage ──────────────────────────────────────────
    const token = crypto.randomUUID();
    let imageUrl = null;
    try {
      let uploadBuffer = req.file.buffer;
      try {
        uploadBuffer = await sharp(req.file.buffer, { failOn: 'none' })
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
      } catch (compressErr) {
        console.warn('Wardrobe add: compression skipped:', compressErr.message);
      }
      const fileName = `wardrobe/${uid}/${Date.now()}.jpg`;
      const file = bucket.file(fileName);
      await file.save(uploadBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });
      imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;
    } catch (storageErr) {
      console.error('Wardrobe add: Storage upload failed:', storageErr.message);
    }

    // ── Detect clothing item via Gemini ───────────────────────────────────────
    // Locale via query param (primary) or form field (fallback, mirrors analyze route)
    const locale = req.query?.locale || req.body?.locale || 'en';
    console.log('[wardrobe/add] locale:', locale, '| query:', req.query?.locale, '| body:', req.body?.locale);
    let clothingItems = [];
    try {
      clothingItems = await extractClothingFromImage(base64Image, mimeType, locale);
    } catch (e) {
      console.warn('Wardrobe add: Gemini extraction failed:', e.message);
    }

    if (clothingItems.length === 0) {
      return res.status(422).json({ error: 'No clothing item detected in this photo.', code: 'NO_ITEM' });
    }

    // Use the first (most prominent) detected item
    const item = clothingItems[0];
    const key = wardrobeKey(item.category, item.color, item.fit, item.material, item.pattern, item.style);
    const now = new Date().toISOString();
    const wardrobeRef = userRef.collection('wardrobe');
    const itemRef = wardrobeRef.doc(key);
    const existing = await itemRef.get();

    if (existing.exists) {
      await itemRef.update({
        lastSeenAt: now,
        ...(imageUrl && { imageUrl }),
        timesWorn: (existing.data().timesWorn || 0) + 1,
        ...(item.material && { material: item.material }),
        ...(item.pattern  && { pattern:  item.pattern  }),
        ...(item.fit      && { fit:       item.fit      }),
        ...(item.style    && { style:     item.style    }),
      });
    } else {
      await itemRef.set({
        category:    item.category || null,
        color:       item.color    || null,
        material:    item.material || null,
        pattern:     item.pattern  || null,
        fit:         item.fit      || null,
        style:       item.style    || null,
        uploadId:    null,
        imageUrl:    imageUrl || null,
        firstSeenAt: now,
        lastSeenAt:  now,
        timesWorn:   1,
      });
    }

    const saved = await itemRef.get();
    return res.json({ item: { id: key, ...saved.data() } });
  } catch (error) {
    console.error('Wardrobe add error:', error);
    return res.status(500).json({ error: 'Failed to add wardrobe item.' });
  }
});

// ── PATCH /api/wardrobe/:id ───────────────────────────────────────────────────
// Updates editable fields on a wardrobe item.
// If category/color change (key changes), the OLD item is left untouched and a
// NEW wardrobe entry is created — so the original item is never modified.
// If only non-key fields change (fit/material etc.) the existing doc is updated.
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { uid } = req;
    const oldId = req.params.id;
    const { category, color, fit, material, pattern, style, source } = req.body;

    const wardrobeRef = db.collection('users').doc(uid).collection('wardrobe');
    const now = new Date().toISOString();
    const normalize = (s) => (s || '').toLowerCase().trim();

    const oldDoc = await wardrobeRef.doc(oldId).get();
    const oldData = oldDoc.exists ? oldDoc.data() : {};

    const newCategory = category !== undefined ? (category || null) : (oldData.category || null);
    const newColor    = color    !== undefined ? (color    || null) : (oldData.color    || null);
    const newFit      = fit      !== undefined ? (fit      || null) : (oldData.fit      || null);
    const newMaterial = material !== undefined ? (material || null) : (oldData.material || null);
    const newPattern  = pattern  !== undefined ? (pattern  || null) : (oldData.pattern  || null);
    const newStyle    = style    !== undefined ? (style    || null) : (oldData.style    || null);

    const newKey = wardrobeKey(newCategory, newColor, newFit, newMaterial, newPattern, newStyle);

    // ── No identity change — update fields in place, no count changes ─────────
    if (newKey === oldId && oldDoc.exists) {
      // Remove any fields the user explicitly edited from _geminiFilledFields —
      // they're now user-owned values and should never be auto-reverted.
      const editedFields = ['fit', 'material', 'pattern', 'style'].filter((f) => {
        const submitted = req.body[f];
        return submitted !== undefined && normalize(submitted) !== normalize(oldData[f]);
      });
      const remainingFilled = (oldData._geminiFilledFields || []).filter(
        (f) => !editedFields.includes(f)
      );
      const updatedData = {
        ...oldData,
        category: newCategory, color: newColor,
        fit: newFit, material: newMaterial, pattern: newPattern, style: newStyle,
        lastSeenAt: now,
        ...(remainingFilled.length > 0
          ? { _geminiFilledFields: remainingFilled }
          : { _geminiFilledFields: FieldValue.delete() }),
      };
      await wardrobeRef.doc(oldId).update(updatedData);
      const { _geminiFilledFields: _gff, ...responseData } = updatedData;
      return res.json({ item: { id: oldId, ...responseData } });
    }

    // ── Identity changed ──────────────────────────────────────────────────────
    // Behaviour depends on where the edit came from:
    //   source='wardrobe'  → rename intent: delete old, full wear transfer
    //   source='results'   → misdetection correction: old -1, new/matched +1
    //
    // Step 1: find a matching wardrobe doc for the new identity.
    // Rules per field:
    //   • Either side blank  → wildcard (passes)
    //   • Both sides set     → must match exactly
    const editSource = source === 'wardrobe' ? 'wardrobe' : 'results';
    const newValues = { category: newCategory, color: newColor, fit: newFit, material: newMaterial, pattern: newPattern, style: newStyle };
    const allFields = ['category', 'color', 'fit', 'material', 'pattern', 'style'];

    const allSnap = await wardrobeRef.get();
    const matchDoc = allSnap.docs.find((doc) => {
      if (doc.id === oldId) return false;
      const d = doc.data();
      return allFields.every((f) => {
        const wVal = normalize(d[f]);
        const eVal = normalize(newValues[f]);
        if (!wVal || !eVal) return true; // either blank = wildcard
        return wVal === eVal;
      });
    });

    // Fields to fill from the user's edit onto the matched/new doc
    const fills = {};
    if (matchDoc) {
      const d = matchDoc.data();
      for (const f of allFields) {
        if (!(d[f] || '').trim() && (newValues[f] || '').trim()) fills[f] = newValues[f];
      }
    }

    if (matchDoc) {
      // ── Case A: new identity matches an existing wardrobe doc ─────────────
      if (editSource === 'wardrobe') {
        // Rename / merge — delete old doc and transfer ALL wears to matched item
        const transferWorn = oldDoc.exists ? (oldData.timesWorn || 1) : 1;
        if (oldDoc.exists) await wardrobeRef.doc(oldId).delete();
        await matchDoc.ref.update({ ...fills, timesWorn: FieldValue.increment(transferWorn), lastSeenAt: now });
        const { _geminiFilledFields: _gff, ...matchData } = matchDoc.data();
        return res.json({ item: { id: matchDoc.id, ...matchData, ...fills, timesWorn: (matchData.timesWorn || 0) + transferWorn, lastSeenAt: now } });
      } else {
        // Misdetection correction — old item loses 1 wear, matched item gains 1
        if (oldDoc.exists) {
          if ((oldData.timesWorn || 1) <= 1) {
            await wardrobeRef.doc(oldId).delete();
          } else {
            await wardrobeRef.doc(oldId).update({ timesWorn: FieldValue.increment(-1) });
          }
        }
        await matchDoc.ref.update({ ...fills, timesWorn: FieldValue.increment(1), lastSeenAt: now });
        const { _geminiFilledFields: _gff, ...matchData } = matchDoc.data();
        return res.json({ item: { id: matchDoc.id, ...matchData, ...fills, timesWorn: (matchData.timesWorn || 0) + 1, lastSeenAt: now } });
      }
    } else {
      // ── Case B: no match — either rename or new item ──────────────────────
      const newItemData = {
        category: newCategory, color: newColor,
        fit: newFit, material: newMaterial, pattern: newPattern, style: newStyle,
        uploadId:    oldData.uploadId || null,
        imageUrl:    oldData.imageUrl || null,
        firstSeenAt: oldData.firstSeenAt || now,
        lastSeenAt:  now,
      };

      if (editSource === 'wardrobe') {
        // Rename — delete old and inherit full wear count
        const inheritedWorn = oldData.timesWorn || 1;
        if (oldDoc.exists) await wardrobeRef.doc(oldId).delete();
        await wardrobeRef.doc(newKey).set({ ...newItemData, timesWorn: inheritedWorn });
        return res.json({ item: { id: newKey, ...newItemData, timesWorn: inheritedWorn } });
      } else {
        // Misdetection correction — old item loses 1 wear, new item starts at 1
        if (oldDoc.exists) {
          if ((oldData.timesWorn || 1) <= 1) {
            await wardrobeRef.doc(oldId).delete();
          } else {
            await wardrobeRef.doc(oldId).update({ timesWorn: FieldValue.increment(-1) });
          }
        }
        await wardrobeRef.doc(newKey).set({ ...newItemData, timesWorn: 1 });
        return res.json({ item: { id: newKey, ...newItemData, timesWorn: 1 } });
      }
    }
  } catch (error) {
    console.error('Wardrobe patch error:', error);
    return res.status(500).json({ error: 'Failed to update wardrobe item' });
  }
});

// ── DELETE /api/wardrobe/:id ──────────────────────────────────────────────────────
// Removes a single piece from the user's wardrobe.
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await db
      .collection('users')
      .doc(req.uid)
      .collection('wardrobe')
      .doc(req.params.id)
      .delete();
    return res.json({ success: true });
  } catch (error) {
    console.error('Wardrobe delete error:', error);
    return res.status(500).json({ error: 'Failed to delete wardrobe item' });
  }
});

module.exports = router;
