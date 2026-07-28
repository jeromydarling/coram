import { useState, useEffect, useMemo } from 'react';
import { TenantViewPicker } from '@/components/operator/TenantViewPicker';
import { Link, useLocation } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useTenant } from '@/contexts/TenantContext';
import { canUse } from '@/lib/features';
import { useCampaignsEnabled } from '@/hooks/useCampaignsEnabled';
import { useProvisionMode } from '@/hooks/useProvisionMode';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import { canSeeNavGroup, canSeeNavItem, canSeeStandaloneItem, isVisitor as isVisitorRole, type LensRole, getEffectiveLens } from '@/lib/ministryRole';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useTenantLens } from '@/hooks/useTenantLens';
import { useVisitorLens } from '@/hooks/useVisitorLens';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  MapPin,
  Building2,
  Users,
  Anchor,
  Calendar,
  CalendarDays,
  Activity,
  ChevronLeft,
  ChevronRight,
  Settings,
  HelpCircle,
  X,
  Shield,
  Tag,
  Newspaper,
  FileBarChart,
  DollarSign,
  ChevronDown,
  Handshake,
  Clock,
  Compass,
  Book,
  BookOpen,
  Map,
  Mail,
  Send,
  Workflow,
  SearchCheck,
  Radar,
  Package,
  Heart,
  Upload,
  Plug,
  UsersRound,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  adminOnly?: boolean;
  testId?: string;
}

interface NavGroup {
  labelKey: string;
  /** English group name used for role-visibility lookup in canSeeNavGroup */
  groupName: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  adminOnly?: boolean;
}

// Standalone items (no group) — visible to shepherd + companion + steward
const standaloneItems: NavItem[] = [
  { labelKey: 'sidebar.commandCenter', href: '/', icon: Compass, testId: 'nav-dashboard' },
];

// Visitor-only standalone items
const visitorStandaloneItems: NavItem[] = [
  { labelKey: 'sidebar.todaysVisits', href: '/visits', icon: Heart, testId: 'nav-visits' },
  { labelKey: 'sidebar.fieldNotes', href: '/field-notes', icon: BookOpen, testId: 'nav-field-notes' },
  { labelKey: 'sidebar.people', href: '/people', icon: Users, testId: 'nav-people' },
  { labelKey: 'sidebar.calendar', href: '/calendar', icon: CalendarDays, testId: 'nav-calendar' },
  { labelKey: 'sidebar.help', href: '/help', icon: HelpCircle, testId: 'nav-help' },
  { labelKey: 'sidebar.settings', href: '/settings', icon: Settings, testId: 'nav-settings' },
];

