import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { isMarketingPath } from '@/lib/marketingPaths';

/**
 * Catches legacy bare paths (e.g. /dashboard, /opportunities) and redirects
 * to the tenant-prefixed version (e.g. /my-org/dashboard).
 * Only fires for authenticated users with an active tenant.
 *
 * Marketing/auth/non-tenant routes are decided by isMarketingPath() — the
 * single source of truth in src/lib/marketingPaths.ts.
 */
export function LegacyPathRedirect() {
  const { user, isLoading: authLoading } = useAuth();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authLoading || tenantLoading) return;
    if (!user || !tenant) return;

    const path = location.pathname;

    if (isMarketingPath(path)) return;
    if (path.startsWith(`/${tenant.slug}`)) return;
    
    // If the bare path matches a known tenant slug (e.g. navigating to "/bridge-social-enterprise"),
    // don't double-prefix — redirect to the tenant root instead
    const bareSegment = path.replace(/^\//, '').split('/')[0];
    if (bareSegment === tenant.slug) {
      navigate(`/${tenant.slug}/`, { replace: true });
      return;
    }
    
    // Redirect bare path to tenant-prefixed
    navigate(`/${tenant.slug}${path}`, { replace: true });
  }, [user, tenant, authLoading, tenantLoading, location.pathname, navigate]);

  return null;
}
