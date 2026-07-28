/**
 * Demo mode unit tests.
 *
 * WHAT: Tests DemoModeContext session lifecycle, role switching, and write simulation.
 * WHERE: src/contexts/DemoModeContext.tsx
 * WHY: Ensures demo mode can never leak writes and always provides correct synthetic state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { DemoModeProvider, useDemoMode, useDemoGuard, type DemoSession } from '@/contexts/DemoModeContext';

// ── Helpers ────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <DemoModeProvider>{children}</DemoModeProvider>;
}

const MOCK_SESSION: DemoSession = {
  name: 'Test User',
  email: 'test@example.org',
  location: 'Denver, CO',
  role: 'steward',
  grantedAt: '2026-03-20T00:00:00.000Z',
};

describe('DemoModeContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it('starts inactive when no session in storage', () => {
    const { result } = renderHook(() => useDemoMode(), { wrapper });
    expect(result.current.isDemoMode).toBe(false);
    expect(result.current.demoSession).toBeNull();
    expect(result.current.demoRole).toBe('companion'); // fallback
  });

  it('activates on startDemo and persists to sessionStorage', () => {
    const { result } = renderHook(() => useDemoMode(), { wrapper });

    act(() => result.current.startDemo(MOCK_SESSION));

    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.demoSession?.name).toBe('Test User');
    expect(result.current.demoRole).toBe('steward');

    const stored = JSON.parse(sessionStorage.getItem('cros_demo_session')!);
    expect(stored.email).toBe('test@example.org');
  });

  it('restores session from sessionStorage on mount', () => {
    sessionStorage.setItem('cros_demo_session', JSON.stringify(MOCK_SESSION));

    const { result } = renderHook(() => useDemoMode(), { wrapper });
    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.demoSession?.role).toBe('steward');
  });

  it('endDemo clears session and storage', () => {
    sessionStorage.setItem('cros_demo_session', JSON.stringify(MOCK_SESSION));
    const { result } = renderHook(() => useDemoMode(), { wrapper });

    act(() => result.current.endDemo());

    expect(result.current.isDemoMode).toBe(false);
    expect(result.current.demoSession).toBeNull();
    expect(sessionStorage.getItem('cros_demo_session')).toBeNull();
  });

  it('setDemoRole updates role and persists', () => {
    const { result } = renderHook(() => useDemoMode(), { wrapper });
    act(() => result.current.startDemo(MOCK_SESSION));
    act(() => result.current.setDemoRole('visitor'));

    expect(result.current.demoRole).toBe('visitor');
    const stored = JSON.parse(sessionStorage.getItem('cros_demo_session')!);
    expect(stored.role).toBe('visitor');
  });

  it('setDemoRole is no-op when no session', () => {
    const { result } = renderHook(() => useDemoMode(), { wrapper });
    act(() => result.current.setDemoRole('shepherd'));
    expect(result.current.demoSession).toBeNull();
  });

  it('simulateWrite returns true without throwing', () => {
    const { result } = renderHook(() => useDemoMode(), { wrapper });
    act(() => result.current.startDemo(MOCK_SESSION));

    let returnVal: boolean | undefined;
    act(() => {
      returnVal = result.current.simulateWrite('Test action');
    });
    expect(returnVal).toBe(true);
  });

  it('provides correct demo tenant constants', () => {
    const { result } = renderHook(() => useDemoMode(), { wrapper });
    expect(result.current.demoTenantSlug).toBe('community-tech-alliance');
    expect(result.current.demoTenantId).toBe('a2916470-63cd-464b-9f70-17c6a75a5416');
  });
});

describe('useDemoGuard', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('guardedMutate executes real function when not in demo mode', () => {
    const { result } = renderHook(() => useDemoGuard(), { wrapper });
    const fn = vi.fn(() => 42);

    let val: number | undefined;
    act(() => {
      val = result.current.guardedMutate(fn, 'test');
    });

    expect(fn).toHaveBeenCalledOnce();
    expect(val).toBe(42);
  });

  it('guardedMutate intercepts and returns undefined in demo mode', () => {
    sessionStorage.setItem('cros_demo_session', JSON.stringify(MOCK_SESSION));
    const { result } = renderHook(() => useDemoGuard(), { wrapper });
    const fn = vi.fn(() => 42);

    let val: number | undefined;
    act(() => {
      val = result.current.guardedMutate(fn, 'test');
    });

    expect(fn).not.toHaveBeenCalled();
    expect(val).toBeUndefined();
  });
});
