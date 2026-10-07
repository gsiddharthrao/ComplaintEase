-- ============================================================
-- Migration 009: Add Incident Location and Image to Complaints
-- Purpose: Store live GPS coordinates, human-readable address,
-- and photo/image evidence directly on complaints.
-- ============================================================

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index for geospatial/coordinate lookups
CREATE INDEX IF NOT EXISTS idx_complaints_location
  ON complaints (location_lat, location_lng)
  WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

