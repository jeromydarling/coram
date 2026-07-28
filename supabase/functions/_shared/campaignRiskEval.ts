/**
 * Campaign Risk Evaluation — Deterministic risk scoring for send gating.
 * 
 * Evaluates campaign content/audience to produce a risk_level + reasons.
 * Used by evaluate-campaign-risk, create-send-intent, and gmail-campaign-send.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface RiskEvalResult {
  risk_level: 'low' | 'medium' | 'high';
  risk_reasons: string[];
  audience_size: number;
  transient_failure_rate: number | null;
  org_success_rate: number | null;
  subject_reuse_count: number | null;
  inputs_hash: string;
}

/**
 * Compute a deterministic hash of campaign inputs to detect changes.
 */
export function computeInputsHash(
  subject: string,
  htmlBody: string,
  audienceCount: number,
): string {
  // Simple but deterministic: hash subject + body length + audience count
  const raw = `${subject}|${(htmlBody || '').length}|${audienceCount}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `h_${Math.abs(hash).toString(36)}`;
}

/**
 * Evaluate campaign risk. Pure function with DB lookups.
 */
export async function evaluateCampaignRisk(
  supabase: SupabaseClient,
  campaignId: string,
  userId: string,
): Promise<RiskEvalResult> {
  const reasons: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Load campaign
  const { data: campaign } = await supabase
    .from('email_campaigns')
    .select('subject, html_body, audience_count, created_by')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return {
      risk_level: 'high',
      risk_reasons: ['Campaign not found'],
      audience_size: 0,
      transient_failure_rate: null,
      org_success_rate: null,
      subject_reuse_count: null,
      inputs_hash: 'not_found',
    };
  }

  const audienceSize = campaign.audience_count || 0;
  const inputsHash = computeInputsHash(
    campaign.subject || '',
    campaign.html_body || '',
    audienceSize,
  );

  // ── Rule: audience size ──
  if (audienceSize > 1000) {
    riskLevel = 'high';
    reasons.push(`Large audience (${audienceSize} recipients)`);
  } else if (audienceSize > 200) {
    if (riskLevel === 'low') riskLevel = 'medium';
    reasons.push(`Sizable audience (${audienceSize} recipients)`);
  }

  // ── Rule: sender near daily cap ──
  let capProximity: number | null = null;
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: usageData } = await supabase
      .from('usage_events')
      .select('quantity')
      .eq('workflow_key', 'gmail_campaign')
      .eq('event_type', 'email_sent')
      .gte('occurred_at', todayStart.toISOString());

    const currentUsage = (usageData || []).reduce(
      (sum: number, r: { quantity: number }) => sum + (Number(r.quantity) || 0),
      0,
    );
    const hardCap = 2000;
    const remaining = hardCap - currentUsage;

    if (remaining < audienceSize) {
      riskLevel = 'high';
      reasons.push(`Sending ${audienceSize} emails but only ${remaining} remain in daily quota`);
    } else if (remaining < audienceSize * 1.5) {
      if (riskLevel === 'low') riskLevel = 'medium';
      reasons.push(`Close to daily sending cap (${currentUsage}/${hardCap} used)`);
    }
    capProximity = currentUsage;
  } catch {
    // Non-fatal
  }

  // ── Rule: subject reuse in last 7 days ──
  let subjectReuseCount: number | null = null;
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count } = await supabase
      .from('email_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('subject', campaign.subject)
      .eq('created_by', userId)
      .neq('id', campaignId)
      .gte('last_sent_at', sevenDaysAgo.toISOString());

    subjectReuseCount = count ?? 0;
    if (subjectReuseCount !== null && subjectReuseCount > 0) {
      if (riskLevel === 'low') riskLevel = 'medium';
      reasons.push(`Subject line used ${subjectReuseCount} time(s) in the past 7 days`);
    }
  } catch {
    // Non-fatal
  }

  // ── Rule: transient failure rate from recent campaigns ──
  let transientFailureRate: number | null = null;
  try {
    const { data: recentAudience } = await supabase
      .from('email_campaign_audience')
      .select('status, failure_category')
      .eq('campaign_id', campaignId);

    if (recentAudience && recentAudience.length > 0) {
      const totalProcessed = recentAudience.filter(
        (r: { status: string }) => r.status === 'sent' || r.status === 'failed',
      ).length;
      const transientFails = recentAudience.filter(
        (r: { failure_category: string | null }) =>
          r.failure_category === 'quota' || r.failure_category === 'provider_temp',
      ).length;

      if (totalProcessed > 0) {
        transientFailureRate = transientFails / totalProcessed;
        if (transientFailureRate > 0.25) {
          if (riskLevel === 'low') riskLevel = 'medium';
          reasons.push(
            `High transient failure rate (${(transientFailureRate * 100).toFixed(0)}%) from prior attempts`,
          );
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // ── Rule: org success rate from effectiveness data (F4) ──
  let orgSuccessRate: number | null = null;
  try {
    // Get org IDs from audience contacts
    const { data: audienceOrgs } = await supabase
      .from('email_campaign_audience')
      .select('opportunity_id')
      .eq('campaign_id', campaignId)
      .not('opportunity_id', 'is', null)
      .limit(10);

    if (audienceOrgs && audienceOrgs.length > 0) {
      const oppIds = [...new Set(audienceOrgs.map((a: { opportunity_id: string }) => a.opportunity_id))];
      // Check effectiveness for these orgs
      const { data: effData } = await supabase
        .from('org_action_effectiveness_mv')
        .select('success_rate, total_actions')
        .in('org_id', oppIds)
        .eq('action_type', 'gmail_campaign');

      if (effData && effData.length > 0) {
        const weighted = effData.reduce(
          (acc: { totalWeight: number; weightedRate: number }, r: { success_rate: number; total_actions: number }) => {
            acc.totalWeight += r.total_actions;
            acc.weightedRate += r.success_rate * r.total_actions;
            return acc;
          },
          { totalWeight: 0, weightedRate: 0 },
        );

        if (weighted.totalWeight > 0) {
          orgSuccessRate = weighted.weightedRate / weighted.totalWeight;
          if (orgSuccessRate < 0.15 && weighted.totalWeight >= 3) {
            if (riskLevel === 'low') riskLevel = 'medium';
            reasons.push(
              `Low historical success rate (${(orgSuccessRate * 100).toFixed(0)}%) for target organizations`,
            );
          }
        }
      }
    }
  } catch {
    // Non-fatal — effectiveness data may not exist yet
  }

  // ── Cache result ──
  try {
    await supabase.from('email_campaign_risk_eval').upsert(
      {
        campaign_id: campaignId,
        evaluated_at: new Date().toISOString(),
        risk_level: riskLevel,
        risk_reasons: reasons,
        audience_size: audienceSize,
        transient_failure_rate: transientFailureRate,
        org_success_rate: orgSuccessRate,
        subject_reuse_count: subjectReuseCount,
        inputs_hash: inputsHash,
      },
      { onConflict: 'campaign_id' },
    );
  } catch {
    // Non-fatal
  }

  return {
    risk_level: riskLevel,
    risk_reasons: reasons,
    audience_size: audienceSize,
    transient_failure_rate: transientFailureRate,
    org_success_rate: orgSuccessRate,
    subject_reuse_count: subjectReuseCount,
    inputs_hash: inputsHash,
  };
}
