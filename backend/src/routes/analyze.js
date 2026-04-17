const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const sharp = require('sharp');
const router = express.Router();

const { FieldValue } = require('firebase-admin/firestore');
const verifyToken = require('../middleware/verifyToken');
const { db, bucket } = require('../services/firebase');
const { analyzeClothing } = require('../services/ximilar');
const { rateOutfit, extractClothingFromImage } = require('../services/gemini');

const FREE_UPLOADS_PER_WEEK = 2;
const PREMIUM_UPLOADS_PER_MONTH = 100;
const MAX_UPLOADS_PER_DAY = 20;

// ── Cancel-token map ──────────────────────────────────────────────────────────────
// Tracks in-flight requests by client-supplied UUID.
// 'active' = running, 'cancelled' = client pressed cancel before commit.
// Entries are deleted once the request finishes (committed or cancelled).
const activeRequests = new Map(); // token -> 'active' | 'cancelled'

// DELETE /api/analyze/:cancelToken  — called by client to cancel before commit
router.delete('/:cancelToken', verifyToken, (req, res) => {
  const { cancelToken } = req.params;
  if (activeRequests.has(cancelToken)) {
    activeRequests.set(cancelToken, 'cancelled');
    return res.json({ cancelled: true });
  }
  // Token not found (request already finished) — treat as no-op
  return res.json({ cancelled: false });
});
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

