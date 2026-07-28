/**
 * InsightsIndex — Landing page for /insights listing all narrative essays.
 *
 * WHAT: Lists all published insights with dates and descriptions.
 * WHERE: /insights
 * WHY: SEO index page for narrative content discovery.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { insights } from '@/content/insights';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function InsightsIndex() {
  return (
    <div className="bg-white">
      <SeoHead
        title="Insights"
        description="Narrative essays on relationship memory, community awareness, and the future of mission-driven technology."
        keywords={['CROS insights', 'nonprofit technology essays', 'community relationship thought leadership']}
        canonical="/insights"
      />

      <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-20">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Insights' }]} />
        <h1
          className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4"
          style={serif}
        >
          Insights
        </h1>
        <p className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-12">
          Reflections on relationship, technology, and the work of care.
        </p>

        <div className="space-y-6">
          {insights.map((insight) => (
            <Link
              key={insight.slug}
              to={`/insights/${insight.slug}`}
              className="group block rounded-2xl border border-[hsl(var(--marketing-border))] p-6 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
            >
              <time
                dateTime={insight.datePublished}
                className="text-xs text-[hsl(var(--marketing-navy)/0.4)] uppercase tracking-wider"
              >
                {new Date(insight.datePublished).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mt-1 mb-1" style={serif}>
                {insight.title}
              </h2>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
                {insight.description}
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-[hsl(var(--marketing-blue))] font-medium mt-3 group-hover:underline">
                Read <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
