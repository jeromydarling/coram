/**
 * ImportReadinessNoticeCard — Operator Nexus card showing import coverage analysis.
 *
 * WHAT: Displays coverage mode, adoption momentum, and playbook links after a Relatio import.
 * WHERE: Operator Nexus → Stabilitas (QA & Signals Zone).
 * WHY: Operators need to understand tenant data maturity to guide onboarding.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BookOpen, Users, Heart, Sprout, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ImportNotice {
  id: string;
  tenant_id: string;
  coverage_mode: string;
  contact_count: number;
  partner_count: number;
  household_count: number;
  has_notes: boolean;
  has_events: boolean;
  has_activities: boolean;
  adoption_momentum_score: number;
  suggested_playbooks: string[];
  narrative_summary: string;
  source_connector: string | null;
  created_at: string;
}

const modeConfig: Record<string, { label: string; color: string; icon: typeof Users }> = {
  A: { label: 'Structure Only', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Users },
  B: { label: 'Light History', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Heart },
  C: { label: 'Full Rhythm', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: Sprout },
};

const PLAYBOOK_TITLES: Record<string, string> = {
  'visitor-mode-quick-start': 'Visitor Mode Quick Start',
  'email-intake-dissemination': 'Email Intake Dissemination Guide',
  'dormant-relationship-recovery': 'Dormant Relationship Recovery',
  'momentum-activation': 'Momentum Activation',
};

export default function ImportReadinessNoticeCard() {
  const navigate = useNavigate();

  const { data: notices, isLoading } = useQuery({
    queryKey: ['operator-import-notices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_import_notices' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as ImportNotice[];
    },
  });

  const { data: playbooks } = useQuery({
    queryKey: ['operator-playbooks-for-notices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_playbooks' as any)
        .select('id, title')
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; title: string }[];
    },
  });

  // Build a title→id lookup for deep-linking
  const playbookLookup = new Map<string, string>();
  playbooks?.forEach((p) => {
    const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    playbookLookup.set(slug, p.id);
  });

  if (isLoading) {
    return <Skeleton className="h-40" />;
  }

  if (!notices?.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground font-serif">Import Readiness</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
            <p><strong>What:</strong> Coverage analysis from recent Relatio imports.</p>
            <p><strong>Where:</strong> Generated after each data import completes.</p>
            <p><strong>Why:</strong> Guides operator stewardship based on actual data maturity.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {notices.map((notice) => {
        const mode = modeConfig[notice.coverage_mode] || modeConfig.A;
        const ModeIcon = mode.icon;

        return (
          <Card key={notice.id} className="border-l-4 border-l-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ModeIcon className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    {notice.coverage_mode === 'A' && 'Structure imported — story begins now.'}
                    {notice.coverage_mode === 'B' && 'Legacy relationships detected.'}
                    {notice.coverage_mode === 'C' && 'Historical rhythm recognized.'}
                  </CardTitle>
                </div>
                <Badge variant="outline" className={`text-xs shrink-0 ${mode.color}`}>
                  Mode {notice.coverage_mode}: {mode.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {notice.narrative_summary}
              </p>

              {/* Stats */}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{notice.contact_count} people</span>
                {notice.partner_count > 0 && <span>{notice.partner_count} partners</span>}
                {notice.household_count > 0 && <span>{notice.household_count} households</span>}
                <span className="ml-auto font-medium">
                  Momentum: {notice.adoption_momentum_score}/100
                </span>
              </div>

              {/* Playbook links */}
              {notice.suggested_playbooks?.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {notice.suggested_playbooks.map((slug) => {
                    const title = PLAYBOOK_TITLES[slug] || slug;
                    const playbookId = playbookLookup.get(slug);
                    if (!playbookId) return null; // Don't show if playbook doesn't exist

                    return (
                      <Button
                        key={slug}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => navigate('/operator/nexus/playbooks')}
                      >
                        <BookOpen className="w-3 h-3" />
                        {title}
                      </Button>
                    );
                  })}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/60">
                {new Date(notice.created_at).toLocaleDateString()} · {notice.source_connector || 'Manual import'}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
