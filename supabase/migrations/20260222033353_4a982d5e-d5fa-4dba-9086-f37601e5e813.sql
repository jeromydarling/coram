
-- Volunteer tags (max 25 per tenant enforced in app)
CREATE TABLE public.volunteer_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Volunteer-to-tag links
CREATE TABLE public.volunteer_tag_links (
  volunteer_id uuid NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.volunteer_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (volunteer_id, tag_id)
);

-- Indexes
CREATE INDEX idx_volunteer_tags_tenant ON public.volunteer_tags(tenant_id);
CREATE INDEX idx_volunteer_tag_links_tag ON public.volunteer_tag_links(tag_id);

-- RLS for volunteer_tags
ALTER TABLE public.volunteer_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage tags"
  ON public.volunteer_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = volunteer_tags.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- RLS for volunteer_tag_links
ALTER TABLE public.volunteer_tag_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage tag links"
  ON public.volunteer_tag_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.volunteer_tags vt
      JOIN public.tenant_users tu ON tu.tenant_id = vt.tenant_id
      WHERE vt.id = volunteer_tag_links.tag_id
        AND tu.user_id = auth.uid()
    )
  );
