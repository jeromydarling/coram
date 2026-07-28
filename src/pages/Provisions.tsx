import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenantNavigate } from '@/hooks/useTenantPath';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Plus, Loader2, Truck, Clock, CheckCircle2, XCircle, Package } from 'lucide-react';
import { useProvisions, type ProvisionFilters } from '@/hooks/useProvisions';
import { format } from 'date-fns';
import { CreateProvisionModal } from '@/components/provisions/CreateProvisionModal';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<any> }> = {
  draft: { label: 'Preparing', variant: 'outline', icon: Clock },
  submitted: { label: 'Ready', variant: 'secondary', icon: Clock },
  in_progress: { label: 'In Motion', variant: 'default', icon: Loader2 },
  ordered: { label: 'Ordered', variant: 'default', icon: Package },
  shipped: { label: 'On the Way', variant: 'default', icon: Truck },
  delivered: { label: 'Delivered with Care', variant: 'secondary', icon: CheckCircle2 },
  canceled: { label: 'Canceled', variant: 'destructive', icon: XCircle },
};

const DELIVERY_CONFIG: Record<string, { label: string; color: string }> = {
  unknown: { label: 'Unknown', color: 'text-muted-foreground' },
  in_transit: { label: 'In Transit', color: 'text-blue-600' },
  delivered: { label: 'Delivered', color: 'text-green-600' },
  exception: { label: 'Exception', color: 'text-destructive' },
};

export default function Provisions() {
  const { t } = useTranslation('provisions');
  const navigate = useTenantNavigate();
  const [filters, setFilters] = useState<ProvisionFilters>({});
  const [showCreate, setShowCreate] = useState(false);
  const { data: provisions, isLoading } = useProvisions(filters);

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <MainLayout title={t('list.pageTitle')} helpKey="page.provisions" data-testid="provisions-root">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Heart className="w-6 h-6 text-primary" />
              {t('list.pageTitle')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('list.pageSubtitle')}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2" data-tour="provisions-create">
            <Plus className="w-4 h-4" />
            {t('list.startProvision')}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select
            value={filters.status || 'all'}
            onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'all' ? undefined : v }))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('list.statusPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('list.filterAllStatus')}</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key]) => (
                <SelectItem key={key} value={key}>{t(`statusLabels.${key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.source || 'all'}
            onValueChange={(v) => setFilters(f => ({ ...f, source: v === 'all' ? undefined : v }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('list.sourcePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('list.filterAllSources')}</SelectItem>
              <SelectItem value="native">{t('list.filterNative')}</SelectItem>
              <SelectItem value="imported">{t('list.filterImported')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !provisions || provisions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Heart className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">{t('list.emptyTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('list.emptySubtitle')}
              </p>
              <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                {t('list.startProvision')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-tour="provisions-list">
            {provisions.map((p) => {
              const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
              const deliveryCfg = p.delivery_status ? DELIVERY_CONFIG[p.delivery_status] : null;
              const StatusIcon = statusCfg.icon;

              return (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => navigate(`/provisions/${p.id}`)}
                  data-testid="provision-row"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <StatusIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={statusCfg.variant}>{t(`statusLabels.${p.status}`)}</Badge>
                            {p.source === 'imported' && (
                              <Badge variant="outline" className="text-xs">{t('list.badgeImported')}</Badge>
                            )}
                            {deliveryCfg && (
                              <span className={`text-xs font-medium ${deliveryCfg.color}`}>
                                {deliveryCfg.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.total_quantity} items · {format(new Date(p.created_at), 'MMM d, yyyy')}
                            {p.tracking_number && ` · ${p.tracking_number}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-foreground">{formatCents(p.total_cents)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateProvisionModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            navigate(`/provisions/${id}`);
          }}
        />
      )}
    </MainLayout>
  );
}
