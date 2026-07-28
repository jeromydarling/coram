/**
 * WeekNarrativePage — "What a Week Looks Like" story page.
 *
 * WHAT: Renders a narrative week-in-the-life for a specific CROS™ role.
 * WHERE: /week/:slug
 * WHY: Human-centered storytelling that helps visitors recognize their role before signup.
 */
import { useParams, Navigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import { getWeekNarrativeBySlug, weekNarratives } from '@/content/weekNarratives';
import RelatedNarrativesCard from '@/components/marketing/RelatedNarrativesCard';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const roleSlugMap: Record<string, string> = {
  shepherd: 'shepherd',
  steward: 'steward',
  'catholic-visitor': 'visitor',
  'community-companion': 'companion',
  'social-outreach': 'visitor',
};

export default function WeekNarrativePage() {
  const { t } = useTranslation('marketing');
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const narrative = slug ? getWeekNarrativeBySlug(slug) : undefined;

  if (!narrative) return <Navigate to="/roles" replace />;

  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Roles', to: '/roles' },
    { label: narrative.title },
  ];

  const relatedRole = roleSlugMap[narrative.slug];

  return (
    <>
      <SeoHead
        title={narrative.seoTitle}
        description={narrative.seoDescription}
        canonical={`/week/${narrative.slug}`}
        jsonLd={[
          articleSchema({
            headline: narrative.title,
            description: narrative.seoDescription,
            url: `/week/${narrative.slug}`,
          }),
          breadcrumbSchema(crumbs.map((c) => ({ name: c.label, url: c.to ?? '' }))),
        ]}
      />
      <SeoBreadcrumb items={crumbs} />

      <div className="max-w-[680px] mx-auto px-4 sm:px-6 pb-20">
        {/* Hero */}
        <section className="pt-12 pb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-3">
            {t('weekNarrativePage.eyebrow')}
          </p>
          <h1
            className="text-3xl sm:text-4xl font-semibold text-[hsl(var(--marketing-navy))] mb-4"
            style={serif}
          >
            {narrative.title}
          </h1>
          <div className="inline-block bg-[hsl(var(--marketing-surface))] rounded-full px-4 py-1.5">
            <span className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.5)]">
              {narrative.role}
            </span>
          </div>
        </section>

        {/* Intro */}
        <section className="py-6">
          <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] p-6 sm:p-8">
            <p
              className="text-base text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed"
              style={serif}
            >
              {narrative.intro}
            </p>
          </div>
        </section>

        {/* Days */}
        <section className="py-4 space-y-4">
          {narrative.days.map((day) => (
            <article
              key={day.day}
              className="rounded-2xl bg-white border border-[hsl(var(--marketing-navy)/0.06)] p-6 sm:p-8"
            >
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)]">
                  {day.day}
                </span>
                <div className="flex-1 h-px bg-[hsl(var(--marketing-navy)/0.06)]" />
              </div>
              <h2
                className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3"
                style={serif}
              >
                {day.title}
              </h2>
              <p
                className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed"
                style={serif}
              >
                {day.body}
              </p>
            </article>
          ))}
        </section>

        {/* Closing Reflection */}
        <section className="py-8">
          <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] border border-[hsl(var(--marketing-navy)/0.06)] p-6 sm:p-8 text-center">
            <p
              className="text-lg text-[hsl(var(--marketing-navy))] font-medium italic leading-relaxed"
              style={serif}
            >
              "{narrative.closingReflection}"
            </p>
          </div>
        </section>

        {/* Related + CTA */}
        <section className="py-8 space-y-6">
          {relatedRole && (
            <div className="text-center">
              <Link to={`/path/${relatedRole}`}>
                <Button
                  variant="outline"
                  className="rounded-full border-[hsl(var(--marketing-navy)/0.15)] text-[hsl(var(--marketing-navy)/0.7)] hover:bg-[hsl(var(--marketing-surface))] px-6 h-10 text-sm"
                >
                  {t('weekNarrativePage.explorePathway', { role: narrative.role })}
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}

          {/* Other weeks */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-3 text-center">
              {t('weekNarrativePage.moreWeeksLabel')}
            </p>
            <div className="space-y-2">
              {weekNarratives
                .filter((n) => n.slug !== narrative.slug)
                .map((n) => (
                  <Link
                    key={n.slug}
                    to={`/week/${n.slug}`}
                    className="flex items-center justify-between rounded-xl bg-[hsl(var(--marketing-surface))] p-4 hover:bg-white transition-colors group"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]">
                        {n.title}
                      </span>
                      <span className="text-xs text-[hsl(var(--marketing-navy)/0.4)] ml-2">
                        {n.role}
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.25)] group-hover:text-[hsl(var(--marketing-navy)/0.5)] transition-colors flex-shrink-0" />
                  </Link>
                ))}
            </div>
          </div>
        </section>

        {/* Related narratives from content graph */}
        <RelatedNarrativesCard currentPath={location.pathname} />

        {/* Final CTA */}
        <section className="py-8 text-center">
          <Link to="/pricing">
            <Button className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-6 h-11 text-sm">
              {t('weekNarrativePage.beginRhythm')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </section>
      </div>
    </>
  );
}
