/**
 * google-form-intake — Public webhook for Google Form (or any) submissions.
 *
 * The customer pastes a small Apps Script into their Form's linked Sheet that
 * POSTs each new response here with a per-tenant token. We auto-detect
 * name/email/phone fields by question label and land the row in
 * form_intake_submissions for steward review (Lead → Person on promote).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /[\d().\-+\s]{7,}/;

function detectFields(answers: Record<string, unknown>): {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
} {
  const out: { name?: string; email?: string; phone?: string; notes?: string } = {};
  const noteParts: string[] = [];

  for (const [rawKey, rawVal] of Object.entries(answers ?? {})) {
    const key = String(rawKey).toLowerCase().trim();
    const val = Array.isArray(rawVal) ? rawVal.join(', ') : String(rawVal ?? '').trim();
    if (!val) continue;

    if (!out.email && (key.includes('email') || key.includes('e-mail') || EMAIL_RE.test(val))) {
      const match = val.match(/[^\s,;]+@[^\s,;]+/);
      if (match) { out.email = match[0].toLowerCase(); continue; }
    }
    if (!out.phone && (key.includes('phone') || key.includes('mobile') || key.includes('cell') || key.includes('tel'))) {
      if (PHONE_RE.test(val)) { out.phone = val; continue; }
    }
    if (!out.name && (key === 'name' || key.includes('full name') || key.includes('your name') || key.startsWith('first') || key.startsWith('last'))) {
      out.name = val; continue;
    }
    noteParts.push(`${rawKey}: ${val}`);
  }

  // Fallback: combine first+last if we collected them as separate fields
  if (!out.name) {
    const first = Object.entries(answers ?? {}).find(([k]) => /first/i.test(k))?.[1];
    const last = Object.entries(answers ?? {}).find(([k]) => /last/i.test(k))?.[1];
    if (first || last) out.name = [first, last].filter(Boolean).join(' ').trim();
  }

  if (noteParts.length) out.notes = noteParts.join('\n');
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server not configured' }, 500);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { token?: string; answers?: Record<string, unknown>; meta?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const token = (body.token ?? '').trim();
  const answers = body.answers ?? {};
  if (!token) return json({ error: 'Missing token' }, 400);
  if (typeof answers !== 'object' || Array.isArray(answers)) {
    return json({ error: 'answers must be an object' }, 400);
  }

  const { data: intake, error: intakeErr } = await admin
    .from('tenant_form_intakes')
    .select('id, tenant_id, archived_at')
    .eq('token', token)
    .maybeSingle();

  if (intakeErr || !intake) return json({ error: 'Unknown token' }, 404);
  if (intake.archived_at) return json({ error: 'Intake archived' }, 410);

  const parsed = detectFields(answers as Record<string, unknown>);

  const { error: insertErr } = await admin.from('form_intake_submissions').insert({
    tenant_id: intake.tenant_id,
    intake_id: intake.id,
    raw_payload: { answers, meta: body.meta ?? {} },
    parsed_name: parsed.name ?? null,
    parsed_email: parsed.email ?? null,
    parsed_phone: parsed.phone ?? null,
    parsed_notes: parsed.notes ?? null,
  });

  if (insertErr) {
    console.error('Insert failed', insertErr);
    return json({ error: 'Could not record submission' }, 500);
  }

  await admin
    .from('tenant_form_intakes')
    .update({
      last_seen_at: new Date().toISOString(),
      submission_count: (await admin
        .from('form_intake_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('intake_id', intake.id)).count ?? 0,
    })
    .eq('id', intake.id);

  return json({ ok: true });
});
