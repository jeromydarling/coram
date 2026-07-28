/**
 * LocalPulseKeywordTuner — Inline keyword editor for the Local Pulse tab.
 *
 * WHAT: Lets stewards view and edit their tenant's search_keywords directly from Find Events.
 * WHERE: Shown on the Local Pulse section, below the header controls.
 * WHY: Allows fine-tuning of Local Pulse discovery without navigating to Settings.
 *
 * Help tooltip: These keywords shape which community events and resources are
 * discovered for your organization. Add terms related to your mission, the
 * populations you serve, or the types of events that matter to your community.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantOptional } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X, Plus, Sliders, HelpCircle, Loader2, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface LocalPulseKeywordTunerProps {
  /** Override tenant_id (e.g. for Gardener editing their own org). Falls back to auth profile. */
  overrideTenantId?: string;
  /** When true, renders as a full card instead of a collapsible trigger. */
  cardMode?: boolean;
}

export function LocalPulseKeywordTuner({ overrideTenantId, cardMode }: LocalPulseKeywordTunerProps = {}) {
  const { t } = useTranslation('events');
  const { profile } = useAuth();
  const tenantCtx = useTenantOptional();
  const tenantId = overrideTenantId || tenantCtx?.tenantId || (profile as any)?.tenant_id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-search-keywords', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('search_keywords, search_keywords_source')
        .eq('id', tenantId)
        .single();
      if (error) throw error;
      return data as { search_keywords: string[] | null; search_keywords_source: string | null };
    },
  });

  const keywords = tenant?.search_keywords || [];
  const source = tenant?.search_keywords_source || 'none';

  const updateMutation = useMutation({
    mutationFn: async (newKeywords: string[]) => {
      const newSource = source === 'enrichment' ? 'both' : (source === 'none' ? 'manual' : source);
      const { error } = await supabase
        .from('tenants')
        .update({
          search_keywords: newKeywords.slice(0, 20),
          search_keywords_source: newSource,
        })
        .eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-search-keywords'] });
      toast.success(t('keywordTuner.toastUpdated'));
    },
    onError: () => {
      toast.error(t('keywordTuner.toastError'));
    },
  });

  const handleAdd = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (!trimmed || keywords.includes(trimmed)) {
      setNewKeyword('');
      return;
    }
    if (keywords.length >= 20) {
      toast.error(t('keywordTuner.toastMaxKeywords'));
      return;
    }
    updateMutation.mutate([...keywords, trimmed]);
    setNewKeyword('');
  };

  const handleRemove = (kw: string) => {
    updateMutation.mutate(keywords.filter((k: string) => k !== kw));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  if (!tenantId) return null;

  const keywordContent = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{t('keywordTuner.discoveryKeywords')}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">{t('keywordTuner.tooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('keywordTuner.loading')}
        </div>
      ) : (
        <>
          {source !== 'none' && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Sparkles className="h-2.5 w-2.5" />
              {source === 'enrichment' && t('keywordTuner.sourceEnrichment')}
              {source === 'manual' && t('keywordTuner.sourceManual')}
              {source === 'both' && t('keywordTuner.sourceBoth')}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {keywords.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                {t('keywordTuner.noKeywords')}
              </p>
            )}
            {keywords.map((kw: string) => (
              <Badge key={kw} variant="secondary" className="gap-0.5 pr-0.5 text-[11px] h-5">
                {kw}
                <button
                  onClick={() => handleRemove(kw)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                  disabled={updateMutation.isPending}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-1.5">
            <Input
              placeholder={t('keywordTuner.inputPlaceholder')}
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-xs h-7"
              disabled={updateMutation.isPending}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={handleAdd}
              disabled={!newKeyword.trim() || updateMutation.isPending}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground">
            {t('keywordTuner.countHint', { count: keywords.length })}
          </p>
        </>
      )}
    </div>
  );

  if (cardMode) {
    return keywordContent;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
        >
          <Sliders className="w-3 h-3" />
          {t('keywordTuner.tuneDiscovery')}
          {keywords.length > 0 && (
            <Badge variant="secondary" className="h-4 text-[10px] px-1 ml-0.5">
              {keywords.length}
            </Badge>
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          {keywordContent}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
