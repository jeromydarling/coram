CREATE OR REPLACE FUNCTION public.merge_app_metadata(p_slug text, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.federation_apps
     SET metadata = COALESCE(metadata, '{}'::jsonb) || p_patch,
         updated_at = now()
   WHERE slug = p_slug;
END;
$$;

SELECT public.merge_app_metadata('thecros',     '{"ga_property_id": "526708699"}'::jsonb);
SELECT public.merge_app_metadata('theschola',   '{"ga_property_id": "527636617"}'::jsonb);
SELECT public.merge_app_metadata('rehearso',    '{"ga_property_id": "527604537"}'::jsonb);
SELECT public.merge_app_metadata('bitoku',      '{"ga_property_id": "540047830"}'::jsonb);
SELECT public.merge_app_metadata('hortus',      '{"ga_property_id": "540062560"}'::jsonb);
SELECT public.merge_app_metadata('custodia',    '{"ga_property_id": "540062561"}'::jsonb);
SELECT public.merge_app_metadata('transitus',   '{"ga_property_id": "540072073"}'::jsonb);
SELECT public.merge_app_metadata('fabrica',     '{"ga_property_id": "540072756"}'::jsonb);
SELECT public.merge_app_metadata('refugium',    '{"ga_property_id": "540077609"}'::jsonb);
SELECT public.merge_app_metadata('communis',    '{"ga_property_id": "540081315"}'::jsonb);
SELECT public.merge_app_metadata('propria',     '{"ga_property_id": "540081614"}'::jsonb);
SELECT public.merge_app_metadata('resurrectio', '{"ga_property_id": "540089294"}'::jsonb);
SELECT public.merge_app_metadata('viapublica',  '{"ga_property_id": "540096927"}'::jsonb);
SELECT public.merge_app_metadata('via-publica', '{"ga_property_id": "540096927"}'::jsonb);
SELECT public.merge_app_metadata('fabrica-forge','{"ga_property_id": "540072756"}'::jsonb);

CREATE TABLE IF NOT EXISTS public.federation_ga_orphan_properties (
  property_id    text PRIMARY KEY,
  display_label  text NOT NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.federation_ga_orphan_properties TO authenticated;
GRANT ALL ON public.federation_ga_orphan_properties TO service_role;

ALTER TABLE public.federation_ga_orphan_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read orphan properties"
  ON public.federation_ga_orphan_properties
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.federation_ga_orphan_properties (property_id, display_label, notes) VALUES
  ('540058246', 'Convivium',            'Operations hub. Not yet in federation_apps registry.'),
  ('527577834', 'Franz Jagerstatter',   'Heritage micro-site outside the satellite registry.'),
  ('540206455', 'Directio',             'CF Worker-backed, not Supabase. Manually tracked.'),
  ('540214525', 'Culina',               'CF Worker. Marketplace shape; cross-checked in qa matrix.'),
  ('540215715', 'Communicare',          'Cross-app federation link via hortus, no own slug yet.'),
  ('540223495', 'Sanctum',              'CF Worker. Auth-gated.'),
  ('540224063', 'InMotu',               'New app pending slug assignment.'),
  ('540263062', '8 Seconds',            'Youth rodeo experiment pending slug assignment.'),
  ('540275662', 'Successio',            'Estate-planning experiment pending slug assignment.')
ON CONFLICT (property_id) DO UPDATE
  SET display_label = EXCLUDED.display_label,
      notes         = EXCLUDED.notes;

CREATE OR REPLACE VIEW public.federation_ga_properties AS
SELECT
  fa.slug,
  fa.display_name,
  fa.primary_domain,
  fa.metadata->>'ga_property_id' AS ga_property_id,
  'linked'::text AS link_status,
  fa.status,
  fa.has_lead_intake,
  fa.has_seo_module
FROM public.federation_apps fa
WHERE fa.metadata->>'ga_property_id' IS NOT NULL
UNION ALL
SELECT
  NULL::text AS slug,
  o.display_label AS display_name,
  NULL::text AS primary_domain,
  o.property_id AS ga_property_id,
  'orphan'::text AS link_status,
  NULL::text AS status,
  NULL::boolean AS has_lead_intake,
  NULL::boolean AS has_seo_module
FROM public.federation_ga_orphan_properties o;

GRANT SELECT ON public.federation_ga_properties TO authenticated;