DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.schemaname, t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.rowsecurity = true
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = t.schemaname
          AND p.tablename = t.tablename
      )
  LOOP
    EXECUTE format(
      'CREATE POLICY deny_all_public_access ON %I.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      r.schemaname, r.tablename
    );
  END LOOP;
END $$;