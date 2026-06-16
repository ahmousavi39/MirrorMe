// ── Backend URL ───────────────────────────────────────────────────────────────────
export const BACKEND_URL = 'https://server.mirrorme.ahmousavi.com';

// ── Firebase Auth email action settings (replaces deprecated Dynamic Links) ───────
// Tells Firebase to generate a Universal Link / App Link instead of a Dynamic Link
// so that verification & password-reset emails open directly in the app.
// NOTE: Add the iOS bundle ID and Android package name in Firebase Console under
// Authentication → Settings → Authorized domains / iOS & Android apps so that
// Firebase hosts the apple-app-site-association and assetlinks.json for this domain.
export const EMAIL_ACTION_CODE_SETTINGS = {
  // After the action is handled the browser lands on the app's Firebase Hosting page.
  url: 'https://ai-stylist-88cbb.firebaseapp.com',
  // handleCodeInApp:true → Firebase generates a Universal Link (iOS) / App Link
  // (Android) pointing at firebaseapp.com/__/auth/action; the OS opens the app
  // instead of a browser so we can call applyActionCode / confirmPasswordReset in-app.
  handleCodeInApp: true,
  iOS: { bundleId: 'com.ahmousavi.mirrorme' },
  android: {
    packageName: 'com.ahmousavi.MirrorMe',
    installIfNotInstalled: true,
    minimumVersion: '12',
  },
} as const;
// ── Google OAuth ──────────────────────────────────────────────────────────────
// iOS client ID from GoogleService-Info.plist (CLIENT_ID)
export const GOOGLE_IOS_CLIENT_ID = '511134609232-l6ufeq2gnunaqp2j32kt7p8duop9ffd2.apps.googleusercontent.com';
// Web client ID (type 3) from google-services.json
export const GOOGLE_WEB_CLIENT_ID = '511134609232-mbhf5qai24k9vsqbk1i0l6p8k4k0qbgv.apps.googleusercontent.com';
// ── RevenueCat ────────────────────────────────────────────────────────────────────
// Get from: https://app.revenuecat.com → Project → API Keys → Apple App Store key
export const RC_IOS_API_KEY = 'appl_YQPLsaELaIRRGITSgrNZqNFJGvB';

// Must match the Offering identifier in RevenueCat dashboard (set to 'default' or your custom one)
export const RC_OFFERING_ID = 'MirrorMe_Premium';

// Must match the Entitlement identifier in RevenueCat dashboard
export const RC_PREMIUM_ENTITLEMENT = 'Ahmousavi Pro';
