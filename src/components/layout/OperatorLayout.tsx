/**
 * OperatorLayout — Dedicated layout for the /operator console.
 *
 * WHAT: Icon rail sidebar with 5 Latin Zones: Cura, Machina, Crescere, Scientia, Silentium.
 * WHERE: Wraps all /operator/* routes.
 * WHY: Groups operator tools by stewardship energy, not dev console categories.
 *
 * Zone Constitution:
 *   CURA      — "What should I focus on today?" (daily stewardship)
 *   MACHINA   — "Is the system running correctly?" (infrastructure)
 *   CRESCERE  — "Is the ecosystem growing well?" (business & growth)
 *   SCIENTIA  — "What is the system teaching us?" (insight & understanding)
 *   SILENTIUM — Internal tooling & dev utilities
 */
import { ReactNode, useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { warnUnregisteredRoute } from '@/lib/operatorZoneRegistry';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Activity,
  Users,
  Building2,
  MapPin,
  Calendar,
  Mail,
  FlaskConical,
  Shield,
  BookOpen,
  LogOut,
  User,
  Menu,
  X,
  ChevronLeft,
  Inbox,
  Workflow,
  HeartPulse,
  Plug,
  Settings2,
  ShieldCheck,
  Camera,
  HelpCircle,
  Clock,
  ShieldAlert,
  Megaphone,
  Globe,
  Sparkles,
  ClipboardList,
  TestTube2,
  Compass,
  AppWindow,
  Sun,
  Heart,
  Search,
  Radio,
  ListChecks,
  Cog,
  UserSearch,
  CalendarSearch,
  Settings,
  Star,
  Feather,
  Sprout,
  Wrench,
  Eye,
  Pen,
  Landmark,
  FileText,
  Bell,
  BarChart3,
  Brain,
  HandHeart,
  ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import crosLogo from '@/assets/cros-mark.png';
import { useOperatorBookmarks } from '@/hooks/useOperatorBookmarks';
import { useOperatorUnread } from '@/hooks/useOperatorUnread';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { SeasonalRhythmBar } from '@/components/layout/SeasonalRhythmBar';
import { FederationAppSwitcher, FederationScopeBanner } from '@/components/federation/FederationAppSwitcher';

export interface OperatorLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  testId?: string;
}

type OperatorZone = 'cura' | 'machina' | 'crescere' | 'scientia' | 'silentium';

const ZONE_CONFIG: Record<OperatorZone, { label: string; icon: React.ElementType; color: string }> = {
  cura:      { label: 'Cura',      icon: HandHeart,    color: 'text-emerald-500' },
  machina:   { label: 'Machina',   icon: Wrench,       color: 'text-amber-500' },
  crescere:  { label: 'Crescere',  icon: Landmark,     color: 'text-blue-500' },
  scientia:  { label: 'Scientia',  icon: Brain,        color: 'text-violet-500' },
  silentium: { label: 'Silentium', icon: ShieldAlert,  color: 'text-muted-foreground' },
};

// ─── CURA — The Living Work (daily stewardship) ───
const curaItems: NavItem[] = [
  { label: 'Nexus',             href: '/operator/nexus',            icon: Compass },
  { label: 'Garden Pulse',      href: '/operator/nexus/garden-pulse', icon: Sprout },
  { label: 'Presence',          href: '/operator/nexus/presence',   icon: Activity },
  { label: 'Lumen',             href: '/operator/nexus/lumen',      icon: Compass },
  { label: 'Signum',            href: '/operator/nexus/friction',   icon: Radio },
  { label: 'Adoption',          href: '/operator/nexus/adoption',   icon: Heart },
  { label: 'Daily Rhythm',      href: '/operator/nexus/rhythm',     icon: Sun },
  { label: 'Activation',        href: '/operator/activation',       icon: Sparkles },
  { label: 'Support & Care',    href: '/operator/nexus/support',    icon: Inbox },
  { label: 'Arrival',           href: '/operator/nexus/arrival',    icon: Sprout },
  { label: 'Recovery',          href: '/operator/nexus/recovery',   icon: HeartPulse },
  { label: 'Communio',          href: '/operator/communio',         icon: Shield, testId: 'nav-communio' },
  { label: 'Expansion',         href: '/operator/nexus/expansion',  icon: Globe },
  { label: 'Praeceptum',        href: '/operator/nexus/guidance',   icon: BookOpen },
  { label: 'Knowledge',         href: '/operator/nexus/knowledge',  icon: BookOpen },
  { label: 'Playbooks',         href: '/operator/nexus/playbooks',  icon: FileText },
];

