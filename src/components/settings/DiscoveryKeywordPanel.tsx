/**
 * DiscoveryKeywordPanel — Full 4-layer keyword governance for tenant settings.
 *
 * WHAT: Shows all keyword layers (global, archetype, enriched, steward) with edit controls.
 * WHERE: Settings page, replaces SearchKeywordsCard.
 * WHY: Transparency into how discovery feeds are personalized.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { X, Plus, Sparkles, HelpCircle, Loader2, Globe, Layers, RefreshCw, Lock, ChevronDown, Search } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  GLOBAL_BASELINE,
  buildDiscoveryKeywordStack,
  getArchetypeKeywords,
  normalizeKeyword,
  isStoplisted,
  type DiscoveryKeywordStack,
} from '@/lib/discoveryKeywords';

function KeywordLayer({
  title,
  icon: Icon,
  keywords,
  readOnly,
  description,
  onRemove,
}: {
  title: string;
  icon: React.ElementType;
  keywords: string[];
  readOnly: boolean;
  description: string;
  onRemove?: (kw: string) => void;
}) {
  const { t } = useTranslation('settings');
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 group">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1">{title}</span>
        {readOnly && <Lock className="h-3 w-3 text-muted-foreground/50" />}
        <Badge variant="outline" className="text-[10px] py-0 h-4">{keywords.length}</Badge>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1.5 pb-3">
        <p className="text-xs text-muted-foreground/70 mb-2">{description}</p>
        {keywords.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t('discovery.noKeywordsLayer')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="gap-1 pr-1 text-xs">
                {kw}
                {!readOnly && onRemove && (
                  <button
                    onClick={() => onRemove(kw)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DiscoveryKeywordPanel() {
  const { t } = useTranslation('settings');
  const { profile } = useAuth();
  const tenantId = (profile as any)?.tenant_id;
  const queryClient = useQueryClient();
  const [newKeyword, setNewKeyword] = useState('');

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-discovery-keywords', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('search_keywords, search_keywords_source, archetype')
        .eq('id', tenantId)
        .single();
      if (error) throw error;
      return data as {
        search_keywords: string[] | null;
        search_keywords_source: string | null;
        archetype: string | null;
      };
    },
  });

  const allKeywords = tenant?.search_keywords || [];
  const source = tenant?.search_keywords_source || 'none';
  const archetype = tenant?.archetype || null;

  // Separate enriched vs steward keywords
  // Convention: enriched keywords come first, steward-added ones are appended
  // We use the archetype baseline to distinguish
  const archetypeKw = useMemo(() => getArchetypeKeywords(archetype), [archetype]);

  const stack: DiscoveryKeywordStack = useMemo(() => {
    // For the current merged column approach, we consider:
    // - global: always GLOBAL_BASELINE
    // - archetype: from archetypeConfigs
    // - enriched: keywords in search_keywords not in global/archetype (if source includes 'enrichment')
    // - steward: keywords added manually (if source includes 'manual')
    // In practice, with merged column we show all tenant keywords as "enriched + steward"
    return buildDiscoveryKeywordStack(
      archetype,
      source === 'enrichment' || source === 'both' ? allKeywords : [],
      source === 'manual' || source === 'both' ? allKeywords : [],
    );
  }, [archetype, allKeywords, source]);

  const updateMutation = useMutation({
    mutationFn: async (newKeywords: string[]) => {
      const newSource = source === 'enrichment' ? 'both' : 'manual';
      const { error } = await supabase
        .from('tenants')
        .update({
          search_keywords: newKeywords.slice(0, 25),
          search_keywords_source: newSource,
        })
        .eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-discovery-keywords'] });
      toast.success(t('discovery.updated'));
    },
    onError: () => {
      toast.error(t('discovery.updateFailed'));
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tenant-enrich-org', {
        body: { tenant_id: tenantId, regenerate_keywords: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-discovery-keywords'] });
      toast.success(t('discovery.regenerated'));
    },
    onError: () => {
      toast.error(t('discovery.regenerateFailed'));
    },
  });

  const handleAdd = () => {
    const normalized = normalizeKeyword(newKeyword);
    if (!normalized || allKeywords.includes(normalized)) {
      setNewKeyword('');
      return;
    }
    if (isStoplisted(normalized)) {
      toast.error(t('discovery.stoplisted', { keyword: normalized }));
      setNewKeyword('');
      return;
    }
    if (allKeywords.length >= 25) {
      toast.error(t('discovery.maxKeywords'));
      return;
    }
    updateMutation.mutate([...allKeywords, normalized]);
    setNewKeyword('');
  };

  const handleRemove = (kw: string) => {
    updateMutation.mutate(allKeywords.filter((k: string) => k !== kw));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  if (!tenantId) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{t('discovery.title')}</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> {t('discovery.tooltipWhat')}</p>
                <p><strong>Where:</strong> {t('discovery.tooltipWhere')}</p>
                <p><strong>Why:</strong> {t('discovery.tooltipWhy')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          {t('discovery.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('discovery.loadingLayers')}
          </div>
        ) : (
          <>
            {/* Keyword Layers */}
            <div className="space-y-1 divide-y divide-border">
              <KeywordLayer
                title={t('discovery.layers.global')}
                icon={Globe}
                keywords={GLOBAL_BASELINE}
                readOnly
                description={t('discovery.layers.globalDesc')}
              />
              <KeywordLayer
                title={t('discovery.layers.archetype')}
                icon={Layers}
                keywords={archetypeKw}
                readOnly
                description={archetype ? t('discovery.layers.archetypeDesc', { archetype }) : t('discovery.layers.archetypeNone')}
              />
              <KeywordLayer
                title={t('discovery.layers.enriched')}
                icon={Sparkles}
                keywords={source === 'enrichment' || source === 'both' ? allKeywords : []}
                readOnly
                description={t('discovery.layers.enrichedDesc')}
              />
              <KeywordLayer
                title={t('discovery.layers.custom')}
                icon={Plus}
                keywords={source === 'manual' || source === 'both' ? allKeywords : []}
                readOnly={false}
                description={t('discovery.layers.customDesc')}
                onRemove={handleRemove}
              />
            </div>

            {/* Add keyword input */}
            <div className="flex gap-2">
              <Input
                placeholder={t('discovery.addPlaceholder')}
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-sm"
                disabled={updateMutation.isPending}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAdd}
                disabled={!newKeyword.trim() || updateMutation.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t('discovery.countInfo', { count: allKeywords.length, total: stack.finalStack.length })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
              >
                {regenerateMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {t('discovery.regenerate')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
