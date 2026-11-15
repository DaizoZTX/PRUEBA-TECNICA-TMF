-- A price tier may not overlap another tier of the same product and level.
-- Stored as half-open ranges [min, max + 1), so max_qty stays inclusive for readers.
-- A NULL max_qty means "no upper bound", represented by the largest integer.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE price_tiers
  ADD CONSTRAINT price_tiers_no_overlap
  EXCLUDE USING gist (
    product_id WITH =,
    level WITH =,
    int4range(min_qty, COALESCE(max_qty + 1, 2147483647), '[)') WITH &&
  );
