'use strict';
const express = require('express');
const crypto = require('crypto');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3100;
const ROOT_FOLDER_ID = '1n-xgrDssMzoWKcAo8IYMfOQstG49SOiX';

// ── Service Account Auth ──
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var not set');
  const credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
}

// ── Google OAuth2 Login Gate ──
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI         = process.env.GOOGLE_REDIRECT_URI || 'https://tb-drive.zeabur.app/auth/callback';
// Optional: comma-separated whitelist. If unset, any Google account can log in.
const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS
  ? process.env.ALLOWED_EMAILS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  : null;

// Signed session cookie — no server-side storage needed
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  const s = crypto.randomBytes(32).toString('hex');
  console.warn('[Auth] SESSION_SECRET not set — sessions will reset on server restart');
  return s;
})();
const SESSION_COOKIE  = 'tb_sess';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (seconds)

function signSession(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })).toString('base64');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return payload + '.' + sig;
}
function verifySession(token) {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig     = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  } catch { return null; }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());
    if (Math.floor(Date.now() / 1000) > data.exp) return null;
    return data;
  } catch { return null; }
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Middleware: require Google login (skipped if OAuth not configured)
function requireAuth(req, res, next) {
  if (!GOOGLE_CLIENT_ID) return next();
  const session = verifySession(parseCookies(req)[SESSION_COOKIE]);
  if (session) { req.user = session; return next(); }
  res.redirect('/login?r=' + encodeURIComponent(req.originalUrl));
}

// ── Auth Routes ──
app.get('/login', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.redirect('/');
  res.send(LOGIN_HTML.replace('{{REDIRECT}}', encodeURIComponent(req.query.r || '/'))
                     .replace('{{ERROR}}',    req.query.error ? '<p class="err">登入失敗，請再試一次。</p>' : ''));
});

app.get('/auth/google', (req, res) => {
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state: req.query.r || '/',
    prompt: 'select_account',
  });
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) throw new Error('No code');
    const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    const email = (data.email || '').toLowerCase();
    if (!email) throw new Error('No email');
    if (ALLOWED_EMAILS && !ALLOWED_EMAILS.includes(email)) {
      return res.status(403).send(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>禁止存取</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;background:#fcf9f8}
        h2{color:#ba1a1a;font-size:20px}p{color:#666;font-size:14px}a{color:#7b5900;font-weight:600}</style></head>
        <body><h2>沒有存取權限</h2><p>帳號 ${escHtml(email)} 未在允許名單內。</p><a href="/login">返回登入</a></body></html>`
      );
    }
    const token = signSession(email);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
    console.log(`[Auth] Login: ${email}`);
    res.redirect(decodeURIComponent(state || '/'));
  } catch (err) {
    console.error('[Auth] Callback error:', err.message);
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; Max-Age=0`);
  res.redirect('/login');
});


// ── Cache (5 min TTL, stale-while-revalidate) ──
let cache = null;
let cacheTime = 0;
let scanPromise = null;
const CACHE_TTL = 5 * 60 * 1000;

// Scan Drive with parallel folder listing + permissions for user-based filtering
async function doScan() {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });
  const items = [];

  function isServiceAccount(email) {
    return !email || email.includes('iam.gserviceaccount.com');
  }

  async function listFolder(folderId, depth, parentPath) {
    const subFolders = [];
    let pageToken = null;
    try {
      do {
        const res = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, permissions(type, emailAddress, role))',
          orderBy: 'name',
          pageSize: 200,
          pageToken
        });
        for (const f of res.data.files) {
          const filePath = parentPath ? parentPath + '/' + f.name : f.name;
          const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
          // Keep only non-service-account user permissions for filtering
          const perms = (f.permissions || []).filter(p => !isServiceAccount(p.emailAddress));
          items.push({ id: f.id, name: f.name, mimeType: f.mimeType, path: filePath, depth, isFolder, parentId: folderId, perms });
          if (isFolder) subFolders.push({ id: f.id, depth: depth + 1, path: filePath });
        }
        pageToken = res.data.nextPageToken;
      } while (pageToken);
    } catch (e) {
      if (e.code === 403 || e.code === 404) {
        // Mark this folder as restricted (service account couldn't enter it)
        const item = items.find(i => i.id === folderId);
        if (item) item.restricted = true;
        return;
      }
      throw e;
    }
    if (subFolders.length > 0) {
      await Promise.all(subFolders.map(sf => listFolder(sf.id, sf.depth, sf.path)));
    }
  }

  await listFolder(ROOT_FOLDER_ID, 0, '');
  cache = items;
  cacheTime = Date.now();
  console.log(`[Drive] Scanned ${items.length} items`);
  return items;
}

// Filter the full tree to only items the given user can access
// Logic: if a folder has explicit user permissions, only those users see it;
//        if restricted (service account got 403), only explicit users see it;
//        otherwise inherits parent accessibility.
function filterTreeForUser(items, userEmail) {
  if (!GOOGLE_CLIENT_ID || !userEmail) return items;
  const email = userEmail.toLowerCase();
  const byId = new Map(items.map(i => [i.id, i]));
  const access = new Map();

  function canAccess(id) {
    if (access.has(id)) return access.get(id);
    const item = byId.get(id);
    if (!item) { access.set(id, false); return false; }
    const perms = item.perms || [];
    // Public access
    if (perms.some(p => p.type === 'anyone')) { access.set(id, true); return true; }
    // Has specific-user permissions → check if this user is listed
    const hasUserRestriction = perms.some(p => p.type === 'user') || item.restricted;
    if (hasUserRestriction) {
      const ok = perms.some(p => p.emailAddress?.toLowerCase() === email);
      access.set(id, ok); return ok;
    }
    // No user restrictions → inherits from parent
    if (!item.parentId || item.parentId === ROOT_FOLDER_ID) {
      access.set(id, true); return true;
    }
    const ok = canAccess(item.parentId);
    access.set(id, ok); return ok;
  }

  return items.filter(i => canAccess(i.id));
}

