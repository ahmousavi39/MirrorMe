/**
 * Postinstall script — downloads Noto Sans SC OTF for CJK text rendering.
 * Runs once during `npm install`. Skips if the file already exists (cached build).
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');
const FONT_PATH = path.join(FONTS_DIR, 'NotoSansSC-Regular.otf');
// SubsetOTF (~10 MB) — official Google Fonts noto-cjk repo via jsDelivr CDN
const FONT_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf';

if (fs.existsSync(FONT_PATH)) {
  console.log('[fonts] Noto Sans SC already present, skipping download.');
  process.exit(0);
}

if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

console.log('[fonts] Downloading Noto Sans SC OTF...');
const file = fs.createWriteStream(FONT_PATH);

function download(url, redirects = 0) {
  if (redirects > 5) {
    console.error('[fonts] Too many redirects, giving up.');
    process.exit(0);
  }
  https
    .get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, redirects + 1);
        return;
      }
      if (res.statusCode !== 200) {
        console.error(`[fonts] HTTP ${res.statusCode} — font download failed, continuing without CJK font.`);
        file.close();
        if (fs.existsSync(FONT_PATH)) fs.unlinkSync(FONT_PATH);
        process.exit(0);
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('[fonts] Noto Sans SC downloaded successfully.');
      });
    })
    .on('error', (err) => {
      console.error('[fonts] Download error:', err.message, '— continuing without CJK font.');
      if (fs.existsSync(FONT_PATH)) fs.unlinkSync(FONT_PATH);
      process.exit(0);
    });
}

download(FONT_URL);
