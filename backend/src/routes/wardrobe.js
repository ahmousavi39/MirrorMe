const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const sharp = require('sharp');
const router = express.Router();

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

/** Stable wardrobe key from category + color */
function wardrobeKey(category, color) {
  const clean = (s) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
  return `${clean(category)}_${clean(color)}`;
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

    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ items });
  } catch (error) {
    console.error('Wardrobe fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch wardrobe' });
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
    let clothingItems = [];
    try {
      clothingItems = await extractClothingFromImage(base64Image, mimeType);
    } catch (e) {
      console.warn('Wardrobe add: Gemini extraction failed:', e.message);
    }

    if (clothingItems.length === 0) {
      return res.status(422).json({ error: 'No clothing item detected in this photo.', code: 'NO_ITEM' });
    }

    // Use the first (most prominent) detected item
    const item = clothingItems[0];
    const key = wardrobeKey(item.category, item.color);
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

module.exports = router;
