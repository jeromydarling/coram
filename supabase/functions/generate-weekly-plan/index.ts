import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// SCORING CONSTANTS (mirrored from src/lib/weeklyPlanScoring.ts)
// ============================================================================
const SCORING_WEIGHTS = {
  OVERDUE_NEXT_ACTION: 40,
  GRANT_DEADLINE_14_DAYS: 35,
  ANCHOR_PROBABILITY_70_PLUS: 30,
  NEXT_ACTION_7_DAYS: 25,
  OPPORTUNITY_INACTIVE_30_DAYS: 25,
  EVENT_THIS_WEEK_NO_FOLLOWUP: 20,
  ESTIMATED_VOLUME_60_DAYS: 20,
  NO_PRIMARY_CONTACT: 15,
  PENDING_AI_BUNDLES: 10,
  PENDING_AI_BUNDLES_OLD: 15,
  RECENT_ACTIVITY_3_DAYS: -15,
  OPPORTUNITY_ON_HOLD: -50,
  MARKED_DONE_THIS_WEEK: -100,
  EVENT_WEEK_ACTIVE_CONFERENCE: 15,
  EVENT_WEEK_RECENT_CONFERENCE: 10,
};

const MIN_SCORE_THRESHOLD = 25;
const MAX_ITEMS = 10;
const MAX_PER_CATEGORY = 3;

type PlanItemCategory = 'opportunity' | 'anchor' | 'grant' | 'event' | 'ai_bundle' | 'pipeline';
type PlanItemStatus = 'open' | 'done' | 'dismissed';

interface ScoredItem {
  title: string;
  category: PlanItemCategory;
  linked_entity: { type: string; id: string };
  recommended_action: string;
  primary_cta: { label: string; action: string; filter?: Record<string, string> };
  urgency: { due_date: string | null; days_until_due: number | null; is_overdue: boolean };
  score: number;
  reasons: string[];
  confidence: number;
}

// ============================================================================
// DATE HELPERS
// ============================================================================

function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function differenceInDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function parseISO(s: string): Date {
  return new Date(s);
}

// ============================================================================
// SCORING LOGIC (mirrored from useWeeklyPlan.ts)
// ============================================================================

function computeScore(
  entity: Record<string, unknown>,
  category: PlanItemCategory,
  recentActivityIds: Set<string>,
  now: Date
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

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

  if (category === 'pipeline') {
    const probability = entity.probability as number | null;
    if (probability && probability >= 70) {
      score += SCORING_WEIGHTS.ANCHOR_PROBABILITY_70_PLUS;
      reasons.push(`High probability (${probability}%) anchor`);
    }
  }

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
    const status = entity.status as string | null;
    if (status === 'On Hold') {
      score += SCORING_WEIGHTS.OPPORTUNITY_ON_HOLD;
      reasons.push('Opportunity on hold');
    }
  }

  if (category === 'event') {
    const eventDate = entity.event_date as string | null;
    const followupMeeting = entity.followup_meeting_yn as boolean | null;
    if (eventDate) {
      const date = parseISO(eventDate);
      const daysUntil = differenceInDays(date, now);
      const weekEnd = addDays(now, 7);
      if (date > now && date < weekEnd && !followupMeeting) {
        score += SCORING_WEIGHTS.EVENT_THIS_WEEK_NO_FOLLOWUP;
        reasons.push(`Event in ${daysUntil} days needs follow-up`);
      }
    }
  }

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

  const entityId = entity.id as string;
  if (entityId && recentActivityIds.has(entityId)) {
    score += SCORING_WEIGHTS.RECENT_ACTIVITY_3_DAYS;
    reasons.push('Recent activity recorded');
  }

  return { score, reasons };
}

function computeUrgency(dateStr: string | null): { due_date: string | null; days_until_due: number | null; is_overdue: boolean } {
  if (!dateStr) return { due_date: null, days_until_due: null, is_overdue: false };
  const now = new Date();
  const dueDate = parseISO(dateStr);
  const daysUntil = differenceInDays(dueDate, now);
  return { due_date: dateStr, days_until_due: daysUntil, is_overdue: daysUntil < 0 };
}

