const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const sharp = require('sharp');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { db, bucket } = require('../services/firebase');
const { analyzeClothing } = require('../services/ximilar');
const { rateOutfit, extractClothingFromImage } = require('../services/gemini');

const FREE_UPLOADS_PER_WEEK = 2;

// ── Multer: store file in memory as Buffer (no disk, no Firebase Storage needed) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────────

/** Returns the ISO week key for the current date, e.g. "2026-W14" */
function getWeekKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((now - startOfYear) / 86_400_000);
  const week = Math.ceil((dayOfYear + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Wardrobe document key — includes all 6 identifying fields so items that differ
 *  on even a single field (e.g. fit) are stored as separate wardrobe entries. */
function wardrobeKey(category, color, fit, material, pattern, style) {
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

// ── POST /api/analyze ─────────────────────────────────────────────────────────────
router.post('/', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    const { uid, email } = req;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo provided. Send a multipart/form-data request with field "photo".' });
    }

    // ── 1. Check weekly upload limit ──────────────────────────────────────────
    const weekKey = getWeekKey();
    const userRef = db.collection('users').doc(uid);
    const weeklyRef = userRef.collection('weeklyUploads').doc(weekKey);

    const [userSnap, weeklySnap] = await Promise.all([userRef.get(), weeklyRef.get()]);

    const userData = userSnap.data() || {};
    const isSubscribed = userData.isSubscribed === true;
    const weeklyCount = weeklySnap.exists ? (weeklySnap.data().count || 0) : 0;

    // Pull profile fields already stored on the user doc (set during onboarding)
    const userProfile = {
      name:             userData.name             || null,
      sex:              userData.sex              || null,
      age:              userData.age              || null,
      heightCm:         userData.heightCm         || null,
      weightKg:         userData.weightKg         || null,
      styleCategories:  userData.styleCategories  || [],
    };

    if (!isSubscribed && weeklyCount >= FREE_UPLOADS_PER_WEEK) {
      return res.status(403).json({
        error: 'Weekly free limit reached',
        code: 'LIMIT_REACHED',
        message: `You have used all ${FREE_UPLOADS_PER_WEEK} free uploads for this week. Upgrade to Premium for unlimited access.`,
        uploadsUsedThisWeek: weeklyCount,
        uploadsLimitPerWeek: FREE_UPLOADS_PER_WEEK,
        isSubscribed: false,
      });
    }

    // ── 2. Convert image buffer to base64 ─────────────────────────────────────
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    const occasion = req.body?.occasion || null;

    // ── 2b. Upload image to Firebase Storage ──────────────────────────────────
    const token = crypto.randomUUID();
    let imageUrl = null;
    try {
      // Try to compress to JPEG. Falls back to original buffer if sharp can't
      // handle the format (e.g. HEIC on a server without libheif support).
      let uploadBuffer = req.file.buffer;
      let uploadMime = mimeType;
      let uploadExt = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      try {
        uploadBuffer = await sharp(req.file.buffer, { failOn: 'none' })
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
        uploadMime = 'image/jpeg';
        uploadExt = 'jpg';
      } catch (compressErr) {
        console.warn('Image compression skipped, uploading original:', compressErr.message);
      }
      const fileName = `uploads/${uid}/${Date.now()}.${uploadExt}`;
      const file = bucket.file(fileName);
      await file.save(uploadBuffer, {
        metadata: {
          contentType: uploadMime,
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });
      const bucketName = bucket.name;
      imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;
    } catch (storageErr) {
      console.error('Firebase Storage upload failed:', storageErr.message);
    }

    // ── 2c. Fetch user's existing wardrobe to inform Gemini suggestions ───────
    let wardrobeItems = [];
    let wardrobeSnap = null;
    try {
      wardrobeSnap = await userRef.collection('wardrobe').get();
      wardrobeItems = wardrobeSnap.docs.map((d) => d.data());
    } catch (e) {
      console.warn('Could not fetch wardrobe:', e.message);
    }

    // ── 3. Ximilar — identify clothing items ──────────────────────────────────
    let clothingItems = [];
    try {
      clothingItems = await analyzeClothing(base64Image);
    } catch (ximilarErr) {
      // Ximilar unavailable — fall back to Gemini vision for clothing extraction
      console.warn('Ximilar failed, trying Gemini fallback for clothing tags:', ximilarErr.message);
      try {
        clothingItems = await extractClothingFromImage(base64Image, mimeType);
        console.log(`Gemini extracted ${clothingItems.length} clothing item(s) as fallback`);
      } catch (fallbackErr) {
        // Still non-fatal — Gemini can rate the outfit from the image alone
        console.warn('Gemini clothing fallback also failed:', fallbackErr.message);
      }
    }

    // ── 4. Gemini — rate the outfit ───────────────────────────────────────────
    let geminiResult;
    try {
      geminiResult = await rateOutfit(base64Image, clothingItems, mimeType, occasion, userProfile, wardrobeItems);
    } catch (geminiErr) {
      console.error('Gemini error:', geminiErr.message);
      if (geminiErr.code === 'NO_PERSON') {
        return res.status(422).json({ error: geminiErr.message, code: 'NO_PERSON' });
      }
      if (geminiErr.code === 'NO_OUTFIT') {
        return res.status(422).json({ error: geminiErr.message, code: 'NO_OUTFIT' });
      }
      return res.status(502).json({ error: 'AI rating service unavailable. Please try again.' });
    }

    // ── 5. Save result to Firestore (Firestore only — no Storage needed) ───────
    // Resolve each styleTipRef key to a human-readable item label (or null)
    const wardrobeByKey = {};
    wardrobeItems.forEach((w) => {
      const clean = (s) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
      const key = `${clean(w.category)}_${clean(w.color)}`;
      wardrobeByKey[key] = w;
    });
    const styleTipItems = (geminiResult.styleTipRefs || []).map((ref) => {
      if (!ref) return null;
      const item = wardrobeByKey[ref];
      if (!item) return null;
      const details = [item.color, item.fit, item.material].filter(Boolean).join(' · ');
      return details ? `${item.category} · ${details}` : item.category;
    });
    const occasionTipItems = (geminiResult.occasionTipRefs || []).map((ref) => {
      if (!ref) return null;
      const item = wardrobeByKey[ref];
      if (!item) return null;
      const details = [item.color, item.fit, item.material].filter(Boolean).join(' · ');
      return details ? `${item.category} · ${details}` : item.category;
    });

    const uploadRef = userRef.collection('uploads').doc();
    const uploadData = {
      score: geminiResult.score,
      feedback: geminiResult.feedback,
      styleTips: geminiResult.styleTips,
      styleTipItems,
      occasionTips: geminiResult.occasionTips,
      occasionTipItems,
      occasionScores: geminiResult.occasionScores,
      colorPalette: geminiResult.colorPalette,
      clothingItems,
      occasion: occasion || null,
      imageUrl: imageUrl || null,
      weekKey,
      createdAt: new Date().toISOString(),
    };

    const batch = db.batch();

    // Save upload result
    batch.set(uploadRef, uploadData);

    // Increment weekly counter
    batch.set(weeklyRef, { count: weeklyCount + 1 }, { merge: true });

    // Create user document on first upload
    if (!userSnap.exists) {
      batch.set(userRef, {
        email: email || '',
        createdAt: new Date().toISOString(),
        isSubscribed: false,
      });
    }

    await batch.commit();

    // ── 5b. Upsert detected items into user's wardrobe ────────────────────────
    // An item is considered the SAME only when all 6 fields match exactly.
    // If it differs on even one field (e.g. fit: slim vs regular) it is a new item.
    // clothingItemKeys tracks the ACTUAL Firestore doc ID used for each item so the
    // frontend can PATCH the right document later (avoids key-formula mismatches).
    const clothingItemKeys = clothingItems.map(() => null); // default null
    if (clothingItems.length > 0) {
      try {
        const now = new Date().toISOString();
        const wardrobeRef = userRef.collection('wardrobe');
        const existingDocs = wardrobeSnap ? wardrobeSnap.docs : [];
        const normalize = (s) => (s || '').toLowerCase().trim();

        await Promise.all(clothingItems.map(async (item, idx) => {
          // Loose match on category + color — Gemini's secondary fields (fit, material,
          // pattern, style) are often imprecise, so we don't require them to match.
          // If multiple docs share the same category+color (e.g. two blue t-shirts),
          // prefer the one whose secondary fields are closest (most fields match).
          const categoryNorm = normalize(item.category);
          const colorNorm    = normalize(item.color);

          const candidates = existingDocs.filter((doc) => {
            const d = doc.data();
            return normalize(d.category) === categoryNorm
                && normalize(d.color)    === colorNorm;
          });

          let matchDoc = null;
          if (candidates.length === 1) {
            matchDoc = candidates[0];
          } else if (candidates.length > 1) {
            // Pick the candidate with the most matching secondary fields
            const secondaryFields = ['fit', 'material', 'pattern', 'style'];
            let bestScore = -1;
            for (const doc of candidates) {
              const d = doc.data();
              const score = secondaryFields.filter(
                (f) => normalize(d[f]) === normalize(item[f])
              ).length;
              if (score > bestScore) { bestScore = score; matchDoc = doc; }
            }
          }

          if (matchDoc) {
            // Match found — increment timesWorn; do NOT overwrite existing field
            // values since the user may have manually corrected them before.
            clothingItemKeys[idx] = matchDoc.id;
            await matchDoc.ref.update({
              lastSeenAt: now,
              uploadId:   uploadRef.id,
              imageUrl:   imageUrl || matchDoc.data().imageUrl || null,
              timesWorn:  (matchDoc.data().timesWorn || 1) + 1,
            });
          } else {
            // No match — create a new wardrobe item with all detected fields
            const key = wardrobeKey(
              item.category, item.color, item.fit,
              item.material, item.pattern, item.style,
            );
            clothingItemKeys[idx] = key;
            await wardrobeRef.doc(key).set({
              category: item.category || null,
              color:    item.color    || null,
              material: item.material || null,
              pattern:  item.pattern  || null,
              fit:      item.fit      || null,
              style:    item.style    || null,
              uploadId:    uploadRef.id,
              imageUrl:    imageUrl || null,
              firstSeenAt: now,
              lastSeenAt:  now,
              timesWorn:   1,
            });
          }
        }));
      } catch (e) {
        console.warn('Wardrobe upsert failed (non-fatal):', e.message);
      }

      // Persist clothingItemKeys to the upload doc so history items can look up the
      // correct Firestore wardrobe doc IDs when the user edits clothing chips later.
      if (clothingItemKeys.some((k) => k !== null)) {
        try {
          await uploadRef.update({ clothingItemKeys });
        } catch (e) {
          console.warn('Could not save clothingItemKeys to upload doc (non-fatal):', e.message);
        }
      }
    }

    return res.json({
      uploadId: uploadRef.id,
      score: geminiResult.score,
      feedback: geminiResult.feedback,
      styleTips: geminiResult.styleTips,
      styleTipItems,
      occasionTips: geminiResult.occasionTips,
      occasionTipItems,
      occasionScores: geminiResult.occasionScores,
      colorPalette: geminiResult.colorPalette,
      clothingItems,
      clothingItemKeys,
      occasion: occasion || null,
      imageUrl: imageUrl || null,
      uploadsUsedThisWeek: weeklyCount + 1,
      uploadsLimitPerWeek: FREE_UPLOADS_PER_WEEK,
      remainingFreeUploads: isSubscribed ? null : Math.max(0, FREE_UPLOADS_PER_WEEK - (weeklyCount + 1)),
      isSubscribed,
    });
  } catch (error) {
    console.error('Analyze route error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
