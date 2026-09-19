/**
 * Prepares and packages all web assets into the 'www' directory and 'flutter_app/assets/web/' directory.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const WWW_DIR = path.join(ROOT_DIR, 'www');
const FLUTTER_WEB_DIR = path.join(ROOT_DIR, 'flutter_app', 'assets', 'web');

const TARGET_DIRS = [WWW_DIR, FLUTTER_WEB_DIR];

for (const target of TARGET_DIRS) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
}

// Essential Game Code & Bundles
const CORE_FILES = [
  'index.html',
  'style.css',
  'responsive.css',
  'runtime-config.js',
  'game.js',
  'audio.js',
  'pixi.min.js',
  'music.mp3'
];

for (const file of CORE_FILES) {
  const src = path.join(ROOT_DIR, file);
  if (fs.existsSync(src)) {
    for (const target of TARGET_DIRS) {
      fs.copyFileSync(src, path.join(target, file));
    }
    console.log(`[PACK] Copied ${file} -> targets`);
  } else {
    console.warn(`[WARN] Missing core file: ${file}`);
  }
}

// Copy All Image Assets (*.png, *.jpg)
const rootFiles = ['asset1.png','asset2.png','asset3.png','asset4.png','asset5.png','asset6.png','asset7.png',
  'sun.png','sun_glow.png','background_scene_for_sun.png','giant_approaching1.png','astronaut.png','logo_red_sun.jpg','dialogue_astronaut.png'];
let assetCount = 0;
for (const file of rootFiles) {
  const lower = file.toLowerCase();
  if ((lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.svg')) &&
      !file.startsWith('screenshot_') &&
      !file.startsWith('test_')) {
    const src = path.join(ROOT_DIR, file);
    for (const target of TARGET_DIRS) {
      fs.copyFileSync(src, path.join(target, file));
    }
    assetCount++;
  }
}
console.log(`[PACK] Copied ${assetCount} game assets to targets!`);
console.log(`[READY] Assets successfully synced to www/ and flutter_app/assets/web/!`);
