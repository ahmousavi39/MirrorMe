const express = require('express');
const router = express.Router();

const { db } = require('../services/firebase');
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

module.exports = router;
