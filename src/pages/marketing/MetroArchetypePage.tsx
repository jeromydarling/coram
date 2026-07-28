/**
 * MetroArchetypePage — Archetype lens on a specific metro.
 *
 * WHAT: Shows what a particular archetype looks like in a metro area.
 * WHERE: /metros/:metroSlug/:archetypeSlug (public marketing route).
 * WHY: Deep semantic pages connecting place + mission identity for SEO gravity.
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
import CivicGravityBlock from '@/components/marketing/CivicGravityBlock';
import NarrativePulseStrip from '@/components/marketing/NarrativePulseStrip';
import NarrativeCTA from '@/components/marketing/NarrativeCTA';
import { articleSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const archetypeLabels: Record<string, string> = {
  'church': 'Church & Faith Community',
  'digital-inclusion': 'Digital Inclusion Nonprofit',
  'social-enterprise': 'Social Enterprise',
  'workforce-development': 'Workforce Development',
  'refugee-support': 'Refugee Support',
  'education-access': 'Education Access',
  'library-system': 'Library System',
  'housing-shelter': 'Housing & Shelter',
  'parish-outreach': 'Parish Outreach',
};

const roleViews = [
  { key: 'shepherd', label: 'Shepherd', icon: Compass, perspective: "Shepherds in this context carry the relational memory of the community — knowing who needs follow-up, who's been quiet, and where new connections are forming." },
  { key: 'companion', label: 'Companion', icon: HeartHandshake, perspective: "Companions walk alongside partners through daily rhythms — coordinating provisions, tracking needs, and ensuring no one falls through the cracks." },
  { key: 'visitor', label: 'Visitor', icon: MapPin, perspective: "Visitors bring the gift of presence — capturing voice notes from the field, recording observations, and bringing back stories that inform the wider team." },
  { key: 'steward', label: 'Steward', icon: Shield, perspective: "Stewards ensure the system runs with integrity — reviewing reports, managing configurations, and keeping the mission aligned with its values." },
];

export default function MetroArchetypePage() {
  const { t } = useTranslation('marketing');
  const { metroSlug, archetypeSlug } = useParams<{ metroSlug: string; archetypeSlug: string }>();

  const { data: page, isLoading } = useQuery({
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

  if (!page) return <Navigate to="/" replace />;

  const metroTitle = page.display_name || metroSlug?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Community';
  const archetypeLabel = archetypeLabels[archetypeSlug || ''] || archetypeSlug?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Community';

  return (
    <div className="bg-white">
      <SeoHead
        title={`${archetypeLabel} in ${metroTitle} — CROS™`}
        description={`How ${archetypeLabel.toLowerCase()} organizations experience community life in ${metroTitle}.`}
        canonical={`/metros/${metroSlug}/${archetypeSlug}`}
        ogType="article"
        jsonLd={articleSchema({
          headline: `${archetypeLabel} in ${metroTitle}`,
          description: `How ${archetypeLabel.toLowerCase()} organizations experience community life in ${metroTitle}.`,
          url: `/metros/${metroSlug}/${archetypeSlug}`,
        })}
      />
      <SeoBreadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Metros' },
          { label: metroTitle, to: `/metros/${metroSlug}` },
          { label: archetypeLabel },
        ]}
      />

      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
              {metroTitle} · Archetype Lens
            </span>
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4"
            style={serif}
          >
            {archetypeLabel} in {metroTitle}
          </h1>
          <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
            What does a {archetypeLabel.toLowerCase()} look like in {metroTitle}?
            Here's what patterns from the CROS™ network reveal.
          </p>
        </header>

        {/* Common Rhythms */}
        <section className="mb-10 rounded-2xl bg-[hsl(var(--marketing-surface))] p-6">
          <h2 className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider mb-3">
            Common Rhythms
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed" style={serif}>
            Organizations of this type in {metroTitle} tend to operate in weekly and seasonal cycles —
            planning outreach events, coordinating volunteer schedules, and building relationships
            that deepen over time rather than rushing toward transactional outcomes.
          </p>
        </section>

        {/* Role Perspectives */}
        <section className="mb-10 space-y-4">
          <h2 className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider">
            Role Perspectives
          </h2>
          {roleViews.map((role) => {
            const Icon = role.icon;
            return (
              <div key={role.key} className="rounded-2xl border border-[hsl(var(--marketing-navy)/0.08)] p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
                  <Link
                    to={`/roles/${role.key}`}
                    className="text-sm font-semibold text-[hsl(var(--marketing-navy))] hover:text-[hsl(var(--marketing-blue))] transition-colors"
                  >
                    {role.label}
                  </Link>
                </div>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>
                  {role.perspective}
                </p>
              </div>
            );
          })}
        </section>

      </article>

      {/* Civic Gravity */}
      <CivicGravityBlock metroSlug={metroSlug} archetypeSlug={archetypeSlug} />

      {/* Narrative Pulse */}
      <NarrativePulseStrip />

      {/* Quiet CTA */}
      <NarrativeCTA variant="walk_first_week" />

      <SeoInternalLinks
        heading={t('featurePage.seoLinksHeading')}
        links={[
          { label: metroTitle, to: `/metros/${metroSlug}`, description: `Back to ${metroTitle} civic narrative.` },
          { label: 'Archetypes', to: '/archetypes', description: 'See every mission archetype.' },
          { label: 'Roles', to: '/roles', description: 'Discover how roles shape community work.' },
        ]}
      />
    </div>
  );
}
