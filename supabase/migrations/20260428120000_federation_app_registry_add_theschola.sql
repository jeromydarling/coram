-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Federation App Registry — Add theschola                             ║
-- ║  Phase 2 follow-up: Schola joins the publishing federation.          ║
-- ║                                                                       ║
-- ║  Schola already has a public content surface (/insights backed by    ║
-- ║  gardener_essays). This row adds it to the switcher and lets the     ║
-- ║  hub publish federated essays into its own published_essays table.   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

BEGIN;

INSERT INTO public.federated_apps (
  source_app,
  display_name,
  description,
  accent_color,
  public_base_url,
  is_hub,
  is_active,
  display_order
)
VALUES (
  'theschola',
  'Schola',
  'Catholic classical schools — community, curriculum, formation.',
  '#1e40af',
  'https://theschola.app',
  false,
  true,
  25  -- between vigilia (20) and resurrectio (30)
)
ON CONFLICT (source_app) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  description       = EXCLUDED.description,
  accent_color      = EXCLUDED.accent_color,
  public_base_url   = EXCLUDED.public_base_url,
  is_active         = EXCLUDED.is_active,
  display_order     = EXCLUDED.display_order,
  updated_at        = now();

COMMIT;
