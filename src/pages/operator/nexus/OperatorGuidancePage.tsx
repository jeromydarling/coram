/**
 * OperatorGuidancePage — Praeceptum living guidance memory dashboard.
 *
 * WHAT: Shows aggregated guidance effectiveness, friction learning, archetype patterns.
 * WHERE: /operator/nexus/guidance
 * WHY: Helps operators understand which guidance prompts help humans — not analytics, wisdom.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const HelpTip = HelpTooltip;

export default function OperatorGuidancePage() {
  const { data: memoryRows, isLoading } = useQuery({
    queryKey: ['praeceptum-guidance-memory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('praeceptum_guidance_memory')
        .select('*')
        .order('confidence_score', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  const topPrompts = memoryRows?.filter((r: any) => r.confidence_score > 0.5) || [];
  const frictionPrompts = memoryRows?.filter((r: any) => r.friction_after_count > r.resolution_count) || [];
  const totalInterventions = memoryRows?.reduce((s: number, r: any) => s + (r.intervention_count || 0), 0) || 0;
  const totalResolutions = memoryRows?.reduce((s: number, r: any) => s + (r.resolution_count || 0), 0) || 0;
  const resolutionRate = totalInterventions > 0 ? Math.round((totalResolutions / totalInterventions) * 100) : 0;

  // Group by archetype
  const archetypeMap = new Map<string, { count: number; avgConf: number }>();
  memoryRows?.forEach((r: any) => {
    const key = r.archetype_key || 'unknown';
    const entry = archetypeMap.get(key) || { count: 0, avgConf: 0 };
    entry.count++;
    entry.avgConf = ((entry.avgConf * (entry.count - 1)) + (r.confidence_score || 0)) / entry.count;
    archetypeMap.set(key, entry);
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">
          Praeceptum — Living Guidance Memory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Which guidance prompts help humans move forward — remembered wisdom, not AI automation.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Guidance Effectiveness */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Guidance Effectiveness
                <HelpTip
                  what="Top-performing guidance prompts by resolution rate"
                  where="Praeceptum guidance memory"
                  why="Shows which prompts actually help humans complete actions"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">{resolutionRate}%</p>
                  <p className="text-xs text-muted-foreground">Overall resolution rate</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{totalInterventions}</p>
                  <p className="text-xs text-muted-foreground">Total interventions</p>
                </div>
              </div>
              <div className="space-y-2">
                {topPrompts.slice(0, 5).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate max-w-[60%]">{p.prompt_key}</span>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(p.confidence_score * 100)}% conf
                    </Badge>
                  </div>
                ))}
                {topPrompts.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    No high-confidence prompts yet — wisdom takes time.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Friction Learning */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Friction Learning
                <HelpTip
                  what="Prompts that cause repeated friction after showing"
                  where="Praeceptum guidance memory"
                  why="Identifies guidance that may need different wording or timing"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {frictionPrompts.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <p className="text-foreground truncate">{p.prompt_key}</p>
                    <p className="text-muted-foreground">
                      {p.context} · {p.friction_after_count} friction events
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {Math.round(p.confidence_score * 100)}%
                  </Badge>
                </div>
              ))}
              {frictionPrompts.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No friction patterns detected yet — the system is still learning.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Archetype Learning */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Archetype Patterns
                <HelpTip
                  what="How different archetypes respond to guidance"
                  where="Praeceptum by archetype_key"
                  why="Different mission types benefit from different approaches"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from(archetypeMap.entries()).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{val.count} prompts</span>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(val.avgConf * 100)}% avg
                    </Badge>
                  </div>
                </div>
              ))}
              {archetypeMap.size === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Archetype insights emerge as more tenants interact with guidance.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Evolution Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Confidence Evolution
                <HelpTip
                  what="How confidence scores change over time"
                  where="Praeceptum guidance memory last_seen_at"
                  why="Shows whether the system is getting better at helping humans"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(memoryRows || []).slice(0, 6).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <p className="text-foreground truncate">{r.prompt_key}</p>
                    <p className="text-muted-foreground">
                      Last seen {new Date(r.last_seen_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${Math.round(r.confidence_score * 60)}px` }}
                    />
                    <span className="text-muted-foreground w-8 text-right">
                      {Math.round(r.confidence_score * 100)}%
                    </span>
                  </div>
                </div>
              ))}
              {(!memoryRows || memoryRows.length === 0) && (
                <p className="text-xs text-muted-foreground italic">
                  Guidance memories will appear here as the system learns.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
