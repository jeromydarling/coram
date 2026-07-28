import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import vitruvianMan from '@/assets/marketing/vitruvian-man.jpg';
import renaissanceBeyondCrm from '@/assets/marketing/renaissance-beyond-crm.webp';
import renaissanceReflection from '@/assets/marketing/renaissance-reflection.webp';
import renaissanceIntelligenceBg from '@/assets/marketing/renaissance-intelligence-bg.webp';
import { hero, archetypeCards, archetypes } from '@/content/marketing';
import { manifestoSection } from '@/content/features';
import { ArrowRight, Shield, Church, Building2, Users, Heart as HeartIcon, Library, GraduationCap, Brain, HeartHandshake, Footprints, Zap, Smartphone, Tablet, Laptop, Globe, Download, Compass, MapPin, Link2, ArrowLeftRight, ArrowDown, Check } from 'lucide-react';
import RelatioPositioningMatrixCard from '@/components/marketing/RelatioPositioningMatrixCard';
import ConstellationEmbedSection from '@/components/marketing/ConstellationEmbedSection';
import type { ArchetypeKey } from '@/config/brand';
import SeoHead from '@/components/seo/SeoHead';

const manifestoIcons = [Brain, HeartHandshake, Footprints, Zap];

const archetypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  church: Church,
  digital_inclusion: Building2,
  social_enterprise: Building2,
  refugee_support: HeartIcon,
  workforce: Users,
  education_access: GraduationCap,
  library_system: Library,
};

