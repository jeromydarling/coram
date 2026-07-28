
-- 1. Expand status check to include 'prelaunch'
ALTER TABLE public.federation_apps DROP CONSTRAINT IF EXISTS federation_apps_status_check;
ALTER TABLE public.federation_apps ADD CONSTRAINT federation_apps_status_check
  CHECK (status IN ('active','prelaunch','paused','sunsetting','archived'));

-- 2. Add new columns (idempotent)
ALTER TABLE public.federation_apps
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS lovable_url text,
  ADD COLUMN IF NOT EXISTS lovable_project_id uuid,
  ADD COLUMN IF NOT EXISTS github_repo text,
  ADD COLUMN IF NOT EXISTS hosting_platform text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS supabase_ref text,
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'adjacent',
  ADD COLUMN IF NOT EXISTS federation_phase text,
  ADD COLUMN IF NOT EXISTS is_critical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sentry_org_slug text DEFAULT 'cros-llc',
  ADD COLUMN IF NOT EXISTS sentry_project_slug text,
  ADD COLUMN IF NOT EXISTS ga4_stream_id text,
  ADD COLUMN IF NOT EXISTS seo_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_secret_name text,
  ADD COLUMN IF NOT EXISTS last_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_publish_error text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Generated ingest URL (drop+recreate to ensure correct expression)
ALTER TABLE public.federation_apps DROP COLUMN IF EXISTS ingest_essay_url;
ALTER TABLE public.federation_apps
  ADD COLUMN ingest_essay_url text GENERATED ALWAYS AS (
    CASE WHEN supabase_ref IS NULL THEN NULL
         ELSE 'https://' || supabase_ref || '.supabase.co/functions/v1/ingest-essay'
    END
  ) STORED;

-- Tier constraint
ALTER TABLE public.federation_apps DROP CONSTRAINT IF EXISTS federation_apps_tier_check;
ALTER TABLE public.federation_apps ADD CONSTRAINT federation_apps_tier_check
  CHECK (tier IN ('hub','federation','adjacent','excluded'));

CREATE INDEX IF NOT EXISTS idx_federation_apps_tier ON public.federation_apps(tier);
CREATE INDEX IF NOT EXISTS idx_federation_apps_seo_active ON public.federation_apps(seo_active) WHERE seo_active = true;

-- 3. Seed / upsert 29 apps
INSERT INTO public.federation_apps
  (slug, display_name, short_description, primary_domain, lovable_url, github_repo, hosting_platform, tier, federation_phase, is_critical, sentry_project_slug, status)
