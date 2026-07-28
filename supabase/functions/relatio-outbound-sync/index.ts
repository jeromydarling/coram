/**
 * relatio-outbound-sync — Direct outbound sync to CRM vendors.
 *
 * WHAT: Receives CROS entity change events and pushes them directly to vendor APIs.
 * WHERE: Called from client on record save or via scheduled batch.
 * WHY: Replaces n8n orchestration with direct Edge Function calls for simplicity.
 *
 * Flow:
 * 1. Receive entity change payload (entity_type, entity_id, action)
 * 2. Look up tenant's relatio_sync_config for the connector
 * 3. Load the CROS record
 * 4. Denormalize via outbound adapter
 * 5. Fetch remote record for conflict detection
 * 6. If conflicts → insert into sync_conflicts with flag-for-review
 * 7. If clean → push to vendor API
 * 8. Log result
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SyncPayload {
  tenant_id: string;
  connector_key: string; // 'salesforce' | 'dynamics365'
  entity_type: 'account' | 'contact' | 'task' | 'event' | 'activity';
  entity_id: string;
  action: 'create' | 'update';
  cros_data: Record<string, unknown>;
  run_id?: string;
}

interface VendorCredentials {
  base_url: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
}

// ── Outbound adapter field maps (mirror of frontend adapters) ──

const SF_BASE = '/services/data/v59.0/sobjects';
const D365_BASE = '/api/data/v9.2';

function denormalizeSalesforce(entityType: string, data: Record<string, unknown>, isUpdate: boolean): { endpoint: string; method: string; body: Record<string, unknown> } {
  const externalId = data.external_id as string;

  switch (entityType) {
    case 'account': {
      const body: Record<string, unknown> = { Name: data.organization };
      if (data.website_url) body.Website = data.website_url;
      if (data.phone) body.Phone = data.phone;
      if (data.address) body.BillingStreet = data.address;
      if (data.city) body.BillingCity = data.city;
      if (data.state) body.BillingState = data.state;
      if (data.postal_code) body.BillingPostalCode = data.postal_code;
      if (data.description) body.Description = data.description;
      return {
        endpoint: isUpdate ? `${SF_BASE}/Account/${externalId}` : `${SF_BASE}/Account`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    case 'contact': {
      const name = String(data.name || '');
      const parts = name.split(' ');
      const body: Record<string, unknown> = {
        FirstName: parts[0] || '',
        LastName: parts.slice(1).join(' ') || parts[0] || '',
      };
      if (data.email) body.Email = data.email;
      if (data.phone) body.Phone = data.phone;
      if (data.title) body.Title = data.title;
      if (data.city) body.MailingCity = data.city;
      if (data.state) body.MailingState = data.state;
      if (data.account_external_id) body.AccountId = data.account_external_id;
      return {
        endpoint: isUpdate ? `${SF_BASE}/Contact/${externalId}` : `${SF_BASE}/Contact`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    case 'task': {
      const body: Record<string, unknown> = { Subject: data.title };
      if (data.description) body.Description = data.description;
      if (data.due_date) body.ActivityDate = String(data.due_date).split('T')[0];
      if (data.status) body.Status = data.status;
      if (data.priority) body.Priority = data.priority;
      return {
        endpoint: isUpdate ? `${SF_BASE}/Task/${externalId}` : `${SF_BASE}/Task`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    case 'event': {
      const body: Record<string, unknown> = { Subject: data.event_name };
      if (data.start_date) body.StartDateTime = data.start_date;
      if (data.end_date) body.EndDateTime = data.end_date;
      if (data.location) body.Location = data.location;
      if (data.description) body.Description = data.description;
      return {
        endpoint: isUpdate ? `${SF_BASE}/Event/${externalId}` : `${SF_BASE}/Event`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    case 'activity': {
      const body: Record<string, unknown> = {
        Title: data.title,
        Body: data.body_snippet || '',
      };
      if (data.parent_external_id) body.ParentId = data.parent_external_id;
      return {
        endpoint: isUpdate ? `${SF_BASE}/Note/${externalId}` : `${SF_BASE}/Note`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    default:
      throw new Error(`Unsupported Salesforce entity: ${entityType}`);
  }
}

function denormalizeDynamics365(entityType: string, data: Record<string, unknown>, isUpdate: boolean): { endpoint: string; method: string; body: Record<string, unknown> } {
  const externalId = data.external_id as string;

  switch (entityType) {
    case 'account': {
      const body: Record<string, unknown> = { name: data.organization };
      if (data.website_url) body.websiteurl = data.website_url;
      if (data.phone) body.telephone1 = data.phone;
      if (data.address) body.address1_line1 = data.address;
      if (data.city) body.address1_city = data.city;
      if (data.state) body.address1_stateorprovince = data.state;
      if (data.postal_code) body.address1_postalcode = data.postal_code;
      if (data.description) body.description = data.description;
      return {
        endpoint: isUpdate ? `${D365_BASE}/accounts(${externalId})` : `${D365_BASE}/accounts`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    case 'contact': {
      const name = String(data.name || '');
      const parts = name.split(' ');
      const body: Record<string, unknown> = {
        firstname: parts[0] || '',
        lastname: parts.slice(1).join(' ') || parts[0] || '',
      };
      if (data.email) body.emailaddress1 = data.email;
      if (data.phone) body.telephone1 = data.phone;
      if (data.title) body.jobtitle = data.title;
      if (data.city) body.address1_city = data.city;
      if (data.state) body.address1_stateorprovince = data.state;
      if (data.account_external_id) {
        body['parentcustomerid_account@odata.bind'] = `/accounts(${data.account_external_id})`;
      }
      return {
        endpoint: isUpdate ? `${D365_BASE}/contacts(${externalId})` : `${D365_BASE}/contacts`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    case 'task': {
      const body: Record<string, unknown> = { subject: data.title };
      if (data.description) body.description = data.description;
      if (data.due_date) body.scheduledend = data.due_date;
      if (data.priority) {
        const pMap: Record<string, number> = { Low: 0, Normal: 1, High: 2 };
        body.prioritycode = pMap[String(data.priority)] ?? 1;
      }
      return {
        endpoint: isUpdate ? `${D365_BASE}/tasks(${externalId})` : `${D365_BASE}/tasks`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    case 'event': {
      const body: Record<string, unknown> = { subject: data.event_name };
      if (data.start_date) body.scheduledstart = data.start_date;
      if (data.end_date) body.scheduledend = data.end_date;
      if (data.location) body.location = data.location;
      if (data.description) body.description = data.description;
      return {
        endpoint: isUpdate ? `${D365_BASE}/appointments(${externalId})` : `${D365_BASE}/appointments`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    case 'activity': {
      const body: Record<string, unknown> = {
        subject: data.title,
        notetext: data.body_snippet || '',
      };
      if (data.parent_external_id) {
        body['objectid_contact@odata.bind'] = `/contacts(${data.parent_external_id})`;
      }
      return {
        endpoint: isUpdate ? `${D365_BASE}/annotations(${externalId})` : `${D365_BASE}/annotations`,
        method: isUpdate ? 'PATCH' : 'POST',
        body,
      };
    }
    default:
      throw new Error(`Unsupported Dynamics 365 entity: ${entityType}`);
  }
}

// ── Conflict detection ──

interface FieldDiff {
  field: string;
  cros_value: unknown;
  remote_value: unknown;
}

const CONFLICT_FIELD_MAPS: Record<string, Record<string, Record<string, string>>> = {
  salesforce: {
    contact: { name: 'Name', email: 'Email', phone: 'Phone', title: 'Title', city: 'MailingCity', state: 'MailingState' },
    account: { organization: 'Name', website_url: 'Website', phone: 'Phone', city: 'BillingCity', state: 'BillingState' },
  },
  dynamics365: {
    contact: { name: 'fullname', email: 'emailaddress1', phone: 'telephone1', title: 'jobtitle', city: 'address1_city', state: 'address1_stateorprovince' },
    account: { organization: 'name', website_url: 'websiteurl', phone: 'telephone1', city: 'address1_city', state: 'address1_stateorprovince' },
  },
};

function detectConflicts(connector: string, entityType: string, crosData: Record<string, unknown>, remoteData: Record<string, unknown>): FieldDiff[] {
  const map = CONFLICT_FIELD_MAPS[connector]?.[entityType] || {};
  const diffs: FieldDiff[] = [];
  for (const [crosField, remoteField] of Object.entries(map)) {
    const c = crosData[crosField];
    const r = remoteData[remoteField];
    if (c && r && String(c).toLowerCase().trim() !== String(r).toLowerCase().trim()) {
      diffs.push({ field: crosField, cros_value: c, remote_value: r });
    }
  }
  return diffs;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ ok: false, error: 'Missing auth' }, 401);
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Role check — steward or admin
    const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', userId);
    const hasAccess = roles?.some((r: { role: string }) => ['admin', 'steward'].includes(r.role));
    if (!hasAccess) {
      return json({ ok: false, error: 'Steward or admin role required' }, 403);
    }

    // Rate limit
    const { data: rateLimitOk } = await adminClient.rpc('check_and_increment_rate_limit', {
      p_user_id: userId,
      p_function_name: 'relatio-outbound-sync',
      p_window_minutes: 5,
      p_max_requests: 30,
    });
    if (rateLimitOk === false) {
      return json({ ok: false, error: 'Rate limited — try again shortly' }, 429);
    }

    // Parse payload
    const payload: SyncPayload = await req.json();
    if (!payload.tenant_id || !payload.connector_key || !payload.entity_type || !payload.entity_id || !payload.cros_data) {
      return json({ ok: false, error: 'Missing required fields: tenant_id, connector_key, entity_type, entity_id, cros_data' }, 400);
    }

    // Verify user belongs to tenant
    const { data: tenantUser } = await adminClient
      .from('tenant_users')
      .select('user_id')
      .eq('user_id', userId)
      .eq('tenant_id', payload.tenant_id)
      .maybeSingle();
    if (!tenantUser) {
      return json({ ok: false, error: 'Not a member of this tenant' }, 403);
    }

    // Get sync config + credentials
    const { data: syncConfig } = await adminClient
      .from('relatio_sync_config')
      .select('*')
      .eq('tenant_id', payload.tenant_id)
      .eq('connector_key', payload.connector_key)
      .maybeSingle();

    if (!syncConfig) {
      return json({ ok: false, error: 'No sync configuration found for this connector' }, 404);
    }

    if (syncConfig.sync_direction === 'inbound') {
      return json({ ok: false, error: 'Outbound sync is not enabled for this connector' }, 400);
    }

    const credentials = syncConfig.sync_state as unknown as VendorCredentials;
    if (!credentials?.base_url || !credentials?.access_token) {
      return json({ ok: false, error: 'Missing vendor credentials in sync configuration' }, 400);
    }

    // Generate run_id for idempotency
    const runId = payload.run_id || crypto.randomUUID();

    // Check idempotency
    const dedupeKey = `outbound:${payload.connector_key}:${payload.entity_type}:${payload.entity_id}:${payload.action}`;
    const { data: existingRun } = await adminClient
      .from('automation_runs')
      .select('run_id')
      .eq('dedupe_key', dedupeKey)
      .eq('status', 'processed')
      .gte('created_at', new Date(Date.now() - 60_000).toISOString()) // 1 min window
      .maybeSingle();

    if (existingRun) {
      return json({ ok: true, replay: true, run_id: existingRun.run_id });
    }

    // Log the run
    await adminClient.from('automation_runs').insert({
      run_id: runId,
      workflow_key: `outbound_sync_${payload.connector_key}`,
      dedupe_key: dedupeKey,
      status: 'pending',
      payload: payload as unknown as Record<string, unknown>,
    });

    // Denormalize
    const isUpdate = payload.action === 'update';
    let denormalized: { endpoint: string; method: string; body: Record<string, unknown> };

    if (payload.connector_key === 'salesforce') {
      denormalized = denormalizeSalesforce(payload.entity_type, payload.cros_data, isUpdate);
    } else if (payload.connector_key === 'dynamics365') {
      denormalized = denormalizeDynamics365(payload.entity_type, payload.cros_data, isUpdate);
    } else if (['blackbaud', 'hubspot'].includes(payload.connector_key)) {
      // Blackbaud + HubSpot outbound adapters are registered but denormalization
      // is handled by the client-side adapter layer via the outbound adapter interface.
      // This edge function currently supports direct Salesforce/D365 denormalization.
      await adminClient.from('automation_runs').update({ status: 'error', error_message: `Connector ${payload.connector_key} outbound requires client-side adapter denormalization` }).eq('run_id', runId);
      return json({ ok: false, error: `Connector ${payload.connector_key} outbound sync is not yet supported in direct mode — use adapter-assisted mode` }, 400);
    } else {
      await adminClient.from('automation_runs').update({ status: 'error', error_message: `Unsupported connector: ${payload.connector_key}` }).eq('run_id', runId);
      return json({ ok: false, error: `Unsupported connector: ${payload.connector_key}` }, 400);
    }

    // If update, fetch remote record first for conflict detection
    if (isUpdate && ['account', 'contact'].includes(payload.entity_type)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const remoteUrl = `${credentials.base_url}${denormalized.endpoint}`;
        const remoteRes = await fetch(remoteUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${credentials.access_token}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (remoteRes.ok) {
          const remoteData = await remoteRes.json();
          const conflicts = detectConflicts(payload.connector_key, payload.entity_type, payload.cros_data, remoteData);

          if (conflicts.length > 0) {
            // Flag for review — don't push
            await adminClient.from('sync_conflicts').insert({
              tenant_id: payload.tenant_id,
              connector_key: payload.connector_key,
              entity_type: payload.entity_type,
              entity_id: payload.entity_id,
              external_id: String(payload.cros_data.external_id || ''),
              conflicting_fields: conflicts,
              cros_snapshot: payload.cros_data,
              remote_snapshot: remoteData,
              resolution: 'pending',
              run_id: runId,
            });

            await adminClient.from('automation_runs').update({
              status: 'processed',
              error_message: `Conflict detected in ${conflicts.length} field(s) — flagged for review`,
              processed_at: new Date().toISOString(),
            }).eq('run_id', runId);

            return json({
              ok: true,
              conflict: true,
              conflict_count: conflicts.length,
              fields: conflicts.map(c => c.field),
              run_id: runId,
            });
          }
        }
        // If remote fetch fails (404 for new record, etc.), proceed with push
      } catch (fetchErr) {
        // Timeout or network error — proceed with push, log warning
        console.warn('Remote fetch failed, proceeding with push:', fetchErr);
      } finally {
        clearTimeout(timeout);
      }
    }

    // Push to vendor API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let pushResult: { status: number; body: unknown };

    try {
      const pushUrl = `${credentials.base_url}${denormalized.endpoint}`;
      const pushRes = await fetch(pushUrl, {
        method: denormalized.method,
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
        },
        body: JSON.stringify(denormalized.body),
        signal: controller.signal,
      });

      const responseText = await pushRes.text();
      let responseBody: unknown;
      try { responseBody = JSON.parse(responseText); } catch { responseBody = responseText; }

      pushResult = { status: pushRes.status, body: responseBody };

      if (!pushRes.ok) {
        await adminClient.from('automation_runs').update({
          status: 'error',
          error_message: `Vendor API returned ${pushRes.status}: ${responseText.slice(0, 500)}`,
          processed_at: new Date().toISOString(),
        }).eq('run_id', runId);

        return json({
          ok: false,
          error: 'Vendor API error',
          vendor_status: pushRes.status,
          vendor_response: responseBody,
          run_id: runId,
        }, 502);
      }
    } finally {
      clearTimeout(timeout);
    }

    // Success
    await adminClient.from('automation_runs').update({
      status: 'processed',
      processed_at: new Date().toISOString(),
    }).eq('run_id', runId);

    return json({
      ok: true,
      run_id: runId,
      vendor_status: pushResult.status,
      entity_type: payload.entity_type,
      action: payload.action,
    });
  } catch (err) {
    console.error('relatio-outbound-sync error:', err);
    return json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      code: 'OUTBOUND_SYNC_ERROR',
    }, 500);
  }
});