// Deduplicated scan trigger - multiple callers share the same in-flight scan
function triggerScan() {
  if (scanPromise) return scanPromise;
  scanPromise = doScan()
    .catch(e => { console.error('[Drive] Scan failed:', e.message); throw e; })
    .finally(() => { scanPromise = null; });
  return scanPromise;
}

async function scanDrive() {
  // Fresh cache → return immediately (zero cost)
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;
  // Stale data → return immediately, refresh in background
  if (cache) { triggerScan(); return cache; }
  // No cache at all → must wait for scan
  return triggerScan();
}

// ── API ──
app.get('/api/tree', requireAuth, async (req, res) => {
  try {
    if (req.query.refresh === '1') { cache = null; scanPromise = null; }
    const allItems = await scanDrive();
    const items = filterTreeForUser(allItems, req.user?.email);
    res.json({ ok: true, items, scannedAt: new Date(cacheTime).toISOString() });
  } catch (err) {
    console.error('[API Error]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── File Proxy (no Google login needed) ──
// For Google-native formats: export as PDF for preview
const EXPORT_AS_PDF = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
]);

app.get('/api/file/:id', requireAuth, async (req, res) => {
  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth: await auth.getClient() });
    const fileId = req.params.id;

    // Get file metadata first
    const meta = await drive.files.get({ fileId, fields: 'name,mimeType' });
    const { name, mimeType } = meta.data;

    let stream, contentType;

    if (EXPORT_AS_PDF.has(mimeType)) {
      // Export Google Docs/Sheets/Slides as PDF
      const resp = await drive.files.export(
        { fileId, mimeType: 'application/pdf' },
        { responseType: 'stream' }
      );
      stream = resp.data;
      contentType = 'application/pdf';
    } else {
      // Download binary file directly
      const resp = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      stream = resp.data;
      contentType = mimeType || 'application/octet-stream';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    stream.pipe(res);
  } catch (err) {
    console.error('[File Proxy Error]', err.message);
    res.status(500).send('無法載入檔案：' + err.message);
  }
});

// ── HTML ──
app.get('/', requireAuth, (req, res) => {
  const email = req.user ? escHtml(req.user.email) : '';
  const showUser = (GOOGLE_CLIENT_ID && req.user) ? 'flex' : 'none';
  res.send(HTML.replace('__USER_EMAIL__', email).replace('__SHOW_USER__', showUser));
});

app.listen(PORT, () => {
  console.log(`Drive Explorer running on port ${PORT}`);
  triggerScan(); // pre-warm cache on startup
});

// ── Embedded HTML ──
const HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>統包先生 - 雲端資料夾總覽</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
:root {
  --surface:                #fcf9f8;
  --surface-container-lowest: #ffffff;
  --surface-container-low:  #f6f3f2;
  --surface-container:      #f0edec;
  --surface-container-high: #eae7e7;
  --surface-container-highest: #e5e2e1;
  --primary:                #7b5900;
  --primary-container:      #f9b91b;
  --primary-fixed:          #ffdea4;
  --on-primary-fixed:       #261900;
  --on-surface:             #1c1b1b;
  --on-surface-variant:     #4d4543;
  --outline-variant:        #d4c4ac;
  --tertiary:               #4c616c;
  --error:                  #ba1a1a;
  --hover-tint:             rgba(28,27,27,0.04);
  --shadow-color:           rgba(28,27,27,0.06);
  --font-display: 'Space Grotesk', 'Noto Sans TC', sans-serif;
  --font-body:    'Manrope', 'Noto Sans TC', sans-serif;
  --radius-sm: 0.125rem;
  --radius:    0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:var(--font-body); background:var(--surface); color:var(--on-surface); height:100vh; display:flex; overflow:hidden; }

/* Loading overlay */
#loadingOverlay {
  position:fixed; inset:0; background:var(--surface); z-index:999;
  display:flex; align-items:center; justify-content:center; flex-direction:column; gap:20px;
}
#loadingOverlay .spinner {
  width:40px; height:40px;
  border:3px solid var(--surface-container-high);
  border-top-color:var(--primary-container);
  border-radius:50%;
  animation:spin 0.8s linear infinite;
}
#loadingOverlay .load-title {
  font-family:var(--font-display); font-size:14px; font-weight:600;
  color:var(--on-surface-variant); letter-spacing:0.08em; text-transform:uppercase;
}
#loadingOverlay .load-sub {
  font-family:var(--font-body); font-size:12px; color:var(--on-surface-variant); opacity:0.5;
  margin-top:-12px;
}
#loadingOverlay.hidden { display:none; }

/* Error state */
#errorBox {
  display:none; position:fixed; inset:0; background:var(--surface); z-index:998;
  align-items:center; justify-content:center; flex-direction:column; gap:16px;
}
#errorBox.show { display:flex; }
#errorBox .err-title { font-family:var(--font-display); font-size:20px; font-weight:700; color:var(--error); letter-spacing:-0.02em; }
#errorBox .err-msg { font-family:var(--font-body); font-size:13px; color:var(--on-surface-variant); max-width:400px; text-align:center; }
#errorBox button { background:var(--primary-container); color:var(--on-primary-fixed); border:none; border-radius:var(--radius); padding:10px 24px; font-family:var(--font-display); font-size:12px; font-weight:600; cursor:pointer; letter-spacing:0.04em; text-transform:uppercase; }

