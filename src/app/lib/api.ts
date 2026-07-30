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

/** POST helper, because every mutation in this app is a POST with a JSON body. */
export const post = <T,>(path: string, payload: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(payload) });

// ---------------------------------------------------------------------------
// Shapes. Only the fields the UI reads — a mirror of the whole row would go
// stale silently, and these are checked against the live API at build time by
// nothing at all, so keeping them small keeps them honest.
// ---------------------------------------------------------------------------

export interface Workspace {
  tenant: { id: string; name: string; slug: string; tier: string; contact_count: string };
  me: { role: string; display_name: string | null; turf_ids: string };
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
}

export const money = (cents: string | number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(cents) / 100,
  );

export const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
