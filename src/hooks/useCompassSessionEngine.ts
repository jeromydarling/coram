/**
 * useCompassSessionEngine — Unified nudge evaluation engine for the Compass.
 *
 * WHAT: Aggregates overdue actions, stagnant relationships, life events, richness signals,
 *       email suggestions, and orientation context into sorted CompassNudge items.
 * WHERE: AIChatDrawer "Today's Movement" section.
 * WHY: Single interpretive surface — replaces scattered dashboard cards and inline banners.
 */

import { useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSentryRecentIssues } from '@/lib/sentry/queryCounts';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useRelationalOrientation } from './useRelationalOrientation';
import { useDeepInsightStatus } from './useDeepInsightStatus';
import { useProvidenceReport } from './useProvidenceReport';
import { isFirstMonth, isFirstTwoWeeks, getWeeklyReflectionPrompt } from '@/lib/tenantAge';
import { subDays, differenceInCalendarDays, getMonth, getDate } from 'date-fns';

export type NudgeDirection = 'care' | 'expansion' | 'restoration' | 'steadfastness';
export type NudgeType = 'reflection' | 'action' | 'awareness';

export interface CompassNudge {
  id: string;
  direction: NudgeDirection;
  type: NudgeType;
  confidence: number;
  message: string;
  optional_action?: {
    label: string;
    route?: string;
  };
}

const DIRECTION_WEIGHT: Record<NudgeDirection, number> = {
  care: 4,
  restoration: 3,
  expansion: 2,
  steadfastness: 1,
};

/**
 * Core aggregation query — fetches lightweight counts/signals in one pass.
 * Avoids heavy joins; uses parallel head-count queries.
 */
function useCompassSignals() {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['compass-session-signals', tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const now = new Date();
      const ninetyDaysAgo = subDays(now, 90).toISOString();
      const seventyTwoHoursAgo = subDays(now, 3).toISOString();

      const [
        overdueRes,
        stagnantRes,
        recentLifeEventsRes,
        emailSuggestionsRes,
        nextActionsRes,
        recentErrorsRes,
        birthdayRes,
      ] = await Promise.all([
        // Overdue follow-ups
        supabase
          .from('opportunities')
          .select('id, organization, next_action_due', { count: 'exact', head: false })
          .eq('tenant_id', tenantId!)
          .lt('next_action_due', now.toISOString())
          .not('next_action_due', 'is', null)
          .limit(5),

        // Stagnant relationships (no activity in 90+ days)
        supabase
          .from('opportunities')
          .select('id, organization', { count: 'exact', head: false })
          .eq('tenant_id', tenantId!)
          .lt('last_activity_date', ninetyDaysAgo)
          .not('last_activity_date', 'is', null)
          .limit(5),

        // Recent life events (last 72h)
        supabase
          .from('life_events')
          .select('id, event_type, entity_type', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!)
          .gte('event_date', seventyTwoHoursAgo),

        // Pending email suggestions
        supabase
          .from('email_task_suggestions')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user!.id)
          .in('status', ['pending', 'accepted']),

        // Open next-best-actions (scoped to current user)
        supabase
          .from('org_next_actions')
          .select('id, summary, action_type, score', { count: 'exact', head: false })
          .eq('status', 'open')
          .eq('user_id', user!.id)
          .order('score', { ascending: false })
          .limit(3),

        // Recent system errors — now sourced from Sentry (system_error_events retired).
        // TODO: once Sentry events are tagged with tenant_id at capture, narrow this
        // from app_slug to tenant_id for per-tenant precision.
        getSentryRecentIssues({ appSlug: 'thecros', limit: 3 }),

        // Upcoming birthdays (contacts with date_of_birth)
        supabase
          .from('contacts')
          .select('id, name, date_of_birth, care_status')
          .eq('tenant_id', tenantId!)
          .not('date_of_birth', 'is', null)
          .limit(200),
      ]);

      return {
        overdue: overdueRes.data || [],
        overdueCount: overdueRes.count || 0,
        stagnant: stagnantRes.data || [],
        stagnantCount: stagnantRes.count || 0,
        recentLifeEventCount: recentLifeEventsRes.count || 0,
        emailSuggestionCount: emailSuggestionsRes.count || 0,
        topActions: nextActionsRes.data || [],
        topActionCount: nextActionsRes.count || 0,
        recentErrorCount: recentErrorsRes.length,
        recentErrors: recentErrorsRes,
        birthdayContacts: birthdayRes.data || [],
      };
    },
  });
}

