/**
 * CompareArchetypePage — Archetype-specific comparison at /compare/:slug.
 *
 * WHAT: Narrative comparison table showing CROS vs traditional tools for a specific archetype.
 * WHERE: /compare/:slug
 * WHY: SEO authority through archetype-specific comparison content.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { archetypeComparisons } from '@/content/archetypeComparisons';
import { archetypes, type ArchetypeKey } from '@/config/brand';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import NarrativeComparisonTable from '@/components/marketing/NarrativeComparisonTable';
import { techArticleSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function CompareArchetypePage() {
  const { t } = useTranslation('marketing');
  const { slug } = useParams<{ slug: string }>();
  const comparison = archetypeComparisons.find((c) => c.slug === slug);
  if (!comparison) return <Navigate to="/compare" replace />;

  const arch = archetypes[comparison.archetypeKey as ArchetypeKey];

  return (
    <div className="bg-white">
      <SeoHead
        title={comparison.title}
        description={comparison.description}
        keywords={comparison.keywords}
        canonical={`/compare/${comparison.slug}`}
        jsonLd={techArticleSchema({
          headline: comparison.title,
          description: comparison.description,
          url: `/compare/${comparison.slug}`,
        })}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <SeoBreadcrumb
          items={[
            { label: 'Home', to: '/' },
            { label: 'Compare', to: '/compare' },
            { label: comparison.title },
          ]}
        />
        {arch && (
          <Link
            to={`/archetypes/${comparison.archetypeKey}/deep`}
            className="inline-block text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.08)] px-3 py-1 rounded-full mb-4 hover:bg-[hsl(var(--marketing-blue)/0.12)] transition-colors"
          >
            {arch.name}
          </Link>
        )}

        <h1
          className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4"
          style={serif}
        >
          {comparison.title}
        </h1>
        <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-12" style={serif}>
          {comparison.intro}
        </p>

        <NarrativeComparisonTable rows={comparison.rows} />

        {/* Closing */}
        <div className="mt-12 rounded-2xl bg-[hsl(var(--marketing-surface))] p-6 sm:p-8">
          <p className="text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed" style={serif}>
            {comparison.closing}
          </p>
        </div>

        {/* Soft CTA */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {t('compareArchetypePage.viewPricing')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/archetypes">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] px-8 h-12 text-base"
            >
              {t('compareArchetypePage.seeArchetypes')}
            </Button>
          </Link>
        </div>
      </div>

      <SeoInternalLinks
        heading={t('compareArchetypePage.seoLinksHeading')}
        links={[
          { label: 'General Comparison', to: '/compare', description: 'CROS vs legacy CRM platforms.' },
          { label: 'Roles', to: '/roles', description: 'Shepherd, Companion, or Visitor.' },
          { label: 'Insights', to: '/insights', description: 'Narrative essays on relationship and technology.' },
        ]}
      />
    </div>
  );
}
