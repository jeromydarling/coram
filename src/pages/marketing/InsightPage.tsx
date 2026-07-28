/**
 * InsightPage — Narrative essay page at /insights/:slug.
 *
 * WHAT: Renders long-form SEO content with role selector, archetype bridge, glossary auto-linking, and concept links.
 * WHERE: /insights/:slug
 * WHY: Organic discovery through narrative essays linked to archetypes, roles, and concepts.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { insights } from '@/content/insights';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import InsightRoleSelector from '@/components/seo/InsightRoleSelector';
import InsightArchetypeBridge from '@/components/seo/InsightArchetypeBridge';
import GlossaryAutoLink from '@/components/seo/GlossaryAutoLink';
import ConceptLinks from '@/components/seo/ConceptLinks';
import { articleSchema } from '@/lib/seo/seoConfig';
import { glossarySchema } from '@/content/glossary';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function InsightPage() {
  const { t } = useTranslation('marketing');
  const { slug } = useParams<{ slug: string }>();
  const insight = insights.find((i) => i.slug === slug);

  if (!insight) return <Navigate to="/" replace />;

  // Pick a concept slug for cross-links based on archetype or role
  const conceptSlug = insight.suggestedRole ?? 'nri';

  return (
    <div className="bg-white">
      <SeoHead
        title={insight.title}
        description={insight.description}
        keywords={insight.keywords}
        canonical={`/insights/${insight.slug}`}
        ogType="article"
        jsonLd={[
          articleSchema({
            headline: insight.title,
            description: insight.description,
            url: `/insights/${insight.slug}`,
            datePublished: insight.datePublished,
          }),
          glossarySchema(),
        ]}
      />

      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        <header className="mb-10">
          <SeoBreadcrumb
            items={[
              { label: 'Home', to: '/' },
              { label: 'Insights', to: '/insights' },
              { label: insight.title },
            ]}
          />
          <time
            dateTime={insight.datePublished}
            className="text-sm text-[hsl(var(--marketing-navy)/0.4)] uppercase tracking-wider"
          >
            {new Date(insight.datePublished).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <h1
            className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mt-3"
            style={serif}
          >
            {insight.title}
          </h1>
        </header>

        {/* Body with glossary auto-linking */}
        <div className="space-y-6">
          {insight.body.map((p, i) => (
            <GlossaryAutoLink
              key={i}
              className="text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg"
              style={serif}
            >
              {p}
            </GlossaryAutoLink>
          ))}
        </div>

        {insight.closing && (
          <div className="mt-12 pt-8 border-t border-[hsl(var(--marketing-border))]">
            <p
              className="text-lg text-[hsl(var(--marketing-navy))] font-medium leading-relaxed"
              style={serif}
            >
              {insight.closing}
            </p>
          </div>
        )}

        {/* Role selector block */}
        <InsightRoleSelector activeRole={insight.suggestedRole} />

        {/* Archetype CTA block */}
        <InsightArchetypeBridge archetypeKey={insight.suggestedArchetype} />

        {/* Soft CTA */}
        <div className="mt-12 text-center">
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {t('featurePage.getStarted')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </article>

      {/* Concept-graph driven related links */}
      <ConceptLinks conceptSlug={conceptSlug} heading={t('roleDeepPage.relatedConceptsHeading')} />

      <SeoInternalLinks
        heading={t('featurePage.seoLinksHeading')}
        links={[
          { label: 'Manifesto', to: '/manifesto', description: 'The philosophy behind CROS.' },
          { label: 'NRI', to: '/nri', description: 'Narrative Relational Intelligence explained.' },
          { label: 'Roles', to: '/roles', description: 'Shepherd, Companion, or Visitor - find your fit.' },
        ]}
      />
    </div>
  );
}
