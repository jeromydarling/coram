
ALTER TABLE public.discovery_highlights DROP CONSTRAINT discovery_highlights_kind_check;
ALTER TABLE public.discovery_highlights ADD CONSTRAINT discovery_highlights_kind_check CHECK (kind = ANY (ARRAY['urgent', 'new', 'changed', 'recommended_source', 'article']));
