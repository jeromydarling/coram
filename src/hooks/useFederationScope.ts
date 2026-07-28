/**
 * useFederationScope — The "which app am I currently looking at?" hook.
 *
 * WHAT: Returns the resolved federation scope: 'all' or a specific app + metadata.
 * WHERE: Read by every federation-aware page (NRI Pulse, Content Studio, Library, etc.)
 *        and the FederationAppSwitcher component.
 * WHY:  One source of truth for scoping. Pages re-render their queries based on this.
 *
 * Storage precedence:
 *   1. URL query string (`?app=vigilia`) — shareable links
 *   2. localStorage      — remembers across sessions
 *   3. Default: 'all'
 *
 * Usage:
 *   const scope = useFederationScope();
 *   if (scope.mode === 'single') {
 *     query = query.eq('source_app', scope.source_app);
 *   }
 *   // ...or:
 *   const filter = scope.mode === 'single' ? { source_app: scope.source_app } : undefined;
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFederatedApps } from './useFederatedApps';
import {
  FEDERATION_SCOPE_ALL,
  FEDERATION_SCOPE_QUERY_PARAM,
  FEDERATION_SCOPE_STORAGE_KEY,
  type FederationScope,
  type FederatedApp,
  readScopeFromQuery,
  readScopeFromStorage,
  resolveScope,
  writeScopeToStorage,
} from '@/lib/federation/scope';

interface UseFederationScopeReturn {
  scope: FederationScope;
  apps: FederatedApp[];
  isLoading: boolean;
  setScope: (sourceApp: string | null) => void; // pass null or 'all' to clear
  isAll: boolean;
  isSingle: boolean;
  /** Ergonomic helper: returns the source_app string when scoped, null when 'all' */
  sourceAppFilter: string | null;
}

export function useFederationScope(): UseFederationScopeReturn {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: apps = [], isLoading } = useFederatedApps();

  // Resolve the raw value (URL > storage > default 'all')
  const rawScope = useMemo(() => {
    return (
      readScopeFromQuery(location.search) ??
      readScopeFromStorage() ??
      FEDERATION_SCOPE_ALL
    );
  }, [location.search]);

  const resolved = useMemo(() => resolveScope(rawScope, apps), [rawScope, apps]);

  // Persist to storage whenever the resolved scope changes
  useEffect(() => {
    if (resolved.source_app) {
      writeScopeToStorage(resolved.source_app);
    } else {
      writeScopeToStorage(FEDERATION_SCOPE_ALL);
    }
  }, [resolved.source_app]);

  // Sync to URL when scope was set via storage but URL is empty.
  // (Only sync UP, never DOWN — URL is authoritative when present.)
  useEffect(() => {
    const fromQuery = readScopeFromQuery(location.search);
    if (fromQuery !== null) return; // URL already has it
    if (!resolved.source_app) return; // no need to add ?app=all to URL
    // Quietly add ?app= to URL without scrolling/history pollution
    const params = new URLSearchParams(location.search);
    params.set(FEDERATION_SCOPE_QUERY_PARAM, resolved.source_app);
    navigate(`${location.pathname}?${params.toString()}${location.hash}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.source_app]);

  const setScope = useCallback(
    (sourceApp: string | null) => {
      const next = sourceApp && sourceApp !== FEDERATION_SCOPE_ALL ? sourceApp : null;
      writeScopeToStorage(next ?? FEDERATION_SCOPE_ALL);
      const params = new URLSearchParams(location.search);
      if (next) {
        params.set(FEDERATION_SCOPE_QUERY_PARAM, next);
      } else {
        params.delete(FEDERATION_SCOPE_QUERY_PARAM);
      }
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
    },
    [location.hash, location.pathname, location.search, navigate],
  );

  const scope: FederationScope = resolved.source_app && resolved.app
    ? { mode: 'single', source_app: resolved.source_app, app: resolved.app }
    : { mode: 'all', source_app: null, app: null };

  return {
    scope,
    apps,
    isLoading,
    setScope,
    isAll: scope.mode === 'all',
    isSingle: scope.mode === 'single',
    sourceAppFilter: scope.mode === 'single' ? scope.source_app : null,
  };
}
