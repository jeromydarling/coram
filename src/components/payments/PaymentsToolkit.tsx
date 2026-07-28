/**
 * PaymentsToolkit — Full financial toolkit shown when Stripe Connect is active.
 *
 * WHAT: Quick-action cards for invoices, payment links, generosity log, and event payments.
 * WHERE: Settings → Payments tab (below StripeConnectCard).
 * WHY: Once connected, stewards need easy access to all financial instruments without navigating away.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Link as LinkIcon, Heart, CalendarDays, ExternalLink } from 'lucide-react';
import { useStripeConnectStatus, useFinancialEvents, useTenantInvoices, useTenantPaymentLinks } from '@/hooks/useStripeConnect';
import { CreateInvoiceDialog } from '@/components/payments/CreateInvoiceDialog';
import { CreatePaymentLinkDialog } from '@/components/payments/CreatePaymentLinkDialog';
import { ManualGenerosityDialog } from '@/components/payments/ManualGenerosityDialog';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

export function PaymentsToolkit() {
  const { data: status } = useStripeConnectStatus();
  const { data: events } = useFinancialEvents();
  const { data: invoices } = useTenantInvoices();
  const { data: paymentLinks } = useTenantPaymentLinks();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [showInvoice, setShowInvoice] = useState(false);
  const [showPaymentLink, setShowPaymentLink] = useState(false);
  const [showGenerosity, setShowGenerosity] = useState(false);

  const isConnected = status?.connected && status?.charges_enabled;

  // Always show the generosity log — it works without Stripe
  return (
    <div className="space-y-4">
      {/* ─── Quick Actions ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Financial Instruments
            <HelpTooltip
              what="Create invoices, payment links, or log generosity received outside of Stripe."
              where="Settings → Payments"
              why="All financial moments — digital or paper — belong in the same relational timeline."
            />
          </CardTitle>
          <CardDescription>
            {isConnected
              ? 'Your organization is ready to send invoices, share payment links, and record generosity.'
              : 'Connect Stripe above to unlock invoices and payment links. You can always record generosity manually.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Send Invoice */}
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start gap-1"
              disabled={!isConnected}
              onClick={() => setShowInvoice(true)}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Send Invoice</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                Create and send a Stripe-hosted invoice
              </span>
            </Button>

            {/* Payment Link */}
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start gap-1"
              disabled={!isConnected}
              onClick={() => setShowPaymentLink(true)}
            >
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Payment Link</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                Shareable link for registrations, support, or generosity
              </span>
            </Button>

            {/* Log Generosity (always available) */}
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start gap-1"
              onClick={() => setShowGenerosity(true)}
            >
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Log Generosity</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                Record a gift, check, or in-kind contribution
              </span>
            </Button>

            {/* View Financial Activity */}
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-start gap-1"
              onClick={() => navigate(`/${tenant?.slug}/financial-activity`)}
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Activity Timeline</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                View all financial moments across relationships
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Recent Activity Summary ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold text-foreground">{invoices?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Invoices</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{paymentLinks?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Payment Links</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{events?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Financial Moments</p>
            </div>
          </div>

          {/* Recent events list */}
          {events && events.length > 0 && (
            <div className="mt-4 space-y-2">
              {events.slice(0, 5).map((event: any) => (
                <div key={event.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <span className="truncate block">{event.title || 'Untitled'}</span>
                    <span className="text-xs text-muted-foreground">
                      {event.payer_name || event.payer_email || '—'} · {new Date(event.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-xs">
                      ${((event.amount_cents || 0) / 100).toFixed(2)}
                    </Badge>
                  </div>
                </div>
              ))}
              {events.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => navigate(`/${tenant?.slug}/financial-activity`)}
                >
                  View all {events.length} moments →
                </Button>
              )}
            </div>
          )}

          {(!events || events.length === 0) && (
            <p className="text-center text-sm text-muted-foreground mt-4 py-4">
              Every relationship begins somewhere. Financial moments will appear here as they happen.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateInvoiceDialog open={showInvoice} onOpenChange={setShowInvoice} />
      <CreatePaymentLinkDialog open={showPaymentLink} onOpenChange={setShowPaymentLink} />
      <ManualGenerosityDialog open={showGenerosity} onOpenChange={setShowGenerosity} />
    </div>
  );
}
