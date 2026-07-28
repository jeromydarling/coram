/**
 * NRISupportCompanion — Floating contextual help companion.
 *
 * WHAT: Chat-like panel providing archetype-aware guidance suggestions.
 * WHERE: Global — accessible from any tenant page.
 * WHY: Human-first support without requiring external tools or tickets.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, X, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const SUGGESTION_MAP: Record<string, { label: string; hint: string }> = {
  connect_email: { label: 'Connect your email', hint: 'Go to Settings → Email to link your inbox.' },
  connect_calendar: { label: 'Connect your calendar', hint: 'Go to Settings → Calendar to sync meetings.' },
  create_first_reflection: { label: 'Write a reflection', hint: 'Open any partner and add a reflection note.' },
  add_event: { label: 'Add an event', hint: 'Go to Events → Add Event to log a community event.' },
  enable_signum: { label: 'Enable local signals', hint: 'Go to Settings → Signum to activate community signals.' },
  import_contacts: { label: 'Import contacts', hint: 'Go to Import Center to bring in your data.' },
  join_communio: { label: 'Join the network', hint: 'Go to Communio to opt into shared signals.' },
  connect_hubspot: { label: 'Connect HubSpot', hint: 'Go to Relatio to set up your CRM bridge.' },
};

const PROMPTS = [
  'What should I do next?',
  'How does Signum work?',
  'Help me import from HubSpot.',
  'What is NRI?',
];

export function NRISupportCompanion() {
  const { tenantId, tenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const { data: context, isLoading } = useQuery({
    queryKey: ['nri-support-context', tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('nri-support-context', {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data?.context ?? null;
    },
    staleTime: 30_000,
  });

  if (!tenantId) return null;

  const nextStep = context?.next_suggestion;
  const suggestion = nextStep ? SUGGESTION_MAP[nextStep] : null;
  const completedSteps = context?.completed_steps ?? [];
  const pendingSteps = context?.pending_steps ?? [];

  const getPromptAnswer = (prompt: string): string => {
    switch (prompt) {
      case 'What should I do next?':
        if (suggestion) return `Your next step is: ${suggestion.label}. ${suggestion.hint}`;
        if (pendingSteps.length === 0) return 'You\'ve completed all onboarding steps! Explore your workspace and start building relationships.';
        return 'Check your Getting Started guide for the next step.';
      case 'How does Signum work?':
        return 'Signum discovers local events and news from your community. It uses keyword sets tuned to your archetype to surface relevant signals — quietly, in the background.';
      case 'Help me import from HubSpot.':
        return 'Go to Relatio in your sidebar. Select HubSpot, then follow the guided migration wizard. You can preview your data mapping before committing.';
      case 'What is NRI?':
        return 'NRI stands for Narrative Relational Intelligence. It\'s human-first intelligence built from your reflections, events, conversations, and community signals — not artificial data. AI assists, but the intelligence belongs to your relationships.';
      default:
        return 'I\'m here to help you get the most from CROS. Try one of the suggested prompts.';
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Open NRI Support"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[520px] flex flex-col">
          <Card className="shadow-2xl border-primary/10 flex flex-col max-h-[520px]">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
                    NRI Guide
                  </CardTitle>
                </div>
                <button onClick={() => { setOpen(false); setSelectedPrompt(null); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {context && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] capitalize">{context.archetype}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{completedSteps.length} steps done</Badge>
                </div>
              )}
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto space-y-4 pb-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Next suggestion */}
                  {suggestion && !selectedPrompt && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-xs text-muted-foreground mb-1">Suggested next step</p>
                      <p className="text-sm font-medium text-foreground">{suggestion.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{suggestion.hint}</p>
                    </div>
                  )}

                  {/* Selected prompt answer */}
                  {selectedPrompt && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">You asked</p>
                        <p className="text-sm font-medium">{selectedPrompt}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-sm text-foreground leading-relaxed">
                          {getPromptAnswer(selectedPrompt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedPrompt(null)}
                      >
                        ← Back to suggestions
                      </Button>
                    </div>
                  )}

                  {/* Prompt buttons */}
                  {!selectedPrompt && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Ask me anything</p>
                      {PROMPTS.map(p => (
                        <button
                          key={p}
                          onClick={() => setSelectedPrompt(p)}
                          className="w-full text-left p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-colors text-sm text-foreground"
                        >
                          {p} <ArrowRight className="inline h-3 w-3 ml-1 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
