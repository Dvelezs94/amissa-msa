ALTER TABLE "asset_hour_maintenance_plans"
  ADD COLUMN IF NOT EXISTS "workdays" jsonb NOT NULL DEFAULT '[0,1,2,3,4,5,6]'::jsonb;
