/**
 * OperatorTenantDetailPage — Detailed view of a single tenant for the operator.
 *
 * WHAT: Subscription info, usage meters, and management actions for a tenant.
 * WHERE: /operator/tenants/:tenantId
 * WHY: Operator needs per-tenant billing visibility and admin controls.
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CreditCard, BarChart3, Users, Building2, MapPin } from 'lucide-react';
import { ExpansionOverviewCard } from '@/components/operator/ExpansionOverviewCard';
import { format, formatDistanceToNow } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/sonner';

export default function OperatorTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['operator-tenant', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['operator-tenant-subscription', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: users } = useQuery({
    queryKey: ['operator-tenant-users', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_users')
        .select('user_id, role, created_at')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: usageEvents } = useQuery({
    queryKey: ['operator-tenant-usage', tenantId],
    queryFn: async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data, error } = await supabase
        .from('usage_events')
        .select('workflow_key, event_type, quantity, unit, occurred_at')
        .eq('org_id', tenantId!)
        .gte('occurred_at', monthStart)
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Aggregate usage by workflow
  const usageSummary = (() => {
    if (!usageEvents) return [];
    const map = new Map<string, { workflow_key: string; total: number; unit: string; count: number }>();
    for (const e of usageEvents) {
      const key = e.workflow_key;
      const existing = map.get(key);
      if (existing) {
        existing.total += Number(e.quantity) || 0;
        existing.count += 1;
      } else {
        map.set(key, { workflow_key: key, total: Number(e.quantity) || 0, unit: e.unit ?? 'count', count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  })();

  const isLoading = tenantLoading || subLoading;

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'bg-emerald-600';
      case 'past_due': return 'bg-amber-500';
      case 'canceled': case 'cancelled': return 'bg-destructive';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/operator/tenants')} className="mb-2">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Tenants
      </Button>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : tenant ? (
        <>
          {/* Header */}
          <div className="flex items-center gap-3 flex-wrap">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{tenant.name}</h1>
              <p className="text-sm text-muted-foreground font-mono">{tenant.slug}</p>
            </div>
            <Badge variant="secondary" className="ml-auto capitalize">{tenant.tier}</Badge>
            {(tenant as any).civitas_enabled && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <MapPin className="h-3 w-3 mr-1" /> Civitas
              </Badge>
            )}
            <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>{tenant.status}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subscription card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4" /> Subscription
                </CardTitle>
                <CardDescription>Stripe billing details for this tenant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {subscription ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={statusColor(subscription.status)}>{subscription.status}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stripe Customer</span>
                      <span className="font-mono text-xs">{subscription.stripe_customer_id ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subscription ID</span>
                      <span className="font-mono text-xs">{subscription.stripe_subscription_id ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Period Ends</span>
                      <span>{subscription.current_period_end ? format(new Date(subscription.current_period_end), 'MMM d, yyyy') : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Seats</span>
                      <span>{subscription.seats}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No subscription record found.</p>
                )}
              </CardContent>
            </Card>

            {/* Users card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Members
                </CardTitle>
                <CardDescription>{users?.length ?? 0} user(s) in this organization</CardDescription>
              </CardHeader>
              <CardContent>
                {users && users.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {users.slice(0, 10).map(u => (
                      <div key={u.user_id} className="flex justify-between items-center">
                        <span className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">{u.user_id}</span>
                        <Badge variant="outline" className="capitalize">{u.role}</Badge>
                      </div>
                    ))}
                    {users.length > 10 && (
                      <p className="text-xs text-muted-foreground">+{users.length - 10} more</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No members found.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Civitas Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" /> Civitas™ Add-On
              </CardTitle>
              <CardDescription>Enable or disable multi-metro operations for this tenant</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Switch
                  checked={(tenant as any).civitas_enabled ?? false}
                  onCheckedChange={async (checked) => {
                    const { error } = await supabase
                      .from('tenants')
                      .update({ civitas_enabled: checked } as any)
                      .eq('id', tenant.id);
                    if (error) {
                      toast.error('Failed to update Civitas status');
                    } else {
                      toast.success(`Civitas ${checked ? 'enabled' : 'disabled'}`);
                      queryClient.invalidateQueries({ queryKey: ['operator-tenant', tenantId] });
                    }
                  }}
                />
                <Label className="text-sm">
                  {(tenant as any).civitas_enabled ? 'Civitas enabled — multi-metro operations active' : 'Civitas disabled — single-community mode'}
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Expansion Overview */}
          {(tenant as any).civitas_enabled && tenantId && (
            <ExpansionOverviewCard tenantId={tenantId} />
          )}

          {/* Usage meters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" /> Usage This Month
              </CardTitle>
              <CardDescription>Metered usage events for the current billing period</CardDescription>
            </CardHeader>
            <CardContent>
              {usageSummary.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workflow</TableHead>
                      <TableHead className="text-right">Events</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Unit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageSummary.map(row => (
                      <TableRow key={row.workflow_key}>
                        <TableCell className="font-mono text-xs">{row.workflow_key}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right font-medium">{row.total.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">{row.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No usage events recorded this month.</p>
              )}
            </CardContent>
          </Card>

          {/* Meta */}
          <div className="text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(tenant.created_at), { addSuffix: true })}
            {tenant.archetype && <> · Archetype: <span className="capitalize">{tenant.archetype.replace(/_/g, ' ')}</span></>}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Tenant not found.</p>
      )}
    </div>
  );
}
