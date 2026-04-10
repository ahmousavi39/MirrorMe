const express = require('express');
const router = express.Router();

const { db } = require('../services/firebase');
const verifyToken = require('../middleware/verifyToken');

const FREE_UPLOADS_PER_WEEK = 2;
const PREMIUM_UPLOADS_PER_MONTH = 100;

// ── Helper ────────────────────────────────────────────────────────────────────────
function getWeekKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((now - startOfYear) / 86_400_000);
  const week = Math.ceil((dayOfYear + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── GET /api/subscription/status ─────────────────────────────────────────────────
// Returns the current user's subscription state and weekly upload usage.
// The app also reads entitlements directly from RevenueCat SDK on-device,
// but this endpoint is the source of truth for the backend upload-limit check.
router.get('/status', verifyToken, async (req, res) => {
  try {
    const weekKey = getWeekKey();
    const monthKey = getMonthKey();
    const userRef = db.collection('users').doc(req.uid);

    const [userSnap, weeklySnap, monthlySnap] = await Promise.all([
      userRef.get(),
      userRef.collection('weeklyUploads').doc(weekKey).get(),
      userRef.collection('monthlyUploads').doc(monthKey).get(),
    ]);

    const userData = userSnap.data() || {};
    const weeklyCount = weeklySnap.exists ? (weeklySnap.data().count || 0) : 0;
    const monthlyCount = monthlySnap.exists ? (monthlySnap.data().count || 0) : 0;
    const isSubscribed = userData.isSubscribed === true;

    return res.json({
      isSubscribed,
      uploadsUsedThisWeek: weeklyCount,
      uploadsLimitPerWeek: FREE_UPLOADS_PER_WEEK,
      remainingFreeUploads: isSubscribed ? null : Math.max(0, FREE_UPLOADS_PER_WEEK - weeklyCount),
      monthlyUploadsUsed: isSubscribed ? monthlyCount : null,
      monthlyUploadsLimit: isSubscribed ? PREMIUM_UPLOADS_PER_MONTH : null,
      remainingPremiumUploads: isSubscribed ? Math.max(0, PREMIUM_UPLOADS_PER_MONTH - monthlyCount) : null,
    });
  } catch (error) {
    console.error('Status error:', error);
    return res.status(500).json({ error: 'Failed to retrieve subscription status' });
  }
});

// ── POST /api/subscription/webhook ───────────────────────────────────────────────
// RevenueCat sends events here whenever a subscription changes.
//
// Setup in RevenueCat dashboard:
//   Project → Integrations → Webhooks → Add endpoint:
//   URL: https://your-backend.onrender.com/api/subscription/webhook
//   Authorization header value: <your secret>  →  save as REVENUECAT_WEBHOOK_SECRET
//
// IMPORTANT: set the Firebase UID as the RevenueCat app_user_id in the frontend:
//   await Purchases.logIn(firebaseUser.uid)
router.post('/webhook', async (req, res) => {
  // ── Verify shared secret ────────────────────────────────────────────────────
  const authHeader = req.headers['authorization'];
  const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.warn('REVENUECAT_WEBHOOK_SECRET not set — skipping auth (unsafe in production!)');
  } else if (!authHeader || authHeader !== expectedSecret) {
    console.warn('RevenueCat webhook: invalid secret received');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const event = req.body?.event;
  if (!event) {
    return res.status(400).json({ error: 'Missing event payload' });
  }

  const { type, app_user_id: firebaseUid } = event;

  if (!firebaseUid) {
    console.warn(`RevenueCat webhook [${type}]: no app_user_id — skipping Firestore update`);
    return res.json({ received: true });
  }

  console.log(`RevenueCat webhook: ${type} for uid=${firebaseUid}`);

  const userRef = db.collection('users').doc(firebaseUid);

  try {
    switch (type) {
      // ── Subscription activated or renewed ──────────────────────────────────
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':   // user re-enabled before expiry
      case 'PRODUCT_CHANGE': { // user switched plan (still subscribed)
        await userRef.set(
          {
            isSubscribed: true,
            rcEntitlement: event.entitlement_ids?.[0] || 'premium',
            subscriptionUpdatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        break;
      }

      // ── Subscription ended ──────────────────────────────────────────────────
      // CANCELLATION = cancelled but paid period not yet over (Apple still grants access)
      // EXPIRATION   = period ended, access removed now
      // BILLING_ISSUE = payment failed; Apple retries but we revoke access immediately
      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'BILLING_ISSUE': {
        await userRef.set(
          {
            isSubscribed: false,
            subscriptionUpdatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        break;
      }

      default:
        // TEST, TRANSFER, SUBSCRIBER_ALIAS, etc. — acknowledge but do nothing
        console.log(`RevenueCat webhook: unhandled event type "${type}"`);
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('RevenueCat webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
