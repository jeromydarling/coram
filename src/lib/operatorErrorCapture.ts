/**
 * operatorErrorCapture — Frontend Compass error signal.
 *
 * WHAT: Detects unhandled errors and emits a `cros:system-error` window event so
 *       the Compass overlay can reassure the operator. It no longer persists
 *       anything — Sentry (initialized in src/lib/sentry.ts) is the source of truth.
 * WHERE: Installed once at app root; also callable from API wrappers.
 * WHY: The homegrown operator_app_errors / system_error_events write paths were retired
 *      in favor of Sentry. This module is kept only for the Compass UX signal.
 *
 * @deprecated Persistence removed — errors now flow to Sentry. Only the
 *             `cros:system-error` window event remains for the Compass overlay.
 */

function computeFingerprint(message: string, stack?: string, route?: string, source?: string): string {
  const firstLine = stack?.split('\n').find(l => l.trim().startsWith('at ')) || '';
  const raw = `${message}|${firstLine.trim()}|${route || ''}|${source || 'frontend'}`;
  // Simple hash — djb2
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) & 0x7fffffff;
  }
  return hash.toString(36);
}

interface ErrorPayload {
  source: 'frontend' | 'edge_function' | 'database' | 'integration';
  message: string;
  stack?: string;
  route?: string;
  functionName?: string;
  status?: number;
  extra?: Record<string, unknown>;
}

let _initialized = false;
let _currentTenantId: string | null = null;
const _recentFingerprints = new Set<string>();

/**
 * Set the active tenant ID so error events are scoped to the correct tenant.
 * Call this when tenant context mounts/changes.
 */
export function setErrorCaptureTenantId(tenantId: string | null): void {
  _currentTenantId = tenantId;
}

/**
 * Emit the `cros:system-error` window event so the Compass overlay can reassure
 * the operator. Persistence was removed — Sentry now captures the actual error.
 * Silently fails — never throws.
 *
 * @deprecated Only emits the Compass window event; no longer writes to any table.
 */
export async function logOperatorError(payload: ErrorPayload): Promise<void> {
  try {
    // Skip transient / non-actionable errors (includes HMR stale artifacts)
    if (isTransientError(payload.message, payload.stack)) return;

    const route = payload.route || (typeof window !== 'undefined' ? window.location.pathname : '');
    const fingerprint = computeFingerprint(payload.message, payload.stack, route, payload.source);

    // Debounce identical errors within same page session
    if (_recentFingerprints.has(fingerprint)) return;
    _recentFingerprints.add(fingerprint);
    setTimeout(() => _recentFingerprints.delete(fingerprint), 60_000);

    // Emit custom event so the Compass can auto-open with reassurance.
    // This is the ONLY remaining side effect — Sentry captures the error itself.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cros:system-error', {
        detail: { fingerprint, message: payload.message, route },
      }));
    }
  } catch {
    // Intentionally silent — error capture must never crash the app
  }
}

/**
 * Transient errors caused by stale caches, network hiccups, or deploy artifacts.
 * These are never actionable and should not appear on the Error Desk.
 */
const TRANSIENT_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Loading chunk [\w-]+ failed/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Minified React error #300/i,
  /ChunkLoadError/i,
  /NetworkError when attempting to fetch resource/i,
  /Load failed/i,
];

/**
 * Detect stale HMR artifacts — errors caused by hot-reload leaving
 * references to old module closures. These only occur in dev preview
 * and are never actionable.
 */
function isHmrStaleArtifact(message: string, stack?: string): boolean {
  if (!stack) return false;
  // HMR-injected modules contain ?t= cache-bust params
  const hasHmrTimestamp = /\?t=\d{10,}/.test(stack);
  if (!hasHmrTimestamp) return false;
  // Common patterns from stale closures after hot reload
  return /is not defined/i.test(message) ||
    /Cannot read properties of (undefined|null)/i.test(message);
}

function isTransientError(message: string, stack?: string): boolean {
  if (TRANSIENT_PATTERNS.some(p => p.test(message))) return true;
  if (isHmrStaleArtifact(message, stack)) return true;
  return false;
}

/**
 * Install global error handlers. Call once at app startup.
 */
export function initOperatorErrorCapture(): void {
  if (_initialized || typeof window === 'undefined') return;
  _initialized = true;

  window.addEventListener('error', (event) => {
    logOperatorError({
      source: 'frontend',
      message: event.message || 'Unhandled error',
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logOperatorError({
      source: 'frontend',
      message: reason?.message || String(reason) || 'Unhandled promise rejection',
      stack: reason?.stack,
    });
  });
}
