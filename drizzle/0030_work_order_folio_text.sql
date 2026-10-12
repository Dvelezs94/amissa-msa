DROP INDEX IF EXISTS "work_orders_folio_unique_idx";

ALTER TABLE "work_orders"
  ALTER COLUMN "folio" TYPE text USING "folio"::text;

CREATE UNIQUE INDEX "work_orders_folio_unique_idx"
  ON "work_orders" ("folio")
  WHERE "folio" IS NOT NULL;
