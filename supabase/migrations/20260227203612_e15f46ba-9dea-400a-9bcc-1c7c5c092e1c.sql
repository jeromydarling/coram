-- Drop the existing check constraint on source_type and replace with one that includes perplexity_research
-- First find and drop the existing constraint, then add the new one

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'org_knowledge_snapshots'
    AND att.attname = 'source_type'
    AND con.contype = 'c';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.org_knowledge_snapshots DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

-- Now use a validation trigger instead of a check constraint (per project conventions)
CREATE OR REPLACE FUNCTION public.validate_org_knowledge_source_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.source_type NOT IN ('admin_curated', 'firecrawl_bootstrap', 'perplexity_research') THEN
    RAISE EXCEPTION 'Invalid org_knowledge_snapshots source_type: %', NEW.source_type;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_org_knowledge_source_type ON public.org_knowledge_snapshots;
CREATE TRIGGER trg_validate_org_knowledge_source_type
  BEFORE INSERT OR UPDATE ON public.org_knowledge_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.validate_org_knowledge_source_type();