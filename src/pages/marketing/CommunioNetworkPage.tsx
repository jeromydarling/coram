/**
 * CommunioNetworkPage — Public Communio network theme pages.
 *
 * WHAT: Displays anonymized civic collaboration themes from the Communio network.
 * WHERE: /network/:themeSlug
 * WHY: Shows movement-level authority without exposing private data.
 */
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import CivicSignalBlock from '@/components/marketing/CivicSignalBlock';
import type { ArchetypeKey } from '@/config/brand';
import { archetypes } from '@/config/brand';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface NetworkTheme {
  title: string;
  description: string;
  seoDesc: string;
  narrative: string;
  themes: string[];
  archetypes: ArchetypeKey[];
  signals: string[];
}

const networkThemes: Record<string, NetworkTheme> = {
  'shared-outreach': {
    title: 'Shared Outreach',
    description: 'When organizations in the same region discover they are reaching the same communities — and begin to move together.',
    seoDesc: 'Shared outreach patterns across the CROS\u2122 network — how organizations discover alignment through anonymized civic signals.',
    narrative: 'Shared outreach emerges naturally when multiple organizations serve overlapping communities. Through Communio, these patterns become visible without compromising anyone\u2019s privacy. What was once invisible coordination becomes a gentle current of shared purpose.',
    themes: ['Home visitation', 'Community events', 'Volunteer coordination', 'Resource sharing'],
    archetypes: ['church', 'refugee_support', 'social_enterprise'],
    signals: [
      'Multiple organizations in the same metro are focusing on home visits this season.',
      'Volunteer engagement patterns are converging across three archetypes.',
      'Community event frequency has increased in neighborhoods where outreach teams are active.',
    ],
  },
  'civic-convergence': {
    title: 'Civic Convergence',
    description: 'The moment when separate missions begin to align — not through planning, but through the natural gravity of shared place and purpose.',
    seoDesc: 'Civic convergence patterns in the CROS\u2122 network — how missions naturally align through shared place and purpose.',
    narrative: 'Civic convergence is not orchestrated. It happens when organizations rooted in the same neighborhoods begin to notice the same needs, respond to the same signals, and gradually create a fabric of care that no single mission could weave alone.',
    themes: ['Metro-level patterns', 'Cross-archetype alignment', 'Seasonal rhythms', 'Shared momentum'],
    archetypes: ['digital_inclusion', 'workforce', 'library_system'],
    signals: [
      'Three different archetype communities are reporting similar engagement patterns this quarter.',
      'Metro momentum scores are rising in regions with active Communio groups.',
      'Seasonal volunteer availability patterns are consistent across the network.',
    ],
  },
  'narrative-solidarity': {
    title: 'Narrative Solidarity',
    description: 'Stories that echo across organizations — the same themes surfacing in different contexts, revealing that the work is connected even when the workers don\u2019t know each other.',
    seoDesc: 'Narrative solidarity across the CROS\u2122 network — shared storytelling themes that reveal the connectedness of community work.',
    narrative: 'When a church in one city and a workforce program in another both report the same pattern — families struggling with transportation, or volunteers declining in the same season — that\u2019s not coincidence. That\u2019s narrative solidarity. CROS\u2122 makes these echoes visible.',
    themes: ['Thematic resonance', 'Cross-metro patterns', 'Storytelling', 'Impact visibility'],
    archetypes: ['church', 'education_access', 'workforce'],
    signals: [
      'Testimonium narratives across multiple organizations are surfacing transportation as a recurring theme.',
      'Reflection patterns suggest that relationship fatigue peaks at similar times across archetypes.',
      'Impact storytelling themes are converging around community resilience this season.',
    ],
  },
};

const validSlugs = Object.keys(networkThemes);

export default function CommunioNetworkPage() {
  const { t } = useTranslation('marketing');
  const { themeSlug } = useParams<{ themeSlug: string }>();

  if (!themeSlug || !validSlugs.includes(themeSlug)) {
    return <Navigate to="/roles" replace />;
  }

  const data = networkThemes[themeSlug];
  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Network', to: '/roles' },
    { label: data.title },
  ];

  return (
    <>
      <SeoHead
        title={`${data.title} — CROS\u2122 Network`}
        description={data.seoDesc}
        canonical={`/network/${themeSlug}`}
        jsonLd={[
          articleSchema({ headline: data.title, description: data.seoDesc, url: `/network/${themeSlug}` }),
          breadcrumbSchema(crumbs.map(c => ({ name: c.label, url: c.to ?? '' }))),
        ]}
      />
      <SeoBreadcrumb items={crumbs} />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-20">
        <section className="pt-10 pb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--marketing-surface))] rounded-full px-4 py-1.5 mb-4">
            <Users className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.4)]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
              {t('communioNetworkPage.networkLabel')}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
            {data.title}
          </h1>
          <p className="text-base text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-lg mx-auto" style={serif}>
            {data.description}
          </p>
        </section>

        {/* Narrative */}
        <section className="py-6">
          <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] p-6 sm:p-8">
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>
              {data.narrative}
            </p>
          </div>
        </section>

        {/* Civic themes */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('communioNetworkPage.civicThemesHeading')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.themes.map((t) => (
              <span key={t} className="inline-block bg-[hsl(var(--marketing-surface))] text-[hsl(var(--marketing-navy)/0.6)] px-4 py-2 rounded-full text-sm border border-[hsl(var(--marketing-navy)/0.08)]">
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* Network signals */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('communioNetworkPage.signalsHeading')}
          </h2>
          <ul className="space-y-3">
            {data.signals.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.25)] flex-shrink-0" />
                <span className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Participating archetypes */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('communioNetworkPage.participatingArchetypesHeading')}
          </h2>
          <div className="space-y-3">
            {data.archetypes.map((key) => {
              const arch = archetypes[key];
              if (!arch) return null;
              return (
                <Link key={key} to={`/archetypes/${key}/deep`} className="block rounded-xl bg-[hsl(var(--marketing-surface))] p-5 hover:bg-white transition-colors">
                  <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">{arch.name}</h3>
                  <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)]">{arch.tagline}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Civic signals from DB */}
        <CivicSignalBlock />

        {/* Quiet CTA */}
        <section className="py-12 text-center">
          <h3 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
            {t('communioNetworkPage.ctaHeading')}
          </h3>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-6">
            {t('communioNetworkPage.ctaBody')}
          </p>
          <Link to="/pricing">
            <Button className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-6 h-11 text-sm">
              {t('communioNetworkPage.ctaButton')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </section>
      </div>
    </>
  );
}
