/**
 * Features — Hybrid narrative + card hub for all CROS capabilities.
 *
 * WHAT: Central features page grouping all modules with narrative intro.
 * WHERE: /features route, linked from nav Features dropdown.
 * WHY: Consolidates scattered feature pages into one discoverable entry point.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { brand, modules } from '@/config/brand';
import { ArrowRight, Heart, Radar, BookOpen, Users, Globe, Package, PenTool, MapPin, Compass, Calendar, Search, Shield, Sparkles, MessageSquare, HandCoins } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import featuresHero from '@/assets/features-hero.webp';
import { financialMomentsPage } from '@/content/features';
import RelationshipVsTransactionDiagram from '@/components/marketing/RelationshipVsTransactionDiagram';
import RelationalFlowStrip from '@/components/marketing/RelationalFlowStrip';

interface FeatureCard {
  titleKey: string;
  descKey: string;
  to: string;
  icon: React.ElementType;
}

const coreFeatures: FeatureCard[] = [
  { titleKey: 'featuresPage.core.features.relationshipMemory.title', descKey: 'featuresPage.core.features.relationshipMemory.desc', to: '/cros', icon: Heart },
  { titleKey: 'featuresPage.core.features.peoplePartners.title', descKey: 'featuresPage.core.features.peoplePartners.desc', to: '/cros', icon: Users },
  { titleKey: 'featuresPage.core.features.journeyChapters.title', descKey: 'featuresPage.core.features.journeyChapters.desc', to: '/cros', icon: Compass },
  { titleKey: 'featuresPage.core.features.eventsCalendar.title', descKey: 'featuresPage.core.features.eventsCalendar.desc', to: '/cros', icon: Calendar },
  { titleKey: 'featuresPage.core.features.reflections.title', descKey: 'featuresPage.core.features.reflections.desc', to: '/cros', icon: PenTool },
  { titleKey: 'featuresPage.core.features.visits.title', descKey: 'featuresPage.core.features.visits.desc', to: '/cros', icon: MapPin },
];

const intelligenceFeatures: FeatureCard[] = [
  { titleKey: 'featuresPage.intelligence.features.nri.title', descKey: 'featuresPage.intelligence.features.nri.desc', to: '/nri', icon: Sparkles },
  { titleKey: 'featuresPage.intelligence.features.signum.title', descKey: 'featuresPage.intelligence.features.signum.desc', to: '/signum', icon: Radar },
  { titleKey: 'featuresPage.intelligence.features.testimonium.title', descKey: 'featuresPage.intelligence.features.testimonium.desc', to: '/testimonium-feature', icon: BookOpen },
  { titleKey: 'featuresPage.intelligence.features.discovery.title', descKey: 'featuresPage.intelligence.features.discovery.desc', to: '/signum', icon: Search },
];

const moduleFeatures: FeatureCard[] = [
  { titleKey: 'featuresPage.modules.features.communio.title', descKey: 'featuresPage.modules.features.communio.desc', to: '/communio-feature', icon: Users },
  { titleKey: 'featuresPage.modules.features.relatioCampaigns.title', descKey: 'featuresPage.modules.features.relatioCampaigns.desc', to: '/relatio-campaigns', icon: MessageSquare },
  { titleKey: 'featuresPage.modules.features.financialMoments.title', descKey: 'featuresPage.modules.features.financialMoments.desc', to: '/features#financial-moments', icon: HandCoins },
  { titleKey: 'featuresPage.modules.features.voluntarium.title', descKey: 'featuresPage.modules.features.voluntarium.desc', to: '/voluntarium', icon: Heart },
  { titleKey: 'featuresPage.modules.features.provisio.title', descKey: 'featuresPage.modules.features.provisio.desc', to: '/provisio', icon: Package },
  { titleKey: 'featuresPage.modules.features.impulsus.title', descKey: 'featuresPage.modules.features.impulsus.desc', to: '/impulsus', icon: PenTool },
  { titleKey: 'featuresPage.modules.features.relatioMarketplace.title', descKey: 'featuresPage.modules.features.relatioMarketplace.desc', to: '/integrations', icon: Globe },
];

function FeatureCardComponent({ feature }: { feature: FeatureCard }) {
  const { t } = useTranslation('marketing');
  const Icon = feature.icon;
  return (
    <Link
      to={feature.to}
      className="group block p-6 rounded-2xl border border-[hsl(var(--marketing-border))] bg-white hover:border-[hsl(var(--marketing-navy)/0.2)] hover:shadow-md transition-all duration-300"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[hsl(var(--marketing-surface))] flex items-center justify-center flex-shrink-0 group-hover:bg-[hsl(var(--marketing-navy)/0.08)] transition-colors">
          <Icon className="w-5 h-5 text-[hsl(var(--marketing-navy)/0.6)]" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[hsl(var(--marketing-navy))] mb-1 group-hover:text-[hsl(var(--marketing-navy))] transition-colors">
            {t(feature.titleKey)}
          </h3>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
            {t(feature.descKey)}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function Features() {
  const { t } = useTranslation('marketing');
  return (
    <>
      <SeoHead
        title={`Features — ${brand.appName}™`}
        description="Everything your team needs to remember people, notice community shifts, and build a living story of impact — without turning mission into busywork."
      />

      {/* Narrative intro */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <img src={featuresHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--marketing-navy)/0.4)] mb-4">
            {t('featuresPage.eyebrow', { appName: brand.appName })}
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-tight mb-6">
            {t('featuresPage.headline')}
          </h1>
          <p
            className="text-lg sm:text-xl text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-2xl mx-auto"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('featuresPage.subheadline', { appName: brand.appName })}
          </p>
        </div>
      </section>

      {/* Core */}
      <section className="pt-12 sm:pt-16 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--marketing-navy)/0.4)] mb-2">
              {t('featuresPage.sections.core.eyebrow')}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))]">
              {t('featuresPage.sections.core.heading')}
            </h2>
            <p className="text-[hsl(var(--marketing-navy)/0.55)] mt-2 max-w-xl">
              {t('featuresPage.sections.core.body', { appName: brand.appName })}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreFeatures.map((f) => (
              <FeatureCardComponent key={f.titleKey} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* Intelligence */}
      <section className="pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--marketing-navy)/0.4)] mb-2">
              {t('featuresPage.sections.intelligence.eyebrow')}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))]">
              {t('featuresPage.sections.intelligence.heading')}
            </h2>
            <p className="text-[hsl(var(--marketing-navy)/0.55)] mt-2 max-w-xl">
              {t('featuresPage.sections.intelligence.body')}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {intelligenceFeatures.map((f) => (
              <FeatureCardComponent key={f.titleKey} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--marketing-navy)/0.4)] mb-2">
              {t('featuresPage.sections.modules.eyebrow')}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))]">
              {t('featuresPage.sections.modules.heading')}
            </h2>
            <p className="text-[hsl(var(--marketing-navy)/0.55)] mt-2 max-w-xl">
              {t('featuresPage.sections.modules.body')}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {moduleFeatures.map((f) => (
              <FeatureCardComponent key={f.titleKey} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* Relationship vs Transaction Diagram */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4 mb-4">
        <div className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] shadow-sm p-6 sm:p-10">
          <RelationshipVsTransactionDiagram />
        </div>
      </div>

      {/* Financial Moments */}
      <section id="financial-moments" className="pb-20 sm:pb-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--marketing-navy)/0.4)] mb-2">
              A moment in the story
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-4"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {financialMomentsPage.title}
            </h2>
            <p
              className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-2xl mx-auto"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {financialMomentsPage.subtitle}
            </p>
          </div>

          <div className="space-y-4 mb-12">
            {financialMomentsPage.intro.map((para, i) => (
              <p
                key={i}
                className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {para}
              </p>
            ))}
          </div>

          <div className="grid gap-6 sm:grid-cols-3 mb-12">
            {financialMomentsPage.capabilities.map((cap) => (
              <div
                key={cap.name}
                className="p-6 rounded-2xl border border-[hsl(var(--marketing-border))] bg-white"
              >
                <h3 className="font-semibold text-[hsl(var(--marketing-navy))] mb-1">{cap.name}</h3>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)] mb-3 italic">{cap.summary}</p>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{cap.detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] border border-[hsl(var(--marketing-border))] p-6 sm:p-8 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="w-5 h-5 text-[hsl(var(--marketing-navy)/0.4)] mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-[hsl(var(--marketing-navy))] text-sm mb-1">Stripe-secure payments</h4>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
                  All transactions are handled through Stripe. Funds go directly to your organization's bank account.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <HandCoins className="w-5 h-5 text-[hsl(var(--marketing-navy)/0.4)] mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-[hsl(var(--marketing-navy))] text-sm mb-1">No financial complexity</h4>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
                  CROS does not replace your accounting software. It simply remembers the moments that matter.
                </p>
              </div>
            </div>
          </div>

          <p
            className="text-center text-sm text-[hsl(var(--marketing-navy)/0.5)] italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {financialMomentsPage.closing}
          </p>
        </div>
      </section>

      {/* Relational Flow Strip */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-4">
        <div className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] shadow-sm p-6 sm:p-10">
          <RelationalFlowStrip />
        </div>
      </div>

      {/* Shared Intelligence */}
      <section className="pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border border-[hsl(var(--marketing-blue)/0.15)] bg-[hsl(var(--marketing-blue)/0.04)] p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--marketing-navy)/0.4)] mb-2">
              {t('featuresPage.sections.governance.eyebrow')}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3">
              {t('featuresPage.sections.governance.heading')}
            </h2>
            <p className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-xl">
              {t('featuresPage.sections.governance.body')}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <p
            className="text-lg text-[hsl(var(--marketing-navy)/0.55)] mb-8 italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('featuresPage.cta.quote')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/pricing">
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[hsl(var(--marketing-navy))] text-white font-medium hover:bg-[hsl(var(--marketing-navy)/0.9)] transition-colors">
                {t('featuresPage.cta.viewPricing')} <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/contact">
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-navy))] font-medium hover:bg-[hsl(var(--marketing-surface))] transition-colors">
                {t('featuresPage.cta.talkToUs')}
              </button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
