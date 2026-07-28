/**
 * FeatureGate — blocks access to paid features with an upgrade prompt.
 *
 * WHAT: Wraps content that requires a specific plan tier.
 * WHERE: Used around pages/components gated by subscription tier.
 * WHY: Enforces plan-based access control with a gentle upgrade CTA.
 *      Wraps denied state in MainLayout so sidebar remains visible (BT-006).
 */

import { useTenant } from '@/contexts/TenantContext';
import { canUse, minimumPlanFor } from '@/lib/features';
import { getAddOnForFeature } from '@/lib/addons';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';

interface FeatureGateProps {
  /** The feature key to check (from src/lib/features.ts) */
  featureKey: string;
  /** Content shown when user has access */
  children: ReactNode;
  /** Optional custom message */
  message?: string;
}

const tierLabels: Record<string, string> = {
  core: 'CROS Core',
  insight: 'CROS Insight',
  story: 'CROS Story',
};

export function FeatureGate({ featureKey, children, message }: FeatureGateProps) {
  const { tenant, featureFlags } = useTenant();
  const plan = tenant?.tier ?? 'core';
  const flagOverride = featureFlags[featureKey] ?? undefined;

  const hasAccess = canUse(featureKey, plan, flagOverride);

  if (hasAccess) return <>{children}</>;

  const requiredPlan = minimumPlanFor(featureKey);
  const addon = getAddOnForFeature(featureKey);
  const tierName = requiredPlan
    ? tierLabels[requiredPlan] ?? requiredPlan
    : addon
      ? `the ${addon.label} add-on`
      : 'a higher plan';

  return (
    <MainLayout title="Feature Locked">
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {message ?? `Available in ${tierName}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                Upgrade your plan to unlock this feature. You can change your plan anytime.
              </p>
            </div>
            <Link to="/pricing">
              <Button className="mt-2">
                View plans <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}