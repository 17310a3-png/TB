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
  return <span style={{ ...font(700, 10), padding: '3px 10px', borderRadius: 2, background: s.bg, color: s.c, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{status}</span>;
};

const Abnormal = ({ text }) => text ? <span style={{ ...font(700, 9), padding: '3px 8px', borderRadius: 2, background: C.rustLight, color: C.rust, letterSpacing: '0.04em' }}>{text}</span> : null;

const Days = ({ days }) => {
  if (!days || ['完工', '資料不齊全', '還沒開工'].includes(days)) return <span style={{ ...font(500, 13), color: C.fog }}>{days || '—'}</span>;
  const n = parseInt(days); if (isNaN(n)) return <span style={font(500, 13)}>{days}</span>;
  const color = n < 0 ? C.rust : n <= 14 ? C.ember : C.darkGold;
  return <span style={{ ...font(800, 16), color, letterSpacing: '-0.03em' }}>{n < 0 ? `–${Math.abs(n)}` : n}<span style={{ ...font(600, 9), marginLeft: 2, opacity: 0.6 }}>天</span></span>;
};

const Metric = ({ label, value, highlight, large }) => (
  <div style={{ padding: large ? '24px 28px' : '16px 20px', background: highlight ? `linear-gradient(135deg, ${C.iron} 0%, ${C.ironMid} 100%)` : C.bone, borderRadius: 4, flex: '1 1 140px', minWidth: 130, position: 'relative', overflow: 'hidden' }}>
    {highlight && <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, background: C.gold, opacity: 0.15, borderRadius: '0 0 0 60px' }} />}
    <div style={{ ...font(700, 9), letterSpacing: '0.12em', textTransform: 'uppercase', color: highlight ? C.fog : C.steel, marginBottom: 6 }}>{label}</div>
    <div style={{ ...font(800, large ? 36 : 28), letterSpacing: '-0.03em', color: highlight ? C.gold : C.iron, lineHeight: 1 }}>{value}</div>
  </div>
);

