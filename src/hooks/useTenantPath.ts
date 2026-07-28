import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

/**
 * Returns a tenant-prefixed path builder and navigate function.
 * All app routes live under /:tenantSlug/...
 */
export function useTenantPath() {
  const { tenant } = useTenant();
  const slug = tenant?.slug;

  /** Prefix a path with the tenant slug. Returns bare path if no tenant. */
  const tenantPath = useCallback(
    (path: string) => {
      if (!slug) return path;
      // Avoid double-prefixing
      if (path.startsWith(`/${slug}/`) || path === `/${slug}`) return path;
      const clean = path.startsWith('/') ? path : `/${path}`;
      return `/${slug}${clean}`;
    },
    [slug],
  );

  return { tenantPath, slug };
}

/**
 * Drop-in replacement for useNavigate that auto-prefixes tenant slug.
 */
export function useTenantNavigate() {
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();

  return useCallback(
    (path: string, options?: { replace?: boolean; state?: unknown }) => {
      navigate(tenantPath(path), options);
    },
    [navigate, tenantPath],
  );
}
