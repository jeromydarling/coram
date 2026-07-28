-- Add unique constraint for grant_resources deduplication
ALTER TABLE public.grant_resources
ADD CONSTRAINT grant_resources_grant_id_resource_type_url_key
UNIQUE (grant_id, resource_type, url);