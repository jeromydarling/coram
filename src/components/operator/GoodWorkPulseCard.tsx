/**
 * GoodWorkPulseCard — Gardener Nexus insight card for Projects (Good Works).
 *
 * WHAT: Shows projects this week, people helped, notes captured, story density.
 * WHERE: Operator Nexus Home page.
 * WHY: Calm awareness of good work happening across the ecosystem.
 *
 * Zone: CURA — stewardship awareness.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, FileText, Users, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function getMonday(d: Date): string {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
  dt.setUTCDate(diff);
  return dt.toISOString().split('T')[0];
}

export function GoodWorkPulseCard() {
  const weekStart = getMonday(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ['good-work-pulse', weekStart],
    queryFn: async () => {
      const weekStartISO = new Date(weekStart).toISOString();
      const nextWeek = new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString();

      // Projects created this week
      const { data: projects } = await supabase
        .from('activities')
        .select('id, tenant_id')
        .eq('activity_type', 'Project' as any)
        .gte('activity_date_time', weekStartISO)
        .lt('activity_date_time', nextWeek);

      const projectIds = (projects || []).map(p => p.id);
      const projectCount = projectIds.length;

      // Child notes for those projects
      let notesCount = 0;
      if (projectIds.length > 0) {
        const { count } = await supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .in('parent_activity_id', projectIds);
        notesCount = count ?? 0;
      }

      // Impact snapshots
      let peopleHelpedSum = 0;
      let missingImpactCount = 0;
      if (projectIds.length > 0) {
        const { data: impacts } = await supabase
          .from('activity_impact')
          .select('activity_id, people_helped')
          .in('activity_id', projectIds);

        const impactMap = new Set((impacts || []).map((i: any) => i.activity_id));
        peopleHelpedSum = (impacts || []).reduce((s: number, i: any) => s + (i.people_helped || 0), 0);
        missingImpactCount = projectIds.filter(id => !impactMap.has(id)).length;
      }

      // Distinct helpers
      let helpersCount = 0;
      if (projectIds.length > 0) {
        const { data: participants } = await supabase
          .from('activity_participants')
          .select('display_name')
          .in('activity_id', projectIds);
        const unique = new Set((participants || []).map((p: any) => p.display_name));
        helpersCount = unique.size;
      }

      const storyDensity = projectCount > 0 ? Math.round(notesCount / projectCount * 10) / 10 : 0;

      return {
        projectCount,
        notesCount,
        peopleHelpedSum,
        helpersCount,
        storyDensity,
        missingImpactCount,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <Skeleton className="h-40" />;
  }

  if (!data || data.projectCount === 0) return null;

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-serif">
          <Heart className="w-4 h-4 text-primary" />
          Good Work Pulse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-xl font-semibold text-foreground">{data.projectCount}</p>
            <p className="text-xs text-muted-foreground">Projects this week</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-foreground">
              {data.peopleHelpedSum > 0 ? data.peopleHelpedSum : '—'}
            </p>
            <p className="text-xs text-muted-foreground">People helped</p>
          </div>
          <div className="flex items-start gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground mt-1" />
            <div>
              <p className="text-xl font-semibold text-foreground">{data.notesCount}</p>
              <p className="text-xs text-muted-foreground">Notes captured</p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground mt-1" />
            <div>
              <p className="text-xl font-semibold text-foreground">{data.helpersCount}</p>
              <p className="text-xs text-muted-foreground">Helpers involved</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2">
          <span>Story density: <strong className="text-foreground">{data.storyDensity}</strong> notes/project</span>
          {data.missingImpactCount > 0 && (
            <Badge variant="outline" className="gap-1 text-xs">
              <AlertCircle className="w-3 h-3" />
              {data.missingImpactCount} without impact count
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
