// deno-lint-ignore-file no-explicit-any
/**
 * notifications-tick — hourly scheduler for CROS app email notifications.
 *
 * Handles scheduled notifications only. Event-triggered notifications
 * (team-invitation, new-device-signin, payment-issue, import-complete,
 * story-ready, grant-match-found, new-person-in-metro,
 * new-companion-referral, absorption-request) are fired inline from
 * their originating code paths via _shared/notify.ts.
 *
 * All queries are defensive: missing tables/columns → skip that section,
 * never fail the whole tick. Every enqueue uses a deterministic
 * idempotency key so repeat ticks never double-send.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { notify } from '../_shared/notify.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://thecros.app'

function todayKey() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}
function weekKey() {
  const d = new Date()
  const year = d.getUTCFullYear()
  const start = Date.UTC(year, 0, 1)
  const week = Math.floor((d.getTime() - start) / (7 * 86400000))
  return `${year}-W${week}`
}
function isMonday() {
  return new Date().getUTCDay() === 1
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try { return await fn() } catch (e) {
    console.warn(`[tick] ${label} skipped:`, (e as Error).message)
    return null
  }
}

async function tickMeaningfulDates(sb: any, counters: any) {
  await safe('meaningful-date-approaching', async () => {
    // date_of_birth anniversaries in the next 3 days (contacts).
    const today = new Date()
    const rows: any[] = []
    for (let daysAway = 0; daysAway <= 3; daysAway++) {
      const t = new Date(today); t.setUTCDate(t.getUTCDate() + daysAway)
      const mm = String(t.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(t.getUTCDate()).padStart(2, '0')
      const { data } = await sb
        .from('contacts')
        .select('id, first_name, last_name, date_of_birth, tenant_id, tenant_slug')
        .not('date_of_birth', 'is', null)
        .filter('date_of_birth', 'gte', '1900-01-01')
      for (const c of data ?? []) {
        const dob = String(c.date_of_birth)
        if (dob.slice(5, 10) === `${mm}-${dd}`) rows.push({ ...c, daysAway })
      }
    }
    if (rows.length === 0) return
    // Fetch tenant stewards
    const tenantIds = [...new Set(rows.map(r => r.tenant_id).filter(Boolean))]
    const { data: members } = await sb
      .from('user_roles')
      .select('user_id, tenant_id')
      .in('tenant_id', tenantIds)
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, email, first_name')
      .in('id', (members ?? []).map((m: any) => m.user_id))
    const byUser = new Map((profiles ?? []).map((p: any) => [p.id, p]))
    for (const c of rows) {
      const recips = (members ?? []).filter((m: any) => m.tenant_id === c.tenant_id)
      for (const m of recips) {
        const p = byUser.get(m.user_id); if (!p?.email) continue
        const key = `mda-${c.id}-${todayKey()}-${p.id}`
        const r = await notify({
          templateName: 'meaningful-date-approaching',
          recipientEmail: p.email,
          idempotencyKey: key,
          templateData: {
            personName: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Someone',
            occasion: 'birthday',
            daysAway: c.daysAway,
            personUrl: c.tenant_slug ? `${APP_URL}/${c.tenant_slug}/contacts/${c.id}` : APP_URL,
          },
        })
        counters.meaningfulDates += r.ok ? 1 : 0
      }
    }
  })
}

async function tickReflectionNudges(sb: any, counters: any) {
  await safe('reflection-nudge', async () => {
    // Opportunities with last_contact_date exactly 14 days ago.
    const target = new Date(); target.setUTCDate(target.getUTCDate() - 14)
    const iso = target.toISOString().slice(0, 10)
    const { data: opps } = await sb
      .from('opportunities')
      .select('id, name, tenant_id, tenant_slug, last_contact_date')
      .eq('last_contact_date', iso)
      .limit(500)
    if (!opps?.length) return
    const tenantIds = [...new Set(opps.map((o: any) => o.tenant_id).filter(Boolean))]
    const { data: members } = await sb
      .from('user_roles').select('user_id, tenant_id').in('tenant_id', tenantIds)
    const { data: profiles } = await sb
      .from('profiles').select('id, email')
      .in('id', (members ?? []).map((m: any) => m.user_id))
    const byUser = new Map((profiles ?? []).map((p: any) => [p.id, p]))
    for (const o of opps) {
      const recips = (members ?? []).filter((m: any) => m.tenant_id === o.tenant_id)
      for (const m of recips) {
        const p = byUser.get(m.user_id); if (!p?.email) continue
        const key = `nudge-${o.id}-${todayKey()}-${p.id}`
        const r = await notify({
          templateName: 'reflection-nudge',
          recipientEmail: p.email,
          idempotencyKey: key,
          templateData: {
            personName: o.name ?? 'someone',
            daysSince: 14,
            personUrl: o.tenant_slug ? `${APP_URL}/${o.tenant_slug}/opportunities/${o.id}` : APP_URL,
          },
        })
        counters.reflectionNudges += r.ok ? 1 : 0
      }
    }
  })
}

async function tickWeeklyDigests(sb: any, counters: any) {
  if (!isMonday()) return
  await safe('weekly-signum-brief + local-pulse-weekly', async () => {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, email, first_name')
      .not('email', 'is', null)
      .limit(2000)
    for (const p of profiles ?? []) {
      if (!p.email) continue
      const k1 = `signum-${weekKey()}-${p.id}`
      const r1 = await notify({
        templateName: 'weekly-signum-brief',
        recipientEmail: p.email,
        idempotencyKey: k1,
        templateData: { name: p.first_name ?? undefined, prompts: [], appUrl: APP_URL },
      })
      counters.weeklyBriefs += r1.ok ? 1 : 0
    }
  })
}

async function tickSubscriptionRenewals(sb: any, counters: any) {
  await safe('subscription-renewing-soon', async () => {
    const in7 = new Date(); in7.setUTCDate(in7.getUTCDate() + 7)
    const dayStart = new Date(in7); dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(in7); dayEnd.setUTCHours(23, 59, 59, 999)
    const { data: subs } = await sb
      .from('tenant_subscriptions')
      .select('id, tenant_id, current_period_end, status')
      .eq('status', 'active')
      .gte('current_period_end', dayStart.toISOString())
      .lte('current_period_end', dayEnd.toISOString())
    if (!subs?.length) return
    const tenantIds = subs.map((s: any) => s.tenant_id)
    const { data: members } = await sb
      .from('user_roles').select('user_id, tenant_id, role').in('tenant_id', tenantIds)
    const owners = (members ?? []).filter((m: any) =>
      ['owner', 'admin', 'gardener', 'shepherd'].includes(String(m.role).toLowerCase()))
    const { data: profiles } = await sb
      .from('profiles').select('id, email').in('id', owners.map((m: any) => m.user_id))
    const byUser = new Map((profiles ?? []).map((p: any) => [p.id, p]))
    for (const s of subs) {
      const recips = owners.filter((m: any) => m.tenant_id === s.tenant_id)
      for (const m of recips) {
        const p = byUser.get(m.user_id); if (!p?.email) continue
        const key = `renew-${s.id}-${todayKey()}-${p.id}`
        const r = await notify({
          templateName: 'subscription-renewing-soon',
          recipientEmail: p.email,
          idempotencyKey: key,
          templateData: {
            renewalDate: new Date(s.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            billingUrl: `${APP_URL}/settings/billing`,
          },
        })
        counters.renewals += r.ok ? 1 : 0
      }
    }
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const counters = { meaningfulDates: 0, reflectionNudges: 0, weeklyBriefs: 0, renewals: 0 }
  const started = Date.now()
  await tickMeaningfulDates(sb, counters)
  await tickReflectionNudges(sb, counters)
  await tickWeeklyDigests(sb, counters)
  await tickSubscriptionRenewals(sb, counters)
  const durationMs = Date.now() - started
  console.log('[notifications-tick] done', { counters, durationMs })
  return new Response(JSON.stringify({ ok: true, counters, durationMs }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
