-- Manual migration: full-text search maintenance for products.
-- The `search` tsvector column is filled by trigger from name + tagline +
-- story + materials. GIN index keeps search <300ms (PRD F2 acceptance).
CREATE INDEX "products_search_gin" ON "products" USING gin ("search");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "products_search_trigger_fn"() RETURNS trigger AS $$
BEGIN
  NEW."search" := to_tsvector(
    'english',
    coalesce(NEW."name", '') || ' ' ||
    coalesce(NEW."tagline", '') || ' ' ||
    coalesce(NEW."story", '') || ' ' ||
    coalesce(array_to_string(NEW."materials", ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "products_search_trigger" ON "products";--> statement-breakpoint
CREATE TRIGGER "products_search_trigger"
  BEFORE INSERT OR UPDATE OF "name", "tagline", "story", "materials"
  ON "products"
  FOR EACH ROW EXECUTE FUNCTION "products_search_trigger_fn"();--> statement-breakpoint
-- Backfill rows inserted before the trigger existed (e.g. seed order edge).
UPDATE "products" SET "name" = "name" WHERE "search" IS NULL;