// ─── MACHINA — The System Engine ───
const machinaItems: NavItem[] = [
  { label: 'QA Hub',            href: '/operator/qa',                icon: TestTube2 },
  { label: 'Error Desk',        href: '/operator/error-desk',        icon: ClipboardList },
  { label: 'Audit Log',         href: '/operator/audit',             icon: ScrollText, testId: 'nav-operator-audit' },
  { label: 'Platform Config',   href: '/operator/platform',          icon: Settings2 },
  { label: 'Integrations',      href: '/operator/integrations',      icon: Plug },
  { label: 'Intake',            href: '/operator/intake',            icon: Inbox },
  { label: 'Automation',        href: '/operator/automation',        icon: Workflow },
  { label: 'AI Observatory',    href: '/operator/machina/ai-observatory', icon: Brain },
  { label: 'Orientation',       href: '/operator/machina/orientation',    icon: Compass },
  { label: 'System Health',     href: '/operator/system',            icon: HeartPulse },
  { label: 'Simulation',        href: '/operator/nexus/simulation',  icon: FlaskConical },
];

// ─── CRESCERE — Growth & Economics ───
const crescereItems: NavItem[] = [
  { label: 'Dashboard',         href: '/operator',               icon: Activity, testId: 'nav-operator-console' },
  { label: 'Apps',              href: '/operator/apps',          icon: AppWindow, testId: 'nav-operator-apps' },
  { label: 'Apps (Console)',    href: '/operator/console/apps',  icon: AppWindow, testId: 'nav-operator-console-apps' },
  { label: 'Tenants',           href: '/operator/tenants',       icon: Users },
  { label: 'Partners',          href: '/operator/partners',      icon: Building2 },
  { label: 'Metros',            href: '/operator/metros',        icon: MapPin },
  { label: 'Scheduling',        href: '/operator/scheduling',    icon: Calendar },
  { label: 'People',            href: '/operator/people',        icon: Users },
  { label: 'Find People',       href: '/operator/find-people',   icon: UserSearch },
  { label: 'Find Events',       href: '/operator/find-events',   icon: CalendarSearch },
  { label: 'Events',            href: '/operator/events',        icon: Calendar },
  { label: 'Activities',        href: '/operator/activities',    icon: ListChecks },
  { label: 'Outreach',          href: '/operator/outreach',      icon: Mail },
  { label: 'Ecosystem',         href: '/operator/ecosystem',     icon: Globe },
  { label: 'SEO',               href: '/operator/seo',           icon: Search },
  { label: 'Announcements',     href: '/operator/announcements', icon: Megaphone },
  { label: 'Settings',          href: '/operator/settings',      icon: Settings },
];

// ─── SCIENTIA — Insight & Understanding ───
const scientiaItems: NavItem[] = [
  { label: 'Scientia Console',  href: '/operator/scientia',                  icon: Inbox,    testId: 'nav-operator-scientia' },
  { label: 'Templates',         href: '/operator/scientia/templates',        icon: Sparkles, testId: 'nav-operator-scientia-templates' },
  { label: 'Federation Campaigns', href: '/operator/scientia/federation-campaigns', icon: Mail, testId: 'nav-scientia-federation-campaigns' },
  { label: 'Analytics',         href: '/operator/nexus/analytics',           icon: BarChart3 },
  { label: 'Narrative',         href: '/operator/nexus/narrative',           icon: Feather },
  { label: 'Garden Studio',     href: '/operator/nexus/studio',              icon: Pen },
  { label: 'Content Pipeline',  href: '/operator/nexus/content',             icon: FileText },
  { label: 'Civitas Studio',    href: '/operator/nexus/civitas',             icon: Globe },
  { label: 'Testimonium',       href: '/operator/testimonium',               icon: BookOpen, testId: 'nav-testimonium' },
  { label: 'Narrative Economy', href: '/operator/nexus/narrative-ecosystem', icon: Globe },
];

// ─── SILENTIUM — Hidden internal tooling (not in primary nav) ───
const silentiumItems: NavItem[] = [
  { label: 'Tour Runner',       href: '/operator/tour',           icon: Camera },
  { label: 'Demo Lab',          href: '/operator/scenario-lab',   icon: FlaskConical, testId: 'nav-demo-lab' },
  { label: 'Overrides',         href: '/operator/overrides',      icon: ShieldAlert },
  { label: 'Time Machine',      href: '/operator/time-machine',   icon: Clock },
  { label: 'Manuals',           href: '/operator/manuals',        icon: BookOpen },
  { label: 'Gardener Guide', href: '/operator/how-to',         icon: HelpCircle },
];

const ZONE_ITEMS: Record<OperatorZone, NavItem[]> = {
  cura: curaItems,
  machina: machinaItems,
  crescere: crescereItems,
  scientia: scientiaItems,
  silentium: silentiumItems,
};

