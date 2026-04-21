-- Mirror of migration applied to Supabase (version: 20260421070409)
-- 預計簽約頁新需求：加「已簽約」勾選 + 已簽約金額統計

ALTER TABLE tb_expected_signs
  ADD COLUMN IF NOT EXISTS is_signed boolean NOT NULL DEFAULT false;
