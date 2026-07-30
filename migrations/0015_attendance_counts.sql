-- ---------------------------------------------------------------------
-- 0015 — Attendance counts an observer can actually see
--
-- §4.1 defines `observer` as "read-only aggregate reporting. Sees no
-- individual contact records." The second half worked and the first half did
-- not: every event in the demo workspace reported 0 going when the table held
-- 21 and 41.
--
-- The cause is correct behaviour producing a wrong answer. rsvps_select
-- requires that you can see the underlying contact, an observer can see none,
-- so a `SELECT count(*) FROM rsvps` inside the events query returns zero rather
-- than being denied. Nothing errors. The number is simply false, and false in
-- the direction that makes a busy group look dead.
--
-- The fix is the pattern 0001 already established for the places where RLS
-- cannot express the rule: a narrow SECURITY DEFINER function that returns a
-- scalar and never a row. An observer learns that forty-one people are coming
-- without learning who any of them are, which is exactly the line §4.1 draws.
--
-- Deliberately not a view over rsvps, and not a relaxed policy. Either would
-- widen what an observer can reach; this widens what they can *count*.
-- ---------------------------------------------------------------------

CREATE FUNCTION coram.attendance(_event_id uuid, _status text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  /*
   * Tenant-scoped inside the function, because SECURITY DEFINER means the
   * caller's RLS no longer applies and the tenant check has to be made
   * explicitly. Without this line the function would happily count another
   * workspace's event, which is the classic way this pattern goes wrong.
   */
  SELECT count(*)::int
  FROM public.rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.event_id = _event_id
    AND e.tenant_id = coram.current_tenant_id()
    AND r.status = _status;
$$;

-- EXECUTE to the app role only. coram_cron has BYPASSRLS and does not need it.
REVOKE ALL ON FUNCTION coram.attendance(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coram.attendance(uuid, text) TO coram_app;