/** All items flattened for bookmark lookup (including silentium for bookmarkability) */
const ALL_ITEMS: NavItem[] = [...curaItems, ...machinaItems, ...crescereItems, ...scientiaItems, ...silentiumItems];
const ITEM_MAP = new Map(ALL_ITEMS.map(item => [item.href, item]));

/** Route prefixes that map to each zone for auto-detection */
function detectZone(pathname: string): OperatorZone {
  // Cura routes — daily stewardship
  const curaPaths = [
    '/operator/nexus/presence', '/operator/nexus/lumen', '/operator/nexus/friction',
    '/operator/nexus/adoption', '/operator/nexus/guidance', '/operator/nexus/knowledge',
    '/operator/nexus/playbooks', '/operator/nexus/rhythm', '/operator/nexus/garden-pulse',
    '/operator/nexus/support', '/operator/nexus/arrival', '/operator/nexus/recovery',
    '/operator/activation', '/operator/communio', '/operator/nexus/expansion',
    '/operator/nexus/notifications',
  ];
  if (curaPaths.some(p => pathname.startsWith(p))) return 'cura';
  if (pathname === '/operator/nexus') return 'cura';

  // Machina routes — system engine
  const machinaPaths = [
    '/operator/qa', '/operator/error-desk', '/operator/platform',
    '/operator/integrations', '/operator/intake', '/operator/automation',
    '/operator/system', '/operator/nexus/simulation', '/operator/machina',
  ];
  if (machinaPaths.some(p => pathname.startsWith(p))) return 'machina';

  // Scientia routes — insight & understanding
  const scientiaPaths = [
    '/operator/nexus/analytics', '/operator/nexus/narrative', '/operator/nexus/content',
    '/operator/nexus/civitas', '/operator/testimonium', '/operator/nexus/narrative-ecosystem',
  ];
  if (scientiaPaths.some(p => pathname.startsWith(p))) return 'scientia';

  // Silentium routes — hidden internal tooling
  const silentiumPaths = [
    '/operator/tour', '/operator/scenario-lab', '/operator/overrides',
    '/operator/time-machine', '/operator/manuals', '/operator/how-to',
  ];
  if (silentiumPaths.some(p => pathname.startsWith(p))) return 'silentium';

  // Default: Crescere (growth & economics)
  return 'crescere';
}

function isActive(current: string, href: string) {
  if (href === '/operator') return current === '/operator';
  return current.startsWith(href);
}

