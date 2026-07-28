/**
 * StoryPage — Narrative story page at /stories/:slug.
 *
 * WHAT: Timeline-based story showing CROS in action for a specific archetype.
 * WHERE: /stories/:slug
 * WHY: SEO authority through realistic narrative examples of platform usage.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, Compass, HeartHandshake, MapPin } from 'lucide-react';
import { stories } from '@/content/stories';
import NarrativeStoryPage from '@/pages/marketing/NarrativeStoryPage';
import { archetypes, type ArchetypeKey } from '@/config/brand';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import ConceptLinks from '@/components/seo/ConceptLinks';
import { articleSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  shepherd: Compass,
  companion: HeartHandshake,
  visitor: MapPin,
};

export default function StoryPage() {
  const { t } = useTranslation('marketing');
  const { slug } = useParams<{ slug: string }>();
  const story = stories.find((s) => s.slug === slug);

  // If no static story matches, try DB-published narrative story
  if (!story) return <NarrativeStoryPage />;

  const arch = archetypes[story.archetypeKey as ArchetypeKey];

  return (
    <div className="bg-white">
      <SeoHead
        title={story.title}
        description={story.description}
        keywords={story.keywords}
        canonical={`/stories/${story.slug}`}
        ogType="article"
        jsonLd={articleSchema({
          headline: story.title,
          description: story.description,
          url: `/stories/${story.slug}`,
          datePublished: story.datePublished,
        })}
      />

      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        <header className="mb-12">
          <SeoBreadcrumb
            items={[
              { label: 'Home', to: '/' },
              { label: 'Stories' },
              { label: story.title },
            ]}
          />
          {arch && (
            <Link
              to={`/archetypes/${story.archetypeKey}/deep`}
              className="inline-block text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.08)] px-3 py-1 rounded-full mb-4 hover:bg-[hsl(var(--marketing-blue)/0.12)] transition-colors"
            >
              {arch.name}
            </Link>
          )}
          <h1
            className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-3"
            style={serif}
          >
            {story.title}
          </h1>
          <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
            {story.description}
          </p>
        </header>

        {/* Timeline */}
        <div className="space-y-0">
          {story.timeline.map((moment, i) => {
            const RoleIcon = moment.role ? roleIcons[moment.role] : null;
            return (
              <div key={i} className="relative pl-8 pb-8 border-l-2 border-[hsl(var(--marketing-border))] last:border-transparent">
                {/* Timeline dot */}
                <div className="absolute left-[-7px] top-1 w-3 h-3 rounded-full bg-[hsl(var(--marketing-blue)/0.3)] border-2 border-white" />

                <div className="rounded-xl border border-[hsl(var(--marketing-border))] bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.4)] uppercase tracking-wider">
                      {moment.time}
                    </span>
                    {moment.role && RoleIcon && (
                      <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.06)] px-2 py-0.5 rounded-full">
                        <RoleIcon className="h-3 w-3" /> {t(`roleStoryPage.roleLabels.${moment.role}`, { defaultValue: moment.role })}
                      </span>
                    )}
                    {moment.feature && (
                      <span className="text-xs text-[hsl(var(--marketing-navy)/0.35)] bg-[hsl(var(--marketing-surface))] px-2 py-0.5 rounded-full">
                        {moment.feature}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
                    {moment.title}
                  </h3>
                  <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed whitespace-pre-line">
                    {moment.narrative}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Closing */}
        <div className="mt-10 rounded-2xl bg-[hsl(var(--marketing-surface))] p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3" style={serif}>
            The Living Story
          </h3>
          <p className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed italic" style={serif}>
            {story.closing}
          </p>
        </div>

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

      <ConceptLinks conceptSlug="nri" heading={t('roleDeepPage.relatedConceptsHeading')} />

      <SeoInternalLinks
        heading={t('featurePage.seoLinksHeading')}
        links={[
          { label: 'Archetypes', to: '/archetypes', description: 'See every mission archetype.' },
          { label: 'Roles', to: '/roles', description: 'Shepherd, Companion, or Visitor.' },
          { label: 'NRI', to: '/nri', description: 'Narrative Relational Intelligence explained.' },
        ]}
      />
    </div>
  );
}
