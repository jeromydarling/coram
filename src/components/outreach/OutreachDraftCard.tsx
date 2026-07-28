import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wand2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';

const OUTREACH_MODES = [
  { value: 'partnership_intro', label: 'Partnership Intro', description: 'Explore collaboration potential' },
  { value: 'grant_collaboration', label: 'Grant Collaboration', description: 'Joint funding opportunities' },
  { value: 'event_networking', label: 'Event Networking', description: 'Conference follow-up' },
  { value: 'leadership_intro', label: 'Leadership Intro', description: 'Executive-level outreach' },
  { value: 'follow_up', label: 'Follow-up', description: 'Continue existing conversation' },
] as const;

interface OutreachDraftCardProps {
  opportunityId: string;
  campaignId?: string;
  contactNames?: string[];
}

export function OutreachDraftCard({ opportunityId, campaignId, contactNames }: OutreachDraftCardProps) {
  const queryClient = useQueryClient();
  const [selectedMode, setSelectedMode] = useState<string>('partnership_intro');
  const [showAlternates, setShowAlternates] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch existing drafts for this opportunity
  const { data: existingDrafts } = useQuery({
    queryKey: ['outreach-drafts', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_drafts')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const generateDraft = useMutation({
    mutationFn: async (mode: string) => {
      const { data, error } = await supabase.functions.invoke('outreach-draft-generate', {
        body: {
          opportunity_id: opportunityId,
          outreach_mode: mode,
          campaign_id: campaignId,
          contact_names: contactNames,
        },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string; message?: string; subject?: string; body_html?: string; alternates?: Array<{ subject: string; body_html: string }> };
      if (!result?.ok) throw new Error(result?.message || result?.error || 'Generation failed');
      return result;
    },
    onSuccess: () => {
      toast.success('Outreach draft generated');
      queryClient.invalidateQueries({ queryKey: ['outreach-drafts', opportunityId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to generate draft');
    },
  });

  const latestDraft = existingDrafts?.[0];
  const alternates = latestDraft?.alternates as Array<{ subject: string; body_html: string }> | undefined;

  const copyToClipboard = async (text: string, id: string) => {
    try {
      // Strip HTML tags for plain text copy
      const plainText = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      await navigator.clipboard.writeText(plainText);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          Smart Outreach Drafts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Selector */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Outreach Mode</p>
          <div className="flex flex-wrap gap-2">
            {OUTREACH_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setSelectedMode(mode.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                  selectedMode === mode.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {OUTREACH_MODES.find(m => m.value === selectedMode)?.description}
          </p>
        </div>

        {/* Generate Button */}
        <Button
          onClick={() => generateDraft.mutate(selectedMode)}
          disabled={generateDraft.isPending}
          className="w-full gap-2"
          size="sm"
        >
          {generateDraft.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating draft…
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate {OUTREACH_MODES.find(m => m.value === selectedMode)?.label} Draft
            </>
          )}
        </Button>

        {/* Latest Draft */}
        {latestDraft && latestDraft.status !== 'generating' && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {OUTREACH_MODES.find(m => m.value === latestDraft.outreach_mode)?.label || latestDraft.outreach_mode}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    latestDraft.status === 'draft' && 'bg-success/10 text-success',
                    latestDraft.status === 'failed' && 'bg-destructive/10 text-destructive',
                    latestDraft.status === 'applied' && 'bg-primary/10 text-primary',
                  )}
                >
                  {latestDraft.status}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 h-7 text-xs"
                onClick={() => copyToClipboard(
                  `Subject: ${latestDraft.subject}\n\n${latestDraft.body_html}`,
                  'main'
                )}
              >
                {copiedId === 'main' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                Copy
              </Button>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Subject: {latestDraft.subject}</p>
              <div
                className="text-sm text-muted-foreground prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(latestDraft.body_html) }}
              />
            </div>

            {/* Alternates */}
            {alternates && alternates.length > 0 && (
              <div>
                <button
                  onClick={() => setShowAlternates(!showAlternates)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {showAlternates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {alternates.length} alternate{alternates.length > 1 ? 's' : ''}
                </button>

                {showAlternates && (
                  <div className="mt-2 space-y-3">
                    {alternates.map((alt, i) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium">Alt {i + 1}: {alt.subject}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1"
                            onClick={() => copyToClipboard(
                              `Subject: ${alt.subject}\n\n${alt.body_html}`,
                              `alt-${i}`
                            )}
                          >
                            {copiedId === `alt-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                        <div
                          className="text-xs text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(alt.body_html) }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Generated {new Date(latestDraft.created_at).toLocaleString()}
            </p>
          </div>
        )}

        {latestDraft?.status === 'generating' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating outreach draft…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
