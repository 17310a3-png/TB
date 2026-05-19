-- ─────────────────────────────────────────────────────────────
-- SSO Phase 1d: 為未對應的 tb_users 在 hr.employees 建 external 佔位 row
--
-- 設計：
-- - 13 個 tb_users 一次建好 hr.employees row + 雙向回填 employee_id ↔ tb_user_id
-- - employment_status='external'（其中「烏日」分店共用帳號是 store_shared）
-- - apply_payroll/insurance/pension 全 false（外部不算薪資/不算保險）
-- - role: tb_users.role='admin' → 'admin'; 'region' → 'employee'
-- - employee_code: EXT-<username> 前綴方便辨識
-- - 未來資料齊：UPDATE employment_status='internal' + 補欄位即可
-- ─────────────────────────────────────────────────────────────

WITH new_ext AS (
  INSERT INTO hr.employees (
    employee_code, full_name, role, employment_status, is_active,
    apply_payroll, apply_labor_insurance, apply_health_insurance,
    apply_unemployment_insurance, apply_pension, tax_resident,
    tb_user_id, notes
  ) VALUES
    -- 4 個 admin 暗名（未來指認後補資料）
    ('EXT-admin',        '總部',     'admin',    'external',     true, false, false, false, false, false, false,
     '0add47bd-11c7-446e-b8a1-35da452fea33', 'SSO Phase 1: external 佔位；admin 暗名待指認對應實際員工後轉 internal'),
    ('EXT-sweet791013',  '珮珮',     'admin',    'external',     true, false, false, false, false, false, false,
     '2c8ff405-6670-4c31-a1c3-6f7b3fc5e7b4', 'SSO Phase 1: external 佔位；admin 暗名待指認對應實際員工後轉 internal'),
    ('EXT-ksungyen',     '燕子',     'admin',    'external',     true, false, false, false, false, false, false,
     '3beac5a9-8385-493c-b8c7-c8737790913f', 'SSO Phase 1: external 佔位；admin 暗名待指認對應實際員工後轉 internal'),
    ('EXT-jun8659',      '阿豪',     'admin',    'external',     true, false, false, false, false, false, false,
     '3dbde876-56e1-46dd-88a0-1eb2ff123dde', 'SSO Phase 1: external 佔位；admin 暗名待指認對應實際員工後轉 internal'),
    -- 加盟商/分店主管（region=...）
    ('EXT-1645boss',     '建誠',     'employee', 'external',     true, false, false, false, false, false, false,
     '4f1acdf5-f443-4512-94d1-ad7f669f9834', 'SSO Phase 1: external 佔位；加盟商 region=桃園,新竹'),
    ('EXT-show700906',   '忠修',     'employee', 'external',     true, false, false, false, false, false, false,
     '35c198d4-d4bc-404e-a5b9-8e96729eb561', 'SSO Phase 1: external 佔位；加盟商 region=烏日'),
    ('EXT-mrjdesign007', 'johnny',   'employee', 'external',     true, false, false, false, false, false, false,
     'bf41e643-a0b7-41f4-9e37-23391c1ee560', 'SSO Phase 1: external 佔位；加盟商 region=水湳,烏日'),
    ('EXT-g0937554545',  '阿智',     'employee', 'external',     true, false, false, false, false, false, false,
     'cca39aac-4ba8-4e07-9cde-88fd3a8d697c', 'SSO Phase 1: external 佔位；加盟商 region=桃園'),
    ('EXT-w5042264',     '葉子',     'employee', 'external',     true, false, false, false, false, false, false,
     '06d5ea44-615f-4cee-b227-d8740fc4e482', 'SSO Phase 1: external 佔位；加盟商 region=桃園'),
    ('EXT-rick',         '耿起賢',   'employee', 'external',     true, false, false, false, false, false, false,
     '79366073-c82b-4599-9b92-d2236c1d3d91', 'SSO Phase 1: external 佔位；加盟商 region=東門'),
    ('EXT-amber',        'amber',    'employee', 'external',     true, false, false, false, false, false, false,
     'd6e8dbe8-9dff-4422-8be5-b9d2ff1da28c', 'SSO Phase 1: external 佔位；加盟商 region=東門'),
    ('EXT-hzf.tora',     'Willson',  'admin',    'external',     true, false, false, false, false, false, false,
     '866dceb3-1a89-4c32-ab6d-107df217df76', 'SSO Phase 1: external 佔位；身份待指認（role=admin 但無 region）'),
    -- 分店共用帳號（非自然人）
    ('EXT-store-wuri',   '烏日分店', 'employee', 'store_shared', true, false, false, false, false, false, false,
     'b1fbf8be-9357-4222-bcb4-7b431433d794', 'SSO Phase 1: store_shared 分店共用帳號（mr.turnkey.central / region=烏日），非自然人')
  RETURNING id, tb_user_id
)
UPDATE public.tb_users u
   SET employee_id = ne.id
  FROM new_ext ne
 WHERE u.id = ne.tb_user_id;
