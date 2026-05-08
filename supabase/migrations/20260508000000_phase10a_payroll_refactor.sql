-- Phase 10a: 薪資架構重構（依 Google Sheet 員工薪資明細 + 員工薪資條 列印用 對齊）
-- 全部 additive，不破壞現有資料

-- ===== 1. 職等表（1~25 級對應投保金額 + 加班資格） =====
CREATE TABLE IF NOT EXISTS hr.salary_grades (
  grade int NOT NULL,
  effective_year int NOT NULL DEFAULT 2025,
  monthly_salary_min numeric(10,2),
  monthly_salary_max numeric(10,2),
  insured_amount numeric(10,2) NOT NULL,
  insurance_pct numeric(5,2),
  seniority_increment numeric(10,2) DEFAULT 0,
  ot_eligible boolean NOT NULL DEFAULT true,
  notes text,
  PRIMARY KEY (grade, effective_year)
);

-- ===== 2. 員工：拆薪資組成 + 國籍 + 設計師責任額 + 年資 =====
ALTER TABLE hr.employees
  ADD COLUMN IF NOT EXISTS base_salary numeric(10,2),
  ADD COLUMN IF NOT EXISTS meal_allowance numeric(10,2) DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS attendance_bonus numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position_allowance numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance_bonus_default numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responsibility_quota numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_sales_target numeric(14,2),
  ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'TW',
  ADD COLUMN IF NOT EXISTS notes text;

-- 年資 view（不存欄位，避免 generated column 對 CURRENT_DATE 的 immutable 問題）
CREATE OR REPLACE VIEW hr.v_employees_with_seniority AS
SELECT e.*,
  CASE WHEN e.hire_date IS NULL THEN NULL
       ELSE ROUND(((CURRENT_DATE - e.hire_date)::numeric / 365.25), 1)
  END AS seniority_years
FROM hr.employees e;

