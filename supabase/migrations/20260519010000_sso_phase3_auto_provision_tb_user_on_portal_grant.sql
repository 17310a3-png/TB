-- ─────────────────────────────────────────────────────────────
-- SSO Phase 3: portal 打勾 tb-meeting 權限 → 自動建 tb_user
--
-- 動機：admin 在 portal 勾「週會管理」後，希望那位員工立刻出現在
-- tb-meeting 帳號管理頁讓總部設定 region，不要等他第一次 SSO 才出現。
--
-- 策略：DB trigger AFTER INSERT ON hr.employee_subsystem_access
-- - 只對 subsystem_id='tb-meeting' 觸發
-- - 已有 hr.employees.tb_user_id 的跳過（不重複建）
-- - 用 SECURITY DEFINER 才能跨 schema 寫 public.tb_users + hr.employees
-- - 預設值：role='admin' / region=null / password_hash=null（純 SSO）
--   → 總部 admin 在 tb-meeting 帳號管理頁手動調 role/region
--
-- 取消授權（DELETE）刻意不連動清 tb_user，避免破壞歷史紀錄
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hr.provision_tb_user_on_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = hr, public
AS $$
DECLARE
  v_employee_code text;
  v_full_name text;
  v_existing_tb_user_id uuid;
  v_new_tb_user_id uuid;
  v_username text;
BEGIN
  -- 只處理 tb-meeting；其他子系統不動
  IF NEW.subsystem_id <> 'tb-meeting' THEN
    RETURN NEW;
  END IF;

  -- 取員工資料
  SELECT employee_code, full_name, tb_user_id
    INTO v_employee_code, v_full_name, v_existing_tb_user_id
    FROM hr.employees
   WHERE id = NEW.employee_id;

  -- 員工不存在 → 跳過（FK 應該擋住，但保險）
  IF v_employee_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- 已有對應 tb_user → 跳過
  IF v_existing_tb_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- username 用 employee_code 小寫；萬一已被佔用，加 _empN 後綴
  v_username := lower(v_employee_code);
  IF EXISTS (SELECT 1 FROM public.tb_users WHERE username = v_username) THEN
    v_username := v_username || '_emp' || NEW.employee_id::text;
  END IF;

  -- 建 tb_user
  BEGIN
    INSERT INTO public.tb_users (username, role, region, name, password_hash, employee_id)
    VALUES (v_username, 'admin', NULL, v_full_name, NULL, NEW.employee_id)
    RETURNING id INTO v_new_tb_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- 任何錯誤都不擋 portal 那邊的 INSERT；log 後返回
    RAISE WARNING '[provision_tb_user_on_access] failed for employee %: %', NEW.employee_id, SQLERRM;
    RETURN NEW;
  END;

  -- 雙向回填
  UPDATE hr.employees SET tb_user_id = v_new_tb_user_id WHERE id = NEW.employee_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provision_tb_user_on_access ON hr.employee_subsystem_access;
CREATE TRIGGER trg_provision_tb_user_on_access
  AFTER INSERT ON hr.employee_subsystem_access
  FOR EACH ROW
  EXECUTE FUNCTION hr.provision_tb_user_on_access();

COMMENT ON FUNCTION hr.provision_tb_user_on_access() IS
  'SSO Phase 3: portal 勾 tb-meeting 權限時自動建 tb_user（純 SSO，password_hash=null）。
   預設 role=admin/region=null，總部 admin 在 tb-meeting 帳號管理頁手動調權限。';

-- ─────────────────────────────────────────────────────────────
-- Backfill: 既有 5 個 portal-tb-meeting 授權但無 tb_user 的員工
-- ─────────────────────────────────────────────────────────────
WITH need AS (
  SELECT e.id AS employee_id, lower(e.employee_code) AS username, e.full_name
    FROM hr.employee_subsystem_access a
    JOIN hr.employees e ON e.id = a.employee_id
   WHERE a.subsystem_id = 'tb-meeting'
     AND e.tb_user_id IS NULL
), new_users AS (
  INSERT INTO public.tb_users (username, role, region, name, password_hash, employee_id)
  SELECT username, 'admin', NULL, full_name, NULL, employee_id FROM need
  RETURNING id, employee_id
)
UPDATE hr.employees e
   SET tb_user_id = nu.id
  FROM new_users nu
 WHERE e.id = nu.employee_id;
