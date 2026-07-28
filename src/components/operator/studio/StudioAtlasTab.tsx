/**
 * StudioAtlasTab — Mission Atlas draft generation and review.
 *
 * WHAT: Generate new atlas entries via Perplexity + Gemini, review/edit/approve drafts.
 * WHERE: Studio → Atlas tab (MACHINA zone — content generation)
 * WHY: Gardener can expand the Mission Atlas without manually writing every entry.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Check, X, Eye, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle as HelpIcon } from 'lucide-react';
import { MISSION_ATLAS, getArchetypeDisplay, getMetroTypeDisplay } from '@/content/missionAtlas';

const ARCHETYPES = [
  'church', 'catholic_outreach', 'digital_inclusion', 'social_enterprise',
  'workforce', 'refugee_support', 'education_access', 'library_system',
  'community_network', 'ministry_outreach', 'caregiver_solo', 'caregiver_agency',
];

const METRO_TYPES = ['urban', 'suburban', 'rural'] as const;

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpIcon className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

export default function StudioAtlasTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [archetype, setArchetype] = useState('');
  const [metroType, setMetroType] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNarrative, setEditNarrative] = useState('');

  // Existing static entries for reference
  const existingIds = new Set(MISSION_ATLAS.map(e => e.id));

  // Fetch drafts
  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: ['mission-atlas-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission_atlas_drafts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async ({ archetype, metro_type }: { archetype: string; metro_type: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mission-atlas-generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ archetype, metro_type }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Generation failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Draft generated. Ready for your review.');
      qc.invalidateQueries({ queryKey: ['mission-atlas-drafts'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Approve / Reject mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, narrative }: { id: string; status: string; narrative?: string }) => {
      const update: Record<string, unknown> = {
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };
      if (narrative) update.narrative = narrative;
      const { error } = await supabase.from('mission_atlas_drafts').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const label = vars.status === 'approved' ? 'Approved' : 'Rejected';
      toast.success(`${label}. ${vars.status === 'approved' ? 'Add to missionAtlas.ts to publish.' : ''}`);
      qc.invalidateQueries({ queryKey: ['mission-atlas-drafts'] });
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canGenerate = archetype && metroType && !generateMutation.isPending;
  const comboId = `${archetype}-${metroType}`;
  const alreadyExists = existingIds.has(comboId) || existingIds.has(comboId.replace('_', '-'));

  return (
    <div className="space-y-6">
      {/* Generator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate Atlas Entry
            <HelpTip text="Perplexity researches the archetype × metro combination, then Gemini drafts the narrative. NRI voice guardrails are applied automatically. You review before anything publishes." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Select value={archetype} onValueChange={setArchetype}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Archetype…" /></SelectTrigger>
              <SelectContent>
                {ARCHETYPES.map(a => (
                  <SelectItem key={a} value={a}>{getArchetypeDisplay(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={metroType} onValueChange={setMetroType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Metro type…" /></SelectTrigger>
              <SelectContent>
                {METRO_TYPES.map(m => (
                  <SelectItem key={m} value={m}>{getMetroTypeDisplay(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => generateMutation.mutate({ archetype, metro_type: metroType })}
              disabled={!canGenerate}
              size="sm"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Researching…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1" /> Generate</>
              )}
            </Button>
          </div>

          {alreadyExists && archetype && metroType && (
            <p className="text-xs text-amber-600">
              A static entry for {getArchetypeDisplay(archetype)} × {getMetroTypeDisplay(metroType)} already exists. Generating will create a draft you can compare.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Drafts list */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Drafts Awaiting Review
          <HelpTip text="Drafts stay here until approved. Approved entries should be added to missionAtlas.ts for publishing." />
        </h3>

        {draftsLoading && <p className="text-xs text-muted-foreground">Loading drafts…</p>}

        {drafts?.length === 0 && !draftsLoading && (
          <p className="text-xs text-muted-foreground italic">No drafts yet. Generate one above.</p>
        )}

        {drafts?.map(draft => (
          <Card key={draft.id} className={`border-l-4 ${
            draft.status === 'pending_review' ? 'border-l-primary' :
              draft.status === 'approved' ? 'border-l-green-600' :
              'border-l-muted-foreground'
          }`}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {getArchetypeDisplay(draft.archetype)} × {getMetroTypeDisplay(draft.metro_type)}
                  </span>
                  <Badge variant={draft.status === 'pending_review' ? 'default' : draft.status === 'approved' ? 'secondary' : 'outline'} className="text-[10px]">
                    {draft.status.replace('_', ' ')}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(draft.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Themes + Signals + Roles */}
              <div className="flex flex-wrap gap-1">
                {(draft.themes as string[])?.map((t: string) => (
                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {(draft.signals as string[])?.map((s: string) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">⚡ {s}</Badge>
                ))}
                {(draft.roles as string[])?.map((r: string) => (
                  <Badge key={r} variant="secondary" className="text-[10px]">👤 {r}</Badge>
                ))}
              </div>

              {/* Narrative */}
              {editingId === draft.id ? (
                <Textarea
                  value={editNarrative}
                  onChange={e => setEditNarrative(e.target.value)}
                  rows={6}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">{draft.narrative}</p>
              )}

              {/* Research context toggle */}
              {draft.research_context && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground flex items-center gap-1">
                    <Eye className="h-3 w-3" /> View research context
                  </summary>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
                    {(draft.research_context as Record<string, unknown>)?.research_summary as string || 'No research captured.'}
                  </div>
                  {((draft.research_context as Record<string, unknown>)?.citations as string[])?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {((draft.research_context as Record<string, unknown>)?.citations as string[]).map((c: string, i: number) => (
                        <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">{new URL(c).hostname}</a>
                      ))}
                    </div>
                  )}
                </details>
              )}

              {/* Actions */}
              {draft.status === 'pending_review' && (
                <div className="flex gap-2 pt-1">
                  {editingId === draft.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => reviewMutation.mutate({ id: draft.id, status: 'approved', narrative: editNarrative })}
                        disabled={reviewMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve with edits
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => reviewMutation.mutate({ id: draft.id, status: 'approved' })}
                        disabled={reviewMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingId(draft.id); setEditNarrative(draft.narrative); }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reviewMutation.mutate({ id: draft.id, status: 'rejected' })}
                        disabled={reviewMutation.isPending}
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