// Grouped navigation
const navGroups: NavGroup[] = [
  {
    labelKey: 'sidebar.groups.metros',
    groupName: 'Metros',
    icon: MapPin,
    items: [
      { labelKey: 'sidebar.allMetros', href: '/metros', icon: MapPin, testId: 'nav-metros' },
      { labelKey: 'sidebar.intelFeed', href: '/intel-feed', icon: Radar, testId: 'nav-intel-feed' },
      { labelKey: 'sidebar.narratives', href: '/metros/narratives', icon: Radar, testId: 'nav-narratives' },
      { labelKey: 'sidebar.momentumMap', href: '/momentum', icon: Map, testId: 'nav-momentum' },
    ],
  },
  {
    labelKey: 'sidebar.groups.partners',
    groupName: 'Partners',
    icon: Handshake,
    items: [
      { labelKey: 'sidebar.opportunities', href: '/opportunities', icon: Building2, testId: 'nav-opportunities' },
      { labelKey: 'sidebar.radar', href: '/radar', icon: Radar, testId: 'nav-radar' },
      { labelKey: 'sidebar.journey', href: '/pipeline', icon: Compass, testId: 'nav-pipeline' },
      { labelKey: 'sidebar.anchors', href: '/anchors', icon: Anchor, testId: 'nav-anchors' },
      { labelKey: 'sidebar.provisions', href: '/provisions', icon: Package, testId: 'nav-provisions', dynamicProvision: true } as any,
    ],
  },
  {
    labelKey: 'sidebar.groups.people',
    groupName: 'People',
    icon: Users,
    items: [
      { labelKey: 'sidebar.people', href: '/people', icon: Users, testId: 'nav-people' },
      { labelKey: 'sidebar.findPeople', href: '/people/find', icon: SearchCheck, testId: 'nav-find-people' },
      { labelKey: 'sidebar.graph', href: '/graph', icon: Workflow, testId: 'nav-graph' },
      { labelKey: 'sidebar.volunteers', href: '/volunteers', icon: Users, badge: undefined, testId: 'nav-volunteers' },
    ],
  },
  {
    labelKey: 'sidebar.groups.scheduling',
    groupName: 'Scheduling',
    icon: Clock,
    items: [
      { labelKey: 'sidebar.calendar', href: '/calendar', icon: CalendarDays, testId: 'nav-calendar' },
      { labelKey: 'sidebar.allEvents', href: '/events', icon: Calendar, testId: 'nav-events' },
      { labelKey: 'sidebar.findEvents', href: '/events/find', icon: SearchCheck, testId: 'nav-find-events' },
      { labelKey: 'sidebar.activities', href: '/activities', icon: Activity, testId: 'nav-activities' },
    ],
  },
  {
    labelKey: 'sidebar.groups.grants',
    groupName: 'Grants',
    icon: DollarSign,
    items: [
      { labelKey: 'sidebar.allGrants', href: '/grants', icon: Book, testId: 'nav-grants' },
      { labelKey: 'sidebar.findGrants', href: '/grants/find', icon: SearchCheck, testId: 'nav-find-grants' },
    ],
  },
  {
    labelKey: 'sidebar.groups.scientia',
    groupName: 'Scientia',
    icon: Sparkles,
    items: [
      { labelKey: 'sidebar.testimonium', href: '/testimonium', icon: BookOpen, testId: 'nav-testimonium' },
      { labelKey: 'sidebar.intelligence', href: '/intelligence', icon: LayoutDashboard, testId: 'nav-analytics' },
      { labelKey: 'sidebar.reports', href: '/reports', icon: FileBarChart, testId: 'nav-reports' },
    ],
  },
  {
    labelKey: 'sidebar.groups.communio',
    groupName: 'Communio',
    icon: UsersRound,
    items: [
      { labelKey: 'sidebar.sharedNetwork', href: '/communio', icon: UsersRound, testId: 'nav-communio' },
      { labelKey: 'sidebar.caregiverNetwork', href: '/communio/caregiver-network', icon: Heart, testId: 'nav-caregiver-network', caregiverOnly: true } as any,
    ],
  },
];

// Flattened standalone items (formerly single-item groups)
const postGroupItems: NavItem[] = [
  { labelKey: 'sidebar.campaigns', href: '/outreach/campaigns', icon: Send, testId: 'nav-campaigns' },
  { labelKey: 'sidebar.marketplace', href: '/relatio', icon: Plug, testId: 'nav-relatio' },
];

const otherItems: NavItem[] = [
  { labelKey: 'sidebar.settings', href: '/settings', icon: Settings, testId: 'nav-settings' },
  { labelKey: 'sidebar.help', href: '/help', icon: HelpCircle, testId: 'nav-help' },
];

