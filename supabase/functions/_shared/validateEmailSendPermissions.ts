/**
 * validateEmailSendPermissions — Shared pre-send validation for email campaigns.
 *
 * WHAT: Checks campaign add-on, suppression list, send limits, and DNE flags before sending.
 * WHERE: Called by gmail-campaign-send and outlook-send before processing.
 * WHY: Single source of truth for all email send permission checks.
 */

import { checkTenantFeature } from './backendFeatureCheck.ts';
import { evaluateSendLimit } from './sendLimitGuard.ts';

export interface SendPermissionResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  suppressedEmails?: Set<string>;
  sendLimit?: ReturnType<typeof evaluateSendLimit>;
}

/**
 * Full pre-send permission check pipeline.
 * Returns { allowed: true, suppressedEmails } or { allowed: false, reason, code }.
 */
export async function validateEmailSendPermissions(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  tenantId: string,
  provider: 'gmail' | 'outlook',
  emailAddress: string,
  proposedCount: number,
): Promise<SendPermissionResult> {
  // 1. Feature gating — campaigns add-on must be active
  const { allowed: featureAllowed } = await checkTenantFeature(
    supabaseAdmin,
    tenantId,
    'outreach_campaigns',
  );

  if (!featureAllowed) {
    return {
      allowed: false,
      reason: 'Outreach campaigns are not enabled for this organization.',
      code: 'FEATURE_NOT_ENABLED',
    };
  }

  // 2. Send limit check
  const { data: limitRow } = await supabaseAdmin
    .from('email_send_limits')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .eq('email_address', emailAddress)
    .maybeSingle();

  const sendLimit = evaluateSendLimit(limitRow, provider, proposedCount);

  if (sendLimit.blocked) {
    return {
      allowed: false,
      reason: sendLimit.message,
      code: 'SEND_LIMIT_EXCEEDED',
      sendLimit,
    };
  }

  // 3. Build suppression set (DNE + unsubscribed)
  const suppressedEmails = new Set<string>();

  const { data: suppressions } = await supabaseAdmin
    .from('email_suppressions')
    .select('email')
    .eq('tenant_id', tenantId);
  for (const s of suppressions || []) {
    if (s.email) suppressedEmails.add(s.email.toLowerCase());
  }

  const { data: dneContacts } = await supabaseAdmin
    .from('contacts')
    .select('email')
    .eq('tenant_id', tenantId)
    .eq('do_not_email', true)
    .not('email', 'is', null);
  for (const c of dneContacts || []) {
    if (c.email) suppressedEmails.add(c.email.toLowerCase());
  }

  return {
    allowed: true,
    suppressedEmails,
    sendLimit,
  };
}
