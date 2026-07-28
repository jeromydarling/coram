/**
 * OperatorRecovery — Tenant Recovery workflow in the Nexus.
 *
 * WHAT: Full recycle bin browser with 90-day retention for operators.
 * WHERE: /operator/nexus/recovery
 * WHY: Operators can restore items that tenants can no longer reach (past 7 days).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRestoreFromRecycleBin, getEntityLabel, type RecycleBinEntry } from '@/hooks/useRecycleBin';
import { fetchOperatorRecycleBin } from '@/lib/safeOperatorQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { RotateCcw, Search, Trash2, Building2, User, MapPin, Calendar, FileText, Heart, CheckCircle } from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RecoveryTicketsPanel from '@/components/operator/RecoveryTicketsPanel';

const ENTITY_ICONS: Record<string, React.ElementType> = {
  opportunities: Building2,
  contacts: User,
  metros: MapPin,
  events: Calendar,
  grants: FileText,
  volunteers: Heart,
};

const ENTITY_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'opportunities', label: 'Partners' },
  { value: 'contacts', label: 'People' },
  { value: 'metros', label: 'Metros' },
  { value: 'events', label: 'Events' },
  { value: 'grants', label: 'Grants' },
  { value: 'volunteers', label: 'Volunteers' },
];

export default function OperatorRecovery() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // ── Operator view: metadata only — never expose tenant record names/content ──
  // The Gardener sees entity type, tenant, and timestamp but NOT the actual
  // record names (which belong to the tenant's private CRM data).
  // ── Uses safe query helper — architecturally prevents PII leakage ──
  const { data: items, isLoading } = useQuery({
    queryKey: ['operator-recycle-bin'],
    queryFn: () => fetchOperatorRecycleBin({ limit: 200 }) as Promise<RecycleBinEntry[]>,
  });

  const { data: tenants } = useQuery({
    queryKey: ['operator-tenants-names'],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('id, name');
      const map = new Map<string, string>();
      data?.forEach((t) => map.set(t.id, t.name));
      return map;
    },
  });

  const restore = useRestoreFromRecycleBin();

  const filtered = (items ?? []).filter((item) => {
    if (typeFilter !== 'all' && item.entity_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const tenant = tenants?.get(item.tenant_id || '') || '';
      const typeLabel = getEntityLabel(item.entity_type).toLowerCase();
      return tenant.toLowerCase().includes(q) || typeLabel.includes(q);
    }
    return true;
  });

  const activeCount = filtered.filter(i => !i.restored_at).length;
  const restoredCount = filtered.filter(i => i.restored_at).length;

  return (
    <div className="space-y-5 max-w-4xl">
      <Tabs defaultValue="recycle-bin">
        <TabsList className="mb-4">
          <TabsTrigger value="recycle-bin" className="gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Recycle Bin
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Recovery Requests
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tickets">
          <RecoveryTicketsPanel />
        </TabsContent>
        <TabsContent value="recycle-bin">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-destructive" />
          Tenant Recovery
          <HelpTooltip content="Browse and restore soft-deleted records across all tenants. 90-day safety net — restore what tenants can no longer reach themselves." />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Soft-deleted records are retained for 90 days. Record names are hidden to protect tenant privacy.
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs">
          {activeCount} awaiting restore
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {restoredCount} restored
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by tenant or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Items */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No deleted items found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const Icon = ENTITY_ICONS[item.entity_type] || Trash2;
            const tenantName = tenants?.get(item.tenant_id || '') || 'Unknown tenant';
            const isRestored = !!item.restored_at;

            return (
              <Card key={item.id} className={isRestored ? 'opacity-60' : ''}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${isRestored ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                    {isRestored ? (
                      <CheckCircle className="w-4 h-4 text-primary" />
                    ) : (
                      <Icon className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {getEntityLabel(item.entity_type)} record
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tenantName} · deleted {formatDistanceToNow(parseISO(item.deleted_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {getEntityLabel(item.entity_type)}
                  </Badge>
                  {isRestored ? (
                    <Badge variant="secondary" className="text-xs shrink-0">Restored</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs gap-1"
                      onClick={() => restore.mutate(item.id)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
