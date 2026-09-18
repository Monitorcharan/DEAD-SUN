/**
 * Prepares and packages all web assets into the 'www' directory for Capacitor APK compilation.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const WWW_DIR = path.join(ROOT_DIR, 'www');

// Clean or create www directory
if (fs.existsSync(WWW_DIR)) {
  fs.rmSync(WWW_DIR, { recursive: true, force: true });
}
fs.mkdirSync(WWW_DIR, { recursive: true });

// Essential Game Files to bundle into APK
const CORE_FILES = [
  'index.html',
  'style.css',
  'game.js',
  'audio.js'
];

// Copy Core Files
for (const file of CORE_FILES) {
  const src = path.join(ROOT_DIR, file);
  const dest = path.join(WWW_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[PACK] Copied ${file} -> www/`);
  } else {
    console.warn(`[WARN] Missing core file: ${file}`);
  }
}

// Copy All Image Assets (*.png)
const rootFiles = fs.readdirSync(ROOT_DIR);
let assetCount = 0;
for (const file of rootFiles) {
  if (file.toLowerCase().endsWith('.png') && !file.startsWith('screenshot_') && !file.startsWith('test_')) {
    const src = path.join(ROOT_DIR, file);
    const dest = path.join(WWW_DIR, file);
    fs.copyFileSync(src, dest);
    assetCount++;
  }
}
console.log(`[PACK] Copied ${assetCount} game assets (.png) -> www/`);
console.log(`[READY] Android APK web bundle prepared in 'www/'!`);
