/**
 * Federation scope — single source of truth for "which app am I currently looking at?"
 *
 * WHAT: Type definitions + helpers for the federation app switcher.
 * WHERE: Read by useFederationScope() hook and the FederationAppSwitcher component.
 * WHY:  Every federation-aware page reads its scope from one place; no per-page selectors.
 *
 * Storage strategy:
 *   1. URL query string (`?app=vigilia`) — shareable links win over local state.
 *   2. localStorage key `cros.federation.scope` — remembers selection across sessions.
 *   3. Default 'all' (federation-wide view) for fresh loads.
 */

export const FEDERATION_SCOPE_QUERY_PARAM = 'app';
export const FEDERATION_SCOPE_STORAGE_KEY = 'cros.federation.scope';
export const FEDERATION_SCOPE_ALL = 'all' as const;

export type FederationScopeMode = 'all' | 'single';

export interface FederatedApp {
  source_app: string;
  display_name: string;
  description: string | null;
  accent_color: string;
  public_base_url: string | null;
  is_hub: boolean;
  display_order: number;
}

export interface FederationScopeAll {
  mode: 'all';
  source_app: null;
  app: null;
}

export interface FederationScopeSingle {
  mode: 'single';
  source_app: string;
  app: FederatedApp; // resolved app metadata; null while loading
}

export type FederationScope = FederationScopeAll | FederationScopeSingle;

/**
 * Read the current scope from the URL query string.
 * Returns the source_app slug, or 'all', or null if param missing.
 */
export function readScopeFromQuery(search: string): string | null {
  try {
    const params = new URLSearchParams(search);
    const v = params.get(FEDERATION_SCOPE_QUERY_PARAM);
    if (!v) return null;
    return v;
  } catch {
    return null;
  }
}

/**
 * Read the last-selected scope from localStorage.
 */
export function readScopeFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(FEDERATION_SCOPE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeScopeToStorage(value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FEDERATION_SCOPE_STORAGE_KEY, value);
  } catch {
    /* ignore quota / privacy mode */
  }
}

/**
 * Resolve the raw scope value (a string from query/storage) against the
 * known federated apps list. Returns 'all' if the value is invalid or
 * doesn't match any known active app.
 */
export function resolveScope(
  raw: string | null,
  apps: FederatedApp[],
): { source_app: string | null; app: FederatedApp | null } {
  if (!raw || raw === FEDERATION_SCOPE_ALL) {
    return { source_app: null, app: null };
  }
  const match = apps.find((a) => a.source_app === raw);
  if (!match) {
    return { source_app: null, app: null };
  }
  return { source_app: match.source_app, app: match };
}

/**
 * Build a query string suffix to append/replace on a URL when navigating.
 * Returns an empty string when scope is 'all' (cleaner URLs).
 */
export function scopeToQueryParam(scope: string | null): string {
  if (!scope || scope === FEDERATION_SCOPE_ALL) return '';
  return `?${FEDERATION_SCOPE_QUERY_PARAM}=${encodeURIComponent(scope)}`;
}
