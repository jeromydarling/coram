/**
 * StripeConnectCard — Stripe Connect onboarding for tenant payments.
 *
 * WHAT: Allows stewards to connect their Stripe account for receiving payments.
 * WHERE: Settings → Payments tab.
 * WHY: Tenants need direct payment capabilities via Stripe Connect.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { useStripeConnectStatus, useStripeConnectOnboard } from '@/hooks/useStripeConnect';
import { crosToast } from '@/lib/crosToast';
import { useTenant } from '@/contexts/TenantContext';

export function StripeConnectCard() {
  const { tenant } = useTenant();
  const { data: status, isLoading } = useStripeConnectStatus();
  const onboard = useStripeConnectOnboard();

  const handleConnect = () => {
    onboard.mutate(undefined, {
      onError: (e) => crosToast.gentle(e.message),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.connected && status?.charges_enabled;
  const isPending = status?.connected && !status?.charges_enabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Payments
          {isConnected && <Badge variant="default" className="text-xs">Connected</Badge>}
          {isPending && <Badge variant="secondary" className="text-xs">Pending</Badge>}
        </CardTitle>
        <CardDescription>
          {isConnected
            ? `${tenant?.name ?? 'Your organization'} can receive payments securely through Stripe.`
            : 'Connect a Stripe account to receive payments directly. Stripe handles all compliance, payouts, and security.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.connected && (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Payments flow directly to your organization. CROS facilitates the connection but never holds funds.
              Stripe handles KYC verification, payouts, tax forms, and compliance.
            </p>
            <Button onClick={handleConnect} disabled={onboard.isPending}>
              {onboard.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening Stripe…</>
              ) : (
                <><ExternalLink className="mr-2 h-4 w-4" /> Connect Stripe</>
              )}
            </Button>
          </>
        )}

        {isPending && (
          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Onboarding in progress</p>
              <p className="text-xs text-muted-foreground">
                Complete your Stripe account setup to begin accepting payments.
                You can resume where you left off.
              </p>
              <Button variant="outline" size="sm" onClick={handleConnect} disabled={onboard.isPending}>
                Continue setup
              </Button>
            </div>
          </div>
        )}

        {isConnected && (
          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
            <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Ready to receive payments</p>
              <p className="text-xs text-muted-foreground">
                Invoices, payment links, and event payments will route funds directly to your Stripe account.
                A small 1% platform fee supports CROS infrastructure.
              </p>
              {status.onboarding_completed_at && (
                <p className="text-xs text-muted-foreground">
                  Connected {new Date(status.onboarding_completed_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
