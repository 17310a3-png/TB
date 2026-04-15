const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');

const app = express();
app.use(cors());

// 日期工具：解析 YYYY/M/D 或 YYYY-M-D，加上 N 工作天（跳過週六日），判斷是否超過
function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/-/g, '/');
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function addWorkingDays(date, days) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) added++;
  }
  return d;
}
function isOverdue(baseStr, workDays) {
  const base = parseDate(baseStr);
  if (!base) return false;
  const due = addWorkingDays(base, workDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today > due;
}

// Supabase helper
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://obgobetnlecbmypvfnsq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iZ29iZXRubGVjYm15cHZmbnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTgwOTEsImV4cCI6MjA5MTc5NDA5MX0.u1sxdWPtGcyGJyKmFIIrmPWVVJ6fZr36DB2sU7rhHRU';
const supaHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function supaGet(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, { headers: supaHeaders });
  return res.json();
}
async function supaUpsert(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...supaHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  return res.json();
}
async function supaInsert(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...supaHeaders, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  return res.json();
}
async function supaPatch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...supaHeaders, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  return res.json();
}
async function supaDelete(table, id) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: supaHeaders });
}

// 快取系統（5 分鐘）
const CACHE_TTL = 5 * 60 * 1000;
const cache = {};
function getCache(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key, data) {
  cache[key] = { data, time: Date.now() };
}

