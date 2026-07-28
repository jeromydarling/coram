import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, Database, Mail, Calendar, Layers, Sparkles } from 'lucide-react';
import compareHero from '@/assets/compare-hero.webp';
import ComparisonTable from '@/components/marketing/ComparisonTable';
import NriVsAiPanel from '@/components/marketing/NriVsAiPanel';
import Top10ComparisonChart from '@/components/marketing/Top10ComparisonChart';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import { techArticleSchema } from '@/lib/seo/seoConfig';

const competitorGroupIcons = [Database, Mail, Calendar] as const;
const competitorGroupKeys = ['legacyCrm', 'emailFirst', 'volunteerPlatforms'] as const;

export default function Compare() {
  const { t } = useTranslation('marketing');
  return (
    <div className="bg-white">
      <SeoHead
        title="Compare CROS™ to Legacy CRMs"
        description="CROS™ vs Salesforce, HubSpot, and volunteer platforms. See why mission-driven organizations choose narrative intelligence over data pipelines."
        keywords={['CRM comparison', 'Salesforce alternative', 'HubSpot alternative', 'nonprofit CRM comparison']}
        canonical="/compare"
        jsonLd={techArticleSchema({
          headline: 'CROS™ vs Legacy CRM Platforms',
          description: 'A comparison of CROS narrative relationship OS against traditional CRM systems.',
          url: '/compare',
        })}
      />
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <img src={compareHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.1] tracking-tight mb-6 whitespace-pre-line"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {t('comparePage.headline')}
        </h1>
        <p className="text-lg text-[hsl(var(--marketing-navy)/0.7)] max-w-xl mx-auto mb-10 leading-relaxed">
          {t('comparePage.subheadline')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {t('comparePage.viewPricing')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/archetypes">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-8 h-12 text-base"
            >
              {t('comparePage.seeArchetypes')}
            </Button>
          </Link>
        </div>
        </div>
      </section>

      {/* ── Category Comparison Table ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-24">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Compare' }]} />
        <h2
          className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] text-center mb-10"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {t('comparePage.howCrosComparesHeading')}
        </h2>
        <ComparisonTable />
      </section>

      {/* ── Converge / Diverge Story ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-14 sm:py-20">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 text-center mb-10">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-6"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.convergeSection.heading')}
          </h2>
          <p
            className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.convergeSection.body')}
          </p>
        </div>

        {/* Converge / Diverge cards */}
        <div className="max-w-[640px] mx-auto px-4 sm:px-6 grid sm:grid-cols-2 gap-5 mb-14">
          <div className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] p-6">
            <Layers className="h-5 w-5 text-[hsl(var(--marketing-navy)/0.35)] mb-3" />
            <h3
              className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-1"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {t('comparePage.convergeCard.heading')}
            </h3>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
              {t('comparePage.convergeCard.body')}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[hsl(var(--marketing-blue)/0.2)] p-6 shadow-sm">
            <Sparkles className="h-5 w-5 text-[hsl(var(--marketing-blue))] mb-3" />
            <h3
              className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-1"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {t('comparePage.divergeCard.heading')}
            </h3>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
              {t('comparePage.divergeCard.body')}
            </p>
          </div>
        </div>

        {/* ── Top 10 Platform Chart ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h3
            className="text-xl sm:text-2xl font-bold text-[hsl(var(--marketing-navy))] text-center mb-4"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.top10.heading')}
          </h3>
          <p
            className="text-sm text-[hsl(var(--marketing-navy)/0.5)] text-center mb-8 max-w-lg mx-auto"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.top10.subheading')}
          </p>
          <Top10ComparisonChart />
        </div>
      </section>

      {/* ── Migration CTA ── */}
      <section className="py-14 sm:py-20">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 text-center">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-5"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.migrationSection.heading')}
          </h2>
          <p
            className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-3 max-w-lg mx-auto"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.migrationSection.body')}
          </p>
          <p className="text-xs text-[hsl(var(--marketing-navy)/0.4)] italic mb-8">
            {t('comparePage.migrationSection.footnote')}
          </p>
          <Link to="/relatio-campaigns">
            <Button
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-6"
            >
              {t('comparePage.migrationSection.cta')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Humanity Explanation ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-14 sm:py-20">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 text-center">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-8"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.humanitySection.heading')}
          </h2>
          <div
            className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed space-y-5 text-left sm:text-center"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            <p>{t('comparePage.humanitySection.p1')}</p>
            <p>{t('comparePage.humanitySection.p2')}</p>
            <p>{t('comparePage.humanitySection.p3')}</p>
            <p>{t('comparePage.humanitySection.p4')}</p>
            <p className="text-[hsl(var(--marketing-navy)/0.8)] font-medium">
              {t('comparePage.humanitySection.p5')}
            </p>
          </div>
        </div>
      </section>

      {/* ── NRI™ vs AI ── */}
      <section className="py-14 sm:py-20">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 text-center mb-10">
          <h2
            className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.intelligenceSection.heading')}
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)]">
            {t('comparePage.intelligenceSection.subheading')}
          </p>
        </div>
        <NriVsAiPanel />
      </section>

      {/* ── Competitor Group Callouts ── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-14 sm:py-20">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] text-center mb-10"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.unifiedSection.heading')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {competitorGroupKeys.map((key, idx) => {
              const Icon = competitorGroupIcons[idx];
              return (
                <div
                  key={key}
                  className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] p-6 sm:p-8 flex flex-col"
                >
                  <Icon className="h-6 w-6 text-[hsl(var(--marketing-navy)/0.35)] mb-4" />
                  <h3
                    className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-2"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    {t(`comparePage.competitorGroups.${key}.title`)}
                  </h3>
                  <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed flex-1">
                    {t(`comparePage.competitorGroups.${key}.body`)}
                  </p>
                  <p className="mt-4 text-xs text-[hsl(var(--marketing-blue))] font-medium">
                    {t('comparePage.unifiedSection.unifierNote')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 sm:py-28 text-center">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6">
          <h2
            className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-4"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {t('comparePage.finalCta.heading')}
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] mb-10 max-w-md mx-auto">
            {t('comparePage.finalCta.subheading')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/pricing">
              <Button
                size="lg"
                className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
              >
                {t('comparePage.finalCta.viewPricing')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-8 h-12 text-base"
              >
                {t('comparePage.finalCta.talkToUs')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <SeoInternalLinks
        heading={t('comparePage.seoLinksHeading')}
        links={[
          { label: 'CROS vs Bloomerang', to: '/compare/cros-vs-bloomerang', description: 'Donor CRM or Relationship OS?' },
          { label: 'CROS vs Salesforce', to: '/compare/cros-vs-salesforce', description: 'Enterprise CRM or Relational OS?' },
          { label: 'CROS vs HubSpot', to: '/compare/cros-vs-hubspot', description: 'Marketing CRM or Relational OS?' },
          { label: 'The Mission Layer', to: '/compare/cros-mission-layer-crm', description: 'Add CROS above your existing CRM.' },
          { label: 'Church vs Spreadsheets', to: '/compare/church-vs-spreadsheets', description: 'How churches replace scattered tools.' },
          { label: 'Nonprofit vs Bloated CRM', to: '/compare/nonprofit-vs-bloated-crm', description: 'Why enterprise CRMs fail nonprofits.' },
        ]}
      />
    </div>
  );
}
