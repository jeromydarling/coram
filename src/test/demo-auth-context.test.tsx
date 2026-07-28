/**
 * Demo mode AuthContext integration tests.
 *
 * WHAT: Verifies AuthContext provides correct synthetic profile/roles in demo mode.
 * WHERE: src/contexts/AuthContext.tsx demo bypass logic.
 * WHY: Ensures demo users get correct lens roles without touching auth.users.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';

// ── Mock supabase ──────────────────────────────────────
const mockGetSession = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { session: null } }),
);
const mockOnAuthStateChange = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  }),
);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
          limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
          single: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

import { DemoModeProvider, type DemoSession } from '@/contexts/DemoModeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const MOCK_SESSION: DemoSession = {
  name: 'Demo Tester',
  email: 'demo@test.org',
  location: 'Austin, TX',
  role: 'shepherd',
  grantedAt: new Date().toISOString(),
};

function createWrapper(session: DemoSession | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DemoModeProvider>
        <DemoSessionInjector session={session}>
          <AuthProvider>{children}</AuthProvider>
        </DemoSessionInjector>
      </DemoModeProvider>
    );
  };
}

// Helper that starts demo before auth renders
function DemoSessionInjector({ session, children }: { session: DemoSession | null; children: ReactNode }) {
  // We use sessionStorage to pre-load the demo session
  if (session) {
    sessionStorage.setItem('cros_demo_session', JSON.stringify(session));
  }
  return <>{children}</>;
}

describe('AuthContext in demo mode', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('provides synthetic profile with demo name when demo is active', async () => {
    sessionStorage.setItem('cros_demo_session', JSON.stringify(MOCK_SESSION));
    // Need to re-create provider so it reads from storage
    const Wrapper = createWrapper(MOCK_SESSION);
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profile?.display_name).toBe('Demo Tester');
    expect(result.current.isApproved).toBe(true);
    expect(result.current.isAdmin).toBe(false); // demo never admin
    expect(result.current.user?.id).toBe('demo-user-id');
  });

  it('steward demo gets isSteward=true', async () => {
    const stewardSession = { ...MOCK_SESSION, role: 'steward' as const };
    sessionStorage.setItem('cros_demo_session', JSON.stringify(stewardSession));
    const Wrapper = createWrapper(stewardSession);
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isSteward).toBe(true);
    expect(result.current.isLeadership).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('visitor demo gets no special roles', async () => {
    const visitorSession = { ...MOCK_SESSION, role: 'visitor' as const };
    sessionStorage.setItem('cros_demo_session', JSON.stringify(visitorSession));
    const Wrapper = createWrapper(visitorSession);
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isSteward).toBe(false);
    expect(result.current.isLeadership).toBe(false);
    expect(result.current.roles).toEqual([]);
  });
});