let sheetsClient = null;
async function getSheets() {
  if (!sheetsClient) {
    let authOptions;
    if (process.env.GOOGLE_CREDENTIALS) {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      authOptions = { credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
    } else {
      authOptions = { keyFile: path.join(__dirname, 'key', 'huaaibot-key.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
    }
    const auth = new google.auth.GoogleAuth(authOptions);
    const client = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: client });
  }
  return sheetsClient;
}

const REGIONS = {
  '台北': {
    caseSheet: '125VgLseiFPJGEpNa_9YtkDHbccI83SfoURDP9o0jCT8',
    workSheet: '1opyfWp6KtDmTtjoXTU0QtBi9BsP4xlOs5uYeR41zspA',
    caseTab: '進度統計',
    weeklySheet: '10iIaWkEqjCjT26rcatYd2b0XGhM0X45FC2-BtdPvqD0',
  },
  '台中': {
    caseSheet: '14br_f5FdfPdArlmqKQw8h6FlpAPVglBZ4FN4T6bMyb4',
    workSheet: '1vNB-JtXW65WLP7LcEyo6JFHBPZ4S7M18O5VBAC4Id6I',
    caseTab: '案件追蹤表',
    weeklySheet: '1OxqNikGrbNddFEI8L96qKEnXfEs1Ry3s9DFDsrk_pwE',
  },
  '桃園': {
    caseSheet: '1E1G4qnmS4-VVJaPwWoHXVuXlPadWl5DFZ6J_MhQwD-U',
    workSheet: '1G55jJSUY6eaAP1MtOBTm9xyiJY-NlI_CmjEq6FSHZX8',
    caseTab: '進度統計',
    weeklySheet: '1AtGwkhK2z_pbVzmXtP3NQuoR5l4lzkvaVgvy5BPY_fs',
  },
  '新竹': {
    caseSheet: '1Bf8tEYeyUDUL2caynb5NLF85_1J5H7tv4TxtMvznnxY',
    workSheet: '1--Txe1YbdOHkN3hbqA4VRtWvGQpr_bidfvMA1lJ1aqI',
    caseTab: '進度統計',
    weeklySheet: '1WGbeudud4QnLbZdq_WuOKq81fQAyGKrqIsqnQFxHPPI',
  },
  '龜山': {
    caseSheet: '1VbvliGjs3x4_dwbc4nD6yJJcz0S-ULakgCnj3WiAuqc',
    workSheet: '1UfH1GLJsbrYOg0WuE8OMJulmUrMPc6rLdnCa0OV9c4Y',
    caseTab: '進度統計',
    weeklySheet: '1hFUAlMH42_b9D_5nTsIJXFhMhbN58Ud7ZTkY6VAnytU',
  },
  '框框': {
    caseSheet: '1MLXs8Y5fbV6tbxlFTDxdM5pbovyiMKmxXh6f0UXaVRo',
    workSheet: '1YJ7g1fNq3xp-vsP4x7OtKlW6ICtxxBzHXVdjogStx-Q',
    caseTab: '進度統計',
    weeklySheet: '1GMdAev1ISrLosOz5w_PdvJeo9uugCL8z4klmmr_rq9s',
  },
  '板橋': {
    caseSheet: null,
    workSheet: '1JDC69yUIvXcu-MCO8bQ2MxoUZmxM6YBtTMrPjYd_7HM',
    caseTab: null,
    weeklySheet: null,
  },
  '水湳': {
    caseSheet: '1TAkax9fp3QtEvUkZIhfYSr_cxXM_Lc-0mOt8sn9P6F0',
    workSheet: '1Bnkz8_YOPEDlcdI2swV8x8BQ7CoxKW46U4OsanCTYtY',
    caseTab: '進度統計',
    weeklySheet: '1Z8pjJquW5_UjTS-6rS_5jTqaE9UBaLuewzIYjVvpsGA',
  },
};

app.get('/api/regions', (req, res) => {
  res.json(Object.keys(REGIONS));
});

// ===== 整合 API: 一次取得某地區的完整週會資料 =====
app.get('/api/meeting/:region', async (req, res) => {
  try {
    const region = decodeURIComponent(req.params.region);
    const config = REGIONS[region];
    if (!config) return res.json({ error: '地區不存在' });

    const cached = getCache(`meeting_${region}`);
    if (cached) return res.json(cached);

    const sheets = await getSheets();
    const result = { region };

    // --- 1. 工程工期表 ---
    if (config.workSheet) {
      const workRes = await sheets.spreadsheets.values.get({
        spreadsheetId: config.workSheet,
        range: "'2026'!A4:L100",
      });
      const workRows = (workRes.data.values || []).slice(1);
      result.projects = workRows
        .filter(row => row[0] && row[0] !== 'FALSE' && row[1] && row[1] !== 'FALSE'
          && row[0] !== '已完工' && row[0] !== '完工')
        .map(row => ({
          status: row[0] || '',
          caseNo: row[1] || '',
          address: (row[2] || '').replace(/\n/g, ' '),
          designer: row[3] || '',
          supervisor: row[4] || '',
          contractAmount: row[5] || '',
          startDate: row[6] || '',
          endDate: row[7] || '',
          delayDays: row[8] || '',
          remainDays: row[9] || '',
          progress: row[10] || '',
          scheduleStatus: row[11] || '',
        }));
    } else {
      result.projects = [];
    }

    // --- 2. 案件追蹤表 ---
    if (config.caseSheet) {
      const caseRes = await sheets.spreadsheets.values.get({
        spreadsheetId: config.caseSheet,
        range: `'${config.caseTab}'!A1:Z5000`,
      });
      const caseRows = caseRes.data.values || [];
      if (caseRows.length >= 2) {
        const header = caseRows[0];
        const findCol = (keywords) => header.findIndex(h => h && keywords.some(k => h.includes(k)));

        const colIdx = {
          id: findCol(['項次', '編號', 'a+']),
          address: findCol(['地址', '建案', '基本資訊']),
          customer: findCol(['客戶', '姓名']),
          contact: findCol(['接洽人員']),
          fillMonth: findCol(['填單(月)']),
          fillDate: findCol(['填單日期']),
          caseType: findCol(['案件類型', '屬性']),
          status: findCol(['目前狀態']),
          budget: findCol(['預算']),
          quote: findCol(['報價']),
          contract: findCol(['合約']),
          notes: findCol(['接洽備註']),
          invalid: findCol(['無效填單']),
          measureDate: findCol(['丈量日期']),
          frameDate: findCol(['圖框日期', '圖面完成']),
          planDate: findCol(['平面圖', '平配']),
          quoteDate: findCol(['報價日期', '工程報價']),
          signDate: findCol(['簽約日期']),
        };

        const get = (row, idx) => idx >= 0 ? (row[idx] || '') : '';

        // 所有接洽中案件
        const activeCases = caseRows.slice(1)
          .filter(row => get(row, colIdx.status) === '接洽中')
          .map(row => {
            const fillDate = get(row, colIdx.fillDate);
            const measureDate = get(row, colIdx.measureDate);
            const frameDate = get(row, colIdx.frameDate);
            const planDate = get(row, colIdx.planDate);
            const quoteDate = get(row, colIdx.quoteDate);

            // 判斷異常狀態（依序檢查：到期才算異常）
            // 標準流程：填單 → 丈量(+3) → 圖框(+2) → 平面圖(+2) → 報價(+3)
            // 台中無圖框步驟：填單 → 丈量(+3) → 平面圖(+4) → 報價(+3)
            const hasFrameCol = colIdx.frameDate >= 0;
            let abnormal = '';
            if (!measureDate && isOverdue(fillDate, 3)) {
              abnormal = '丈量未約-異常';
            } else if (hasFrameCol && measureDate && !frameDate && isOverdue(measureDate, 2)) {
              abnormal = '圖框未畫-異常';
            } else if (hasFrameCol && frameDate && !planDate && isOverdue(frameDate, 2)) {
              abnormal = '平面圖未畫-異常';
            } else if (!hasFrameCol && measureDate && !planDate && isOverdue(measureDate, 4)) {
              abnormal = '平面圖未畫-異常';
            } else if (planDate && !quoteDate && isOverdue(planDate, 3)) {
              abnormal = '報價未約-異常';
            }

            return {
              id: get(row, colIdx.id),
              address: get(row, colIdx.address),
              customer: get(row, colIdx.customer),
              contact: get(row, colIdx.contact),
              fillMonth: get(row, colIdx.fillMonth),
              fillDate: get(row, colIdx.fillDate),
              caseType: get(row, colIdx.caseType),
              status: get(row, colIdx.status),
              budget: get(row, colIdx.budget),
              quote: get(row, colIdx.quote),
              contract: get(row, colIdx.contract),
              notes: get(row, colIdx.notes),
              measureDate,
              frameDate,
              planDate,
              quoteDate,
              abnormal,
            };
          });

        result.cases = activeCases;
        result.abnormalCases = activeCases.filter(c => c.abnormal);

        // 案件統計（含無效填單，與線上一致）
        const stats = { total: 0, invalidCount: 0, byStatus: {}, byType: {} };
        caseRows.slice(1).forEach(row => {
          const status = get(row, colIdx.status);
          const type = get(row, colIdx.caseType);
          const invalid = get(row, colIdx.invalid);
          if (!status && !type) return;
          stats.total++;
          if (invalid === 'TRUE') stats.invalidCount++;
          if (status) stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
          if (type) stats.byType[type] = (stats.byType[type] || 0) + 1;
        });
        result.stats = stats;
      } else {
        result.cases = [];
        result.abnormalCases = [];
        result.stats = { total: 0, byStatus: {}, byType: {} };
      }
    } else {
      result.cases = [];
      result.abnormalCases = [];
      result.stats = { total: 0, byStatus: {}, byType: {} };
    }

    // --- 3. 面板資料 (簽約率統計) ---
    if (config.caseSheet) {
      try {
        const panelRes = await sheets.spreadsheets.values.get({
          spreadsheetId: config.caseSheet,
          range: "'面板資料'!A12:Z17",
        });
        const pRows = panelRes.data.values || [];
        // 找到姓名列、案件總數、總簽約數、簽約率
        const nameRow = pRows.find(r => r && r[0] === '姓名') || [];
        const totalRow = pRows.find(r => r && r[0] === '案件總數') || [];
        const signRow = pRows.find(r => r && r[0] === '總簽約數') || [];
        const rateRow = pRows.find(r => r && r[0] === '簽約率') || [];

        // 找「總和」的 index
        const sumIdx = nameRow.findIndex((v, i) => i > 0 && v === '總和');

        result.signRateData = {
          totalCases: sumIdx >= 0 ? (totalRow[sumIdx] || '') : '',
          totalSigned: sumIdx >= 0 ? (signRow[sumIdx] || '') : '',
          signRate: sumIdx >= 0 ? (rateRow[sumIdx] || '') : '',
          byPerson: [],
        };

        // 每位設計師的資料
        if (sumIdx > 0) {
          for (let i = 1; i < sumIdx; i++) {
            const name = nameRow[i] || '';
            if (!name || name.startsWith('第') || name === '#N/A') continue;
            result.signRateData.byPerson.push({
              name,
              cases: totalRow[i] || '',
              signed: signRow[i] || '',
              rate: rateRow[i] || '',
            });
          }
        }
      } catch (e) {
        // 面板資料分頁不存在
      }
    }

    // --- 4. 週會紀錄表: 預計簽約 / 年度目標 (從各區週會紀錄表讀取) ---
    const weeklyId = config.weeklySheet;
    if (weeklyId) {
      try {
        // 讀取會議表單大範圍，動態搜尋關鍵字位置
        const meetingRes = await sheets.spreadsheets.values.get({
          spreadsheetId: weeklyId,
          range: "'會議表單'!A1:R210",
        });
        const allRows = meetingRes.data.values || [];

        // 動態找「預計\n簽約」位置
        const expectedIdx = allRows.findIndex(r => r[0] && r[0].includes('預計') && r[0].includes('簽約'));
        if (expectedIdx >= 0 && allRows[expectedIdx + 1]) {
          result.expectedSign = {
            count: allRows[expectedIdx + 1][1] || '0件',
            amount: allRows[expectedIdx + 1][2] || '0萬',
          };
        }

        // 動態找「年度\n目標」位置
        const targetIdx = allRows.findIndex(r => r[0] && r[0].includes('年度') && r[0].includes('目標'));
        if (targetIdx >= 0) {
          result.yearTarget = {
            milestone: { revenue: allRows[targetIdx + 1]?.[2] || '', signRate: allRows[targetIdx + 1]?.[3] || '' },
            actual: { revenue: allRows[targetIdx + 2]?.[2] || '', signRate: allRows[targetIdx + 2]?.[3] || '' },
            diff: { revenue: allRows[targetIdx + 3]?.[2] || '', signRate: allRows[targetIdx + 3]?.[3] || '' },
            monthlyTarget: { revenue: allRows[targetIdx + 4]?.[2] || '', signRate: allRows[targetIdx + 4]?.[3] || '' },
          };
        }
      } catch (e) {
        console.error('週會紀錄表讀取錯誤:', e.message);
      }
    }
    try {
      // 店內數據 + 營業額統計 從各區業績表合計列讀取

      // 員工業績 (從各區案件追蹤表的業績表讀取)
      if (config.caseSheet) {
        try {
          const perfRes = await sheets.spreadsheets.values.get({
            spreadsheetId: config.caseSheet,
            range: "'業績表'!A1:Z20",
          });
          const perfRows = perfRes.data.values || [];
          // Row 2: 當月預計業績、預計業績
          const targetRow = perfRows[1] || [];
          result.monthlyTarget = targetRow[5] || '';
          result.yearlyTarget = targetRow[6] || '';

          // Row 3 是 header, Row 4+ 是員工資料
          result.employees = perfRows.slice(3)
            .filter(r => r[0] && r[0] !== '總和' && r[0] !== '合計' && !r[0].startsWith('#'))
            .map(r => ({
              name: r[0] || '',
              status: r[1] || '',
              signRate: r[2] || '',
              monthRevenue: r[3] || '',
              monthRate: r[4] || '',
              totalRevenue: r[5] || '',
              totalRate: r[6] || '',
            }));

          // 合計列 -> 店內數據 + 營業額統計
          const totalRow = perfRows.find(r => r[0] === '合計');
          if (totalRow) {
            result.employeeTotal = {
              signRate: totalRow[2] || '',
              monthRevenue: totalRow[3] || '',
              monthRate: totalRow[4] || '',
              totalRevenue: totalRow[5] || '',
              totalRate: totalRow[6] || '',
            };

            // 店內數據 (從合計列 + 里程碑計算達成率)
            const signRateVal = result.signRateData?.signRate || '';
            const milestoneNum = parseInt(result.yearTarget?.milestone?.revenue) || 0;
            const monthlyTarget = milestoneNum / 12;
            const currentMonth = new Date().getMonth() + 1; // 1~12
            const cumulativeTarget = monthlyTarget * currentMonth;
            const monthRevenueNum = parseInt(totalRow[3]) || 0;
            const totalRevenueNum = parseInt(totalRow[5]) || 0;

            const monthRate = monthlyTarget > 0 ? (monthRevenueNum / monthlyTarget * 100).toFixed(2) + '%' : '';
            const totalRate = cumulativeTarget > 0 ? (totalRevenueNum / cumulativeTarget * 100).toFixed(2) + '%' : '';

            result.shopData = {
              signRate: signRateVal,
              monthRevenue: totalRow[3] || '0萬',
              monthRate,
              totalRevenue: totalRow[5] || '0萬',
              totalRate,
            };

            // 營業額統計 (從合計列的月份欄位: col 7,9,11,13,15,17,19,21,23,25 = 1~10月)
            const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
            result.revenueStats = [];
            for (let m = 0; m < 12; m++) {
              const colIdx = 7 + m * 2; // col 7=1月, 9=2月, 11=3月...
              const amount = totalRow[colIdx] || '0萬元';
              result.revenueStats.push({ month: months[m], amount: amount.replace('元', '') });
            }

            // 用業績表合計列的累積業績覆蓋年度目標的「實際現狀」
            const actualRevenue = (totalRow[5] || '').replace('元', '');
            if (result.yearTarget) {
              result.yearTarget.actual.revenue = actualRevenue || '0萬';
              result.yearTarget.actual.signRate = signRateVal || '';
              // 計算差異數
              const msNum = parseInt(result.yearTarget.milestone.revenue) || 0;
              const actNum = parseInt(actualRevenue) || 0;
              if (msNum > 0) {
                result.yearTarget.diff.revenue = (msNum - actNum) + '萬';
                // 每月須達成差異目標
                const remainMonths = 12 - currentMonth;
                if (remainMonths > 0) {
                  result.yearTarget.monthlyTarget.revenue = Math.ceil((msNum - actNum) / remainMonths) + '萬';
                }
              }
            }
          }
        } catch (e) {
          // 業績表不存在
        }
      }
    } catch (e) {
      console.error('週會額外資料錯誤:', e.message);
    }

    setCache(`meeting_${region}`, result);
    res.json(result);
  } catch (err) {
    console.error('會議資料錯誤:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== 全區營運數據統計 =====
app.get('/api/allregions', async (req, res) => {
  try {
    const cached = getCache('allregions');
    if (cached) return res.json(cached);

    const sheets = await getSheets();
    const currentMonth = new Date().getMonth() + 1;

    const allData = await Promise.all(Object.entries(REGIONS).map(async ([regionName, config]) => {
      const entry = { region: regionName, milestone: 0, actual: 0, signRate: '', monthRevenue: 0 };

      await Promise.all([
        // 年度目標 from 週會紀錄表
        config.weeklySheet ? (async () => {
          try {
            const meetingRes = await sheets.spreadsheets.values.get({
              spreadsheetId: config.weeklySheet,
              range: "'會議表單'!A1:R210",
            });
            const allRows = meetingRes.data.values || [];
            const targetIdx = allRows.findIndex(r => r[0] && r[0].includes('年度') && r[0].includes('目標'));
            if (targetIdx >= 0) entry.milestone = parseInt(allRows[targetIdx + 1]?.[2]) || 0;
          } catch (e) {}
        })() : Promise.resolve(),

        // 業績 from 案件追蹤表
        config.caseSheet ? (async () => {
          try {
            const perfRes = await sheets.spreadsheets.values.get({
              spreadsheetId: config.caseSheet,
              range: "'業績表'!A1:Z20",
            });
            const perfRows = perfRes.data.values || [];
            const totalRow = perfRows.find(r => r[0] === '合計');
            if (totalRow) {
              entry.actual = parseInt(totalRow[5]) || 0;
              entry.monthRevenue = parseInt(totalRow[3]) || 0;
              const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
              entry.monthlyRevenue = months.map((month, m) => ({ month, amount: parseInt(totalRow[7 + m * 2]) || 0 }));
            }
          } catch (e) {}

          // 簽約率
          try {
            const panelRes = await sheets.spreadsheets.values.get({
              spreadsheetId: config.caseSheet,
              range: "'面板資料'!A12:Z17",
            });
            const pRows = panelRes.data.values || [];
            const nameRow = pRows.find(r => r && r[0] === '姓名') || [];
            const rateRow = pRows.find(r => r && r[0] === '簽約率') || [];
            const sumIdx = nameRow.findIndex((v, i) => i > 0 && v === '總和');
            if (sumIdx >= 0) entry.signRate = rateRow[sumIdx] || '';
          } catch (e) {}
        })() : Promise.resolve(),
      ]);

      const monthlyTarget = entry.milestone / 12;
      entry.monthRate = monthlyTarget > 0 ? (entry.monthRevenue / monthlyTarget * 100).toFixed(1) + '%' : '0%';
      entry.totalRate = (monthlyTarget * currentMonth) > 0 ? (entry.actual / (monthlyTarget * currentMonth) * 100).toFixed(1) + '%' : '0%';
      entry.diff = entry.milestone - entry.actual;
      return entry;
    }));

    // 全區合計
    const totalMilestone = allData.reduce((s, d) => s + d.milestone, 0);
    const totalActual = allData.reduce((s, d) => s + d.actual, 0);
    const totalMonth = allData.reduce((s, d) => s + d.monthRevenue, 0);
    const monthlyTarget = totalMilestone / 12;

    const responseData = {
      regions: allData,
      total: {
        milestone: totalMilestone,
        actual: totalActual,
        diff: totalMilestone - totalActual,
        monthRevenue: totalMonth,
        monthRate: monthlyTarget > 0 ? (totalMonth / monthlyTarget * 100).toFixed(1) + '%' : '0%',
        totalRate: (monthlyTarget * currentMonth) > 0 ? (totalActual / (monthlyTarget * currentMonth) * 100).toFixed(1) + '%' : '0%',
      },
    };
    setCache('allregions', responseData);
    res.json(responseData);
  } catch (err) {
    console.error('全區統計錯誤:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== 週會筆記 API（04 區塊：客戶回饋/廠商狀況/支援項目）=====
app.use(express.json());

app.get('/api/notes/:region', async (req, res) => {
  try {
    const region = decodeURIComponent(req.params.region);
    const data = await supaGet('tb_weekly_notes', `?region=eq.${encodeURIComponent(region)}&order=created_at.asc`);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notes', async (req, res) => {
  try {
    const { region, category, content, status = '未處理', meeting_date } = req.body;
    const data = await supaInsert('tb_weekly_notes', { region, category, content, status, meeting_date: meeting_date || new Date().toISOString().slice(0, 10) });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/notes/:id', async (req, res) => {
  try {
    const data = await supaPatch('tb_weekly_notes', req.params.id, req.body);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    await supaDelete('tb_weekly_notes', req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 請款記錄 API（03 區塊）=====
app.get('/api/paymentrecords/:region', async (req, res) => {
  try {
    const region = decodeURIComponent(req.params.region);
    const data = await supaGet('tb_payment_records', `?region=eq.${encodeURIComponent(region)}`);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/paymentrecords', async (req, res) => {
  try {
    const { region, case_no, address, invoice_amount, received_amount, note } = req.body;
    const data = await supaUpsert('tb_payment_records', {
      region, case_no, address,
      invoice_amount: parseInt(invoice_amount) || 0,
      received_amount: parseInt(received_amount) || 0,
      note, updated_at: new Date().toISOString(),
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 預計簽約 API（05 區塊）=====
app.get('/api/expected/:region', async (req, res) => {
  try {
    const region = decodeURIComponent(req.params.region);
    const data = await supaGet('tb_expected_signs', `?region=eq.${encodeURIComponent(region)}&order=created_at.asc`);
    res.json(Array.isArray(data) ? data : []);
  } catch (e) { res.json([]); }
});

app.post('/api/expected', async (req, res) => {
  try {
    const { region, address, amount, expected_date, note } = req.body;
    const data = await supaInsert('tb_expected_signs', {
      region, address: address || '',
      amount: amount || '', expected_date: expected_date || '', note: note || '',
      meeting_date: new Date().toISOString().slice(0, 10),
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/expected/:id', async (req, res) => {
  try {
    await supaDelete('tb_expected_signs', req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== 帳號登入 API（從 Supabase tb_users 驗證）=====
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await supaGet('tb_users', `?username=eq.${encodeURIComponent(String(username || '').toLowerCase())}`);
    if (!Array.isArray(users) || !users[0] || users[0].password !== password) {
      return res.status(401).json({ ok: false, message: '帳號或密碼錯誤' });
    }
    const { password: _pw, ...info } = users[0];
    res.json({ ok: true, ...info });
  } catch (e) { res.status(500).json({ ok: false, message: '伺服器錯誤' }); }
});

// ===== 帳號管理 API（admin only，前端已做權限保護）=====
app.get('/api/admin/users', async (req, res) => {
  try {
    const data = await supaGet('tb_users', '?select=id,username,role,region,name,created_at&order=created_at.asc');
    res.json(Array.isArray(data) ? data : []);
  } catch (e) { res.json([]); }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const { username, password, role, region, name } = req.body;
    const data = await supaInsert('tb_users', {
      username: String(username || '').toLowerCase(), password, role, region: region || null, name,
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/users/:id', async (req, res) => {
  try {
    const updates = {};
    if (req.body.password) updates.password = req.body.password;
    if (req.body.name) updates.name = req.body.name;
    if (req.body.region !== undefined) updates.region = req.body.region;
    const data = await supaPatch('tb_users', req.params.id, updates);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await supaDelete('tb_users', req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 靜態檔案服務（前端 build 產物）
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*any}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
