const express = require('express');
const router = express.Router();
const axios = require('axios');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const verifyToken = require('../middleware/verifyToken');

// Resolve CJK font path from the bundled npm package (installed with npm install)
let cjkFontUri = null;
try {
  const fontFile = require.resolve(
    '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2'
  );
  cjkFontUri = `file://${fontFile.replace(/\\/g, '/')}`;
} catch {
  // Font package not found — CJK characters will fall back to system fonts
}

// ── POST /api/share-image ─────────────────────────────────────────────────────────
// Downloads the outfit photo, composites the score overlay, returns base64 JPEG.
router.post('/', verifyToken, async (req, res) => {
  const { imageUrl, score, scoreLabel, scoreColor } = req.body;

  if (!imageUrl || score == null || !scoreLabel) {
    return res.status(400).json({ error: 'imageUrl, score and scoreLabel are required' });
  }

  // Sanitise — only accept http/https URLs (no file:// etc.)
  if (!/^https?:\/\//i.test(imageUrl)) {
    return res.status(400).json({ error: 'Invalid imageUrl' });
  }

  // Hex colour for the score — default to white if missing / invalid
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(scoreColor || '') ? scoreColor : '#ffffff';
  const safeLabel = String(scoreLabel).slice(0, 60).replace(/[<>&"]/g, '');
  const safeScore = parseFloat(score).toFixed(1);

  try {
    // Download source image (max 10 MB)
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      maxContentLength: 10 * 1024 * 1024,
      timeout: 15000,
    });
    const inputBuffer = Buffer.from(response.data);

    // Get image dimensions for the overlay
    const meta = await sharp(inputBuffer).metadata();
    const w = meta.width || 1080;
    const h = meta.height || 1350;

    // Build SVG overlay — gradient + score + label + branding
    const gradH = Math.round(h * 0.42);
    const scoreFontSize = Math.round(w * 0.18);
    const labelFontSize = Math.round(w * 0.055);
    const brandFontSize = Math.round(w * 0.032);
    const paddingX = Math.round(w * 0.065);
    const paddingBottom = Math.round(h * 0.055);
    const labelY = h - paddingBottom;
    const brandY = labelY - labelFontSize - Math.round(h * 0.012);
    const scoreY = brandY - brandFontSize - Math.round(h * 0.008);

    const fontFaceBlock = cjkFontUri
      ? `<defs><style>@font-face{font-family:'NotoSansSC';src:url('${cjkFontUri}') format('woff2');}</style></defs>`
      : '';
    const cjkFont = 'NotoSansSC, Noto Sans CJK SC, ';

    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        ${fontFaceBlock}
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="black" stop-opacity="0"/>
            <stop offset="100%" stop-color="black" stop-opacity="0.82"/>
          </linearGradient>
        </defs>
        <rect x="0" y="${h - gradH}" width="${w}" height="${gradH}" fill="url(#grad)"/>
        <text
          x="${paddingX}" y="${scoreY}"
          font-family="${cjkFont}Arial Black, Arial, sans-serif"
          font-size="${scoreFontSize}" font-weight="900"
          fill="${safeColor}"
        >${safeScore}<tspan font-size="${Math.round(scoreFontSize * 0.38)}" fill="rgba(255,255,255,0.65)" dy="-${Math.round(scoreFontSize * 0.18)}">/10</tspan></text>
        <text
          x="${paddingX}" y="${brandY}"
          font-family="${cjkFont}Arial, sans-serif"
          font-size="${labelFontSize}" font-weight="800"
          fill="${safeColor}"
        >${safeLabel}</text>
        <text
          x="${paddingX}" y="${labelY}"
          font-family="${cjkFont}Arial, sans-serif"
          font-size="${brandFontSize}" font-weight="600"
          fill="rgba(255,255,255,0.5)"
          letter-spacing="2"
        >Outfit rated by MirrorMe - AI Stylist</text>
      </svg>
    `.trim();

    const outputBuffer = await sharp(inputBuffer)
      .composite([{ input: Buffer.from(svg), blend: 'over' }])
      .jpeg({ quality: 88 })
      .toBuffer();

    const base64 = outputBuffer.toString('base64');
    return res.json({ image: base64 });
  } catch (err) {
    console.error('share-image error:', err.message);
    return res.status(500).json({ error: 'Failed to compose image' });
  }
});

module.exports = router;
