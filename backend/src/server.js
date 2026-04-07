require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const analyzeRouter = require('./routes/analyze');
const subscriptionRouter = require('./routes/subscription');
const userRouter = require('./routes/user');
const wardrobeRouter = require('./routes/wardrobe');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────────
app.use(cors());

// ── JSON body parser ──────────────────────────────────────────────────────────────
// RevenueCat webhooks send application/json — no raw body needed (unlike Stripe)
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────────
app.use('/api/analyze', analyzeRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/user', userRouter);
app.use('/api/wardrobe', wardrobeRouter);

// ── Health check (Render uses this to verify the service is running) ──────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 handler ───────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AI Stylist backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
