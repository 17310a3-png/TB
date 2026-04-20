import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

const REGIONS = ['台北', '台中', '桃園', '新竹', '龜山', '框框', '板橋', '水湳'];
const C = {
  gold: '#f9b91b', darkGold: '#7b5900', paleGold: '#ffdea4', warmCream: '#fef9ef',
  iron: '#1c1b1b', ironLight: '#2d2b2b', ironMid: '#3a3838',
  bone: '#fcf9f8', stone: '#f3f0ee', ash: '#e5e2e1', fog: '#d4c4ac',
  steel: '#4c616c', rust: '#ba1a1a', rustLight: '#ffdad6',
  moss: '#2e7d32', mossLight: '#e8f5e9', sky: '#1565c0', skyLight: '#e3f2fd',
  plum: '#6a1b9a', plumLight: '#f3e5f5', ember: '#e65100', emberLight: '#fff3e0',
};
const CHART_C = [C.gold, C.darkGold, C.steel, C.rust, C.moss, C.sky, C.plum, C.ember, '#795548', '#607d8b'];
const STATUS = {
  '施工中': { bg: C.paleGold, c: C.darkGold }, '已完工': { bg: C.mossLight, c: C.moss },
  '待驗收': { bg: C.emberLight, c: C.ember }, '待開工': { bg: C.skyLight, c: C.sky },
  '停工': { bg: C.rustLight, c: C.rust }, '接洽中': { bg: C.plumLight, c: C.plum },
  '完工': { bg: C.mossLight, c: C.moss },
};

const NAV = [
  { id: 'dashboard', icon: '◆', label: '全區總覽' },
  { id: 'cases', icon: '01', label: '案件統計' },
  { id: 'projects', icon: '02', label: '工程進度' },
  { id: 'payment', icon: '03', label: '請款進度' },
  { id: 'feedback', icon: '04', label: '客戶·廠商' },
  { id: 'expected', icon: '05', label: '預計簽約' },
  { id: 'performance', icon: '06', label: '營運數據' },
  { id: 'employees', icon: '07', label: '員工業績' },
];

const font = (w = 400, s = 14) => ({ fontFamily: "'Space Grotesk', sans-serif", fontWeight: w, fontSize: s });
const bodyFont = (w = 400, s = 14) => ({ fontFamily: "'Manrope', sans-serif", fontWeight: w, fontSize: s });
const fadeIn = { animation: 'fadeSlideIn 0.4s ease-out forwards', opacity: 0 };
const delay = (ms) => ({ ...fadeIn, animationDelay: `${ms}ms` });

const Badge = ({ status }) => {
  const s = STATUS[status] || { bg: C.ash, c: C.ironMid };
  return <span style={{ ...font(700, 10), padding: '3px 10px', borderRadius: 2, background: s.bg, color: s.c, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-block' }}>{status}</span>;
};

const Abnormal = ({ text }) => text ? <span style={{ ...font(700, 9), padding: '3px 8px', borderRadius: 2, background: C.rustLight, color: C.rust, letterSpacing: '0.04em' }}>{text}</span> : null;

const Days = ({ days }) => {
  if (!days || ['完工', '資料不齊全', '還沒開工'].includes(days)) return <span style={{ ...font(500, 13), color: C.fog }}>{days || '—'}</span>;
  const n = parseInt(days); if (isNaN(n)) return <span style={font(500, 13)}>{days}</span>;
  const color = n < 0 ? C.rust : n <= 14 ? C.ember : C.darkGold;
  return <span style={{ ...font(800, 16), color, letterSpacing: '-0.03em' }}>{n < 0 ? `–${Math.abs(n)}` : n}<span style={{ ...font(600, 9), marginLeft: 2, opacity: 0.6 }}>天</span></span>;
};

const Metric = ({ label, value, highlight, large }) => (
  <div className="metric-card" style={{ padding: large ? '24px 28px' : '16px 20px', background: highlight ? `linear-gradient(135deg, ${C.iron} 0%, ${C.ironMid} 100%)` : C.bone, borderRadius: 4, flex: '1 1 120px', minWidth: 100, position: 'relative', overflow: 'hidden' }}>
    {highlight && <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, background: C.gold, opacity: 0.15, borderRadius: '0 0 0 60px' }} />}
    <div style={{ ...font(700, 9), letterSpacing: '0.12em', textTransform: 'uppercase', color: highlight ? C.fog : C.steel, marginBottom: 6 }}>{label}</div>
    <div style={{ ...font(800, large ? 36 : 28), letterSpacing: '-0.03em', color: highlight ? C.gold : C.iron, lineHeight: 1 }}>{value}</div>
  </div>
);

const Block = ({ id, num, title, sub, gold, children }) => (
  <div id={id} className="block-wrap" style={{ marginBottom: 24, borderRadius: 4, background: C.bone, scrollMarginTop: 64, ...fadeIn }}>
    <div className="block-header" style={{ padding: '18px 28px', background: gold ? `linear-gradient(135deg, ${C.darkGold}, ${C.gold})` : C.iron, display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 10, borderRadius: '4px 4px 0 0' }}>
      {num && <span style={{ ...font(800, 11), color: gold ? C.iron : C.gold, opacity: 0.5, letterSpacing: '0.1em' }}>{num}</span>}
      <div>
        <div style={{ ...font(700, 15), color: gold ? C.iron : '#fff', letterSpacing: '-0.01em' }}>{title}</div>
        {sub && <div style={{ ...bodyFont(500, 11), color: gold ? 'rgba(28,27,27,0.5)' : 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
    <div className="block-body" style={{ padding: '24px 28px' }}>{children}</div>
  </div>
);

const TH = ({ children }) => <th style={{ ...font(700, 9), padding: '10px 12px', textAlign: 'left', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, background: C.stone }}>{children}</th>;
const TD = ({ children, style: s }) => <td style={{ ...bodyFont(400, 13), padding: '10px 12px', color: C.iron, borderBottom: `1px solid ${C.ash}`, ...s }}>{children}</td>;
const TR = ({ children, onClick }) => <tr style={{ cursor: onClick ? 'pointer' : 'default', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = C.stone} onMouseLeave={e => e.currentTarget.style.background = ''} onClick={onClick}>{children}</tr>;

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div style={{ ...font(600, 12), background: C.iron, color: '#fff', padding: '10px 16px', borderRadius: 3, border: `1px solid ${C.ironMid}` }}>
    <div style={{ color: C.fog, fontSize: 10, marginBottom: 4 }}>{label}</div>
    {payload.map((p, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill || p.color || C.gold }} />
        <span style={{ color: C.fog, fontSize: 11 }}>{p.name || p.dataKey}</span>
        <span style={{ color: C.gold, fontSize: 14, fontWeight: 800, marginLeft: 'auto' }}>{p.value}</span>
      </div>
    ))}
  </div>;
};

// ======= ACCOUNTS PAGE =======
// region 以逗號分隔字串存放，e.g. "台北,台中,桃園"
const parseRegions = (str) => str ? String(str).split(',').map(s => s.trim()).filter(Boolean) : [];
const joinRegions = (arr) => arr.join(',');

function RegionCheckboxes({ selected, onChange }) {
  const toggle = (r) => onChange(selected.includes(r) ? selected.filter(x => x !== r) : [...selected, r]);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
      {REGIONS.map(r => {
        const on = selected.includes(r);
        return (
          <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            ...bodyFont(on ? 700 : 400, 12), padding: '4px 10px', borderRadius: 3,
            background: on ? C.gold : C.stone, color: on ? C.iron : C.steel,
            border: `1px solid ${on ? C.gold : C.ash}`, userSelect: 'none' }}>
            <input type="checkbox" checked={on} onChange={() => toggle(r)} style={{ display: 'none' }} />{r}
          </label>
        );
      })}
    </div>
  );
}

