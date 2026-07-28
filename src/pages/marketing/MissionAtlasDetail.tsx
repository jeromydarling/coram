/**
 * MissionAtlasDetail — Dynamic detail page for a single atlas entry.
 *
 * WHAT: Renders the full narrative for one archetype × metro-type combination.
 * WHERE: /mission-atlas/:id (public marketing route).
 * WHY: Creates deep SEO clusters for mission-specific search queries.
 */
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Compass, MapPin, Users, BookOpen, ExternalLink } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import NarrativeGraphLinks from '@/components/marketing/NarrativeGraphLinks';
import NarrativeLinks from '@/components/marketing/NarrativeLinks';
import { getAtlasEntry, getArchetypeDisplay, getMetroTypeDisplay } from '@/content/missionAtlas';
import { getAppsForAtlasEntry } from '@/content/atlasAppMap';
import { getArchetypeRelatedNodes } from '@/content/narrativeGraph';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const ROLE_PATHS: Record<string, string> = {
  shepherd: '/roles/shepherd',
  companion: '/roles/companion',
  visitor: '/roles/visitor',
  steward: '/roles/steward',
};

export default function MissionAtlasDetail() {
  const { t } = useTranslation('marketing');
  const { id } = useParams<{ id: string }>();
  const entry = id ? getAtlasEntry(id) : undefined;

  if (!entry) return <Navigate to="/mission-atlas" replace />;

  const archLabel = getArchetypeDisplay(entry.archetype);
  const metroLabel = getMetroTypeDisplay(entry.metroType);
  const title = `${archLabel} in ${metroLabel} Communities`;
  const graphNodes = getArchetypeRelatedNodes(entry.archetype);

  // Federation satellite apps that serve this archetype × metro-type pattern.
  const federationApps = getAppsForAtlasEntry(entry.archetype, entry.metroType).slice(0, 6);
  const itemListSchema = federationApps.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Federation apps serving ${archLabel} in ${metroLabel.toLowerCase()} communities`,
        itemListElement: federationApps.map((app, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: app.display_name,
          description: app.tagline,
          url: `https://${app.primary_domain}`,
        })),
      }
    : null;

  return (
    <article>
      <SeoHead
        title={title}
        description={entry.narrative.slice(0, 155)}
        keywords={[entry.archetype, entry.metroType, 'mission patterns', 'CROS', 'community relationship']}
        canonical={`/mission-atlas/${entry.id}`}
        ogType="article"
        jsonLd={[
          articleSchema({
            headline: title,
            description: entry.narrative.slice(0, 155),
            url: `/mission-atlas/${entry.id}`,
          }),
          {
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: `${metroLabel} mission context`,
            description: `How ${archLabel} organizations operate in ${metroLabel.toLowerCase()} communities.`,
          },
          breadcrumbSchema([
            { name: 'CROS', url: '/' },
            { name: 'Mission Atlas', url: '/mission-atlas' },
            { name: title, url: `/mission-atlas/${entry.id}` },
          ]),
          ...(itemListSchema ? [itemListSchema] : []),
        ]}
      />

      <SeoBreadcrumb items={[
        { label: 'CROS', to: '/' },
        { label: 'Mission Atlas', to: '/mission-atlas' },
        { label: `${archLabel} · ${metroLabel}` },
      ]} />

      {/* Header */}
      <header className="max-w-[720px] mx-auto px-4 sm:px-6 pt-8 pb-10">
        <Link
          to="/mission-atlas"
          className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--marketing-navy)/0.45)] hover:text-[hsl(var(--marketing-navy))] mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Atlas
        </Link>

        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] bg-[hsl(var(--marketing-surface))] px-2 py-0.5 rounded-full">
            <Compass className="h-3 w-3" />
            {archLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] bg-[hsl(var(--marketing-surface))] px-2 py-0.5 rounded-full">
            <MapPin className="h-3 w-3" />
            {metroLabel}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
          {title}
        </h1>
      </header>

      {/* Main Narrative */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
        <p className="text-base text-[hsl(var(--marketing-navy)/0.7)] leading-[1.8]" style={serif}>
          {entry.narrative}
        </p>
      </section>

      {/* Themes */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-3">
          Themes in this context
        </h2>
        <div className="flex flex-wrap gap-2">
          {entry.themes.map((t) => (
            <span
              key={t}
              className="text-xs text-[hsl(var(--marketing-navy)/0.55)] border border-[hsl(var(--marketing-border))] rounded-full px-3 py-1"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Roles in this pattern */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-3">
          <Users className="h-3.5 w-3.5 inline mr-1" />
          Roles present
        </h2>
        <div className="flex flex-wrap gap-2">
          {entry.roles.map((role) => (
            <Link
              key={role}
              to={ROLE_PATHS[role] || '/roles'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-surface))] px-3 py-1.5 rounded-full hover:bg-white border border-transparent hover:border-[hsl(var(--marketing-border))] transition-colors"
            >
              {t(`roleStoryPage.roleLabels.${role}`, { defaultValue: role })}
            </Link>
          ))}
        </div>
      </section>

      {/* Signal Narrative */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
        <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
            Signals in this context
          </h2>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
            {archLabel} organizations in {metroLabel.toLowerCase()} settings often experience strong{' '}
            {entry.signals.slice(0, 2).join(' and ').replace(/_/g, ' ')} signals
            when teams maintain consistent relational rhythms.
            These patterns emerge not from tracking but from presence.
          </p>
        </div>
      </section>

      {/* Federation apps serving this pattern */}
      {federationApps.length > 0 && (
        <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-3">
            Federation apps serving this pattern
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {federationApps.map((app) => (
              <a
                key={app.app_slug}
                href={`https://${app.primary_domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-6 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
              >
                <span className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1 inline-flex items-center gap-1" style={serif}>
                  {app.display_name}
                  <ExternalLink className="h-3 w-3 text-[hsl(var(--marketing-blue)/0.5)] shrink-0" />
                </span>
                <span className="text-xs text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-3">
                  {app.tagline}
                </span>
                <span className="mt-auto text-xs font-medium text-[hsl(var(--marketing-blue))] group-hover:underline">
                  Visit {app.display_name} — {app.tagline}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Week-in-the-Life link */}
      {entry.weekLink && (
        <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
          <Link
            to={entry.weekLink}
            className="flex items-center gap-3 rounded-xl bg-white border border-[hsl(var(--marketing-border))] p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] transition-colors group"
          >
            <BookOpen className="h-4 w-4 text-[hsl(var(--marketing-blue)/0.5)] shrink-0" />
            <div>
              <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]" style={serif}>
                See a Week in the Life
              </span>
              <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)]">
                Experience what this mission pattern looks like day by day.
              </p>
            </div>
          </Link>
        </section>
      )}

      {/* Graph links */}
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <NarrativeGraphLinks nodes={graphNodes} heading={t('missionAtlasDetail.graphLinksHeading')} />
      </div>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <NarrativeLinks currentPath={`/mission-atlas/${entry.id}`} />
      </div>

      <SeoInternalLinks
        heading={t('featurePage.seoLinksHeading')}
        links={[
          { label: 'Mission Atlas', to: '/mission-atlas', description: 'See all mission patterns.' },
          { label: 'Archetypes', to: '/archetypes', description: 'Find your mission type.' },
          { label: 'NRI', to: '/nri', description: 'Narrative Relational Intelligence.' },
          { label: 'Roles', to: '/roles', description: 'Shepherd, Companion, Visitor, Steward.' },
        ]}
      />
    </article>
  );
}
