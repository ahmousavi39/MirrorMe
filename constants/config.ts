// ── Backend URL ───────────────────────────────────────────────────────────────────
// For local dev on a physical iPhone, replace 'localhost' with your machine's local IP
// e.g. 'http://192.168.1.42:3000'
// For production, update to your Render URL once deployed.
export const BACKEND_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://ai-stylist-backend.onrender.com';

// ── RevenueCat ────────────────────────────────────────────────────────────────────
// Get from: https://app.revenuecat.com → Project → API Keys → Apple App Store key
// ⚠️  Update this before running on a real device
export const RC_IOS_API_KEY = 'appl_YQPLsaELaIRRGITSgrNZqNFJGvB';

// ── Entitlement identifier ────────────────────────────────────────────────────────
// Must match what you set in the RevenueCat dashboard under Entitlements
export const RC_PREMIUM_ENTITLEMENT = 'ahmousavi';
