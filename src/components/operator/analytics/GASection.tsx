/**
 * GASection — Google Analytics 4 live reporting within the Gardener Console.
 *
 * WHAT: Connect a GA4 property via OAuth, then view sessions, traffic sources, and top pages.
 * WHERE: Operator Analytics page (/operator/nexus/analytics)
 * WHY: Gardeners need website traffic context alongside ecosystem health signals, without leaving CROS.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import {
  BarChart3, Globe, TrendingUp, Users, Clock, ArrowUpDown,
  ExternalLink, Loader2, CheckCircle2, AlertTriangle, FileText,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';

/* ─── hooks ─── */

function useGAConnection() {
  return useQuery({
    queryKey: ['gardener', 'ga-connection'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase
        .from('gardener_ga_connections' as any)
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return data as any | null;
    },
  });
}

function useGAReport(enabled: boolean) {
  return useQuery({
    queryKey: ['gardener', 'ga-report'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/schola-ga-report`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Report fetch failed');
      return json;
    },
    enabled,
    refetchInterval: 5 * 60 * 1000, // 5 min
    staleTime: 2 * 60 * 1000,
  });
}

/* ─── sub-components ─── */

function SummaryCards({ s7, s28 }: { s7: any; s28: any }) {
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  const dur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const cards = [
    { label: 'Sessions (7d)', value: fmt(s7.sessions), icon: Globe, sub: `28d: ${fmt(s28.sessions)}` },
    { label: 'Users (7d)', value: fmt(s7.users), icon: Users, sub: `28d: ${fmt(s28.users)}` },
    { label: 'Pageviews (7d)', value: fmt(s7.pageviews), icon: FileText, sub: `28d: ${fmt(s28.pageviews)}` },
    { label: 'Avg Duration', value: dur(s7.avgDuration), icon: Clock },
    { label: 'Bounce Rate', value: `${(s7.bounceRate * 100).toFixed(1)}%`, icon: ArrowUpDown },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <c.icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground">{c.value}</p>
            {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TrafficSourcesCard({ sources }: { sources: any[] }) {
  const total = sources.reduce((s, t) => s + t.sessions, 0) || 1;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Traffic Sources
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.channel} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{s.channel}</span>
                  <span className="text-muted-foreground ml-2">{s.sessions}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted mt-1">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(s.sessions / total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {sources.length === 0 && (
            <p className="text-sm text-muted-foreground">No traffic data yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TopPagesCard({ pages }: { pages: any[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" /> Top Pages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {pages.map((p, i) => (
            <div key={p.path} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
              <span className="truncate text-foreground min-w-0 flex-1">{p.path}</span>
              <div className="flex items-center gap-3 text-muted-foreground ml-2 shrink-0">
                <span>{p.views} views</span>
                <span>{p.users} users</span>
              </div>
            </div>
          ))}
          {pages.length === 0 && (
            <p className="text-sm text-muted-foreground">No page data yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SessionsChart({ timeSeries }: { timeSeries: any[] }) {
  if (!timeSeries.length) return null;
  const max = Math.max(...timeSeries.map(t => t.sessions), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> Sessions (7 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-32">
          {timeSeries.map((t) => (
            <div key={t.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary/80 rounded-t transition-all"
                style={{ height: `${(t.sessions / max) * 100}%`, minHeight: '2px' }}
                title={`${t.date}: ${t.sessions} sessions`}
              />
              <span className="text-[10px] text-muted-foreground">
                {t.date.slice(-2)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── main export ─── */

export default function GASection() {
  const [propertyId, setPropertyId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const isEmbeddedPreview = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const standaloneUrl = window.location.href;
  const queryClient = useQueryClient();

  const { data: connection, isLoading: connLoading } = useGAConnection();
  const isConnected = !!connection;
  const { data: report, isLoading: reportLoading, error: reportError } = useGAReport(isConnected);

  const handleConnect = async () => {
    const trimmed = propertyId.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      toast.error('Enter a numeric GA4 Property ID (found in GA Admin → Property Settings)');
      return;
    }

    if (isEmbeddedPreview) {
      toast.error('Google sign-in is blocked inside embedded preview. Open this page in a standalone tab first.');
      return;
    }

    setIsConnecting(true);

    // Open tab synchronously on user gesture to avoid popup blockers in iframe previews
    const oauthTab = window.open('', '_blank');
    if (oauthTab) {
      oauthTab.document.title = 'Connecting to Google Analytics…';
      oauthTab.document.body.innerHTML = '<p style="font-family: system-ui; padding: 16px;">Preparing secure sign-in…</p>';
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in first');
        if (oauthTab && !oauthTab.closed) oauthTab.close();
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-start`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            property_id: trimmed,
            redirect_uri: window.location.origin + '/operator/nexus/analytics',
          }),
        }
      );
      const json = await res.json();
      if (json.authUrl) {
        setOauthUrl(json.authUrl);

        let didNavigate = false;
        if (oauthTab && !oauthTab.closed) {
          try {
            oauthTab.location.replace(json.authUrl);
            didNavigate = true;
          } catch (navErr) {
            console.warn('Could not navigate popup tab:', navErr);
          }
        }

        if (!didNavigate) {
          toast.info('Popup blocked — please use the link below to connect in a new tab.');
        }
      } else {
        if (oauthTab && !oauthTab.closed) oauthTab.close();
        toast.error(json.error || 'Failed to start OAuth');
      }
    } catch (err: any) {
      if (oauthTab && !oauthTab.closed) oauthTab.close();
      console.error('GA connect error:', err);
      toast.error('Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    await supabase
      .from('gardener_ga_connections' as any)
      .update({ is_active: false })
      .eq('id', connection.id);
    queryClient.invalidateQueries({ queryKey: ['gardener', 'ga-connection'] });
    queryClient.invalidateQueries({ queryKey: ['gardener', 'ga-report'] });
    toast.success('Google Analytics disconnected.');
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5" />
          Google Analytics
        </h2>
        <HelpTooltip
          what="View live GA4 analytics data from your connected property."
          where="Gardener Console → Analytics"
          why="Website traffic context alongside ecosystem health signals — without leaving CROS."
        />
      </div>

      {connLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : isConnected ? (
        <>
          {/* Connected status */}
          <Card>
            <CardContent className="py-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">Connected</span>
                {connection.connected_email && (
                  <Badge variant="secondary" className="text-xs">{connection.connected_email}</Badge>
                )}
                <Badge variant="outline" className="text-xs font-mono">
                  Property {connection.property_id}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['gardener', 'ga-report'] });
                  toast.success('Refreshing analytics…');
                }}>
                  Refresh
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Report */}
          {reportLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
              </div>
            </div>
          ) : reportError ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {(reportError as Error).message || 'Failed to fetch analytics. Try reconnecting.'}
              </AlertDescription>
            </Alert>
          ) : report ? (
            <div className="space-y-4">
              <SummaryCards s7={report.summary7d} s28={report.summary28d} />
              <SessionsChart timeSeries={report.timeSeries} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TrafficSourcesCard sources={report.trafficSources} />
                <TopPagesCard pages={report.topPages} />
              </div>
            </div>
          ) : null}
        </>
      ) : (
        /* Connect form */
        <Card>
          <CardContent className="py-4 px-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your GA4 property to view website traffic alongside ecosystem health.
            </p>
            {isEmbeddedPreview && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex flex-col gap-2">
                  <span className="text-sm">Google sign-in is blocked inside embedded preview.</span>
                  <a
                    href={standaloneUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-primary underline break-all"
                  >
                    Open this page in a standalone tab first →
                  </a>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 w-full">
                <Label htmlFor="ga-property-id" className="text-xs text-muted-foreground mb-1 block">
                  GA4 Property ID (numeric)
                </Label>
                <Input
                  id="ga-property-id"
                  placeholder="123456789"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <Button onClick={handleConnect} disabled={isConnecting || isEmbeddedPreview} size="sm">
                {isConnecting ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Connecting…</>
                ) : (
                  <><ExternalLink className="w-3.5 h-3.5 mr-1" /> Connect Google Analytics</>
                )}
              </Button>
            </div>
            {oauthUrl && (
              <Alert>
                <ExternalLink className="h-4 w-4" />
                <AlertDescription className="flex flex-col gap-2">
                  <span className="text-sm">Popup was blocked. Open this link in a new browser tab to continue:</span>
                  <a
                    href={oauthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-primary underline break-all"
                  >
                    Open Google Sign-In →
                  </a>
                </AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">
              Find your Property ID in Google Analytics → Admin → Property Settings. It's a numeric ID, not the G-XXXX measurement ID.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
