/**
 * ArchetypeDeepPage — Deep semantic hub for each archetype at /archetypes/:slug/deep.
 *
 * WHAT: Identity block + week narrative + role lenses + add-on relevance + soft CTA.
 * WHERE: /archetypes/:slug/deep
 * WHY: Creates gravitational center connecting roles, NRI, pricing, and stories.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, Compass, HeartHandshake, MapPin, BookOpen } from 'lucide-react';
import { archetypes, type ArchetypeKey } from '@/config/brand';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import RoleIdentityBlock from '@/components/seo/RoleIdentityBlock';
import ConceptLinks from '@/components/seo/ConceptLinks';
import { articleSchema } from '@/lib/seo/seoConfig';
import { stories } from '@/content/stories';
import { insights } from '@/content/insights';
import { useArchetypeCapture } from '@/hooks/useArchetypeCapture';
import LivingArchetypeStoryCard from '@/components/marketing/LivingArchetypeStoryCard';
import NarrativeGraphLinks from '@/components/marketing/NarrativeGraphLinks';
import { getArchetypeRelatedNodes, definedTermSchema } from '@/content/narrativeGraph';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const weekRoutes: Partial<Record<string, string>> = {
  church: '/archetypes/church-week',
  digital_inclusion: '/archetypes/nonprofit-week',
  social_enterprise: '/archetypes/social-enterprise-week',
  refugee_support: '/archetypes/community-network-week',
  workforce: '/archetypes/ministry-outreach-week',
  caregiver_solo: '/archetypes/caregiver-solo-week',
  caregiver_agency: '/archetypes/caregiver-agency-week',
  missionary_org: '/archetypes/missionary-org-week',
};

const roleLensesConfig = [
  { roleKey: 'shepherd', lensKey: 'shepherd', Icon: Compass, to: '/roles/shepherd' },
  { roleKey: 'companion', lensKey: 'companion', Icon: HeartHandshake, to: '/roles/companion' },
  { roleKey: 'visitor', lensKey: 'visitor', Icon: MapPin, to: '/roles/visitor' },
] as const;

const addOnsConfig = [
  { nameKey: 'testimonium' as const, tierKey: 'insight' as const },
  { nameKey: 'impulsus' as const, tierKey: 'story' as const },
  { nameKey: 'relatio' as const, tierKey: 'bridge' as const },
];

export default function ArchetypeDeepPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation('marketing');
  useArchetypeCapture();

  const archKey = slug as ArchetypeKey;
  const arch = archetypes[archKey];
  if (!arch) return <Navigate to="/archetypes" replace />;

  const weekRoute = weekRoutes[archKey];
  const relatedStories = stories.filter((s) => s.archetypeKey === archKey);
  const relatedInsights = insights.filter((i) => i.suggestedArchetype === archKey);

  return (
    <div className="bg-white">
      <SeoHead
        title={`${arch.name} — Deep Dive`}
        description={`How ${arch.name} organizations use CROS™ to remember relationships, notice community shifts, and serve with narrative intelligence.`}
        keywords={[arch.name.toLowerCase(), 'CROS archetype', 'community relationship OS', 'narrative intelligence']}
        canonical={`/archetypes/${slug}/deep`}
        ogType="article"
        jsonLd={[
          articleSchema({
            headline: `${arch.name} — A Deep Dive into CROS™`,
            description: arch.tagline,
            url: `/archetypes/${slug}/deep`,
          }),
          {
            '@context': 'https://schema.org',
            '@type': 'DefinedTerm',
            name: arch.name,
            description: arch.tagline,
            inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'CROS™ Mission Archetypes' },
          },
        ]}
      />
      <SeoBreadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Archetypes', to: '/archetypes' },
          { label: arch.name },
        ]}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Identity block */}
        <header className="mb-14">
          <p className="text-sm font-medium tracking-widest uppercase text-[hsl(var(--marketing-navy)/0.4)] mb-3">
            {t('archetypeDeepPage.eyebrow')}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
            {arch.name}
          </h1>
          <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-2xl">
            {arch.tagline}
          </p>
        </header>

        {/* Week Inside link */}
        {weekRoute && (
          <div className="mb-10 rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))] p-6">
            <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
              {t('archetypeDeepPage.weekInsideHeading')}
            </h2>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] mb-4">
              {t('archetypeDeepPage.weekInsideBody', { archetype: arch.name.toLowerCase() })}
            </p>
            <Link to={weekRoute}>
              <Button
                variant="outline"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy)/0.7)] hover:text-[hsl(var(--marketing-navy))]"
              >
                <BookOpen className="mr-2 h-4 w-4" /> {t('archetypeDeepPage.readFullWeek')}
              </Button>
            </Link>
          </div>
        )}
        {/* Living Signals from the Field */}
        <LivingArchetypeStoryCard archetypeKey={archKey} />

        {/* Role lenses */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('archetypeDeepPage.threeLensesHeading')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {roleLensesConfig.map(({ roleKey, lensKey, Icon, to }) => (
              <Link
                key={roleKey}
                to={to}
                className="group rounded-xl border border-[hsl(var(--marketing-border))] p-5 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
              >
                <Icon className="h-5 w-5 text-[hsl(var(--marketing-blue))] mb-3" />
                <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">{t(`roleSelector.roles.${roleKey}`)}</h3>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed">{t(`archetypeDeepPage.roleLenses.${lensKey}.lens`)}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Add-on relevance block */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('archetypeDeepPage.extendAddOnsHeading')}
          </h2>
          <div className="space-y-2.5">
            {addOnsConfig.map(({ nameKey, tierKey }) => (
              <div
                key={nameKey}
                className="flex items-center justify-between rounded-xl border border-[hsl(var(--marketing-border))] bg-white px-5 py-3"
              >
                <div>
                  <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]">{nameKey.charAt(0).toUpperCase() + nameKey.slice(1)}</span>
                  <span className="text-xs text-[hsl(var(--marketing-navy)/0.45)] ml-2">{t(`archetypeDeepPage.addOns.${nameKey}`)}</span>
                </div>
                <span className="text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.08)] px-2.5 py-1 rounded-full">
                  {t(`archetypeDeepPage.addOnTiers.${tierKey}`)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Related stories */}
        {relatedStories.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
              {t('archetypeDeepPage.storiesHeading')}
            </h2>
            <div className="space-y-3">
              {relatedStories.map((s) => (
                <Link
                  key={s.slug}
                  to={`/stories/${s.slug}`}
                  className="block rounded-xl border border-[hsl(var(--marketing-border))] p-5 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
                >
                  <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy))]">{s.title}</h3>
                  <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] mt-1">{s.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related insights */}
        {relatedInsights.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
              {t('archetypeDeepPage.insightsHeading')}
            </h2>
            <div className="space-y-3">
              {relatedInsights.map((i) => (
                <Link
                  key={i.slug}
                  to={`/insights/${i.slug}`}
                  className="block rounded-xl border border-[hsl(var(--marketing-border))] p-5 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
                >
                  <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy))]">{i.title}</h3>
                  <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] mt-1">{i.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Role identity block */}
        <RoleIdentityBlock heading={t('archetypesPage.roleIdentityHeading')} />

        {/* Soft CTA */}
        <div className="mt-10 text-center">
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {t('archetypeDeepPage.seePricing')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <ConceptLinks conceptSlug="cros" heading={t('roleDeepPage.relatedConceptsHeading')} />

      {/* Narrative Graph — semantic connections */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <NarrativeGraphLinks nodes={getArchetypeRelatedNodes(archKey)} />
      </div>

      <SeoInternalLinks
        heading={t('archetypeDeepPage.seoLinks.heading')}
        links={[
          { label: t('archetypeDeepPage.seoLinks.allArchetypes'), to: '/archetypes', description: t('archetypeDeepPage.seoLinks.allArchetypesDesc') },
          { label: t('archetypeDeepPage.seoLinks.nri'), to: '/nri', description: t('archetypeDeepPage.seoLinks.nriDesc') },
          { label: t('archetypeDeepPage.seoLinks.signals'), to: '/signals', description: t('archetypeDeepPage.seoLinks.signalsDesc') },
          { label: t('archetypeDeepPage.seoLinks.roles'), to: '/roles', description: t('archetypeDeepPage.seoLinks.rolesDesc') },
          { label: t('archetypeDeepPage.seoLinks.pricing'), to: '/pricing', description: t('archetypeDeepPage.seoLinks.pricingDesc') },
        ]}
      />
    </div>
  );
}