function AccountsPage({ auth }) {
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'region', regions: [] });
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', password: '', role: 'region', regions: [] });

  const load = () => fetch('/api/admin/users').then(r => r.json()).then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  const addUser = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.name.trim() || !form.password) { setError('請填寫所有必填欄位'); return; }
    if (form.role === 'region' && form.regions.length === 0) { setError('請至少選擇一個區域'); return; }
    setError(''); setBusy(true);
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username.trim().toLowerCase(), name: form.name.trim(),
        password: form.password, role: form.role, region: form.role === 'admin' ? null : joinRegions(form.regions) }) });
    setBusy(false);
    if (res.ok) { setForm({ username: '', name: '', password: '', role: 'region', regions: [] }); load(); }
    else { const d = await res.json(); setError(d.error || '新增失敗'); }
  };

  const startEdit = (u) => {
    setEditId(u.id);
    setEditForm({ name: u.name, password: '', role: u.role, regions: parseRegions(u.region) });
  };

  const saveEdit = async () => {
    const updates = { name: editForm.name, role: editForm.role,
      region: editForm.role === 'admin' ? null : joinRegions(editForm.regions) };
    if (editForm.password) updates.password = editForm.password;
    await fetch(`/api/admin/users/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    setEditId(null);
    load();
  };

  const deleteUser = async (id, username) => {
    if (username === 'admin' || id === auth.id) return;
    if (!window.confirm(`確定刪除 ${username}？`)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    load();
  };

  const ROLE_STYLE = { admin: { bg: C.paleGold, c: C.darkGold }, region: { bg: C.skyLight, c: C.sky } };
  const roleLabel = (r) => r === 'admin' ? '總部管理員' : '區域帳號';

  return (
    <div style={fadeIn}>
      <div style={{ ...font(800, 26), color: C.iron, letterSpacing: '-0.02em', marginBottom: 4 }}>帳號管理</div>
      <div style={{ ...bodyFont(500, 13), color: C.steel, marginBottom: 24 }}>新增或刪除系統帳號 · 僅總部管理員可存取</div>

      {/* 現有帳號列表 */}
      <div style={{ background: C.bone, borderRadius: 4, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 20px', background: C.iron, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...font(700, 13), color: '#fff' }}>現有帳號</span>
          <span style={{ ...font(600, 11), color: C.fog }}>{users.length} 筆</span>
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['帳號', '姓名', '角色', '可看區域', '操作'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {users.map(u => (
                <React.Fragment key={u.id}>
                  <TR>
                    <TD style={font(700, 13)}>{u.username}</TD>
                    <TD>{u.name}</TD>
                    <TD>
                      <span style={{ ...font(700, 10), padding: '3px 10px', borderRadius: 2, background: (ROLE_STYLE[u.role] || ROLE_STYLE.region).bg, color: (ROLE_STYLE[u.role] || ROLE_STYLE.region).c }}>
                        {roleLabel(u.role)}
                      </span>
                    </TD>
                    <TD style={{ color: C.steel }}>
                      {u.role === 'admin' ? <span style={{ color: C.fog }}>全區</span>
                        : parseRegions(u.region).map(r => (
                          <span key={r} style={{ ...font(600, 10), padding: '2px 7px', borderRadius: 2, background: C.skyLight, color: C.sky, marginRight: 4, display: 'inline-block', marginBottom: 2 }}>{r}</span>
                        ))}
                    </TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => editId === u.id ? setEditId(null) : startEdit(u)}
                          style={{ ...font(600, 11), padding: '4px 12px', borderRadius: 3, border: `1px solid ${C.ash}`, cursor: 'pointer', background: editId === u.id ? C.ironLight : C.stone, color: editId === u.id ? '#fff' : C.iron }}>
                          {editId === u.id ? '收起' : '編輯'}
                        </button>
                        {u.username !== 'admin' && u.id !== auth.id && (
                          <button onClick={() => deleteUser(u.id, u.username)} style={{ background: 'none', border: 'none', color: C.rust, cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1, fontWeight: 700 }}>×</button>
                        )}
                      </div>
                    </TD>
                  </TR>
                  {editId === u.id && (
                    <tr>
                      <td colSpan={5} style={{ background: C.warmCream, padding: '16px 20px', borderBottom: `1px solid ${C.ash}` }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <div style={{ flex: '1 1 140px' }}>
                            <div style={{ ...font(700, 9), color: C.steel, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>姓名</div>
                            <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                              style={{ width: '100%', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '6px 10px', background: C.bone }} />
                          </div>
                          <div style={{ flex: '1 1 120px' }}>
                            <div style={{ ...font(700, 9), color: C.steel, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>新密碼（留空不改）</div>
                            <input type="password" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} placeholder="不修改請留空"
                              style={{ width: '100%', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '6px 10px', background: C.bone }} />
                          </div>
                          <div style={{ flex: '1 1 120px' }}>
                            <div style={{ ...font(700, 9), color: C.steel, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>角色</div>
                            <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value, regions: [] }))}
                              style={{ width: '100%', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '6px 10px', background: C.bone }}>
                              <option value="region">區域帳號</option>
                              <option value="admin">總部管理員</option>
                            </select>
                          </div>
                          {editForm.role === 'region' && (
                            <div style={{ flex: '2 1 240px' }}>
                              <div style={{ ...font(700, 9), color: C.steel, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>可看區域（複選）</div>
                              <RegionCheckboxes selected={editForm.regions} onChange={regions => setEditForm(p => ({ ...p, regions }))} />
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end', paddingBottom: 2 }}>
                            <button onClick={saveEdit} style={{ ...font(700, 12), padding: '7px 20px', borderRadius: 3, border: 'none', cursor: 'pointer', background: C.gold, color: C.iron }}>儲存</button>
                            <button onClick={() => setEditId(null)} style={{ ...font(600, 12), padding: '7px 14px', borderRadius: 3, border: `1px solid ${C.ash}`, cursor: 'pointer', background: C.stone, color: C.steel }}>取消</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增帳號 */}
      <div style={{ background: C.bone, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: C.ironLight }}>
          <span style={{ ...font(700, 13), color: '#fff' }}>新增帳號</span>
        </div>
        <form onSubmit={addUser} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ ...bodyFont(500, 13), color: C.rust, background: '#ffdad6', padding: '10px 14px', borderRadius: 4 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px' }}>
              <div style={{ ...font(700, 10), color: C.steel, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>帳號 *</div>
              <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="英文小寫"
                style={{ width: '100%', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '8px 12px', background: C.stone }} />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <div style={{ ...font(700, 10), color: C.steel, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>姓名 *</div>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="顯示名稱"
                style={{ width: '100%', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '8px 12px', background: C.stone }} />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <div style={{ ...font(700, 10), color: C.steel, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>密碼 *</div>
              <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="登入密碼"
                style={{ width: '100%', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '8px 12px', background: C.stone }} />
            </div>
            <div style={{ flex: '0 1 120px' }}>
              <div style={{ ...font(700, 10), color: C.steel, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>角色</div>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value, regions: [] }))}
                style={{ width: '100%', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '8px 12px', background: C.stone }}>
                <option value="region">區域帳號</option>
                <option value="admin">總部管理員</option>
              </select>
            </div>
          </div>
          {form.role === 'region' && (
            <div>
              <div style={{ ...font(700, 10), color: C.steel, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>可看區域 *（複選）</div>
              <RegionCheckboxes selected={form.regions} onChange={regions => setForm(p => ({ ...p, regions }))} />
            </div>
          )}
          <div>
            <button type="submit" disabled={busy} style={{ ...font(700, 14), padding: '10px 28px', borderRadius: 3, border: 'none', cursor: busy ? 'wait' : 'pointer', background: busy ? C.fog : C.gold, color: C.iron }}>
              {busy ? '新增中...' : '+ 新增帳號'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ======= LOGIN PAGE =======
function LoginPage({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!user.trim() || !pass) return;
    setBusy(true); setErr('');
    const result = await onLogin(user.trim(), pass);
    if (!result.ok) setErr('帳號或密碼錯誤');
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.iron, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap'); *{margin:0;padding:0;box-sizing:border-box;} input::placeholder{color:rgba(255,255,255,0.18);} input:focus{outline:none!important;}`}</style>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ marginBottom: 48, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 4, height: 36, background: C.gold, borderRadius: 2 }} />
          <div>
            <div style={{ ...font(800, 26), color: C.gold, letterSpacing: '-0.02em' }}>統包先生</div>
            <div style={{ ...font(600, 10), color: 'rgba(255,255,255,0.25)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>WEEKLY MEETING SYSTEM</div>
          </div>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ ...font(700, 10), color: C.fog, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>帳號</div>
            <input value={user} onChange={e => setUser(e.target.value)} placeholder="username" autoFocus
              style={{ width: '100%', ...bodyFont(400, 15), background: C.ironLight, border: `1px solid ${err ? C.rust : C.ironMid}`, borderRadius: 4, padding: '12px 16px', color: '#fff' }} />
          </div>
          <div>
            <div style={{ ...font(700, 10), color: C.fog, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>密碼</div>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="password"
              style={{ width: '100%', ...bodyFont(400, 15), background: C.ironLight, border: `1px solid ${err ? C.rust : C.ironMid}`, borderRadius: 4, padding: '12px 16px', color: '#fff' }} />
          </div>
          {err && <div style={{ ...bodyFont(500, 13), color: C.rust, background: '#3d1212', padding: '10px 14px', borderRadius: 4 }}>{err}</div>}
          <button type="submit" disabled={busy}
            style={{ ...font(700, 15), background: busy ? C.fog : C.gold, color: C.iron, border: 'none', borderRadius: 4, padding: '14px', cursor: busy ? 'wait' : 'pointer', marginTop: 6 }}>
            {busy ? '驗證中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ======= DASHBOARD VIEW =======
function Dashboard({ data, onAllDataRefresh }) {
  const [targets, setTargets] = React.useState({});  // { region: { milestone_revenue, milestone_sign_rate } }
  const [editMode, setEditMode] = React.useState(false);
  const [drafts, setDrafts] = React.useState({});    // { region: { milestone_revenue, milestone_sign_rate } }

  React.useEffect(() => {
    fetch('/api/annualtargets').then(r => r.json()).then(rows => {
      const map = {};
      (Array.isArray(rows) ? rows : []).forEach(r => { map[r.region] = r; });
      setTargets(map);
    }).catch(() => {});
  }, []);

  const saveAll = async () => {
    await Promise.all(Object.entries(drafts).map(([region, d]) =>
      fetch('/api/annualtargets', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, milestone_revenue: parseInt(d.milestone_revenue) || 0, milestone_sign_rate: d.milestone_sign_rate || '' }) })
        .then(r => r.json()).then(saved => {
          const record = Array.isArray(saved) ? saved[0] : saved;
          if (record) setTargets(prev => ({ ...prev, [region]: record }));
        })
    ));
    setDrafts({});
    setEditMode(false);
    if (onAllDataRefresh) onAllDataRefresh();
  };

  if (!data) return null;
  const { regions, total } = data;

  const getMilestone = (regionName) => {
    const draft = drafts[regionName];
    if (draft) return parseInt(draft.milestone_revenue) || 0;
    const t = targets[regionName];
    if (t) return t.milestone_revenue || 0;
    const r = regions.find(x => x.region === regionName);
    return r?.milestone || 0;
  };

  const enriched = regions.map(r => ({ ...r, milestone: getMilestone(r.region) }));
  const active = enriched.filter(r => r.milestone > 0 || r.actual > 0);
  const totalMilestone = enriched.reduce((s, r) => s + (getMilestone(r.region) || 0), 0);
  const barData = active.map(r => ({ name: r.region, 目標: r.milestone, 業績: r.actual }));
  const rateData = active.map(r => ({ name: r.region, 年度達成率: r.milestone > 0 ? parseFloat((r.actual / r.milestone * 100).toFixed(1)) : 0 }));

  return (
    <div style={fadeIn}>
      <div style={{ ...font(800, 28), color: C.iron, letterSpacing: '-0.02em', marginBottom: 4 }}>全區營運總覽</div>
      <div style={{ ...bodyFont(500, 13), color: C.steel, marginBottom: 28 }}>各門市年度目標達成狀況一覽</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <Metric label="年度目標" value={`${totalMilestone}萬`} large />
        <Metric label="累積業績" value={`${total.actual}萬`} highlight large />
        <Metric label="差異" value={`${totalMilestone - total.actual}萬`} large />
        <Metric label="當月業績" value={`${total.monthRevenue}萬`} large />
        <Metric label="累積達成率" value={total.totalRate} large />
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 500px', background: C.bone, borderRadius: 4, padding: 24 }}>
          <div style={{ ...font(700, 11), letterSpacing: '0.08em', textTransform: 'uppercase', color: C.steel, marginBottom: 12 }}>各區業績 vs 目標</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ ...font(500, 11) }} /><YAxis tick={{ ...font(400, 10) }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="目標" fill={C.ash} radius={[3, 3, 0, 0]} />
              <Bar dataKey="業績" fill={C.gold} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: '1 1 300px', background: C.bone, borderRadius: 4, padding: 24 }}>
          <div style={{ ...font(700, 11), letterSpacing: '0.08em', textTransform: 'uppercase', color: C.steel, marginBottom: 12 }}>年度達成率排名</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rateData.sort((a, b) => b.年度達成率 - a.年度達成率)} layout="vertical" margin={{ left: 5, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ ...font(400, 10) }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ ...bodyFont(500, 12) }} width={50} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="年度達成率" radius={[0, 3, 3, 0]}>{rateData.map((e, i) => <Cell key={i} fill={e.年度達成率 >= 60 ? C.gold : e.年度達成率 >= 30 ? C.fog : C.ash} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: C.bone, borderRadius: 4, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.ash}` }}>
          <span style={{ ...font(700, 11), letterSpacing: '0.08em', textTransform: 'uppercase', color: C.steel }}>各區明細</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {editMode ? (
              <>
                <button onClick={saveAll} style={{ ...font(700, 12), padding: '5px 16px', borderRadius: 3, border: 'none', cursor: 'pointer', background: C.gold, color: C.iron }}>儲存全部</button>
                <button onClick={() => { setDrafts({}); setEditMode(false); }} style={{ ...font(600, 12), padding: '5px 12px', borderRadius: 3, border: `1px solid ${C.ash}`, background: C.bone, color: C.steel, cursor: 'pointer' }}>取消</button>
              </>
            ) : (
              <button onClick={() => setEditMode(true)} style={{ ...font(600, 11), padding: '4px 12px', borderRadius: 3, border: `1px solid ${C.ash}`, background: C.bone, color: C.steel, cursor: 'pointer' }}>設定年度目標</button>
            )}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><TH>地區</TH><TH>年度目標(萬)</TH><TH>累積業績</TH><TH>年度達成率</TH><TH>月累積達成率</TH><TH>簽約率</TH><TH>當月業績</TH><TH>當月達成率</TH></tr></thead>
          <tbody>
            {active.map((r, i) => {
              const yearRate = r.milestone > 0 ? (r.actual / r.milestone * 100).toFixed(1) : 0;
              const monthRate = parseFloat(r.totalRate) || 0;
              const draft = drafts[r.region] || {};
              const t = targets[r.region] || {};
              return <TR key={i}>
                <TD style={font(700, 14)}>{r.region}</TD>
                <TD style={font(700, 14)}>
                  {editMode ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="number" value={draft.milestone_revenue !== undefined ? draft.milestone_revenue : (t.milestone_revenue || r.milestone || '')}
                        onChange={e => setDrafts(prev => ({ ...prev, [r.region]: { ...( prev[r.region] || { milestone_sign_rate: t.milestone_sign_rate || '' }), milestone_revenue: e.target.value } }))}
                        onWheel={e => e.target.blur()}
                        placeholder="萬" style={{ width: 80, ...font(600, 13), border: `1px solid ${C.gold}`, borderRadius: 3, padding: '3px 6px' }} />
                      <input value={draft.milestone_sign_rate !== undefined ? draft.milestone_sign_rate : (t.milestone_sign_rate || '')}
                        onChange={e => setDrafts(prev => ({ ...prev, [r.region]: { ...(prev[r.region] || { milestone_revenue: t.milestone_revenue || r.milestone || '' }), milestone_sign_rate: e.target.value } }))}
                        placeholder="簽約率%" style={{ width: 60, ...font(600, 12), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '3px 6px' }} />
                    </div>
                  ) : r.milestone ? `${r.milestone}萬` : '—'}
                </TD>
                <TD style={font(700, 14)}>{r.actual}萬</TD>
                <TD><span style={{ ...font(800, 15), color: yearRate >= 50 ? C.moss : yearRate >= 25 ? C.darkGold : C.rust }}>{yearRate}%</span></TD>
                <TD><span style={{ ...font(800, 15), color: monthRate >= 60 ? C.moss : monthRate >= 30 ? C.darkGold : C.rust }}>{r.totalRate}</span></TD>
                <TD style={{ ...font(700, 14), color: C.darkGold }}>{r.signRate || '—'}</TD>
                <TD style={font(600, 13)}>{r.monthRevenue}萬</TD>
                <TD style={{ ...font(600, 13), color: C.steel }}>{r.monthRate}</TD>
              </TR>;
            })}
            <tr style={{ background: C.paleGold }}><TD style={font(800, 14)}>合計</TD><TD style={font(800, 14)}>{totalMilestone}萬</TD><TD style={font(800, 14)}>{total.actual}萬</TD>
              <TD style={{ ...font(800, 16), color: C.darkGold }}>{totalMilestone > 0 ? (total.actual / totalMilestone * 100).toFixed(1) : 0}%</TD>
              <TD style={{ ...font(800, 16), color: C.darkGold }}>{total.totalRate}</TD><TD /><TD style={font(800, 14)}>{total.monthRevenue}萬</TD><TD style={{ ...font(800, 13), color: C.darkGold }}>{total.monthRate}</TD></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ======= MAIN APP =======
export default function App() {
  const [auth, setAuth] = useState(() => { try { return JSON.parse(localStorage.getItem('tb_auth') || 'null'); } catch { return null; } });
  const [region, setRegion] = useState('台北');
  const [view, setView] = useState('dashboard');
  const [data, setData] = useState(null);
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [perfView, setPerfView] = useState('region');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [notes, setNotes] = useState([]);
  const [noteInput, setNoteInput] = useState({});   // { '客戶回饋': '', '廠商狀況': '', '支援項目': '' }
  const [paymentRec, setPaymentRec] = useState({}); // { case_no: { invoice_amount, received_amount } }
  const [paymentEdit, setPaymentEdit] = useState({}); // 未儲存的草稿值
  const [expectedSigns, setExpectedSigns] = useState([]);
  const [signInput, setSignInput] = useState({ address: '', amount: '', expected_date: '', note: '' });
  const [projectNotes, setProjectNotes] = useState({}); // { case_no: { note, is_abnormal } }
  const [noteInputs, setNoteInputs] = useState({}); // controlled note input values for 02 block
  const [caseNotes, setCaseNotes] = useState({}); // { case_id: note } for 01 block
  const [annualTarget, setAnnualTarget] = useState(null); // { milestone_revenue, milestone_sign_rate } from Supabase

  useEffect(() => {
    fetch('/api/allregions').then(r => r.json()).then(setAllData).catch(() => {});
  }, []);

  useEffect(() => {
    if (view === 'meeting') {
      setLoading(true); setExpanded(null);
      Promise.all([
        fetch(`/api/meeting/${encodeURIComponent(region)}`).then(r => r.json()),
        fetch(`/api/notes/${encodeURIComponent(region)}`).then(r => r.json()).catch(() => []),
        fetch(`/api/paymentrecords/${encodeURIComponent(region)}`).then(r => r.json()).catch(() => []),
        fetch(`/api/expected/${encodeURIComponent(region)}`).then(r => r.json()).catch(() => []),
        fetch(`/api/projectnotes/${encodeURIComponent(region)}`).then(r => r.json()).catch(() => []),
        fetch(`/api/casenotes/${encodeURIComponent(region)}`).then(r => r.json()).catch(() => []),
        fetch(`/api/annualtargets/${encodeURIComponent(region)}`).then(r => r.json()).catch(() => null),
      ]).then(([meetingData, notesData, paymentsData, expectedData, projNotesData, caseNotesData, annualData]) => {
        setData(meetingData);
        setNotes(Array.isArray(notesData) ? notesData : []);
        const pm = {};
        (Array.isArray(paymentsData) ? paymentsData : []).forEach(r => { pm[r.case_no] = r; });
        setPaymentRec(pm);
        setExpectedSigns(Array.isArray(expectedData) ? expectedData : []);
        setSignInput({ address: '', amount: '', expected_date: '', note: '' });
        // localStorage 為主，Supabase API 為補（表格建好後自動同步）
        const lsPn = JSON.parse(localStorage.getItem(`tb_pn_${region}`) || '{}');
        const apiPn = {};
        (Array.isArray(projNotesData) ? projNotesData : []).forEach(r => { apiPn[r.case_no] = r; });
        const merged = { ...apiPn, ...lsPn };
        setProjectNotes(merged);
        // 初始化 controlled note inputs
        const initNotes = {};
        Object.entries(merged).forEach(([k, v]) => { initNotes[k] = v.note || ''; });
        setNoteInputs(initNotes);
        const cn = {};
        (Array.isArray(caseNotesData) ? caseNotesData : []).forEach(r => { cn[r.case_id] = r.note; });
        setCaseNotes(cn);
        setAnnualTarget(annualData || null);
        setLoading(false);
      }).catch(err => { console.error('載入失敗:', err); setLoading(false); setData({ error: '載入超時，請重新整理' }); });
    }
  }, [region, view]);

  const addNote = async (category, content) => {
    if (!content.trim()) return;
    const res = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, category, content }) });
    const created = await res.json();
    if (Array.isArray(created) && created[0]) setNotes(prev => [...prev, created[0]]);
    setNoteInput(prev => ({ ...prev, [category]: '' }));
  };

  const cycleStatus = async (note) => {
    const next = { '未處理': '處理中', '處理中': '已處理', '已處理': '未處理' }[note.status] || '未處理';
    await fetch(`/api/notes/${note.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: next } : n));
  };

  const deleteNote = async (id) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const addExpected = async () => {
    if (!signInput.address.trim()) return;
    const res = await fetch('/api/expected', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, ...signInput }) });
    const created = await res.json();
    if (Array.isArray(created) && created[0]) setExpectedSigns(prev => [...prev, created[0]]);
    setSignInput({ address: '', amount: '', expected_date: '', note: '' });
  };

  const deleteExpected = async (id) => {
    await fetch(`/api/expected/${id}`, { method: 'DELETE' });
    setExpectedSigns(prev => prev.filter(s => s.id !== id));
  };

  const setPaymentDraft = (caseNo, field, value) => {
    setPaymentEdit(prev => ({ ...prev, [caseNo]: { ...(prev[caseNo] || {}), [field]: value } }));
  };

  const savePayment = async (caseNo, address) => {
    const draft = paymentEdit[caseNo] || {};
    const saved = paymentRec[caseNo] || {};
    const get = (field, fallback) => draft[field] !== undefined ? draft[field] : (saved[field] !== undefined ? saved[field] : fallback);
    const merged = {
      contract_amount: parseInt(get('contract_amount', 0)) || 0,
      contract_status: get('contract_status', '時間未到'),
      additional_amount: parseInt(get('additional_amount', 0)) || 0,
      additional_status: get('additional_status', '時間未到'),
      abnormal_note: get('abnormal_note', ''),
    };
    setPaymentRec(prev => ({ ...prev, [caseNo]: { ...(prev[caseNo] || {}), ...merged } }));
    setPaymentEdit(prev => { const n = { ...prev }; delete n[caseNo]; return n; });
    await fetch('/api/paymentrecords', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, case_no: caseNo, address, ...merged }) });
  };

  const saveProjectNote = (caseNo, note, isAbnormal) => {
    const data = { note: note || '', is_abnormal: !!isAbnormal };
    const allNotes = JSON.parse(localStorage.getItem(`tb_pn_${region}`) || '{}');
    allNotes[caseNo] = data;
    localStorage.setItem(`tb_pn_${region}`, JSON.stringify(allNotes));
    setProjectNotes(prev => ({ ...prev, [caseNo]: data }));
    fetch('/api/projectnotes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, case_no: caseNo, note: data.note, is_abnormal: data.is_abnormal })
    }).catch(() => {});
  };

  const saveCaseNote = (caseId, note) => {
    setCaseNotes(prev => ({ ...prev, [caseId]: note }));
    fetch('/api/casenotes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, case_id: caseId, note }) }).catch(() => {});
  };

  const scrollTo = (id) => {
    if (id === 'dashboard') { setView('dashboard'); setActiveNav('dashboard'); return; }
    if (view !== 'meeting') setView('meeting');
    setActiveNav(id);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  useEffect(() => {
    if (view !== 'meeting') return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveNav(e.target.id); });
    }, { rootMargin: '-70px 0px -60% 0px' });
    NAV.filter(n => n.id !== 'dashboard').forEach(n => { const el = document.getElementById(n.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [data, view]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 區域帳號：自動切到該區並進入週會視圖
  useEffect(() => {
    if (auth?.role === 'region' && auth.region) {
      const first = parseRegions(auth.region)[0] || REGIONS[0];
      setRegion(first);
      setView('meeting');
      setActiveNav('cases');
    }
  }, [auth?.role, auth?.region]);

  const login = async (username, password) => {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (data.ok) { localStorage.setItem('tb_auth', JSON.stringify(data)); setAuth(data); }
    return data;
  };
  const logout = () => { localStorage.removeItem('tb_auth'); setAuth(null); };

  const p = data?.projects || [], cases = data?.cases || [], abnormal = data?.abnormalCases || [], stats = data?.stats || {};
  const working = p.filter(x => x.status === '施工中').length, pending = p.filter(x => x.status === '待驗收').length;
  const waiting = p.filter(x => x.status === '待開工').length;
  const overdue = p.filter(x => { const n = parseInt(x.remainDays); return !isNaN(n) && n < 0; }).length;
  const abnormalCount = Object.values(projectNotes).filter(n => n.is_abnormal).length;
  const byType = {}; cases.forEach(c => { if (c.caseType) byType[c.caseType] = (byType[c.caseType] || 0) + 1; });

  const statusChart = Object.entries(stats.byStatus || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const typeChart = Object.entries(stats.byType || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const projChart = [{ name: '施工中', value: working }, { name: '待驗收', value: pending }, { name: '待開工', value: waiting }, { name: '逾期', value: overdue }].filter(d => d.value > 0);
  const revChart = (data?.revenueStats || []).map(r => ({ month: r.month, 營業額: parseInt(r.amount) || 0 }));
  const empChart = (data?.employees || []).filter(e => e.totalRevenue).map(e => ({ name: e.name, 業績: parseInt(e.totalRevenue) || 0 }));

  const sideW = collapsed ? 52 : 170;
  const isAdmin = auth?.role === 'admin';
  const userRegions = parseRegions(auth?.region);
  const allowedRegions = isAdmin ? REGIONS : REGIONS.filter(r => userRegions.includes(r));

  if (!auth) return <LoginPage onLogin={login} />;

  return (
    <div style={{ minHeight: '100vh', background: C.stone, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        * { margin:0; padding:0; box-sizing:border-box; }
        ::-webkit-scrollbar { width:6px; height:6px; } ::-webkit-scrollbar-thumb { background:${C.fog}; border-radius:3px; }
        table { border-spacing:0; }
        .mobile-region-scroll::-webkit-scrollbar { display:none; }
        .mobile-region-scroll { -ms-overflow-style:none; scrollbar-width:none; }
        @media (max-width: 767px) {
          .block-wrap { scroll-margin-top: 108px !important; }
          .block-header { padding: 13px 14px !important; }
          .block-body { padding: 14px 12px !important; }
          .metric-card { padding: 12px 14px !important; min-width: 80px !important; flex-basis: 80px !important; }
          table { font-size: 12px; }
          th, td { padding: 7px 8px !important; white-space: nowrap; }
          input[type=number] { width: 58px !important; font-size: 12px !important; }
          textarea { font-size: 13px !important; }
        }
      `}</style>

      {/* ===== HEADER ===== */}
      <header style={{ background: C.iron, position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isMobile && <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: C.fog, fontSize: 16, cursor: 'pointer', padding: 4, opacity: 0.6 }}>☰</button>}
            <div style={{ width: 3, height: 20, background: C.gold, borderRadius: 1 }} />
            <span style={{ ...font(800, isMobile ? 16 : 18), color: C.gold, letterSpacing: '-0.02em' }}>統包先生</span>
            {!isMobile && <span style={{ ...font(600, 10), color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>WEEKLY MEETING</span>}
          </div>
          {isMobile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...bodyFont(500, 11), color: 'rgba(255,255,255,0.25)' }}>{new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}</span>
              <button onClick={logout} style={{ ...font(600, 10), padding: '4px 10px', borderRadius: 3, border: `1px solid ${C.ironMid}`, cursor: 'pointer', background: 'none', color: 'rgba(255,255,255,0.35)' }}>登出</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isAdmin && (
                <button onClick={() => { setView('dashboard'); setActiveNav('dashboard'); }} style={{
                  ...font(view === 'dashboard' ? 700 : 600, 12), padding: '5px 14px', borderRadius: 3, border: 'none', cursor: 'pointer', marginRight: 4,
                  background: view === 'dashboard' ? C.gold : 'rgba(249,185,27,0.1)', color: view === 'dashboard' ? C.iron : C.gold,
                }}>◆ 全區總覽</button>
              )}
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', marginRight: 2 }} />
              {allowedRegions.map(r => (
                <button key={r} onClick={() => { setRegion(r); if (view !== 'meeting') { setView('meeting'); setActiveNav('cases'); } }} style={{
                  ...font(r === region && view === 'meeting' ? 700 : 500, 12), padding: '5px 14px', borderRadius: 3, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                  background: r === region && view === 'meeting' ? C.gold : 'transparent', color: r === region && view === 'meeting' ? C.iron : 'rgba(255,255,255,0.4)',
                }}>{r}</button>
              ))}
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
              <span style={{ ...bodyFont(500, 11), color: 'rgba(255,255,255,0.25)' }}>{new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}</span>
              <button onClick={logout} style={{ ...font(600, 10), padding: '4px 10px', borderRadius: 3, border: `1px solid ${C.ironMid}`, cursor: 'pointer', background: 'none', color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>{auth.name} · 登出</button>
              {isAdmin && (
                <button onClick={() => setView('accounts')} title="帳號管理" style={{ ...font(600, 14), padding: '4px 8px', borderRadius: 3, border: `1px solid ${view === 'accounts' ? C.gold : C.ironMid}`, cursor: 'pointer', background: view === 'accounts' ? 'rgba(249,185,27,0.15)' : 'none', color: view === 'accounts' ? C.gold : 'rgba(255,255,255,0.4)', marginLeft: 2 }}>⚙</button>
              )}
            </div>
          )}
        </div>
        {isMobile && (
          <div className="mobile-region-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 16px 10px', borderTop: `1px solid ${C.ironMid}` }}>
            {isAdmin && (
              <button onClick={() => { setView('dashboard'); setActiveNav('dashboard'); }} style={{
                ...font(view === 'dashboard' ? 700 : 500, 13), padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
                background: view === 'dashboard' ? C.gold : 'rgba(249,185,27,0.15)', color: view === 'dashboard' ? C.iron : C.gold,
              }}>◆ 總覽</button>
            )}
            {allowedRegions.map(r => (
              <button key={r} onClick={() => { setRegion(r); if (view !== 'meeting') { setView('meeting'); setActiveNav('cases'); } }} style={{
                ...font(r === region && view === 'meeting' ? 700 : 500, 13), padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
                background: r === region && view === 'meeting' ? C.gold : 'rgba(255,255,255,0.08)', color: r === region && view === 'meeting' ? C.iron : 'rgba(255,255,255,0.65)',
              }}>{r}</button>
            ))}
          </div>
        )}
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* ===== SIDEBAR ===== */}
        {!isMobile && <nav style={{ width: sideW, minWidth: sideW, background: C.iron, padding: '8px 0', position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto', transition: 'all 0.2s', borderRight: `1px solid ${C.ironMid}` }}>
          {NAV.filter(n => n.id !== 'dashboard').map((n, idx) => {
            const active = activeNav === n.id;
            return (
              <button key={n.id} onClick={() => scrollTo(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: collapsed ? '12px 0' : '10px 16px',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s', justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? 'rgba(249,185,27,0.12)' : 'transparent',
                borderLeft: active ? `3px solid ${C.gold}` : '3px solid transparent',
              }}>
                <span style={{ ...font(600, 10), color: active ? C.gold : 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', minWidth: 20, textAlign: 'center' }}>{n.icon}</span>
                {!collapsed && <span style={{ ...bodyFont(active ? 700 : 500, 12), color: active ? C.gold : 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{n.label}</span>}
              </button>
            );
          })}
        </nav>}

        {/* ===== MAIN ===== */}
        <main style={{ flex: 1, padding: isMobile ? '16px 12px' : '28px 32px', paddingBottom: isMobile ? 76 : undefined, overflowX: 'hidden' }}>
          {view === 'dashboard' ? <Dashboard data={allData} onAllDataRefresh={() => fetch('/api/allregions').then(r => r.json()).then(setAllData).catch(() => {})} /> : view === 'accounts' ? <AccountsPage auth={auth} /> : loading ? (
            <div style={{ ...bodyFont(500, 14), textAlign: 'center', padding: 80, color: C.steel }}>載入中...</div>
          ) : (
            <>
              {/* 01 案件統計 */}
              <Block id="cases" num="01" title="當月案件統計" sub="業務異常追蹤 · 設計業務部">
                <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                  <Metric label="案件總數" value={stats.total || 0} /><Metric label="接洽中" value={cases.length} />
                  <Metric label="異常" value={abnormal.length} highlight={abnormal.length > 0} />
                </div>
                {(statusChart.length > 0 || typeChart.length > 0) && (
                  <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                    {statusChart.length > 0 && (<div style={{ flex: '1 1 300px', background: C.stone, borderRadius: 4, padding: 16 }}>
                      <div style={{ ...font(700, 9), letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, marginBottom: 8 }}>狀態分布</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart><Pie data={statusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={28} paddingAngle={2} strokeWidth={0}>
                          {statusChart.map((_, i) => <Cell key={i} fill={CHART_C[i % CHART_C.length]} />)}
                        </Pie><Tooltip /><Legend iconSize={8} wrapperStyle={bodyFont(500, 11)} formatter={(v, e) => `${v} (${e.payload.value})`} /></PieChart>
                      </ResponsiveContainer></div>)}
                    {typeChart.length > 0 && (<div style={{ flex: '1 1 300px', background: C.stone, borderRadius: 4, padding: 16 }}>
                      <div style={{ ...font(700, 9), letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, marginBottom: 8 }}>類型分布</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart><Pie data={typeChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={28} paddingAngle={2} strokeWidth={0}>
                          {typeChart.map((_, i) => <Cell key={i} fill={CHART_C[i % CHART_C.length]} />)}
                        </Pie><Tooltip /><Legend iconSize={8} wrapperStyle={bodyFont(500, 11)} formatter={(v, e) => `${v} (${e.payload.value})`} /></PieChart>
                      </ResponsiveContainer></div>)}
                  </div>
                )}
                {abnormal.length === 0 ? <div style={{ ...bodyFont(500, 13), padding: 24, textAlign: 'center', color: C.moss, background: C.mossLight, borderRadius: 4 }}>目前沒有異常案件</div> : (
                  <div style={{ overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['#','月份','地址','業主','類型','預算','設計師','狀態','異常','備註',''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
                    <tbody>{abnormal.map((c, i) => {
                      const caseId = c.id || c.address;
                      return (
                        <React.Fragment key={i}>
                          <TR onClick={() => c.notes && setExpanded(expanded === i ? null : i)}>
                            <TD style={font(700, 13)}>{i + 1}</TD><TD style={{ whiteSpace: 'nowrap' }}>{c.fillMonth}</TD><TD style={{ maxWidth: 180 }}>{c.address}</TD>
                            <TD style={{ fontWeight: 700 }}>{c.customer}</TD><TD>{c.caseType}</TD><TD>{c.budget}</TD><TD>{c.contact}</TD>
                            <TD><Badge status={c.status} /></TD><TD><Abnormal text={c.abnormal} /></TD>
                            <TD onClick={e => e.stopPropagation()}>
                              <textarea defaultValue={caseNotes[caseId] || ''} placeholder="備註..."
                                ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                onBlur={e => saveCaseNote(caseId, e.target.value)}
                                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                rows={1}
                                style={{ width: 160, ...bodyFont(400, 12), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '3px 7px', background: C.bone, resize: 'none', minHeight: 26, lineHeight: 1.4, fontFamily: 'inherit', verticalAlign: 'middle', overflow: 'hidden' }} />
                            </TD>
                            <TD style={{ ...font(700, 11), color: C.darkGold }}>{c.notes ? (expanded === i ? '▲' : '▼') : ''}</TD>
                          </TR>
                          {expanded === i && c.notes && <tr><td colSpan={11} style={{ ...bodyFont(400, 12), padding: '14px 24px', background: C.warmCream, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{c.notes}</td></tr>}
                        </React.Fragment>
                      );
                    })}</tbody></table></div>
                )}
              </Block>

              {/* 02 工程進度 */}
              <Block id="projects" num="02" title="施工中工程統計" sub="工務服務部">
                <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, flex: '1 1 400px', flexWrap: 'wrap' }}>
                    <Metric label="施工中" value={working} /><Metric label="待驗收" value={pending} /><Metric label="待開工" value={waiting} />
                    <Metric label="逾期" value={overdue} highlight={overdue > 0} />
                    <Metric label="異常" value={abnormalCount} highlight={abnormalCount > 0} />
                    <Metric label="合計" value={p.length} />
                  </div>
                  {projChart.length > 0 && <div style={{ flex: '0 0 180px', background: C.stone, borderRadius: 4, padding: 12 }}>
                    <ResponsiveContainer width={160} height={130}>
                      <PieChart><Pie data={projChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={22} paddingAngle={3} strokeWidth={0}>
                        {projChart.map((_, i) => <Cell key={i} fill={CHART_C[i]} />)}
                      </Pie><Tooltip /></PieChart>
                    </ResponsiveContainer></div>}
                </div>
                {p.length === 0 ? <div style={{ ...bodyFont(500, 13), padding: 24, textAlign: 'center', color: C.steel, background: C.stone, borderRadius: 4 }}>無工程資料</div> : (
                  <div style={{ overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['案號','狀態','地址','工務','開工','完工','展延','剩餘','進度','備註','異常'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
                    <tbody>{p.map((x, i) => {
                      const pn = projectNotes[x.caseNo] || {};
                      return (
                        <TR key={i}>
                          <TD style={{ ...font(700, 13), color: C.darkGold }}>{x.caseNo}</TD>
                          <TD><Badge status={x.status} /></TD>
                          <TD style={{ maxWidth: 220, lineHeight: 1.5 }}>{x.address}</TD>
                          <TD>{x.supervisor}</TD>
                          <TD style={font(400, 12)}>{x.startDate}</TD>
                          <TD style={font(400, 12)}>{x.endDate}</TD>
                          <TD style={font(400, 12)}>{x.delayDays}</TD>
                          <TD><Days days={x.remainDays} /></TD>
                          <TD style={{ fontSize: 12 }}>{x.progress}</TD>
                          <TD>
                            <textarea
                              value={noteInputs[x.caseNo] ?? (pn.note || '')}
                              placeholder="備註..."
                              ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                              onChange={e => { setNoteInputs(prev => ({ ...prev, [x.caseNo]: e.target.value })); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                              onBlur={e => saveProjectNote(x.caseNo, e.target.value, !!pn.is_abnormal)}
                              rows={1}
                              style={{ width: 160, ...bodyFont(400, 12), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '3px 7px', background: C.bone, resize: 'none', minHeight: 26, lineHeight: 1.4, fontFamily: 'inherit', verticalAlign: 'middle', overflow: 'hidden' }} />
                          </TD>
                          <TD style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={!!pn.is_abnormal}
                              onChange={e => saveProjectNote(x.caseNo, noteInputs[x.caseNo] ?? (pn.note || ''), e.target.checked)}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.rust }} />
                          </TD>
                        </TR>
                      );
                    })}</tbody></table></div>
                )}
              </Block>

              {/* 03 請款 */}
              <Block id="payment" num="03" title="當月請款進度" sub="設計業務部 · 工務服務部" gold>
                {(() => {
                  const paymentCases = p.filter(x => ['施工中', '待驗收', '待開工'].includes(x.status));
                  if (paymentCases.length === 0) return <div style={{ ...bodyFont(500, 13), padding: 24, textAlign: 'center', color: C.steel, background: C.stone, borderRadius: 4 }}>無請款資料</div>;
                  let abnormalCount = 0, totalReceivable = 0, totalReceived = 0;
                  paymentCases.forEach(x => {
                    const pr = paymentRec[x.caseNo] || {};
                    const cAmt = parseInt(pr.contract_amount) || 0;
                    const aAmt = parseInt(pr.additional_amount) || 0;
                    totalReceivable += cAmt + aAmt;
                    if (pr.contract_status === '已收款') totalReceived += cAmt;
                    if (pr.additional_status === '已收款') totalReceived += aAmt;
                    if (pr.contract_status === '收款異常' || pr.additional_status === '收款異常') abnormalCount++;
                  });
                  const STATUS_OPTS = ['已收款', '時間未到', '收款異常'];
                  return (
                    <>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                        {[
                          { label: '異常數量', value: abnormalCount, highlight: abnormalCount > 0 },
                          { label: '應收款金額', value: totalReceivable.toLocaleString() },
                          { label: '已收款金額', value: totalReceived.toLocaleString() },
                          { label: '未收款金額', value: (totalReceivable - totalReceived).toLocaleString(), highlight: totalReceivable > totalReceived },
                        ].map(m => <Metric key={m.label} {...m} />)}
                      </div>
                      <div style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr>{['案號','狀態','地址','設計師','合約金額','請款金額(合約)','是否收款','請款金額(追加)','是否收款','備註',''].map((h,i) => <TH key={i}>{h}</TH>)}</tr></thead>
                          <tbody>{paymentCases.map((x, i) => {
                            const pr = paymentRec[x.caseNo] || {};
                            const draft = paymentEdit[x.caseNo] || {};
                            const isDirty = Object.keys(draft).length > 0;
                            const get = (field, fallback = '') => draft[field] !== undefined ? draft[field] : (pr[field] !== undefined ? pr[field] : fallback);
                            const contractStatus = get('contract_status', '時間未到');
                            const additionalStatus = get('additional_status', '時間未到');
                            const selStyle = (val) => ({ ...font(600, 11), border: `1px solid ${isDirty ? C.gold : C.ash}`, borderRadius: 3, padding: '4px 6px', background: val === '已收款' ? C.mossLight : val === '收款異常' ? C.rustLight : C.bone, color: val === '已收款' ? C.moss : val === '收款異常' ? C.rust : C.steel, cursor: 'pointer' });
                            const inputStyle = { width: 150, ...font(600, 13), border: `1px solid ${isDirty ? C.gold : C.ash}`, borderRadius: 3, padding: '4px 8px', background: isDirty ? C.warmCream : C.bone };
                            return <TR key={i}>
                              <TD style={{ ...font(700, 13), color: C.darkGold }}>{x.caseNo}</TD>
                              <TD><Badge status={x.status} /></TD>
                              <TD style={{ maxWidth: 160, lineHeight: 1.5 }}>{x.address}</TD>
                              <TD>{x.designer}</TD>
                              <TD style={font(800, 14)}>{x.contractAmount}</TD>
                              <TD><input type="number" value={get('contract_amount', '')} placeholder="0" onChange={e => setPaymentDraft(x.caseNo, 'contract_amount', e.target.value)} onWheel={e => e.target.blur()} style={inputStyle} /></TD>
                              <TD><select value={contractStatus} onChange={e => setPaymentDraft(x.caseNo, 'contract_status', e.target.value)} style={selStyle(contractStatus)}>{STATUS_OPTS.map(o => <option key={o} value={o}>{o}</option>)}</select></TD>
                              <TD><input type="number" value={get('additional_amount', '')} placeholder="0" onChange={e => setPaymentDraft(x.caseNo, 'additional_amount', e.target.value)} onWheel={e => e.target.blur()} style={inputStyle} /></TD>
                              <TD><select value={additionalStatus} onChange={e => setPaymentDraft(x.caseNo, 'additional_status', e.target.value)} style={selStyle(additionalStatus)}>{STATUS_OPTS.map(o => <option key={o} value={o}>{o}</option>)}</select></TD>
                              <TD><textarea value={get('abnormal_note', '')} placeholder="備註" ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }} onChange={e => { setPaymentDraft(x.caseNo, 'abnormal_note', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} rows={1} style={{ width: 160, ...font(600, 12), border: `1px solid ${isDirty ? C.gold : C.ash}`, borderRadius: 3, padding: '4px 8px', background: isDirty ? C.warmCream : C.bone, resize: 'none', minHeight: 28, lineHeight: 1.4, fontFamily: 'inherit', verticalAlign: 'middle', overflow: 'hidden' }} /></TD>
                              <TD>{isDirty ? <button onClick={() => savePayment(x.caseNo, x.address)} style={{ ...font(700, 11), padding: '4px 12px', borderRadius: 3, border: 'none', cursor: 'pointer', background: C.gold, color: C.iron, whiteSpace: 'nowrap' }}>儲存</button> : <span style={{ ...font(500, 11), color: C.fog }}>已存</span>}</TD>
                            </TR>;
                          })}</tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
              </Block>

              {/* 04 客戶·廠商·支援 */}
              {(() => {
                const NOTE_STATUS = { '未處理': { bg: C.rustLight, c: C.rust }, '處理中': { bg: C.emberLight, c: C.ember }, '已處理': { bg: C.mossLight, c: C.moss } };
                const cats = [{ t: '客戶回饋', n: '04-A' }, { t: '廠商狀況', n: '04-B' }, { t: '支援項目', n: '04-C' }];
                return (
                  <div id="feedback" style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', scrollMarginTop: 64 }}>
                    {cats.map(s => {
                      const catNotes = notes.filter(n => n.category === s.t);
                      const done = catNotes.filter(n => n.status === '已處理').length;
                      const inProg = catNotes.filter(n => n.status === '處理中').length;
                      const todo = catNotes.filter(n => n.status === '未處理').length;
                      return (
                        <div key={s.t} style={{ flex: '1 1 280px', borderRadius: 4, overflow: 'hidden', background: C.bone }}>
                          <div style={{ padding: '14px 20px', background: C.iron, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ ...font(600, 9), color: C.gold, opacity: 0.5, letterSpacing: '0.08em' }}>{s.n}</span>
                            <span style={{ ...font(700, 13), color: '#fff', flex: 1 }}>{s.t}</span>
                            <span style={{ ...font(700, 10), color: C.fog }}>{catNotes.length} 項</span>
                          </div>
                          <div style={{ padding: '12px 16px', display: 'flex', gap: 8, borderBottom: `1px solid ${C.ash}` }}>
                            {[['總量', catNotes.length, C.iron], ['已處理', done, C.moss], ['處理中', inProg, C.ember], ['未處理', todo, C.rust]].map(([label, val, color]) => (
                              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ ...font(700, 8), letterSpacing: '0.08em', color: C.steel, textTransform: 'uppercase' }}>{label}</div>
                                <div style={{ ...font(800, 20), color, marginTop: 4 }}>{val}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ padding: '10px 16px', maxHeight: 220, overflowY: 'auto' }}>
                            {catNotes.length === 0 && <div style={{ ...bodyFont(400, 12), color: C.fog, padding: '8px 0' }}>尚無紀錄</div>}
                            {catNotes.map(n => (
                              <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.stone}` }}>
                                <button onClick={() => cycleStatus(n)} style={{ ...font(700, 9), padding: '2px 7px', borderRadius: 2, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: (NOTE_STATUS[n.status] || NOTE_STATUS['未處理']).bg, color: (NOTE_STATUS[n.status] || NOTE_STATUS['未處理']).c }}>{n.status}</button>
                                <span style={{ ...bodyFont(400, 12), color: C.iron, flex: 1, lineHeight: 1.6 }}>{n.content}</span>
                                <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', color: C.fog, cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>×</button>
                              </div>
                            ))}
                          </div>
                          <div style={{ padding: '10px 16px', display: 'flex', gap: 8, borderTop: `1px solid ${C.ash}` }}>
                            <textarea rows={1} value={noteInput[s.t] || ''} onChange={e => setNoteInput(prev => ({ ...prev, [s.t]: e.target.value }))}
                              placeholder="新增紀錄..." style={{ flex: 1, ...bodyFont(400, 12), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '6px 10px', resize: 'none', background: C.stone }} />
                            <button onClick={() => addNote(s.t, noteInput[s.t] || '')} style={{ ...font(700, 12), padding: '6px 14px', borderRadius: 3, border: 'none', cursor: 'pointer', background: C.gold, color: C.iron }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* 05 預計簽約 */}
              <Block id="expected" num="05" title="預計簽約" sub="設計業務部">
                {/* 統計指標 */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  <Metric label="預計件數" value={`${expectedSigns.length}件`} />
                  <Metric label="合計金額" value={`${expectedSigns.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)}萬`} highlight />
                </div>

                {/* 清單 */}
                {expectedSigns.length > 0 && (
                  <div style={{ overflow: 'auto', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['#', '工程地址', '報價金額(萬)', '預計簽約日', '備註', ''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
                      <tbody>
                        {expectedSigns.map((s, i) => (
                          <TR key={s.id}>
                            <TD style={font(700, 13)}>{i + 1}</TD>
                            <TD style={{ maxWidth: 220, lineHeight: 1.5 }}>{s.address}</TD>
                            <TD style={{ ...font(800, 15), color: C.darkGold }}>{s.amount ? `${s.amount}萬` : '—'}</TD>
                            <TD style={font(400, 12)}>{s.expected_date || '—'}</TD>
                            <TD style={{ color: C.steel, fontSize: 12, maxWidth: 160 }}>{s.note}</TD>
                            <TD><button onClick={() => deleteExpected(s.id)} style={{ background: 'none', border: 'none', color: C.fog, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button></TD>
                          </TR>
                        ))}
                        <tr style={{ background: C.paleGold }}>
                          <td colSpan={2} style={{ ...font(800, 13), padding: '10px 12px', color: C.iron }}>合計</td>
                          <td style={{ ...font(800, 16), padding: '10px 12px', color: C.darkGold }}>{expectedSigns.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)}萬</td>
                          <td colSpan={3} style={{ padding: '10px 12px' }} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 新增表單 */}
                <div style={{ background: C.stone, borderRadius: 4, padding: 16 }}>
                  <div style={{ ...font(700, 10), letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, marginBottom: 10 }}>新增預計簽約</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input placeholder="工程地址 *" value={signInput.address} onChange={e => setSignInput(p => ({ ...p, address: e.target.value }))}
                      style={{ flex: '2 1 160px', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '7px 10px', background: C.bone }} />
                    <input placeholder="報價金額(萬)" value={signInput.amount} onChange={e => setSignInput(p => ({ ...p, amount: e.target.value }))}
                      style={{ flex: '1 1 90px', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '7px 10px', background: C.bone }} />
                    <input placeholder="預計簽約日" value={signInput.expected_date} onChange={e => setSignInput(p => ({ ...p, expected_date: e.target.value }))}
                      style={{ flex: '1 1 100px', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '7px 10px', background: C.bone }} />
                    <input placeholder="備註" value={signInput.note} onChange={e => setSignInput(p => ({ ...p, note: e.target.value }))}
                      style={{ flex: '2 1 140px', ...bodyFont(400, 13), border: `1px solid ${C.ash}`, borderRadius: 3, padding: '7px 10px', background: C.bone }} />
                    <button onClick={addExpected} style={{ ...font(700, 13), padding: '7px 20px', borderRadius: 3, border: 'none', cursor: 'pointer', background: C.gold, color: C.iron, flexShrink: 0 }}>+ 新增</button>
                  </div>
                </div>
              </Block>

              {/* 06 營運數據 */}
              <Block id="performance" num="06" title="營運數據" sub="年度目標 · 店內數據 · 營業額統計" gold>
                  {data?.shopData && (<div style={{ marginBottom: 24 }}>
                    <div style={{ ...font(700, 9), letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, marginBottom: 10 }}>店內數據</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Metric label="簽約率" value={data.shopData.signRate} /><Metric label="當月業績" value={data.shopData.monthRevenue} />
                      <Metric label="當月達成率" value={data.shopData.monthRate} /><Metric label="累積營業額" value={data.shopData.totalRevenue} highlight />
                      <Metric label="累積達成率" value={data.shopData.totalRate} />
                    </div></div>)}

                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
                    {(() => {
                      const yt = data?.yearTarget;
                      const at = annualTarget;
                      if (!yt && !at) return null;
                      const milestoneRev = at?.milestone_revenue || yt?.milestone?.revenue || '';
                      const milestoneRate = at?.milestone_sign_rate || yt?.milestone?.signRate || '';
                      return (
                        <div style={{ flex: '1 1 340px' }}>
                          <div style={{ ...font(700, 9), letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, marginBottom: 10 }}>年度目標</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr><TH /><TH>營業額(萬)</TH><TH>簽約率</TH></tr></thead>
                            <tbody>
                              <TR>
                                <TD style={{ ...font(800, 13), color: C.darkGold }}>里程碑</TD>
                                <TD style={font(800, 18)}>{milestoneRev ? `${milestoneRev}萬` : '—'}</TD>
                                <TD style={font(600, 13)}>{milestoneRate || '—'}</TD>
                              </TR>
                              {yt && [{ l: '實際現狀', d: yt.actual, c: C.moss }, { l: '差異數', d: yt.diff, c: C.rust }, { l: '每月須達成', d: yt.monthlyTarget, c: C.ember }].map(r => (
                                <TR key={r.l}><TD style={{ ...font(800, 13), color: r.c }}>{r.l}</TD><TD style={font(800, 18)}>{r.d.revenue}</TD><TD style={font(600, 13)}>{r.d.signRate}</TD></TR>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                    {revChart.length > 0 && (<div style={{ flex: '1 1 380px' }}>
                      <div style={{ ...font(700, 9), letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, marginBottom: 10 }}>營業額統計</div>
                      <div style={{ background: C.stone, borderRadius: 4, padding: 16 }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={revChart} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                            <XAxis dataKey="month" tick={{ ...font(400, 9) }} /><YAxis tick={{ ...font(400, 9) }} /><Tooltip content={<ChartTip />} />
                            <Bar dataKey="營業額" radius={[3, 3, 0, 0]}>{revChart.map((e, i) => <Cell key={i} fill={e.營業額 > 0 ? C.gold : C.ash} />)}</Bar>
                          </BarChart></ResponsiveContainer></div></div>)}
                  </div>

                  {data?.signRateData?.signRate && (<div>
                    <div style={{ ...font(700, 9), letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, marginBottom: 10 }}>簽約率統計</div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                      <Metric label="案件總數" value={data.signRateData.totalCases} /><Metric label="總簽約數" value={data.signRateData.totalSigned} /><Metric label="簽約率" value={data.signRateData.signRate} highlight />
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 280px', overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>{['姓名','案件','簽約','簽約率'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
                        <tbody>
                          {data.signRateData.byPerson.map((x, i) => <TR key={i}><TD style={{ fontWeight: 700 }}>{x.name}</TD><TD>{x.cases}</TD><TD style={{ ...font(700), color: C.moss }}>{x.signed}</TD><TD style={{ ...font(800, 15), color: C.darkGold }}>{x.rate}</TD></TR>)}
                          <tr style={{ background: C.paleGold }}><TD style={font(800)}>總和</TD><TD style={{ fontWeight: 700 }}>{data.signRateData.totalCases}</TD><TD style={{ ...font(700), color: C.moss }}>{data.signRateData.totalSigned}</TD><TD style={{ ...font(800, 15), color: C.darkGold }}>{data.signRateData.signRate}</TD></tr>
                        </tbody></table></div>
                      <div style={{ flex: '1 1 260px', background: C.stone, borderRadius: 4, padding: 16 }}>
                        <ResponsiveContainer width="100%" height={Math.max(200, data.signRateData.byPerson.length * 36)}>
                          <BarChart data={data.signRateData.byPerson.map(x => ({ name: x.name, 簽約率: parseInt(x.rate) || 0 }))} layout="vertical" margin={{ left: 0, right: 15 }}>
                            <XAxis type="number" domain={[0, 'auto']} tick={{ ...font(400, 9) }} unit="%" /><YAxis type="category" dataKey="name" tick={{ ...bodyFont(500, 10) }} width={100} />
                            <Tooltip content={<ChartTip />} /><Bar dataKey="簽約率" fill={C.gold} radius={[0, 3, 3, 0]} />
                          </BarChart></ResponsiveContainer></div>
                    </div></div>)}
              </Block>

              {/* 07 員工業績 */}
              {data?.employees?.length > 0 && (
                <Block id="employees" num="07" title="員工業績">
                  {empChart.length > 0 && (<div style={{ background: C.stone, borderRadius: 4, padding: 16, marginBottom: 20 }}>
                    <div style={{ ...font(700, 9), letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, marginBottom: 8 }}>累積業績比較</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={empChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ ...bodyFont(500, 11) }} /><YAxis tick={{ ...font(400, 9) }} /><Tooltip content={<ChartTip />} />
                        <Bar dataKey="業績" fill={C.gold} radius={[3, 3, 0, 0]} />
                      </BarChart></ResponsiveContainer></div>)}
                  <div style={{ overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['姓名','現況','簽約率','當月業績','當月業績達成率','累積業績','累積業績達成率'].map((h,i) => <TH key={i}>{h}</TH>)}</tr></thead>
                    <tbody>
                      {data.employees.map((e, i) => <TR key={i}><TD style={{ fontWeight: 700 }}>{e.name}</TD>
                        <TD><span style={{ ...font(700, 9), padding: '2px 8px', borderRadius: 2, background: e.status === '在職' ? C.mossLight : C.stone, color: e.status === '在職' ? C.moss : C.steel }}>{e.status}</span></TD>
                        <TD style={{ ...font(800, 14), color: C.darkGold }}>{e.signRate}</TD><TD style={font(700)}>{e.monthRevenue || '—'}</TD><TD style={font(500, 12)}>{e.monthRate || '—'}</TD>
                        <TD style={font(700)}>{e.totalRevenue || '—'}</TD><TD style={font(500, 12)}>{e.totalRate || '—'}</TD></TR>)}
                      {data.employeeTotal && <tr style={{ background: C.paleGold }}><TD style={font(800)}>合計</TD><TD /><TD style={{ ...font(800), color: C.darkGold }}>{data.employeeTotal.signRate}</TD>
                        <TD style={font(800)}>{data.employeeTotal.monthRevenue}</TD><TD style={font(600, 12)}>{data.employeeTotal.monthRate}</TD>
                        <TD style={font(800)}>{data.employeeTotal.totalRevenue}</TD><TD style={font(600, 12)}>{data.employeeTotal.totalRate}</TD></tr>}
                    </tbody></table></div>
                </Block>
              )}
            </>
          )}
        </main>
      </div>

      {/* ===== MOBILE BOTTOM NAV ===== */}
      {isMobile && (
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.iron, borderTop: `2px solid ${C.ironMid}`, display: 'flex', zIndex: 300, height: 60 }}>
          {NAV.filter(n => n.id !== 'dashboard' || isAdmin).map(n => {
            const isActive = activeNav === n.id;
            return (
              <button key={n.id} onClick={() => scrollTo(n.id)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                border: 'none', cursor: 'pointer', background: 'transparent', padding: '6px 0',
                borderTop: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
              }}>
                <span style={{ ...font(isActive ? 700 : 600, 11), color: isActive ? C.gold : 'rgba(255,255,255,0.3)' }}>{n.icon}</span>
                <span style={{ ...bodyFont(isActive ? 700 : 500, 8), color: isActive ? C.gold : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{n.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
