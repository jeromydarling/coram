
-- Add 'metro_news' to the discovery_runs module check constraint
ALTER TABLE public.discovery_runs DROP CONSTRAINT discovery_runs_module_check;
ALTER TABLE public.discovery_runs ADD CONSTRAINT discovery_runs_module_check CHECK (module = ANY (ARRAY['grants', 'events', 'people', 'metro_news']));
