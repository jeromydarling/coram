/**
 * MetroPublicPage — Public civic narrative page for a metro area.
 *
 * WHAT: Renders aggregated civic patterns for a metro slug.
 * WHERE: /metros/:metroSlug (public marketing route).
 * WHY: SEO gravity for civic communities — NO tenant data exposed.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Compass, HeartHandshake, MapPin, TrendingUp, Users, Feather } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import CivicGravityBlock from '@/components/marketing/CivicGravityBlock';
import NarrativePulseStrip from '@/components/marketing/NarrativePulseStrip';
import NarrativeCTA from '@/components/marketing/NarrativeCTA';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const momentumDescriptions: Record<string, string> = {
  Strong: 'vibrant and growing, with deep community roots forming across sectors.',
  Growing: 'building steadily, as new partnerships and events take shape.',
  Steady: 'maintaining a thoughtful rhythm, with consistent presence and relationships.',
  Resting: 'in a season of quiet foundation — the groundwork for future movement.',
};

export default function MetroPublicPage() {
  const { t } = useTranslation('marketing');
  const { metroSlug } = useParams<{ metroSlug: string }>();

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['public-metro-page', metroSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_metro_pages')
        .select('*')
        .eq('slug', metroSlug)
        .eq('status', 'published')
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!metroSlug,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-16 space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!page || error) {
    return <Navigate to="/" replace />;
  }

  const archetypes: string[] = Array.isArray(page.archetypes_active) ? (page.archetypes_active as unknown as string[]) : [];
  const metroTitle = page.display_name || metroSlug?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Community';

  return (
    <div className="bg-white">
      <SeoHead
        title={`${metroTitle} — Civic Patterns from the CROS™ Network`}
        description={page.summary || `Discover how community organizations are growing in ${metroTitle}.`}
        canonical={`/metros/${page.slug}`}
        ogType="article"
        jsonLd={[
          articleSchema({
            headline: `${metroTitle} — Civic Patterns`,
            description: page.summary,
            url: `/metros/${page.slug}`,
          }),
          {
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: metroTitle,
            description: page.summary,
          },
        ]}
      />

      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        {/* Opening Narrative */}
        <header className="mb-10">
          <SeoBreadcrumb
            items={[
              { label: 'Home', to: '/' },
              { label: 'Metros' },
              { label: metroTitle },
            ]}
          />
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
              Civic Narrative
            </span>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4"
            style={serif}
          >
            {metroTitle}
          </h1>
          <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>
            {page.summary || `What we're learning about community life in ${metroTitle}.`}
          </p>
        </header>

        {/* Archetypes active here */}
        {archetypes.length > 0 && (
          <section className="mb-10">
            <h2
              className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider mb-3"
            >
              Mission archetypes active here
            </h2>
            <div className="flex gap-2 flex-wrap">
              {archetypes.map((a: string) => (
                <Link
                  key={a}
                  to={`/metros/${page.slug}/${a.toLowerCase().replace(/\s+/g, '-')}`}
                  className="no-underline"
                >
                  <Badge
                    variant="outline"
                    className="text-xs px-3 py-1 hover:bg-[hsl(var(--marketing-blue)/0.08)] transition-colors cursor-pointer"
                  >
                    {a}
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Current Momentum */}
        <section className="mb-10 rounded-2xl bg-[hsl(var(--marketing-surface))] p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
            <h2 className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider">
              Current Momentum
            </h2>
          </div>
          <p className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed" style={serif}>
            {page.momentum_summary || `The pulse of ${metroTitle} is ${momentumDescriptions['Steady']}`}
          </p>
        </section>

        {/* Narrative Summary */}
        {page.narrative_summary && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <Compass className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
              <h2 className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider">
                What's emerging
              </h2>
            </div>
            <p className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed" style={serif}>
              {page.narrative_summary}
            </p>
          </section>
        )}

        {/* Volunteer Patterns */}
        {page.volunteer_patterns && (
          <section className="mb-10 rounded-2xl bg-[hsl(var(--marketing-surface))] p-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
              <h2 className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider">
                Volunteer Patterns
              </h2>
            </div>
            <p className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed" style={serif}>
              {page.volunteer_patterns}
            </p>
          </section>
        )}

        {/* Reflection Block */}
        {page.reflection_block && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <Feather className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
              <h2 className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider">
                A Reflection
              </h2>
            </div>
            <blockquote
              className="border-l-2 border-[hsl(var(--marketing-blue)/0.3)] pl-4 text-[hsl(var(--marketing-navy)/0.55)] italic leading-relaxed"
              style={serif}
            >
              {page.reflection_block}
            </blockquote>
          </section>
        )}

      </article>

      {/* Civic Gravity Block */}
      <CivicGravityBlock metroSlug={metroSlug} />

      {/* Narrative Pulse */}
      <NarrativePulseStrip />

      {/* Quiet CTA */}
      <NarrativeCTA variant="begin_rhythm" />

      <SeoInternalLinks
        heading={t('featurePage.seoLinksHeading')}
        links={[
          { label: 'Archetypes', to: '/archetypes', description: 'See every mission archetype.' },
          { label: 'Roles', to: '/roles', description: 'Discover how roles shape community work.' },
          { label: 'NRI', to: '/nri', description: 'Narrative Relational Intelligence explained.' },
        ]}
      />
    </div>
  );
}
