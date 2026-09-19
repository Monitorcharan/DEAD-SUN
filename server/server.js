/**
 * DEAD SUN - Dedicated Sector Leaderboard & Game Server
 * Provides RESTful API endpoints for pilot score submission and ranking.
 * Supports PostgreSQL database (Render Postgres, Supabase, Neon) with automatic
 * local JSON file fallback for offline and local development.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'scores.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(16).toString('hex');
const MAX_BODY_SIZE = 4096; // 4KB max payload

// Rate limiter: per-IP, max 5 score submissions per 60 seconds
const RATE_WINDOW_MS = 60000;
const RATE_MAX_HITS = 5;
const rateLimitMap = new Map(); // ip -> { count, resetTime }

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + RATE_WINDOW_MS };
    rateLimitMap.set(ip, entry);
    return true;
  }
  entry.count++;
  if (entry.count > RATE_MAX_HITS) return false;
  return true;
}

// Periodically clean stale rate limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetTime) rateLimitMap.delete(ip);
  }
}, 300000);

// Auto-detect static assets directory (works whether run from root, server, or Render cloud)
function resolveStaticDir() {
  const candidates = [
    process.env.STATIC_DIR,
    path.resolve(__dirname, '..'),
    __dirname,
    path.resolve(__dirname, '../www'),
    path.resolve(process.cwd())
  ];
  for (const cand of candidates) {
    if (cand && fs.existsSync(path.join(cand, 'index.html'))) {
      return cand;
    }
  }
  return path.resolve(__dirname, '..');
}
const STATIC_DIR = resolveStaticDir();

// Real Pilot Leaderboard (Zero fake/placeholder scores)
const DEFAULT_SCORES = [];

function sanitizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return null;
  let str = rawUrl.trim();
  const match = str.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.*)@([^@]+)$/);
  if (match) {
    const protocol = match[1];
    const user = match[2];
    let password = match[3];
    const hostAndRest = match[4];
    // Strip accidental placeholder brackets [ ] if user copied them
    if (password.startsWith('[') && password.endsWith(']')) {
      password = password.slice(1, -1);
    }
    let rawPass = password;
    try { rawPass = decodeURIComponent(password); } catch(e) {}
    const safePass = encodeURIComponent(rawPass);
    return `${protocol}${user}:${safePass}@${hostAndRest}`;
  }
  return str;
}

// =========================================================
// 1. DATABASE CONFIGURATION (POSTGRESQL + LOCAL JSON FALLBACK)
// =========================================================
let pgPool = null;

if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    const sanitizedUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL);
    const isLocal = sanitizedUrl.includes('localhost') || sanitizedUrl.includes('127.0.0.1');
    pgPool = new Pool({
      connectionString: sanitizedUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
    console.log('[DATABASE] Initializing PostgreSQL connection pool...');
    initPostgresTable();
  } catch (err) {
    console.warn('[DATABASE] Could not load pg module. Using local JSON store:', err.message);
    pgPool = null;
  }
} else {
  console.log('[DATABASE] No DATABASE_URL found. Using local JSON store (scores.json).');
}

async function initPostgresTable() {
  if (!pgPool) return;
  try {
    const client = await pgPool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        callsign VARCHAR(12) NOT NULL,
        distance INT NOT NULL,
        time NUMERIC(6, 1) NOT NULL,
        shelters INT NOT NULL DEFAULT 0,
        seed BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard (distance DESC, time ASC);
    `);
    client.release();
    console.log('[DATABASE] PostgreSQL Leaderboard table ready & indexed!');
  } catch (err) {
    console.error('[DATABASE] PostgreSQL table initialization failed:', err.message);
  }
}

// Local JSON file storage helpers
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

let scoresCache = loadScores();

async function getRankedScores() {
  if (pgPool) {
    try {
      const res = await pgPool.query(`
        SELECT callsign, distance, time::float, shelters, seed, created_at
        FROM leaderboard
        ORDER BY distance DESC, time ASC
        LIMIT 50;
      `);
      return res.rows.map((row, idx) => ({
        rank: idx + 1,
        callsign: row.callsign,
        distance: row.distance,
        time: parseFloat(row.time),
        shelters: row.shelters,
        seed: row.seed,
        date: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : ''
      }));
    } catch (err) {
      console.error('[DATABASE] Postgres query failed, falling back to cache:', err.message);
    }
  }

  // Fallback to local in-memory/JSON store
  scoresCache.sort((a, b) => {
    if (b.distance !== a.distance) return b.distance - a.distance;
    return a.time - b.time;
  });
  return scoresCache.slice(0, 50).map((entry, idx) => ({
    ...entry,
    rank: idx + 1
  }));
}

async function insertScore(newEntry) {
  if (pgPool) {
    try {
      await pgPool.query(
        `INSERT INTO leaderboard (callsign, distance, time, shelters, seed) VALUES ($1, $2, $3, $4, $5)`,
        [newEntry.callsign, newEntry.distance, newEntry.time, newEntry.shelters, newEntry.seed]
      );
      // Determine rank of this pilot
      const rankRes = await pgPool.query(
        `SELECT COUNT(*) + 1 AS rank FROM leaderboard WHERE distance > $1 OR (distance = $1 AND time < $2)`,
        [newEntry.distance, newEntry.time]
      );
      return parseInt(rankRes.rows[0].rank, 10);
    } catch (err) {
      console.error('[DATABASE] Postgres insert failed, falling back to local JSON:', err.message);
    }
  }

  scoresCache.push(newEntry);
  saveScores(scoresCache);
  const ranked = await getRankedScores();
  return ranked.findIndex(e => e.callsign === newEntry.callsign && e.distance === newEntry.distance && e.time === newEntry.time) + 1;
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
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.apk': 'application/vnd.android.package-archive',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// =========================================================
// 2. HTTP SERVER & API ROUTING
// =========================================================
const server = http.createServer(async (req, res) => {
  // Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. GET /api/leaderboard
  if (req.method === 'GET' && pathname === '/api/leaderboard') {
    const ranked = await getRankedScores();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', database: pgPool ? 'postgresql' : 'json-store', leaderboard: ranked }));
    return;
  }

  // 2. GET /api/health
  if (req.method === 'GET' && pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      database: pgPool ? 'postgresql' : 'json-store',
      serverTime: new Date().toISOString(),
      pilots: scoresCache.length
    }));
    return;
  }

  // 3. GET /download/apk — Serve the Android APK with proper headers
  if (req.method === 'GET' && pathname === '/download/apk') {
    const apkPath = path.join(STATIC_DIR, 'THE_RED_SUN.apk');
    if (!fs.existsSync(apkPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'APK not available' }));
      return;
    }
    try {
      const stat = fs.statSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="THE_RED_SUN.apk"',
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=86400'
      });
      const stream = fs.createReadStream(apkPath);
      stream.on('error', (err) => {
        console.error('[APK] Stream error:', err.message);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'APK download failed' }));
    }
    return;
  }

  // 4. POST /api/score
  if (req.method === 'POST' && pathname === '/api/score') {
    // Rate limit check
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Too many submissions. Try again later.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        req.socket.destroy(); // Flood protection
      }
    });

    req.on('end', async () => {
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

        const playerRank = await insertScore(newEntry);
        const ranked = await getRankedScores();

        console.log(`[SCORE TRANSMITTED] ${callsign} achieved ${distance}m in ${time.toFixed(1)}s (Rank #${playerRank || '?'}) [DB: ${pgPool ? 'Postgres' : 'JSON'}]`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          rank: playerRank || null,
          database: pgPool ? 'postgresql' : 'json-store',
          leaderboard: ranked
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Malformed JSON payload' }));
      }
    });
    return;
  }

  // 5. POST /api/admin/clear-database & /api/reset-scores (Protected admin action)
  if (req.method === 'POST' && (pathname === '/api/admin/clear-database' || pathname === '/api/reset-scores')) {
    // Admin authentication: require Authorization header or admin_token query param
    const authHeader = req.headers['authorization'] || '';
    const queryToken = urlObj.searchParams.get('admin_token') || '';
    const providedToken = authHeader.replace('Bearer ', '') || queryToken;

    if (providedToken !== ADMIN_TOKEN) {
      console.warn(`[SECURITY] Unauthorized database clear attempt from ${req.socket.remoteAddress}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'forbidden', message: 'Admin authentication required' }));
      return;
    }

    try {
      scoresCache = [];
      saveScores([]);
      if (pgPool) {
        try {
          await pgPool.query('TRUNCATE TABLE leaderboard RESTART IDENTITY;');
          console.log('[DATABASE] PostgreSQL leaderboard table truncated.');
        } catch (pgErr) {
          console.error('[DATABASE] Failed to truncate table:', pgErr.message);
        }
      }
      console.log('[DATABASE] All leaderboard data wiped clean by admin.');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Leaderboard database cleared successfully', count: 0 }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
    return;
  }

  // 5. Static File Serving with Security, CORS & Caching
  let decodedPath = pathname;
  try { decodedPath = decodeURIComponent(pathname); } catch (e) {}

  // Strict path traversal prevention
  const cleanPath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
  let safePath = path.resolve(STATIC_DIR, '.' + cleanPath);

  if (!safePath.startsWith(STATIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Default directory to index.html
  try {
    if (fs.existsSync(safePath) && fs.statSync(safePath).isDirectory()) {
      safePath = path.join(safePath, 'index.html');
    }

    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Enhanced headers for game performance and asset security
      const headers = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      };

      // Cache assets (images, css, js) for 1 hour for fast loading
      if (ext !== '.html') {
        headers['Cache-Control'] = 'public, max-age=3600';
      } else {
        headers['Cache-Control'] = 'no-cache';
      }

      res.writeHead(200, headers);
      const stream = fs.createReadStream(safePath);
      stream.on('error', (streamErr) => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` DEAD SUN Dedicated Server & Leaderboard Online!   `);
  console.log(` Port:     http://localhost:${PORT}                `);
  console.log(` DB Mode:  ${pgPool ? 'PostgreSQL (Active)' : 'Local JSON Fallback'} `);
  console.log(` API:      http://localhost:${PORT}/api/leaderboard`);
  console.log(` Health:   http://localhost:${PORT}/api/health     `);
  console.log(` APK:      http://localhost:${PORT}/download/apk   `);
  console.log(` Static:   ${STATIC_DIR}                           `);
  if (!process.env.ADMIN_TOKEN) {
    console.log(` Admin:    ${ADMIN_TOKEN} (auto-generated)       `);
  }
  console.log(`====================================================`);
});
