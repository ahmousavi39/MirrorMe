const express = require('express');
const router = express.Router();

const { db, auth } = require('../services/firebase');
const verifyToken = require('../middleware/verifyToken');

// ── POST /api/user/init ───────────────────────────────────────────────────────────
// Called by the app on first login to ensure the Firestore user document exists
router.post('/init', verifyToken, async (req, res) => {
  try {
    const { uid, email } = req;
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      await userRef.set({
        email: email || '',
        createdAt: new Date().toISOString(),
        isSubscribed: false,
        rcEntitlement: null,
      });
    }

    return res.json({ success: true, isNewUser: !userSnap.exists });
  } catch (error) {
    console.error('User init error:', error);
    return res.status(500).json({ error: 'Failed to initialize user' });
  }
});

// ── GET /api/user/profile ─────────────────────────────────────────────────────────
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userSnap = await db.collection('users').doc(req.uid).get();
    const d = userSnap.data() || {};
    return res.json({
      name: d.name || null,
      sex: d.sex || null,
      age: d.age || null,
      heightCm: d.heightCm || null,
      weightKg: d.weightKg || null,
      styleCategories: d.styleCategories || [],
    });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ── POST /api/user/profile ────────────────────────────────────────────────────────
// Saves onboarding / settings profile fields
router.post('/profile', verifyToken, async (req, res) => {
  try {
    const { name, sex, age, heightCm, weightKg, styleCategories } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    const update = {
      name: name.trim(),
      sex: sex || null,
      age: age != null ? Number(age) : null,
      heightCm: heightCm != null ? Number(heightCm) : null,
      weightKg: weightKg != null ? Number(weightKg) : null,
      styleCategories: Array.isArray(styleCategories) ? styleCategories : [],
      profileComplete: true,
    };
    await db.collection('users').doc(req.uid).update(update);
    return res.json({ success: true });
  } catch (error) {
    console.error('Save profile error:', error);
    return res.status(500).json({ error: 'Failed to save profile' });
  }
});

// ── GET /api/user/history ─────────────────────────────────────────────────────────
// Returns the 20 most recent style analyses for the authenticated user
router.get('/history', verifyToken, async (req, res) => {
  try {
    const uploadsRef = db
      .collection('users')
      .doc(req.uid)
      .collection('uploads')
      .orderBy('createdAt', 'desc')
      .limit(20);

    const snapshot = await uploadsRef.get();

    const uploads = [];
    snapshot.forEach((doc) => {
      uploads.push({ id: doc.id, ...doc.data() });
    });

    return res.json({ uploads });
  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({ error: 'Failed to get upload history' });
  }
});

// ── DELETE /api/user/history/:uploadId ───────────────────────────────────────────
// Deletes a single upload result for the authenticated user
router.delete('/history/:uploadId', verifyToken, async (req, res) => {
  try {
    const docRef = db
      .collection('users')
      .doc(req.uid)
      .collection('uploads')
      .doc(req.params.uploadId);

    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    await docRef.delete();
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete upload error:', error);
    return res.status(500).json({ error: 'Failed to delete upload' });
  }
});

// ── GET /api/user/history/:uploadId ──────────────────────────────────────────────
// Returns a single upload result by ID
router.get('/history/:uploadId', verifyToken, async (req, res) => {
  try {
    const docRef = db
      .collection('users')
      .doc(req.uid)
      .collection('uploads')
      .doc(req.params.uploadId);

    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    return res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    console.error('Upload detail error:', error);
    return res.status(500).json({ error: 'Failed to get upload' });
  }
});

// ── GET /api/user/settings ────────────────────────────────────────────────────────
// Returns the user's app settings stored on their Firestore doc.
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const userSnap = await db.collection('users').doc(req.uid).get();
    const d = userSnap.data() || {};
    return res.json({
      shareWardrobe: d.shareWardrobe !== false, // default true
      addToWardrobe: d.addToWardrobe !== false, // default true
      language: d.language || null,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return res.status(500).json({ error: 'Failed to get settings' });
  }
});

// ── PATCH /api/user/settings ──────────────────────────────────────────────────────
// Updates one or more app settings on the user's Firestore doc.
router.patch('/settings', verifyToken, async (req, res) => {
  try {
    const VALID_LOCALES = ['en', 'zh-Hans', 'ja', 'de', 'fr', 'es'];
    const allowed = ['shareWardrobe', 'addToWardrobe'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key] === true || req.body[key] === 'true';
      }
    }
    if (req.body.language !== undefined) {
      if (VALID_LOCALES.includes(req.body.language)) {
        update.language = req.body.language;
      }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }
    await db.collection('users').doc(req.uid).update(update);
    return res.json({ success: true, ...update });
  } catch (error) {
    console.error('Save settings error:', error);
    return res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ── DELETE /api/user/account ──────────────────────────────────────────────────────
// Deletes all Firestore sub-collections and documents for the user, then removes
// the Firebase Auth account. The client must re-authenticate before calling this.
router.delete('/account', verifyToken, async (req, res) => {
  const { uid } = req;
  try {
    const userRef = db.collection('users').doc(uid);

    // Delete known sub-collections
    const subCollections = ['history', 'wardrobe'];
    for (const col of subCollections) {
      const snap = await userRef.collection(col).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // Delete the user document itself
    await userRef.delete();

    // Delete the Firebase Auth account
    await auth.deleteUser(uid);

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ── POST /api/user/check-email ────────────────────────────────────────────────────
// Public endpoint — checks if an email address belongs to a registered user.
router.post('/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    await auth.getUserByEmail(email.trim().toLowerCase());
    return res.json({ exists: true });
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      return res.status(404).json({ exists: false });
    }
    console.error('check-email error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