const adminGroup: NavGroup = {
  labelKey: 'sidebar.groups.admin',
  groupName: 'Admin',
  icon: Shield,
  adminOnly: true,
  items: [
    { labelKey: 'sidebar.adminHome', href: '/admin', icon: Shield, testId: 'nav-admin' },
    { labelKey: 'sidebar.activation', href: '/admin/activation', icon: Activity, testId: 'nav-admin-activation' },
    { labelKey: 'sidebar.importCenter', href: '/import', icon: Upload, testId: 'nav-import' },
    { labelKey: 'sidebar.adminGuide', href: '/admin/how-to', icon: HelpCircle, testId: 'nav-admin-guide' },
  ],
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { isAdmin, roles, profile, isSteward } = useAuth();
  const { tenantPath } = useTenantPath();
  const isWarehouseManager = roles.includes('warehouse_manager' as any);
  const { tenant, featureFlags } = useTenant();
  const { enabled: civitasEnabled } = useMetroIntelligence();
  const hasOutreachFeature = canUse('outreach_campaigns', tenant?.tier ?? 'core', featureFlags['outreach_campaigns'] ?? undefined);
  const { t } = useTranslation('navigation');

  // Lens-aware navigation
  const { lens, fullWorkspaceEnabled } = useTenantLens();
  const { isFullWorkspace } = useViewMode();
  const { isVisitorMode } = useVisitorLens();

  // Effective lens for nav filtering (full workspace bypasses lens filtering; visitor mode override)
  const effectiveLens: LensRole = isVisitorMode ? 'visitor' : (isFullWorkspace ? 'steward' : lens);
  const isVisitor = effectiveLens === 'visitor';

  // Campaigns add-on entitlement check (overrides feature flag if campaigns_enabled)
  const { enabled: campaignsEnabled } = useCampaignsEnabled();
  const showOutreach = hasOutreachFeature || campaignsEnabled;

  // Prōvīsiō standalone visibility
  const { showStandalone: showProvisionStandalone } = useProvisionMode();

  // Prefix all nav items with tenant slug
  const prefixItems = (items: NavItem[]): NavItem[] =>
    items.map(item => ({ ...item, href: tenantPath(item.href) }));
  const prefixGroup = (group: NavGroup): NavGroup =>
    ({ ...group, items: prefixItems(group.items) });

  // Inbox needs_review badge count for Volunteers nav item
  const { data: inboxCount } = useQuery({
    queryKey: ['volunteer-inbox-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('volunteer_hours_inbox')
        .select('*', { count: 'exact', head: true })
        .eq('parse_status', 'needs_review');
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  // Track which groups are expanded - default open groups that contain active route
  const getDefaultOpenGroups = () => {
    const openGroups: string[] = [];
    navGroups.forEach(group => {
      if (group.items.some(item => location.pathname === item.href)) {
        openGroups.push(group.labelKey);
      }
    });
    return openGroups;
  };

  const [openGroups, setOpenGroups] = useState<string[]>(getDefaultOpenGroups);

  // Accordion behavior: only one group open at a time
  const toggleGroup = (labelKey: string) => {
    setOpenGroups(prev =>
      prev.includes(labelKey)
        ? [] // Close if already open
        : [labelKey] // Open only this one (close others)
    );
  };

  const renderNavItem = (item: NavItem, showLabel: boolean) => {
    const isActive = location.pathname === item.href;
    // Use explicit testId if provided, otherwise derive from href
    const hrefSuffix = item.href.replace(tenantPath(''), '').replace(/^\//, '').replace(/\//g, '-');
    const testId = item.testId || `nav-${hrefSuffix || 'home'}`;
    const translatedLabel = t(item.labelKey);
    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={onClose}
        data-testid={testId}
        className={cn(
          'nav-item',
          isActive ? 'nav-item-active' : 'nav-item-inactive',
          !showLabel && 'justify-center px-2'
        )}
        title={!showLabel ? translatedLabel : undefined}
      >
        <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-sidebar-primary')} />
        {showLabel && (
          <>
            <span className="flex-1">{translatedLabel}</span>
            {item.badge !== undefined && (
              <span className="px-2 py-0.5 text-xs font-medium bg-sidebar-primary/20 text-sidebar-primary rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  const renderNavGroup = (group: NavGroup, showLabel: boolean) => {
    const isGroupOpen = openGroups.includes(group.labelKey);
    const hasActiveItem = group.items.some(item => location.pathname === item.href);
    const translatedGroupLabel = t(group.labelKey);

    if (!showLabel) {
      // Collapsed sidebar - show first icon of group or group icon
      return (
        <div key={group.labelKey} className="space-y-1">
          {group.items.map(item => renderNavItem(item, false))}
        </div>
      );
    }

    const groupTestId = `nav-group-${translatedGroupLabel.toLowerCase().replace(/\s+/g, '-')}`;
    return (
      <Collapsible
        key={group.labelKey}
        open={isGroupOpen}
        onOpenChange={() => toggleGroup(group.labelKey)}
        data-testid={groupTestId}
        data-state={isGroupOpen ? 'open' : 'closed'}
      >
        <CollapsibleTrigger
          data-testid={`${groupTestId}-trigger`}
          className={cn(
            'nav-item nav-item-inactive w-full justify-between group',
            hasActiveItem && 'text-sidebar-primary'
          )}
        >
          <div className="flex items-center gap-3">
            <group.icon className={cn('w-5 h-5 flex-shrink-0', hasActiveItem && 'text-sidebar-primary')} />
            <span>{translatedGroupLabel}</span>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform duration-200',
              isGroupOpen && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent data-testid={`${groupTestId}-content`} className="pl-4 space-y-1 mt-1">
          {group.items.map(item => renderNavItem(item, true))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const showLabel = !isCollapsed || isOpen;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen max-h-screen bg-sidebar transition-all duration-300 flex flex-col overflow-hidden',
          // Desktop: always visible
          'lg:flex',
          isCollapsed ? 'lg:w-16' : 'lg:w-64',
          // Mobile: controlled by isOpen
          isOpen ? 'flex w-64' : 'hidden'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {showLabel && (
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">CR</span>
              </div>
              <span className="font-semibold text-sidebar-foreground">CROS</span>
            </a>
          )}
          {!showLabel && (
            <a href="/" className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">CR</span>
            </a>
          )}

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop collapse button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'p-1.5 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors hidden lg:block',
              isCollapsed && 'absolute -right-3 top-6 bg-sidebar-accent shadow-md'
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 min-h-0">
          <div className="space-y-1">
            {/* Visitor-only items */}
            {isVisitor && prefixItems(visitorStandaloneItems).map(item => renderNavItem(item, showLabel))}

            {/* Standalone items — hidden from visitors */}
            {!isVisitor && prefixItems(standaloneItems)
              .filter(item => canSeeStandaloneItem(item.href.replace(tenantPath(''), ''), effectiveLens))
              .map(item => renderNavItem(item, showLabel))}

            {/* Grouped navigation — hidden in visitor lens */}
            {!isVisitor && navGroups
              .filter(g => {
                // In full workspace mode, show everything
                if (!isFullWorkspace && !canSeeNavGroup(t(g.labelKey), effectiveLens)) return false;
                if (g.labelKey === 'sidebar.groups.metros' && !civitasEnabled) return false;
                // Filter companion-only items from Communio group
                if (g.labelKey === 'sidebar.groups.communio') {
                  const isCaregiverTenant = tenant?.archetype === 'caregiver_solo' || tenant?.archetype === 'caregiver_agency';
                  g = { ...g, items: g.items.filter(item => !(item as any).caregiverOnly || isCaregiverTenant) };
                }
                return true;
              })
              .map(group => {
                let enriched = prefixGroup(group);
                // Hide Prōvīsiō from Partners when standalone mode is off (care mode)
                if (!showProvisionStandalone) {
                  enriched = {
                    ...enriched,
                    items: enriched.items.filter(item => !(item as any).dynamicProvision),
                  };
                }
                if ((group.labelKey === 'sidebar.groups.partners' || group.labelKey === 'sidebar.groups.people') && inboxCount && inboxCount > 0) {
                  enriched = {
                    ...enriched,
                    items: enriched.items.map(item =>
                      item.href.endsWith('/volunteers') ? { ...item, badge: inboxCount } : item
                    ),
                  };
                }
                if (!isWarehouseManager) return renderNavGroup(enriched, showLabel);
                const filtered = { ...enriched, items: enriched.items.filter(item => !item.href.endsWith('/find')) };
                if (filtered.items.length === 0) return null;
                return renderNavGroup(filtered, showLabel);
              })}

            {/* Post-group standalone items (flattened single-item groups) */}
            {!isVisitor && prefixItems(postGroupItems)
              .filter(item => {
                if (isFullWorkspace) return true;
                // Campaigns: respect outreach entitlement + warehouse manager exclusion
                if (item.testId === 'nav-campaigns' && (isWarehouseManager || !showOutreach)) return false;
                // Relatio: steward/shepherd only
                if (item.testId === 'nav-relatio' && !canSeeNavItem('/relatio', effectiveLens)) return false;
                return true;
              })
              .map(item => renderNavItem(item, showLabel))}

            {!isVisitor && isAdmin && (isFullWorkspace || canSeeNavGroup(t(adminGroup.labelKey), effectiveLens)) && renderNavGroup(prefixGroup(adminGroup), showLabel)}

            {/* Other standalone items — hidden in visitor lens */}
            {!isVisitor && prefixItems(otherItems)
              .filter(item => !item.adminOnly || isAdmin)
              .filter(item => {
                if (isFullWorkspace) return true;
                const suffix = item.href.replace(tenantPath(''), '');
                return canSeeNavItem(suffix, effectiveLens);
              })
              .map(item => renderNavItem(item, showLabel))}
          </div>

          {/* Gardener: View as Tenant picker */}
          {isAdmin && showLabel && <TenantViewPicker />}
        </nav>

      </aside>
    </>
  );
}
