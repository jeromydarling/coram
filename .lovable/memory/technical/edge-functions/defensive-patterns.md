# Memory: technical/edge-functions/defensive-patterns
Updated: 2026-02-21

## Edge Function Defensive Patterns — Mandatory Checklist

Every CROS edge function MUST implement these patterns consistently.

### 1. CORS Headers (Every Function)
```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
```

### 2. Auth Guard (Non-Public Functions)
```ts
const authHeader = req.headers.get('Authorization');
if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders });

const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
```

### 3. Role Checks — Always Use `.some()`, Never `.maybeSingle()`
Multi-role users break `.maybeSingle()`. Always fetch all roles:
```ts
const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', user.id);
const isAdmin = roles?.some(r => r.role === 'admin');
```

### 4. Service-Role Client Config
```ts
const adminClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

### 5. Time-Bounded External Calls
All fetch/AI/crawl calls must have AbortController timeout:
```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
try {
  const res = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

### 6. Idempotency
- Use `ON CONFLICT DO NOTHING` or `DO UPDATE` for all inserts
- Pass `run_id` through pipelines for deduplication
- Check `automation_runs` for duplicate `dedupe_key` before processing

### 7. Error Envelope
```ts
return new Response(JSON.stringify({
  ok: false,
  error: 'Human-readable message',
  code: 'MACHINE_CODE',
}), { status: 4xx, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```

### 8. Base64 — Always Chunked
Never use `btoa(String.fromCharCode(...spread))`. See pdf-upload-lessons.md §3.

### 9. Rate Limiting
Use `check_and_increment_rate_limit()` DB function for per-user limits.

### 10. File Size Guards
Enforce limits in both UI (toast) and edge function (413 response).

### 11. Graceful "No Data" Handling
"No data" is a valid successful outcome. Return `{ ok: true, count: 0 }`, never error.
