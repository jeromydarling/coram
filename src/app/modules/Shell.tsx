/**
 * The signed-in frame: who you are, what you can reach, and how to leave.
 *
 * §8.4 forbids motion inside /app. The marketing site moves; the product is
 * calm, because someone using this may be doing it at 11pm after an eviction
 * hearing and animation is not what they need.
 *
 * The role badge is not decoration. Coram's access model is turf-scoped and
 * role-scoped at the database, so what a person can see genuinely differs from
 * what their colleague can see — and a UI that hides that makes an empty list
 * look like a broken product instead of a working boundary.
 */

import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { api, post, type Workspace } from '@/lib/api';

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/contacts', label: 'People' },
  { to: '/events', label: 'Events' },
  { to: '/decisions', label: 'Decisions' },
  { to: '/funds', label: 'Funds' },
  { to: '/bills', label: 'Bills' },
];

export function Shell() {
  const { pathname } = useLocation();
  const { data } = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-serif text-lg">{data?.tenant.name ?? 'Coram'}</span>
          {data?.me.role && (
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {data.me.role}
            </span>
          )}
          <nav className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={
                  pathname === item.to
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }
              >
                {item.label}
              </Link>
            ))}
            {/* A button, not a link: /api/auth/logout is a POST. A GET link
                here 404s, and it would also mean any page that could make your
                browser issue a GET could sign you out. */}
            <button
              type="button"
              onClick={() => {
                void post('/auth/logout', {}).finally(() => {
                  window.location.href = '/app/login';
                });
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-muted-foreground">
        {data?.me.role === 'observer' && (
          <p>
            You are signed in as an observer — read-only, and individual contact records are not
            visible to this role. That is the access control working, not a fault.
          </p>
        )}
      </footer>
    </div>
  );
}

/** Shared empty/loading/error furniture, so no screen invents its own. */
export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h1 className="font-serif text-2xl">{title}</h1>
      {hint && <p className="mt-1 mb-4 text-sm text-muted-foreground">{hint}</p>}
      <div className={hint ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}

export function Loading() {
  return <p className="text-sm text-muted-foreground">Loading…</p>;
}

/**
 * An empty state that says which of the two reasons it is.
 *
 * "Nothing here yet" and "you are not allowed to see this" look identical in
 * most products and mean completely different things. Conflating them is how a
 * working permission boundary gets reported as a bug.
 */
export function Empty({ reason }: { reason: string }) {
  return <p className="rounded border border-dashed p-6 text-sm text-muted-foreground">{reason}</p>;
}

export function Failed({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return <p className="rounded border border-destructive/40 p-4 text-sm">{message}</p>;
}
