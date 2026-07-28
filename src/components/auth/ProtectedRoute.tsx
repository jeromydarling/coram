import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { getMinistryRole, VISITOR_BLOCKED_ROUTES, COMPANION_BLOCKED_ROUTES } from '@/lib/ministryRole';

import { useTenant } from '@/contexts/TenantContext';
import { useDemoMode } from '@/contexts/DemoModeContext';

type AppRole = 'admin' | 'regional_lead' | 'staff' | 'leadership' | 'warehouse_manager' | 'steward';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: AppRole[];
  denyRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles, denyRoles }: ProtectedRouteProps) {
  const { user, isLoading, hasAnyRole, roles, isApproved, isAdmin, profile, signOut } = useAuth();
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const { isDemoMode, demoRole, demoTenantSlug } = useDemoMode();
  const location = useLocation();

  // Demo mode bypass: allow through if demo is active and we're on the demo tenant
  if (isDemoMode) {
    const pathSlug = location.pathname.split('/').filter(Boolean)[0];
    if (pathSlug === demoTenantSlug || pathSlug === 'community-tech-alliance') {
      // Check lens-based blocking for demo visitors
      if (demoRole === 'visitor') {
        const pathParts = location.pathname.split('/').filter(Boolean);
        const routeSegment = pathParts.length >= 2 ? pathParts[1] : '';
        if (VISITOR_BLOCKED_ROUTES.includes(routeSegment)) {
          return <Navigate to={`/${demoTenantSlug}/visits`} replace />;
        }
      }

      // Check lens-based blocking for demo companions (SEC-006b)
      if (demoRole === 'companion') {
        const pathParts = location.pathname.split('/').filter(Boolean);
        const routeSegment = pathParts.length >= 2 ? pathParts[1] : '';
        if (COMPANION_BLOCKED_ROUTES.includes(routeSegment)) {
          return <Navigate to={`/${demoTenantSlug}`} replace />;
        }
      }

      // Enforce requiredRoles in demo mode using lens→role mapping (BT-011 / SEC-006)
      if (requiredRoles && requiredRoles.length > 0) {
        const demoRoleToAppRoles: Record<string, string[]> = {
          steward: ['admin', 'leadership', 'staff', 'steward'],
          shepherd: ['staff'],
          companion: [],
          visitor: [],
        };
        const effectiveRoles = demoRoleToAppRoles[demoRole] || [];
        const hasRequired = requiredRoles.some(r => effectiveRoles.includes(r));
        if (!hasRequired) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="text-center max-w-md p-6">
                <h1 className="text-2xl font-bold text-foreground mb-2">Access Limited</h1>
                <p className="text-muted-foreground">
                  This area is available to Stewards. Switch your demo role to Steward to explore admin features.
                </p>
              </div>
            </div>
          );
        }
      }

      return <>{children}</>;
    }
  }

  if (isLoading || isTenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user is approved: admins, tenant members, or explicitly approved users pass
  const hasTenantAccess = !!tenant;
  if (!isApproved && !isAdmin && !hasTenantAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Account Pending Approval</h1>
          <p className="text-muted-foreground mb-4">
            Your account has been created but is awaiting administrator approval. 
            You'll be notified once your account is approved.
          </p>
          <button 
            onClick={async () => { await signOut(); window.location.href = '/login'; }}
            className="text-primary hover:underline text-sm"
          >
            Sign out and try again later
          </button>
        </div>
      </div>
    );
  }

  // Check if user has denied role
  if (denyRoles && denyRoles.length > 0 && hasAnyRole(denyRoles)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Check role requirements if specified
  if (requiredRoles && requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <p className="text-sm text-muted-foreground mt-2">Required: {requiredRoles.join(' or ')} | Your roles: {roles.join(', ') || 'none'}</p>
        </div>
      </div>
    );
  }

  // Visitor ministry role: redirect away from CRM-heavy routes (unconditional — SEC-006)
  const ministryRole = getMinistryRole(profile);
  if (ministryRole === 'visitor') {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const routeSegment = pathParts.length >= 2 ? pathParts[1] : '';
    if (VISITOR_BLOCKED_ROUTES.includes(routeSegment)) {
      const tenantSlug = pathParts[0];
      return <Navigate to={`/${tenantSlug}/visits`} replace />;
    }
  }

  return <>{children}</>;
}