const Landing = React.forwardRef<HTMLDivElement>(function Landing(_props, ref) {
  const { t } = useTranslation('marketing');
  return (
    <div ref={ref} className="bg-white" data-testid="home-root">
      <SeoHead
        title="CROS™ — The Community Relationship OS"
        description="CROS helps teams remember people, notice community shifts, and build a living story of impact — without turning mission into busywork."
        keywords={['community relationship OS', 'nonprofit CRM alternative', 'relationship management', 'narrative intelligence', 'CROS']}
        canonical="/"
      />
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <img
          src={vitruvianMan}
          alt=""
          aria-hidden="true"
          loading="eager"
          fetchPriority="high"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-top"
        />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.1] tracking-tight mb-6">
            {hero.title}
          </h1>
          <p className="text-lg sm:text-xl text-[hsl(var(--marketing-navy)/0.9)] font-normal max-w-2xl mx-auto mb-4 leading-relaxed">
            {t('landingPage.heroCopy')}
          </p>
          <p
            className="text-sm text-[hsl(var(--marketing-navy)/0.55)] max-w-lg mx-auto mb-10 leading-relaxed italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('landingPage.heroTagline')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link to="/pricing">
              <Button
                size="lg"
                className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
                data-testid="home-get-started"
              >
                {hero.ctaPrimary} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-8 h-12 text-base"
              >
                {hero.ctaSecondary}
              </Button>
            </Link>
          </div>

          {/* Device trust bar */}
          <div className="mt-8 mb-4" />
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {[
              { Icon: Smartphone, label: t('landingPage.deviceTrustBar.mobile') },
              { Icon: Tablet, label: t('landingPage.deviceTrustBar.tablet') },
              { Icon: Laptop, label: t('landingPage.deviceTrustBar.desktop') },
              { Icon: Globe, label: t('landingPage.deviceTrustBar.browser') },
              { Icon: Download, label: t('landingPage.deviceTrustBar.addToHome') },
            ].map(({ Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--marketing-navy)/0.4)]">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── What role are you? ── */}
      <section className="max-w-[960px] mx-auto px-4 sm:px-6 py-14 sm:py-20 border-t border-[hsl(var(--marketing-border)/0.5)]">
        <div className="text-center mb-10">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-3"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('landingPage.rolesSection.heading')}
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] max-w-md mx-auto">
            {t('landingPage.rolesSection.subheading')}
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              Icon: Compass,
              roleKey: 'shepherd' as const,
              title: t('roleSelector.roles.shepherd'),
              tagline: t('landingPage.rolesSection.shepherd.tagline'),
              copy: t('landingPage.rolesSection.shepherd.copy'),
            },
            {
              Icon: HeartHandshake,
              roleKey: 'companion' as const,
              title: t('roleSelector.roles.companion'),
              tagline: t('landingPage.rolesSection.companion.tagline'),
              copy: t('landingPage.rolesSection.companion.copy'),
            },
            {
              Icon: MapPin,
              roleKey: 'visitor' as const,
              title: t('roleSelector.roles.visitor'),
              tagline: t('landingPage.rolesSection.visitor.tagline'),
              copy: t('landingPage.rolesSection.visitor.copy'),
            },
          ].map(({ Icon, roleKey, title, tagline, copy }) => (
            <div
              key={roleKey}
              className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] p-6 sm:p-8 text-center hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mx-auto mb-4">
                <Icon className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
              </div>
              <h3
                className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-1"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {title}
              </h3>
              <p
                className="text-sm text-[hsl(var(--marketing-blue))] font-medium mb-2"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {tagline}
              </p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">{copy}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/roles">
            <Button
              variant="ghost"
              className="text-[hsl(var(--marketing-blue))] hover:text-[hsl(var(--marketing-blue)/0.8)]"
            >
              {t('landingPage.rolesSection.exploreRoles')} <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Head / Heart / Body / You ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-14 sm:py-20">
      <div className="max-w-[960px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-4">
            {manifestoSection.title}
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] max-w-[720px] mx-auto whitespace-pre-line leading-relaxed">
            {manifestoSection.intro}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {[
            ...manifestoSection.columns,
            {
              label: t('landingPage.nervousSystem.label'),
              name: t('landingPage.nervousSystem.name'),
              body: t('landingPage.nervousSystem.body'),
              to: '',
            },
          ].map((col, i) => {
            const Icon = manifestoIcons[i];
            return (
              <div
                key={col.name}
                className="text-center space-y-4 bg-white rounded-2xl p-8 border border-[hsl(var(--marketing-border))] hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mx-auto">
                  <Icon className="h-6 w-6 text-[hsl(var(--marketing-blue))]" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))]">
                    {col.label}
                  </span>
                  <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mt-1">{col.name}</h3>
                </div>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">{col.body}</p>
              </div>
            );
          })}
        </div>
        <div className="text-center mt-10">
          <Link to={manifestoSection.cta.to}>
            <Button
              variant="outline"
              className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-6"
            >
              {manifestoSection.cta.label} <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
      </section>

      {/* ── Reflection + Quiet Transition (2-col) ── */}
      <section className="py-14 sm:py-20 bg-gradient-to-b from-white to-[hsl(var(--marketing-surface)/0.4)]">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* LEFT — Not sure if you need new software? */}
            <div className="relative rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-8 sm:p-10 overflow-hidden flex flex-col">
              <img
                src={renaissanceReflection}
                alt=""
                aria-hidden="true"
                className="absolute bottom-0 right-0 w-32 h-32 opacity-[0.07] object-contain pointer-events-none"
              />
              <h2
                className="text-xl sm:text-2xl font-semibold text-[hsl(var(--marketing-navy))] mb-3"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {t('landingPage.reflectionCard.heading')}
              </h2>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] mb-6 leading-relaxed">
                {t('landingPage.reflectionCard.subheading')}
              </p>
              <div className="mt-auto">
                <Link to="/see-people">
                  <Button
                    variant="outline"
                    className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-6"
                  >
                    {t('landingPage.reflectionCard.cta')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* RIGHT — Technology should carry the weight */}
            <div className="relative rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-8 sm:p-10 overflow-hidden flex flex-col">
              <img
                src={renaissanceBeyondCrm}
                alt=""
                aria-hidden="true"
                className="absolute bottom-0 right-0 w-32 h-32 opacity-[0.07] object-contain pointer-events-none"
              />
              <h2
                className="text-xl sm:text-2xl font-semibold text-[hsl(var(--marketing-navy))] leading-snug mb-5"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {t('landingPage.technologyCard.heading').split('\n').map((line, i) => (
                  <React.Fragment key={i}>{line}{i === 0 && <br />}</React.Fragment>
                ))}
              </h2>
              <div
                className="space-y-1 text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-6"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                <p>{t('landingPage.technologyCard.p1')}</p>
                <p>{t('landingPage.technologyCard.p2')}</p>
                <p className="text-[hsl(var(--marketing-navy))] font-medium">{t('landingPage.technologyCard.p3')}</p>
              </div>
              <div className="mt-auto">
                <Link to="/manifesto">
                  <Button
                    variant="outline"
                    className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-6"
                  >
                    {t('landingPage.technologyCard.cta')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Imagine + See People Narrative Cards ── */}
      <section className="py-14 sm:py-20">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-10 text-center"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('landingPage.narrativeCards.heading')}
          </h2>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* LEFT — Imagine */}
            <section
              aria-label="Imagine your work differently"
              className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-6 sm:p-8 flex flex-col"
            >
              <h3
                className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-4"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {t('landingPage.narrativeCards.imagine.heading')}
              </h3>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-5">
                {t('landingPage.narrativeCards.imagine.body')}
              </p>
              <ul className="space-y-3 mb-6 flex-1">
                {(['item1', 'item2', 'item3'] as const).map((key) => (
                  <li key={key} className="flex items-start gap-2.5 text-sm text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--marketing-blue))]" />
                    {t(`landingPage.narrativeCards.imagine.${key}`)}
                  </li>
                ))}
              </ul>
               <Link to="/imagine-this" className="inline-flex items-center text-sm text-[hsl(var(--marketing-blue))] hover:underline mt-auto">
                {t('landingPage.narrativeCards.imagine.link')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
               </Link>
            </section>

            {/* RIGHT — See People */}
            <section
              aria-label="See people beyond data"
              className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-6 sm:p-8 flex flex-col"
            >
              <h3
                className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-4"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {t('landingPage.narrativeCards.seePeople.heading')}
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-6 flex-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-2">{t('landingPage.narrativeCards.seePeople.beforeLabel')}</p>
                  <ul className="space-y-2">
                    {(['before1', 'before2', 'before3'] as const).map((key) => (
                      <li key={key} className="text-sm text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed">{t(`landingPage.narrativeCards.seePeople.${key}`)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-2">{t('landingPage.narrativeCards.seePeople.afterLabel')}</p>
                  <ul className="space-y-2">
                    {(['after1', 'after2', 'after3'] as const).map((key) => (
                      <li key={key} className="text-sm text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed">{t(`landingPage.narrativeCards.seePeople.${key}`)}</li>
                    ))}
                  </ul>
                </div>
              </div>
               <Link to="/see-people" className="inline-flex items-center text-sm text-[hsl(var(--marketing-blue))] hover:underline mt-auto">
                {t('landingPage.narrativeCards.seePeople.link')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
               </Link>
            </section>
          </div>
        </div>
      </section>

      {/* ── Living Constellation of Care ── */}
      <ConstellationEmbedSection />

      {/* ── Relatio Positioning Matrix ── */}
      <RelatioPositioningMatrixCard />

      {/* ── Archetypes ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-14 sm:py-20">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-3">
              {t('landingPage.archetypesSection.heading')}
            </h2>
            <p className="text-[hsl(var(--marketing-navy)/0.55)]">{t('landingPage.archetypesSection.subheading')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archetypeCards.map((a) => {
              const Icon = archetypeIcons[a.key] || Building2;
              const arch = archetypes[a.key as ArchetypeKey];
              return (
                <div
                  key={a.key}
                  className="group bg-white rounded-2xl p-6 border border-[hsl(var(--marketing-border))] hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
                >
                  <Icon className="h-6 w-6 text-[hsl(var(--marketing-blue))] mb-3" />
                  <h3 className="font-semibold text-[hsl(var(--marketing-navy))] mb-1">{a.label}</h3>
                  {arch && (
                    <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed">{arch.tagline}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-center mt-10">
            <Link to="/archetypes">
              <Button
                variant="outline"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-6"
              >
                {t('landingPage.archetypesSection.exploreArchetypes')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Beyond CRMs + Privacy (2-col) ── */}
      <section className="py-14 sm:py-20 bg-gradient-to-b from-[hsl(var(--marketing-surface)/0.3)] to-white">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* LEFT — Why organizations are moving beyond CRMs */}
            <div className="relative rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-8 sm:p-10 flex flex-col overflow-hidden">
              <img
                src={renaissanceBeyondCrm}
                alt=""
                aria-hidden="true"
                className="absolute top-4 right-4 w-28 h-28 opacity-[0.08] object-contain pointer-events-none"
              />
              <h2
                className="text-xl sm:text-2xl font-semibold text-[hsl(var(--marketing-navy))] mb-3 relative"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {t('landingPage.beyondCrmSection.heading')}
              </h2>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] mb-6 leading-relaxed flex-1 relative">
                {t('landingPage.beyondCrmSection.body')}
              </p>
              <Link to="/compare">
                <Button
                  variant="outline"
                  className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-6"
                >
                  {t('landingPage.beyondCrmSection.cta')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {/* RIGHT — Privacy by design */}
            <div className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-navy)/0.03)] p-8 sm:p-10 flex flex-col">
              <Shield className="h-7 w-7 text-[hsl(var(--marketing-navy)/0.3)] mb-4" />
              <h2 className="text-xl sm:text-2xl font-semibold text-[hsl(var(--marketing-navy))] mb-3">{t('landingPage.privacySection.heading')}</h2>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-6 flex-1">
                {t('landingPage.privacySection.body')}
              </p>
              <Link to="/security">
                <Button
                  variant="ghost"
                  className="text-[hsl(var(--marketing-blue))] hover:text-[hsl(var(--marketing-blue)/0.8)] p-0 h-auto"
                >
                  {t('landingPage.privacySection.link')} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Integrations Preview ── */}
      <section className="py-14 sm:py-20 bg-[hsl(var(--marketing-surface))]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[hsl(var(--marketing-border))] mb-3">
              <Link2 className="h-3.5 w-3.5 text-[hsl(var(--marketing-blue))]" />
              <span className="text-[10px] font-medium text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider">{t('landingPage.integrationsSection.badgeLabel')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-3">
              {t('landingPage.integrationsSection.heading')}
            </h2>
            <p className="text-[hsl(var(--marketing-navy)/0.55)] max-w-md mx-auto">
              {t('landingPage.integrationsSection.subheading')}
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {[
              { name: 'HubSpot', twoWay: true },
              { name: 'Salesforce', twoWay: true },
              { name: 'Planning Center', twoWay: false },
              { name: 'Airtable', twoWay: false },
              { name: 'Zoho CRM', twoWay: false },
              { name: 'Rock RMS', twoWay: false },
              { name: 'Bloomerang', twoWay: false },
              { name: 'NeonCRM', twoWay: false },
              { name: 'Breeze', twoWay: false },
              { name: 'Dynamics 365', twoWay: true },
              { name: 'CiviCRM', twoWay: true },
              { name: 'DonorPerfect', twoWay: false },
            ].map((item) => (
              <div
                key={item.name}
                className={`rounded-xl border px-3 py-3 text-center transition-all ${
                  item.twoWay
                    ? 'border-[hsl(var(--marketing-blue)/0.3)] bg-white'
                    : 'border-[hsl(var(--marketing-border))] bg-white'
                }`}
              >
                <p className="text-xs font-medium text-[hsl(var(--marketing-navy))] truncate">{item.name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {item.twoWay ? (
                    <ArrowLeftRight className="h-3 w-3 text-[hsl(var(--marketing-blue))]" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-[hsl(var(--marketing-navy)/0.3)]" />
                  )}
                  <span className="text-[9px] text-[hsl(var(--marketing-navy)/0.4)]">
                    {item.twoWay ? t('landingPage.integrationsSection.twoWayLabel') : t('landingPage.integrationsSection.readLabel')}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/integrations">
              <Button
                variant="outline"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-white px-6"
              >
                {t('landingPage.integrationsSection.seeAll')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Intelligence, governed with intention ── */}
      <section className="relative py-14 sm:py-20 overflow-hidden">
        <img
          src={renaissanceIntelligenceBg}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.06]"
        />
        <div className="max-w-[720px] mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-6 text-center"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('landingPage.intelligenceSection.heading')}
          </h2>
          <div className="space-y-4 text-center">
            <p className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-lg mx-auto">
              {t('landingPage.intelligenceSection.p1')}
            </p>
            <p className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-lg mx-auto">
              {t('landingPage.intelligenceSection.p2')}
            </p>
          </div>
          <ul className="mt-8 space-y-3 max-w-sm mx-auto">
            {(['bullet1', 'bullet2', 'bullet3', 'bullet4'] as const).map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--marketing-blue))]" />
                {t(`landingPage.intelligenceSection.${key}`)}
              </li>
            ))}
          </ul>
          <div className="text-center mt-8">
            <Link to="/features">
              <Button
                variant="outline"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-6"
              >
                {t('landingPage.intelligenceSection.cta')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>


      {/* ── Final CTA ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-20 sm:py-28 text-center">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-4">
            {t('landingPage.finalCta.heading')}
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] mb-10 max-w-md mx-auto">
            {t('landingPage.finalCta.subheading')}
          </p>
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {t('landingPage.finalCta.button')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
});

export default Landing;
