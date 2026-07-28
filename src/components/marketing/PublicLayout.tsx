import { Link, Outlet } from 'react-router-dom';
import { MarketingRoleProvider } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { brand, modules } from '@/config/brand';
import { lazy, Suspense, useState } from 'react';
import { footerLinks } from '@/content/marketing';
import { ArrowRight, Menu, X, ChevronDown, Heart, Sparkles, Radar, BookOpen, Users, Globe, Package, PenTool, MessageSquare, Shield, MapPin, Compass } from 'lucide-react';
const GardenerNoteModal = lazy(() => import('@/components/marketing/GardenerNoteModal'));
import crosLogo from '@/assets/cros-mark.png';
import { ElementNavLabel } from '@/components/marketing/ElementBadge';
import { useTranslation } from 'react-i18next';

export default function PublicLayout({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation('marketing');
  const [mobileOpen, setMobileOpen] = useState(false);

  /* ─── Feature dropdown items ─── */
  const featureGroups = [
    {
      label: t('publicLayout.featureGroups.core'),
      items: [
        { name: t('publicLayout.featureItems.relationshipMemory'), to: '/cros', icon: Heart },
        { name: 'Profunda™', to: '/profunda', icon: Compass },
        { name: t('publicLayout.featureItems.reflections'), to: '/reflections', icon: PenTool },
      ],
    },
    {
      label: t('publicLayout.featureGroups.intelligence'),
      items: [
        { name: 'NRI™ (Neary)', to: '/nri', icon: Sparkles },
        { name: `${modules.signum.label}™`, to: '/signum', icon: Radar },
        { name: `${modules.testimonium.label}™`, to: '/testimonium-feature', icon: BookOpen },
      ],
    },
    {
      label: t('publicLayout.featureGroups.modules'),
      items: [
        { name: 'Communio™', to: '/communio-feature', icon: Users },
        { name: 'Relatio Campaigns™', to: '/relatio-campaigns', icon: MessageSquare },
        { name: `${modules.voluntarium.label}™`, to: '/voluntarium', icon: Heart },
        { name: `${modules.provisio.label}™`, to: '/provisio', icon: Package },
      ],
    },
  ];

  /* ─── About dropdown items ─── */
  const aboutLinks = [
    { label: t('publicLayout.aboutLinks.manifesto'), to: '/manifesto' },
    { label: t('publicLayout.aboutLinks.ourStory'), to: '/case-study-humanity' },
    { label: t('publicLayout.aboutLinks.roles'), to: '/roles' },
    { label: t('publicLayout.aboutLinks.proof'), to: '/proof' },
    { label: t('publicLayout.aboutLinks.security'), to: '/security' },
    { label: t('publicLayout.aboutLinks.contact'), to: '/contact' },
  ];
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [gardenerNoteOpen, setGardenerNoteOpen] = useState(false);

  return (
    <MarketingRoleProvider>
    <div className="min-h-screen flex flex-col marketing-theme">
      {/* Sticky Nav */}
      <header className="sticky top-0 z-50 border-b border-[hsl(var(--marketing-border))] bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={crosLogo} alt="CROS logo" className="w-[60px] h-[60px] object-contain" />
            <span className="font-semibold text-[hsl(var(--marketing-navy))] text-lg tracking-tight">
              {brand.appName}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {/* Features dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setFeaturesOpen(true)}
              onMouseLeave={() => setFeaturesOpen(false)}
            >
              <Link
                to="/features"
                className="flex items-center gap-1 text-[hsl(var(--marketing-navy)/0.6)] hover:text-[hsl(var(--marketing-navy))] transition-colors font-medium py-4"
              >
                Features <ChevronDown className="h-3.5 w-3.5" />
              </Link>
              {featuresOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-[540px] bg-white rounded-xl shadow-lg border border-[hsl(var(--marketing-border))] p-5 -mt-1">
                  <div className="grid grid-cols-3 gap-5">
                    {featureGroups.map((group) => (
                      <div key={group.label}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-2">
                          {group.label}
                        </p>
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.to + item.name}
                                to={item.to}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--marketing-surface))] transition-colors text-[hsl(var(--marketing-navy)/0.7)] hover:text-[hsl(var(--marketing-navy))]"
                                onClick={() => setFeaturesOpen(false)}
                              >
                                <Icon className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                                <span className="text-[13px]">{item.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-[hsl(var(--marketing-border))]">
                    <Link
                      to="/features"
                      className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.5)] hover:text-[hsl(var(--marketing-navy))] transition-colors flex items-center gap-1"
                      onClick={() => setFeaturesOpen(false)}
                    >
                      All features <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/the-model"
              className="text-[hsl(var(--marketing-navy)/0.6)] hover:text-[hsl(var(--marketing-navy))] transition-colors font-medium"
            >
              The Model
            </Link>

            <Link
              to="/archetypes"
              className="text-[hsl(var(--marketing-navy)/0.6)] hover:text-[hsl(var(--marketing-navy))] transition-colors font-medium"
            >
              Archetypes
            </Link>

            <Link
              to="/pricing"
              className="text-[hsl(var(--marketing-navy)/0.6)] hover:text-[hsl(var(--marketing-navy))] transition-colors font-medium"
            >
              Pricing
            </Link>

            {/* About dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setAboutOpen(true)}
              onMouseLeave={() => setAboutOpen(false)}
            >
              <button className="flex items-center gap-1 text-[hsl(var(--marketing-navy)/0.6)] hover:text-[hsl(var(--marketing-navy))] transition-colors font-medium py-4">
                About <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {aboutOpen && (
                <div className="absolute top-full right-0 w-48 bg-white rounded-xl shadow-lg border border-[hsl(var(--marketing-border))] py-2 -mt-1">
                  {aboutLinks.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      className="block px-4 py-2.5 text-sm text-[hsl(var(--marketing-navy)/0.7)] hover:bg-[hsl(var(--marketing-surface))] hover:text-[hsl(var(--marketing-navy))] transition-colors"
                      onClick={() => setAboutOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-[hsl(var(--marketing-navy)/0.7)] hover:text-[hsl(var(--marketing-navy))]">
                Sign in
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                size="sm"
                className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-5"
              >
                Get started <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[hsl(var(--marketing-border))] bg-white px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Features section */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-2">
                Features
              </p>
              {featureGroups.map((group) => (
                <div key={group.label} className="mb-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.3)] mb-1 pl-2">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to + item.name}
                        to={item.to}
                        className="flex items-center gap-2 py-1.5 pl-2 text-sm text-[hsl(var(--marketing-navy)/0.7)]"
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon className="h-3.5 w-3.5 opacity-40" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              ))}
              <Link
                to="/features"
                className="block text-sm font-medium text-[hsl(var(--marketing-navy)/0.5)] py-1.5 pl-2"
                onClick={() => setMobileOpen(false)}
              >
                All features →
              </Link>
            </div>

            <div className="border-t border-[hsl(var(--marketing-border))] pt-3 space-y-1">
              <Link to="/the-model" className="block text-sm font-medium text-[hsl(var(--marketing-navy)/0.7)] py-1.5" onClick={() => setMobileOpen(false)}>
                The Model
              </Link>
              <Link to="/archetypes" className="block text-sm font-medium text-[hsl(var(--marketing-navy)/0.7)] py-1.5" onClick={() => setMobileOpen(false)}>
                Archetypes
              </Link>
              <Link to="/pricing" className="block text-sm font-medium text-[hsl(var(--marketing-navy)/0.7)] py-1.5" onClick={() => setMobileOpen(false)}>
                Pricing
              </Link>
            </div>

            {/* About section */}
            <div className="border-t border-[hsl(var(--marketing-border))] pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-2">
                About
              </p>
              <div className="space-y-1">
                {aboutLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="block text-sm font-medium text-[hsl(var(--marketing-navy)/0.7)] py-1.5"
                    onClick={() => setMobileOpen(false)}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[hsl(var(--marketing-border))]">
              <Link to="/login" className="flex-1">
                <Button variant="outline" size="sm" className="w-full rounded-full">Sign in</Button>
              </Link>
              <Link to="/contact" className="flex-1">
                <Button size="sm" className="w-full rounded-full bg-[hsl(var(--marketing-navy))] text-white">
                  Get started
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children ?? <Outlet />}
      </main>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <img src={crosLogo} alt="CROS" className="w-12 h-12 object-contain" />
                <span className="font-semibold text-[hsl(var(--marketing-navy))]">{brand.appName}</span>
              </div>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] max-w-xs">
                {brand.fullName}
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {footerLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="text-[hsl(var(--marketing-navy)/0.5)] hover:text-[hsl(var(--marketing-navy))] transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-8 pt-6 border-t border-[hsl(var(--marketing-border))] text-xs text-[hsl(var(--marketing-navy)/0.4)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>© {new Date().getFullYear()} CROS™ · {brand.fullName}. All rights reserved.</span>
            <button
              type="button"
              onClick={() => setGardenerNoteOpen(true)}
              className="text-[hsl(var(--marketing-navy)/0.4)] hover:text-[hsl(var(--marketing-navy)/0.7)] transition-colors italic text-left"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              CROS was grown from decades of lived community work.
            </button>
          </div>
        </div>
      </footer>

      <Suspense fallback={null}>
        <GardenerNoteModal open={gardenerNoteOpen} onOpenChange={setGardenerNoteOpen} />
      </Suspense>
    </div>
    </MarketingRoleProvider>
  );
}
