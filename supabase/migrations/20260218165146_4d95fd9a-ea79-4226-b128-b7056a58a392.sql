
ALTER TABLE public.discovery_highlights DROP CONSTRAINT discovery_highlights_module_check;
ALTER TABLE public.discovery_highlights ADD CONSTRAINT discovery_highlights_module_check CHECK (module = ANY (ARRAY['grants', 'events', 'people', 'metro_news']));
