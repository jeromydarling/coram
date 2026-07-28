import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { addDays, subDays, differenceInDays, parseISO, format, isAfter, isBefore } from 'date-fns';

interface FocusItem {
  id: string;
  type: 'stale_opportunity' | 'pipeline_near' | 'grant_deadline' | 'overdue_followup' | 'reporting_due';
  name: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  dueDate?: string;
  metroName?: string;
  link?: { type: string; id: string };
}

interface CommandCenterData {
  focusItems: FocusItem[];
  anchorVelocity: {
    daysSinceLastAnchor: number;
    anchorsInRamp: number;
    anchorsInScale: number;
    totalActive: number;
  };
  metroDeltas: {
    metro: string;
    change: string;
    trend: 'up' | 'down' | 'neutral';
  }[];
  adminTasks: {
    reportsdue: number;
    followupsOverdue: number;
  };
  aiInsight: string | null;
  isGeneratingInsight: boolean;
}

export function useCommandCenter() {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['command-center', user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    queryFn: async (): Promise<CommandCenterData> => {
      const today = new Date();
      const thirtyDaysAgo = subDays(today, 30);
      const fortyFiveDaysFromNow = addDays(today, 45);

      // Fetch stale opportunities (tenant-scoped)
      const { data: staleOpps } = await supabase
        .from('opportunities')
        .select('id, organization, stage, last_contact_date, metro_id, metros(metro)')
        .eq('status', 'Active')
        .eq('tenant_id', tenantId!)
        .lt('last_contact_date', thirtyDaysAgo.toISOString())
        .not('stage', 'in', '("Stable Producer","Closed - Not a Fit")')
        .order('last_contact_date', { ascending: true })
        .limit(10);

      // Fetch pipeline near conversion (tenant-scoped via opportunity)
      const { data: pipelineNear } = await supabase
        .from('anchor_pipeline')
        .select(`
          id, stage, probability, opportunity_id,
          opportunities!inner(organization, tenant_id),
          metros(metro)
        `)
        .in('stage', ['Agreement Pending', 'Agreement Signed'])
        .gte('probability', 60)
        .limit(10) as any;
      // Filter client-side for tenant scope (nested .eq not supported on joined column types)
      const tenantPipeline = (pipelineNear ?? []).filter(
        (p: any) => (p.opportunities as any)?.tenant_id === tenantId
      );

      // Fetch grants with deadlines (RLS-scoped, no tenant_id column)
      const { data: grantDeadlines } = await supabase
        .from('grants')
        .select('id, grant_name, stage, grant_term_start, funder_name, metros(metro)')
        .eq('status', 'Active')
        .in('stage', ['LOI Submitted', 'Full Proposal Submitted', 'Cultivating'])
        .limit(10);

      // Fetch overdue follow-ups (tenant-scoped)
      const { data: overdueActions } = await supabase
        .from('opportunities')
        .select('id, organization, next_action_due, next_step, metros(metro)')
        .eq('status', 'Active')
        .eq('tenant_id', tenantId!)
        .lt('next_action_due', today.toISOString())
        .not('next_action_due', 'is', null)
        .order('next_action_due', { ascending: true })
        .limit(10);

      // Fetch anchors for velocity (tenant-scoped via opportunity)
      const { data: allAnchors } = await supabase
        .from('anchors')
        .select('id, first_volume_date, stable_producer_date, opportunities!inner(organization, tenant_id), metros(metro)')
        .not('first_volume_date', 'is', null) as any;
      const anchors = (allAnchors ?? []).filter(
        (a: any) => (a.opportunities as any)?.tenant_id === tenantId
      );

      // Build focus items
      const focusItems: FocusItem[] = [];

      // Add stale opportunities
      (staleOpps || []).forEach(opp => {
        const daysSince = differenceInDays(today, parseISO(opp.last_contact_date));
        focusItems.push({
          id: opp.id,
          type: 'stale_opportunity',
          name: opp.organization,
          description: `No contact in ${daysSince} days at ${opp.stage}`,
          urgency: daysSince > 45 ? 'high' : 'medium',
          metroName: (opp.metros as any)?.metro,
          link: { type: 'opportunity', id: opp.id }
        });
      });

      // Add pipeline near conversion
      (tenantPipeline || []).forEach(p => {
        focusItems.push({
          id: p.id,
          type: 'pipeline_near',
          name: (p.opportunities as any)?.organization || 'Unknown',
          description: `${p.stage} at ${p.probability}% probability`,
          urgency: 'high',
          metroName: (p.metros as any)?.metro,
          link: { type: 'pipeline', id: p.id }
        });
      });

      // Add grant deadlines
      (grantDeadlines || []).forEach(g => {
        focusItems.push({
          id: g.id,
          type: 'grant_deadline',
          name: g.grant_name,
          description: `${g.stage} - ${g.funder_name}`,
          urgency: 'medium',
          dueDate: g.grant_term_start || undefined,
          metroName: (g.metros as any)?.metro,
          link: { type: 'grant', id: g.id }
        });
      });

      // Add overdue follow-ups
      (overdueActions || []).forEach(action => {
        const daysOverdue = differenceInDays(today, parseISO(action.next_action_due!));
        focusItems.push({
          id: action.id,
          type: 'overdue_followup',
          name: action.organization,
          description: `Overdue ${daysOverdue}d: ${action.next_step || 'Follow up needed'}`,
          urgency: daysOverdue > 7 ? 'high' : 'medium',
          dueDate: action.next_action_due || undefined,
          metroName: (action.metros as any)?.metro,
          link: { type: 'opportunity', id: action.id }
        });
      });

      // Sort by urgency
      focusItems.sort((a, b) => {
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });

      // Calculate anchor velocity
      const rampAnchors = anchors?.filter(a => a.first_volume_date && !a.stable_producer_date) || [];
      const scaleAnchors = anchors?.filter(a => a.stable_producer_date) || [];
      
      const sortedAnchors = [...(anchors || [])].sort((a, b) => 
        new Date(b.first_volume_date!).getTime() - new Date(a.first_volume_date!).getTime()
      );
      const latestAnchorDate = sortedAnchors[0]?.first_volume_date;
      const daysSinceLastAnchor = latestAnchorDate 
        ? differenceInDays(today, parseISO(latestAnchorDate))
        : -1; // -1 indicates no anchors with orders yet

      return {
        focusItems: focusItems.slice(0, 5),
        anchorVelocity: {
          daysSinceLastAnchor,
          anchorsInRamp: rampAnchors.length,
          anchorsInScale: scaleAnchors.length,
          totalActive: (anchors || []).length
        },
        metroDeltas: [], // TODO: Calculate from historical data
        adminTasks: {
          reportsdue: 0, // TODO: Implement reporting tracking
          followupsOverdue: overdueActions?.length || 0
        },
        aiInsight: null,
        isGeneratingInsight: false
      };
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

export function useAIInsight() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ai-insight', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-ai-insights');
      
      if (error) {
        console.error('AI insight error:', error);
        return null;
      }
      
      return data as {
        aiInsight: string;
        topFocusItems: { type: string; name: string; reason: string; urgency: string }[];
        generatedAt: string;
      };
    },
    enabled: !!user,
    staleTime: 15 * 60 * 1000, // 15 minutes - AI insights don't need frequent refresh
    retry: 1
  });
}
