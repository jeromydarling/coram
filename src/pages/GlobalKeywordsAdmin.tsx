import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Search, Tags } from 'lucide-react';
import {
  useGlobalKeywords,
  useAddGlobalKeyword,
  useUpdateGlobalKeyword,
  useDeleteGlobalKeyword,
  KEYWORD_CATEGORIES,
} from '@/hooks/useMetroKeywords';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { cn } from '@/lib/utils';

// Match mode labels are now translated via t('common.globalKeywordsAdmin.matchModes.*') in the component

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

export default function GlobalKeywordsAdmin() {
  const { t } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('need_signals');

  const { data: keywords, isLoading } = useGlobalKeywords();
  const addKw = useAddGlobalKeyword();
  const updateKw = useUpdateGlobalKeyword();
  const deleteKw = useDeleteGlobalKeyword();

  const filtered = useMemo(() => {
    if (!keywords) return [];
    let result = keywords;
    if (filterCategory !== 'all') result = result.filter(k => k.category === filterCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(k => k.keyword.toLowerCase().includes(q));
    }
    return result;
  }, [keywords, filterCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const k of keywords ?? []) {
      counts[k.category] = (counts[k.category] ?? 0) + 1;
    }
    return counts;
  }, [keywords]);

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    await addKw.mutateAsync({ keyword: newKeyword.trim(), category: newCategory });
    setNewKeyword('');
  };

  return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-2">
          <Tags className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium">
            {t('globalKeywordsAdmin.heading')}
            <HelpTooltip content={t('globalKeywordsAdmin.helpTooltip')} />
          </h3>
          <Badge variant="outline" className="text-xs ml-auto">{t('globalKeywordsAdmin.totalCount', { count: keywords?.length ?? 0 })}</Badge>
        </div>

        {/* Category summary */}
        <div className="flex flex-wrap gap-1.5">
          {KEYWORD_CATEGORIES.map(c => (
            <Badge
              key={c.value}
              variant="outline"
              className={cn('text-[10px] cursor-pointer', filterCategory === c.value ? CATEGORY_COLORS[c.value] : '')}
              onClick={() => setFilterCategory(filterCategory === c.value ? 'all' : c.value)}
            >
              {c.label}: {categoryCounts[c.value] ?? 0}
            </Badge>
          ))}
        </div>

        {/* Add form */}
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                placeholder={t('globalKeywordsAdmin.addPlaceholder')}
                className="flex-1 h-8 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KEYWORD_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs gap-1" disabled={!newKeyword.trim() || addKw.isPending} onClick={handleAdd}>
                {addKw.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {t('globalKeywordsAdmin.add')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('globalKeywordsAdmin.searchPlaceholder')} className="pl-8 h-8 text-xs" />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">{t('globalKeywordsAdmin.noKeywordsMatch')}</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="pt-3 space-y-1.5">
              {filtered.map(kw => (
                <div
                  key={kw.id}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg border text-xs',
                    kw.enabled ? 'border-border/50 bg-background' : 'border-border/30 bg-muted/30 opacity-60',
                  )}
                >
                  <Switch
                    checked={kw.enabled}
                    onCheckedChange={val => updateKw.mutate({ id: kw.id, enabled: val })}
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
                      onValueCommit={val => updateKw.mutate({ id: kw.id, weight: val[0] })}
                      className="w-14"
                    />
                    <span className="text-[10px] text-muted-foreground w-4 text-right">{kw.weight}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                    {t(`globalKeywordsAdmin.matchModes.${kw.match_mode}`) || kw.match_mode}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive shrink-0"
                    onClick={() => deleteKw.mutate(kw.id)}
                    title={t('globalKeywordsAdmin.removeKeyword')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
  );
}
