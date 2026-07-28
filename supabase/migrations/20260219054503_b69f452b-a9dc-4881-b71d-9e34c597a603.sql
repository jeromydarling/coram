
-- ============================================================
-- PHASE 7A: States + Metros + Archetype Settings + Tenants update
-- ============================================================

-- 1. Add home_metro_id to tenants if missing
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS home_metro_id uuid REFERENCES public.metros(id) ON DELETE SET NULL;

-- 2. Create states reference table
CREATE TABLE IF NOT EXISTS public.states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  region text NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "states_select_authenticated" ON public.states FOR SELECT TO authenticated USING (true);
CREATE POLICY "states_admin_manage" ON public.states FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Create tenant_archetype_settings
CREATE TABLE IF NOT EXISTS public.tenant_archetype_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  archetype text NOT NULL,
  settings_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.tenant_archetype_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tas_select_member" ON public.tenant_archetype_settings FOR SELECT TO authenticated
  USING (public.user_in_tenant(tenant_id));
CREATE POLICY "tas_update_admin" ON public.tenant_archetype_settings FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(tenant_id));
CREATE POLICY "tas_insert_admin" ON public.tenant_archetype_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(tenant_id));
CREATE TRIGGER update_tas_updated_at BEFORE UPDATE ON public.tenant_archetype_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add missing columns to metros
ALTER TABLE public.metros ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.metros ADD COLUMN IF NOT EXISTS state_code text;
ALTER TABLE public.metros ADD COLUMN IF NOT EXISTS default_radius_miles int NOT NULL DEFAULT 50;
ALTER TABLE public.metros ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 5. Seed 50 US states
INSERT INTO public.states (code, name, region) VALUES
  ('AL','Alabama','South'),('AK','Alaska','West'),('AZ','Arizona','West'),('AR','Arkansas','South'),
  ('CA','California','West'),('CO','Colorado','West'),('CT','Connecticut','Northeast'),('DE','Delaware','South'),
  ('FL','Florida','South'),('GA','Georgia','South'),('HI','Hawaii','West'),('ID','Idaho','West'),
  ('IL','Illinois','Midwest'),('IN','Indiana','Midwest'),('IA','Iowa','Midwest'),('KS','Kansas','Midwest'),
  ('KY','Kentucky','South'),('LA','Louisiana','South'),('ME','Maine','Northeast'),('MD','Maryland','South'),
  ('MA','Massachusetts','Northeast'),('MI','Michigan','Midwest'),('MN','Minnesota','Midwest'),('MS','Mississippi','South'),
  ('MO','Missouri','Midwest'),('MT','Montana','West'),('NE','Nebraska','Midwest'),('NV','Nevada','West'),
  ('NH','New Hampshire','Northeast'),('NJ','New Jersey','Northeast'),('NM','New Mexico','West'),('NY','New York','Northeast'),
  ('NC','North Carolina','South'),('ND','North Dakota','Midwest'),('OH','Ohio','Midwest'),('OK','Oklahoma','South'),
  ('OR','Oregon','West'),('PA','Pennsylvania','Northeast'),('RI','Rhode Island','Northeast'),('SC','South Carolina','South'),
  ('SD','South Dakota','Midwest'),('TN','Tennessee','South'),('TX','Texas','South'),('UT','Utah','West'),
  ('VT','Vermont','Northeast'),('VA','Virginia','South'),('WA','Washington','West'),('WV','West Virginia','South'),
  ('WI','Wisconsin','Midwest'),('WY','Wyoming','West')
ON CONFLICT (code) DO NOTHING;

-- 6. Seed 4 US regions (idempotent)
INSERT INTO public.regions (region_id, name, color)
SELECT 'midwest', 'Midwest', '#3B82F6' WHERE NOT EXISTS (SELECT 1 FROM public.regions WHERE name = 'Midwest');
INSERT INTO public.regions (region_id, name, color)
SELECT 'south', 'South', '#EF4444' WHERE NOT EXISTS (SELECT 1 FROM public.regions WHERE name = 'South');
INSERT INTO public.regions (region_id, name, color)
SELECT 'west', 'West', '#10B981' WHERE NOT EXISTS (SELECT 1 FROM public.regions WHERE name = 'West');
INSERT INTO public.regions (region_id, name, color)
SELECT 'northeast', 'Northeast', '#8B5CF6' WHERE NOT EXISTS (SELECT 1 FROM public.regions WHERE name = 'Northeast');