-- ===== 3. 眷屬（健保附加） =====
CREATE TABLE IF NOT EXISTS hr.dependents (
  id bigserial PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text NOT NULL CHECK (relationship IN
    ('spouse','child','parent','grandparent','grandchild','sibling','other')),
  id_number_encrypted bytea,
  birth_date date,
  joined_health_at date,
  left_health_at date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dependents_emp ON hr.dependents (employee_id) WHERE left_health_at IS NULL;

CREATE TRIGGER trg_dependents_updated_at BEFORE UPDATE ON hr.dependents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE hr.dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY svc_all ON hr.dependents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== 4. 健保金額表（含眷口數負擔，從保險金額表(114年) 對應） =====
CREATE TABLE IF NOT EXISTS hr.health_insurance_grades (
  effective_year int NOT NULL,
  grade int NOT NULL,
  monthly_insured numeric(10,2) NOT NULL,
  employee_self numeric(10,2) NOT NULL,
  employee_plus_1 numeric(10,2),
  employee_plus_2 numeric(10,2),
  employee_plus_3 numeric(10,2),
  employer numeric(10,2) NOT NULL,
  government numeric(10,2),
  PRIMARY KEY (effective_year, grade)
);
CREATE INDEX IF NOT EXISTS idx_health_grade_lookup ON hr.health_insurance_grades (effective_year, monthly_insured);

-- ===== 5. 補休餘額（每員工 × 月） =====
CREATE TABLE IF NOT EXISTS hr.comp_leave_balances (
  id bigserial PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  opening_hours numeric(6,2) DEFAULT 0,
  earned_hours numeric(6,2) DEFAULT 0,
  used_hours numeric(6,2) DEFAULT 0,
  expired_hours numeric(6,2) DEFAULT 0,
  closing_hours numeric(6,2) GENERATED ALWAYS AS
    (COALESCE(opening_hours,0) + COALESCE(earned_hours,0) - COALESCE(used_hours,0) - COALESCE(expired_hours,0)) STORED,
  notes text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (employee_id, period_label)
);
CREATE INDEX IF NOT EXISTS idx_comp_leave_emp ON hr.comp_leave_balances (employee_id, period_label DESC);

ALTER TABLE hr.comp_leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY svc_all ON hr.comp_leave_balances FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== 6. 薪資項目明細（取代 payslips.allowances/deductions jsonb） =====
CREATE TABLE IF NOT EXISTS hr.payroll_items (
  id bigserial PRIMARY KEY,
  payslip_id bigint NOT NULL REFERENCES hr.payslips(id) ON DELETE CASCADE,
  item_group text NOT NULL CHECK (item_group IN (
    'earning_fixed','earning_bonus','overtime','other_earning',
    'deduction_statutory','deduction_absence','info'
  )),
  code text NOT NULL,
  label text NOT NULL,
  hours numeric(8,2),
  rate numeric(8,4),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  sort_order int DEFAULT 0,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payslip ON hr.payroll_items (payslip_id, item_group, sort_order);

ALTER TABLE hr.payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY svc_all ON hr.payroll_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== 7. payslips 加快照欄位（薪資條顯示需要） =====
ALTER TABLE hr.payslips
  ADD COLUMN IF NOT EXISTS hourly_rate_e numeric(10,2),
  ADD COLUMN IF NOT EXISTS pension_employer numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pension_insured_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS annual_leave_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS comp_leave_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS bonus_responsibility_received numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_responsibility_reserved numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_amount_monthly numeric(14,2),
  ADD COLUMN IF NOT EXISTS sales_amount_cumulative numeric(14,2);

-- ===== 8. 獎金規則（簽約 / 完工 / 責任額） =====
CREATE TABLE IF NOT EXISTS hr.bonus_rules (
  id bigserial PRIMARY KEY,
  rule_code text UNIQUE NOT NULL,
  rule_name text NOT NULL,
  applies_to_dept text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  config jsonb NOT NULL,
  notes text,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER trg_bonus_rules_updated_at BEFORE UPDATE ON hr.bonus_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE hr.bonus_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY svc_all ON hr.bonus_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== 9. 獎金事件（案件 → 獎金候選 → 認列入薪資） =====
CREATE TABLE IF NOT EXISTS hr.bonus_events (
  id bigserial PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES hr.employees(id),
  event_type text NOT NULL CHECK (event_type IN (
    'designer_signing','engineering_completion','design_completion',
    'responsibility_monthly','responsibility_year_end'
  )),
  event_date date NOT NULL,
  contract_no text,
  contract_amount numeric(14,2),
  cost_amount numeric(14,2),
  gross_profit numeric(14,2),
  gross_profit_rate numeric(5,2),
  bonus_amount numeric(12,2) NOT NULL DEFAULT 0,
  rule_code text REFERENCES hr.bonus_rules(rule_code),
  monthly_period text,
  payslip_id bigint REFERENCES hr.payslips(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reserved','paid','cancelled')),
  reserved_to_year int,
  created_by bigint REFERENCES hr.employees(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bonus_employee ON hr.bonus_events (employee_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_bonus_status ON hr.bonus_events (status) WHERE status IN ('pending','reserved');

CREATE TRIGGER trg_bonus_events_updated_at BEFORE UPDATE ON hr.bonus_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE hr.bonus_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY svc_all ON hr.bonus_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== 10. 設計師責任額月度紀錄（追蹤每月有沒有領、年底結算用） =====
CREATE TABLE IF NOT EXISTS hr.responsibility_quota_monthly (
  id bigserial PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  quota_amount numeric(10,2) NOT NULL,
  has_signing boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('paid','reserved','year_end_settled','cancelled')),
  monthly_sales numeric(14,2) DEFAULT 0,
  paid_at_payslip_id bigint REFERENCES hr.payslips(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (employee_id, period_label)
);

CREATE TRIGGER trg_resp_quota_updated_at BEFORE UPDATE ON hr.responsibility_quota_monthly
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE hr.responsibility_quota_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY svc_all ON hr.responsibility_quota_monthly FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== 11. stores_geo: radius_meters 註解（已有欄位，僅補註解） =====
COMMENT ON COLUMN hr.stores_geo.radius_meters IS '打卡圍欄半徑（公尺），管理員可逐店調整，預設 100，外勤工地建議 300';

-- ===== 12. 預設 leave_types 補齊台灣勞基法 14 種假別 =====
INSERT INTO hr.leave_types (code, name, paid_ratio, max_days_per_year, max_days_total, requires_attachment, sort_order, is_active) VALUES
  ('annual',         '特別休假',    1.00, NULL, NULL, false, 10, true),
  ('comp',           '補休',        1.00, NULL, NULL, false, 20, true),
  ('public',         '公假',        1.00, NULL, NULL, true,  30, true),
  ('marriage',       '婚假',        1.00, NULL, 8,    true,  40, true),
  ('bereavement_p',  '父母配偶喪假',1.00, NULL, 8,    true,  50, true),
  ('bereavement_g',  '祖父母喪假',  1.00, NULL, 6,    true,  51, true),
  ('bereavement_c',  '子女喪假',    1.00, NULL, 6,    true,  52, true),
  ('prenatal',       '產檢假',      1.00, 7,    NULL, true,  60, true),
  ('paternity',      '陪產假',      1.00, 7,    NULL, true,  61, true),
  ('maternity',      '產假',        1.00, NULL, 56,   true,  62, true),
  ('miscarriage',    '流產假',      1.00, NULL, 28,   true,  63, true),
  ('occupational',   '公傷病假',    1.00, NULL, NULL, true,  70, true),
  ('sick',           '普通傷病假',  0.50, 30,   NULL, true,  80, true),
  ('menstrual',      '生理假',      0.50, NULL, NULL, false, 81, true),
  ('family_care',    '家庭照顧假',  0.00, 7,    NULL, false, 82, true),
  ('personal',       '事假',        0.00, 14,   NULL, false, 90, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  paid_ratio = EXCLUDED.paid_ratio,
  sort_order = EXCLUDED.sort_order;

-- ===== 13. payroll_settings 種子（標準工時、加班規則、所得稅） =====
INSERT INTO hr.payroll_settings (key, value, effective_from, notes) VALUES
  ('standard_work_hours', '{"start":"08:00","end":"17:00","break_minutes":60,"flex_minutes":60}'::jsonb, '2025-01-01', '標準上下班 08:00-17:00, 午休 60min, 彈性 60min'),
  ('overtime_rates', '{"weekday_first2h":1.34,"weekday_after2h":1.67,"holiday_within8h":1.0,"holiday_after8h_first2h":1.34,"holiday_after8h_after2h":1.67,"restday_first2h":1.34,"restday_after2h":1.67,"restday_after8h":2.67}'::jsonb, '2025-01-01', '加班費倍率（勞基法）'),
  ('hourly_divisor', '240'::jsonb, '2025-01-01', '平日每小時工資額 = 月薪總額 ÷ 240'),
  ('income_tax_method', '"flat_5pct"'::jsonb, '2025-01-01', '所得稅扣繳方法：flat_5pct（高所得固定 5%）或 table（薪資扣繳辦法查表）'),
  ('income_tax_flat_rate', '0.05'::jsonb, '2025-01-01', '固定 5%'),
  ('supplementary_health_rate', '0.0211'::jsonb, '2025-01-01', '補充保費 2.11%'),
  ('supplementary_health_threshold_multiplier', '4'::jsonb, '2025-01-01', '獎金累計超過 4 倍月投保金額時扣補充保費'),
  ('comp_leave_expiry_months', '12'::jsonb, '2025-01-01', '補休期限（月）'),
  ('annual_leave_carryover_months', '12'::jsonb, '2025-01-01', '特休可遞延 1 年'),
  ('annual_leave_anniversary', 'true'::jsonb, '2025-01-01', '特休週年制（true）vs 曆年制（false）')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  notes = EXCLUDED.notes,
  updated_at = now();

COMMENT ON TABLE hr.payroll_items IS '薪資項目明細，1:N to payslips。代替原本 allowances/deductions jsonb，可動態新增獎金/扣款類別';
COMMENT ON TABLE hr.bonus_rules IS '獎金規則設定，config jsonb 內含 tier 設定';
COMMENT ON TABLE hr.bonus_events IS '獎金事件流：案件簽約/工程完工 → 獎金候選 → 認列入薪資單';
COMMENT ON TABLE hr.responsibility_quota_monthly IS '設計師責任額月度紀錄：當月有簽約=領取、無簽約=保留、年底結算';
