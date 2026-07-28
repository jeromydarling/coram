/**
 * ConceptLinks — Renders related concepts from the concept graph.
 *
 * WHAT: Shows related platform concepts as navigable cards.
 * WHERE: Bottom of marketing pages, after main content.
 * WHY: Strengthens semantic connections between concepts for SEO and user navigation.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getRelatedConcepts, type Concept } from '@/lib/seo/conceptGraph';

interface ConceptLinksProps {
  /** The concept slug to show related concepts for */
  conceptSlug: string;
  heading?: string;
  /** Max number of related concepts to show */
  max?: number;
}

export default function ConceptLinks({
  conceptSlug,
  heading = 'Related concepts',
  max = 4,
}: ConceptLinksProps) {
  const related = getRelatedConcepts(conceptSlug).filter((c) => c.route).slice(0, max);

  if (!related.length) return null;

  return (
    <section className="py-10 sm:py-14">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6">
        <h3
          className="text-base font-semibold text-[hsl(var(--marketing-navy)/0.6)] uppercase tracking-wider mb-5"
        >
          {heading}
        </h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {related.map((concept) => (
            <Link
              key={concept.slug}
              to={concept.route!}
              className="group flex flex-col rounded-xl border border-[hsl(var(--marketing-border))] bg-white p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
            >
              <span className="text-[hsl(var(--marketing-navy))] font-medium text-sm">
                {concept.label}
              </span>
              <span className="text-xs text-[hsl(var(--marketing-navy)/0.45)] mt-1 line-clamp-2">
                {concept.definition}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--marketing-blue))] font-medium mt-2 group-hover:underline">
                Learn more <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
