/**
 * ImpersonationBanner — Persistent top banner during admin impersonation.
 *
 * WHAT: Shows "Viewing as: {user} in {tenant}" with a Stop button.
 * WHERE: Rendered at the top of MainLayout when impersonation is active.
 * WHY: Clear visual indicator that admin is viewing as another user; one-click exit.
 */

import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { Eye, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ImpersonationBanner() {
  const { isImpersonating, session, stopImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating || !session) return null;

  const handleStop = async () => {
    await stopImpersonation();
    navigate(`/${session.tenantSlug}/admin/demo-lab`);
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-amber-800 dark:text-amber-200 truncate">
          Viewing as <strong>{session.targetDisplayName}</strong> in <strong>{session.tenantName}</strong>
          {session.isDemo && <span className="ml-1 text-amber-600 dark:text-amber-400">(demo)</span>}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleStop}
        className="shrink-0 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40 gap-1.5"
      >
        <X className="h-3.5 w-3.5" />
        Stop Impersonating
      </Button>
    </div>
  );
}