function orientedMessage(
  base: string,
  orientation: string,
  humanAlt?: string,
  institutionAlt?: string
): string {
  if (orientation === 'human_focused' && humanAlt) return humanAlt;
  if (orientation === 'institution_focused' && institutionAlt) return institutionAlt;
  return base;
}

export function useCompassSessionEngine(): {
  nudges: CompassNudge[];
  isLoading: boolean;
  revelationActive: boolean;
} {
  const { data: signals, isLoading } = useCompassSignals();
  const { orientation } = useRelationalOrientation();
  const { data: deepInsight } = useDeepInsightStatus();
  const { report: providenceReport } = useProvidenceReport();
  const { tenant } = useTenant();

  const earlyMode = tenant?.created_at ? isFirstMonth(tenant.created_at) : false;
  const veryEarlyMode = tenant?.created_at ? isFirstTwoWeeks(tenant.created_at) : false;

  // Detect active revelation window
  const revelationActive = useMemo(() => {
    if (!providenceReport?.revelation_start || !providenceReport?.revelation_end) return false;
    const now = Date.now();
    return now >= new Date(providenceReport.revelation_start).getTime()
        && now <= new Date(providenceReport.revelation_end).getTime();
  }, [providenceReport]);

  const nudges = useMemo<CompassNudge[]>(() => {
    if (!signals) return [];

    const results: CompassNudge[] = [];
    const today = new Date();

    // ── Dec 31 Generosity Gratitude Prompt ──
    if (today.getMonth() === 11 && today.getDate() === 31) {
      results.push({
        id: 'year-end-generosity',
        direction: 'care',
        type: 'reflection',
        confidence: 0.75,
        message: 'These are the people who chose to give this year.',
        optional_action: {
          label: 'Draft a note of gratitude',
          route: '/reports/those-who-gave',
        },
      });
    }

    // 1) Overdue actions → Care direction
    if (signals.overdueCount > 0) {
      const topOverdue = signals.overdue[0];
      results.push({
        id: 'overdue-actions',
        direction: 'care',
        type: 'action',
        confidence: Math.min(0.95, 0.6 + signals.overdueCount * 0.07),
        message: orientedMessage(
          `${signals.overdueCount} follow-up${signals.overdueCount > 1 ? 's' : ''} may need your attention — ${topOverdue?.organization || 'a partner'} has been waiting.`,
          orientation,
          `${signals.overdueCount} person${signals.overdueCount > 1 ? 's' : ''} may be waiting to hear from you.`,
          `${signals.overdueCount} partnership${signals.overdueCount > 1 ? 's' : ''} could use a check-in.`
        ),
        optional_action: {
          label: 'Review overdue',
          route: '/activities?filter=overdue',
        },
      });
    }

    // 2) Stagnant relationships → Restoration direction
    if (signals.stagnantCount > 0) {
      const topStagnant = signals.stagnant[0];
      results.push({
        id: 'stagnant-relationships',
        direction: 'restoration',
        type: 'reflection',
        confidence: Math.min(0.85, 0.5 + signals.stagnantCount * 0.05),
        message: orientedMessage(
          `${signals.stagnantCount} relationship${signals.stagnantCount > 1 ? 's' : ''} ${signals.stagnantCount > 1 ? 'have' : 'has'} been quiet for 90+ days. ${topStagnant?.organization || 'Someone'} might welcome a gentle reconnection.`,
          orientation,
          `Some people you once cared for have been quiet. A small gesture might rekindle the connection.`,
          `${signals.stagnantCount} partner${signals.stagnantCount > 1 ? 's' : ''} may have drifted — consider a brief outreach.`
        ),
        optional_action: {
          label: 'See quiet relationships',
          route: '/opportunities?filter=stale',
        },
      });
    }

    // 3) Recent life events → Expansion direction
    if (signals.recentLifeEventCount > 0) {
      results.push({
        id: 'recent-life-events',
        direction: 'expansion',
        type: 'awareness',
        confidence: 0.7,
        message: orientedMessage(
          `${signals.recentLifeEventCount} life moment${signals.recentLifeEventCount > 1 ? 's' : ''} recorded in the last few days. Consider a reflection.`,
          orientation,
          `New life moments are unfolding — take a breath and notice what's growing.`,
          `Recent milestones have been recorded. These may shape upcoming conversations.`
        ),
        optional_action: {
          label: 'View milestones',
          route: '/people',
        },
      });
    }

    // 4) Email suggestions → Care direction
    if (signals.emailSuggestionCount > 0) {
      results.push({
        id: 'email-suggestions',
        direction: 'care',
        type: 'action',
        confidence: 0.65,
        message: `${signals.emailSuggestionCount} gentle follow-up${signals.emailSuggestionCount > 1 ? 's' : ''} surfaced from your recent conversations.`,
        optional_action: {
          label: 'Review signals',
          route: '/opportunities',
        },
      });
    }

    // 5) Top next-best-actions → Steadfastness direction
    if (signals.topActionCount > 0) {
      const topAction = signals.topActions[0];
      results.push({
        id: 'next-best-actions',
        direction: 'steadfastness',
        type: 'action',
        confidence: Math.min(0.9, 0.55 + signals.topActionCount * 0.05),
        message: orientedMessage(
          `${signals.topActionCount} ranked action${signals.topActionCount > 1 ? 's' : ''} ready for your discernment. Top: "${topAction?.summary || 'Review pending'}"`,
          orientation,
          `There are ${signals.topActionCount} thoughtful next step${signals.topActionCount > 1 ? 's' : ''} awaiting your attention.`,
          `${signals.topActionCount} strategic action${signals.topActionCount > 1 ? 's' : ''} ranked by impact and readiness.`
        ),
        optional_action: {
          label: 'See actions',
          route: '/opportunities',
        },
      });
    }

    // 7) Recent system errors → Care direction (calm reassurance)
    if (signals.recentErrorCount > 0) {
      const errorRoute = signals.recentErrors[0]?.route;
      // Humanize the route: strip UUIDs and turn path segments into readable context
      const humanizeRoute = (route: string): string => {
        if (!route || route === '/') return '';
        const segments = route.replace(/^\//, '').split('/');
        // Remove UUID-like segments and keep only meaningful words
        const meaningful = segments.filter(s => !/^[0-9a-f]{8}-/.test(s) && s.length > 0);
        if (meaningful.length === 0) return '';
        // Capitalize and join with readable separator
        const label = meaningful.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')).join(' → ');
        return ` near ${label}`;
      };
      const locationHint = errorRoute ? humanizeRoute(errorRoute) : '';
      results.push({
        id: 'system-error-awareness',
        direction: 'care',
        type: 'awareness',
        confidence: 0.5, // moderate — informational, not alarming
        message: orientedMessage(
          `Something did not go as expected${locationHint}. Your Gardener has been notified and a fix will be along shortly.`,
          orientation,
          `We noticed something that didn't quite work${locationHint}. Your Gardener is already aware — no action needed from you.`,
          `A brief hiccup was detected${locationHint}. The team has been notified and is working on a resolution.`
        ),
      });
    }

    // Birthday nudges → Care direction
    if (signals.birthdayContacts?.length > 0) {
      const today = new Date();
      const upcoming = signals.birthdayContacts
        .filter((c: any) => c.date_of_birth && c.care_status !== 'care_completed')
        .map((c: any) => {
          const dob = new Date(c.date_of_birth);
          // Build this year's birthday
          let bday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
          // If already passed, check next year
          if (bday < today) {
            bday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
          }
          const daysUntil = differenceInCalendarDays(bday, today);
          return { ...c, daysUntil };
        })
        .filter((c: any) => c.daysUntil >= 0 && c.daysUntil <= 14)
        .sort((a: any, b: any) => a.daysUntil - b.daysUntil)
        .slice(0, 2);

      for (const person of upcoming) {
        const dayLabel = person.daysUntil === 0 ? 'today' :
          person.daysUntil === 1 ? 'tomorrow' :
          `in ${person.daysUntil} days`;
        results.push({
          id: `birthday-${person.id}`,
          direction: 'care',
          type: 'awareness',
          confidence: 0.50,
          message: `${person.name}'s birthday is ${dayLabel} — consider reaching out.`,
          optional_action: {
            label: 'View person',
            route: `/people/${person.id}`,
          },
        });
      }
    }

    // 6) AI usage awareness → Steadfastness (gentle)
    if (deepInsight?.nearLimit || deepInsight?.atLimit) {
      results.push({
        id: 'ai-usage-awareness',
        direction: 'steadfastness',
        type: 'awareness',
        confidence: 0.4,
        message: deepInsight.atLimit
          ? 'Your included Deep Insights have been fully used this month. Essential summaries remain available.'
          : 'You\'re approaching your Deep Insight limit for this month — plan your deeper analyses mindfully.',
        optional_action: {
          label: 'View plan',
          route: '/settings',
        },
      });
    }

    // Phase 25: Insert revelation nudge if window is active
    if (revelationActive && providenceReport) {
      const revMessages: Record<string, Record<string, string>> = {
        threshold_crossing: {
          human_focused: 'Something within your community has shifted quietly. Take a moment to notice.',
          institution_focused: 'A strategic threshold may have been crossed. Pause and discern the direction.',
          hybrid: 'Something has shifted. This season feels different from the last.',
        },
        re_emergence: {
          human_focused: 'Old connections are stirring again. Something forgotten may be returning.',
          institution_focused: 'Dormant partnerships are reawakening. Consider what this signals.',
          hybrid: 'A reawakening is underway. Relationships once quiet are finding voice again.',
        },
        first_activation: {
          human_focused: 'New ground is opening beneath your feet. A first step into unfamiliar territory.',
          institution_focused: 'A new territory has activated for the first time. Notice what is emerging.',
          hybrid: 'You are stepping into new territory. Something is beginning.',
        },
        restorative_shift: {
          human_focused: 'This season carries grief. Be gentle with yourself and those around you.',
          institution_focused: 'A restorative shift is underway. The community may need tending.',
          hybrid: 'This season feels different — restoration is the quiet work happening now.',
        },
      };

      const revType = providenceReport.revelation_type || 'threshold_crossing';
      const msgs = revMessages[revType] || revMessages.threshold_crossing;
      const msg = msgs[orientation] || msgs.hybrid;

      results.push({
        id: 'revelation-nudge',
        direction: (providenceReport.dominant_direction as NudgeDirection) || 'care',
        type: 'reflection',
        confidence: 0.6, // moderate — not high
        message: msg,
        optional_action: {
          label: 'Open Providence',
          route: undefined, // handled by Compass drawer internally
        },
      });
    }

    // Phase 25: Apply subtle weighting bias during revelation window
    if (revelationActive && providenceReport?.dominant_direction) {
      const domDir = providenceReport.dominant_direction as NudgeDirection;
      for (const nudge of results) {
        if (nudge.direction === domDir && nudge.id !== 'revelation-nudge') {
          nudge.confidence = Math.min(0.7, nudge.confidence + 0.05); // +5%, capped at 70%
        }
      }
    }

    // Phase 26C: Foundational fallback posture for very early tenants with no direction
    if (veryEarlyMode && results.length === 0) {
      results.push({
        id: 'foundational-welcome',
        direction: 'care',
        type: 'reflection',
        confidence: 0.35, // low — gentle, not assertive
        message: orientedMessage(
          'You\'re at the beginning of something. Attention matters here.',
          orientation,
          'You\'re at the beginning of something. Every small act of care matters here.',
          'You\'re laying a foundation. Early attention shapes what grows.'
        ),
      });
    }

    // Phase 26E: Dead surface prevention — weekly reflection prompts in month 1
    if (earlyMode && tenant?.created_at && results.length === 0) {
      const reflectionPrompt = getWeeklyReflectionPrompt(tenant.created_at);
      if (reflectionPrompt) {
        results.push({
          id: 'foundational-reflection',
          direction: 'care',
          type: 'reflection',
          confidence: 0.3,
          message: reflectionPrompt,
        });
      }
    }

    // Authority Hub nudge for very early tenants — gentle awareness
    if (veryEarlyMode && results.length < 3) {
      results.push({
        id: 'authority-hub-welcome',
        direction: 'expansion',
        type: 'awareness',
        confidence: 0.25,
        message: orientedMessage(
          'Many organizations find it helpful to read how others walk this path. The Authority Hub has stories and guidance from the field.',
          orientation,
          'Others who care for people the way you do have shared their stories. The Authority Hub holds their wisdom.',
          'Organizations like yours have written about their early days. The Authority Hub may offer useful perspective.'
        ),
        optional_action: {
          label: 'Explore the Authority Hub',
          route: '/authority',
        },
      });
    }

    // Sort: confidence DESC → direction weight DESC → id stable
    results.sort((a, b) => {
      const confDiff = b.confidence - a.confidence;
      if (Math.abs(confDiff) > 0.05) return confDiff;
      const weightDiff = DIRECTION_WEIGHT[b.direction] - DIRECTION_WEIGHT[a.direction];
      if (weightDiff !== 0) return weightDiff;
      return a.id.localeCompare(b.id);
    });

    // Max 3 nudges; revelation replaces lowest if needed
    return results.slice(0, 3);
  }, [signals, orientation, deepInsight, revelationActive, providenceReport, earlyMode, veryEarlyMode, tenant?.created_at]);

  return { nudges, isLoading, revelationActive };
}
