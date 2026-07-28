/**
 * queryKeys — Centralized TanStack Query key factory.
 *
 * WHAT: Per-domain key helpers used by data hooks. Keys are tuples so
 *       partial invalidation works (e.g. queryClient.invalidateQueries({
 *       queryKey: queryKeys.people.all() })).
 * WHERE: Imported by every src/data/<domain>/*.ts hook. Never hand-build
 *        ['people', tenantId, ...] arrays inline — always go through here.
 * WHY: Prevents key drift, makes invalidation safe, and centralizes the
 *      tenant-scoping convention.
 *
 * Convention: every tenant-scoped resource is keyed as
 *   [<domain>, tenantId, <subresource?>, ...params]
 * Non-tenant resources are keyed as [<domain>, ...params].
 */

export const queryKeys = {
  // ── Tenant-scoped domains ────────────────────────────────────────────────
  // NOTE: cache prefix is 'contacts' (matches DB table) so legacy
  // invalidateQueries({ queryKey: ['contacts'] }) calls in 10+ files keep
  // matching. The exported namespace stays `people` to mirror UI language.
  people: {
    all: (tenantId: string) => ['contacts', tenantId] as const,
    list: (tenantId: string, filters?: Record<string, unknown>) =>
      ['contacts', tenantId, 'list', filters ?? {}] as const,
    detail: (tenantId: string, personId: string) =>
      ['contacts', tenantId, 'detail', personId] as const,
    households: (tenantId: string, contactIds: string[]) =>
      ['contacts', tenantId, 'households', [...contactIds].sort()] as const,
    householdMembers: (tenantId: string, contactId: string) =>
      ['contacts', tenantId, 'household-members', contactId] as const,
  },
  opportunities: {
    all: (tenantId: string) => ['opportunities', tenantId] as const,
    list: (tenantId: string, filters?: Record<string, unknown>) =>
      ['opportunities', tenantId, 'list', filters ?? {}] as const,
    detail: (tenantId: string, id: string) =>
      ['opportunities', tenantId, 'detail', id] as const,
  },
  events: {
    all: (tenantId: string) => ['events', tenantId] as const,
    list: (tenantId: string, filters?: Record<string, unknown>) =>
      ['events', tenantId, 'list', filters ?? {}] as const,
    detail: (tenantId: string, id: string) =>
      ['events', tenantId, 'detail', id] as const,
    attendees: (tenantId: string, eventId: string) =>
      ['events', tenantId, 'attendees', eventId] as const,
    reflections: (eventId: string) =>
      ['events', 'reflections', eventId] as const,
  },
  activities: {
    all: (tenantId: string) => ['activities', tenantId] as const,
    list: (tenantId: string, filters?: Record<string, unknown>) =>
      ['activities', tenantId, 'list', filters ?? {}] as const,
  },
  grants: {
    all: (tenantId: string) => ['grants', tenantId] as const,
    detail: (tenantId: string, id: string) =>
      ['grants', tenantId, 'detail', id] as const,
  },
  volunteers: {
    all: (tenantId: string) => ['volunteers', tenantId] as const,
    detail: (tenantId: string, id: string) =>
      ['volunteers', tenantId, 'detail', id] as const,
  },
  provisions: {
    all: (tenantId: string) => ['provisions', tenantId] as const,
    detail: (tenantId: string, id: string) =>
      ['provisions', tenantId, 'detail', id] as const,
  },
  projects: {
    all: (tenantId: string) => ['projects', tenantId] as const,
    detail: (tenantId: string, id: string) =>
      ['projects', tenantId, 'detail', id] as const,
  },
  reflections: {
    all: (tenantId: string) => ['reflections', tenantId] as const,
    forContact: (tenantId: string, contactId: string) =>
      ['reflections', tenantId, 'contact', contactId] as const,
  },
  metros: {
    all: (tenantId: string) => ['metros', tenantId] as const,
    detail: (tenantId: string, metroId: string) =>
      ['metros', tenantId, 'detail', metroId] as const,
    narrative: (tenantId: string, metroId: string) =>
      ['metros', tenantId, 'narrative', metroId] as const,
  },
  campaigns: {
    all: (tenantId: string) => ['campaigns', tenantId] as const,
    detail: (tenantId: string, id: string) =>
      ['campaigns', tenantId, 'detail', id] as const,
  },
  testimonium: {
    all: (tenantId: string) => ['testimonium', tenantId] as const,
    report: (tenantId: string, id: string) =>
      ['testimonium', tenantId, 'report', id] as const,
  },
  tenant: {
    settings: (tenantId: string) => ['tenant', tenantId, 'settings'] as const,
    members: (tenantId: string) => ['tenant', tenantId, 'members'] as const,
    subscription: (tenantId: string) => ['tenant', tenantId, 'subscription'] as const,
  },

  // ── Non-tenant / global domains ──────────────────────────────────────────
  auth: {
    session: () => ['auth', 'session'] as const,
    user: (userId: string) => ['auth', 'user', userId] as const,
  },
  operator: {
    apps: () => ['operator', 'apps'] as const,
    tenants: (filters?: Record<string, unknown>) =>
      ['operator', 'tenants', filters ?? {}] as const,
    tenantDetail: (tenantId: string) =>
      ['operator', 'tenants', 'detail', tenantId] as const,
    system: () => ['operator', 'system'] as const,
  },
  federation: {
    apps: (filters?: Record<string, unknown>) =>
      ['federation', 'apps', filters ?? {}] as const,
  },
  marketing: {
    essays: () => ['marketing', 'essays'] as const,
    essay: (slug: string) => ['marketing', 'essays', slug] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
