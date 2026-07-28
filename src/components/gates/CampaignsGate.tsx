/**
 * CampaignsGate — Route-level guard for Relatio Campaigns™ add-on.
 *
 * WHAT: Renders children if campaigns add-on is enabled, else shows upsell.
 * WHERE: Wraps campaign routes in AppRouter.
 * WHY: Hard gate ensuring only paying tenants access campaign functionality.
 */
import type { ReactNode } from 'react';
import { useCampaignsEnabled } from '@/hooks/useCampaignsEnabled';
import { CampaignsUpsellPanel } from '@/components/billing/CampaignsUpsellPanel';
import { Skeleton } from '@/components/ui/skeleton';

interface CampaignsGateProps {
  children: ReactNode;
}

export function CampaignsGate({ children }: CampaignsGateProps) {
  const { enabled, loading } = useCampaignsEnabled();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <CampaignsUpsellPanel />
      </div>
    );
  }

  return <>{children}</>;
}
