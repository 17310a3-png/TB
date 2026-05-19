-- Phase 5b: HR schema (人資打卡系統第一期)
-- 設計依據: docs/schema/decisions/0003-hr-system-phase5-decisions.md

CREATE SCHEMA IF NOT EXISTS hr;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. 店家 GPS 圍欄
CREATE TABLE hr.stores_geo (
  id bigserial PRIMARY KEY,
  region_id uuid REFERENCES public.tb_regions(id),
  name text NOT NULL,
  address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_meters int NOT NULL DEFAULT 100,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 員工 master
CREATE TABLE hr.employees (
  id bigserial PRIMARY KEY,
  employee_code text UNIQUE NOT NULL,
  full_name text NOT NULL,
  password_hash text,
  line_user_id text UNIQUE,
  id_number_encrypted bytea,
  phone text,
  email text,
  hire_date date,
  termination_date date,
  employment_type text,
  salary_type text,
  hourly_rate numeric(10,2),
  monthly_salary numeric(10,2),
  home_store_id bigint REFERENCES hr.stores_geo(id),
  tb_user_id uuid REFERENCES public.tb_users(id),
  bank_code text,
  bank_account text,
  emergency_contact_name text,
  emergency_contact_phone text,
  insurance_salary numeric(10,2),
  labor_insurance_start date,
  health_insurance_start date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. 多店授權
CREATE TABLE hr.employee_allowed_stores (
  employee_id bigint NOT NULL REFERENCES hr.employees(id) ON DELETE CASCADE,
  store_id bigint NOT NULL REFERENCES hr.stores_geo(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (employee_id, store_id)
);

-- 4. 打卡紀錄（Tier 1 + Tier 2）
CREATE TABLE hr.punches (
  id bigserial PRIMARY KEY,
  employee_id bigint NOT NULL REFERENCES hr.employees(id),
  store_id bigint REFERENCES hr.stores_geo(id),
  punch_type text NOT NULL CHECK (punch_type IN ('in', 'out')),
  punch_mode text NOT NULL CHECK (punch_mode IN ('in_store', 'fieldwork')),
  punched_at timestamptz NOT NULL DEFAULT now(),
  client_lat double precision NOT NULL,
  client_lng double precision NOT NULL,
  accuracy_meters double precision,
  distance_meters double precision,
  within_geofence boolean,
  selfie_url text,
  site_photo_url text,
  field_context text,
  field_address text,
  related_case_no text,
  idempotency_key text UNIQUE,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  reviewed_by bigint REFERENCES hr.employees(id),
  reviewed_at timestamptz,
  review_note text,
  device_info jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_punches_employee_time ON hr.punches (employee_id, punched_at DESC);
CREATE INDEX idx_punches_pending_review ON hr.punches (review_status) WHERE review_status = 'pending';

-- 5. 審核 log
CREATE TABLE hr.punch_reviews (
  id bigserial PRIMARY KEY,
  punch_id bigint NOT NULL REFERENCES hr.punches(id),
  reviewer_id bigint NOT NULL REFERENCES hr.employees(id),
  action text NOT NULL CHECK (action IN ('approve', 'reject', 'request_change')),
  note text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_punch_reviews_punch ON hr.punch_reviews (punch_id);

-- updated_at triggers
CREATE TRIGGER trg_stores_geo_updated_at BEFORE UPDATE ON hr.stores_geo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON hr.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE hr.stores_geo               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employees                ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_allowed_stores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.punches                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.punch_reviews            ENABLE ROW LEVEL SECURITY;

CREATE POLICY svc_all ON hr.stores_geo              FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all ON hr.employees               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all ON hr.employee_allowed_stores FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all ON hr.punches                 FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all ON hr.punch_reviews           FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed 6 家店
INSERT INTO hr.stores_geo (name, address, lat, lng, radius_meters) VALUES
  ('板橋', '220 新北市板橋區四川路一段268號',      25.001307529411417, 121.45879581349301, 100),
  ('五股', '248 新北市五股區新五路二段341號',      25.087717566782604, 121.44372375767134, 100),
  ('慈文', '330 桃園市桃園區慈文路470號',          25.002924916989596, 121.29651857116433, 100),
  ('東門', '100 臺北市中正區信義路二段129號 2樓',  25.034349039226484, 121.52792672698601, 100),
  ('龜山', '333 桃園市龜山區文化七路182巷26弄1號', 25.050153711283997, 121.36839248650699, 100),
  ('烏日', '414 臺中市烏日區三和里三榮路一段75號', 24.105649766978890, 120.61089445195167, 100);
