/**
 * MissionAtlas — Public-facing narrative map of mission patterns.
 *
 * WHAT: Renders curated atlas cards showing how different missions operate across contexts.
 * WHERE: /mission-atlas (public marketing route).
 * WHY: Builds semantic SEO authority around mission work without exposing tenant data.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MapPin, Compass, BookOpen } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import NarrativeLinks from '@/components/marketing/NarrativeLinks';
import { MISSION_ATLAS, getArchetypeDisplay, getMetroTypeDisplay } from '@/content/missionAtlas';
import { getAppsForAtlasEntry } from '@/content/atlasAppMap';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function MissionAtlas() {
  const { t } = useTranslation('marketing');
  return (
    <article>
      <SeoHead
        title="Mission Atlas™ — The Living Map of Mission"
        description="Across cities and communities, different missions take shape. The Mission Atlas reveals patterns of care, presence, and relationship across archetypes and geographies."
        keywords={['mission atlas', 'community relationship patterns', 'nonprofit mission types', 'CROS', 'narrative intelligence']}
        canonical="/mission-atlas"
        ogType="article"
        jsonLd={[
          articleSchema({
            headline: 'Mission Atlas™ — The Living Map of Mission',
            description: 'Curated patterns of how organizations care for communities across different contexts.',
            url: '/mission-atlas',
          }),
          breadcrumbSchema([
            { name: 'CROS', url: '/' },
            { name: 'Mission Atlas', url: '/mission-atlas' },
          ]),
        ]}
      />


      {/* Hero */}
      <header className="max-w-[720px] mx-auto px-4 sm:px-6 pt-10 pb-12 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-3">
          Mission Atlas™
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
          The Living Map of Mission
        </h1>
        <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed">
          Across cities and communities, different missions take shape.
          The Mission Atlas reveals patterns we're learning together.
        </p>
      </header>

      {/* Atlas Cards Grid */}
      <section className="max-w-[960px] mx-auto px-4 sm:px-6 pb-16">
        <SeoBreadcrumb items={[
          { label: 'CROS', to: '/' },
          { label: 'Mission Atlas' },
        ]} />
        <div className="grid gap-5 sm:grid-cols-2">
          {MISSION_ATLAS.map((entry) => {
            const appCount = getAppsForAtlasEntry(entry.archetype, entry.metroType).length;
            return (
            <Link
              key={entry.id}
              to={`/mission-atlas/${entry.id}`}
              className="group flex flex-col rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-6 hover:border-[hsl(var(--marketing-blue)/0.25)] hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] bg-[hsl(var(--marketing-surface))] px-2 py-0.5 rounded-full">
                  <Compass className="h-3 w-3" />
                  {getArchetypeDisplay(entry.archetype)}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] bg-[hsl(var(--marketing-surface))] px-2 py-0.5 rounded-full">
                  <MapPin className="h-3 w-3" />
                  {getMetroTypeDisplay(entry.metroType)}
                </span>
              </div>

              {appCount > 0 && (
                <span className="inline-flex w-fit items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mb-3">
                  Federation apps: {appCount}
                </span>
              )}

              <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
                {getArchetypeDisplay(entry.archetype)} — {getMetroTypeDisplay(entry.metroType)}
              </h2>

              <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed line-clamp-3 mb-3">
                {entry.narrative}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {entry.themes.slice(0, 3).map((theme) => (
                  <span
                    key={theme}
                    className="text-[10px] text-[hsl(var(--marketing-navy)/0.45)] border border-[hsl(var(--marketing-border))] rounded-full px-2 py-0.5"
                  >
                    {theme}
                  </span>
                ))}
              </div>

              <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--marketing-blue))] group-hover:underline">
                Read narrative <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
            );
          })}
        </div>
      </section>

      {/* Explanation Block */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-12">
        <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3" style={serif}>
            What the Atlas reveals
          </h2>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
            The Mission Atlas is a curated collection of patterns we observe across
            different types of organizations and communities. These are not performance
            metrics — they are narrative reflections on how mission work takes shape
            in different contexts. Urban outreach looks different from rural pastoral care.
            Workforce development requires different rhythms than refugee resettlement.
            The Atlas honors those differences.
          </p>
        </div>
      </section>

      {/* Narrative Links */}
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <NarrativeLinks currentPath="/mission-atlas" />
      </div>

      <SeoInternalLinks
        heading={t('featurePage.seoLinksHeading')}
        links={[
          { label: 'Archetypes', to: '/archetypes', description: 'See every mission archetype.' },
          { label: 'Roles', to: '/roles', description: 'Shepherd, Companion, Visitor, Steward.' },
          { label: 'NRI', to: '/nri', description: 'Narrative Relational Intelligence explained.' },
          { label: 'Manifesto', to: '/manifesto', description: 'Why we built CROS.' },
        ]}
      />
    </article>
  );
}
