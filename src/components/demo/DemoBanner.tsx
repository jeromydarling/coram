/**
 * DemoBanner — Persistent banner shown during demo mode.
 *
 * WHAT: Floating bar showing demo status, current role, role switcher, and exit button.
 * WHERE: Rendered at top of app when demo mode is active.
 * WHY: Keeps users aware they're in read-only demo mode and lets them switch roles.
 */

import { useDemoMode } from '@/contexts/DemoModeContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { LensRole } from '@/lib/ministryRole';
import { LENS_LABELS } from '@/lib/ministryRole';
import { DemoSessionExpiry } from './DemoSessionExpiry';

export function DemoBanner() {
  const { isDemoMode, demoSession, demoRole, setDemoRole, endDemo } = useDemoMode();
  const navigate = useNavigate();

  if (!isDemoMode || !demoSession) return null;

  const handleExit = () => {
    endDemo();
    navigate('/', { replace: true });
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-md">
      <div className="flex items-center gap-3 min-w-0">
        <Eye className="h-4 w-4 shrink-0 opacity-80" />
        <span className="font-medium truncate">
          Demo Mode
        </span>
        <Badge variant="secondary" className="text-xs shrink-0">
          Read-only
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <DemoSessionExpiry />
        <Select value={demoRole} onValueChange={v => setDemoRole(v as LensRole)}>
          <SelectTrigger className="h-7 w-[130px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(LENS_LABELS) as [LensRole, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="h-7 text-primary-foreground hover:bg-primary-foreground/20 text-xs gap-1"
        >
          <LogOut className="h-3 w-3" />
          Exit
        </Button>
      </div>
    </div>
  );
}
