/**
 * LibraryConceptPage — Canonical civic language definition page.
 *
 * WHAT: Renders a single concept from the CROS™ narrative library with full structured data.
 * WHERE: /library/:conceptSlug
 * WHY: Establishes CROS™ as the canonical source for civic relationship language.
 */
import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import { definedTermSchema } from '@/lib/seo/languageGraph';
import { getConceptBySlug, getRelatedConcepts } from '@/content/libraryConcepts';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function LibraryConceptPage() {
  const { conceptSlug } = useParams<{ conceptSlug: string }>();

  const concept = conceptSlug ? getConceptBySlug(conceptSlug) : undefined;
  if (!concept) return <Navigate to="/roles" replace />;

  const related = getRelatedConcepts(concept.relatedSlugs);
  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Library', to: '/library' },
    { label: concept.title },
  ];

  return (
    <>
      <SeoHead
        title={`${concept.title} — CROS\u2122 Library`}
        description={concept.definition.slice(0, 155)}
        canonical={`/library/${concept.slug}`}
        jsonLd={[
          articleSchema({ headline: concept.title, description: concept.definition.slice(0, 155), url: `/library/${concept.slug}` }),
          definedTermSchema({ name: concept.title, description: concept.definition, url: `/library/${concept.slug}` }),
          breadcrumbSchema(crumbs.map(c => ({ name: c.label, url: c.to ?? '' }))),
        ]}
      />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-20">
        <SeoBreadcrumb items={crumbs} />
        {/* Hero */}
        <section className="pt-10 pb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--marketing-surface))] rounded-full px-4 py-1.5 mb-4">
            <BookOpen className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.4)]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
              Library
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
            {concept.title}
          </h1>
        </section>

        {/* Definition */}
        <section className="py-6">
          <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] p-6 sm:p-8">
            <p className="text-base text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed" style={serif}>
              {concept.definition}
            </p>
          </div>
        </section>

        {/* Role Connections */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            How roles engage with this
          </h2>
          <div className="space-y-3">
            {concept.roleConnections.map((rc) => (
              <div key={rc.role} className="rounded-xl bg-[hsl(var(--marketing-surface))] p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-1.5">
                  {rc.role}
                </p>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{rc.connection}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Archetype Connections */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            Where this shows up
          </h2>
          <div className="space-y-3">
            {concept.archetypeConnections.map((ac) => (
              <div key={ac.archetype} className="rounded-xl bg-[hsl(var(--marketing-surface))] p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-1.5">
                  {ac.archetype}
                </p>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{ac.connection}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Real World Examples */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            In practice
          </h2>
          <ul className="space-y-3">
            {concept.realWorldExamples.map((ex, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.25)] flex-shrink-0" />
                <span className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>{ex}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Related Concepts */}
        {related.length > 0 && (
          <section className="py-8">
            <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
              Related concepts
            </h2>
            <div className="space-y-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/library/${r.slug}`}
                  className="flex items-center justify-between rounded-xl bg-[hsl(var(--marketing-surface))] p-4 hover:bg-white transition-colors group"
                >
                  <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]">{r.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.3)] group-hover:text-[hsl(var(--marketing-navy)/0.6)] transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
