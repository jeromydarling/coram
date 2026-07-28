import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useTenantNavigate } from '@/hooks/useTenantPath';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Package, ArrowLeft, Loader2, Send, Truck, Clock, CheckCircle2,
  XCircle, AlertTriangle, MessageSquare, Heart, ClipboardList,
} from 'lucide-react';
import { useProvisionDetail, useProvisionMutations } from '@/hooks/useProvisions';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { CopyForSpreadsheetModal } from '@/components/provisions/CopyForSpreadsheetModal';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Preparing', submitted: 'Ready', in_progress: 'In Motion',
  ordered: 'Ordered', shipped: 'On the Way', delivered: 'Delivered with Care', canceled: 'Canceled',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  submitted: ['in_progress', 'canceled'],
  in_progress: ['ordered', 'canceled'],
  ordered: ['shipped', 'canceled'],
  shipped: ['delivered'],
};

export default function ProvisionDetail() {
  const { t } = useTranslation('provisions');
  const { id } = useParams<{ id: string }>();
  const navigate = useTenantNavigate();
  const { isAdmin, roles, user } = useAuth();
  const isStaff = roles.includes('staff' as any) || isAdmin;

  const { data, isLoading } = useProvisionDetail(id || null);
  const { updateProvision, submitProvision, sendMessage } = useProvisionMutations();

  const [messageText, setMessageText] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);

  if (isLoading) {
    return (
      <MainLayout title="Provision">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!data?.provision) {
    return (
      <MainLayout title="Provision">
        <div className="p-6 text-center">
          <p className="text-muted-foreground">{t('detail.notFound')}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/provisions')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('detail.backToProvisions')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { provision, items, messages } = data;
  const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;
  const canSubmit = provision.status === 'draft';
  const nextStatuses = STATUS_TRANSITIONS[provision.status] || [];

  const handleStatusChange = (newStatus: string) => {
    updateProvision.mutate({ provision_id: provision.id, status: newStatus });
  };

  const handleTrackingUpdate = () => {
    if (!trackingNumber.trim()) return;
    updateProvision.mutate({
      provision_id: provision.id,
      tracking_carrier: trackingCarrier || null,
      tracking_number: trackingNumber.trim(),
    });
  };

  const handleDeliveryUpdate = (ds: string) => {
    updateProvision.mutate({ provision_id: provision.id, delivery_status: ds });
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    sendMessage.mutate({ provision_id: provision.id, body: messageText.trim() });
    setMessageText('');
  };

  const requestedByLabel = user?.email || 'Unknown';

  return (
    <MainLayout title="Provision Detail" data-testid="provision-detail-root">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/provisions')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('detail.backToProvisions')}
        </Button>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                {t('detail.summaryTitle')}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={provision.status === 'delivered' ? 'secondary' : provision.status === 'canceled' ? 'destructive' : 'default'}>
                  {t(`statusLabels.${provision.status}`) || provision.status}
                </Badge>
                {provision.source === 'imported' && <Badge variant="outline">{t('detail.badgeImported')}</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t('detail.labelTotal')}</p>
                <p className="font-semibold text-lg">{formatCents(provision.total_cents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('detail.labelItems')}</p>
                <p className="font-semibold">{provision.total_quantity}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('detail.labelCreated')}</p>
                <p className="font-medium">{format(new Date(provision.created_at), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('detail.labelDelivery')}</p>
                <p className="font-medium capitalize">{provision.delivery_status || 'N/A'}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              {canSubmit && (
                <Button
                  size="sm"
                  onClick={() => submitProvision.mutate(provision.id)}
                  disabled={submitProvision.isPending}
                >
                  {t('detail.markAsReady')}
                </Button>
              )}
              {isStaff && nextStatuses.map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === 'canceled' ? 'destructive' : 'outline'}
                  onClick={() => handleStatusChange(s)}
                  disabled={updateProvision.isPending}
                >
                  {s === 'canceled' ? t('detail.cancelButton') : t('detail.markStatus', { label: t(`statusLabels.${s}`) })}
                </Button>
              ))}

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setShowCopyModal(true)}
                data-testid="provision-copy-tsv"
              >
                <ClipboardList className="w-4 h-4" />
                {t('detail.copyForSpreadsheet')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('detail.itemsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('detail.noItems')}</p>
            ) : (
              <div className="space-y-2">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{item.item_name}</p>
                      {item.tier && <p className="text-xs text-muted-foreground">{item.tier}</p>}
                    </div>
                    <div className="text-right text-sm">
                      <p>{item.quantity} × {formatCents(item.unit_price_cents)}</p>
                      <p className="font-semibold">{formatCents(item.line_total_cents)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tracking (staff only) */}
        {isStaff && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4" /> {t('detail.trackingTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder={t('detail.carrierPlaceholder')}
                  value={trackingCarrier}
                  onChange={e => setTrackingCarrier(e.target.value)}
                  className="sm:w-40"
                />
                <Input
                  placeholder={t('detail.trackingNumberPlaceholder')}
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleTrackingUpdate} disabled={updateProvision.isPending}>
                  {t('detail.saveTracking')}
                </Button>
              </div>
              {provision.tracking_number && (
                <p className="text-sm text-muted-foreground">
                  {t('detail.currentTracking', { tracking: `${provision.tracking_carrier ? provision.tracking_carrier + ' — ' : ''}${provision.tracking_number}` })}
                </p>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('detail.deliveryStatusLabel')}</span>
                <Select
                  value={provision.delivery_status || ''}
                  onValueChange={handleDeliveryUpdate}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder={t('detail.deliverySetStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">{t('deliveryLabels.unknown')}</SelectItem>
                    <SelectItem value="in_transit">{t('deliveryLabels.in_transit')}</SelectItem>
                    <SelectItem value="delivered">{t('deliveryLabels.delivered')}</SelectItem>
                    <SelectItem value="exception">{t('deliveryLabels.exception')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> {t('detail.conversationTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('detail.noMessages')}</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {messages.map((msg: any) => (
                  <div key={msg.id} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm">{msg.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              <Textarea
                placeholder={t('detail.messagePlaceholder')}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button
                size="sm"
                className="self-end"
                onClick={handleSendMessage}
                disabled={sendMessage.isPending || !messageText.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Copy for Spreadsheet Modal */}
      <CopyForSpreadsheetModal
        open={showCopyModal}
        onOpenChange={setShowCopyModal}
        provision={provision}
        items={items}
        requestedByLabel={requestedByLabel}
      />
    </MainLayout>
  );
}
