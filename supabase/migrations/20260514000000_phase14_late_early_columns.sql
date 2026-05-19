-- Phase 14: 打卡加 遲到 / 早退 標註

ALTER TABLE hr.punches
  ADD COLUMN IF NOT EXISTS late_minutes int,
  ADD COLUMN IF NOT EXISTS early_leave_minutes int;

COMMENT ON COLUMN hr.punches.late_minutes IS '遲到分鐘數（只在 punch_type=in 寫入）；null=未計算，0=準時，>0=遲到';
COMMENT ON COLUMN hr.punches.early_leave_minutes IS '早退分鐘數（只在 punch_type=out 寫入）；null=未計算，0=工時足，>0=早退';

CREATE INDEX IF NOT EXISTS idx_punches_late ON hr.punches (late_minutes) WHERE late_minutes > 0;
CREATE INDEX IF NOT EXISTS idx_punches_early ON hr.punches (early_leave_minutes) WHERE early_leave_minutes > 0;
