-- Phase 11b: 深修 — RPC + tax_resident + 年底結算 helper

-- ===== 1. payroll_items 原子替換（避免 delete+insert race） =====
CREATE OR REPLACE FUNCTION hr.replace_payroll_items(
  p_payslip_id bigint,
  p_items jsonb
) RETURNS int AS $$
DECLARE
  inserted_count int;
BEGIN
  -- advisory lock per payslip，避免同一張 payslip 同時被結算兩次
  PERFORM pg_advisory_xact_lock(p_payslip_id);

  DELETE FROM hr.payroll_items WHERE payslip_id = p_payslip_id;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO hr.payroll_items
    (payslip_id, item_group, code, label, hours, rate, amount, sort_order, meta)
  SELECT
    p_payslip_id,
    (item->>'item_group'),
    (item->>'code'),
    (item->>'label'),
    NULLIF(item->>'hours', '')::numeric,
    NULLIF(item->>'rate', '')::numeric,
    COALESCE((item->>'amount')::numeric, 0),
    COALESCE((item->>'sort_order')::int, 0),
    item->'meta'
  FROM jsonb_array_elements(p_items) AS item;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION hr.replace_payroll_items(bigint, jsonb) TO service_role;

-- ===== 2. 員工外籍稅務分流 =====
ALTER TABLE hr.employees
  ADD COLUMN IF NOT EXISTS tax_resident boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS first_arrival_date date;

COMMENT ON COLUMN hr.employees.tax_resident IS '是否為稅務居民（年度居留 ≥ 183 天）。本國勞工恆 true；外籍員工首 183 天為 false（18% 預扣），之後改 true（5%）';
COMMENT ON COLUMN hr.employees.first_arrival_date IS '外籍員工首次入境日（用於計算 183 天）';

-- ===== 3. payroll_settings 補外籍稅率 =====
INSERT INTO hr.payroll_settings (key, value, effective_from, notes) VALUES
  ('income_tax_foreign_rate', '0.18'::jsonb, '2025-01-01', '非稅務居民（外籍 < 183 天）固定 18% 預扣')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, notes = EXCLUDED.notes, updated_at = now();

-- ===== 4. bonus_events FK ON DELETE SET NULL =====
ALTER TABLE hr.bonus_events
  DROP CONSTRAINT IF EXISTS bonus_events_payslip_id_fkey,
  ADD CONSTRAINT bonus_events_payslip_id_fkey
    FOREIGN KEY (payslip_id) REFERENCES hr.payslips(id) ON DELETE SET NULL;
