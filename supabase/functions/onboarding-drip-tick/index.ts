/**
 * onboarding-drip-tick — hourly scheduler for CROS onboarding app emails.
 *
 * Runs every hour via pg_cron. For each tenant that has an onboarding_session,
 * it enqueues day-0 (welcome), day-1, day-3, and day-7 emails via the shared
 * send-transactional-email function. Idempotency keys prevent duplicates.
 *
 * Recipients: the earliest tenant_users owner/admin for the tenant, resolved
 * to an auth.users email address. Suppression is honored downstream by the
 * send-transactional-email function.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const DRIP_STEPS: Array<{ day: number; template: string }> = [
  { day: 0, template: 'welcome' },
  { day: 1, template: 'onboarding-day-1' },
  { day: 3, template: 'onboarding-day-3' },
  { day: 7, template: 'onboarding-day-7' },
]

const WINDOW_HOURS = 2 // small window to catch cron drift

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server configuration error' }, 500)
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  const results: Record<string, number> = {
    considered: 0, enqueued: 0, skipped_no_email: 0, errors: 0,
  }

  for (const step of DRIP_STEPS) {
    const upper = new Date(Date.now() - step.day * 24 * 60 * 60 * 1000)
    const lower = new Date(upper.getTime() - WINDOW_HOURS * 60 * 60 * 1000)

    const { data: sessions, error } = await supabase
      .from('onboarding_sessions')
      .select('tenant_id, started_at, status')
      .gte('started_at', lower.toISOString())
      .lt('started_at', upper.toISOString())
      .limit(500)

    if (error) {
      console.error('drip: session query failed', { step: step.day, error })
      results.errors++
      continue
    }

    for (const s of sessions ?? []) {
      results.considered++
      const recipient = await resolveRecipient(supabase, s.tenant_id)
      if (!recipient) { results.skipped_no_email++; continue }

      const idempotencyKey = `onboarding-drip:${s.tenant_id}:day${step.day}`
      const { data: existing } = await supabase
        .from('email_send_log')
        .select('id')
        .eq('template_name', step.template)
        .eq('recipient_email', recipient.email.toLowerCase())
        .contains('metadata', { idempotency_key: idempotencyKey })
        .limit(1)
        .maybeSingle()
      if (existing) continue

      const { error: sendErr } = await supabase.functions.invoke(
        'send-transactional-email',
        {
          body: {
            templateName: step.template,
            recipientEmail: recipient.email,
            idempotencyKey,
            templateData: {
              name: recipient.name || undefined,
              appUrl: 'https://thecros.app',
            },
          },
        },
      )

      if (sendErr) {
        console.error('drip: send failed', { step: step.day, tenant: s.tenant_id, sendErr })
        results.errors++
      } else {
        results.enqueued++
      }
    }
  }

  return json({ ok: true, results })
})

async function resolveRecipient(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<{ email: string; name?: string } | null> {
  const { data: member } = await supabase
    .from('tenant_users')
    .select('user_id, created_at')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'admin', 'steward'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!member?.user_id) return null

  const { data: authUser } = await (supabase.auth as any).admin.getUserById(member.user_id)
  const email = authUser?.user?.email as string | undefined
  if (!email) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, nickname')
    .eq('user_id', member.user_id)
    .maybeSingle()

  return { email, name: profile?.nickname || profile?.display_name || undefined }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