-- 7. Seed major metros (idempotent via metro_id unique)
-- We'll reference region_id by subquery
INSERT INTO public.metros (metro_id, metro, city, state_code, lat, lng, region_id, default_radius_miles, active) VALUES
  -- MIDWEST
  ('MSP','Minneapolis–Saint Paul','Minneapolis','MN',44.9778,-93.2650,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('CHI','Chicago','Chicago','IL',41.8781,-87.6298,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('DET','Detroit','Detroit','MI',42.3314,-83.0458,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('MKE','Milwaukee','Milwaukee','WI',43.0389,-87.9065,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('IND','Indianapolis','Indianapolis','IN',39.7684,-86.1581,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('CMH','Columbus','Columbus','OH',39.9612,-82.9988,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('CLE','Cleveland','Cleveland','OH',41.4993,-81.6944,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('CVG','Cincinnati','Cincinnati','OH',39.1031,-84.5120,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('MCI','Kansas City','Kansas City','MO',39.0997,-94.5786,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('STL','St. Louis','St. Louis','MO',38.6270,-90.1994,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('DSM','Des Moines','Des Moines','IA',41.5868,-93.6250,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('OMA','Omaha','Omaha','NE',41.2565,-95.9345,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  ('MSN','Madison','Madison','WI',43.0731,-89.4012,(SELECT id FROM public.regions WHERE name='Midwest' LIMIT 1),50,true),
  -- WEST
  ('DEN','Denver','Denver','CO',39.7392,-104.9903,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('PHX','Phoenix','Phoenix','AZ',33.4484,-112.0740,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('LAS','Las Vegas','Las Vegas','NV',36.1699,-115.1398,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('SLC','Salt Lake City','Salt Lake City','UT',40.7608,-111.8910,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('BOI','Boise','Boise','ID',43.6150,-116.2023,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('LAX','Los Angeles','Los Angeles','CA',34.0522,-118.2437,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('SAN','San Diego','San Diego','CA',32.7157,-117.1611,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('SFO','San Francisco Bay Area','San Francisco','CA',37.7749,-122.4194,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('SMF','Sacramento','Sacramento','CA',38.5816,-121.4944,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('PDX','Portland','Portland','OR',45.5152,-122.6784,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('SEA','Seattle','Seattle','WA',47.6062,-122.3321,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('GEG','Spokane','Spokane','WA',47.6588,-117.4260,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('HNL','Honolulu','Honolulu','HI',21.3069,-157.8583,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  ('ANC','Anchorage','Anchorage','AK',61.2181,-149.9003,(SELECT id FROM public.regions WHERE name='West' LIMIT 1),50,true),
  -- SOUTH
  ('DFW','Dallas–Fort Worth','Dallas','TX',32.7767,-96.7970,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('IAH','Houston','Houston','TX',29.7604,-95.3698,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('AUS','Austin','Austin','TX',30.2672,-97.7431,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('SAT','San Antonio','San Antonio','TX',29.4241,-98.4936,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('OKC','Oklahoma City','Oklahoma City','OK',35.4676,-97.5164,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('MSY','New Orleans','New Orleans','LA',29.9511,-90.0715,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('BHM','Birmingham','Birmingham','AL',33.5207,-86.8025,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('BNA','Nashville','Nashville','TN',36.1627,-86.7816,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('MEM','Memphis','Memphis','TN',35.1495,-90.0490,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('ATL','Atlanta','Atlanta','GA',33.7490,-84.3880,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('MCO','Orlando','Orlando','FL',28.5383,-81.3792,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('TPA','Tampa Bay','Tampa','FL',27.9506,-82.4572,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('MIA','Miami–Fort Lauderdale','Miami','FL',25.7617,-80.1918,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('JAX','Jacksonville','Jacksonville','FL',30.3322,-81.6557,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('CLT','Charlotte','Charlotte','NC',35.2271,-80.8431,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('RDU','Raleigh–Durham','Raleigh','NC',35.7796,-78.6382,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  ('RIC','Richmond','Richmond','VA',37.5407,-77.4360,(SELECT id FROM public.regions WHERE name='South' LIMIT 1),50,true),
  -- NORTHEAST
  ('NYC','New York City','New York','NY',40.7128,-74.0060,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('BUF','Buffalo','Buffalo','NY',42.8864,-78.8784,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('BOS','Boston','Boston','MA',42.3601,-71.0589,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('PVD','Providence','Providence','RI',41.8240,-71.4128,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('BDL','Hartford','Hartford','CT',41.7658,-72.6734,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('HVN','New Haven','New Haven','CT',41.3083,-72.9279,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('EWR','Newark','Newark','NJ',40.7357,-74.1724,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('PHL','Philadelphia','Philadelphia','PA',39.9526,-75.1652,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('PIT','Pittsburgh','Pittsburgh','PA',40.4406,-79.9959,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('BWI','Baltimore','Baltimore','MD',39.2904,-76.6122,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('DCA','Washington DC Metro','Washington','MD',38.9072,-77.0369,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('PWM','Portland ME','Portland','ME',43.6591,-70.2568,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('BTV','Burlington','Burlington','VT',44.4759,-73.2121,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true),
  ('MHT','Manchester','Manchester','NH',42.9956,-71.4548,(SELECT id FROM public.regions WHERE name='Northeast' LIMIT 1),50,true)
ON CONFLICT (metro_id) DO UPDATE SET
  city = EXCLUDED.city,
  state_code = EXCLUDED.state_code,
  lat = COALESCE(EXCLUDED.lat, public.metros.lat),
  lng = COALESCE(EXCLUDED.lng, public.metros.lng),
  default_radius_miles = EXCLUDED.default_radius_miles,
  active = EXCLUDED.active;
