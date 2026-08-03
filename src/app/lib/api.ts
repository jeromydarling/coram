/**
 * The one way this app talks to the Worker.
 *
 * Every route answers with the same envelope — `{ ok: true, data }` or
 * `{ ok: false, error, code }` — so unwrapping it in one place means no screen
 * has to remember to check, and a 502 from the model gateway surfaces as the
 * sentence the API wrote rather than as "[object Object]".
 *
 * Session is a cookie set by the Worker: HttpOnly, SameSite=Lax, and Secure in
 * production. There is deliberately no token in JavaScript to steal, which is
 * why `credentials: 'same-origin'` is the only auth configuration here.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  notice?: string;
  message?: string;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError('The server sent something we could not read.', res.status);
  }

  if (!res.ok || !body.ok) {
    throw new ApiError(body.error ?? `Request failed (${res.status}).`, res.status, body.code);
  }
  return body.data as T;
}

export const post = <T,>(path: string, payload: unknown = {}) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(payload) });

export const patch = <T,>(path: string, payload: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(payload) });

export const put = <T,>(path: string, payload: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(payload) });

export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });

/**
 * The same envelope, but keeping the `notice` beside the data.
 *
 * Several routes answer with something the person needs to read — "closed, and
 * everything on this case is deleted in thirty days", "snoozed three times, it
 * may be worth handing this to someone else". Dropping that on the floor is
 * how a product ends up doing irreversible things quietly.
 */
export async function apiWithNotice<T, M = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; notice?: string; meta: M }> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError('The server sent something we could not read.', res.status);
  }
  if (!res.ok || !body.ok) {
    throw new ApiError(body.error ?? `Request failed (${res.status}).`, res.status, body.code);
  }
  // Routes attach their extras at the top level (`ok(rows, { overdue })`), so
  // meta is whatever is left once the envelope's own two keys are removed.
  const rest = { ...(body as unknown as Record<string, unknown>) };
  delete rest.ok;
  delete rest.data;
  return { data: body.data as T, notice: body.notice ?? body.message, meta: rest as M };
}

export const postWithNotice = <T, M = Record<string, unknown>>(
  path: string,
  payload: unknown = {},
) => apiWithNotice<T, M>(path, { method: 'POST', body: JSON.stringify(payload) });

// ---------------------------------------------------------------------------
// Shapes. Only the fields the UI reads — a mirror of the whole row would go
// stale silently, and these are checked against the live API at build time by
// nothing at all, so keeping them small keeps them honest.
// ---------------------------------------------------------------------------

export interface Workspace {
  tenant: { id: string; name: string; slug: string; tier: string; contact_count: string };
  me: { role: string; display_name: string | null; turf_ids: string[] };
}

export interface EventRow {
  id: string;
  title: string;
  starts_at: string;
  location_name: string | null;
  capacity: number | null;
  going: number;
  waitlisted: number;
  cancelled_at: string | null;
}

export interface FundRow {
  id: string;
  name: string;
  kind: string;
  goal_cents: string | null;
  raised_cents: string;
  available_cents: string;
  currency: string;
}

export interface ProposalRow {
  id: string;
  title: string;
  status: string;
  decided_at: string | null;
  comments: number;
}

export interface BillRow {
  id: string;
  working_name: string;
  jurisdiction: string;
  locality: string | null;
  route: string;
  stage: string;
  filed_as: string | null;
  sections: number;
  endorsements: number;
  updated_at: string;
}

export interface ContactRow {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  postal_code: string | null;
  turf_id: string | null;
  last_interaction_at: string | null;
}

export const money = (cents: string | number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(cents) / 100,
  );

/** `seeking_sponsor` → `seeking sponsor`. Enum values are for the database. */
export const words = (value: string) => value.replace(/_/g, ' ');

export const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * "in 3 days", "6 days ago". Used on queues, where the absolute date is less
 * useful than whether the thing is late.
 */
export function fromNow(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  const table: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
    ['week', 604_800_000],
    ['month', 2_629_800_000],
    ['year', 31_557_600_000],
  ];
  let unit: Intl.RelativeTimeFormatUnit = 'minute';
  let size = 60_000;
  for (const [u, s] of table) {
    if (Math.abs(ms) >= s) {
      unit = u;
      size = s;
    }
  }
  return rtf.format(Math.round(ms / size), unit);
}

export const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
