/**
 * FinancialActivity — Financial Activity page.
 *
 * WHAT: Unified view of all financial events — generosity, invoices, event payments, support.
 * WHERE: /:tenantSlug/financial-activity
 * WHY: Timeline-first view of financial moments as part of relationships, not a fundraising dashboard.
 */
import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, Plus, Link as LinkIcon, FileText } from 'lucide-react';
import { useFinancialEvents, useStripeConnectStatus } from '@/hooks/useStripeConnect';
import { CreatePaymentLinkDialog } from '@/components/payments/CreatePaymentLinkDialog';
import { CreateInvoiceDialog } from '@/components/payments/CreateInvoiceDialog';
import { crosToast } from '@/lib/crosToast';

const EVENT_TYPE_LABELS: Record<string, string> = {
  generosity: 'Generosity',
  participation: 'Participation',
  collaboration: 'Collaboration',
  support: 'Support',
  invoice: 'Invoice',
  membership: 'Membership',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting',
  completed: 'Noted',
  failed: 'Did not complete',
  cancelled: 'The thread is still open',
  refunded: 'Returned',
};

export default function FinancialActivity() {
  const [filter, setFilter] = useState<string>('all');
  const [showPaymentLink, setShowPaymentLink] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const { data: connectStatus } = useStripeConnectStatus();
  const { data: events, isLoading } = useFinancialEvents(
    filter !== 'all' ? { event_type: filter } : undefined
  );

  const isConnected = connectStatus?.connected && connectStatus?.charges_enabled;

  const handleExportCSV = () => {
    if (!events?.length) return;
    const headers = ['Date', 'Person', 'Type', 'Amount', 'Status', 'Description'];
    const rows = events.map((e: any) => [
      new Date(e.created_at).toLocaleDateString(),
      e.payer_name || e.payer_email || '—',
      EVENT_TYPE_LABELS[e.event_type] || e.event_type,
      `$${(e.amount_cents / 100).toFixed(2)}`,
      STATUS_LABELS[e.status] || e.status,
      e.title || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-activity-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    crosToast.noted('Export ready.');
  };

  return (
    <MainLayout title="Financial Activity" subtitle="A record of financial moments within your relationships." helpKey="page.financial-activity">
      <div className="space-y-6 max-w-4xl">
        {/* Actions */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="generosity">Generosity</SelectItem>
              <SelectItem value="participation">Participation</SelectItem>
              <SelectItem value="collaboration">Collaboration</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
              <SelectItem value="membership">Membership</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            {isConnected && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowPaymentLink(true)}>
                  <LinkIcon className="mr-2 h-4 w-4" /> Payment Link
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowInvoice(true)}>
                  <FileText className="mr-2 h-4 w-4" /> Invoice
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!events?.length}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        {/* Not connected banner */}
        {!isConnected && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              <p>Connect your Stripe account in Settings → Payments to create invoices and payment links.</p>
              <p className="mt-1 text-xs">Manual records from generosity and other sources will still appear here.</p>
            </CardContent>
          </Card>
        )}

        {/* Events list */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !events?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">Every relationship begins somewhere.</p>
              <p className="text-muted-foreground text-xs mt-1">Financial moments will appear here as they happen.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map((event: any) => (
              <Card key={event.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                        </Badge>
                        <span className="text-sm font-medium truncate">{event.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {(event.payer_name || event.payer_email) && (
                          <span>{event.payer_name || event.payer_email}</span>
                        )}
                        <span>·</span>
                        <span>{new Date(event.created_at).toLocaleDateString()}</span>
                      </div>
                      {event.note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{event.note}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">${(event.amount_cents / 100).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {STATUS_LABELS[event.status] || event.status}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreatePaymentLinkDialog open={showPaymentLink} onOpenChange={setShowPaymentLink} />
      <CreateInvoiceDialog open={showInvoice} onOpenChange={setShowInvoice} />
    </MainLayout>
  );
}
