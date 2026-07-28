/**
 * AuthorityCategory — Dynamic page for authority content by category.
 *
 * WHAT: Lists authority articles filtered by category with sticky nav, hero images, and rich cards.
 * WHERE: /authority/weeks, /authority/adoption, /authority/stories, /authority/leadership, /authority/field-dispatches.
 * WHY: Deep SEO pages for each content type — philosophical guides, not how-tos.
 */
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import NarrativeLinks from '@/components/marketing/NarrativeLinks';
import AuthorityShareCard from '@/components/marketing/AuthorityShareCard';
import { getAuthoritySectionsByCategory, type AuthoritySection } from '@/content/authority';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import { CATEGORY_IMAGES } from '@/content/authorityMeta';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const CATEGORY_INFO: Record<string, { categoryKey: AuthoritySection['category'] }> = {
  weeks: { categoryKey: 'week' },
  adoption: { categoryKey: 'adoption' },
  stories: { categoryKey: 'story' },
  leadership: { categoryKey: 'leadership' },
  'field-dispatches': { categoryKey: 'field_dispatch' },
};

export default function AuthorityCategory() {
  const { t } = useTranslation('marketing');
  const { category } = useParams<{ category: string }>();
  const info = category ? CATEGORY_INFO[category] : undefined;
  if (!info) return <Navigate to="/authority" replace />;

  const sections = getAuthoritySectionsByCategory(info.categoryKey);
  const heroImage = CATEGORY_IMAGES[info.categoryKey];

  return (
    <article>
      <SeoHead title={`${t(`authorityCategoryPage.categories.${category}.label`)} — CROS Authority`} description={t(`authorityCategoryPage.categories.${category}.description`)} canonical={`/authority/${category}`}
        jsonLd={[articleSchema({ headline: t(`authorityCategoryPage.categories.${category}.label`), description: t(`authorityCategoryPage.categories.${category}.description`), url: `/authority/${category}` }),
          breadcrumbSchema([{ name: 'CROS', url: '/' }, { name: 'Authority', url: '/authority' }, { name: t(`authorityCategoryPage.categories.${category}.label`), url: `/authority/${category}` }])]} />

      {/* Hero with category image */}
      <header className="relative overflow-hidden bg-[hsl(var(--marketing-surface))]">
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.18] pointer-events-none"
        />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-12 pb-14">
          <Link to="/authority" className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--marketing-navy)/0.45)] hover:text-[hsl(var(--marketing-navy))] mb-6 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> {t('authorityCategoryPage.backLink')}
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-3 leading-tight" style={serif}>{t(`authorityCategoryPage.categories.${category}.label`)}</h1>
          <p className="text-base text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed max-w-lg" style={serif}>{t(`authorityCategoryPage.categories.${category}.description`)}</p>
        </div>
      </header>

      {/* Sticky article nav */}
      <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-[hsl(var(--marketing-border))]">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {sections.map((s) => (
            <a
              key={s.slug}
              href={`#${s.slug}`}
              className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full text-[hsl(var(--marketing-navy)/0.55)] hover:text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] transition-colors"
            >
              {s.title}
            </a>
          ))}
        </div>
      </nav>

      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pt-8 pb-4">
        <SeoBreadcrumb items={[{ label: 'CROS', to: '/' }, { label: 'Authority', to: '/authority' }, { label: t(`authorityCategoryPage.categories.${category}.label`) }]} />
      </section>

      {/* Articles */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-16 space-y-16">
        {sections.map((s, sIdx) => {
          const paragraphs = s.body.split('\n\n').filter(Boolean);
          const previewParagraphs = paragraphs.slice(0, 2);
          return (
            <div key={s.slug} id={s.slug} className="scroll-mt-20">
              {/* Divider between articles */}
              {sIdx > 0 && (
                <div className="border-t border-[hsl(var(--marketing-border))] mb-10" />
              )}

              {/* Article number + meta */}
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--marketing-blue)/0.08)] text-[hsl(var(--marketing-blue))] text-xs font-semibold">
                  {sIdx + 1}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)]">
                  {s.archetype} · {s.roleFocus}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-[hsl(var(--marketing-navy))] mb-2 leading-tight" style={serif}>
                {s.title}
              </h2>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-6 leading-relaxed" style={serif}>
                {s.description}
              </p>

              {/* Preview paragraphs */}
              {previewParagraphs.map((p, i) => (
                <p key={i} className="text-[15px] text-[hsl(var(--marketing-navy)/0.65)] leading-[1.85] mb-4" style={serif}>
                  {p}
                </p>
              ))}

              {paragraphs.length > 2 && (
                <Link
                  to={`/authority/${category}/${s.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--marketing-blue))] hover:underline mt-2"
                >
                  Continue reading <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}

              {paragraphs.length <= 2 && (
                <Link
                  to={`/authority/${category}/${s.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--marketing-blue))] hover:underline mt-2"
                >
                  Read full article <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </section>

      {/* Share card */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <AuthorityShareCard path={`/authority/${category}`} title={`${t(`authorityCategoryPage.categories.${category}.label`)} — CROS Authority`} />
      </section>

      {/* Soft conversion */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-12">
        <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl p-8 text-center">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3" style={serif}>{t('authorityCategoryPage.softConversion.heading')}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/archetypes" className="text-sm font-medium text-[hsl(var(--marketing-blue))] hover:underline">{t('authorityCategoryPage.softConversion.exploreArchetypes')}</Link>
            <Link to="/pricing" className="text-sm font-medium text-[hsl(var(--marketing-blue))] hover:underline">{t('authorityCategoryPage.softConversion.viewPricing')}</Link>
          </div>
        </div>
      </section>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8"><NarrativeLinks currentPath={`/authority/${category}`} /></div>
    </article>
  );
}
