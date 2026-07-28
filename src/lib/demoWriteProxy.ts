/**
 * demoWriteProxy — Global Supabase client write interception for demo mode.
 *
 * WHAT: Monkey-patches supabase.from() and supabase.functions.invoke() to intercept
 *       all write operations (insert/update/delete/upsert) and edge function calls.
 * WHERE: Activated by DemoModeProvider when demo session starts.
 * WHY: 227+ files use direct Supabase writes — wrapping each individually is untenable.
 *       This architectural interception ensures ZERO writes escape in demo mode.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Track last toast time to avoid spamming
let lastToastMs = 0;
const TOAST_COOLDOWN_MS = 1500;

function showDemoToast(label?: string) {
  const now = Date.now();
  if (now - lastToastMs < TOAST_COOLDOWN_MS) return;
  lastToastMs = now;
  toast.success(label || 'Changes saved', {
    description: 'Demo mode — no data was written',
    duration: 2000,
  });
}

/**
 * A fake PostgREST response that mimics a successful write.
 * Chainable: supports .select(), .single(), .maybeSingle(), .eq(), etc.
 *
 * Returns a fake row with `id` so components that do `.data?.id` won't crash (BT-003).
 * For delete operations, returns `{ data: null }` which is the real PostgREST shape.
 */
function createFakeWriteChain(method: 'insert' | 'update' | 'delete' | 'upsert' = 'insert', label?: string): any {
  const fakeRow = { id: `demo-${crypto.randomUUID?.() ?? Date.now()}`, created_at: new Date().toISOString() };
  const isDestructive = method === 'delete';

  // Insert/upsert: return a fake row so .data[0].id works
  // Delete: return null data (matches real PostgREST)
  const result = {
    data: isDestructive ? null : [fakeRow],
    error: null,
    count: isDestructive ? 1 : 1,
    status: 200,
    statusText: 'OK',
  };

  // For single() calls, unwrap the array
  let useSingle = false;

  // Build a lazy chain — only show toast when the chain is awaited
  const chain: any = {
    select: () => chain,
    single: () => { useSingle = true; return chain; },
    maybeSingle: () => { useSingle = true; return chain; },
    eq: () => chain,
    neq: () => chain,
    gt: () => chain,
    gte: () => chain,
    lt: () => chain,
    lte: () => chain,
    like: () => chain,
    ilike: () => chain,
    is: () => chain,
    in: () => chain,
    contains: () => chain,
    containedBy: () => chain,
    match: () => chain,
    not: () => chain,
    or: () => chain,
    filter: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    then: (resolve: (v: any) => void, reject?: (e: any) => void) => {
      showDemoToast(label);
      const finalResult = {
        ...result,
        data: useSingle ? (isDestructive ? null : fakeRow) : result.data,
      };
      return Promise.resolve(finalResult).then(resolve, reject);
    },
  };

  return chain;
}

// Store originals for cleanup
let originalFrom: typeof supabase.from | null = null;
let originalInvoke: typeof supabase.functions.invoke | null = null;
let isPatched = false;

/** Write methods that must be intercepted */
const WRITE_METHODS = ['insert', 'update', 'delete', 'upsert'] as const;

/** Edge functions that are safe to call in demo (read-only) */
const SAFE_EDGE_FUNCTIONS = new Set([
  'demo-gate-submit',    // Lead capture — the one write we DO allow
  'check-subscription',  // Read-only check
  'founding-garden-status', // Read-only
]);

/**
 * Activate demo write interception on the global supabase client.
 * Call once when demo mode starts; call deactivate when it ends.
 */
export function activateDemoProxy() {
  if (isPatched) return;

  // ── Patch supabase.from() ────────────────────────────
  originalFrom = supabase.from.bind(supabase);

  (supabase as any).from = function demoFrom(table: any) {
    const realBuilder = (originalFrom as any)(table);

    // Return a Proxy that intercepts write methods but passes reads through
    return new Proxy(realBuilder, {
      get(target: any, prop: string | symbol) {
        if (typeof prop === 'string' && WRITE_METHODS.includes(prop as any)) {
          // Intercept write — return fake chain with method type
          return (..._args: any[]) => createFakeWriteChain(prop as any);
        }
        // Pass through reads (select, rpc, etc.)
        const val = target[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      },
    });
  };

  // ── Patch supabase.functions.invoke() ────────────────
  originalInvoke = supabase.functions.invoke.bind(supabase.functions);

  (supabase.functions as any).invoke = function demoInvoke(
    functionName: string,
    options?: any,
  ) {
    // Allow safe (read-only) functions through
    if (SAFE_EDGE_FUNCTIONS.has(functionName)) {
      return originalInvoke!(functionName, options);
    }

    // Block everything else
    showDemoToast();
    return Promise.resolve({
      data: { ok: true, demo: true, message: 'Demo mode — function not executed' },
      error: null,
    });
  };

  isPatched = true;
  console.info('[CROS Demo] Write interception activated');
}

/**
 * Deactivate demo write interception — restore original client methods.
 */
export function deactivateDemoProxy() {
  if (!isPatched) return;

  if (originalFrom) {
    (supabase as any).from = originalFrom;
    originalFrom = null;
  }

  if (originalInvoke) {
    (supabase.functions as any).invoke = originalInvoke;
    originalInvoke = null;
  }

  isPatched = false;
  console.info('[CROS Demo] Write interception deactivated');
}

/** Check if the proxy is currently active */
export function isDemoProxyActive(): boolean {
  return isPatched;
}
