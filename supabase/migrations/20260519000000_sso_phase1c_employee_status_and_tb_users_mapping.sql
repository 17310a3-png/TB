-- ─────────────────────────────────────────────────────────────
-- SSO Phase 1c: hr.employees.employment_status + tb_users SSO 對應欄位
-- 為 tb-meeting 接入 portal SSO 鋪路
--
-- 設計：
-- - hr.employees 加 employment_status：標記「正式員工 / 暫時外部 / 分店共用帳號」
--   external = 加盟商/分店主管，未來資料齊全會 UPDATE 成 internal，不搬表
-- - tb_users 加 employee_id：tb-meeting 用戶 ↔ hr 員工的對應
--   高信心對應在這個 migration 一起回填（聖傑、逸昇）
-- - tb_users 加 last_sso_login_at：Phase 4 監控 SSO 覆蓋率用
-- ─────────────────────────────────────────────────────────────

-- ===== hr.employees.employment_status =====

ALTER TABLE hr.employees
  ADD COLUMN employment_status text NOT NULL DEFAULT 'internal'
    CHECK (employment_status IN ('internal', 'external', 'store_shared'));

COMMENT ON COLUMN hr.employees.employment_status IS
  'internal: 正式員工; external: 加盟商/分店主管（資料待補齊轉 internal）; store_shared: 分店共用帳號（非自然人）';

CREATE INDEX idx_employees_employment_status ON hr.employees (employment_status)
  WHERE employment_status != 'internal';

-- ===== public.tb_users SSO 對應欄位 =====

ALTER TABLE public.tb_users
  ADD COLUMN employee_id bigint REFERENCES hr.employees(id) ON DELETE SET NULL,
  ADD COLUMN last_sso_login_at timestamptz;

COMMENT ON COLUMN public.tb_users.employee_id IS
  'SSO Phase: 對應到 hr.employees.id；NULL 表示尚未對應（仍走 legacy /api/login）';

COMMENT ON COLUMN public.tb_users.last_sso_login_at IS
  'SSO Phase 4 監控用：最後一次透過 portal SSO 登入時間';

CREATE INDEX idx_tb_users_employee_id ON public.tb_users (employee_id)
  WHERE employee_id IS NOT NULL;

-- ===== 高信心對應回填（姓名比對 100% 命中）=====

-- jason19790115 / 聖傑 → employee 6 (TBD002 王聖傑 設計主管)
UPDATE public.tb_users
   SET employee_id = 6
 WHERE id = '0d1c54fb-e6d7-4199-a71d-27c3d8a9ea5f';

-- p780120134 / 逸昇 → employee 7 (TBM003 陳逸昇 行銷主管)
UPDATE public.tb_users
   SET employee_id = 7
 WHERE id = '52bbf6db-201c-47c1-924e-f20541397af2';

-- 反向回填 hr.employees.tb_user_id
UPDATE hr.employees
   SET tb_user_id = '0d1c54fb-e6d7-4199-a71d-27c3d8a9ea5f'
 WHERE id = 6;

UPDATE hr.employees
   SET tb_user_id = '52bbf6db-201c-47c1-924e-f20541397af2'
 WHERE id = 7;
