/**
 * Sign in.
 *
 * The demo credentials are offered as a button rather than printed and left to
 * be typed on a phone. Someone evaluating this product on the train should be
 * two taps from a populated workspace.
 */

import { useState } from 'react';

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
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="font-serif text-3xl">Coram</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace.</p>

      <form
        className="mt-8 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(email, password);
        }}
      >
        <label className="block text-sm">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-8 rounded border border-dashed p-4">
        <p className="text-sm font-medium">Just looking?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A real workspace belonging to a tenants&rsquo; union that does not exist. Read-only.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void signIn(DEMO_EMAIL, DEMO_PASSWORD)}
          className="mt-3 w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          Open the demo workspace
        </button>
      </div>
    </div>
  );
}
