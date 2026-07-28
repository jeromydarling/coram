
-- Add DC to states
INSERT INTO states (code, name, region) VALUES ('DC', 'District of Columbia', 'South')
ON CONFLICT (code) DO NOTHING;

-- Add unique constraint on metros for idempotency (metro + state_code)
-- First check: some metros share names across states (e.g. Portland OR vs Portland ME)
-- Use a unique index that handles nulls
CREATE UNIQUE INDEX IF NOT EXISTS idx_metros_metro_state_code ON metros (metro, state_code);

-- Seed missing metros (ON CONFLICT DO NOTHING)
INSERT INTO metros (metro_id, metro, state_code, city, lat, lng, default_radius_miles, active) VALUES
  ('METRO-RIVERSIDE', 'Riverside–San Bernardino', 'CA', 'Riverside', 33.9533, -117.3962, 50, true),
  ('METRO-ALBUQUERQUE', 'Albuquerque', 'NM', 'Albuquerque', 35.0844, -106.6504, 50, true),
  ('METRO-TUCSON', 'Tucson', 'AZ', 'Tucson', 32.2226, -110.9747, 50, true),
  ('METRO-FRESNO', 'Fresno', 'CA', 'Fresno', 36.7378, -119.7871, 50, true),
  ('METRO-GRANDRAPIDS', 'Grand Rapids', 'MI', 'Grand Rapids', 42.9634, -85.6681, 50, true),
  ('METRO-LOUISVILLE', 'Louisville', 'KY', 'Louisville', 38.2527, -85.7585, 50, true),
  ('METRO-VABEACH', 'Virginia Beach–Norfolk', 'VA', 'Virginia Beach', 36.8529, -75.9780, 50, true)
ON CONFLICT (metro, state_code) DO NOTHING;
