import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { getWeekStartDate } from '@/lib/weekDate';
import { 
  SCORING_WEIGHTS, 
  MIN_SCORE_THRESHOLD, 
  MAX_ITEMS, 
  MAX_PER_CATEGORY 
} from '@/lib/weeklyPlanScoring';
import type { 
  WeeklyPlan, 
  WeeklyPlanItem, 
  PlanItemCategory, 
  PlanItemStatus,
  CTAAction 
} from '@/types/weekly-plan';
import { differenceInDays, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';
import { calculateOrderScore, type OpportunityOrderSignals } from '@/hooks/useOpportunityOrders';

// ============================================================================
// QUERY HOOKS
// ============================================================================

export function useWeeklyPlan() {
  const { user } = useAuth();
  const weekStartDate = getWeekStartDate();
  
  return useQuery({
    queryKey: ['weekly-plan', weekStartDate],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('week_start_date', weekStartDate)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data) return null;
      
      // Parse plan_json safely
      const planJson = Array.isArray(data.plan_json) 
        ? data.plan_json as unknown as WeeklyPlanItem[]
        : [];
      
      return {
        ...data,
        plan_json: planJson,
      } as WeeklyPlan;
    },
    enabled: !!user?.id,
  });
}

export function useEventWeekContext() {
  const { user } = useAuth();
  const weekStartDate = getWeekStartDate();
  
  return useQuery({
    queryKey: ['event-week-context', weekStartDate],
    queryFn: async () => {
      if (!user?.id) return { isEventWeek: false, conferenceMetroIds: [], conferenceNames: [] };
      
      const now = new Date();
      const weekStart = parseISO(weekStartDate);
      const weekEnd = addDays(weekStart, 6);
      const twoDaysAgo = addDays(now, -2);
      
      // Fetch accessible conference events
      const { data: conferenceEvents } = await supabase
        .from('events')
        .select('id, event_name, event_date, end_date, is_conference, metro_id')
        .eq('is_conference', true);
      
      const activeConferences = (conferenceEvents || []).filter(e => {
        const eventStart = parseISO(e.event_date);
        const eventEnd = e.end_date ? parseISO(e.end_date) : eventStart;
        
        // Conference is active this week
        const isActiveThisWeek = (eventStart <= weekEnd && eventEnd >= weekStart);
        
        // Conference ended within last 2 days
        const isRecentlyEnded = (eventEnd >= twoDaysAgo && isBefore(eventEnd, now));
        
        return isActiveThisWeek || isRecentlyEnded;
      });
      
      const isEventWeek = activeConferences.length > 0;
      const conferenceMetroIds = [...new Set(activeConferences.map(c => c.metro_id).filter(Boolean))] as string[];
      const conferenceNames = activeConferences.map(c => c.event_name);
      
      return { isEventWeek, conferenceMetroIds, conferenceNames };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useOpenPlanItemCount() {
  const { data: plan } = useWeeklyPlan();
  if (!plan?.plan_json) return 0;
  return plan.plan_json.filter(item => item.status === 'open').length;
}

// ============================================================================
// SCORING LOGIC
// ============================================================================

interface ScoredItem {
  title: string;
  category: PlanItemCategory;
  linked_entity: { type: string; id: string };
  recommended_action: string;
  primary_cta: { label: string; action: CTAAction; filter?: Record<string, string> };
  urgency: { due_date: string | null; days_until_due: number | null; is_overdue: boolean };
  score: number;
  reasons: string[];
  confidence: number;
}

function computeScore(
  entity: Record<string, unknown>,
  category: PlanItemCategory,
  recentActivityIds: Set<string>,
  now: Date
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  
  // Check for overdue next action
  const nextActionDue = entity.next_action_due as string | null;
  if (nextActionDue) {
    const dueDate = parseISO(nextActionDue);
    const daysUntil = differenceInDays(dueDate, now);
    
    if (daysUntil < 0) {
      score += SCORING_WEIGHTS.OVERDUE_NEXT_ACTION;
      reasons.push(`Action overdue by ${Math.abs(daysUntil)} days`);
    } else if (daysUntil <= 7) {
      score += SCORING_WEIGHTS.NEXT_ACTION_7_DAYS;
      reasons.push(`Action due in ${daysUntil} days`);
    }
  }
  
  // Grant deadline within 14 days
  if (category === 'grant') {
    const termEnd = entity.grant_term_end as string | null;
    if (termEnd) {
      const deadline = parseISO(termEnd);
      const daysUntil = differenceInDays(deadline, now);
      if (daysUntil >= 0 && daysUntil <= 14) {
        score += SCORING_WEIGHTS.GRANT_DEADLINE_14_DAYS;
        reasons.push(`Grant deadline in ${daysUntil} days`);
      }
    }
  }
  
  // Anchor pipeline probability 70%+
  if (category === 'pipeline') {
    const probability = entity.probability as number | null;
    if (probability && probability >= 70) {
      score += SCORING_WEIGHTS.ANCHOR_PROBABILITY_70_PLUS;
      reasons.push(`High probability (${probability}%) anchor`);
    }
  }
  
  // Opportunity inactive 30+ days
  if (category === 'opportunity') {
    const updatedAt = entity.updated_at as string | null;
    if (updatedAt) {
      const lastUpdate = parseISO(updatedAt);
      const daysSince = differenceInDays(now, lastUpdate);
      if (daysSince >= 30) {
        score += SCORING_WEIGHTS.OPPORTUNITY_INACTIVE_30_DAYS;
        reasons.push(`No updates for ${daysSince} days`);
      }
    }
    
    // On hold dampening
    const status = entity.status as string | null;
    if (status === 'On Hold') {
      score += SCORING_WEIGHTS.OPPORTUNITY_ON_HOLD;
      reasons.push('Opportunity on hold');
    }
  }
  
  // Event this week without follow-up
  if (category === 'event') {
    const eventDate = entity.event_date as string | null;
    const followupMeeting = entity.followup_meeting_yn as boolean | null;
    if (eventDate) {
      const date = parseISO(eventDate);
      const daysUntil = differenceInDays(date, now);
      const weekEnd = addDays(now, 7);
      if (isAfter(date, now) && isBefore(date, weekEnd) && !followupMeeting) {
        score += SCORING_WEIGHTS.EVENT_THIS_WEEK_NO_FOLLOWUP;
        reasons.push(`Event in ${daysUntil} days needs follow-up`);
      }
    }
  }
  
  // Estimated volume in next 60 days (pipeline)
  if (category === 'pipeline') {
    const targetDate = entity.target_first_volume_date as string | null;
    const volume = entity.estimated_monthly_volume as number | null;
    if (targetDate && volume && volume > 0) {
      const target = parseISO(targetDate);
      const daysUntil = differenceInDays(target, now);
      if (daysUntil >= 0 && daysUntil <= 60) {
        score += SCORING_WEIGHTS.ESTIMATED_VOLUME_60_DAYS;
        reasons.push(`Volume target in ${daysUntil} days`);
      }
    }
  }
  
  // Recent activity dampener
  const entityId = entity.id as string;
  if (entityId && recentActivityIds.has(entityId)) {
    score += SCORING_WEIGHTS.RECENT_ACTIVITY_3_DAYS;
    reasons.push('Recent activity recorded');
  }
  
  return { score, reasons };
}

// ============================================================================
// GENERATE PLAN MUTATION
// ============================================================================

export function useGenerateWeeklyPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const weekStartDate = getWeekStartDate();
  
  return useMutation({
    mutationFn: async (): Promise<WeeklyPlan> => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const now = new Date();
      
      // Fetch all inputs in parallel
      const [
        opportunitiesRes,
        pipelineRes,
        grantsRes,
        eventsRes,
        activitiesRes,
        bundlesRes,
        conferenceEventsRes,
        orderSignalsRes
      ] = await Promise.all([
        supabase.from('opportunities').select('id, organization, stage, status, metro_id, next_action_due, updated_at').eq('status', 'Active'),
        supabase.from('anchor_pipeline').select('id, opportunity_id, stage, probability, target_first_volume_date, estimated_monthly_volume, next_action_due, next_action, updated_at'),
        supabase.from('grants').select('id, grant_name, stage, status, grant_term_end, updated_at').eq('status', 'Active'),
        supabase.from('events').select('id, event_name, event_date, event_type, followup_meeting_yn, updated_at').gte('event_date', weekStartDate),
        // Get recent activities (last 3 days) for dampener
        supabase.from('activities').select('opportunity_id').gte('activity_date_time', addDays(now, -3).toISOString()),
        supabase.from('ai_suggestions').select('id, source_id, suggestion_type, suggested_name, created_at').eq('status', 'pending').eq('user_id', user.id),
        // Fetch conference events for Event Week context
        supabase.from('events').select('id, event_name, event_date, end_date, is_conference, metro_id').eq('is_conference', true),
        // Fetch order signals for pipeline scoring
        supabase.from('opportunity_order_signals').select('*'),
      ]);
      
      // Build map of opportunity_id -> order signals for scoring
      const orderSignalsMap = new Map<string, OpportunityOrderSignals>();
      for (const signal of orderSignalsRes.data || []) {
        orderSignalsMap.set(signal.opportunity_id, signal as OpportunityOrderSignals);
      }
      
      // Build set of opportunity IDs with recent activity
      const recentActivityIds = new Set<string>(
        (activitiesRes.data || [])
          .map(a => a.opportunity_id)
          .filter((id): id is string => !!id)
      );
      
      // Event Week context detection
      const weekStart = parseISO(weekStartDate);
      const weekEnd = addDays(weekStart, 6);
      const twoDaysAgo = addDays(now, -2);
      
      const activeConferences = (conferenceEventsRes.data || []).filter(e => {
        const eventStart = parseISO(e.event_date);
        const eventEnd = e.end_date ? parseISO(e.end_date) : eventStart;
        
        // Conference is active this week
        const isActiveThisWeek = (eventStart <= weekEnd && eventEnd >= weekStart);
        
        // Conference ended within last 2 days
        const isRecentlyEnded = (eventEnd >= twoDaysAgo && isBefore(eventEnd, now));
        
        return isActiveThisWeek || isRecentlyEnded;
      });
      
      const isEventWeek = activeConferences.length > 0;
      const conferenceMetroIds = new Set(activeConferences.map(c => c.metro_id).filter(Boolean));
      
      const scoredItems: ScoredItem[] = [];
      
      // Score opportunities (with Event Week boost and Order momentum)
      for (const opp of opportunitiesRes.data || []) {
        let { score, reasons } = computeScore(opp as Record<string, unknown>, 'opportunity', recentActivityIds, now);
        
        // Event Week boost: opportunities in conference metros
        if (isEventWeek && opp.metro_id && conferenceMetroIds.has(opp.metro_id)) {
          score += SCORING_WEIGHTS.EVENT_WEEK_ACTIVE_CONFERENCE;
          reasons = [...reasons, 'Related to active conference'];
        }
        
        // Order momentum boost: add score from recent orders
        const orderSignals = orderSignalsMap.get(opp.id);
        const orderBoost = calculateOrderScore(orderSignals);
        if (orderBoost > 0) {
          score += orderBoost;
          reasons = [...reasons, `Recent orders (+${orderBoost} momentum)`];
        }
        
        if (score >= MIN_SCORE_THRESHOLD) {
          scoredItems.push({
            title: opp.organization,
            category: 'opportunity',
            linked_entity: { type: 'opportunity', id: opp.id },
            recommended_action: opp.next_action_due ? 'Complete scheduled action' : 'Review and update',
            primary_cta: { label: 'Open', action: 'update_opportunity', filter: { id: opp.id } },
            urgency: computeUrgency(opp.next_action_due),
            score,
            reasons,
            confidence: Math.min(0.95, 0.6 + score / 100),
          });
        }
      }
      
      // Score pipeline items (with Order momentum from linked opportunity)
      for (const pipe of pipelineRes.data || []) {
        let { score, reasons } = computeScore(pipe as Record<string, unknown>, 'pipeline', recentActivityIds, now);
        
        // Order momentum boost: add score from linked opportunity's orders
        if (pipe.opportunity_id) {
          const orderSignals = orderSignalsMap.get(pipe.opportunity_id);
          const orderBoost = calculateOrderScore(orderSignals);
          if (orderBoost > 0) {
            score += orderBoost;
            reasons = [...reasons, `Recent orders (+${orderBoost} momentum)`];
          }
        }
        
        if (score >= MIN_SCORE_THRESHOLD) {
          scoredItems.push({
            title: `Pipeline: ${pipe.stage || 'Unknown'}`,
            category: 'pipeline',
            linked_entity: { type: 'pipeline', id: pipe.id },
            recommended_action: pipe.next_action || 'Advance to next stage',
            primary_cta: { label: 'Open Pipeline', action: 'open_pipeline', filter: { id: pipe.id } },
            urgency: computeUrgency(pipe.next_action_due),
            score,
            reasons,
            confidence: Math.min(0.95, 0.6 + score / 100),
          });
        }
      }
      
      // Score grants
      for (const grant of grantsRes.data || []) {
        const { score, reasons } = computeScore(grant as Record<string, unknown>, 'grant', recentActivityIds, now);
        if (score >= MIN_SCORE_THRESHOLD) {
          scoredItems.push({
            title: grant.grant_name,
            category: 'grant',
            linked_entity: { type: 'grant', id: grant.id },
            recommended_action: 'Review grant progress',
            primary_cta: { label: 'Review Grant', action: 'review_grant', filter: { id: grant.id } },
            urgency: computeUrgency(grant.grant_term_end),
            score,
            reasons,
            confidence: Math.min(0.95, 0.6 + score / 100),
          });
        }
      }
      
      // Score events
      for (const event of eventsRes.data || []) {
        const { score, reasons } = computeScore(event as Record<string, unknown>, 'event', recentActivityIds, now);
        if (score >= MIN_SCORE_THRESHOLD) {
          scoredItems.push({
            title: event.event_name,
            category: 'event',
            linked_entity: { type: 'event', id: event.id },
            recommended_action: 'Prepare for event',
            primary_cta: { label: 'Open Event', action: 'open_event', filter: { id: event.id } },
            urgency: computeUrgency(event.event_date),
            score,
            reasons,
            confidence: Math.min(0.95, 0.6 + score / 100),
          });
        }
      }
      
      // Score AI bundles (pending suggestions) with Event Week boost
      const bundleGroups = groupBundles(bundlesRes.data || []);
      for (const [sourceId, bundle] of Object.entries(bundleGroups)) {
        const daysPending = differenceInDays(now, parseISO(bundle.created_at));
        let score = SCORING_WEIGHTS.PENDING_AI_BUNDLES;
        const reasons: string[] = [`${bundle.count} pending AI suggestions`];
        
        if (daysPending > 3) {
          score += SCORING_WEIGHTS.PENDING_AI_BUNDLES_OLD;
          reasons.push(`Pending for ${daysPending} days`);
        }
        
        // Event Week boost: event follow-up bundles
        if (isEventWeek && sourceId.startsWith('event:')) {
          score += SCORING_WEIGHTS.EVENT_WEEK_RECENT_CONFERENCE;
          reasons.push('Post-conference follow-up');
        }
        
        if (score >= MIN_SCORE_THRESHOLD) {
          scoredItems.push({
            title: bundle.label,
            category: 'ai_bundle',
            linked_entity: { type: 'ai_bundle', id: sourceId },
            recommended_action: 'Review AI suggestions',
            primary_cta: { label: 'Review', action: 'open_bundle_panel', filter: { source_id: sourceId } },
            urgency: { due_date: null, days_until_due: null, is_overdue: false },
            score,
            reasons,
            confidence: 0.85,
          });
        }
      }
      
      // Sort by score descending
      scoredItems.sort((a, b) => b.score - a.score);
      
      // Enforce category diversity (max 3 per category)
      const categoryCount: Record<string, number> = {};
      const diverseItems: ScoredItem[] = [];
      
      for (const item of scoredItems) {
        const count = categoryCount[item.category] || 0;
        if (count < MAX_PER_CATEGORY) {
          diverseItems.push(item);
          categoryCount[item.category] = count + 1;
        }
        if (diverseItems.length >= MAX_ITEMS) break;
      }
      
      // Assign ranks 1..n
      const rankedItems: Omit<WeeklyPlanItem, 'ai_reasoning'>[] = diverseItems.map((item, index) => ({
        id: crypto.randomUUID(),
        rank: index + 1,
        ...item,
        ai_reasoning: null,
        status: 'open' as PlanItemStatus,
      }));
      
      // Call AI for reasoning (if we have items)
      let aiReasonings: Array<{ index: number; ai_reasoning: string }> = [];
      if (rankedItems.length > 0) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          
          if (token) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const aiResponse = await fetch(`${supabaseUrl}/functions/v1/profunda-ai?mode=generate-plan-reasoning`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                items: rankedItems.map(item => ({
                  title: item.title,
                  category: item.category,
                  reasons: item.reasons,
                })),
              }),
            });
            
            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              if (aiData.success && Array.isArray(aiData.reasonings)) {
                aiReasonings = aiData.reasonings;
              }
            }
          }
        } catch (err) {
          console.error('[useGenerateWeeklyPlan] AI reasoning error:', err);
        }
      }
      
      // Merge AI reasonings into items
      const finalItems: WeeklyPlanItem[] = rankedItems.map((item, index) => {
        const reasoning = aiReasonings.find(r => r.index === index);
        return {
          ...item,
          ai_reasoning: reasoning?.ai_reasoning || null,
        };
      });
      
      // Compute snapshot hash for change detection
      const snapshotHash = await computeSnapshotHash(finalItems);
      
      // Upsert (replace existing plan for this week)
      const { data, error } = await supabase
        .from('weekly_plans')
        .upsert({
          user_id: user.id,
          week_start_date: weekStartDate,
          plan_json: finalItems as unknown as Json,
          generated_at: new Date().toISOString(),
          source_snapshot_hash: snapshotHash,
        }, {
          onConflict: 'user_id,week_start_date',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log audit
      try {
        await supabase.rpc('log_audit_entry', {
          p_entity_type: 'weekly_plan',
          p_entity_id: data.id,
          p_action: 'weekly_plan_generated',
          p_entity_name: `Week of ${weekStartDate}`,
          p_changes: { item_count: finalItems.length } as Json,
        });
      } catch (auditErr) {
        console.error('[useGenerateWeeklyPlan] Audit log error:', auditErr);
      }
      
      return {
        ...data,
        plan_json: finalItems,
      } as WeeklyPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-plan'] });
      toast.success('Weekly focus plan generated');
      
      // Fire-and-forget push notification
      import('@/lib/notifications').then(({ enqueuePushNotification }) => {
        enqueuePushNotification('weekly_plan').catch(console.error);
      });
    },
    onError: (error) => {
      console.error('[useGenerateWeeklyPlan] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate plan');
    },
  });
}

