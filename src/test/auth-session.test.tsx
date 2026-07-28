/**
 * Auth session cleanup tests.
 *
 * WHAT: Tests signOut clears all state and delegates to supabase.
 * WHERE: src/contexts/AuthContext.tsx
 * WHY: Prevents session leaks across users.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';

// ── Mock supabase ──────────────────────────────────────

const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue({}));
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
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
// Must import DemoModeProvider since AuthProvider depends on it
import { DemoModeProvider } from '@/contexts/DemoModeContext';

function wrapper({ children }: { children: ReactNode }) {
  return <DemoModeProvider><AuthProvider>{children}</AuthProvider></DemoModeProvider>;
}

describe('Auth session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initial state is null/loading when no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    // After init resolves, user should be null
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.roles).toEqual([]);
  });

  it('signOut delegates to supabase.auth.signOut and clears state', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.roles).toEqual([]);
  });

  it('isAdmin / isSteward / isLeadership default to false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isSteward).toBe(false);
    expect(result.current.isLeadership).toBe(false);
    expect(result.current.isRegionalLead).toBe(false);
  });
});
