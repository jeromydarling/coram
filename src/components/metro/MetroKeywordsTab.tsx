import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Plus, Trash2, Search, RotateCcw,
} from 'lucide-react';
import {
  useMetroKeywords,
  useAddMetroKeyword,
  useUpdateMetroKeyword,
  useDeleteMetroKeyword,
  useKeywordSettings,
  useUpsertKeywordSettings,
  useGlobalKeywords,
  KEYWORD_CATEGORIES,
} from '@/hooks/useMetroKeywords';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { cn } from '@/lib/utils';

interface MetroKeywordsTabProps {
  metroId: string;
  metroName: string;
}

const MATCH_MODE_LABELS: Record<string, string> = {
  phrase: 'Exact phrase',
  any: 'Any word',
  all: 'All words',
};

const CATEGORY_COLORS: Record<string, string> = {
  need_signals: 'bg-destructive/10 text-destructive border-destructive/20',
  education: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  workforce: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  health_services: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  partner_signals: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  policy: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  local_events: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  tone: 'bg-muted text-muted-foreground border-border',
};

export function MetroKeywordsTab({ metroId, metroName }: MetroKeywordsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('need_signals');

  const { data: metroKws, isLoading: kwsLoading } = useMetroKeywords(metroId);
  const { data: settings } = useKeywordSettings(metroId);
  const { data: globalKws } = useGlobalKeywords();
  const addKw = useAddMetroKeyword();
  const updateKw = useUpdateMetroKeyword();
  const deleteKw = useDeleteMetroKeyword();
  const upsertSettings = useUpsertKeywordSettings();

  const useGlobalDefaults = settings?.use_global_defaults ?? true;

  // Compiled preview
  const compiledCount = useMemo(() => {
    const metroCount = metroKws?.filter(k => k.enabled).length ?? 0;
    const globalCount = useGlobalDefaults ? (globalKws?.filter(k => k.enabled).length ?? 0) : 0;
    // Approximate: metro overrides might overlap with global
    return Math.min((settings?.max_keywords ?? 40), metroCount + globalCount);
  }, [metroKws, globalKws, useGlobalDefaults, settings]);

  const filteredKws = useMemo(() => {
    if (!metroKws) return [];
    let filtered = metroKws;
    if (filterCategory !== 'all') filtered = filtered.filter(k => k.category === filterCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(k => k.keyword.toLowerCase().includes(q));
    }
    return filtered;
  }, [metroKws, filterCategory, searchQuery]);

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    await addKw.mutateAsync({ metro_id: metroId, keyword: newKeyword.trim(), category: newCategory });
    setNewKeyword('');
  };

  const handleToggleGlobal = async (val: boolean) => {
    await upsertSettings.mutateAsync({ metro_id: metroId, use_global_defaults: val });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Keywords for {metroName}
        </h3>
        <HelpTooltip content="Keywords help Profunda listen for what matters in your community. They power news search queries that feed the Metro Narrative." />
      </div>

      {/* Settings + compiled preview */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium">Use Global Defaults</Label>
              <p className="text-[10px] text-muted-foreground">Merge system-wide keywords with metro-specific ones</p>
            </div>
            <Switch
              checked={useGlobalDefaults}
              onCheckedChange={handleToggleGlobal}
              disabled={upsertSettings.isPending}
            />
          </div>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Metro Overrides: </span>
              <strong>{metroKws?.length ?? 0}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Global Defaults: </span>
              <strong>{useGlobalDefaults ? (globalKws?.length ?? 0) : 'Off'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Active Keywords: </span>
              <strong className="text-primary">~{compiledCount}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add keyword */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              placeholder="e.g. warming center, digital literacy..."
              className="flex-1 h-8 text-xs"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEYWORD_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 text-xs gap-1" disabled={!newKeyword.trim() || addKw.isPending} onClick={handleAdd}>
              {addKw.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search keywords..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All categories</SelectItem>
            {KEYWORD_CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Keyword list */}
      {kwsLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : filteredKws.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-xs text-muted-foreground">
            {metroKws?.length === 0
              ? 'No metro-specific keywords yet. Add keywords or enable global defaults to start listening.'
              : 'No keywords match your filter.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-3 space-y-1.5">
            {filteredKws.map(kw => (
              <KeywordRow
                key={kw.id}
                kw={kw}
                metroId={metroId}
                onUpdate={updateKw}
                onDelete={deleteKw}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Keyword Row ──

function KeywordRow({
  kw,
  metroId,
  onUpdate,
  onDelete,
}: {
  kw: { id: string; keyword: string; category: string; weight: number; enabled: boolean; match_mode: string };
  metroId: string;
  onUpdate: ReturnType<typeof useUpdateMetroKeyword>;
  onDelete: ReturnType<typeof useDeleteMetroKeyword>;
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-lg border text-xs',
      kw.enabled ? 'border-border/50 bg-background' : 'border-border/30 bg-muted/30 opacity-60',
    )}>
      <Switch
        checked={kw.enabled}
        onCheckedChange={(val) => onUpdate.mutate({ id: kw.id, metro_id: metroId, enabled: val })}
        className="scale-75"
      />
      <span className="font-medium flex-1 min-w-0 truncate">{kw.keyword}</span>
      <Badge variant="outline" className={cn('text-[9px] h-4 px-1 shrink-0', CATEGORY_COLORS[kw.category])}>
        {KEYWORD_CATEGORIES.find(c => c.value === kw.category)?.label ?? kw.category}
      </Badge>
      <div className="flex items-center gap-1 shrink-0 w-20">
        <Slider
          value={[kw.weight]}
          min={1}
          max={10}
          step={1}
          onValueCommit={(val) => onUpdate.mutate({ id: kw.id, metro_id: metroId, weight: val[0] })}
          className="w-14"
        />
        <span className="text-[10px] text-muted-foreground w-4 text-right">{kw.weight}</span>
      </div>
      <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
        {MATCH_MODE_LABELS[kw.match_mode] ?? kw.match_mode}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-destructive shrink-0"
        onClick={() => onDelete.mutate({ id: kw.id, metro_id: metroId })}
        title="Remove keyword"
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}
