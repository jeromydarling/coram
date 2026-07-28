import { ReactNode } from 'react';
import { User, Menu, LogOut, Settings, BarChart3, HelpCircle, Book, Mail, Eye, Layers, HeartHandshake, Accessibility } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useTenantLens } from '@/hooks/useTenantLens';
import { useVisitorLens } from '@/hooks/useVisitorLens';
import { useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useTranslation } from 'react-i18next';

import { AlertsDropdown } from './AlertsDropdown';
import { GlobalSearchCommand } from './GlobalSearchCommand';
import { QuickActionsNav } from './QuickActionsNav';
import { useGmailSyncStatus } from '@/hooks/useEmailCommunications';
import { formatDistanceToNow } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import type { HelpKey } from '@/lib/helpContent';
import { LENS_LABELS } from '@/lib/ministryRole';
import { CompanionModeToggle } from '@/components/companion/CompanionModeToggle';
import { AccessibilityToggle } from '@/components/layout/AccessibilityToggle';

interface HeaderProps {
  title: string;
  mobileTitle?: string;
  subtitle?: string;
  onMenuClick?: () => void;
  headerActions?: ReactNode;
  helpKey?: HelpKey;
}

export function Header({ title, mobileTitle, subtitle, onMenuClick, headerActions, helpKey }: HeaderProps) {
  const { user, profile, signOut, roles } = useAuth();
  const { viewMode, setViewMode, isFullWorkspace } = useViewMode();
  const { lens, fullWorkspaceEnabled } = useTenantLens();
  const { isVisitorMode, toggleVisitorMode, isToggling } = useVisitorLens();
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();
  const { data: syncStatus } = useGmailSyncStatus();
  const { t } = useTranslation('navigation');

  // Visitor mode toggle is available to non-visitor roles
  const isNativeVisitor = lens === 'visitor';
  const canToggleVisitorMode = !isNativeVisitor;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = profile?.nickname || profile?.display_name || user?.email?.split('@')[0] || 'User';
  const isSteward = roles.includes('steward' as any);
  const roleLabel = isSteward
    ? t('header.roles.steward')
    : roles.includes('admin')
      ? t('header.roles.steward')
      : roles.includes('leadership')
        ? t('header.roles.leadership')
        : roles.includes('regional_lead')
          ? t('header.roles.regionalLead')
          : t('header.roles.staff');

  // Show lens label in subtitle when in guided view
  const lensLabel = !isFullWorkspace ? LENS_LABELS[lens] : null;

  return (
    <header className="bg-card border-b border-border">
      <div className="h-16 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile menu button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden shrink-0"
            onClick={onMenuClick}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="min-w-0 flex items-center gap-1.5">
            <div className="min-w-0">
              {mobileTitle ? (
                <>
                  <h1 className="text-lg font-semibold text-foreground truncate md:hidden">{mobileTitle}</h1>
                  <h1 className="text-xl font-semibold text-foreground hidden md:block">{title}</h1>
                </>
              ) : (
                <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">{title}</h1>
              )}
              {subtitle && (
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate">{subtitle}</p>
              )}
            </div>
            {helpKey && <HelpTooltip contentKey={helpKey} size="md" className="shrink-0" />}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
          {/* Header Actions — desktop only (mobile renders below) */}
          {headerActions && (
            <div className="hidden md:flex items-center">
              {headerActions}
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1">
            <GlobalSearchCommand />
            <QuickActionsNav />
          </div>
          <AlertsDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="user-menu">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {roleLabel}{lensLabel && ` · ${lensLabel}`} · {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              {syncStatus?.gmail_sync_enabled && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    <span>
                      {syncStatus.gmail_last_sync_at
                        ? t('header.emailsSynced', { time: formatDistanceToNow(new Date(syncStatus.gmail_last_sync_at), { addSuffix: true }) })
                        : t('header.emailsSyncedNever')}
                    </span>
                  </div>
                </>
              )}
              <DropdownMenuSeparator />
              {fullWorkspaceEnabled && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setViewMode(viewMode === 'guided' ? 'full' : 'guided')}
                >
                  {viewMode === 'guided' ? (
                    <>
                      <Layers className="w-4 h-4 mr-2" />
                      <div className="flex flex-col">
                        <span>{t('header.fullWorkspace')}</span>
                        <span className="text-[10px] text-muted-foreground">{t('header.fullWorkspaceDesc')}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      <div className="flex flex-col">
                        <span>{t('header.guidedView')}</span>
                        <span className="text-[10px] text-muted-foreground">{t('header.guidedViewDesc')}</span>
                      </div>
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {canToggleVisitorMode && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={isToggling}
                  data-testid={isVisitorMode ? 'lens-toggle-exit' : 'lens-toggle-visitor'}
                  onClick={toggleVisitorMode}
                >
                  <HeartHandshake className="w-4 h-4 mr-2" />
                  <div className="flex flex-col">
                    <span>{isVisitorMode ? t('header.exitVisitorMode') : t('header.switchToVisitorMode')}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {isVisitorMode
                        ? t('header.exitVisitorModeDesc')
                        : t('header.visitorModeDesc')}
                    </span>
                  </div>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate(tenantPath('/impulsus'))}
              >
                <Book className="w-4 h-4 mr-2" />
                Impulsus
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate(tenantPath('/my-activity'))}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                {t('header.myStats')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate(tenantPath('/playbooks'))}
              >
                <Book className="w-4 h-4 mr-2" />
                {t('header.playbooks')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate(tenantPath('/feedback'))}
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                {t('header.helpReport')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AccessibilityToggle />
              <CompanionModeToggle variant="menu" />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate(tenantPath('/settings'))}
              >
                <Settings className="w-4 h-4 mr-2" />
                {t('header.settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={handleSignOut}
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('header.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Header Actions on mobile — rendered below the main header row */}
      {headerActions && (
        <div className="md:hidden px-4 pb-2 flex items-center gap-2 overflow-x-auto">
          {headerActions}
        </div>
      )}
    </header>
  );
}