// ============================================================================
// UPDATE ITEM STATUS MUTATION
// ============================================================================

export function useUpdatePlanItemStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const weekStartDate = getWeekStartDate();
  
  return useMutation({
    mutationFn: async ({ 
      planId, 
      itemId, 
      status 
    }: { 
      planId: string; 
      itemId: string; 
      status: PlanItemStatus;
    }): Promise<WeeklyPlan> => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Fetch current plan with updated_at for optimistic concurrency
      const { data: current, error: fetchError } = await supabase
        .from('weekly_plans')
        .select('id, plan_json, updated_at')
        .eq('id', planId)
        .single();
      
      if (fetchError || !current) {
        throw new Error('Plan not found');
      }
      
      const items = Array.isArray(current.plan_json) 
        ? current.plan_json as unknown as WeeklyPlanItem[]
        : [];
      
      // Update the specific item's status
      const updatedItems = items.map(item => 
        item.id === itemId ? { ...item, status } : item
      );
      
      // Optimistic concurrency: update only if updated_at matches
      const { data, error, count } = await supabase
        .from('weekly_plans')
        .update({ plan_json: updatedItems as unknown as Json })
        .eq('id', planId)
        .eq('updated_at', current.updated_at)
        .select()
        .single();
      
      if (error) throw error;
      
      // Check if update was applied (count would be 0 if concurrent update happened)
      if (!data) {
        throw new Error('CONFLICT');
      }
      
      // Log audit
      try {
        await supabase.rpc('log_audit_entry', {
          p_entity_type: 'weekly_plan_item',
          p_entity_id: itemId,
          p_action: 'plan_item_status_changed',
          p_entity_name: items.find(i => i.id === itemId)?.title || 'Unknown',
          p_changes: { status } as Json,
        });
      } catch (auditErr) {
        console.error('[useUpdatePlanItemStatus] Audit log error:', auditErr);
      }
      
      return {
        ...data,
        plan_json: updatedItems,
      } as WeeklyPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-plan', weekStartDate] });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'CONFLICT') {
        queryClient.invalidateQueries({ queryKey: ['weekly-plan', weekStartDate] });
        toast.error('Plan updated elsewhere. Please try again.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to update item');
      }
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function computeUrgency(dateStr: string | null): WeeklyPlanItem['urgency'] {
  if (!dateStr) {
    return { due_date: null, days_until_due: null, is_overdue: false };
  }
  
  const now = new Date();
  const dueDate = parseISO(dateStr);
  const daysUntil = differenceInDays(dueDate, now);
  
  return {
    due_date: dateStr,
    days_until_due: daysUntil,
    is_overdue: daysUntil < 0,
  };
}

function groupBundles(suggestions: Array<{ id: string; source_id: string | null; suggested_name: string | null; created_at: string | null }>) {
  const groups: Record<string, { label: string; count: number; created_at: string }> = {};
  
  for (const sugg of suggestions) {
    const key = sugg.source_id || sugg.id;
    if (!groups[key]) {
      groups[key] = {
        label: sugg.suggested_name || 'AI Suggestions',
        count: 0,
        created_at: sugg.created_at || new Date().toISOString(),
      };
    }
    groups[key].count++;
  }
  
  return groups;
}

async function computeSnapshotHash(items: Omit<WeeklyPlanItem, 'ai_reasoning'>[]): Promise<string> {
  const payload = items.map(i => `${i.linked_entity.type}:${i.linked_entity.id}`).join('|');
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16);
}
