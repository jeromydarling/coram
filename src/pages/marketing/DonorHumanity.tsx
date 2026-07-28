/**
 * DonorHumanity — /cros-donor-humanity
 *
 * WHAT: SEO landing page on relational donor stewardship philosophy.
 * WHERE: Public marketing site.
 * WHY: Positions CROS as the relational layer above fundraising CRMs.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { articleSchema, breadcrumbSchema, faqSchema } from '@/lib/seo/seoConfig';
import heroImg from '@/assets/donor-humanity-hero.png';
import ledgerImg from '@/assets/donor-humanity-ledger.png';
import manuscriptImg from '@/assets/donor-humanity-manuscript.png';
import paradoxImg from '@/assets/donor-humanity-paradox.png';
import ctaImg from '@/assets/donor-humanity-cta.png';

const serif = { fontFamily: '"Instrument Serif", Georgia, serif' };

export default function DonorHumanity() {
  return (
    <div className="bg-white">
      <SeoHead
        title="Donors Are People Too | Relational Donor Stewardship"
        description="Most CRMs track donations. CROS™ preserves the human story behind every gift. Restore donor dignity and relational continuity in your nonprofit."
        keywords={[
          'donor stewardship',
          'relational fundraising',
          'nonprofit CRM alternative',
          'donor management system',
          'relationship-centered fundraising',
          'CROS donor humanity',
        ]}
        canonical="/cros-donor-humanity"
        jsonLd={[
          articleSchema({
            headline: 'Donors Are People Too — Relational Donor Stewardship with CROS™',
            description:
              'Most CRMs track donations. CROS™ preserves the human story behind every gift.',
            url: '/cros-donor-humanity',
          }),
          breadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'Donors Are People Too', url: '/cros-donor-humanity' },
          ]),
          faqSchema([
            {
              question: 'Does CROS replace my donor management system?',
              answer:
                'No. CROS layers above your existing fundraising CRM to preserve the relational story behind every gift. Your CRM tracks gifts — CROS preserves people.',
            },
            {
              question: 'What integrations does CROS Bridge support?',
              answer:
                'CROS Bridge integrates with Salesforce, Bloomerang, HubSpot, Planning Center, Dynamics, Blackbaud, and CiviCRM.',
            },
          ]),
        ]}
      />

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <img
          src={heroImg}
          alt="Renaissance ink sketch of two figures exchanging a gift while looking at each other, lantern between them"
          loading="eager"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.12] object-cover object-center scale-[1.8] origin-top"
        />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-16 text-center">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-6"
            style={serif}
          >
            Your Donors Are Not Revenue Streams.
          </h1>
          <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-lg mx-auto mb-10">
            CROS™ helps you remember the human story behind every gift.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/see-people">
              <Button
                size="lg"
                className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
              >
                See How CROS Honors Donor Relationships <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link
              to="/relatio-campaigns"
              className="text-sm text-[hsl(var(--marketing-blue))] hover:underline"
            >
              Explore CROS Bridge™
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SECTION 1 — THE QUIET DRIFT ─── */}
      <section className="max-w-[680px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Donors Are People Too' }]} />
        <h2
          className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-8"
          style={serif}
        >
          When Fundraising Pressure Rises, Humanity Quietly Erodes.
        </h2>
        <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg">
          <p>Modern donor systems are built to optimize:</p>
          <ul className="space-y-1.5 pl-1">
            {['Giving frequency', 'Average gift size', 'Retention rate', 'Lapsed donor recovery', 'Campaign conversion'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.3)] flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
          <p>None of this is wrong.</p>
          <p className="text-[hsl(var(--marketing-navy))] font-medium">But architecture shapes culture.</p>
          <p>When someone becomes:</p>
          <ul className="space-y-1.5 pl-1">
            {['A segment', 'A tier', 'A pipeline stage', 'A lifetime value metric'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.3)] flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
          <p>Something subtle begins to disappear.</p>
          <p className="text-[hsl(var(--marketing-navy))] font-medium text-xl" style={serif}>
            The story.
          </p>
          <p>This is not moral failure.</p>
          <p className="text-[hsl(var(--marketing-navy))] font-medium">It is architectural drift.</p>
        </div>
      </section>

      {/* ─── SECTION 2 — WHAT GETS LOST ─── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6">
          <img
            src={ledgerImg}
            alt="Renaissance ink sketch of an open ledger with a fading portrait dissolving into the page"
            loading="lazy"
            className="rounded-xl mx-auto mb-10 max-w-[400px] w-full opacity-90"
          />
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-8"
            style={serif}
          >
            What Happens When Donors Become Data
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg">
            <p>When systems optimize for transactions:</p>
            <ul className="space-y-1.5 pl-1">
              {[
                'Conversations disappear when staff leaves',
                'Motivations fade from memory',
                'Personal milestones are forgotten',
                'Donors feel targeted instead of known',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.3)] flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-[hsl(var(--marketing-navy))] font-medium">
              The organization remembers the gift.
            </p>
            <p>But forgets the giver.</p>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3 — WHAT CROS RESTORES ─── */}
      <section className="max-w-[680px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <img
          src={manuscriptImg}
          alt="Renaissance ink sketch of an illuminated manuscript with narrative scenes inside its pages"
          loading="lazy"
          className="rounded-xl mx-auto mb-10 max-w-[400px] w-full opacity-90"
        />
        <h2
          className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-8"
          style={serif}
        >
          CROS Restores Donor Humanity.
        </h2>
        <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg">
          <p>CROS does not replace your donation infrastructure.</p>
          <p className="text-[hsl(var(--marketing-navy))] font-medium">
            It restores relationship continuity.
          </p>
          <p>In CROS, a donor is not a giving record.</p>
          <p>A donor is:</p>
          <ul className="space-y-1.5 pl-1">
            {['A person', 'A partner', 'A companion in mission', 'A story unfolding over time'].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-blue))] flex-shrink-0" />
                <span className="text-[hsl(var(--marketing-navy))]">{t}</span>
              </li>
            ))}
          </ul>
          <p>You can capture:</p>
          <ul className="space-y-1.5 pl-1">
            {[
              'Conversations',
              'Personal milestones',
              'Shared events',
              'Volunteer involvement',
              'Reflections after visits',
              'The arc of their relationship with your mission',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.3)] flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
          <p>The gift remains important.</p>
          <p className="text-[hsl(var(--marketing-navy))] font-medium">
            But it is no longer the center.
          </p>
        </div>
      </section>

      {/* ─── SECTION 4 — TRANSACTION VS NARRATIVE ─── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-[780px] mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-10 text-center"
            style={serif}
          >
            Transaction History vs Narrative Continuity
          </h2>
          <div className="grid sm:grid-cols-2 gap-8">
            {/* Left */}
            <div className="rounded-xl border border-[hsl(var(--marketing-border))] bg-white p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-4">
                Traditional CRM Tracks
              </p>
              <ul className="space-y-2.5">
                {['What they gave', 'When they gave', 'How often they gave', 'Campaign engagement'].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-[hsl(var(--marketing-navy)/0.65)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.25)] flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {/* Right */}
            <div className="rounded-xl border border-[hsl(var(--marketing-blue)/0.25)] bg-white p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-4">
                CROS Preserves
              </p>
              <ul className="space-y-2.5">
                {[
                  'Why they care',
                  'How they became involved',
                  "Who they've met",
                  "What they've experienced",
                  'Where their journey is heading',
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-[hsl(var(--marketing-navy))]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-blue))] flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p
            className="text-center text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.7)] mt-10 leading-relaxed"
            style={serif}
          >
            When staff turns over — and they always do —<br />
            relationship memory remains intact.
          </p>
        </div>
      </section>

      {/* ─── SECTION 5 — THE PARADOX ─── */}
      <section className="max-w-[680px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <img
          src={paradoxImg}
          alt="Renaissance ink sketch of an open hand offering a growing seed"
          loading="lazy"
          className="rounded-xl mx-auto mb-10 max-w-[320px] w-full opacity-90"
        />
        <h2
          className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-8"
          style={serif}
        >
          Honoring Donor Humanity Strengthens Fundraising.
        </h2>
        <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg">
          <p>When donors are remembered as human beings:</p>
          <ul className="space-y-1.5 pl-1">
            {[
              'Conversations deepen',
              'Trust stabilizes',
              'Loyalty strengthens',
              'Giving becomes expression, not extraction',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-blue))] flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
          <p className="text-[hsl(var(--marketing-navy))] font-medium">
            Paradoxically, preserving story increases sustainability.
          </p>
          <p>Because donors want to belong to a mission.</p>
          <p>Not be mined for revenue.</p>
        </div>
      </section>

      {/* ─── SECTION 6 — WORKS WITH YOUR CRM ─── */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-24">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-8"
            style={serif}
          >
            CROS Is the Relational Layer Above Your Fundraising System.
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg">
            <p>CROS does not replace:</p>
            <ul className="space-y-1.5 pl-1">
              {['Donation processing', 'Tax receipts', 'Campaign reporting'].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.3)] flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <p>It layers above them.</p>
            <p className="text-[hsl(var(--marketing-navy))] font-medium">
              Your CRM tracks gifts.
            </p>
            <p className="text-[hsl(var(--marketing-navy))] font-medium">
              CROS preserves people.
            </p>
            <p className="mt-6">
              <Link to="/relatio-campaigns" className="text-[hsl(var(--marketing-blue))] hover:underline font-medium">
                CROS Bridge™
              </Link>{' '}
              integrates with:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Salesforce', 'Bloomerang', 'HubSpot', 'Planning Center', 'Dynamics', 'Blackbaud', 'CiviCRM', 'Google Contacts', 'Outlook', 'Monica CRM', 'Contacts+'].map((crm) => (
                <span
                  key={crm}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-navy)/0.7)]"
                >
                  {crm}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-sm">
              <Link to="/relatio-campaigns" className="text-[hsl(var(--marketing-blue))] hover:underline">
                CROS Bridge™ →
              </Link>
              <Link to="/why-cros" className="text-[hsl(var(--marketing-blue))] hover:underline">
                Why CROS →
              </Link>
              <Link to="/compare" className="text-[hsl(var(--marketing-blue))] hover:underline">
                Compare →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-20 sm:py-28 text-center">
        <div className="max-w-[640px] mx-auto px-4 sm:px-6">
          <img
            src={ctaImg}
            alt="Renaissance ink sketch of two hands in a firm handshake"
            loading="lazy"
            className="rounded-xl mx-auto mb-10 max-w-[360px] w-full opacity-90"
          />
          <h2
            className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] leading-snug mb-3"
            style={serif}
          >
            Protect Revenue. Preserve Humanity.
          </h2>
          <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] mb-10 leading-relaxed">
            Add the relational layer your fundraising system was never designed to hold.
          </p>
          <Link to="/contact">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              Book a Mission Architecture Call <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
