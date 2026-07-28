/**
 * FieldJournalEntry — Dynamic detail page for a single field journal entry.
 *
 * WHAT: Full narrative, lessons, cross-links for a field moment.
 * WHERE: /field-journal/:slug (public marketing route).
 * WHY: Deep SEO pages for pastoral storytelling.
 */
import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import NarrativeLinks from '@/components/marketing/NarrativeLinks';
import { getFieldJournalEntry } from '@/content/fieldJournal';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };
const ARCHETYPE_LABELS: Record<string, string> = {
  church: 'Church', catholic_outreach: 'Catholic Outreach', nonprofit: 'Nonprofit',
  social_enterprise: 'Social Enterprise', workforce: 'Workforce Dev', digital_inclusion: 'Digital Inclusion',
};

export default function FieldJournalEntryPage() {
  const { slug } = useParams<{ slug: string }>();
  const entry = slug ? getFieldJournalEntry(slug) : undefined;
  if (!entry) return <Navigate to="/field-journal" replace />;

  const paragraphs = entry.body.split('\n\n').filter(Boolean);

  return (
    <article>
      <SeoHead
        title={`${entry.title} — Field Journal`}
        description={entry.summary}
        canonical={`/field-journal/${entry.slug}`}
        ogType="article"
        jsonLd={[
          articleSchema({ headline: entry.title, description: entry.summary, url: `/field-journal/${entry.slug}`, datePublished: entry.publishedDate }),
          breadcrumbSchema([{ name: 'CROS', url: '/' }, { name: 'Field Journal', url: '/field-journal' }, { name: entry.title, url: `/field-journal/${entry.slug}` }]),
        ]}
      />

      <header className="max-w-[720px] mx-auto px-4 sm:px-6 pt-8 pb-8">
        <Link to="/field-journal" className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--marketing-navy)/0.45)] hover:text-[hsl(var(--marketing-navy))] mb-6 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Field Journal
        </Link>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-100">
            {ARCHETYPE_LABELS[entry.archetype] || entry.archetype}
          </span>
          {entry.roles.map((r) => (
            <span key={r} className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-100">{r}</span>
          ))}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3" style={serif}>{entry.title}</h1>
        <p className="text-base text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>{entry.summary}</p>
      </header>

      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10 space-y-5">
        <SeoBreadcrumb items={[{ label: 'CROS', to: '/' }, { label: 'Field Journal', to: '/field-journal' }, { label: entry.title }]} />
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[15px] text-[hsl(var(--marketing-navy)/0.7)] leading-[1.85]" style={serif}>{p}</p>
        ))}
      </section>

      {entry.lessons && entry.lessons.length > 0 && (
        <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
          <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl p-6">
            <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-4">What this reveals</h2>
            <ul className="space-y-2">
              {entry.lessons.map((l, i) => (
                <li key={i} className="text-sm text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed flex gap-2">
                  <span className="text-[hsl(var(--marketing-blue))] mt-0.5 shrink-0">&bull;</span>{l}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <NarrativeLinks currentPath={`/field-journal/${entry.slug}`} />
      </div>
    </article>
  );
}