function calculateOrderScore(signals: { last_order_date: string | null; orders_last_30: number } | null): number {
  if (!signals || !signals.last_order_date) return 0;
  const lastOrderDate = new Date(signals.last_order_date);
  const today = new Date();
  const daysSinceLastOrder = Math.floor((today.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
  let score = 0;
  if (daysSinceLastOrder <= 30) score += 30;
  else if (daysSinceLastOrder <= 90) score += 15;
  score += Math.min(signals.orders_last_30, 10);
  return score;
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

async function computeSnapshotHash(items: unknown[]): Promise<string> {
  const payload = (items as Array<{ linked_entity: { type: string; id: string } }>)
    .map(i => `${i.linked_entity.type}:${i.linked_entity.id}`).join('|');
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16);
}

// ============================================================================
// GENERATE PLAN FOR A SINGLE USER
// ============================================================================

async function generatePlanForUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  weekStartDate: string,
  now: Date
): Promise<{ itemCount: number; error?: string }> {
  try {
    const threeDaysAgo = addDays(now, -3);
    const weekStart = parseISO(weekStartDate);
    const weekEnd = addDays(weekStart, 6);
    const twoDaysAgo = addDays(now, -2);

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
      supabaseAdmin.from('opportunities').select('id, organization, stage, status, metro_id, next_action_due, updated_at').eq('status', 'Active'),
      supabaseAdmin.from('anchor_pipeline').select('id, opportunity_id, stage, probability, target_first_volume_date, estimated_monthly_volume, next_action_due, next_action, updated_at'),
      supabaseAdmin.from('grants').select('id, grant_name, stage, status, grant_term_end, updated_at').eq('status', 'Active'),
      supabaseAdmin.from('events').select('id, event_name, event_date, event_type, followup_meeting_yn, updated_at').gte('event_date', weekStartDate),
      supabaseAdmin.from('activities').select('opportunity_id').gte('activity_date_time', threeDaysAgo.toISOString()),
      supabaseAdmin.from('ai_suggestions').select('id, source_id, suggestion_type, suggested_name, created_at').eq('status', 'pending').eq('user_id', userId),
      supabaseAdmin.from('events').select('id, event_name, event_date, end_date, is_conference, metro_id').eq('is_conference', true),
      supabaseAdmin.from('opportunity_order_signals').select('*'),
    ]);

    // Build order signals map
    const orderSignalsMap = new Map<string, { last_order_date: string | null; orders_last_30: number }>();
    for (const signal of orderSignalsRes.data || []) {
      orderSignalsMap.set(signal.opportunity_id, signal);
    }

    // Build recent activity set
    const recentActivityIds = new Set<string>(
      (activitiesRes.data || [])
        .map((a: { opportunity_id: string | null }) => a.opportunity_id)
        .filter((id: string | null): id is string => !!id)
    );

    // Event Week context
    const activeConferences = (conferenceEventsRes.data || []).filter((e: any) => {
      const eventStart = parseISO(e.event_date);
      const eventEnd = e.end_date ? parseISO(e.end_date) : eventStart;
      const isActiveThisWeek = (eventStart <= weekEnd && eventEnd >= weekStart);
      const isRecentlyEnded = (eventEnd >= twoDaysAgo && eventEnd < now);
      return isActiveThisWeek || isRecentlyEnded;
    });

    const isEventWeek = activeConferences.length > 0;
    const conferenceMetroIds = new Set(activeConferences.map((c: any) => c.metro_id).filter(Boolean));

    const scoredItems: ScoredItem[] = [];

    // Score opportunities
    for (const opp of opportunitiesRes.data || []) {
      let { score, reasons } = computeScore(opp as Record<string, unknown>, 'opportunity', recentActivityIds, now);
      if (isEventWeek && opp.metro_id && conferenceMetroIds.has(opp.metro_id)) {
        score += SCORING_WEIGHTS.EVENT_WEEK_ACTIVE_CONFERENCE;
        reasons = [...reasons, 'Related to active conference'];
      }
      const orderSignals = orderSignalsMap.get(opp.id);
      const orderBoost = calculateOrderScore(orderSignals || null);
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

    // Score pipeline items
    for (const pipe of pipelineRes.data || []) {
      let { score, reasons } = computeScore(pipe as Record<string, unknown>, 'pipeline', recentActivityIds, now);
      if (pipe.opportunity_id) {
        const orderSignals = orderSignalsMap.get(pipe.opportunity_id);
        const orderBoost = calculateOrderScore(orderSignals || null);
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

    // Score AI bundles
    const bundleGroups = groupBundles(bundlesRes.data || []);
    for (const [sourceId, bundle] of Object.entries(bundleGroups)) {
      const daysPending = differenceInDays(now, parseISO(bundle.created_at));
      let score = SCORING_WEIGHTS.PENDING_AI_BUNDLES;
      const reasons: string[] = [`${bundle.count} pending AI suggestions`];
      if (daysPending > 3) {
        score += SCORING_WEIGHTS.PENDING_AI_BUNDLES_OLD;
        reasons.push(`Pending for ${daysPending} days`);
      }
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

    // Enforce category diversity
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

    // Assign ranks
    const finalItems = diverseItems.map((item, index) => ({
      id: crypto.randomUUID(),
      rank: index + 1,
      ...item,
      ai_reasoning: null,
      status: 'open' as PlanItemStatus,
    }));

    // Compute snapshot hash
    const snapshotHash = await computeSnapshotHash(finalItems);

    // Upsert plan
    const { error } = await supabaseAdmin
      .from('weekly_plans')
      .upsert({
        user_id: userId,
        week_start_date: weekStartDate,
        plan_json: finalItems,
        generated_at: new Date().toISOString(),
        source_snapshot_hash: snapshotHash,
      }, {
        onConflict: 'user_id,week_start_date',
      });

    if (error) {
      console.error(`[generate-weekly-plan] Upsert error for user ${userId}:`, error);
      return { itemCount: 0, error: error.message };
    }

    console.log(`[generate-weekly-plan] Generated ${finalItems.length} items for user ${userId}`);
    return { itemCount: finalItems.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[generate-weekly-plan] Error for user ${userId}:`, msg);
    return { itemCount: 0, error: msg };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Optional: target a specific user (for testing)
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.user_id || null;
    } catch {
      // No body — run for all users
    }

    const now = new Date();
    const weekStartDate = getWeekStartDate(now);

    // Get all users who have had weekly plans before, or all active auth users
    let userIds: string[] = [];

    if (targetUserId) {
      userIds = [targetUserId];
    } else {
      // Get distinct users from weekly_plans + profiles
      const { data: planUsers } = await supabaseAdmin
        .from('weekly_plans')
        .select('user_id')
        .limit(100);

      const { data: profileUsers } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .limit(100);

      const allIds = new Set<string>();
      for (const u of planUsers || []) allIds.add(u.user_id);
      for (const u of profileUsers || []) allIds.add(u.id);
      userIds = [...allIds];
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No users found', results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[generate-weekly-plan] Generating plans for ${userIds.length} user(s), week ${weekStartDate}`);

    // Process sequentially to avoid overloading DB
    const results: Array<{ userId: string; itemCount: number; error?: string }> = [];
    for (const userId of userIds) {
      const result = await generatePlanForUser(supabaseAdmin, userId, weekStartDate, now);
      results.push({ userId, ...result });
    }

    const successCount = results.filter(r => !r.error).length;
    const failCount = results.filter(r => !!r.error).length;

    console.log(`[generate-weekly-plan] Done: ${successCount} success, ${failCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      week_start_date: weekStartDate,
      users_processed: userIds.length,
      success_count: successCount,
      fail_count: failCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate-weekly-plan] Fatal error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