export function OperatorLayout({ children }: OperatorLayoutProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { bookmarks, toggleBookmark, isBookmarked } = useOperatorBookmarks();
  const { data: unreadCount } = useOperatorUnread();

  const detectedZone = useMemo(() => detectZone(location.pathname), [location.pathname]);
  const [activeZone, setActiveZone] = useState<OperatorZone>(detectedZone);

  // Keep activeZone in sync when route changes
  useMemo(() => {
    setActiveZone(detectZone(location.pathname));
  }, [location.pathname]);

  // Zone registry enforcement: warn in dev if route has no explicit zone
  useEffect(() => {
    warnUnregisteredRoute(location.pathname);
  }, [location.pathname]);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Gardener';
  const currentItems = ZONE_ITEMS[activeZone];

  // Resolve bookmarked items from the master map
  const bookmarkedItems = useMemo(() => {
    return [...bookmarks]
      .map(href => ITEM_MAP.get(href))
      .filter(Boolean) as NavItem[];
  }, [bookmarks]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>

          <Link to="/operator" className="flex items-center gap-2">
            <img src={crosLogo} alt="CROS" className="w-8 h-8 object-contain" />
            <span className="font-semibold text-foreground text-sm hidden sm:inline">
              CROS Gardener
            </span>
          </Link>

          {/* Zone label badge */}
          <span className={cn('text-xs font-medium hidden sm:inline px-2 py-0.5 rounded-full bg-muted', ZONE_CONFIG[activeZone].color)}>
            {ZONE_CONFIG[activeZone].label}
          </span>

          {/* Federation app switcher — "Currently viewing: ..." */}
          <div className="hidden md:block ml-2 w-48">
            <FederationAppSwitcher />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate('/operator/nexus/notifications')}
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            {(unreadCount ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
                {unreadCount! > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hidden sm:flex gap-1"
            onClick={() => navigate('/dashboard')}
          >
            <ChevronLeft className="w-3 h-3" />
            Back to app
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="user-menu">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">{displayName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to app
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleSignOut} data-testid="sign-out">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Federation scope banner — thin colored bar visible when scoped to a single app */}
      <FederationScopeBanner />

      <SeasonalRhythmBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Icon rail — desktop */}
        <TooltipProvider delayDuration={200}>
          <nav className="hidden md:flex flex-col w-14 border-r border-border bg-card shrink-0 py-3 items-center gap-1">
            {(Object.keys(ZONE_CONFIG) as OperatorZone[]).map((zone) => {
              const cfg = ZONE_CONFIG[zone];
              const Icon = cfg.icon;
              const isZoneActive = activeZone === zone;
              return (
                <Tooltip key={zone}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveZone(zone)}
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                        isZoneActive
                          ? 'bg-primary/10 text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {cfg.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </TooltipProvider>

        {/* Sub-nav panel — desktop */}
        <nav className="hidden md:flex flex-col w-44 lg:w-48 border-r border-border bg-card/50 shrink-0 py-3 overflow-y-auto">
          {/* Bookmarks section */}
          {bookmarkedItems.length > 0 && (
            <>
              <div className="px-3 pb-2 mb-1 border-b border-border">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500" />
                  Bookmarks
                </span>
              </div>
              {bookmarkedItems.map((s) => (
                <div key={`bm-${s.href}`} className="group flex items-center">
                  <Link
                    to={s.href}
                    className={cn(
                      'flex-1 flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
                      isActive(location.pathname, s.href)
                        ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <s.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate text-xs">{s.label}</span>
                  </Link>
                  <button
                    onClick={() => toggleBookmark(s.href)}
                    className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove bookmark"
                  >
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  </button>
                </div>
              ))}
              <div className="my-2 border-b border-border" />
            </>
          )}

          {/* Zone section */}
          <div className="px-3 pb-2 mb-1 border-b border-border">
            <span className={cn('text-xs font-semibold uppercase tracking-wider', ZONE_CONFIG[activeZone].color)}>
              {ZONE_CONFIG[activeZone].label}
            </span>
          </div>
          {currentItems.map((s) => (
            <div key={s.href} className="group flex items-center">
              <Link
                to={s.href}
                data-testid={s.testId}
                className={cn(
                  'flex-1 flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  isActive(location.pathname, s.href)
                    ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <s.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{s.label}</span>
              </Link>
              <button
                onClick={() => toggleBookmark(s.href)}
                className={cn(
                  'pr-2 transition-opacity',
                  isBookmarked(s.href) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
                title={isBookmarked(s.href) ? 'Remove bookmark' : 'Add bookmark'}
              >
                <Star className={cn('w-3.5 h-3.5', isBookmarked(s.href) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground hover:text-amber-500')} />
              </button>
            </div>
          ))}
        </nav>

        {/* Mobile nav overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
            <nav className="absolute left-0 top-14 bottom-0 w-72 bg-card border-r border-border overflow-y-auto">
              {/* Zone switcher */}
              <div className="flex border-b border-border">
                {(Object.keys(ZONE_CONFIG) as OperatorZone[]).map((zone) => {
                  const cfg = ZONE_CONFIG[zone];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={zone}
                      onClick={() => setActiveZone(zone)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors',
                        activeZone === zone
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              {/* Bookmarks */}
              {bookmarkedItems.length > 0 && (
                <div className="py-2 border-b border-border">
                  <div className="px-4 py-1 text-xs font-medium text-amber-500 uppercase tracking-wider flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-500" /> Bookmarks
                  </div>
                  {bookmarkedItems.map((s) => (
                    <div key={`mbm-${s.href}`} className="flex items-center">
                      <Link
                        to={s.href}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          'flex-1 flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                          isActive(location.pathname, s.href)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        <s.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{s.label}</span>
                      </Link>
                      <button
                        onClick={() => toggleBookmark(s.href)}
                        className="pr-3"
                        title="Remove bookmark"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Zone items */}
              <div className="py-2">
                <div className={cn('px-4 py-1 text-xs font-medium uppercase tracking-wider', ZONE_CONFIG[activeZone].color)}>
                  {ZONE_CONFIG[activeZone].label}
                </div>
                {currentItems.map((s) => (
                  <div key={s.href} className="flex items-center">
                    <Link
                      to={s.href}
                      onClick={() => setMobileNavOpen(false)}
                      data-testid={s.testId}
                      className={cn(
                        'flex-1 flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                        isActive(location.pathname, s.href)
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <s.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </Link>
                    <button
                      onClick={() => toggleBookmark(s.href)}
                      className={cn(
                        'pr-3 transition-opacity',
                        isBookmarked(s.href) ? 'opacity-100' : 'opacity-0'
                      )}
                      title={isBookmarked(s.href) ? 'Remove bookmark' : 'Add bookmark'}
                    >
                      <Star className={cn('w-3.5 h-3.5', isBookmarked(s.href) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground')} />
                    </button>
                  </div>
                ))}
              </div>
            </nav>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
          <InstallPrompt />
        </main>
      </div>
    </div>
  );
}