const Block = ({ id, num, title, sub, gold, children }) => (
  <div id={id} style={{ marginBottom: 32, borderRadius: 4, overflow: 'hidden', background: C.bone, scrollMarginTop: 64, ...fadeIn }}>
    <div style={{ padding: '18px 28px', background: gold ? `linear-gradient(135deg, ${C.darkGold}, ${C.gold})` : C.iron, display: 'flex', alignItems: 'center', gap: 14 }}>
      {num && <span style={{ ...font(800, 11), color: gold ? C.iron : C.gold, opacity: 0.5, letterSpacing: '0.1em' }}>{num}</span>}
      <div>
        <div style={{ ...font(700, 15), color: gold ? C.iron : '#fff', letterSpacing: '-0.01em' }}>{title}</div>
        {sub && <div style={{ ...bodyFont(500, 11), color: gold ? 'rgba(28,27,27,0.5)' : 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
    <div style={{ padding: '24px 28px' }}>{children}</div>
  </div>
);

const TH = ({ children }) => <th style={{ ...font(700, 9), padding: '10px 12px', textAlign: 'left', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, background: C.stone }}>{children}</th>;
const TD = ({ children, style: s }) => <td style={{ ...bodyFont(400, 13), padding: '10px 12px', color: C.iron, borderBottom: `1px solid ${C.ash}`, ...s }}>{children}</td>;
const TR = ({ children, onClick }) => <tr style={{ cursor: onClick ? 'pointer' : 'default', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = C.stone} onMouseLeave={e => e.currentTarget.style.background = ''} onClick={onClick}>{children}</tr>;

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div style={{ ...font(600, 12), background: C.iron, color: '#fff', padding: '8px 14px', borderRadius: 3, border: `1px solid ${C.ironMid}` }}><div style={{ color: C.fog, fontSize: 10 }}>{label}</div><div style={{ color: C.gold, fontSize: 15, fontWeight: 800, marginTop: 2 }}>{payload[0].value}</div></div>;
};

// ======= DASHBOARD VIEW =======
function Dashboard({ data }) {
  if (!data) return null;
  const { regions, total } = data;
  const active = regions.filter(r => r.milestone > 0 || r.actual > 0);
  const barData = active.map(r => ({ name: r.region, 目標: r.milestone, 業績: r.actual }));
  const rateData = active.map(r => ({ name: r.region, 年度達成率: r.milestone > 0 ? parseFloat((r.actual / r.milestone * 100).toFixed(1)) : 0 }));
  return (
    <div style={fadeIn}>
      <div style={{ ...font(800, 28), color: C.iron, letterSpacing: '-0.02em', marginBottom: 4 }}>全區營運總覽</div>
      <div style={{ ...bodyFont(500, 13), color: C.steel, marginBottom: 28 }}>各門市年度目標達成狀況一覽</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <Metric label="年度目標" value={`${total.milestone}萬`} large />
        <Metric label="累積業績" value={`${total.actual}萬`} highlight large />
        <Metric label="差異" value={`${total.diff}萬`} large />
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><TH>地區</TH><TH>年度目標</TH><TH>累積業績</TH><TH>年度達成率</TH><TH>月累積達成率</TH><TH>簽約率</TH><TH>當月業績</TH><TH>當月達成率</TH></tr></thead>
          <tbody>
            {active.map((r, i) => {
              const yearRate = r.milestone > 0 ? (r.actual / r.milestone * 100).toFixed(1) : 0;
              const monthRate = parseFloat(r.totalRate) || 0;
              return <TR key={i}><TD style={font(700, 14)}>{r.region}</TD><TD style={font(700, 14)}>{r.milestone}萬</TD><TD style={font(700, 14)}>{r.actual}萬</TD>
                <TD><span style={{ ...font(800, 15), color: yearRate >= 50 ? C.moss : yearRate >= 25 ? C.darkGold : C.rust }}>{yearRate}%</span></TD>
                <TD><span style={{ ...font(800, 15), color: monthRate >= 60 ? C.moss : monthRate >= 30 ? C.darkGold : C.rust }}>{r.totalRate}</span></TD>
                <TD style={{ ...font(700, 14), color: C.darkGold }}>{r.signRate || '—'}</TD>
                <TD style={font(600, 13)}>{r.monthRevenue}萬</TD>
                <TD style={{ ...font(600, 13), color: C.steel }}>{r.monthRate}</TD></TR>;
            })}
            <tr style={{ background: C.paleGold }}><TD style={font(800, 14)}>合計</TD><TD style={font(800, 14)}>{total.milestone}萬</TD><TD style={font(800, 14)}>{total.actual}萬</TD>
              <TD style={{ ...font(800, 16), color: C.darkGold }}>{total.milestone > 0 ? (total.actual / total.milestone * 100).toFixed(1) : 0}%</TD>
              <TD style={{ ...font(800, 16), color: C.darkGold }}>{total.totalRate}</TD><TD /><TD style={font(800, 14)}>{total.monthRevenue}萬</TD><TD style={{ ...font(800, 13), color: C.darkGold }}>{total.monthRate}</TD></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ======= MAIN APP =======
export default function App() {
  const [region, setRegion] = useState('台北');
  const [view, setView] = useState('dashboard');
  const [data, setData] = useState(null);
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [perfView, setPerfView] = useState('region');

  useEffect(() => {
    fetch('/api/allregions').then(r => r.json()).then(setAllData).catch(() => {});
  }, []);

  useEffect(() => {
    if (view === 'meeting') {
      setLoading(true); setExpanded(null);
      fetch(`/api/meeting/${encodeURIComponent(region)}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    }
  }, [region, view]);

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

  const p = data?.projects || [], cases = data?.cases || [], abnormal = data?.abnormalCases || [], stats = data?.stats || {};
  const working = p.filter(x => x.status === '施工中').length, pending = p.filter(x => x.status === '待驗收').length;
  const waiting = p.filter(x => x.status === '待開工').length;
  const overdue = p.filter(x => { const n = parseInt(x.remainDays); return !isNaN(n) && n < 0; }).length;
  const byType = {}; cases.forEach(c => { if (c.caseType) byType[c.caseType] = (byType[c.caseType] || 0) + 1; });

  const statusChart = Object.entries(stats.byStatus || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const typeChart = Object.entries(stats.byType || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const projChart = [{ name: '施工中', value: working }, { name: '待驗收', value: pending }, { name: '待開工', value: waiting }, { name: '逾期', value: overdue }].filter(d => d.value > 0);
  const revChart = (data?.revenueStats || []).map(r => ({ month: r.month, 營業額: parseInt(r.amount) || 0 }));
  const empChart = (data?.employees || []).filter(e => e.totalRevenue).map(e => ({ name: e.name, 業績: parseInt(e.totalRevenue) || 0 }));

  const sideW = collapsed ? 52 : 170;

  return (
    <div style={{ minHeight: '100vh', background: C.stone, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        * { margin:0; padding:0; box-sizing:border-box; }
        ::-webkit-scrollbar { width:6px; height:6px; } ::-webkit-scrollbar-thumb { background:${C.fog}; border-radius:3px; }
        table { border-spacing:0; }
      `}</style>

      {/* ===== HEADER ===== */}
      <header style={{ background: C.iron, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: C.fog, fontSize: 16, cursor: 'pointer', padding: 4, opacity: 0.6 }}>☰</button>
          <div style={{ width: 3, height: 20, background: C.gold, borderRadius: 1 }} />
          <span style={{ ...font(800, 18), color: C.gold, letterSpacing: '-0.02em' }}>統包先生</span>
          <span style={{ ...font(600, 10), color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>WEEKLY MEETING</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {REGIONS.map(r => (
            <button key={r} onClick={() => { setRegion(r); if (view !== 'meeting') { setView('meeting'); setActiveNav('cases'); } }} style={{
              ...font(r === region && view === 'meeting' ? 700 : 500, 12), padding: '5px 14px', borderRadius: 3, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: r === region && view === 'meeting' ? C.gold : 'transparent', color: r === region && view === 'meeting' ? C.iron : 'rgba(255,255,255,0.4)',
            }}>{r}</button>
          ))}
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <span style={{ ...bodyFont(500, 11), color: 'rgba(255,255,255,0.25)' }}>{new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}</span>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* ===== SIDEBAR ===== */}
        <nav style={{ width: sideW, minWidth: sideW, background: C.iron, padding: '8px 0', position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto', transition: 'all 0.2s', borderRight: `1px solid ${C.ironMid}` }}>
          {NAV.map((n, idx) => {
            const active = activeNav === n.id;
            const isDash = n.id === 'dashboard';
            return (
              <button key={n.id} onClick={() => scrollTo(n.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: collapsed ? '12px 0' : '10px 16px',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s', justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? 'rgba(249,185,27,0.12)' : 'transparent',
                borderLeft: active ? `3px solid ${C.gold}` : '3px solid transparent',
                marginTop: isDash ? 0 : idx === 1 ? 8 : 0,
                marginBottom: isDash ? 8 : 0,
              }}>
                <span style={{ ...font(isDash ? 700 : 600, isDash ? 14 : 10), color: active ? C.gold : 'rgba(255,255,255,0.3)', letterSpacing: isDash ? 0 : '0.08em', minWidth: 20, textAlign: 'center' }}>{n.icon}</span>
                {!collapsed && <span style={{ ...bodyFont(active ? 700 : 500, 12), color: active ? C.gold : 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{n.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* ===== MAIN ===== */}
        <main style={{ flex: 1, padding: '28px 32px', maxWidth: 1200, overflowX: 'hidden' }}>
          {view === 'dashboard' ? <Dashboard data={allData} /> : loading ? (
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
                    <thead><tr>{['#','月份','地址','業主','類型','預算','設計師','狀態','異常',''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
                    <tbody>{abnormal.map((c, i) => (
                      <React.Fragment key={i}>
                        <TR onClick={() => c.notes && setExpanded(expanded === i ? null : i)}>
                          <TD style={font(700, 13)}>{i + 1}</TD><TD style={{ whiteSpace: 'nowrap' }}>{c.fillMonth}</TD><TD style={{ maxWidth: 180 }}>{c.address}</TD>
                          <TD style={{ fontWeight: 700 }}>{c.customer}</TD><TD>{c.caseType}</TD><TD>{c.budget}</TD><TD>{c.contact}</TD>
                          <TD><Badge status={c.status} /></TD><TD><Abnormal text={c.abnormal} /></TD>
                          <TD style={{ ...font(700, 11), color: C.darkGold }}>{c.notes ? (expanded === i ? '▲' : '▼') : ''}</TD>
                        </TR>
                        {expanded === i && c.notes && <tr><td colSpan={10} style={{ ...bodyFont(400, 12), padding: '14px 24px', background: C.warmCream, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{c.notes}</td></tr>}
                      </React.Fragment>
                    ))}</tbody></table></div>
                )}
              </Block>

              {/* 02 工程進度 */}
              <Block id="projects" num="02" title="施工中工程統計" sub="工務服務部">
                <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, flex: '1 1 400px', flexWrap: 'wrap' }}>
                    <Metric label="施工中" value={working} /><Metric label="待驗收" value={pending} /><Metric label="待開工" value={waiting} />
                    <Metric label="逾期" value={overdue} highlight={overdue > 0} /><Metric label="合計" value={p.length} />
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
                    <thead><tr>{['案號','狀態','地址','工務','開工','完工','展延','剩餘','進度'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
                    <tbody>{p.map((x, i) => <TR key={i}><TD style={{ ...font(700, 13), color: C.darkGold }}>{x.caseNo}</TD><TD><Badge status={x.status} /></TD><TD style={{ maxWidth: 220, lineHeight: 1.5 }}>{x.address}</TD><TD>{x.supervisor}</TD><TD style={font(400, 12)}>{x.startDate}</TD><TD style={font(400, 12)}>{x.endDate}</TD><TD style={font(400, 12)}>{x.delayDays}</TD><TD><Days days={x.remainDays} /></TD><TD style={{ fontSize: 12 }}>{x.progress}</TD></TR>)}</tbody></table></div>
                )}
              </Block>

              {/* 03 請款 */}
              <Block id="payment" num="03" title="當月請款進度" sub="設計業務部 · 工務服務部" gold>
                {p.filter(x => ['施工中', '待驗收', '待開工'].includes(x.status)).length === 0 ? <div style={{ ...bodyFont(500, 13), padding: 24, textAlign: 'center', color: C.steel, background: C.stone, borderRadius: 4 }}>無請款資料</div> : (
                  <div style={{ overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['案號','狀態','地址','設計師','合約金額'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
                    <tbody>{p.filter(x => ['施工中', '待驗收', '待開工'].includes(x.status)).map((x, i) => <TR key={i}><TD style={{ ...font(700, 13), color: C.darkGold }}>{x.caseNo}</TD><TD><Badge status={x.status} /></TD><TD style={{ maxWidth: 220, lineHeight: 1.5 }}>{x.address}</TD><TD>{x.designer}</TD><TD style={font(800, 14)}>{x.contractAmount}</TD></TR>)}</tbody></table></div>
                )}
              </Block>

              {/* 04 客戶·廠商·支援 */}
              <div id="feedback" style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', scrollMarginTop: 64 }}>
                {[{ t: '客戶回饋', n: '04-A' }, { t: '廠商狀況', n: '04-B' }, { t: '支援項目', n: '04-C' }].map(s => (
                  <div key={s.t} style={{ flex: '1 1 260px', borderRadius: 4, overflow: 'hidden', background: C.bone }}>
                    <div style={{ padding: '14px 20px', background: C.iron, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ ...font(600, 9), color: C.gold, opacity: 0.5, letterSpacing: '0.08em' }}>{s.n}</span>
                      <span style={{ ...font(700, 13), color: '#fff' }}>{s.t}</span>
                    </div>
                    <div style={{ padding: '16px 20px', display: 'flex', gap: 8 }}>
                      {['總量', '已處理', '處理中', '未處理'].map(item => (
                        <div key={item} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ ...font(700, 8), letterSpacing: '0.08em', color: C.steel, textTransform: 'uppercase' }}>{item}</div>
                          <div style={{ ...font(800, 20), color: C.iron, marginTop: 4 }}>0</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 05 預計簽約 */}
              <Block id="expected" num="05" title="預計簽約" sub="設計業務部">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Metric label="預計數量" value={data?.expectedSign?.count || '0件'} />
                  <Metric label="預計金額" value={data?.expectedSign?.amount || '0萬'} highlight />
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
                    {data?.yearTarget && (<div style={{ flex: '1 1 340px' }}>
                      <div style={{ ...font(700, 9), letterSpacing: '0.1em', textTransform: 'uppercase', color: C.steel, marginBottom: 10 }}>年度目標</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><TH /><TH>營業額</TH><TH>簽約率</TH></tr></thead>
                        <tbody>{[{ l: '里程碑', d: data.yearTarget.milestone, c: C.darkGold }, { l: '實際現狀', d: data.yearTarget.actual, c: C.moss }, { l: '差異數', d: data.yearTarget.diff, c: C.rust }, { l: '每月須達成', d: data.yearTarget.monthlyTarget, c: C.ember }].map(r => (
                          <TR key={r.l}><TD style={{ ...font(800, 13), color: r.c }}>{r.l}</TD><TD style={font(800, 18)}>{r.d.revenue}</TD><TD style={font(600, 13)}>{r.d.signRate}</TD></TR>
                        ))}</tbody></table></div>)}
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
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={data.signRateData.byPerson.map(x => ({ name: x.name, 簽約率: parseInt(x.rate) || 0 }))} layout="vertical" margin={{ left: 20, right: 15 }}>
                            <XAxis type="number" domain={[0, 'auto']} tick={{ ...font(400, 9) }} unit="%" /><YAxis type="category" dataKey="name" tick={{ ...bodyFont(500, 11) }} width={85} />
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
                    <thead><tr>{['姓名','現況','簽約率','當月業績','達成率','累積業績','達成率'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
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
    </div>
  );
}
