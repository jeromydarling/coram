/**
 * FederationAppSwitcher — Dropdown for switching federation scope.
 *
 * WHAT: Persistent dropdown showing current app + selector. "All Sites" or single app.
 * WHERE: Sidebar header in OperatorLayout (above the zone rail).
 * WHY:  One mechanism for re-scoping the entire console.
 */
import { Check, ChevronDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useFederationScope } from '@/hooks/useFederationScope';

interface FederationAppSwitcherProps {
  collapsed?: boolean; // when sidebar is collapsed, show icon-only
  className?: string;
}

export function FederationAppSwitcher({ collapsed, className }: FederationAppSwitcherProps) {
  const { scope, apps, setScope, isAll, isLoading } = useFederationScope();

  const accentColor = scope.mode === 'single' ? scope.app.accent_color : '#64748b';
  const label = scope.mode === 'single' ? scope.app.display_name : 'All Sites';

  return (
    <div className={cn('w-full', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={isLoading}
            className={cn(
              'w-full justify-between gap-2 h-10',
              collapsed && 'px-2',
            )}
            aria-label={`Federation scope: ${label}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: accentColor }}
              />
              {!collapsed && (
                <span className="truncate font-medium text-sm">{label}</span>
              )}
            </div>
            {!collapsed && <ChevronDown className="h-4 w-4 opacity-60 flex-shrink-0" />}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            View scope
          </DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => setScope(null)}
            className="gap-3 py-2 cursor-pointer"
          >
            <Globe className="h-4 w-4 opacity-60" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">All Sites</div>
              <div className="text-xs text-muted-foreground">Federation-wide view</div>
            </div>
            {isAll && <Check className="h-4 w-4 text-primary" aria-hidden />}
          </DropdownMenuItem>

          {apps.length > 0 && <DropdownMenuSeparator />}

          {apps.map((app) => {
            const isCurrent = scope.mode === 'single' && scope.source_app === app.source_app;
            return (
              <DropdownMenuItem
                key={app.source_app}
                onClick={() => setScope(app.source_app)}
                className="gap-3 py-2 cursor-pointer"
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: app.accent_color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {app.display_name}
                    {app.is_hub && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                        Hub
                      </span>
                    )}
                  </div>
                  {app.description && (
                    <div className="text-xs text-muted-foreground truncate">{app.description}</div>
                  )}
                </div>
                {isCurrent && <Check className="h-4 w-4 text-primary flex-shrink-0" aria-hidden />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * FederationScopeBanner — Thin colored bar at top of layout indicating scoped view.
 * Renders nothing when scope is 'all' (no banner clutter on the federation home).
 */
export function FederationScopeBanner() {
  const { scope } = useFederationScope();
  if (scope.mode !== 'single') return null;
  return (
    <div
      role="status"
      aria-label={`Currently viewing ${scope.app.display_name}`}
      className="h-1 w-full"
      style={{ backgroundColor: scope.app.accent_color }}
    />
  );
}
