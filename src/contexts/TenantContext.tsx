import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { setErrorCaptureTenantId } from '@/lib/operatorErrorCapture';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  tier: string;
  archetype: string | null;
  status: string;
  created_at?: string;
  billing_mode?: string;
  is_operator_granted?: boolean;
  civitas_enabled?: boolean;
  home_metro_id?: string | null;
  familia_id?: string | null;
  relational_orientation?: string;
  people_richness_level?: number;
  partner_richness_level?: number;
  auto_manage_richness?: boolean;
}

interface FeatureFlags {
  [key: string]: boolean;
}

interface SubscriptionState {
  subscribed: boolean;
  tiers: string[];
  subscriptionEnd: string | null;
  stripeCustomerId: string | null;
  isChecking: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  featureFlags: FeatureFlags;
  isLoading: boolean;
  hasFeature: (key: string) => boolean;
  refreshFlags: () => Promise<void>;
  subscription: SubscriptionState;
  checkSubscription: () => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  /** Gardener-only: override tenant context to preview as a demo tenant */
  viewingAsTenant: Tenant | null;
  setViewingAsTenantId: (tenantId: string | null) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

/** Session-storage key so the override survives navigation but not tab close */
const OVERRIDE_KEY = 'cros_tenant_override';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, session, isAdmin } = useAuth();
  const { isDemoMode, demoTenantId, demoTenantSlug } = useDemoMode();
  const [realTenant, setRealTenant] = useState<Tenant | null>(null);
  const [overrideTenant, setOverrideTenant] = useState<Tenant | null>(null);
  const [overrideFlags, setOverrideFlags] = useState<FeatureFlags>({});
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({});
  const [isLoading, setIsLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    subscribed: false,
    tiers: [],
    subscriptionEnd: null,
    stripeCustomerId: null,
    isChecking: false,
  });

  // Synthetic demo tenant for demo mode
  const demoTenant: Tenant | null = isDemoMode ? {
    id: demoTenantId,
    slug: demoTenantSlug,
    name: 'Community Tech Alliance',
    tier: 'pro',
    archetype: 'digital_inclusion',
    status: 'active',
    billing_mode: 'demo',
    civitas_enabled: true,
    relational_orientation: 'relational',
    people_richness_level: 3,
    partner_richness_level: 3,
    auto_manage_richness: false,
  } : null;

  // The effective tenant is: demo override > admin override > real tenant
  const tenant = demoTenant ?? overrideTenant ?? realTenant;
  const activeFlags = overrideTenant ? overrideFlags : featureFlags;

  const loadTenantData = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const { data: membership } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        setRealTenant(null);
        setFeatureFlags({});
        return;
      }

      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, slug, name, tier, archetype, status, created_at, billing_mode, is_operator_granted, civitas_enabled, home_metro_id, familia_id, relational_orientation, people_richness_level, partner_richness_level, auto_manage_richness')
        .eq('id', membership.tenant_id)
        .single();

      if (tenantData) {
        setRealTenant(tenantData as unknown as Tenant);
      }

      const { data: flags } = await supabase
        .from('tenant_feature_flags')
        .select('key, enabled')
        .eq('tenant_id', membership.tenant_id);

      const flagMap: FeatureFlags = {};
      for (const f of flags ?? []) {
        flagMap[f.key] = f.enabled;
      }
      setFeatureFlags(flagMap);
    } catch (err) {
      console.error('Failed to load tenant data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load override tenant data by ID
  const loadOverrideTenant = useCallback(async (tenantId: string) => {
    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, slug, name, tier, archetype, status, created_at, billing_mode, is_operator_granted, civitas_enabled, home_metro_id, familia_id, relational_orientation, people_richness_level, partner_richness_level, auto_manage_richness')
        .eq('id', tenantId)
        .single();

      if (tenantData) {
        setOverrideTenant(tenantData as unknown as Tenant);
      }

      const { data: flags } = await supabase
        .from('tenant_feature_flags')
        .select('key, enabled')
        .eq('tenant_id', tenantId);

      const flagMap: FeatureFlags = {};
      for (const f of flags ?? []) {
        flagMap[f.key] = f.enabled;
      }
      setOverrideFlags(flagMap);
    } catch (err) {
      console.error('Failed to load override tenant:', err);
    }
  }, []);

  const setViewingAsTenantId = useCallback((tenantId: string | null) => {
    if (!isAdmin) return; // guard — only admins can override
    if (tenantId) {
      sessionStorage.setItem(OVERRIDE_KEY, tenantId);
      loadOverrideTenant(tenantId);
    } else {
      sessionStorage.removeItem(OVERRIDE_KEY);
      setOverrideTenant(null);
      setOverrideFlags({});
    }
  }, [isAdmin, loadOverrideTenant]);

  // Restore override from sessionStorage on mount
  useEffect(() => {
    if (!isAdmin) return;
    const stored = sessionStorage.getItem(OVERRIDE_KEY);
    if (stored) {
      loadOverrideTenant(stored);
    }
  }, [isAdmin, loadOverrideTenant]);

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token) return;

    setSubscription(prev => ({ ...prev, isChecking: true }));
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
        console.error('check-subscription error:', error);
        return;
      }

      setSubscription({
        subscribed: data?.subscribed ?? false,
        tiers: data?.tiers ?? [],
        subscriptionEnd: data?.subscription_end ?? null,
        stripeCustomerId: data?.stripe_customer_id ?? null,
        isChecking: false,
      });
    } catch (err) {
      console.error('Failed to check subscription:', err);
      setSubscription(prev => ({ ...prev, isChecking: false }));
    }
  }, [session?.access_token]);

  const openCustomerPortal = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) {
        console.error('customer-portal error:', error);
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Failed to open customer portal:', err);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (user?.id) {
      loadTenantData(user.id);
      checkSubscription();
    } else {
      setRealTenant(null);
      setFeatureFlags({});
      setSubscription({
        subscribed: false,
        tiers: [],
        subscriptionEnd: null,
        stripeCustomerId: null,
        isChecking: false,
      });
    }
  }, [user?.id, loadTenantData, checkSubscription]);

  // Sync tenant ID to error capture so Sentry events are scoped per tenant
  useEffect(() => {
    setErrorCaptureTenantId(tenant?.id ?? null);
  }, [tenant?.id]);

  // Realtime: detect when current user is removed from tenant → force sign-out
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('tenant-membership-watch')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tenant_users',
        },
        (payload) => {
          if ((payload.old as any)?.user_id === user.id) {
            supabase.auth.signOut().then(() => {
              window.location.href = '/login?reason=removed';
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Periodic subscription check every 60 seconds
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(checkSubscription, 300_000); // 5 minutes
    return () => clearInterval(interval);
  }, [user?.id, checkSubscription]);

  const hasFeature = useCallback((key: string) => {
    // Demo mode: all features unlocked
    if (isDemoMode) return true;
    if (!tenant) return true;
    return activeFlags[key] ?? false;
  }, [tenant, activeFlags, isDemoMode]);

  const refreshFlags = useCallback(async () => {
    if (overrideTenant) {
      await loadOverrideTenant(overrideTenant.id);
    } else if (user?.id) {
      await loadTenantData(user.id);
    }
  }, [user?.id, overrideTenant, loadTenantData, loadOverrideTenant]);

  // In demo mode, simulate active subscription
  const effectiveSubscription = isDemoMode
    ? { subscribed: true, tiers: ['pro'], subscriptionEnd: null, stripeCustomerId: null, isChecking: false }
    : subscription;

  return (
    <TenantContext.Provider value={{
      tenant,
      tenantId: tenant?.id ?? null,
      featureFlags: activeFlags,
      isLoading: isDemoMode ? false : isLoading,
      hasFeature,
      refreshFlags,
      subscription: effectiveSubscription,
      checkSubscription,
      openCustomerPortal,
      viewingAsTenant: overrideTenant,
      setViewingAsTenantId,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

/**
 * useTenantOptional — Returns tenant context or null when outside TenantProvider.
 * Use in hooks that may be called from both tenant and operator contexts.
 */
export function useTenantOptional(): TenantContextType | null {
  return useContext(TenantContext) ?? null;
}

export function useFeatureFlag(key: string): boolean {
  const { hasFeature } = useTenant();
  return hasFeature(key);
}
