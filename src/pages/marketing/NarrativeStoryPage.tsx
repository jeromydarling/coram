/**
 * NarrativeStoryPage — Public page for operator-published narrative stories.
 *
 * WHAT: Renders a published narrative_stories row at /stories/:slug.
 * WHERE: /stories/:slug (falls through from static stories to DB lookup).
 * WHY: Living Narrative Index — stories curated by operators from real signals.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Compass, HeartHandshake, MapPin, Shield } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import ConceptLinks from '@/components/seo/ConceptLinks';
import { articleSchema } from '@/lib/seo/seoConfig';
import { ROLE_GRAPH } from '@/lib/seo/roleGraph';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  shepherd: Compass,
  companion: HeartHandshake,
  visitor: MapPin,
  steward: Shield,
};
interface NarrativeStoryPageProps {
  /** If provided, skip DB fetch — used when static story already matched */
  skipDbLookup?: boolean;
}

export default function NarrativeStoryPage({ skipDbLookup }: NarrativeStoryPageProps) {
  const { t } = useTranslation('marketing');
  const { slug } = useParams<{ slug: string }>();

  const { data: story, isLoading, error } = useQuery({
    queryKey: ['narrative-story', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_stories')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug && !skipDbLookup,
    retry: false,
  });

  if (skipDbLookup) return null;

  if (isLoading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-16 space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!story || error) {
    return <Navigate to="/" replace />;
  }

  const RoleIcon = story.role ? roleIcons[story.role] : null;
  const roleLabel = story.role ? t(`roleStoryPage.roleLabels.${story.role}`, { defaultValue: story.role }) : null;
  const roleNode = story.role ? ROLE_GRAPH[story.role] : null;
  const bodyParagraphs = (story.body || '').split('\n').filter((p: string) => p.trim());

  return (
    <div className="bg-white">
      <SeoHead
        title={story.title}
        description={story.summary}
        canonical={`/stories/${story.slug}`}
        ogType="article"
        jsonLd={articleSchema({
          headline: story.title,
          description: story.summary,
          url: `/stories/${story.slug}`,
          datePublished: story.created_at,
        })}
      />

      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        <header className="mb-10">
          <SeoBreadcrumb
            items={[
              { label: 'Home', to: '/' },
              { label: 'Stories' },
              { label: story.title },
            ]}
          />
          <div className="flex gap-2 mb-4 flex-wrap">
            {roleLabel && RoleIcon && (
              <Link
                to={`/roles/${story.role}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.08)] px-3 py-1 rounded-full hover:bg-[hsl(var(--marketing-blue)/0.12)] transition-colors"
              >
                <RoleIcon className="h-3.5 w-3.5" /> {roleLabel}
              </Link>
            )}
            {story.archetype && (
              <span className="inline-block text-xs font-medium text-[hsl(var(--marketing-navy)/0.5)] bg-[hsl(var(--marketing-surface))] px-3 py-1 rounded-full">
                {story.archetype}
              </span>
            )}
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-3"
            style={serif}
          >
            {story.title}
          </h1>
          <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
            {story.summary}
          </p>
        </header>

        {/* Body */}
        <div className="space-y-5">
          {bodyParagraphs.map((p: string, i: number) => (
            <p
              key={i}
              className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed"
              style={serif}
            >
              {p}
            </p>
          ))}
        </div>

        {/* Role context block */}
        {roleNode && (
          <div className="mt-10 rounded-2xl bg-[hsl(var(--marketing-surface))] p-6">
            <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider mb-3">
              {roleLabel} in CROS™
            </h3>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] mb-3">
              {roleNode.motto} — {roleNode.modules.map((m) => m.name).join(', ')}.
            </p>
            <Link
              to={`/roles/${story.role}`}
              className="text-sm text-[hsl(var(--marketing-blue))] hover:underline"
            >
              Learn more about the {roleLabel} experience →
            </Link>
          </div>
        )}

        {/* CTA */}
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

      <ConceptLinks conceptSlug={story.role || 'nri'} heading={t('roleDeepPage.relatedConceptsHeading')} />

      <SeoInternalLinks
        heading={t('featurePage.seoLinksHeading')}
        links={[
          ...(story.role ? [{ label: t(`roleStoryPage.roleLabels.${story.role}`, { defaultValue: story.role }), to: `/roles/${story.role}`, description: `The ${t(`roleStoryPage.roleLabels.${story.role}`, { defaultValue: story.role })} experience.` }] : []),
          { label: 'Archetypes', to: '/archetypes', description: 'See every mission archetype.' },
          { label: 'NRI', to: '/nri', description: 'Narrative Relational Intelligence explained.' },
        ]}
      />
    </div>
  );
}
