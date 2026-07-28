/**
 * TenantViewBanner — Persistent banner when a Gardener is viewing as a demo tenant.
 *
 * WHAT: Shows which tenant the gardener is previewing with a clear exit button.
 * WHERE: Rendered at the top of the app layout when an override is active.
 * WHY: Prevents confusion — the gardener always knows they're in preview mode.
 *
 * Press G then X to toggle visibility (for clean screenshots).
 */

import { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TenantViewBanner() {
  const { viewingAsTenant, setViewingAsTenantId } = useTenant();
  const { isAdmin } = useAuth();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const toggle = () => setHidden(h => !h);
    window.addEventListener('toggle-tenant-banner', toggle);
    return () => window.removeEventListener('toggle-tenant-banner', toggle);
  }, []);

  if (!isAdmin || !viewingAsTenant || hidden) return null;

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between text-sm z-50 sticky top-0">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span>
          Viewing as: <strong>{viewingAsTenant.name}</strong>
          <span className="ml-2 opacity-75">({viewingAsTenant.archetype} · {viewingAsTenant.tier})</span>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-primary-foreground hover:bg-primary-foreground/20 h-7 gap-1"
        onClick={() => setViewingAsTenantId(null)}
      >
        <X className="h-3.5 w-3.5" />
        Exit Preview
      </Button>
    </div>
  );
}
