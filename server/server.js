/**
 * DEAD SUN - Dedicated Sector Leaderboard & Game Server
 * Provides RESTful API endpoints for pilot score submission and ranking.
 * Zero-dependency compatible (runs with native Node.js HTTP or Express).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'scores.json');
const STATIC_DIR = path.resolve(__dirname, '..');

// Default Sector Hall-of-Fame Pilot Entries
const DEFAULT_SCORES = [
  { rank: 1, callsign: 'VALKYRIE', distance: 684, time: 88.5, shelters: 14, seed: 481920145, date: '2026-09-15' },
  { rank: 2, callsign: 'SOLARIS',  distance: 540, time: 71.2, shelters: 11, seed: 194820392, date: '2026-09-16' },
  { rank: 3, callsign: 'ORION',    distance: 462, time: 62.0, shelters: 9,  seed: 928301928, date: '2026-09-17' },
  { rank: 4, callsign: 'PHOENIX',  distance: 388, time: 51.4, shelters: 7,  seed: 394820194, date: '2026-09-18' },
  { rank: 5, callsign: 'NOVA',     distance: 310, time: 42.8, shelters: 6,  seed: 582019482, date: '2026-09-18' },
  { rank: 6, callsign: 'GHOST',    distance: 245, time: 33.1, shelters: 4,  seed: 102938475, date: '2026-09-18' },
  { rank: 7, callsign: 'APOLLO',   distance: 190, time: 26.5, shelters: 3,  seed: 692830194, date: '2026-09-18' }
];

// Load or initialize scores file
function loadScores() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.error('[SERVER] Error reading scores DB:', err);
  }
  saveScores(DEFAULT_SCORES);
  return [...DEFAULT_SCORES];
}

function saveScores(scores) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(scores, null, 2), 'utf8');
  } catch (err) {
    console.error('[SERVER] Error writing scores DB:', err);
  }
}

// In-memory score cache
let scoresCache = loadScores();

// Helper: Rank and Sort Scores
function getRankedScores() {
  scoresCache.sort((a, b) => {
    if (b.distance !== a.distance) return b.distance - a.distance;
    return a.time - b.time; // faster time wins tiebreaker
  });
  return scoresCache.slice(0, 50).map((entry, idx) => ({
    ...entry,
    rank: idx + 1
  }));
}

// MIME types for static asset serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
};

// Create Native HTTP Server
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. GET /api/leaderboard
  if (req.method === 'GET' && pathname === '/api/leaderboard') {
    const ranked = getRankedScores();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', leaderboard: ranked }));
    return;
  }

  // 2. GET /api/health
  if (req.method === 'GET' && pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', serverTime: new Date().toISOString(), pilots: scoresCache.length }));
    return;
  }

  // 3. POST /api/score
  if (req.method === 'POST' && pathname === '/api/score') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) req.socket.destroy(); // Flood protection
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        let { callsign, distance, time, shelters, seed } = payload;

        // Validation & Anti-cheat Sanity Checks
        callsign = String(callsign || 'PILOT').toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 8);
        if (callsign.length === 0) callsign = 'PILOT';

        distance = Math.max(0, parseInt(distance, 10) || 0);
        time = Math.max(0.1, parseFloat(time) || 0.1);
        shelters = Math.max(0, parseInt(shelters, 10) || 0);
        seed = parseInt(seed, 10) || 0;

        // Anti-Cheat: Max possible speed is 450 m/s
        const avgVelocity = distance / time;
        if (avgVelocity > 450) {
          console.warn(`[ANTI-CHEAT REJECT] Callsign: ${callsign}, Velocity: ${avgVelocity.toFixed(1)} m/s exceeds max threshold.`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'rejected', message: 'Velocity anomaly detected' }));
          return;
        }

        const newEntry = {
          callsign,
          distance,
          time: Math.round(time * 10) / 10,
          shelters,
          seed,
          date: new Date().toISOString().split('T')[0]
        };

        scoresCache.push(newEntry);
        saveScores(scoresCache);

        const ranked = getRankedScores();
        const playerRank = ranked.findIndex(e => e.callsign === callsign && e.distance === distance && e.time === newEntry.time) + 1;

        console.log(`[SCORE TRANSMITTED] ${callsign} achieved ${distance}m in ${time.toFixed(1)}s (Rank #${playerRank || '?'})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          rank: playerRank || null,
          leaderboard: ranked
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Malformed JSON payload' }));
      }
    });
    return;
  }

  // 4. Static File Serving (parent directory)
  let safePath = path.normalize(path.join(STATIC_DIR, pathname));
  if (!safePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Default to index.html
  if (fs.existsSync(safePath) && fs.statSync(safePath).isDirectory()) {
    safePath = path.join(safePath, 'index.html');
  }

  if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(safePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` DEAD SUN Dedicated Server & Leaderboard Online!   `);
  console.log(` Port:    http://localhost:${PORT}                 `);
  console.log(` API:     http://localhost:${PORT}/api/leaderboard `);
  console.log(` Health:  http://localhost:${PORT}/api/health      `);
  console.log(` Static:  ${STATIC_DIR}                            `);
  console.log(`====================================================`);
});