VALUES
  ('thecros','CROS','The hub — federation host, content authoring, Gardener Console','thecros.app','https://thecros.lovable.app','jeromydarling/thecros','lovable','hub','5',true,'thecros','active'),
  ('theschola','Schola','Catholic homeschool curriculum platform','theschola.app','https://theschola.lovable.app','jeromydarling/theschola','lovable','federation','5',true,'theschola','active'),
  ('vigilia','Vigilia','Healthcare quality monitoring','vigilia.app','https://vigilia.lovable.app','jeromydarling/vigilia-ffa3c410','lovable','federation','5',false,'vigilia','active'),
  ('resurrectio','Resurrectio','Funeral and bereavement coordination',NULL,'https://resurrectio.lovable.app','jeromydarling/resurrectio-3d07f98c','lovable','federation','5',false,'resurrectio','active'),
  ('hortus','Hortus','Garden planning and biodiversity tracking','hortusapp.com','https://hortus.lovable.app','jeromydarling/hortus-claude-s-garden','lovable','federation','5',true,'hortus','active'),
  ('bitoku','Bitoku','Music therapy for children with special needs','bitoku.app','https://bitoku.lovable.app','jeromydarling/bitoku','lovable','federation','5',false,'bitoku','active'),
  ('rehearso','Rehearso','Theater rehearsal coordination','rehearso.app','https://rehearso.lovable.app','jeromydarling/rehearso','lovable','federation','5',false,'rehearso','active'),
  ('via-publica','Via Publica','Pro bono legal services platform','viapublica.com','https://viapublica.lovable.app','jeromydarling/via-publica','lovable','federation','5',false,'viapublica','active'),
  ('fabrica-forge','Fabrica Forge','Catholic creative writing community',NULL,'https://thefabrica.lovable.app','jeromydarling/fabrica-forge','lovable','federation','5',false,'fabrica','active'),
  ('refugium','Refugium','Sanctuary and retreat directory',NULL,'https://refugium.lovable.app','jeromydarling/refugium-a261235f','lovable','federation','5',false,'refugium','active'),
  ('propria','Propria','Catholic land stewardship','propria.land','https://propria.lovable.app','jeromydarling/propria-1e798e8e','lovable','federation','5',false,'propria','active'),
  ('communis','Communis','Worker cooperative governance',NULL,'https://communis.lovable.app','jeromydarling/communis-b47839b1','lovable','federation','5',false,'communis','active'),
  ('transitus','Transitus','End-of-life planning',NULL,'https://transitusapp.lovable.app','jeromydarling/transitus-be0eceba','lovable','federation','5',false,'transitus','active'),
  ('custodia','Custodia','Environmental conservation for parishes',NULL,'https://thecustodia.lovable.app','jeromydarling/custodia','lovable','federation','5',false,'custodia','active'),
  ('collegium-connect','Collegium','Catholic legal collegium intake',NULL,'https://collegium.lovable.app','jeromydarling/collegium-connect','lovable','federation','5',false,'collegium','prelaunch'),
  ('convivium','Convivium','Catholic dinner gathering coordinator',NULL,NULL,'jeromydarling/convivium','lovable','federation','5',false,'convivium','prelaunch'),
  ('catholicart','Catholic Art','Catholic visual art directory',NULL,NULL,'jeromydarling/catholicart','lovable','federation','5',false,'catholicart','prelaunch'),
  ('communicare','Communicare','Catholic dairy and farm sharing platform',NULL,NULL,'jeromydarling/communicare','lovable','federation','5',false,'communicare','prelaunch'),
  ('cormundum','Cor Mundum','Catholic men formation journal',NULL,'https://cormundum.lovable.app','jeromydarling/cormundum','lovable','adjacent','adjacent',false,'cormundum','active'),
  ('vrtmethod','VRT Method','Voice rehabilitation therapy',NULL,'https://vrtmethod.lovable.app','jeromydarling/vrtmethod','lovable','adjacent','adjacent',false,'vrtmethod','active'),
  ('thegreatnave','The Great Nave','Classical music and sacred history subscription',NULL,'https://thegreatnave.lovable.app','jeromydarling/thegreatnave','lovable','adjacent','adjacent',false,'thegreatnave','active'),
  ('thelittleway','The Little Way','Catholic devotional companion',NULL,NULL,'jeromydarling/thelittleway','lovable','adjacent','adjacent',false,'thelittleway','prelaunch'),
  ('safe-mans-handbook','Safe Mans Handbook','Mens wilderness skills',NULL,NULL,'jeromydarling/safe-mans-handbook','lovable','adjacent','adjacent',false,'safe-mans-handbook','prelaunch'),
  ('custodi-parvulos','Custodi Parvulos','Childrens safe-environment training',NULL,NULL,'jeromydarling/custodi-parvulos','lovable','adjacent','adjacent',false,'custodi-parvulos','prelaunch'),
  ('heritage-catholic','Heritage Catholic','Forgotten saints almanac (Cloudflare-hosted)',NULL,NULL,'jeromydarling/heritage-catholic','cloudflare-workers','adjacent','adjacent',false,'heritage-catholic','prelaunch'),
  ('heritage-history','Heritage History','American history homeschool atlas',NULL,NULL,'jeromydarling/heritage-history','lovable','adjacent','adjacent',false,'heritage-history','prelaunch'),
  ('heritage-kitchen','Heritage Kitchen','Heirloom recipe collection',NULL,'https://heritage-kitchen-app.lovable.app','jeromydarling/heritage-kitchen','lovable','adjacent','adjacent',false,'heritage-kitchen','prelaunch'),
  ('heritage-skills','Heritage Skills','Traditional skill instruction',NULL,NULL,'jeromydarling/heritage-skills','lovable','adjacent','adjacent',false,'heritage-skills','prelaunch'),
  ('heritage-parlor','Heritage Parlor','Victorian parlor games (static site)',NULL,NULL,'jeromydarling/heritage-parlor','static','adjacent','adjacent',false,'heritage-parlor','prelaunch')
ON CONFLICT (slug) DO UPDATE SET
  short_description = COALESCE(public.federation_apps.short_description, EXCLUDED.short_description),
  lovable_url = COALESCE(public.federation_apps.lovable_url, EXCLUDED.lovable_url),
  github_repo = COALESCE(public.federation_apps.github_repo, EXCLUDED.github_repo),
  hosting_platform = EXCLUDED.hosting_platform,
  tier = EXCLUDED.tier,
  federation_phase = EXCLUDED.federation_phase,
  is_critical = EXCLUDED.is_critical,
  sentry_project_slug = COALESCE(public.federation_apps.sentry_project_slug, EXCLUDED.sentry_project_slug);

-- 4. Mark SEO-active apps
UPDATE public.federation_apps SET seo_active = true
WHERE slug IN ('theschola','vigilia','resurrectio','hortus','bitoku','rehearso','via-publica','fabrica-forge','refugium','propria','communis','transitus');