/** Returns the month key for the current date, e.g. "2026-04" */
function getMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Returns the day key for the current date, e.g. "2026-04-11" */
function getDayKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
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
  let cancelToken = null;
  try {
    const { uid, email } = req;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo provided. Send a multipart/form-data request with field "photo".' });
    }

    // ── 1. Check upload limits ────────────────────────────────────────────────
    const weekKey = getWeekKey();
    const monthKey = getMonthKey();
    const dayKey = getDayKey();
    const userRef = db.collection('users').doc(uid);
    const weeklyRef = userRef.collection('weeklyUploads').doc(weekKey);
    const monthlyRef = userRef.collection('monthlyUploads').doc(monthKey);
    const dailyRef = userRef.collection('dailyUploads').doc(dayKey);

    const [userSnap, weeklySnap, monthlySnap, dailySnap] = await Promise.all([
      userRef.get(),
      weeklyRef.get(),
      monthlyRef.get(),
      dailyRef.get(),
    ]);

    const userData = userSnap.data() || {};
    const isSubscribed = userData.isSubscribed === true;
    const weeklyCount = weeklySnap.exists ? (weeklySnap.data().count || 0) : 0;
    const monthlyCount = monthlySnap.exists ? (monthlySnap.data().count || 0) : 0;
    const dailyCount = dailySnap.exists ? (dailySnap.data().count || 0) : 0;

    // Hard daily cap (silent — returned as generic error to avoid leaking info)
    if (dailyCount >= MAX_UPLOADS_PER_DAY) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

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

    if (isSubscribed && monthlyCount >= PREMIUM_UPLOADS_PER_MONTH) {
      return res.status(403).json({
        error: 'Monthly premium limit reached',
        code: 'PREMIUM_LIMIT_REACHED',
        message: `You have used all ${PREMIUM_UPLOADS_PER_MONTH} Premium scans for this month. Your limit resets on the 1st of next month.`,
        monthlyUploadsUsed: monthlyCount,
        monthlyUploadsLimit: PREMIUM_UPLOADS_PER_MONTH,
        isSubscribed: true,
      });
    }

    // ── 2. Convert image buffer to base64 ─────────────────────────────────────
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    const occasion = req.body?.occasion || null;
    const shareWardrobe = req.body?.shareWardrobe !== 'false';
    const addToWardrobe = req.body?.addToWardrobe !== 'false';
    const locale = req.body?.locale || 'en';
    cancelToken = req.body?.cancelToken || null;
    if (cancelToken) activeRequests.set(cancelToken, 'active');

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

    // ── 2c. Fetch user's existing wardrobe ───────────────────────────────────
    // Always fetch if addToWardrobe (need existingDocs for upsert matching).
    // Only pass items to Gemini when shareWardrobe is enabled.
    const needsWardrobe = shareWardrobe || addToWardrobe;
    let wardrobeItems = [];
    let wardrobeSnap = null;
    if (needsWardrobe) {
      try {
        wardrobeSnap = await userRef.collection('wardrobe').get();
        if (shareWardrobe) {
          wardrobeItems = wardrobeSnap.docs.map((d) => d.data());
        }
      } catch (e) {
        console.warn('Could not fetch wardrobe:', e.message);
      }
    }

    // ── 3. Ximilar — identify clothing items ──────────────────────────────────
    let clothingItems = [];
    try {
      clothingItems = await analyzeClothing(base64Image);
    } catch (ximilarErr) {
      // Ximilar unavailable — fall back to Gemini vision for clothing extraction
      console.warn('Ximilar failed, trying Gemini fallback for clothing tags:', ximilarErr.message);
      try {
        clothingItems = await extractClothingFromImage(base64Image, mimeType, locale);
        console.log(`Gemini extracted ${clothingItems.length} clothing item(s) as fallback`);
      } catch (fallbackErr) {
        // Still non-fatal — Gemini can rate the outfit from the image alone
        console.warn('Gemini clothing fallback also failed:', fallbackErr.message);
      }
    }

    // ── 4. Gemini — rate the outfit ───────────────────────────────────────────
    let geminiResult;
    try {
      geminiResult = await rateOutfit(base64Image, clothingItems, mimeType, occasion, userProfile, wardrobeItems, locale);
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

    // Replace [key:xxx] markers in tip text with the readable item name so the
    // sentence stays intact. Falls back to stripping if no matching item found.
    const resolveKeys = (s) => {
      if (typeof s !== 'string') return s;
      return s
        .replace(/\[key:([^\]]+)\]/g, (match, key) => {
          const item = wardrobeByKey[key];
          if (!item) return '';
          return item.color && item.category
            ? `${item.color} ${item.category}`
            : item.category || '';
        })
        .replace(/\s{2,}/g, ' ')
        .trim();
    };
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

    const cleanStyleTips   = (geminiResult.styleTips   || []).map(resolveKeys);
    const cleanOccasionTips = (geminiResult.occasionTips || []).map(resolveKeys);

    const uploadRef = userRef.collection('uploads').doc();
    const batch = db.batch();

    // ── 5b. Resolve wardrobe upserts BEFORE batch commit ─────────────────────
    // All wardrobe writes are added to the SAME batch as the upload doc so that
    // everything commits atomically.  This guarantees:
    //   • If Gemini failed (step 4) we returned early — batch never built.
    //   • If the batch itself fails — neither the upload NOR wardrobe are touched.
    //   • Items are never added to the wardrobe unless the full analysis succeeded.
    const clothingItemKeys = clothingItems.map(() => null); // default null
    if (addToWardrobe && clothingItems.length > 0) {
      const now = new Date().toISOString();
      const wardrobeRef = userRef.collection('wardrobe');
      const existingDocs = wardrobeSnap ? wardrobeSnap.docs : [];
      const normalize = (s) => (s || '').toLowerCase().trim();

      for (let idx = 0; idx < clothingItems.length; idx++) {
        const item = clothingItems[idx];
        const categoryNorm = normalize(item.category);
        const colorNorm    = normalize(item.color);
        const secondaryFields = ['fit', 'material', 'pattern', 'style'];

        const candidates = existingDocs.filter((doc) => {
          const d = doc.data();
          return normalize(d.category) === categoryNorm
              && normalize(d.color)    === colorNorm;
        });

        const scored = candidates.map((doc) => {
          const d = doc.data();
          const hasAnySecondary = secondaryFields.some((f) => (d[f] || '').trim() !== '');
          const matchCount = secondaryFields.filter(
            (f) => normalize(d[f]) === normalize(item[f])
          ).length;
          return { doc, matchCount, hasAnySecondary };
        });

        const qualified = scored.filter(
          ({ matchCount, hasAnySecondary }) => !hasAnySecondary || matchCount >= 1
        );

        let matchDoc = null;
        if (qualified.length === 1) {
          matchDoc = qualified[0].doc;
        } else if (qualified.length > 1) {
          matchDoc = qualified.reduce(
            (best, cur) => cur.matchCount > best.matchCount ? cur : best
          ).doc;
        }

        if (matchDoc) {
          const d = matchDoc.data();
          const merged = {};
          for (const f of secondaryFields) {
            const wardrobeVal = (d[f] || '').trim();
            const geminiVal   = (item[f] || '').trim();
            if (!wardrobeVal && geminiVal) merged[f] = item[f];
          }
          const geminiFilledFields = Object.keys(merged);
          const existingFilled = Array.isArray(d._geminiFilledFields) ? d._geminiFilledFields : [];
          const unionFilled = [...new Set([...existingFilled, ...geminiFilledFields])];
          clothingItemKeys[idx] = matchDoc.id;
          batch.update(matchDoc.ref, {
            ...merged,
            ...(unionFilled.length > 0
              ? { _geminiFilledFields: unionFilled }
              : { _geminiFilledFields: FieldValue.delete() }),
            lastSeenAt: now,
            uploadId:   uploadRef.id,
            imageUrl:   imageUrl || d.imageUrl || null,
            timesWorn:  FieldValue.increment(1),
          });
        } else {
          const key = wardrobeKey(
            item.category, item.color, item.fit,
            item.material, item.pattern, item.style,
          );
          clothingItemKeys[idx] = key;
          batch.set(wardrobeRef.doc(key), {
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
      }
    }

    // ── 5. Commit everything atomically ──────────────────────────────────────
    // uploadData now includes clothingItemKeys so no separate update is needed.
    const uploadData = {
      score: geminiResult.score,
      feedback: geminiResult.feedback,
      styleTips: cleanStyleTips,
      styleTipItems,
      occasionTips: cleanOccasionTips,
      occasionTipItems,
      occasionScores: geminiResult.occasionScores,
      colorPalette: geminiResult.colorPalette,
      clothingItems,
      clothingItemsLocalized: geminiResult.clothingItemsLocalized || null,
      clothingItemKeys,
      occasion: occasion || null,
      imageUrl: imageUrl || null,
      weekKey,
      createdAt: new Date().toISOString(),
    };

    // Save upload result
    batch.set(uploadRef, uploadData);

    // Increment weekly counter (free users) and monthly counter (all users)
    batch.set(weeklyRef, { count: weeklyCount + 1 }, { merge: true });
    batch.set(monthlyRef, { count: monthlyCount + 1 }, { merge: true });
    batch.set(dailyRef, { count: dailyCount + 1 }, { merge: true });

    // Create user document on first upload
    if (!userSnap.exists) {
      batch.set(userRef, {
        email: email || '',
        createdAt: new Date().toISOString(),
        isSubscribed: false,
      });
    }

    // Check if client cancelled before we commit anything to Firestore
    if (cancelToken && activeRequests.get(cancelToken) === 'cancelled') {
      activeRequests.delete(cancelToken);
      return res.status(499).json({ error: 'Cancelled by client', code: 'CANCELLED' });
    }

    await batch.commit();

    if (cancelToken) activeRequests.delete(cancelToken);
    return res.json({
      uploadId: uploadRef.id,
      score: geminiResult.score,
      feedback: geminiResult.feedback,
      styleTips: cleanStyleTips,
      styleTipItems,
      occasionTips: cleanOccasionTips,
      occasionTipItems,
      occasionScores: geminiResult.occasionScores,
      colorPalette: geminiResult.colorPalette,
      clothingItems,
      clothingItemsLocalized: geminiResult.clothingItemsLocalized || null,
      clothingItemKeys,
      occasion: occasion || null,
      imageUrl: imageUrl || null,
      uploadsUsedThisWeek: weeklyCount + 1,
      uploadsLimitPerWeek: FREE_UPLOADS_PER_WEEK,
      remainingFreeUploads: isSubscribed ? null : Math.max(0, FREE_UPLOADS_PER_WEEK - (weeklyCount + 1)),
      monthlyUploadsUsed: isSubscribed ? monthlyCount + 1 : null,
      monthlyUploadsLimit: isSubscribed ? PREMIUM_UPLOADS_PER_MONTH : null,
      remainingPremiumUploads: isSubscribed ? Math.max(0, PREMIUM_UPLOADS_PER_MONTH - (monthlyCount + 1)) : null,
      isSubscribed,
    });
  } catch (error) {
    if (cancelToken) activeRequests.delete(cancelToken);
    console.error('Analyze route error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
