/**
 * LegalPageLayout — Shared layout for CROS legal pages.
 *
 * WHAT: Renders structured legal content with serif headings, anchor nav, and calm tone.
 * WHERE: Used by all /legal/* routes.
 * WHY: Legal pages should feel like a field guide, not a corporate wall.
 */
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import type { LegalPageContent } from '@/content/legalPages';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function LegalPageLayout({ page }: { page: LegalPageContent }) {
  const { t } = useTranslation('marketing');
  return (
    <article>
      <SeoHead
        title={`${page.title} — CROS\u2122`}
        description={page.intro}
        canonical={page.route}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: page.title,
          description: page.intro,
          publisher: { '@type': 'Organization', name: 'CROS' },
        }}
      />

      <header className="max-w-[720px] mx-auto px-4 sm:px-6 pt-10 pb-8">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-2">
          {t('legalPageLayout.eyebrow')}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3" style={serif}>{page.title}</h1>
        <p className="text-base text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-2" style={serif}>{page.intro}</p>
        <p className="text-xs text-[hsl(var(--marketing-navy)/0.35)]">{t('legalPageLayout.lastUpdated')} {page.lastUpdated}</p>
      </header>

      {/* Anchor nav */}
      <nav className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <div className="flex flex-wrap gap-2">
          {page.sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-xs text-[hsl(var(--marketing-blue))] hover:underline">{s.title}</a>
          ))}
        </div>
      </nav>

      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-16 space-y-10">
        <SeoBreadcrumb items={[{ label: t('legalPageLayout.breadcrumb.home'), to: '/' }, { label: page.title }]} />
        {page.sections.map((s) => (
          <div key={s.id} id={s.id}>
            <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3" style={serif}>{s.title}</h2>
            <p className="text-[15px] text-[hsl(var(--marketing-navy)/0.65)] leading-[1.85]">{s.body}</p>
          </div>
        ))}
      </section>
    </article>
  );
}
