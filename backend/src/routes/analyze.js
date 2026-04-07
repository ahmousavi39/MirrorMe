const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
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

/** Stable wardrobe key from category + color */
function wardrobeKey(category, color) {
  const clean = (s) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
  return `${clean(category)}_${clean(color)}`;
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
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `uploads/${uid}/${Date.now()}.${ext}`;
    const token = crypto.randomUUID();
    let imageUrl = null;
    try {
      const file = bucket.file(fileName);
      await file.save(req.file.buffer, {
        metadata: {
          contentType: mimeType,
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });
      const bucketName = bucket.name;
      imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(fileName)}?alt=media&token=${token}`;
    } catch (storageErr) {
      console.warn('Firebase Storage upload failed (wardrobe images will be missing):', storageErr.message);
    }

    // ── 2c. Fetch user's existing wardrobe to inform Gemini suggestions ───────
    let wardrobeItems = [];
    try {
      const wardrobeSnap = await userRef.collection('wardrobe').get();
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
      return res.status(502).json({ error: 'AI rating service unavailable. Please try again.' });
    }

    // ── 5. Save result to Firestore (Firestore only — no Storage needed) ───────
    const uploadRef = userRef.collection('uploads').doc();
    const uploadData = {
      score: geminiResult.score,
      feedback: geminiResult.feedback,
      styleTips: geminiResult.styleTips,
      occasionTips: geminiResult.occasionTips,
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
    if (clothingItems.length > 0) {
      try {
        const now = new Date().toISOString();
        const wardrobeRef = userRef.collection('wardrobe');
        await Promise.all(clothingItems.map(async (item) => {
          const key = wardrobeKey(item.category, item.color);
          const itemRef = wardrobeRef.doc(key);
          const existing = await itemRef.get();
          if (existing.exists) {
            await itemRef.update({
              lastSeenAt: now,
              uploadId: uploadRef.id,
              imageUrl: imageUrl || existing.data().imageUrl || null,
              timesWorn: (existing.data().timesWorn || 1) + 1,
              // Update fields if we now have better data
              ...(item.material && { material: item.material }),
              ...(item.pattern && { pattern: item.pattern }),
              ...(item.fit     && { fit: item.fit }),
              ...(item.style   && { style: item.style }),
            });
          } else {
            await itemRef.set({
              category:    item.category   || null,
              color:       item.color      || null,
              material:    item.material   || null,
              pattern:     item.pattern    || null,
              fit:         item.fit        || null,
              style:       item.style      || null,
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
    }

    return res.json({
      uploadId: uploadRef.id,
      score: geminiResult.score,
      feedback: geminiResult.feedback,
      styleTips: geminiResult.styleTips,
      occasionTips: geminiResult.occasionTips,
      occasionScores: geminiResult.occasionScores,
      colorPalette: geminiResult.colorPalette,
      clothingItems,
      occasion: occasion || null,
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
