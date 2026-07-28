/**
 * Lexicon — The CROS Lexicon™ public index page.
 *
 * WHAT: Renders all lexicon terms grouped by category as navigable cards.
 * WHERE: /lexicon (public marketing route).
 * WHY: Establishes CROS as the authoritative language source for relational mission work.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen, Compass, Radio, Heart, Layers } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import NarrativeLinks from '@/components/marketing/NarrativeLinks';
import { CROS_LEXICON, getLexiconCategories, getLexiconByCategory, type LexiconCategory } from '@/content/lexicon';
import { breadcrumbSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const CATEGORY_ICONS: Record<LexiconCategory, React.ComponentType<{ className?: string }>> = {
  Concept: BookOpen,
  Role: Compass,
  Signal: Radio,
  Practice: Heart,
  Module: Layers,
};

const CATEGORY_COLORS: Record<LexiconCategory, string> = {
  Concept: 'bg-blue-50 text-blue-700 border-blue-100',
  Role: 'bg-amber-50 text-amber-700 border-amber-100',
  Signal: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Practice: 'bg-rose-50 text-rose-700 border-rose-100',
  Module: 'bg-violet-50 text-violet-700 border-violet-100',
};

export default function Lexicon() {
  const { t } = useTranslation('marketing');
  const categories = getLexiconCategories();

  return (
    <article>
      <SeoHead
        title="The CROS Lexicon™ — Language of Living Mission"
        description="A living library of concepts that define the worldview behind CROS — Narrative Relational Intelligence, Presence Signals, Mission Archetypes, and more."
        keywords={['CROS lexicon', 'narrative relational intelligence', 'mission terminology', 'community relationship', 'nonprofit glossary']}
        canonical="/lexicon"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'DefinedTermSet',
            name: 'The CROS Lexicon™',
            description: 'The authoritative language source for relational mission work.',
            url: 'https://thecros.lovable.app/lexicon',
          },
          breadcrumbSchema([
            { name: 'CROS', url: '/' },
            { name: 'Lexicon', url: '/lexicon' },
          ]),
        ]}
      />


      {/* Hero */}
      <header className="max-w-[720px] mx-auto px-4 sm:px-6 pt-10 pb-12 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-3">
          The CROS Lexicon™
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
          The Language of Living Mission
        </h1>
        <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed" style={serif}>
          CROS didn't begin with features.
          It began with words — words that describe how people walk together.
        </p>
      </header>

      {/* Terms by category */}
      <section className="max-w-[960px] mx-auto px-4 sm:px-6 pb-16 space-y-12">
        <SeoBreadcrumb items={[{ label: 'CROS', to: '/' }, { label: 'Lexicon' }]} />
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat];
          const entries = getLexiconByCategory(cat);
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-4">
                <Icon className="h-4 w-4 text-[hsl(var(--marketing-navy)/0.4)]" />
                <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
                  {cat}s
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {entries.map((entry) => (
                  <Link
                    key={entry.slug}
                    to={`/lexicon/${entry.slug}`}
                    className="group flex flex-col rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-5 hover:border-[hsl(var(--marketing-blue)/0.25)] hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat]}`}>
                        {cat}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-1.5" style={serif}>
                      {entry.title}
                    </h3>
                    <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed line-clamp-2 mb-3">
                      {entry.summary}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--marketing-blue))] group-hover:underline">
                      Read definition <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Explanation */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-12">
        <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3" style={serif}>
            Why language matters
          </h2>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
            The words we use shape the systems we build. When we say "lead" instead of "person,"
            we've already reduced a relationship to a transaction. When we say "pipeline" instead of
            "journey," we've already decided the story ends with a sale. The CROS Lexicon exists
            to hold a different vocabulary — one that honors the complexity and dignity of human
            relationship work.
          </p>
        </div>
      </section>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <NarrativeLinks currentPath="/lexicon" />
      </div>

      <SeoInternalLinks
        heading={t('featurePage.seoLinksHeading')}
        links={[
          { label: 'Archetypes', to: '/archetypes', description: 'Find your mission pattern.' },
          { label: 'Roles', to: '/roles', description: 'Shepherd, Companion, Visitor, Steward.' },
          { label: 'Mission Atlas', to: '/mission-atlas', description: 'Patterns of mission across contexts.' },
          { label: 'NRI', to: '/nri', description: 'Narrative Relational Intelligence explained.' },
        ]}
      />
    </article>
  );
}
