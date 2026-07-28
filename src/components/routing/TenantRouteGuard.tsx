/**
 * TenantRouteGuard — Validates tenant slug and redirects as needed.
 *
 * WHAT: Ensures URL tenant slug matches the user's tenant; redirects to
 *       onboarding or sponsored setup when needed.
 * WHERE: Wraps all /:tenantSlug/* routes.
 * WHY: Single checkpoint for tenant validation, onboarding gating, and
 *       first-login setup for operator-granted tenants.
 */

import { useEffect } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoMode } from '@/contexts/DemoModeContext';

export function TenantRouteGuard() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, isLoading } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  const { isDemoMode, demoTenantSlug } = useDemoMode();
  const navigate = useNavigate();

  const isDemoBypass = isDemoMode && tenantSlug === demoTenantSlug;

  const { data: onboardingState, isLoading: isLoadingOnboarding } = useQuery({
    queryKey: ['tenant-onboarding-state', tenant?.id],
    enabled: !isDemoBypass && !!tenant?.id && tenant?.is_operator_granted === true,
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_onboarding_state')
        .select('completed')
        .eq('tenant_id', tenant!.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  // Slug-rename grace period: if the URL uses an old slug, look up the
  // current one and silently redirect (90-day TTL enforced server-side).
  const { data: slugRedirect } = useQuery({
    queryKey: ['tenant-slug-redirect', tenantSlug],
    enabled: !isDemoBypass && !!tenantSlug && !!tenant && tenantSlug !== tenant.slug,
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_slug_redirects' as any)
        .select('tenant_id')
        .eq('old_slug', tenantSlug!)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      return (data as unknown as { tenant_id: string } | null) ?? null;
    },
  });

  useEffect(() => {
    // Race fix: wait for BOTH auth and tenant resolution before deciding to
    // bounce to /onboarding. Previously a brief tenant=null between auth
    // success and tenant load was enough to eject paying users.
    if (isDemoBypass || isLoading || authLoading) return;

    // If there's no authenticated user yet, let upstream auth guards handle
    // it — don't push everyone through /onboarding.
    if (!user) return;

    if (!tenant) {
      navigate('/onboarding', { replace: true });
      return;
    }

    if (tenantSlug && tenantSlug !== tenant.slug) {
      // Pre-mortem #2: if the URL slug points at one of OUR old slugs
      // (slug-rename grace period), redirect to the new one silently.
      // Otherwise it's a cross-tenant deep link — send them to their
      // own tenant root rather than 404'ing.
      const rest = window.location.pathname.replace(`/${tenantSlug}`, '');
      if (slugRedirect && slugRedirect.tenant_id === tenant.id) {
        navigate(`/${tenant.slug}${rest || '/'}`, { replace: true });
        return;
      }
      // Cross-tenant link — drop the foreign path and land on tenant root.
      navigate(`/${tenant.slug}/`, { replace: true });
      return;
    }

    if (
      tenant.is_operator_granted &&
      !isLoadingOnboarding &&
      onboardingState &&
      onboardingState.completed === false
    ) {
      navigate('/sponsored-setup', { replace: true });
    }
  }, [tenant, tenantSlug, isLoading, authLoading, user, isLoadingOnboarding, onboardingState, slugRedirect, navigate, isDemoBypass]);

  if (isDemoBypass) return <Outlet />;
  if (isLoading || authLoading) return null;
  if (!tenant) return null;
  if (tenant.is_operator_granted && isLoadingOnboarding) return null;

  return <Outlet />;
}
