/**
 * LexiconTerm — Dynamic detail page for a single CROS Lexicon™ entry.
 *
 * WHAT: Renders the full narrative definition, related terms, and cross-links.
 * WHERE: /lexicon/:slug (public marketing route).
 * WHY: Creates deep SEO pages for each concept in the CROS worldview.
 */
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, BookOpen, Compass, Radio, Heart, Layers } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import NarrativeLinks from '@/components/marketing/NarrativeLinks';
import { getLexiconEntry, getRelatedLexiconEntries, type LexiconCategory } from '@/content/lexicon';
import { breadcrumbSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const CATEGORY_COLORS: Record<LexiconCategory, string> = {
  Concept: 'bg-blue-50 text-blue-700 border-blue-100',
  Role: 'bg-amber-50 text-amber-700 border-amber-100',
  Signal: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Practice: 'bg-rose-50 text-rose-700 border-rose-100',
  Module: 'bg-violet-50 text-violet-700 border-violet-100',
};

export default function LexiconTerm() {
  const { t } = useTranslation('marketing');
  const { slug } = useParams<{ slug: string }>();
  const entry = slug ? getLexiconEntry(slug) : undefined;

  if (!entry) return <Navigate to="/lexicon" replace />;

  const related = getRelatedLexiconEntries(entry.slug, 4);
  const paragraphs = entry.body.split('\n\n').filter(Boolean);

  return (
    <article>
      <SeoHead
        title={`${entry.title} — CROS Lexicon™`}
        description={entry.summary}
        keywords={[entry.title.toLowerCase(), entry.category.toLowerCase(), 'CROS', 'narrative intelligence', 'mission terminology']}
        canonical={`/lexicon/${entry.slug}`}
        ogType="article"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'DefinedTerm',
            name: entry.title,
            description: entry.summary,
            inDefinedTermSet: {
              '@type': 'DefinedTermSet',
              name: 'The CROS Lexicon™',
            },
          },
          breadcrumbSchema([
            { name: 'CROS', url: '/' },
            { name: 'Lexicon', url: '/lexicon' },
            { name: entry.title, url: `/lexicon/${entry.slug}` },
          ]),
        ]}
      />

      <SeoBreadcrumb items={[
        { label: 'CROS', to: '/' },
        { label: 'Lexicon', to: '/lexicon' },
        { label: entry.title },
      ]} />

      <header className="max-w-[720px] mx-auto px-4 sm:px-6 pt-8 pb-8">
        <Link
          to="/lexicon"
          className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--marketing-navy)/0.45)] hover:text-[hsl(var(--marketing-navy))] mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Lexicon
        </Link>

        <div className="mb-3">
          <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[entry.category]}`}>
            {entry.category}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3" style={serif}>
          {entry.title}
        </h1>

        <p className="text-base text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>
          {entry.summary}
        </p>
      </header>

      {/* Body */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10 space-y-5">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[15px] text-[hsl(var(--marketing-navy)/0.7)] leading-[1.85]" style={serif}>
            {p}
          </p>
        ))}
      </section>

      {/* Where this appears */}
      {entry.appearsIn && entry.appearsIn.length > 0 && (
        <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-3">
            Where this appears in CROS
          </h2>
          <div className="flex flex-wrap gap-2">
            {entry.appearsIn.map((path) => (
              <Link
                key={path}
                to={path}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-surface))] px-3 py-1.5 rounded-full hover:bg-white border border-transparent hover:border-[hsl(var(--marketing-border))] transition-colors"
              >
                {path}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Related terms */}
      {related.length > 0 && (
        <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-3">
            Related terms
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                to={`/lexicon/${r.slug}`}
                className="group flex items-center gap-3 rounded-xl bg-[hsl(var(--marketing-surface))] p-4 hover:bg-white transition-colors border border-transparent hover:border-[hsl(var(--marketing-border))]"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]" style={serif}>
                    {r.title}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider ml-2 px-1.5 py-0.5 rounded-full border ${CATEGORY_COLORS[r.category]}`}>
                    {r.category}
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.2)] group-hover:text-[hsl(var(--marketing-navy)/0.5)] transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <NarrativeLinks currentPath={`/lexicon/${entry.slug}`} />
      </div>

      <SeoInternalLinks
        heading={t('featurePage.seoLinksHeading')}
        links={[
          { label: 'Lexicon', to: '/lexicon', description: 'The full CROS vocabulary.' },
          { label: 'Archetypes', to: '/archetypes', description: 'Find your mission pattern.' },
          { label: 'Mission Atlas', to: '/mission-atlas', description: 'Patterns across contexts.' },
          { label: 'NRI', to: '/nri', description: 'Narrative Relational Intelligence.' },
        ]}
      />
    </article>
  );
}
