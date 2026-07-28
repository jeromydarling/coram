/**
 * Role-Based Access Control tests for ProtectedRoute.
 *
 * WHAT: Tests that ProtectedRoute renders/blocks based on AppRole.
 * WHERE: Wraps all authenticated routes.
 * WHY: Ensures unauthorized roles cannot access gated pages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──────────────────────────────────────────────

const mockAuthValue = vi.hoisted(() => ({
  user: null as any,
  isLoading: false,
  hasAnyRole: vi.fn((_roles: any[]) => false),
  roles: [] as string[],
  isApproved: true,
  isAdmin: false,
  profile: { ministry_role: 'companion' },
  signOut: vi.fn(),
}));

const mockViewMode = vi.hoisted(() => ({
  isFullWorkspace: true,
}));

const mockTenant = vi.hoisted(() => ({
  tenant: { id: 'tenant-1' } as any,
  isLoading: false,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock('@/contexts/ViewModeContext', () => ({
  useViewMode: () => mockViewMode,
}));

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: () => mockTenant,
}));

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function renderProtected(requiredRoles?: any[], denyRoles?: any[]) {
  return render(
    <MemoryRouter initialEntries={['/test-tenant/dashboard']}>
      <ProtectedRoute requiredRoles={requiredRoles} denyRoles={denyRoles}>
        <div data-testid="protected-content">Secret Content</div>
      </ProtectedRoute>
    </MemoryRouter>,
  );
}

function q(container: HTMLElement, testId: string) {
  return container.querySelector(`[data-testid="${testId}"]`);
}

function findText(container: HTMLElement, text: string) {
  return container.textContent?.includes(text) ?? false;
}

describe('ProtectedRoute — Role Gating', () => {
  beforeEach(() => {
    mockAuthValue.user = { id: 'u1', email: 'test@test.com' };
    mockAuthValue.isLoading = false;
    mockAuthValue.isApproved = true;
    mockAuthValue.isAdmin = false;
    mockAuthValue.roles = [];
    mockAuthValue.hasAnyRole.mockReturnValue(false);
    mockAuthValue.profile = { ministry_role: 'companion' };
    mockTenant.tenant = { id: 'tenant-1' };
    mockTenant.isLoading = false;
    mockViewMode.isFullWorkspace = true;
  });

  it('renders children when no role requirements are specified', () => {
    const { container } = renderProtected();
    expect(q(container, 'protected-content')).toBeTruthy();
  });

  it('renders children when user has required role', () => {
    mockAuthValue.roles = ['admin'];
    mockAuthValue.hasAnyRole.mockReturnValue(true);
    const { container } = renderProtected(['admin']);
    expect(q(container, 'protected-content')).toBeTruthy();
  });

  it('shows access denied when user lacks required role', () => {
    mockAuthValue.roles = ['staff'];
    mockAuthValue.hasAnyRole.mockReturnValue(false);
    const { container } = renderProtected(['admin']);
    expect(findText(container, 'Access Denied')).toBe(true);
    expect(q(container, 'protected-content')).toBeNull();
  });

  it('blocks denied roles even if other requirements pass', () => {
    mockAuthValue.roles = ['warehouse_manager'];
    mockAuthValue.hasAnyRole.mockReturnValue(true);
    const { container } = renderProtected(undefined, ['warehouse_manager']);
    expect(findText(container, 'Access Denied')).toBe(true);
  });

  it('redirects to /login when user is null (unauthenticated)', () => {
    mockAuthValue.user = null;
    const { container } = renderProtected();
    expect(q(container, 'protected-content')).toBeNull();
  });

  it('shows pending approval when user is not approved, not admin, and has no tenant', () => {
    mockAuthValue.isApproved = false;
    mockAuthValue.isAdmin = false;
    mockTenant.tenant = null;
    const { container } = renderProtected();
    expect(findText(container, 'Account Pending Approval')).toBe(true);
  });

  it('allows admin users even if not explicitly approved', () => {
    mockAuthValue.isApproved = false;
    mockAuthValue.isAdmin = true;
    const { container } = renderProtected();
    expect(q(container, 'protected-content')).toBeTruthy();
  });

  it('allows tenant members even if not explicitly approved', () => {
    mockAuthValue.isApproved = false;
    mockAuthValue.isAdmin = false;
    mockTenant.tenant = { id: 'tenant-1' };
    const { container } = renderProtected();
    expect(q(container, 'protected-content')).toBeTruthy();
  });

  it('shows loading spinner while auth is loading', () => {
    mockAuthValue.isLoading = true;
    const { container } = renderProtected();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
