
CREATE TABLE IF NOT EXISTS public.tenant_slug_redirects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  old_slug TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_slug_redirects_tenant ON public.tenant_slug_redirects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_slug_redirects_expires ON public.tenant_slug_redirects(expires_at);

ALTER TABLE public.tenant_slug_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active slug redirects"
ON public.tenant_slug_redirects
FOR SELECT
USING (expires_at > now());

CREATE POLICY "Stewards manage their tenant redirects"
ON public.tenant_slug_redirects
FOR ALL
TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()))
WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.record_tenant_slug_rename()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug AND OLD.slug IS NOT NULL THEN
    INSERT INTO public.tenant_slug_redirects (old_slug, tenant_id)
    VALUES (OLD.slug, NEW.id)
    ON CONFLICT (old_slug) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          expires_at = now() + interval '90 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_tenant_slug_rename ON public.tenants;
CREATE TRIGGER trg_record_tenant_slug_rename
AFTER UPDATE OF slug ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.record_tenant_slug_rename();
