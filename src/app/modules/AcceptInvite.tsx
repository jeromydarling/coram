/**
 * The other end of a link a steward handed someone.
 *
 * Mirrors Login's shell rather than inventing a second one — this is the same
 * moment (someone about to have a session for the first time), just arrived at
 * from a link instead of typing a workspace's own address in.
 *
 * The password field means two different things depending on `hasAccount`,
 * and says so: for a brand-new address it sets one, for an address that
 * already has an account it is the proof that this really is that account's
 * owner clicking the link rather than someone who merely intercepted it. See
 * api/auth.ts's accept route for why that proof is required rather than
 * skipped.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mark } from '@/components/coram/Mark';
import { api, post } from '@/lib/api';
import { ApiError } from '@/lib/api';

interface InvitePreview {
  workspaceName: string;
  email: string;
  role: string;
  hasAccount: boolean;
}

export function AcceptInvite() {
  const { token = '' } = useParams();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<InvitePreview>(`/auth/invites/${token}`)
      .then(setInvite)
      .catch((e: unknown) =>
        setLoadError(e instanceof ApiError ? e.message : 'That invitation could not be read.'),
      );
  }, [token]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await post(`/auth/invites/${token}/accept`, {
        password,
        ...(invite?.hasAccount ? {} : { displayName: displayName.trim() || undefined }),
      });
      // Full reload, same reason as Login: the session cookie just changed
      // and every query in the app needs to see that.
      window.location.href = '/app/';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept that invitation.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between bg-sidebar px-12 py-14 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <Mark size={24} className="text-sidebar-foreground" />
          <span className="font-display text-xl tracking-tight">Coram</span>
        </div>
        <p className="max-w-[22ch] font-display text-4xl leading-[1.05]">
          Somebody handed you this link on purpose.
        </p>
        <p className="text-xs text-sidebar-foreground/45">
          A workspace here is never one person for long by design. What you are about to join
          works better with two.
        </p>
      </aside>

      <main className="flex min-h-screen flex-col justify-center px-6 py-14 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Mark size={22} className="text-foreground" />
            <span className="font-display text-lg tracking-tight">Coram</span>
          </div>

          {loadError ? (
            <>
              <h1 className="text-3xl">That link didn’t work</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{loadError}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Ask whoever sent it to invite you again — invitations are good for seven days.
              </p>
            </>
          ) : !invite ? (
            <p className="text-sm text-muted-foreground">Reading that invitation…</p>
          ) : (
            <>
              <h1 className="text-3xl">Join {invite.workspaceName}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                As {invite.email}, with the <span className="font-medium text-foreground">{invite.role}</span>{' '}
                role.
              </p>

              <form
                className="mt-8 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void accept();
                }}
              >
                {!invite.hasAccount && (
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Your name in this workspace</Label>
                    <Input
                      id="displayName"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">
                    {invite.hasAccount ? 'Your existing password' : 'Choose a password'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={invite.hasAccount ? 'current-password' : 'new-password'}
                    required
                    minLength={invite.hasAccount ? undefined : 12}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {invite.hasAccount && (
                    <p className="text-xs text-muted-foreground">
                      {invite.email} already has an account here. Enter its password to prove that
                      is you — this link alone is not enough.
                    </p>
                  )}
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
                  {busy ? 'Joining…' : `Join ${invite.workspaceName}`}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
