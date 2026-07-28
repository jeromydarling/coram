/**
 * SeoInternalLinks — Contextual cross-link block for marketing pages.
 *
 * WHAT: Renders a gentle "Continue exploring" section with related page links.
 * WHERE: Bottom of marketing pages, before footer.
 * WHY: Strengthens internal link graph for SEO without aggressive CTAs.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export interface InternalLink {
  label: string;
  to: string;
  description?: string;
}

interface SeoInternalLinksProps {
  heading?: string;
  links: InternalLink[];
}

export default function SeoInternalLinks({
  heading = 'Continue exploring',
  links,
}: SeoInternalLinksProps) {
  if (!links.length) return null;

  return (
    <section className="bg-[hsl(var(--marketing-surface))] py-12 sm:py-16">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6">
        <h3
          className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-6"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {heading}
        </h3>
        <div className="grid gap-3">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group flex items-center justify-between rounded-xl border border-[hsl(var(--marketing-border))] bg-white px-5 py-4 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
            >
              <div className="min-w-0">
                <span className="text-[hsl(var(--marketing-navy))] font-medium">
                  {link.label}
                </span>
                {link.description && (
                  <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] mt-0.5 truncate">
                    {link.description}
                  </p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-[hsl(var(--marketing-navy)/0.3)] group-hover:text-[hsl(var(--marketing-blue))] transition-colors shrink-0 ml-4" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
