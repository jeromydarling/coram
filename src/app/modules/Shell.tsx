/**
 * The signed-in frame: who you are, what you can reach, and how to leave.
 *
 * The nav is generated from MODULES, which is §5's closed list of eleven. That
 * is deliberate: the previous shell had six hand-written links and the product
 * looked — correctly — like it was missing most of itself. Adding a module to
 * the spec now breaks a test until it has somewhere to go.
 *
 * §8.4 forbids motion inside /app, so nothing here slides, fades or spins. The
 * sheet on mobile opens; it does not animate. Someone may be using this at 11pm
 * after an eviction hearing, and animation is not what they need.
 *
 * The role badge is not decoration. Access is turf- and role-scoped in the
 * database, so what a person sees genuinely differs from what their colleague
 * sees — and a UI that hides that makes a working boundary look like a bug.
 */

import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Menu, Palette, Settings } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Mark } from '@/components/coram/Mark';
import { api, post, type Workspace } from '@/lib/api';
import { GROUPS, MODULES, TONE_BG, moduleAt, toneVar } from '@/lib/modules';
import { cn } from '@/lib/utils';

/** Plain-language gloss on each role, carried as the role badge's tooltip. */
const ROLE_MEANS: Record<string, string> = {
  steward: 'Full access, including billing and the burn switch.',
  organizer: 'Your turf: the people assigned to you, and everything you can do for them.',
  member: 'Your own record, events, proposals and the group’s channels.',
  legal: 'Safety and jail support only, by design — not the contact list.',
  observer: 'Read-only totals. No individual contact records, ever.',
};

export function Shell() {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['workspace'], queryFn: () => api<Workspace>('/workspace') });
  const current = moduleAt(pathname);

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop rail. */}
      {/*
        The rail is one scroll region, not two.

        It used to pin a footer and let only the <nav> scroll, and at a 720px
        viewport that quietly cut off the last group — Drafting and Coalition,
        two of the eleven, invisible with nothing to suggest the rail moved.
        The reachability test passed, because Playwright counts an element
        clipped by a scroll container as visible; a person does not.

        Everything below is also tighter than it was, so at ordinary laptop
        heights all eleven fit without scrolling at all.
      */}
      <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
          <Nav workspace={data} onNavigate={() => undefined} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile bar. The rail is a sheet at this width. */}
        <header className="flex items-center gap-3 border-b px-4 py-3 lg:hidden">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Nav workspace={data} onNavigate={() => setNavOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <Mark size={20} className="shrink-0 text-foreground" />
            <span className="truncate font-display text-base">
              {data?.tenant.name ?? 'Coram'}
            </span>
          </Link>
          {current && (
            <span
              className={cn('ml-auto h-2 w-2 shrink-0 rounded-full', TONE_BG[current.tone])}
              aria-hidden
            />
          )}
        </header>

        {/*
         * --tone follows the route, so `.eyebrow`, `.figure` and `.tone-rule`
         * inside any screen are the module's colour without the screen naming
         * it. A screen that wants a different tone sets its own on a subtree.
         */}
        <main
          className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
          style={current ? toneVar(current.tone) : undefined}
        >
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function Nav({
  workspace,
  onNavigate,
}: {
  workspace: Workspace | undefined;
  onNavigate: () => void;
}) {
  const role = workspace?.me.role;

  return (
    <>
      <div className="border-b border-sidebar-border px-4 py-4">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5">
          <Mark size={22} className="text-sidebar-foreground" />
          <span className="font-display text-lg tracking-tight">Coram</span>
        </Link>
        <p className="mt-3 truncate font-display text-[0.95rem] text-sidebar-accent-foreground">
          {workspace?.tenant.name ?? '—'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {role && (
            <Badge
              variant="outline"
              // The gloss used to be a paragraph pinned above Sign out. It was
              // worth two lines of rail and it was the reason the last group
              // fell off the bottom, so it lives on the badge instead.
              title={ROLE_MEANS[role] ?? 'Your access is scoped by role and by turf.'}
              className="border-sidebar-border text-[0.65rem] uppercase tracking-wider text-sidebar-foreground"
            >
              {role}
            </Badge>
          )}
          {workspace?.tenant.tier && (
            <Badge
              variant="outline"
              className="border-sidebar-border text-[0.65rem] uppercase tracking-wider text-sidebar-foreground/70"
            >
              {workspace.tenant.tier}
            </Badge>
          )}
        </div>
      </div>

      <nav className="flex-1 px-2 py-2.5">
        {GROUPS.map((group) => (
          <div key={group} className="mb-2.5">
            <p className="px-3 pb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
              {group}
            </p>
            <ul>
              {MODULES.filter((m) => m.group === group).map((m) => (
                <li key={m.path}>
                  <NavLink
                    to={m.path}
                    end={m.path === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-[0.3rem] text-[0.9rem]',
                        isActive
                          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      )
                    }
                  >
                    <span
                      aria-hidden
                      className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_BG[m.tone])}
                    />
                    <m.icon aria-hidden className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate">{m.name}</span>
                    <span className="ml-auto truncate font-display text-[0.72rem] italic text-sidebar-foreground/35">
                      {m.latin}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-2">
        {/* Below the module groups on purpose. Neither of these is one of §5's
            eleven, and putting them in a group would make the closed list look
            like it had grown. */}
        <NavLink
          to="/studio"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-3 py-[0.3rem] text-[0.9rem]',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60',
            )
          }
        >
          <Palette aria-hidden className="h-4 w-4 opacity-70" />
          Studio
        </NavLink>
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-3 py-[0.4rem] text-[0.9rem]',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60',
            )
          }
        >
          <Settings aria-hidden className="h-4 w-4 opacity-70" />
          Workspace
        </NavLink>
        {/* A button, not a link: /api/auth/logout is a POST. A GET link here
            404s, and it would also mean any page that could make your browser
            issue a GET could sign you out. */}
        <button
          type="button"
          onClick={() => {
            void post('/auth/logout', {}).finally(() => {
              window.location.href = '/app/login';
            });
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-[0.3rem] text-left text-[0.9rem] text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
        >
          <LogOut aria-hidden className="h-4 w-4 opacity-70" />
          Sign out
        </button>
      </div>
    </>
  );
}
