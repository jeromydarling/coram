/**
 * StudioAiAssistPanel — AI companion editor for Gardener Studio.
 *
 * WHAT: Provides tone refinement, simplification, Ignatian reflection, excerpt generation via Lovable AI.
 * WHERE: Right-side panel in essay/playbook editors
 * WHY: AI assists but never replaces human discernment. Draft-first, explicit acceptance required.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { Sparkles, Loader2, Check, X, RefreshCw } from 'lucide-react';

const ASSIST_ACTIONS = [
  { key: 'refine_tone', label: 'Refine tone', desc: 'Make the language more gentle and pastoral' },
  { key: 'simplify', label: 'Simplify language', desc: 'Make it clearer without losing depth' },
  { key: 'ignatian_reflection', label: 'Add Ignatian reflection', desc: 'Weave in contemplative rhythm' },
  { key: 'generate_excerpt', label: 'Generate excerpt', desc: 'Create a brief summary for previews' },
  { key: 'improve_seo', label: 'Improve SEO metadata', desc: 'Generate better title and description' },
  { key: 'suggest_structure', label: 'Suggest structure', desc: 'Propose section headings and flow' },
];

const MAX_ASSISTS = 10;

interface Props {
  entityType: string;
  entityId: string;
  currentContent: string;
  currentExcerpt?: string;
  onAcceptPatch: (patch: { content?: string; excerpt?: string; seo_title?: string; seo_description?: string }) => void;
}

export default function StudioAiAssistPanel({ entityType, entityId, currentContent, currentExcerpt, onAcceptPatch }: Props) {
  const { user } = useAuth();
  const [assistCount, setAssistCount] = useState(0);
  const [lastResult, setLastResult] = useState<{ action: string; proposed: string; reasoning: string } | null>(null);

  const assistMutation = useMutation({
    mutationFn: async (action: string) => {
      if (assistCount >= MAX_ASSISTS) throw new Error('Session assist limit reached (10). Please refresh to continue.');

      const { data, error } = await supabase.functions.invoke('gardener-ai-assist', {
        body: {
          action,
          entity_type: entityType,
          entity_id: entityId,
          content: currentContent,
          excerpt: currentExcerpt || '',
        },
      });
      if (error) throw error;
      if (!data?.proposed) throw new Error('No suggestion returned');

      // Log the suggestion
      await supabase.from('editor_ai_suggestions').insert({
        entity_type: entityType, entity_id: entityId,
        prompt_type: action,
        proposed_patch_json: { content: data.proposed, excerpt: data.proposed_excerpt },
        reasoning_text: data.reasoning,
        ai_model: 'google/gemini-2.5-flash',
      });

      setAssistCount(c => c + 1);
      return data;
    },
    onSuccess: (data, action) => {
      setLastResult({ action, proposed: data.proposed, reasoning: data.reasoning });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAccept = async () => {
    if (!lastResult) return;

    const patch: any = {};
    if (['refine_tone', 'simplify', 'ignatian_reflection', 'suggest_structure'].includes(lastResult.action)) {
      patch.content = lastResult.proposed;
    } else if (lastResult.action === 'generate_excerpt') {
      patch.excerpt = lastResult.proposed;
    } else if (lastResult.action === 'improve_seo') {
      // Parse SEO from proposed
      const lines = lastResult.proposed.split('\n');
      patch.seo_title = lines[0]?.replace('Title: ', '') || '';
      patch.seo_description = lines.slice(1).join(' ').replace('Description: ', '') || '';
    }

    onAcceptPatch(patch);

    // Mark as accepted in audit
    await supabase.from('gardener_audit_log').insert({
      actor_id: user!.id, action_type: 'ai_edit_accept', entity_type: entityType,
      entity_id: entityId, diff_json: { action: lastResult.action },
    });

    setLastResult(null);
    toast.success('Changes accepted');
  };

  const handleReject = () => {
    setLastResult(null);
  };

  return (
    <Card className="h-full">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium font-serif">AI Companion</span>
          </div>
          <Badge variant="outline" className="text-xs">{MAX_ASSISTS - assistCount} assists left</Badge>
        </div>

        <p className="text-xs text-muted-foreground italic">
          "Here's a gentler way to say this." Every suggestion requires your approval.
        </p>

        <Separator />

        {/* Action Buttons */}
        {!lastResult && (
          <div className="space-y-1.5">
            {ASSIST_ACTIONS.map(a => (
              <Button
                key={a.key}
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs h-auto py-2"
                disabled={assistMutation.isPending || assistCount >= MAX_ASSISTS || !currentContent.trim()}
                onClick={() => assistMutation.mutate(a.key)}
              >
                {assistMutation.isPending && assistMutation.variables === a.key ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : null}
                <div className="text-left">
                  <p className="font-medium">{a.label}</p>
                  <p className="text-muted-foreground font-normal">{a.desc}</p>
                </div>
              </Button>
            ))}
          </div>
        )}

        {/* Result / Diff View */}
        {lastResult && (
          <div className="space-y-3">
            <Badge variant="secondary" className="text-xs">{ASSIST_ACTIONS.find(a => a.key === lastResult.action)?.label}</Badge>

            <div className="text-xs text-muted-foreground italic p-2 rounded bg-muted/30">
              {lastResult.reasoning}
            </div>

            <div className="text-xs p-3 rounded border border-primary/20 bg-primary/5 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
              {lastResult.proposed.slice(0, 500)}{lastResult.proposed.length > 500 ? '…' : ''}
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5 flex-1" onClick={handleAccept}>
                <Check className="h-3.5 w-3.5" /> Accept Changes
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleReject}>
                <X className="h-3.5 w-3.5" /> Keep Original
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Edited with AI assistance — reviewed by Gardener
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
