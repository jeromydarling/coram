import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, Globe, Rss, FileText, AlertTriangle, Check, Power, PowerOff, Newspaper, ExternalLink, Sparkles, Search } from 'lucide-react';
import {
  useMetroNewsSources,
  useAddMetroNewsSource,
  useDeleteMetroNewsSource,
  useToggleMetroNewsSource,
  useMetroNewsIngestionLog,
} from '@/hooks/useMetroNewsSources';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';

const FEED_TYPE_ICONS: Record<string, typeof Rss> = {
  rss: Rss,
  html: FileText,
  unknown: Globe,
};

const FEED_TYPE_LABELS: Record<string, string> = {
  rss: 'RSS Feed',
  html: 'Web Page',
  unknown: 'Unknown',
};

export default function MetroNewsAdmin() {
  const [selectedMetro, setSelectedMetro] = useState<string>('all');
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addMetro, setAddMetro] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const metroFilter = selectedMetro === 'all' ? null : selectedMetro;

  const { data: sources, isLoading: sourcesLoading } = useMetroNewsSources(metroFilter);
  const { data: ingestionLog, isLoading: logLoading } = useMetroNewsIngestionLog(metroFilter);
  const addSource = useAddMetroNewsSource();
  const deleteSource = useDeleteMetroNewsSource();
  const toggleSource = useToggleMetroNewsSource();

  // Fetch metros for selector
  const { data: metros } = useQuery({
    queryKey: ['metros-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metros')
        .select('id, metro')
        .order('metro');
      if (error) throw error;
      return data || [];
    },
  });

  const filteredSources = useMemo(() => {
    if (!sources) return [];
    let filtered = sources;
    if (!showInactive) {
      filtered = filtered.filter(s => s.enabled);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        (s.url?.toLowerCase().includes(q)) ||
        (s.label?.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [sources, showInactive, searchQuery]);

  // Group sources by metro for the "all" view
  const groupedSources = useMemo(() => {
    if (selectedMetro !== 'all') return null;
    const groups = new Map<string, typeof filteredSources>();
    for (const s of filteredSources) {
      const metro = metros?.find(m => m.id === s.metro_id);
      const key = metro?.metro || 'Unknown Metro';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSources, selectedMetro, metros]);

  const handleAdd = async () => {
    const targetMetro = selectedMetro !== 'all' ? selectedMetro : addMetro;
    if (!newUrl.trim() || !targetMetro) return;
    try {
      await addSource.mutateAsync({
        url: newUrl.trim(),
        label: newLabel.trim() || undefined,
        metroId: targetMetro,
      });
      setNewUrl('');
      setNewLabel('');
      setAddMetro('');
    } catch { /* handled by hook */ }
  };

  const autoCount = sources?.filter(s => s.source_origin === 'auto_discovered').length ?? 0;
  const manualCount = sources?.filter(s => s.source_origin === 'manual').length ?? 0;

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Newspaper className="h-6 w-6 text-primary" />
          Community News Sources
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What the system reads to build metro stories — auto-discovered and manually curated.
          <HelpTooltip content="Manages the URLs that feed community narrative intelligence per metro. Auto-discovered sources come from the system; you can add your own or remove unhelpful ones." />
        </p>
      </div>

      {/* Metro filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Select value={selectedMetro} onValueChange={setSelectedMetro}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All metros" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All metros</SelectItem>
            {metros?.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.metro}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {autoCount > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <Sparkles className="w-3 h-3" /> {autoCount} auto-discovered
            </Badge>
          )}
          {manualCount > 0 && (
            <Badge variant="secondary" className="text-xs">{manualCount} manual</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="ingestion">Ingestion Log</TabsTrigger>
        </TabsList>

        {/* ─── Sources Tab ─── */}
        <TabsContent value="sources" className="space-y-4">
          {/* Add source form */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                {selectedMetro === 'all' && (
                  <Select value={addMetro} onValueChange={setAddMetro}>
                    <SelectTrigger className="w-[180px] h-9 text-xs">
                      <SelectValue placeholder="Select metro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {metros?.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.metro}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://localnews.org/community"
                  className="flex-1 h-9 text-xs"
                />
                <Input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-40 h-9 text-xs"
                />
                <Button
                  size="sm"
                  className="h-9 text-xs gap-1"
                  disabled={!newUrl.trim() || (!metroFilter && !addMetro) || addSource.isPending}
                  onClick={handleAdd}
                >
                  {addSource.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add Source
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search + filters */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search sources..."
                className="pl-8 h-9 text-xs"
              />
            </div>
            <Button
              variant={showInactive ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-9"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? 'Showing all' : 'Show inactive'}
            </Button>
          </div>

          {/* Sources list */}
          {sourcesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSources.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No news sources yet. Add URLs for local news sites, community blogs, or civic organizations.
              </CardContent>
            </Card>
          ) : groupedSources ? (
            // Grouped by metro view
            <div className="space-y-4">
              {groupedSources.map(([metroName, items]) => (
                <Card key={metroName}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-primary" />
                      {metroName}
                      <Badge variant="outline" className="text-[10px] ml-auto">{items.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {items.map(source => (
                      <SourceRow key={source.id} source={source} onToggle={toggleSource} onDelete={deleteSource} />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Single metro view
            <Card>
              <CardContent className="pt-4 space-y-1.5">
                {filteredSources.map(source => (
                  <SourceRow key={source.id} source={source} onToggle={toggleSource} onDelete={deleteSource} />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Ingestion Log Tab ─── */}
        <TabsContent value="ingestion" className="space-y-4">
          {logLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !ingestionLog || ingestionLog.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No community news has been ingested yet. Once the narrative pipeline runs, results will appear here.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Title</TableHead>
                      <TableHead className="text-xs w-28">Date</TableHead>
                      <TableHead className="text-xs w-24">Tags</TableHead>
                      <TableHead className="text-xs w-16">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingestionLog.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs">
                          <div>
                            <p className="font-medium truncate max-w-xs">{item.payload?.title || 'Untitled'}</p>
                            {item.payload?.snippet && (
                              <p className="text-muted-foreground text-[10px] truncate max-w-xs mt-0.5">
                                {item.payload.snippet}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {item.payload?.published_date
                            ? format(new Date(item.payload.published_date), 'MMM d, yyyy')
                            : format(new Date(item.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-0.5">
                            {(item.payload?.community_impact_tags || []).slice(0, 2).map(tag => (
                              <Badge key={tag} variant="outline" className="text-[9px] h-4 px-1">{tag}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.payload?.source_url && (
                            <a
                              href={item.payload.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Source Row Component ───

interface SourceRowProps {
  source: ReturnType<typeof useMetroNewsSources>['data'] extends (infer T)[] | undefined ? T : never;
  onToggle: ReturnType<typeof useToggleMetroNewsSource>;
  onDelete: ReturnType<typeof useDeleteMetroNewsSource>;
}

function SourceRow({ source, onToggle, onDelete }: SourceRowProps) {
  if (!source) return null;
  const FeedIcon = FEED_TYPE_ICONS[source.detected_feed_type || 'unknown'] || Globe;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border text-xs',
        source.enabled ? 'border-border/50 bg-background' : 'border-border/30 bg-muted/30 opacity-60',
      )}
    >
      <FeedIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {source.label && <p className="truncate font-medium text-xs">{source.label}</p>}
          {source.source_origin === 'auto_discovered' && (
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0 gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> auto
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-[10px] break-all leading-tight truncate">{source.url}</p>
      </div>

      {source.detected_feed_type && (
        <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
          {FEED_TYPE_LABELS[source.detected_feed_type] || source.detected_feed_type}
        </Badge>
      )}

      {source.auto_disabled && (
        <Badge variant="destructive" className="text-[9px] h-4 px-1 shrink-0">disabled</Badge>
      )}

      {source.last_status === 'error' && !source.auto_disabled && (
        <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
      )}
      {source.last_status === 'ok' && (
        <Check className="w-3 h-3 text-primary shrink-0" />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0"
        onClick={() => onToggle.mutate({ id: source.id, enabled: !source.enabled })}
        title={source.enabled ? 'Disable' : 'Enable'}
      >
        {source.enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-destructive shrink-0"
        onClick={() => onDelete.mutate({ id: source.id })}
        title="Remove source"
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}
