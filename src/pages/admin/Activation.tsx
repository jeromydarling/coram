import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, Settings, Database, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { brand } from '@/config/brand';

export default function Activation() {
  const { tenant, featureFlags, isLoading: tenantLoading } = useTenant();
  const { isAdmin } = useAuth();

  // Recent system sweep logs
  const { data: sweepLogs, isLoading: sweepLoading } = useQuery({
    queryKey: ['activation-sweep-logs', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data } = await supabase
        .from('system_sweep_log')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Metro count
  const { data: metroCount } = useQuery({
    queryKey: ['activation-metro-count'],
    queryFn: async () => {
      const { count } = await supabase.from('metros').select('*', { count: 'exact', head: true }).eq('active', true);
      return count ?? 0;
    },
  });

  if (tenantLoading) {
    return (
      <MainLayout title="Activation">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!tenant) {
    return (
      <MainLayout title="Activation">
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold mb-2">No Tenant Found</h2>
          <p className="text-muted-foreground">Complete onboarding to activate your CROS workspace.</p>
        </div>
      </MainLayout>
    );
  }

  const coreFlags = Object.entries(featureFlags).filter(([k]) => k.startsWith('cros_core_'));
  const optionalFlags = Object.entries(featureFlags).filter(([k]) => !k.startsWith('cros_core_'));

  return (
    <MainLayout title="CROS Activation" subtitle="Confirm your workspace is alive and well">
      <div className="space-y-6 max-w-4xl">
        {/* Tenant Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Workspace Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Name</span>
                <div className="font-medium">{tenant.name}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Slug</span>
                <div className="font-medium">{brand.domain}/{tenant.slug}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Tier</span>
                <Badge variant="outline" className="capitalize">{tenant.tier}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Archetype</span>
                <div className="font-medium capitalize">{tenant.archetype?.replace(/_/g, ' ') ?? '—'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" /> Feature Flags
            </CardTitle>
            <CardDescription>Core flags are always on. Optional flags depend on tier.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Core</h4>
              <div className="flex flex-wrap gap-2">
                {coreFlags.map(([key, enabled]) => (
                  <Badge key={key} variant={enabled ? 'default' : 'outline'} className="gap-1">
                    {enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {key.replace('cros_core_', '')}
                  </Badge>
                ))}
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Optional</h4>
              <div className="flex flex-wrap gap-2">
                {optionalFlags.map(([key, enabled]) => (
                  <Badge key={key} variant={enabled ? 'default' : 'outline'} className="gap-1">
                    {enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {key.replace('_enabled', '')}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" /> System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Active Metros</span>
                <div className="font-medium">{metroCount ?? '—'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Recent Sweep Logs</span>
                <div className="font-medium">{sweepLoading ? '…' : (sweepLogs?.length ?? 0)}</div>
              </div>
            </div>

            {sweepLogs && sweepLogs.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Last 7 Days</h4>
                <div className="space-y-2">
                  {sweepLogs.slice(0, 5).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between text-xs border rounded-md p-2">
                      <span className="font-medium capitalize">{log.kind?.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={log.status === 'ok' ? 'default' : 'destructive'} className="text-[10px]">
                          {log.status}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!sweepLogs || sweepLogs.length === 0) && !sweepLoading && (
              <p className="text-sm text-muted-foreground mt-4">No activity yet. Background systems will populate this automatically.</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link to="/admin/global-keywords" className="text-sm text-primary hover:underline">Keywords Editor</Link>
              <Link to="/admin/metro-news" className="text-sm text-primary hover:underline">Sources Editor</Link>
              <Link to="/admin/system-sweep" className="text-sm text-primary hover:underline">System Sweep</Link>
              <Link to="/settings" className="text-sm text-primary hover:underline">Settings</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
