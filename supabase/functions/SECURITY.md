# Edge Function Security Model

## Authentication Categories

All edge functions use `verify_jwt = false` and implement authorization in code.
This is intentional — the platform's signing-keys system requires in-code validation.

### 1. Operator Functions (User JWT Required)

Functions that serve authenticated users validate JWTs via `getClaims()` and enforce role checks.

**Pattern:**
```typescript
const { data, error } = await supabase.auth.getClaims(token);
if (error || !data?.claims) return errorResponse(req, 'Unauthorized', 'UNAUTHORIZED', 401);
const userId = data.claims.sub;
// + role check via has_role() or has_any_role()
```

**Examples:** `operator-impersonate-start`, `operator-impersonate-end`, `flocknote-import`, `activation-manage`, `gardener-ai-assist`

### 2. Public Functions (Rate Limited + Validated)

Functions accessible without authentication use IP-based rate limiting and input validation.

**Required safeguards:**
- `guardPublicEndpoint()` or `isRateLimited()` from `rateLimitPublic.ts`
- Input validation (email format, required fields, length limits)
- Duplicate prevention where applicable
- No sensitive data exposure

**Examples:** `event-register` (5 req/min), `public-communio-signals` (20 req/min), `unsubscribe` (token-based)

### 3. System/Automation Functions (Service Key or Shared Secret)

Internal functions called by n8n or other edge functions authenticate via service-role key or shared secret.

**Pattern:**
```typescript
import { authenticateWorkerRequest } from '../_shared/workerAuth.ts';
if (!authenticateWorkerRequest(req)) return jsonError(401, 'UNAUTHORIZED', 'Invalid credentials');
```

**Accepted credentials:** `SUPABASE_SERVICE_ROLE_KEY`, `N8N_SHARED_SECRET`, `ENRICHMENT_WORKER_SECRET`
All validated with constant-time comparison.

**Examples:** `generate-living-signals`, `relatio-sync-runner`, `operator-awareness-refresh`, `archetype-story-rollup`

---

## Error Handling

All edge functions MUST use the shared `withErrorEnvelope` wrapper or follow these rules:

1. **Never return raw error messages to clients** — use generic messages
2. **Log detailed errors server-side** via `console.error()`
3. **Use standardized error codes** from `ERROR_CODES` in `errorEnvelope.ts`

```typescript
// ✓ CORRECT
console.error('[function-name] DB error:', dbError);
return errorResponse(req, 'Failed to process request', 'INTERNAL_ERROR', 500);

// ✗ WRONG — leaks internal details
return errorResponse(req, dbError.message, 'INTERNAL_ERROR', 500);
```

---

## SECURITY DEFINER Functions

Database functions using `SECURITY DEFINER` bypass RLS. All such functions MUST:

1. Set `search_path = public` to prevent search-path attacks
2. Use parameterized queries only (no string concatenation)
3. Validate tenant_id parameters against user membership
4. Document why SECURITY DEFINER is required
5. Be owned by `postgres` or `supabase_admin`

**Approved use cases:**
- Role check helpers (`has_role`, `has_any_role`, `is_tenant_member`)
- User creation triggers (`handle_new_user`)
- Audit logging (`create_audit_log`)
- Rate limiting (`check_and_increment_rate_limit`)

---

## Rate Limiting

| Endpoint Type | Method | Persistence |
|---|---|---|
| Public endpoints | `guardPublicEndpoint()` | Per-instance (resets on cold start) |
| Critical public endpoints | `check_and_increment_rate_limit()` RPC | Database-backed (persistent) |
| Operator endpoints | Not required (behind JWT auth) | N/A |

---

## Tenant Isolation

All tenant-scoped queries MUST use `enforceTenantScope()` or explicit `.eq('tenant_id', tenantId)`.
Edge functions processing tenant data MUST validate tenant membership before proceeding.

---

## Review Checklist for New Edge Functions

- [ ] Auth pattern matches one of the three categories above
- [ ] Error responses use generic messages (no `error.message` to client)
- [ ] Tenant-scoped data validated with `requireTenantId()`
- [ ] Public endpoints have rate limiting
- [ ] CORS headers applied via shared utilities
- [ ] Input validation for all user-provided parameters
