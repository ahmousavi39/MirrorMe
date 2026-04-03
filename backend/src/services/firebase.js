const admin = require('firebase-admin');
const path = require('path');

/**
 * Firebase Admin SDK initializer.
 * - Local dev: reads serviceAccountKey.json from the credits folder
 * - Production (Render): reads from FIREBASE_SERVICE_ACCOUNT env var (full JSON string)
 */
if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Production: env var contains the full JSON of the service account key
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Local dev: resolve path relative to this file
    // __dirname = backend/src/services  →  ../../../credits = AI Stylist/credits
    const keyPath = path.resolve(__dirname, '../../../credits/serviceAccountKey.json');
    const serviceAccount = require(keyPath);
    credential = admin.credential.cert(serviceAccount);
  }

  admin.initializeApp({ credential });
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth, admin };
