const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'app-data.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const TOKEN_SECRET = process.env.TYPING_TEST_TOKEN_SECRET || 'change-me-in-production';

const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
};

function ensureDataStore() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
        const initial = { users: [], scores: [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
}

function readData() {
    ensureDataStore();
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            scores: Array.isArray(parsed.scores) ? parsed.scores : [],
        };
    } catch (e) {
        return { users: [], scores: [] };
    }
}

function writeData(data) {
    ensureDataStore();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sendJson(res, code, payload) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1e6) {
                req.destroy();
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

function hashPassword(password, saltHex = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, saltHex, 64).toString('hex');
    return { hash, salt: saltHex };
}

function buildToken(payloadObj) {
    const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

function verifyToken(token) {
    if (!token || !token.includes('.')) return null;
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    if (sig !== expected) return null;
    try {
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.exp || Date.now() > parsed.exp) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

function getAuthUser(req, data) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = verifyToken(token);
    if (!payload || !payload.uid) return null;
    return data.users.find(u => u.id === payload.uid) || null;
}

function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}

function publicUser(user) {
    return { id: user.id, username: user.username };
}

function isBetterScore(candidate, baseline) {
    if (!baseline) return true;
    if ((candidate.wpm || 0) > (baseline.wpm || 0)) return true;
    if ((candidate.wpm || 0) < (baseline.wpm || 0)) return false;
    if ((candidate.accuracy || 0) > (baseline.accuracy || 0)) return true;
    if ((candidate.accuracy || 0) < (baseline.accuracy || 0)) return false;
    return (candidate.date || 0) > (baseline.date || 0);
}

function serveStatic(req, res) {
    let reqPath;
    try {
        reqPath = decodeURIComponent(req.url === '/' ? '/index.html' : req.url.split('?')[0]);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request');
        return;
    }
    const resolved = path.resolve(__dirname, `.${reqPath}`);
    if (!resolved.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    const ext = path.extname(resolved);
    fs.readFile(resolved, (err, file) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(file);
    });
}

async function handleApi(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';
    const data = readData();

    if (method === 'POST' && pathname === '/api/signup') {
        const body = await parseBody(req);
        const usernameRaw = String(body.username || '').trim();
        const username = normalizeUsername(usernameRaw);
        const password = String(body.password || '');
        if (!username || username.length < 3 || username.length > 24 || !/^[a-z0-9_]+$/.test(username)) {
            return sendJson(res, 400, { error: 'Username must be 3-24 chars: a-z, 0-9, _' });
        }
        if (password.length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters' });
        if (data.users.some(u => u.usernameNorm === username)) return sendJson(res, 409, { error: 'Username already exists' });

        const id = crypto.randomUUID();
        const { hash, salt } = hashPassword(password);
        const user = {
            id,
            username: usernameRaw,
            usernameNorm: username,
            passwordHash: hash,
            passwordSalt: salt,
            createdAt: Date.now(),
        };
        data.users.push(user);
        writeData(data);

        const token = buildToken({ uid: id, exp: Date.now() + SESSION_TTL_MS });
        return sendJson(res, 201, { user: publicUser(user), token });
    }

    if (method === 'POST' && pathname === '/api/login') {
        const body = await parseBody(req);
        const username = normalizeUsername(body.username);
        const password = String(body.password || '');
        const user = data.users.find(u => u.usernameNorm === username);
        if (!user) return sendJson(res, 401, { error: 'Invalid username or password' });
        const { hash } = hashPassword(password, user.passwordSalt);
        if (hash !== user.passwordHash) return sendJson(res, 401, { error: 'Invalid username or password' });
        const token = buildToken({ uid: user.id, exp: Date.now() + SESSION_TTL_MS });
        return sendJson(res, 200, { user: publicUser(user), token });
    }

    if (method === 'GET' && pathname === '/api/me') {
        const user = getAuthUser(req, data);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
        return sendJson(res, 200, { user: publicUser(user) });
    }

    if (method === 'POST' && pathname === '/api/scores') {
        const user = getAuthUser(req, data);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
        const body = await parseBody(req);
        const score = {
            id: crypto.randomUUID(),
            userId: user.id,
            username: user.username,
            wpm: Number(body.wpm) || 0,
            accuracy: Number(body.accuracy) || 0,
            rawWpm: Number(body.rawWpm) || 0,
            consistency: Number(body.consistency) || 0,
            time: Number(body.time) || 0,
            mode: String(body.mode || 'quotes'),
            date: Number(body.date) || Date.now(),
            createdAt: Date.now(),
        };
        if (score.wpm < 0 || score.wpm > 400) return sendJson(res, 400, { error: 'Invalid score payload' });

        const sameModeIdx = data.scores.findIndex(s => s.userId === user.id && s.mode === score.mode);
        const existing = sameModeIdx >= 0 ? data.scores[sameModeIdx] : null;
        if (!isBetterScore(score, existing)) {
            return sendJson(res, 409, { error: 'Only your best run for this mode can be submitted.' });
        }
        if (sameModeIdx >= 0) data.scores[sameModeIdx] = score;
        else data.scores.push(score);
        writeData(data);
        return sendJson(res, 201, { ok: true, score });
    }

    if (method === 'GET' && pathname === '/api/scores/me') {
        const user = getAuthUser(req, data);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized' });
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
        const mode = (url.searchParams.get('mode') || '').trim();
        const list = data.scores
            .filter(s => s.userId === user.id && (!mode || s.mode === mode))
            .sort((a, b) => b.date - a.date)
            .slice(0, limit);
        return sendJson(res, 200, { scores: list });
    }

    if (method === 'GET' && pathname === '/api/leaderboard') {
        const mode = (url.searchParams.get('mode') || '').trim();
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 20)));
        const bestByUserMode = new Map();
        for (const score of data.scores) {
            if (mode && score.mode !== mode) continue;
            const key = `${score.userId}::${score.mode}`;
            const prev = bestByUserMode.get(key);
            if (isBetterScore(score, prev)) bestByUserMode.set(key, score);
        }
        const leaderboard = [...bestByUserMode.values()]
            .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy || b.date - a.date)
            .slice(0, limit);
        return sendJson(res, 200, { leaderboard });
    }

    return sendJson(res, 404, { error: 'Not found' });
}

http.createServer(async (req, res) => {
    try {
        if ((req.url || '').startsWith('/api/')) {
            await handleApi(req, res);
            return;
        }
        serveStatic(req, res);
    } catch (e) {
        sendJson(res, 500, { error: 'Server error' });
    }
}).listen(PORT, () => {
    console.log(`Listening on http://localhost:${PORT}`);
});
