/**
 * Sign in.
 *
 * The first thing anyone sees, and until now the last screen still built out of
 * bare inputs and a grey button — which made the product look like a utility
 * before a person had even reached it.
 *
 * The demo is a button rather than two credentials printed and left to be typed
 * on a phone. Someone evaluating this on a train should be two taps from a
 * populated workspace.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mark } from '@/components/coram/Mark';
import { post } from '@/lib/api';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@shared/demo';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(withEmail: string, withPassword: string) {
    setBusy(true);
    setError(null);
    try {
      await post('/auth/login', { email: withEmail, password: withPassword });
      // A full reload rather than a client navigation: the session cookie
      // changes what every query returns, and refetching everything is exactly
      // what we want here.
      window.location.href = '/app/';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1fr_1.1fr]">
      {/*
        The ink half. Carries the four commitments from §2 in the group's own
        colours, so the page argues for the product rather than just admitting
        people to it. Hidden below lg — on a phone the form is the whole job.
      */}
      <aside className="hidden flex-col justify-between bg-sidebar px-12 py-14 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <Mark size={24} className="text-sidebar-foreground" />
          <span className="font-display text-xl tracking-tight">Coram</span>
        </div>

        <div>
          <p className="max-w-[22ch] font-display text-4xl leading-[1.05]">
            Everything your movement runs on. One place.
          </p>
          <ul className="mt-10 space-y-4">
            {[
              ['flame', 'We will never sell, share or mine your data.'],
              ['gold', 'You can export everything, any time, in a format we document.'],
              ['teal', 'When you delete something, it is gone.'],
              ['deep', 'We will tell you when someone asks us for your data.'],
            ].map(([tone, line]) => (
              <li key={line} className="flex gap-3.5 text-[0.95rem] leading-snug">
                <span
                  aria-hidden
                  className={
                    'mt-[0.45rem] h-2 w-2 shrink-0 rounded-full ' +
                    { flame: 'bg-flame', gold: 'bg-gold', teal: 'bg-teal', deep: 'bg-deep' }[
                      tone as 'flame'
                    ]
                  }
                />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/45">
          Closed source, and we say so. Audited claims live at{' '}
          <a href="/trust" className="underline underline-offset-4">
            /trust
          </a>
          .
        </p>
      </aside>

      <main className="flex min-h-screen flex-col justify-center px-6 py-14 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Mark size={22} className="text-foreground" />
            <span className="font-display text-lg tracking-tight">Coram</span>
          </div>

          <h1 className="text-3xl">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            To your workspace. Sessions are a cookie this app cannot read.
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void signIn(email, password);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-2.5 text-sm"
              >
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {/* Gold, so the demo reads as an invitation rather than as an
              error state. --tone is set on the box and everything inside it
              follows, which is the same mechanism the Shell uses per module. */}
          <div
            className="mt-10 rounded-lg border border-tone/30 bg-tone/[0.05] px-5 py-4"
            style={{ '--tone': 'var(--gold)' } as React.CSSProperties}
          >
            <p className="eyebrow">Just looking</p>
            <p className="mt-2 text-sm leading-relaxed">
              A working workspace belonging to the Eastside Tenants Union, who do not exist. You
              sign in as one of their organizers: 240 people, a bill at the seeking-a-sponsor
              stage, and five follow-ups somebody owes.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              disabled={busy}
              onClick={() => void signIn(DEMO_EMAIL, DEMO_PASSWORD)}
            >
              Open the demo workspace
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
