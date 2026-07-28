/**
 * Shared helper to enqueue an app email via the send-transactional-email edge function.
 * Callers pass a template name (must exist in TEMPLATES registry), recipient email,
 * an idempotency key (used for dedupe), and template-specific data.
 *
 * Fire-and-forget from event triggers — always await, but tolerate failures with a warning.
 */
export interface NotifyArgs {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, unknown>
}

export async function notify(args: NotifyArgs): Promise<{ ok: boolean; error?: string }> {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-transactional-email`
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!key) return { ok: false, error: 'missing_supabase_key' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(args),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[notify] ${args.templateName} → ${res.status}: ${body.slice(0, 200)}`)
      return { ok: false, error: `http_${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    console.warn(`[notify] ${args.templateName} failed:`, (e as Error).message)
    return { ok: false, error: (e as Error).message }
  }
}
