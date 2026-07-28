/**
 * CompareCompetitorPage — SEO competitor comparison landing page.
 *
 * WHAT: Structured, narrative comparison page for CROS vs specific competitor.
 * WHERE: /compare/:slug (Bloomerang, Salesforce, HubSpot, Mission Layer)
 * WHY: SEO authority through calm, non-attacking, architecturally precise comparisons.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { competitorComparisons, type CompetitorSection } from '@/content/competitorComparisons';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import { techArticleSchema } from '@/lib/seo/seoConfig';

// Hero images
import bloomerangHero from '@/assets/compare-bloomerang-hero.webp';
import salesforceHero from '@/assets/compare-salesforce-hero.webp';
import hubspotHero from '@/assets/compare-hubspot-hero.webp';
import missionLayerHero from '@/assets/compare-mission-layer-hero.webp';

const heroImages: Record<string, string> = {
  'cros-vs-bloomerang': bloomerangHero,
  'cros-vs-salesforce': salesforceHero,
  'cros-vs-hubspot': hubspotHero,
  'cros-mission-layer-crm': missionLayerHero,
};

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

function Section({ section }: { section: CompetitorSection }) {
  const { t } = useTranslation('marketing');
  return (
    <div className="mb-14">
      <h2
        className="text-xl sm:text-2xl font-bold text-[hsl(var(--marketing-navy))] mb-4"
        style={serif}
      >
        {section.heading}
      </h2>

      {section.body && (
        <p
          className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed mb-4"
          style={serif}
        >
          {section.body}
        </p>
      )}

      {section.bullets && (
        <ul className="space-y-2 mb-4 pl-1">
          {section.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.25)] shrink-0" />
              <span className="text-sm text-[hsl(var(--marketing-navy)/0.6)]" style={serif}>
                {b}
              </span>
            </li>
          ))}
        </ul>
      )}

      {section.columns && (
        <div className="grid sm:grid-cols-2 gap-5 mb-4">
          <div className="rounded-xl border border-[hsl(var(--marketing-border))] p-5">
            <span className="text-xs font-semibold text-[hsl(var(--marketing-navy)/0.4)] uppercase tracking-wider block mb-3">
              {t('compareCompetitorPage.traditionalLabel')}
            </span>
            <ul className="space-y-1.5">
              {section.columns.competitor.map((c, i) => (
                <li key={i} className="text-sm text-[hsl(var(--marketing-navy)/0.5)]" style={serif}>
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[hsl(var(--marketing-blue)/0.2)] bg-[hsl(var(--marketing-blue)/0.02)] p-5">
            <span className="text-xs font-semibold text-[hsl(var(--marketing-blue))] uppercase tracking-wider block mb-3">
              CROS™
            </span>
            <ul className="space-y-1.5">
              {section.columns.cros.map((c, i) => (
                <li key={i} className="text-sm text-[hsl(var(--marketing-navy)/0.7)] font-medium" style={serif}>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {section.closingLine && (
        <p
          className="text-sm text-[hsl(var(--marketing-navy)/0.75)] font-medium italic"
          style={serif}
        >
          {section.closingLine}
        </p>
      )}
    </div>
  );
}

export default function CompareCompetitorPage() {
  const { t } = useTranslation('marketing');
  const { slug } = useParams<{ slug: string }>();
  const comparison = competitorComparisons.find((c) => c.slug === slug);
  if (!comparison) return <Navigate to="/compare" replace />;

  const heroImage = heroImages[comparison.slug];

  return (
    <div className="bg-white">
      <SeoHead
        title={comparison.seoTitle}
        description={comparison.metaDescription}
        keywords={comparison.keywords}
        canonical={`/compare/${comparison.slug}`}
        jsonLd={techArticleSchema({
          headline: comparison.seoTitle,
          description: comparison.metaDescription,
          url: `/compare/${comparison.slug}`,
        })}
      />
      <SeoBreadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Compare', to: '/compare' },
          { label: comparison.seoTitle },
        ]}
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {heroImage && (
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            loading="eager"
            className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.12] object-cover object-center scale-[1.8] origin-top"
          />
        )}
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14 sm:pb-20 text-center">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.1] tracking-tight mb-5 whitespace-pre-line"
            style={serif}
          >
            {comparison.heroHeadline}
          </h1>
          <div className="space-y-1 mb-8">
            {comparison.heroSubheadline.map((line, i) => (
              <p
                key={i}
                className="text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed"
                style={serif}
              >
                {line}
              </p>
            ))}
          </div>
          <a href="#content">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {comparison.heroCta}
            </Button>
          </a>
        </div>
      </section>

      {/* ── Content ── */}
      <div id="content" className="max-w-[680px] mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {comparison.sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}

        {/* Works With (Mission Layer page) */}
        {comparison.worksWith && (
          <div className="mb-14">
            <h2
              className="text-xl sm:text-2xl font-bold text-[hsl(var(--marketing-navy))] mb-4"
              style={serif}
            >
              {t('compareCompetitorPage.worksWithHeading')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {comparison.worksWith.map((platform) => (
                <span
                  key={platform}
                  className="text-sm px-4 py-2 rounded-full border border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-navy)/0.6)]"
                  style={serif}
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Final CTA ── */}
      <section className="bg-[hsl(var(--marketing-navy))] py-16 sm:py-20 text-center">
        <div className="max-w-[600px] mx-auto px-4 sm:px-6">
          {comparison.finalCta.lines.map((line, i) => (
            <p
              key={i}
              className="text-xl sm:text-2xl text-white/90 leading-relaxed"
              style={serif}
            >
              {line}
            </p>
          ))}
          <Link to={comparison.finalCta.buttonTo} className="inline-block mt-8">
            <Button
              size="lg"
              className="rounded-full bg-white text-[hsl(var(--marketing-navy))] hover:bg-white/90 px-8 h-12 text-base font-semibold"
            >
              {comparison.finalCta.buttonLabel}
            </Button>
          </Link>
        </div>
      </section>

      <SeoInternalLinks
        heading={t('compareCompetitorPage.seoLinksHeading')}
        links={[
          { label: 'Why CROS', to: '/why-cros', description: 'The philosophy behind the system.' },
          { label: 'CROS Bridge™', to: '/relatio-campaigns', description: 'Migration and integration options.' },
          { label: 'NRI™', to: '/nri', description: 'Narrative Relational Intelligence explained.' },
          { label: 'Pricing', to: '/pricing', description: 'Plans for every mission size.' },
        ]}
      />
    </div>
  );
}
