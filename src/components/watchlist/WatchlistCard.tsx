import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Globe, Clock, Loader2, RotateCcw, GitCompare } from 'lucide-react';
import { useOrgWatchlist, useUpdateOrgWatchlist, useAddToWatchlist, useOrgDiffs } from '@/hooks/useOrgWatchlist';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { toast } from '@/components/ui/sonner';

interface WatchlistCardProps {
  orgId: string;
  orgName?: string | null;
  websiteUrl?: string | null;
}

export function WatchlistCard({ orgId, orgName, websiteUrl }: WatchlistCardProps) {
  const { data: watchlist, isLoading } = useOrgWatchlist(orgId);
  const { data: diffs } = useOrgDiffs(orgId);
  const updateMutation = useUpdateOrgWatchlist();
  const addMutation = useAddToWatchlist();
  const { hasAnyRole } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);

  const canEdit = hasAnyRole(['admin', 'leadership', 'regional_lead']);

  // Derive last_changed_at from latest diff where changed=true
  const lastChangedDiff = diffs?.find((d) => {
    const diff = d.diff as Record<string, unknown>;
    return diff?.changed === true;
  });
  const lastChangedAt = lastChangedDiff?.created_at ?? null;

  const handleRetryCrawl = async () => {
    setIsRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('n8n-dispatch', {
        body: {
          workflow_key: 'watchlist_ingest',
          org_id: orgId,
          org_name: orgName || orgId,
          website_url: watchlist?.website_url || websiteUrl,
        },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; run_id?: string; message?: string };
      if (result?.ok) {
        toast.success(`Crawl dispatched — run ${result.run_id?.slice(0, 8)}…`);
      } else {
        toast.error(result?.message || 'Crawl dispatch failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Crawl dispatch failed');
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!watchlist) {
    const resolvedUrl = websiteUrl;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Watchlist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Not on watchlist</p>
          {canEdit && resolvedUrl && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              disabled={addMutation.isPending}
              onClick={() => addMutation.mutate({ orgId, websiteUrl: resolvedUrl })}
            >
              {addMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              Add to Watchlist
            </Button>
          )}
          {canEdit && !resolvedUrl && (
            <p className="text-xs text-muted-foreground italic">Add a website URL to enable monitoring</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Watchlist
          <Badge variant={watchlist.enabled ? 'default' : 'secondary'} className="ml-auto text-xs">
            {watchlist.enabled ? 'Active' : 'Paused'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Monitoring</span>
          <Switch
            checked={watchlist.enabled}
            disabled={!canEdit || updateMutation.isPending}
            onCheckedChange={(enabled) =>
              updateMutation.mutate({ orgId, updates: { enabled } })
            }
          />
        </div>

        {/* Cadence */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Cadence</span>
          {canEdit ? (
            <Select
              value={watchlist.cadence}
              disabled={updateMutation.isPending}
              onValueChange={(cadence) =>
                updateMutation.mutate({ orgId, updates: { cadence } })
              }
            >
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm capitalize">{watchlist.cadence}</span>
          )}
        </div>

        {/* Website URL */}
        <div className="flex items-center gap-2 text-sm">
          <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="truncate text-muted-foreground">
            {watchlist.website_url || websiteUrl || '—'}
          </span>
        </div>

        {/* Last crawled */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">
            Last crawled:{' '}
            {watchlist.last_crawled_at
              ? format(parseISO(watchlist.last_crawled_at), 'MMM d, yyyy h:mm a')
              : 'Never'}
          </span>
        </div>

        {/* Last changed */}
        <div className="flex items-center gap-2 text-sm">
          <GitCompare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">
            Last changed:{' '}
            {lastChangedAt
              ? format(parseISO(lastChangedAt), 'MMM d, yyyy h:mm a')
              : 'No changes detected'}
          </span>
        </div>

        {/* Retry crawl button */}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            disabled={isRetrying}
            onClick={handleRetryCrawl}
          >
            {isRetrying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            Retry crawl
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
