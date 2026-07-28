/**
 * FieldJournal — The Living Field Journal index page.
 *
 * WHAT: Renders curated field moments as navigable cards.
 * WHERE: /field-journal (public marketing route).
 * WHY: Builds SEO authority through pastoral storytelling.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import NarrativeLinks from '@/components/marketing/NarrativeLinks';
import { FIELD_JOURNAL } from '@/content/fieldJournal';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const ARCHETYPE_LABELS: Record<string, string> = {
  church: 'Church', catholic_outreach: 'Catholic Outreach', nonprofit: 'Nonprofit',
  social_enterprise: 'Social Enterprise', workforce: 'Workforce Dev', digital_inclusion: 'Digital Inclusion',
};

export default function FieldJournal() {
  const { t } = useTranslation('marketing');
  return (
    <article>
      <SeoHead
        title="The Living Field Journal — CROS™"
        description="Not every story is a success story. But every moment teaches us something about presence. Reflective field notes from relational mission work."
        keywords={['field journal', 'nonprofit stories', 'volunteer management', 'relationship-centered', 'mission work']}
        canonical="/field-journal"
        jsonLd={[
          articleSchema({ headline: 'The Living Field Journal', description: 'Reflective field notes from relational mission work.', url: '/field-journal' }),
          breadcrumbSchema([{ name: 'CROS', url: '/' }, { name: 'Field Journal', url: '/field-journal' }]),
        ]}
      />

      <header className="max-w-[720px] mx-auto px-4 sm:px-6 pt-10 pb-12 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-3">The Living Field Journal</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>Field Notes from Living Mission</h1>
        <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed" style={serif}>
          Not every story is a success story. But every moment teaches us something about presence.
        </p>
      </header>

      <section className="max-w-[960px] mx-auto px-4 sm:px-6 pb-16 grid gap-4 sm:grid-cols-2">
        <SeoBreadcrumb items={[{ label: 'CROS', to: '/' }, { label: 'Field Journal' }]} />
        {FIELD_JOURNAL.map((entry) => (
          <Link
            key={entry.slug}
            to={`/field-journal/${entry.slug}`}
            className="group flex flex-col rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-5 hover:border-[hsl(var(--marketing-blue)/0.25)] hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-100">
                {ARCHETYPE_LABELS[entry.archetype] || entry.archetype}
              </span>
              {entry.roles.map((r) => (
                <span key={r} className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)]">{r}</span>
              ))}
            </div>
            <h3 className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-1.5" style={serif}>{entry.title}</h3>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed line-clamp-2 mb-3">{entry.summary}</p>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--marketing-blue))] group-hover:underline">
              Read more <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </section>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <NarrativeLinks currentPath="/field-journal" />
      </div>
      <SeoInternalLinks heading={t('featurePage.seoLinksHeading')} links={[
        { label: 'Lexicon', to: '/lexicon', description: 'The language of living mission.' },
        { label: 'Archetypes', to: '/archetypes', description: 'Find your mission pattern.' },
        { label: 'Mission Atlas', to: '/mission-atlas', description: 'Patterns across contexts.' },
      ]} />
    </article>
  );
}
