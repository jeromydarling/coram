/**
 * SubscriptionGate — blocks access when no active subscription exists.
 *
 * WHAT: Checks TenantContext subscription state and shows upgrade prompt if not subscribed.
 * WHERE: Wraps onboarding or any page requiring an active subscription.
 * WHY: Ensures users have paid before accessing tenant creation or gated features.
 */

import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { subscription, tenant } = useTenant();

  // Operator-granted tenants bypass Stripe billing entirely
  if (tenant?.billing_mode === 'operator_granted') {
    return <>{children}</>;
  }

  if (subscription.isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (subscription.subscribed) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              Subscription required
            </h3>
            <p className="text-sm text-muted-foreground">
              Choose a plan to get started with CROS. Your workspace will be ready in under a minute.
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
  );
}
