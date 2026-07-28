-- Tighten Communio visibility by shared-group relationship and harden Familia role boundaries

-- 1) Shared-group helper for tenant-to-tenant Communio visibility
create or replace function public.tenants_share_communio_group(_tenant_a uuid, _tenant_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.communio_memberships a
    join public.communio_memberships b on b.group_id = a.group_id
    where a.tenant_id = _tenant_a
      and b.tenant_id = _tenant_b
  );
$$;

-- 2) Replace permissive Communio request read policy (was USING true)
drop policy if exists authenticated_read_communio_requests on public.communio_requests;
create policy authenticated_read_communio_requests
on public.communio_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_users tu
    where tu.user_id = auth.uid()
      and (
        tu.tenant_id = communio_requests.tenant_id
        or public.tenants_share_communio_group(tu.tenant_id, communio_requests.tenant_id)
      )
  )
);

-- 3) Replace permissive Communio reply read policy (was USING true)
drop policy if exists authenticated_read_communio_replies on public.communio_replies;
create policy authenticated_read_communio_replies
on public.communio_replies
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_users tu
    join public.communio_requests cr on cr.id = communio_replies.request_id
    where tu.user_id = auth.uid()
      and (
        tu.tenant_id = cr.tenant_id
        or public.tenants_share_communio_group(tu.tenant_id, cr.tenant_id)
      )
  )
);

-- 4) Tighten Familia creation to tenant admins or global admins/stewards
--    (keeps operator stewardship workflows possible while protecting tenant autonomy)
drop policy if exists "Familia created by tenant steward" on public.familias;
create policy "Familia created by tenant steward"
on public.familias
for insert
to public
with check (
  (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = auth.uid()
        and tu.tenant_id = familias.created_by_tenant_id
    )
  )
  and
  (
    public.is_tenant_admin(familias.created_by_tenant_id)
    or public.has_any_role(auth.uid(), array['admin'::public.app_role, 'steward'::public.app_role])
  )
);

-- 5) Tighten Familia membership mutation boundaries to leadership roles
-- Insert
drop policy if exists "Membership insert by own tenant" on public.familia_memberships;
create policy "Membership insert by own tenant"
on public.familia_memberships
for insert
to public
with check (
  (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = auth.uid()
        and tu.tenant_id = familia_memberships.tenant_id
    )
  )
  and
  (
    public.is_tenant_admin(familia_memberships.tenant_id)
    or public.has_any_role(auth.uid(), array['admin'::public.app_role, 'steward'::public.app_role])
  )
);

-- Update
drop policy if exists "Membership update by own tenant" on public.familia_memberships;
create policy "Membership update by own tenant"
on public.familia_memberships
for update
to public
using (
  (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = auth.uid()
        and tu.tenant_id = familia_memberships.tenant_id
    )
  )
  and
  (
    public.is_tenant_admin(familia_memberships.tenant_id)
    or public.has_any_role(auth.uid(), array['admin'::public.app_role, 'steward'::public.app_role])
  )
)
with check (
  (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = auth.uid()
        and tu.tenant_id = familia_memberships.tenant_id
    )
  )
  and
  (
    public.is_tenant_admin(familia_memberships.tenant_id)
    or public.has_any_role(auth.uid(), array['admin'::public.app_role, 'steward'::public.app_role])
  )
);

-- Delete (needed for leave flows, now leadership-scoped)
drop policy if exists "Membership delete by own tenant" on public.familia_memberships;
create policy "Membership delete by own tenant"
on public.familia_memberships
for delete
to public
using (
  (
    exists (
      select 1
      from public.tenant_users tu
      where tu.user_id = auth.uid()
        and tu.tenant_id = familia_memberships.tenant_id
    )
  )
  and
  (
    public.is_tenant_admin(familia_memberships.tenant_id)
    or public.has_any_role(auth.uid(), array['admin'::public.app_role, 'steward'::public.app_role])
  )
);