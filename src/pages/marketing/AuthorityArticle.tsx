/**
 * AuthorityArticle — Individual authority article page.
 *
 * WHAT: Renders a single authority essay with hero image, narrative body, and related reading.
 * WHERE: /authority/:category/:slug
 * WHY: Deep, shareable philosophical content pages for SEO authority and reader engagement.
 */
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import NarrativeLinks from '@/components/marketing/NarrativeLinks';
import AuthorityShareCard from '@/components/marketing/AuthorityShareCard';
import { getAuthoritySection, getAuthoritySectionsByCategory, AUTHORITY_SECTIONS, type AuthoritySection } from '@/content/authority';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import { CATEGORY_IMAGES, CATEGORY_ROUTE_MAP } from '@/content/authorityMeta';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const CATEGORY_LABELS: Record<AuthoritySection['category'], string> = {
  week: 'Week Stories',
  adoption: 'Adoption Guidance',
  story: 'Narrative Essays',
  leadership: 'Leadership Reflections',
  field_dispatch: 'Field Dispatches',
};

const ROUTE_TO_CATEGORY: Record<string, AuthoritySection['category']> = {
  weeks: 'week',
  adoption: 'adoption',
  stories: 'story',
  leadership: 'leadership',
  'field-dispatches': 'field_dispatch',
};

export default function AuthorityArticle() {
  const { t } = useTranslation('marketing');
  const { category, slug } = useParams<{ category: string; slug: string }>();

  const section = slug ? getAuthoritySection(slug) : undefined;
  const categoryKey = category ? ROUTE_TO_CATEGORY[category] : undefined;

  if (!section || !categoryKey || section.category !== categoryKey) {
    return <Navigate to="/authority" replace />;
  }

  const categoryRoute = `/authority/${category}`;
  const heroImage = CATEGORY_IMAGES[section.category];
  const paragraphs = section.body.split('\n\n').filter(Boolean);

  // Find prev/next in same category
  const siblings = getAuthoritySectionsByCategory(section.category);
  const idx = siblings.findIndex((s) => s.slug === section.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <article>
      <SeoHead
        title={`${section.title} — CROS Authority`}
        description={section.description}
        canonical={`/authority/${category}/${slug}`}
        jsonLd={[
          articleSchema({ headline: section.title, description: section.description, url: `/authority/${category}/${slug}` }),
          breadcrumbSchema([
            { name: 'CROS', url: '/' },
            { name: 'Authority', url: '/authority' },
            { name: CATEGORY_LABELS[section.category], url: categoryRoute },
            { name: section.title, url: `/authority/${category}/${slug}` },
          ]),
        ]}
      />

      {/* Hero */}
      <header className="relative overflow-hidden bg-[hsl(var(--marketing-surface))]">
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
        />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-8 pb-10">
          <Link
            to={categoryRoute}
            className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--marketing-navy)/0.45)] hover:text-[hsl(var(--marketing-navy))] mb-6 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {CATEGORY_LABELS[section.category]}
          </Link>

          <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--marketing-blue)/0.7)] mb-3">
            {CATEGORY_LABELS[section.category]} · {section.archetype} · {section.roleFocus}
          </p>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-3 leading-tight" style={serif}>
            {section.title}
          </h1>
          <p className="text-base text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed max-w-lg" style={serif}>
            {section.description}
          </p>
        </div>
      </header>

      {/* Body */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 py-12">
        <SeoBreadcrumb items={[
          { label: 'CROS', to: '/' },
          { label: 'Authority', to: '/authority' },
          { label: CATEGORY_LABELS[section.category], to: categoryRoute },
          { label: section.title },
        ]} />

        <div className="mt-8 space-y-6">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[16px] text-[hsl(var(--marketing-navy)/0.75)] leading-[1.9]" style={serif}>
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* Prev / Next navigation */}
      <nav className="max-w-[720px] mx-auto px-4 sm:px-6 pb-10">
        <div className="flex gap-4">
          {prev && (
            <Link
              to={`/authority/${category}/${prev.slug}`}
              className="flex-1 group rounded-xl border border-[hsl(var(--marketing-border))] bg-white p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] transition-colors"
            >
              <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)]">Previous</span>
              <p className="text-sm font-medium text-[hsl(var(--marketing-navy))] group-hover:text-[hsl(var(--marketing-blue))] transition-colors mt-1" style={serif}>
                {prev.title}
              </p>
            </Link>
          )}
          {next && (
            <Link
              to={`/authority/${category}/${next.slug}`}
              className="flex-1 group rounded-xl border border-[hsl(var(--marketing-border))] bg-white p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] transition-colors text-right"
            >
              <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)]">Next</span>
              <p className="text-sm font-medium text-[hsl(var(--marketing-navy))] group-hover:text-[hsl(var(--marketing-blue))] transition-colors mt-1" style={serif}>
                {next.title}
              </p>
            </Link>
          )}
        </div>
      </nav>

      {/* Share */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <AuthorityShareCard path={`/authority/${category}/${slug}`} title={`${section.title} — CROS Authority`} />
      </section>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-8">
        <NarrativeLinks currentPath={`/authority/${category}`} />
      </div>
    </article>
  );
}
