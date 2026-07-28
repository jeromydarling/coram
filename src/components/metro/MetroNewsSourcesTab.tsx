import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, Globe, Rss, FileText, AlertTriangle, Check, Power, PowerOff, ExternalLink, Sparkles, Search } from 'lucide-react';
import {
  useMetroNewsSources,
  useAddMetroNewsSource,
  useDeleteMetroNewsSource,
  useToggleMetroNewsSource,
  useMetroNewsIngestionLog,
} from '@/hooks/useMetroNewsSources';
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

interface MetroNewsSourcesTabProps {
  metroId: string;
  metroName: string;
}

export function MetroNewsSourcesTab({ metroId, metroName }: MetroNewsSourcesTabProps) {
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: sources, isLoading: sourcesLoading } = useMetroNewsSources(metroId);
  const { data: ingestionLog, isLoading: logLoading } = useMetroNewsIngestionLog(metroId);
  const addSource = useAddMetroNewsSource();
  const deleteSource = useDeleteMetroNewsSource();
  const toggleSource = useToggleMetroNewsSource();

  const filteredSources = useMemo(() => {
    if (!sources) return [];
    let filtered = sources;
    if (!showInactive) filtered = filtered.filter(s => s.enabled);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => s.url?.toLowerCase().includes(q) || s.label?.toLowerCase().includes(q));
    }
    return filtered;
  }, [sources, showInactive, searchQuery]);

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    try {
      await addSource.mutateAsync({ url: newUrl.trim(), label: newLabel.trim() || undefined, metroId });
      setNewUrl('');
      setNewLabel('');
    } catch { /* handled by hook */ }
  };

  const autoCount = sources?.filter(s => s.source_origin === 'auto_discovered').length ?? 0;
  const manualCount = sources?.filter(s => s.source_origin === 'manual').length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Metro News Sources for {metroName}
          <HelpTooltip content="URLs that feed community narrative intelligence for this metro. Auto-discovered sources come from the system; you can add your own or remove unhelpful ones." />
        </h3>
        <div className="flex items-center gap-1.5 ml-auto text-xs">
          {autoCount > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <Sparkles className="w-3 h-3" /> {autoCount} auto
            </Badge>
          )}
          {manualCount > 0 && (
            <Badge variant="secondary" className="text-xs">{manualCount} manual</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="sources" className="space-y-3">
        <TabsList className="h-8">
          <TabsTrigger value="sources" className="text-xs h-7">Sources</TabsTrigger>
          <TabsTrigger value="ingestion" className="text-xs h-7">Ingestion Log</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-3">
          {/* Add form */}
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex gap-2">
                <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://localnews.org/community" className="flex-1 h-8 text-xs" />
                <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (optional)" className="w-36 h-8 text-xs" />
                <Button size="sm" className="h-8 text-xs gap-1" disabled={!newUrl.trim() || addSource.isPending} onClick={handleAdd}>
                  {addSource.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search sources..." className="pl-8 h-8 text-xs" />
            </div>
            <Button variant={showInactive ? 'secondary' : 'ghost'} size="sm" className="text-xs h-8" onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? 'Showing all' : 'Show inactive'}
            </Button>
          </div>

          {/* List */}
          {sourcesLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : filteredSources.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-xs text-muted-foreground">
                No news sources yet. Add URLs for local news sites, community blogs, or civic organizations.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-3 space-y-1.5">
                {filteredSources.map(source => (
                  <SourceRow key={source.id} source={source} onToggle={toggleSource} onDelete={deleteSource} />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ingestion" className="space-y-3">
          {logLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : !ingestionLog || ingestionLog.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-xs text-muted-foreground">
                No community news ingested yet. Once the pipeline runs, results appear here.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-3">
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
                          <p className="font-medium truncate max-w-xs">{item.payload?.title || 'Untitled'}</p>
                          {item.payload?.snippet && <p className="text-muted-foreground text-[10px] truncate max-w-xs mt-0.5">{item.payload.snippet}</p>}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {item.payload?.published_date ? format(new Date(item.payload.published_date), 'MMM d, yyyy') : format(new Date(item.created_at), 'MMM d, yyyy')}
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
                            <a href={item.payload.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
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

// ─── Source Row ───

function SourceRow({ source, onToggle, onDelete }: {
  source: any;
  onToggle: ReturnType<typeof useToggleMetroNewsSource>;
  onDelete: ReturnType<typeof useDeleteMetroNewsSource>;
}) {
  if (!source) return null;
  const FeedIcon = FEED_TYPE_ICONS[source.detected_feed_type || 'unknown'] || Globe;

  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-lg border text-xs',
      source.enabled ? 'border-border/50 bg-background' : 'border-border/30 bg-muted/30 opacity-60',
    )}>
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
      {source.auto_disabled && <Badge variant="destructive" className="text-[9px] h-4 px-1 shrink-0">disabled</Badge>}
      {source.last_status === 'error' && !source.auto_disabled && <AlertTriangle className="w-3 h-3 text-warning shrink-0" />}
      {source.last_status === 'ok' && <Check className="w-3 h-3 text-primary shrink-0" />}
      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => onToggle.mutate({ id: source.id, enabled: !source.enabled })} title={source.enabled ? 'Disable' : 'Enable'}>
        {source.enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive shrink-0" onClick={() => onDelete.mutate({ id: source.id })} title="Remove source">
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}
