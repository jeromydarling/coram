/**
 * RoleStoryPage — Role-centered story at /stories/roles/:slug.
 *
 * WHAT: Narrative story showing a single role in action through a day.
 * WHERE: /stories/roles/:slug
 * WHY: SEO authority through role-centered narrative identity content.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, Compass, HeartHandshake, MapPin } from 'lucide-react';
import { roleStories } from '@/content/roleStories';
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

export default function RoleStoryPage() {
  const { t } = useTranslation('marketing');
  const { slug } = useParams<{ slug: string }>();
  const story = roleStories.find((s) => s.slug === slug);
  if (!story) return <Navigate to="/roles" replace />;

  const RoleIcon = roleIcons[story.role] ?? Compass;

  return (
    <div className="bg-white">
      <SeoHead
        title={story.title}
        description={story.description}
        keywords={story.keywords}
        canonical={`/stories/roles/${story.slug}`}
        ogType="article"
        jsonLd={articleSchema({
          headline: story.title,
          description: story.description,
          url: `/stories/roles/${story.slug}`,
          datePublished: story.datePublished,
        })}
      />
      <SeoBreadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Roles', to: '/roles' },
          { label: t(`roleStoryPage.roleLabels.${story.role}`, { defaultValue: story.role }), to: `/roles/${story.role}` },
          { label: story.title },
        ]}
      />

      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        <header className="mb-10">
          <Link
            to={`/roles/${story.role}`}
            className="inline-flex items-center gap-2 text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.08)] px-3 py-1 rounded-full mb-4 hover:bg-[hsl(var(--marketing-blue)/0.12)] transition-colors"
          >
            <RoleIcon className="h-3.5 w-3.5" /> {t(`roleStoryPage.roleLabels.${story.role}`, { defaultValue: story.role })}
          </Link>
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

        {/* Opening */}
        <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] p-6 mb-10">
          <p className="text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed" style={serif}>
            {story.opening}
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-0">
          {story.timeline.map((moment, i) => (
            <div key={i} className="relative pl-8 pb-8 border-l-2 border-[hsl(var(--marketing-border))] last:border-transparent">
              <div className="absolute left-[-7px] top-1 w-3 h-3 rounded-full bg-[hsl(var(--marketing-blue)/0.3)] border-2 border-white" />
              <div className="rounded-xl border border-[hsl(var(--marketing-border))] bg-white p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.4)] uppercase tracking-wider">
                    {moment.time}
                  </span>
                  {moment.feature && (
                    <span className="text-xs text-[hsl(var(--marketing-navy)/0.35)] bg-[hsl(var(--marketing-surface))] px-2 py-0.5 rounded-full">
                      {moment.feature}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
                  {moment.title}
                </h3>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
                  {moment.narrative}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Reflection */}
        <div className="mt-8 rounded-2xl border-l-4 border-[hsl(var(--marketing-blue)/0.3)] bg-[hsl(var(--marketing-surface))] p-6">
          <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider mb-3">
            {t('roleStoryPage.reflectionLabel')}
          </h3>
          <p className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed" style={serif}>
            {story.reflection}
          </p>
        </div>

        {/* Closing */}
        <div className="mt-8 rounded-2xl bg-[hsl(var(--marketing-surface))] p-6">
          <p className="text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed italic" style={serif}>
            {story.closing}
          </p>
        </div>

        <div className="mt-12 text-center">
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {t('roleStoryPage.getStarted')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </article>

      <ConceptLinks conceptSlug={story.role} heading={t('roleStoryPage.relatedConceptsHeading')} />

      <SeoInternalLinks
        heading={t('roleStoryPage.seoLinksHeading')}
        links={[
          { label: t(`roleStoryPage.roleLabels.${story.role}`, { defaultValue: story.role }), to: `/roles/${story.role}`, description: `The ${t(`roleStoryPage.roleLabels.${story.role}`, { defaultValue: story.role })} experience.` },
          { label: 'All Roles', to: '/roles', description: 'Shepherd, Companion, or Visitor.' },
          { label: 'Archetypes', to: '/archetypes', description: 'Find your mission type.' },
        ]}
      />
    </div>
  );
}
