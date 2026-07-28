/**
 * WhyCros — /why-cros
 *
 * WHAT: Philosophy page explaining why CROS exists.
 * WHERE: Public marketing site.
 * WHY: Anchors brand narrative and links outward to feature pages.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import relationalCapitalImg from '@/assets/why-cros-relational-capital.png';

const serif = { fontFamily: '"Instrument Serif", Georgia, serif' };

export default function WhyCros() {
  const { t } = useTranslation('marketing');
  return (
    <div className="bg-white">
      <SeoHead
        title="Why CROS — The Philosophy Behind the System"
        description="CROS exists because relationships deserve better technology. A system that remembers people, notices community shifts, and preserves the human story."
        keywords={[
          'why CROS',
          'community relationship OS',
          'nonprofit philosophy',
          'relationship-centered technology',
          'relational capital',
        ]}
        canonical="/why-cros"
        jsonLd={[
          articleSchema({
            headline: 'Why CROS — The Philosophy Behind the System',
            description: 'CROS exists because relationships deserve better technology.',
            url: '/why-cros',
          }),
          breadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'Why CROS', url: '/why-cros' },
          ]),
        ]}
      />

      {/* ─── HERO ─── */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-16 text-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-6"
          style={serif}
        >
          {t('whyCrosPage.heroHeading')}
        </h1>
        <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-xl mx-auto">
          {t('whyCrosPage.heroBody')}
        </p>
      </section>

      {/* ─── THE PROBLEM ─── */}
      <section className="max-w-[680px] mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Why CROS' }]} />
        <h2
          className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-8"
          style={serif}
        >
          The Problem with Traditional Systems
        </h2>
        <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg">
          <p>
            Most CRMs were designed for sales teams. They track deals, leads, and conversion funnels.
          </p>
          <p>
            When nonprofits, churches, and community organizations adopt these tools, they inherit an
            architecture built for transactions — not relationships.
          </p>
          <p>
            Over time, the system shapes the culture. People become records. Conversations become data
            points. The human story fades.
          </p>
        </div>
      </section>

      {/* ─── WHAT CROS BELIEVES ─── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-8"
            style={serif}
          >
            What CROS Believes
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg">
            <p>
              <strong className="text-[hsl(var(--marketing-navy))]">Relationships are the work.</strong>{' '}
              Not a byproduct of it.
            </p>
            <p>
              <strong className="text-[hsl(var(--marketing-navy))]">Memory is infrastructure.</strong>{' '}
              What an organization remembers determines how it cares.
            </p>
            <p>
              <strong className="text-[hsl(var(--marketing-navy))]">Community awareness is intelligence.</strong>{' '}
              Knowing what's happening in your neighborhood is as important as knowing what's in your database.
            </p>
            <p>
              <strong className="text-[hsl(var(--marketing-navy))]">Narrative compounds.</strong>{' '}
              The stories you capture today become the institutional wisdom of tomorrow.
            </p>
          </div>
        </div>
      </section>

      {/* ─── THREE PILLARS ─── */}
      <section className="max-w-[680px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h2
          className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-10"
          style={serif}
        >
          Three Pillars of CROS
        </h2>
        <div className="space-y-8">
          {[
            {
              title: 'Relationship Memory',
              body: 'Reflections, journey chapters, conversations, and milestones — preserved across staff transitions. When someone leaves, the relationship stays.',
            },
            {
              title: 'Community Awareness',
              body: 'Local Pulse surfaces events, signals, and shifts in your community. You notice what matters before it becomes urgent.',
            },
            {
              title: 'Narrative Intelligence',
              body: 'NRI™ learns from human experience — not just data. It suggests, connects, and illuminates patterns that help you serve better.',
            },
          ].map((pillar) => (
            <div key={pillar.title}>
              <h3
                className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-2"
                style={serif}
              >
                {pillar.title}
              </h3>
              <p className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── RELATIONAL CAPITAL VS FINANCIAL CAPITAL ─── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6">
          <img
            src={relationalCapitalImg}
            alt="Renaissance ink sketch of balanced scales — coins on one side, a book with a heart on the other"
            loading="lazy"
            className="rounded-xl mx-auto mb-10 max-w-[360px] w-full opacity-90"
          />
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-8"
            style={serif}
          >
            Relational Capital vs Financial Capital
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg">
            <p>Most nonprofits measure financial capital.</p>
            <p>Revenue. Campaign performance. Donor retention.</p>
            <p>These matter.</p>
            <p>
              But there is another form of capital that quietly determines long-term sustainability:
            </p>
            <p className="text-[hsl(var(--marketing-navy))] font-medium text-xl" style={serif}>
              Relational capital.
            </p>
            <p>Relational capital is:</p>
            <ul className="space-y-1.5 pl-1">
              {[
                'Trust built over time',
                'Context preserved across staff transitions',
                'Volunteer continuity',
                'Donor story memory',
                'Community awareness',
                'Shared mission identity',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-blue))] flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <p>Financial capital can fluctuate year to year.</p>
            <p className="text-[hsl(var(--marketing-navy))] font-medium">
              Relational capital compounds.
            </p>
            <p>When relational capital erodes, fundraising becomes reactive.</p>
            <p>When relational capital is strong, revenue stabilizes naturally.</p>
            <p className="text-[hsl(var(--marketing-navy))] font-medium">
              CROS™ exists to protect relational capital.
            </p>
            <p>Traditional CRMs protect financial capital.</p>
            <p className="text-[hsl(var(--marketing-navy))] font-medium">
              Healthy organizations protect both.
            </p>
            <p className="mt-6">
              <Link
                to="/cros-donor-humanity"
                className="text-[hsl(var(--marketing-blue))] hover:underline font-medium text-sm"
              >
                Learn how CROS preserves donor humanity →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-20 sm:py-28 text-center">
        <div className="max-w-[640px] mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-3"
            style={serif}
          >
            Ready to Build on Relationships?
          </h2>
          <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] mb-10 leading-relaxed">
            CROS helps your organization grow without losing its humanity.
          </p>
          <Link to="/contact">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              Start a conversation <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
