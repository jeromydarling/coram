/**
 * SearchKeywordsCard — Tenant search keyword management.
 *
 * WHAT: Displays and allows editing of search keywords that tailor discovery results.
 * WHERE: Settings page, under discovery/search section.
 * WHY: Lets stewards refine how Perplexity search interprets their organization's focus areas.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X, Plus, Sparkles, HelpCircle, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

export function SearchKeywordsCard() {
  const { profile } = useAuth();
  const tenantId = (profile as any)?.tenant_id;
  const queryClient = useQueryClient();
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
      const newSource = source === 'enrichment' ? 'both' : 'manual';
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
      toast.success('Search keywords updated');
    },
    onError: () => {
      toast.error('Could not update keywords');
    },
  });

  const handleAdd = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (!trimmed || keywords.includes(trimmed)) {
      setNewKeyword('');
      return;
    }
    if (keywords.length >= 20) {
      toast.error('Maximum 20 keywords allowed');
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Search Keywords</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-sm">
                  These keywords help tailor discovery search results to your organization's focus areas.
                  They're automatically extracted during identity enrichment, but you can add or remove them manually.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Refine how discovery searches understand your organization's mission and community.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading keywords…
          </div>
        ) : (
          <>
            {source !== 'none' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                {source === 'enrichment' && 'Auto-extracted from your organization profile'}
                {source === 'manual' && 'Manually configured'}
                {source === 'both' && 'Auto-extracted + manually refined'}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {keywords.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No keywords yet. Enrich your organization profile or add them manually below.
                </p>
              )}
              {keywords.map((kw: string) => (
                <Badge key={kw} variant="secondary" className="gap-1 pr-1">
                  {kw}
                  <button onClick={() => handleRemove(kw)} className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors" disabled={updateMutation.isPending}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <Input placeholder="Add a keyword (e.g., refugee services, ESL programs)" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={handleKeyDown} className="text-sm" disabled={updateMutation.isPending} />
              <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newKeyword.trim() || updateMutation.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {keywords.length}/20 keywords · Press Enter to add
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