.sidebar {
  width:55%; max-width:720px; min-width:400px; flex-shrink:0;
  background:var(--surface-container-low); display:flex; flex-direction:column;
  height:100vh; overflow:hidden;
}
.sidebar-brand { padding:28px 24px 20px; }
.sidebar-brand-row { display:flex; align-items:center; gap:12px; }
.brand-mark {
  width:40px; height:40px;
  background:linear-gradient(135deg,var(--primary),var(--primary-container));
  border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center;
  font-family:var(--font-display); font-weight:700; font-size:16px; color:var(--on-primary-fixed); letter-spacing:-0.02em;
}
.brand-info h1 { font-family:var(--font-display); font-size:17px; font-weight:700; color:var(--on-surface); letter-spacing:-0.02em; line-height:1.2; }
.brand-info span { font-family:var(--font-display); font-size:10px; font-weight:500; color:var(--on-surface-variant); letter-spacing:0.08em; text-transform:uppercase; }
.sidebar-search { padding:0 16px 16px; }
.search-wrap { position:relative; }
.search-field {
  width:100%; padding:10px 14px 10px 38px;
  background:var(--surface-container-high); border:none; border-bottom:2px solid transparent;
  border-radius:var(--radius); font-family:var(--font-body); font-size:13px; font-weight:500;
  color:var(--on-surface); outline:none; transition:border-color 0.2s,background 0.2s;
}
.search-field::placeholder { color:var(--on-surface-variant); opacity:0.5; }
.search-field:focus { border-bottom-color:var(--primary); background:var(--surface-container-lowest); }
.search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--on-surface-variant); opacity:0.4; pointer-events:none; }
.search-badge {
  position:absolute; right:10px; top:50%; transform:translateY(-50%);
  font-family:var(--font-display); font-size:10px; font-weight:600; color:var(--primary);
  background:var(--primary-fixed); padding:2px 8px; border-radius:var(--radius-sm); display:none; letter-spacing:0.02em;
}
.search-badge.show { display:block; }
.sidebar-tree { flex:1; overflow-y:auto; overflow-x:hidden; padding:0 8px 24px; scrollbar-width:thin; scrollbar-color:var(--surface-container-highest) transparent; }
.sidebar-tree::-webkit-scrollbar { width:4px; }
.sidebar-tree::-webkit-scrollbar-thumb { background:var(--surface-container-highest); border-radius:4px; }
.sidebar-footer { padding:12px 20px; background:var(--surface-container); display:flex; justify-content:space-between; align-items:center; }
.sidebar-footer span { font-family:var(--font-display); font-size:10px; font-weight:500; color:var(--on-surface-variant); letter-spacing:0.06em; text-transform:uppercase; }
.status-dot { display:inline-block; width:6px; height:6px; background:#2d8a56; border-radius:50%; margin-right:6px; animation:pulse 2.5s ease infinite; }
.status-dot.loading { background:var(--primary-container); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

/* Tree */
.tree-node { user-select:none; }
.tree-row { display:flex; align-items:center; padding:5px 10px; border-radius:var(--radius); cursor:pointer; gap:2px; white-space:nowrap; transition:background 0.12s; position:relative; }
.tree-row:hover { background:var(--hover-tint); }
.tree-row.selected { background:var(--primary-fixed) !important; }
.tree-row.selected .f-name,.tree-row.selected .f-name.is-folder { color:var(--on-primary-fixed); font-weight:600; }
.tree-row.highlight { background:rgba(249,185,27,0.1); }
.tree-row.highlight::before { content:''; position:absolute; left:0; top:2px; bottom:2px; width:3px; background:var(--primary-container); border-radius:0 2px 2px 0; }
.children { position:relative; margin-left:14px; padding-left:14px; }
.children::before { content:''; position:absolute; left:6px; top:0; bottom:12px; width:1.5px; background:var(--outline-variant); opacity:0.35; }
.children.collapsed { display:none; }
.children > .tree-node > .tree-row::before { content:''; position:absolute; left:-14px; top:50%; width:10px; height:1.5px; background:var(--outline-variant); opacity:0.35; }
.toggle { width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--on-surface-variant); opacity:0.5; transition:transform 0.2s ease,opacity 0.15s; font-size:9px; }
.toggle.open { transform:rotate(90deg); opacity:0.8; }
.toggle.empty { visibility:hidden; }
.toggle:hover { opacity:1; color:var(--primary); }
.f-icon { width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; border-radius:var(--radius); font-size:10px; font-family:var(--font-display); font-weight:700; letter-spacing:-0.02em; margin-right:8px; }
.f-icon.folder  { background:rgba(123,89,0,0.08);  color:var(--primary); }
.f-icon.sheet   { background:rgba(45,138,86,0.08); color:#2d8a56; }
.f-icon.doc     { background:rgba(76,97,108,0.08); color:var(--tertiary); }
.f-icon.pdf     { background:rgba(186,26,26,0.07); color:var(--error); }
.f-icon.media   { background:rgba(108,76,108,0.08); color:#7a5a7a; }
.f-icon.other   { background:rgba(28,27,27,0.04);  color:var(--on-surface-variant); }
.f-name { font-family:var(--font-body); font-size:13px; font-weight:500; flex:1; overflow:hidden; text-overflow:ellipsis; color:var(--on-surface); transition:color 0.12s; line-height:1.3; }
.f-name.is-folder { color:var(--primary); font-weight:600; }
.tree-row:hover .f-name { color:var(--on-surface); }
.tree-row:hover .f-name.is-folder { color:var(--primary); }
.f-tag { font-family:var(--font-display); font-size:9px; font-weight:600; color:var(--on-surface-variant); opacity:0.45; margin-left:6px; flex-shrink:0; letter-spacing:0.06em; text-transform:uppercase; }
.f-open { font-family:var(--font-display); font-size:10px; font-weight:600; color:var(--primary); text-decoration:none; padding:3px 10px; border-radius:var(--radius); flex-shrink:0; margin-left:4px; opacity:0; transition:all 0.15s; letter-spacing:0.04em; text-transform:uppercase; background:transparent; }
.tree-row:hover .f-open { opacity:1; background:var(--primary-fixed); }
.f-open:hover { background:var(--primary-container) !important; color:var(--on-primary-fixed) !important; }

/* Main */
.main-content { flex:1; display:flex; flex-direction:column; overflow:hidden; }
.toolbar { display:flex; align-items:center; padding:12px 32px; gap:6px; background:var(--surface); }
.toolbar button { background:var(--surface-container-high); color:var(--on-surface-variant); border:none; border-radius:var(--radius); padding:6px 14px; font-family:var(--font-body); font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s; }
.toolbar button:hover { background:var(--surface-container-highest); color:var(--on-surface); }
.toolbar button:active { transform:scale(0.97); }
.toolbar button.primary-btn { background:var(--primary-container); color:var(--on-primary-fixed); }
.toolbar button.primary-btn:hover { filter:brightness(1.05); }
.toolbar .sep { width:1px; height:18px; background:var(--surface-container-highest); margin:0 6px; }
.toolbar .stats-label { margin-left:auto; font-family:var(--font-display); font-size:11px; font-weight:500; color:var(--on-surface-variant); opacity:0.5; letter-spacing:0.04em; }
.detail-panel { flex:1; overflow-y:auto; padding:0 32px 60px; scrollbar-width:thin; scrollbar-color:var(--surface-container-highest) transparent; }
.detail-panel::-webkit-scrollbar { width:5px; }
.detail-panel::-webkit-scrollbar-thumb { background:var(--surface-container-highest); border-radius:4px; }

/* Hero */
.hero-card { background:var(--surface-container-lowest); border-radius:var(--radius-lg); padding:40px; margin-bottom:24px; position:relative; overflow:hidden; box-shadow:0 16px 32px var(--shadow-color); animation:heroIn 0.5s ease both; }
.hero-card::before { content:''; position:absolute; top:0; right:0; width:320px; height:100%; background:linear-gradient(135deg,transparent 40%,var(--primary-fixed) 100%); opacity:0.3; pointer-events:none; }
.hero-title { font-family:var(--font-display); font-size:36px; font-weight:700; color:var(--on-surface); letter-spacing:-0.03em; line-height:1.1; margin-bottom:8px; }
.hero-sub { font-family:var(--font-body); font-size:14px; font-weight:400; color:var(--on-surface-variant); margin-bottom:28px; }
.hero-stats { display:flex; gap:40px; }
.hero-stat { display:flex; flex-direction:column; }
.hero-stat .val { font-family:var(--font-display); font-size:32px; font-weight:700; color:var(--on-surface); letter-spacing:-0.03em; line-height:1; }
.hero-stat .lbl { font-family:var(--font-display); font-size:10px; font-weight:600; color:var(--on-surface-variant); letter-spacing:0.1em; text-transform:uppercase; margin-top:4px; }
.hero-updated { font-family:var(--font-display); font-size:10px; font-weight:500; color:var(--on-surface-variant); opacity:0.45; letter-spacing:0.04em; margin-top:16px; }

/* Preview */
.preview-panel { display:none; flex-direction:column; background:var(--surface-container-lowest); border-radius:var(--radius-lg); overflow:hidden; box-shadow:0 16px 32px var(--shadow-color); height:calc(100vh - 90px); animation:heroIn 0.3s ease both; }
.preview-panel.active { display:flex; }
.detail-panel.has-preview .hero-card, .detail-panel.has-preview .keys-card { display:none; }
.preview-head { padding:20px 28px; display:flex; align-items:center; gap:16px; background:var(--surface-container-low); flex-shrink:0; }
.preview-icon { width:44px; height:44px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-weight:700; font-size:14px; letter-spacing:-0.02em; flex-shrink:0; }
.preview-icon.sheet { background:rgba(45,138,86,0.1); color:#2d8a56; }
.preview-icon.doc   { background:rgba(76,97,108,0.1); color:var(--tertiary); }
.preview-icon.pdf   { background:rgba(186,26,26,0.08); color:var(--error); }
.preview-icon.media { background:rgba(108,76,108,0.1); color:#7a5a7a; }
.preview-icon.other { background:rgba(28,27,27,0.05); color:var(--on-surface-variant); }
.preview-meta { flex:1; min-width:0; }
.preview-title { font-family:var(--font-display); font-size:17px; font-weight:700; color:var(--on-surface); letter-spacing:-0.02em; line-height:1.2; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.preview-path { font-family:var(--font-body); font-size:12px; color:var(--on-surface-variant); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.preview-actions { display:flex; gap:8px; flex-shrink:0; }
.preview-btn { background:var(--surface-container-high); color:var(--on-surface); border:none; border-radius:var(--radius); padding:8px 14px; font-family:var(--font-display); font-size:11px; font-weight:600; cursor:pointer; letter-spacing:0.04em; text-transform:uppercase; transition:all 0.15s; text-decoration:none; display:inline-flex; align-items:center; gap:6px; }
.preview-btn:hover { background:var(--surface-container-highest); }
.preview-btn.primary { background:var(--primary-container); color:var(--on-primary-fixed); }
.preview-btn.primary:hover { filter:brightness(1.05); }
.preview-body { flex:1; background:var(--surface-container-low); position:relative; overflow:hidden; }
.preview-frame { width:100%; height:100%; border:none; background:var(--surface-container-lowest); }
.preview-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:12px; background:var(--surface-container-low); pointer-events:none; opacity:0; transition:opacity 0.2s; }
.preview-loading.show { opacity:1; }
.preview-loading .spinner { width:32px; height:32px; border:3px solid var(--surface-container-highest); border-top-color:var(--primary-container); border-radius:50%; animation:spin 0.8s linear infinite; }
.preview-loading span { font-family:var(--font-display); font-size:11px; font-weight:600; color:var(--on-surface-variant); letter-spacing:0.1em; text-transform:uppercase; }

/* Keys */
.keys-card { background:var(--surface-container-low); border-radius:var(--radius-md); padding:20px 28px; margin-bottom:24px; animation:heroIn 0.5s ease 0.15s both; }
.keys-card h3 { font-family:var(--font-display); font-size:11px; font-weight:600; color:var(--on-surface-variant); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:14px; }
.keys-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:8px 24px; }
.key-item { display:flex; align-items:center; gap:10px; font-family:var(--font-body); font-size:13px; color:var(--on-surface-variant); }
.key-item kbd { background:var(--surface-container-high); border:none; border-radius:var(--radius-sm); padding:3px 7px; font-family:var(--font-display); font-size:10px; font-weight:600; color:var(--on-surface); letter-spacing:0.02em; }

/* Animations */
.tree-node { animation:nodeIn 0.2s ease both; }
@keyframes nodeIn { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
@keyframes heroIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes spin { to{transform:rotate(360deg)} }
.children:not(.collapsed) > .tree-node:nth-child(1)  { animation-delay:0.02s; }
.children:not(.collapsed) > .tree-node:nth-child(2)  { animation-delay:0.04s; }
.children:not(.collapsed) > .tree-node:nth-child(3)  { animation-delay:0.06s; }
.children:not(.collapsed) > .tree-node:nth-child(4)  { animation-delay:0.08s; }
.children:not(.collapsed) > .tree-node:nth-child(5)  { animation-delay:0.10s; }
.children:not(.collapsed) > .tree-node:nth-child(n+6){ animation-delay:0.12s; }
</style>
</head>
<body>

<div id="loadingOverlay">
  <div class="spinner"></div>
  <div class="load-title">掃描 Google Drive</div>
  <div class="load-sub">首次載入需要幾秒鐘...</div>
</div>
<div id="errorBox">
  <div class="err-title">載入失敗</div>
  <div class="err-msg" id="errorMsg">無法連線至伺服器，請稍後再試。</div>
  <button onclick="loadTree()">重試</button>
</div>

<aside class="sidebar">
  <div class="sidebar-brand">
    <div class="sidebar-brand-row">
      <div class="brand-mark">TB</div>
      <div class="brand-info">
        <h1>統包先生</h1>
        <span>Drive Explorer</span>
      </div>
    </div>
    <div id="userBadge" style="display:__SHOW_USER__;margin-top:10px;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--surface-container);border-radius:var(--radius);gap:8px;">
      <span style="font-family:var(--font-body);font-size:11px;color:var(--on-surface-variant);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">__USER_EMAIL__</span>
      <a href="/logout" style="font-family:var(--font-display);font-size:10px;font-weight:600;color:var(--primary);text-decoration:none;letter-spacing:0.04em;text-transform:uppercase;flex-shrink:0;">登出</a>
    </div>
  </div>
  <div class="sidebar-search">
    <div class="search-wrap">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="text" class="search-field" id="searchInput" placeholder="搜尋..." />
      <span class="search-badge" id="searchBadge"></span>
    </div>
  </div>
  <div class="sidebar-tree" id="tree"></div>
  <div class="sidebar-footer">
    <span><span class="status-dot" id="statusDot"></span><span id="statusText">載入中</span></span>
    <span id="sidebarStats"></span>
  </div>
</aside>

<main class="main-content">
  <div class="toolbar">
    <button class="primary-btn" onclick="expandAll()">全部展開</button>
    <button onclick="collapseAll()">全部收合</button>
    <div class="sep"></div>
    <button onclick="expandLevel(1)">L1</button>
    <button onclick="expandLevel(2)">L2</button>
    <button onclick="expandLevel(3)">L3</button>
    <button onclick="expandLevel(4)">L4</button>
    <button onclick="loadTree(true)" title="重新從 Drive 抓取最新資料" style="margin-left:4px">↺ 重新整理</button>
    <span class="stats-label" id="statsText"></span>
  </div>
  <div class="detail-panel" id="detailPanel">
    <div class="preview-panel" id="previewPanel">
      <div class="preview-head">
        <div class="preview-icon other" id="previewIcon">•</div>
        <div class="preview-meta">
          <div class="preview-title" id="previewTitle">檔案名稱</div>
          <div class="preview-path" id="previewPath">路徑</div>
        </div>
        <div class="preview-actions">
          <a class="preview-btn" id="previewOpen" href="#" target="_blank">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17 17 7M8 7h9v9"/></svg>
            新分頁開啟
          </a>
          <button class="preview-btn primary" onclick="closePreview()">關閉</button>
        </div>
      </div>
      <div class="preview-body">
        <div class="preview-loading" id="previewLoading">
          <div class="spinner"></div>
          <span>載入中</span>
        </div>
        <iframe class="preview-frame" id="previewFrame" src="about:blank"></iframe>
        <div id="previewHint" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;background:var(--surface-container-low);pointer-events:none;">
          <div style="font-family:var(--font-display);font-size:40px;opacity:0.12;font-weight:700">↗</div>
          <div style="font-family:var(--font-display);font-size:12px;font-weight:600;color:var(--on-surface-variant);letter-spacing:0.08em;text-transform:uppercase;opacity:0.6;">已在獨立視窗開啟</div>
          <div style="font-family:var(--font-body);font-size:12px;color:var(--on-surface-variant);opacity:0.4;text-align:center;max-width:200px;">首次需登入 Google，之後所有檔案不再詢問</div>
        </div>
      </div>
    </div>
    <div class="hero-card">
      <div class="hero-title">雲端資料總覽</div>
      <div class="hero-sub">統包先生總部 Google Drive — 即時資料夾結構瀏覽</div>
      <div class="hero-stats">
        <div class="hero-stat"><span class="val" id="heroFolders">—</span><span class="lbl">資料夾</span></div>
        <div class="hero-stat"><span class="val" id="heroFiles">—</span><span class="lbl">檔案</span></div>
        <div class="hero-stat"><span class="val" id="heroTotal">—</span><span class="lbl">總計</span></div>
      </div>
      <div class="hero-updated" id="heroUpdated"></div>
    </div>
    <div class="keys-card">
      <h3>快捷鍵</h3>
      <div class="keys-grid">
        <div class="key-item"><kbd>Ctrl K</kbd> 搜尋</div>
        <div class="key-item"><kbd>Ctrl E</kbd> 全部展開</div>
        <div class="key-item"><kbd>Ctrl W</kbd> 全部收合</div>
        <div class="key-item"><kbd>Esc</kbd> 清除搜尋</div>
        <div class="key-item"><kbd>/</kbd> 快速搜尋</div>
        <div class="key-item"><kbd>Click</kbd> 展開 / 開啟</div>
      </div>
    </div>
  </div>
</main>

<script>
const ROOT_ID = '1n-xgrDssMzoWKcAo8IYMfOQstG49SOiX';
let allItems = [];
let childMap = {};

function iconClass(mime) {
  if (mime.includes('folder')) return 'folder';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('ms-excel')) return 'sheet';
  if (mime.includes('word') || mime.includes('msword')) return 'doc';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('video') || mime.includes('audio') || mime.includes('mp4') || mime.includes('m4a')) return 'media';
  return 'other';
}
function iconLabel(mime) {
  if (mime.includes('folder')) return '📁';
  if (mime.includes('spreadsheet')) return '▓';
  if (mime.includes('excel') || mime.includes('ms-excel')) return 'XL';
  if (mime.includes('word') || mime.includes('msword')) return 'W';
  if (mime.includes('pdf')) return 'P';
  if (mime.includes('video') || mime.includes('mp4')) return '▶';
  if (mime.includes('audio') || mime.includes('m4a')) return '♫';
  return '•';
}
const TAG_MAP = {
  'vnd.google-apps.spreadsheet':'SHEET','pdf':'PDF','msword':'DOC',
  'vnd.openxmlformats-officedocument.wordprocessingml.document':'DOCX',
  'vnd.openxmlformats-officedocument.spreadsheetml.sheet':'XLSX',
  'vnd.ms-excel':'XLS','mp4':'MP4','x-m4a':'M4A','plain':'TXT'
};
function getTag(mime) { return TAG_MAP[mime.split('/').pop()] || ''; }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function driveUrl(item) {
  if (item.isFolder) return 'https://drive.google.com/drive/folders/' + item.id;
  if (item.mimeType === 'application/vnd.google-apps.spreadsheet') return 'https://docs.google.com/spreadsheets/d/' + item.id;
  if (item.mimeType === 'application/vnd.google-apps.document') return 'https://docs.google.com/document/d/' + item.id;
  return 'https://drive.google.com/file/d/' + item.id + '/view';
}

function buildChildMap(items) {
  childMap = {};
  items.forEach(item => {
    if (!childMap[item.parentId]) childMap[item.parentId] = [];
    childMap[item.parentId].push(item);
  });
  Object.values(childMap).forEach(c => c.sort((a,b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name,'zh-TW');
  }));
}

function buildTree(parentId, depth) {
  const items = childMap[parentId];
  if (!items || !items.length) return '';
  return items.map(item => {
    const ic = iconClass(item.mimeType);
    const il = iconLabel(item.mimeType);
    const tag = getTag(item.mimeType);
    const url = driveUrl(item);
    const hasKids = item.isFolder && childMap[item.id] && childMap[item.id].length > 0;
    const toggleCls = item.isFolder ? (hasKids ? '' : ' empty') : ' empty';
    const nameCls = item.isFolder ? 'f-name is-folder' : 'f-name';
    const collapsed = depth >= 1 ? ' collapsed' : '';
    const toggleOpen = depth < 1 ? ' open' : '';
    let h = '<div class="tree-node" data-id="'+item.id+'" data-name="'+esc(item.name)+'" data-path="'+esc(item.path)+'" data-depth="'+depth+'" data-folder="'+(item.isFolder?1:0)+'">';
    h += '<div class="tree-row">';
    h += '<span class="toggle'+toggleCls+toggleOpen+'">▸</span>';
    h += '<span class="f-icon '+ic+'">'+il+'</span>';
    h += '<span class="'+nameCls+'" title="'+esc(item.path)+'">'+esc(item.name)+'</span>';
    if (tag) h += '<span class="f-tag">'+tag+'</span>';
    h += '<a class="f-open" href="'+url+'" target="_blank" onclick="event.stopPropagation()">Open</a>';
    h += '</div>';
    if (item.isFolder && hasKids) h += '<div class="children'+collapsed+'">'+buildTree(item.id,depth+1)+'</div>';
    h += '</div>';
    return h;
  }).join('');
}

async function loadTree(forceRefresh) {
  document.getElementById('loadingOverlay').classList.remove('hidden');
  document.getElementById('errorBox').classList.remove('show');
  document.getElementById('statusDot').classList.add('loading');
  document.getElementById('statusText').textContent = '載入中';
  try {
    const url = forceRefresh ? '/api/tree?refresh=1' : '/api/tree';
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '未知錯誤');
    allItems = data.items;
    buildChildMap(allItems);
    document.getElementById('tree').innerHTML = buildTree(ROOT_ID, 0);
    const fc = allItems.filter(i => i.isFolder).length;
    const fl = allItems.length - fc;
    document.getElementById('heroFolders').textContent = fc;
    document.getElementById('heroFiles').textContent = fl;
    document.getElementById('heroTotal').textContent = allItems.length;
    document.getElementById('statsText').textContent = fc + ' folders · ' + fl + ' files';
    document.getElementById('sidebarStats').textContent = allItems.length + ' items';
    document.getElementById('statusDot').classList.remove('loading');
    document.getElementById('statusText').textContent = 'Live';
    const t = new Date(data.scannedAt);
    document.getElementById('heroUpdated').textContent = '資料時間：' + t.toLocaleString('zh-TW');
    document.getElementById('loadingOverlay').classList.add('hidden');
  } catch (err) {
    document.getElementById('loadingOverlay').classList.add('hidden');
    document.getElementById('errorBox').classList.add('show');
    document.getElementById('errorMsg').textContent = err.message;
    document.getElementById('statusDot').classList.remove('loading');
    document.getElementById('statusText').textContent = '錯誤';
  }
}

function toggleFolder(el, e) {
  e && e.stopPropagation();
  const node = el.closest('.tree-node');
  const ch = node.querySelector(':scope > .children');
  if (!ch) return;
  ch.classList.toggle('collapsed');
  el.classList.toggle('open');
}
function expandAll() {
  document.querySelectorAll('.children').forEach(el => el.classList.remove('collapsed'));
  document.querySelectorAll('.toggle:not(.empty)').forEach(el => el.classList.add('open'));
}
function collapseAll() {
  document.querySelectorAll('.children').forEach(el => el.classList.add('collapsed'));
  document.querySelectorAll('.toggle:not(.empty)').forEach(el => el.classList.remove('open'));
}
function expandLevel(max) {
  document.querySelectorAll('.tree-node').forEach(node => {
    const d = parseInt(node.dataset.depth);
    const ch = node.querySelector(':scope > .children');
    const tog = node.querySelector(':scope > .tree-row > .toggle');
    if (!ch) return;
    if (d < max) { ch.classList.remove('collapsed'); if (tog) tog.classList.add('open'); }
    else { ch.classList.add('collapsed'); if (tog) tog.classList.remove('open'); }
  });
}

let st;
const si = document.getElementById('searchInput');
const sb = document.getElementById('searchBadge');
si.addEventListener('input', function() {
  clearTimeout(st);
  const q = this.value.trim().toLowerCase();
  st = setTimeout(() => {
    document.querySelectorAll('.tree-row.highlight').forEach(el => el.classList.remove('highlight'));
    if (!q) { sb.classList.remove('show'); collapseAll(); expandLevel(1); return; }
    collapseAll();
    let n = 0;
    document.querySelectorAll('.tree-node').forEach(node => {
      const nm = (node.dataset.name||'').toLowerCase();
      const pt = (node.dataset.path||'').toLowerCase();
      if (nm.includes(q) || pt.includes(q)) {
        n++;
        node.querySelector(':scope > .tree-row').classList.add('highlight');
        let p = node.parentElement;
        while (p) {
          if (p.classList && p.classList.contains('children')) {
            p.classList.remove('collapsed');
            const pr = p.previousElementSibling;
            if (pr) { const t = pr.querySelector('.toggle'); if (t) t.classList.add('open'); }
          }
          p = p.parentElement;
        }
      }
    });
    sb.textContent = n + ' 筆';
    sb.classList.add('show');
    const f = document.querySelector('.tree-row.highlight');
    if (f) f.scrollIntoView({ block:'center', behavior:'smooth' });
  }, 180);
});

document.getElementById('tree').addEventListener('click', function(e) {
  const row = e.target.closest('.tree-row');
  if (!row) return;
  if (e.target.closest('.f-open')) return;
  const node = row.closest('.tree-node');
  if (node.dataset.folder === '1') {
    const tog = row.querySelector('.toggle:not(.empty)');
    if (tog) toggleFolder(tog, e);
  } else {
    const item = allItems.find(i => i.id === node.dataset.id);
    if (item) showPreview(item);
  }
});

// Revoke old blob URL to free memory
function revokeBlob(frame) {
  if (frame._blobUrl) { URL.revokeObjectURL(frame._blobUrl); frame._blobUrl = null; }
}

// File types that can be shown inline in the browser
function isInlinePreviewable(mime) {
  return mime.includes('pdf') ||
         mime.startsWith('image/') ||
         mime.startsWith('text/') ||
         mime.startsWith('application/vnd.google-apps.'); // Google native → exported as PDF by server
}

async function showPreview(item) {
  const panel = document.getElementById('detailPanel');
  const preview = document.getElementById('previewPanel');
  const frame = document.getElementById('previewFrame');
  const loading = document.getElementById('previewLoading');
  const hint = document.getElementById('previewHint');
  panel.classList.add('has-preview');
  preview.classList.add('active');
  document.getElementById('previewTitle').textContent = item.name;
  document.getElementById('previewPath').textContent = item.path;
  document.getElementById('previewIcon').className = 'preview-icon ' + iconClass(item.mimeType);
  document.getElementById('previewIcon').textContent = iconLabel(item.mimeType);
  document.getElementById('previewOpen').href = driveUrl(item);
  document.getElementById('previewOpen').onclick = null;
  document.querySelectorAll('.tree-row.selected').forEach(el => el.classList.remove('selected'));
  const sel = document.querySelector('.tree-node[data-id="'+item.id+'"]');
  if (sel) sel.querySelector('.tree-row').classList.add('selected');

  revokeBlob(frame);
  frame.src = 'about:blank';
  hint.style.display = 'none';

  if (!isInlinePreviewable(item.mimeType)) {
    // Can't preview inline — show hint with Drive link
    loading.classList.remove('show');
    hint.innerHTML = '<div style="font-size:32px;opacity:0.1;font-weight:700;font-family:var(--font-display)">?</div>'
      + '<div style="font-family:var(--font-display);font-size:12px;font-weight:600;color:var(--on-surface-variant);letter-spacing:0.08em;text-transform:uppercase;opacity:0.6;margin-top:8px;">無法在此預覽</div>'
      + '<div style="font-family:var(--font-body);font-size:12px;color:var(--on-surface-variant);opacity:0.4;text-align:center;max-width:220px;margin-top:4px;">'
      + item.name.split('.').pop().toUpperCase() + ' 格式不支援內嵌預覽</div>'
      + '<a href="'+driveUrl(item)+'" target="_blank" style="margin-top:16px;background:var(--primary-container);color:var(--on-primary-fixed);border:none;border-radius:var(--radius);padding:8px 18px;font-family:var(--font-display);font-size:11px;font-weight:600;cursor:pointer;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;">在 Google Drive 開啟</a>';
    hint.style.display = 'flex';
    return;
  }

  // Fetch via server proxy → blob URL → iframe (no download dialog, no Google login)
  loading.classList.add('show');
  try {
    const resp = await fetch('/api/file/' + item.id);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    frame._blobUrl = url;
    frame.src = url;
    frame.onload = () => loading.classList.remove('show');
  } catch (err) {
    loading.classList.remove('show');
    hint.innerHTML = '<div style="font-family:var(--font-display);font-size:12px;font-weight:600;color:var(--error);letter-spacing:0.08em;text-transform:uppercase;">載入失敗</div>'
      + '<div style="font-family:var(--font-body);font-size:12px;color:var(--on-surface-variant);opacity:0.5;margin-top:4px;">'+err.message+'</div>';
    hint.style.display = 'flex';
  }
}

function closePreview() {
  document.getElementById('detailPanel').classList.remove('has-preview');
  document.getElementById('previewPanel').classList.remove('active');
  document.getElementById('previewFrame').src = 'about:blank';
  document.querySelectorAll('.tree-row.selected').forEach(el => el.classList.remove('selected'));
}

document.addEventListener('keydown', function(e) {
  const isS = document.activeElement === si;
  if ((e.ctrlKey && e.key === 'k') || (!isS && e.key === '/')) { e.preventDefault(); si.focus(); si.select(); return; }
  if (e.ctrlKey && e.key === 'e') { e.preventDefault(); expandAll(); return; }
  if (e.ctrlKey && e.key === 'w') { e.preventDefault(); collapseAll(); return; }
  if (e.key === 'Escape') {
    if (isS) { si.value = ''; si.blur(); si.dispatchEvent(new Event('input')); }
    else if (document.getElementById('previewPanel').classList.contains('active')) { closePreview(); }
  }
});

loadTree();
</script>
</body>
</html>`;

// ── Login Page ──
const LOGIN_HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>統包先生 - 登入</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root {
  --primary: #7b5900;
  --primary-container: #f9b91b;
  --primary-fixed: #ffdea4;
  --on-primary-fixed: #261900;
  --surface: #fcf9f8;
  --surface-container-low: #f6f3f2;
  --surface-container: #f0edec;
  --surface-container-high: #eae7e7;
  --on-surface: #1c1b1b;
  --on-surface-variant: #4d4543;
  --outline-variant: #d4c4ac;
  --error: #ba1a1a;
  --shadow: rgba(28,27,27,0.08);
  --font: 'Space Grotesk','Noto Sans TC',sans-serif;
  --radius: 0.375rem;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family:var(--font);
  background:var(--surface);
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
}
.card {
  width:100%;
  max-width:400px;
  background:#fff;
  border-radius:16px;
  padding:48px 40px 40px;
  box-shadow:0 24px 48px var(--shadow);
  text-align:center;
}
.logo {
  width:56px; height:56px;
  background:linear-gradient(135deg,var(--primary),var(--primary-container));
  border-radius:14px;
  display:flex; align-items:center; justify-content:center;
  font-size:22px; font-weight:700; color:var(--on-primary-fixed);
  margin:0 auto 20px;
  letter-spacing:-0.02em;
}
h1 {
  font-size:22px; font-weight:700;
  color:var(--on-surface);
  letter-spacing:-0.02em;
  margin-bottom:6px;
}
.sub {
  font-size:13px; color:var(--on-surface-variant);
  margin-bottom:36px;
  opacity:0.7;
}
.err {
  background:#fff0f0; color:var(--error);
  border-radius:var(--radius);
  padding:10px 14px;
  font-size:13px;
  margin-bottom:16px;
}
.btn-google {
  display:flex; align-items:center; justify-content:center; gap:12px;
  width:100%; padding:14px 20px;
  background:#fff; color:#3c4043;
  border:1.5px solid var(--outline-variant);
  border-radius:var(--radius);
  font-family:var(--font); font-size:14px; font-weight:600;
  cursor:pointer; text-decoration:none;
  transition:all 0.15s;
  box-shadow:0 2px 6px rgba(0,0,0,0.06);
}
.btn-google:hover {
  background:var(--surface-container-low);
  box-shadow:0 4px 12px rgba(0,0,0,0.1);
  transform:translateY(-1px);
}
.btn-google:active { transform:translateY(0); }
.btn-google svg { flex-shrink:0; }
.footer {
  margin-top:28px;
  font-size:11px; color:var(--on-surface-variant);
  opacity:0.4;
  line-height:1.6;
}
</style>
</head>
<body>
<div class="card">
  <div class="logo">TB</div>
  <h1>統包先生</h1>
  <p class="sub">Drive Explorer — 請登入以繼續</p>
  {{ERROR}}
  <a class="btn-google" href="/auth/google?r={{REDIRECT}}">
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
    使用 Google 帳號登入
  </a>
  <p class="footer">僅限授權人員存取<br>登入即代表同意使用本系統</p>
</div>
</body>
</html>`;
