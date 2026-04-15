'use strict';
const express = require('express');
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

// ── Cache (5 min) ──
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function scanDrive() {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });
  const items = [];

  async function listFolder(folderId, depth, parentPath) {
    let pageToken = null;
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType)',
        orderBy: 'name',
        pageSize: 200,
        pageToken
      });
      for (const f of res.data.files) {
        const filePath = parentPath ? parentPath + '/' + f.name : f.name;
        const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
        items.push({ id: f.id, name: f.name, mimeType: f.mimeType, path: filePath, depth, isFolder, parentId: folderId });
        if (isFolder) await listFolder(f.id, depth + 1, filePath);
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  }

  await listFolder(ROOT_FOLDER_ID, 0, '');
  cache = items;
  cacheTime = Date.now();
  console.log(`[Drive] Scanned ${items.length} items`);
  return items;
}

// ── API ──
app.get('/api/tree', async (req, res) => {
  try {
    // Force fresh if requested
    if (req.query.refresh === '1') { cache = null; }
    const items = await scanDrive();
    res.json({ ok: true, items, scannedAt: new Date(cacheTime).toISOString() });
  } catch (err) {
    console.error('[API Error]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── HTML ──
app.get('/', (req, res) => {
  res.send(HTML);
});

app.listen(PORT, () => console.log(`Drive Explorer running on port ${PORT}`));

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
        <div class="preview-loading show" id="previewLoading">
          <div class="spinner"></div>
          <span>載入中</span>
        </div>
        <iframe class="preview-frame" id="previewFrame" src="about:blank"></iframe>
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

function showPreview(item) {
  const panel = document.getElementById('detailPanel');
  const preview = document.getElementById('previewPanel');
  const frame = document.getElementById('previewFrame');
  const loading = document.getElementById('previewLoading');
  panel.classList.add('has-preview');
  preview.classList.add('active');
  document.getElementById('previewTitle').textContent = item.name;
  document.getElementById('previewPath').textContent = item.path;
  document.getElementById('previewIcon').className = 'preview-icon ' + iconClass(item.mimeType);
  document.getElementById('previewIcon').textContent = iconLabel(item.mimeType);
  document.getElementById('previewOpen').href = driveUrl(item);
  document.querySelectorAll('.tree-row.selected').forEach(el => el.classList.remove('selected'));
  const sel = document.querySelector('.tree-node[data-id="'+item.id+'"]');
  if (sel) sel.querySelector('.tree-row').classList.add('selected');
  loading.classList.add('show');
  frame.src = 'https://drive.google.com/file/d/' + item.id + '/preview';
  frame.onload = () => loading.classList.remove('show');
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
