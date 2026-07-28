/**
 * RelationalFundraising — /fundraising-without-a-donor-crm
 *
 * WHAT: SEO-optimized narrative page on relational generosity philosophy.
 * WHERE: Public marketing site.
 * WHY: Positions CROS as a relationship-first alternative — with basic generosity records.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Heart, Users, HandHeart, Church, Sparkles, Globe } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';

const serif = { fontFamily: '"Instrument Serif", Georgia, serif' };

const EXAMPLES = [
  {
    icon: Church,
    title: 'A small church builds a food pantry network',
    body: "Pastor Sarah didn't track donations. She tracked conversations. CROS helped her remember who offered their garage, who knew a produce distributor, and who had driven the same route for three years. The pantry grew because the relationships were already there — she just needed a way to remember them.",
  },
  {
    icon: Users,
    title: 'A refugee resettlement org finds housing partners',
    body: "When families arrived, the team didn't need a fundraising thermometer. They needed to know which landlords had shown compassion before, which volunteers spoke Dari, and which church had offered a welcome dinner last spring. CROS remembered what spreadsheets forgot.",
  },
  {
    icon: Globe,
    title: 'A digital inclusion nonprofit grows through presence',
    body: "They never sent a fundraising appeal. Instead, they showed up — at community meetings, at library events, at school board sessions. CROS captured those moments as reflections, building a narrative of presence that eventually attracted three anchor partners without a single ask.",
  },
];

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Fundraising Without a Donor CRM',
  description: 'How CROS supports generosity through presence, relationships, and basic giving records — not donation management.',
  author: { '@type': 'Organization', name: 'CROS' },
  publisher: { '@type': 'Organization', name: 'CROS', url: 'https://thecros.lovable.app' },
};

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Does CROS track donations?',
      acceptedAnswer: { '@type': 'Answer', text: 'CROS includes basic generosity records — date, amount, recurring status, and a note — so you can honor the people who give. But it is not a donor management system. There are no campaigns, pledges, tax receipts, or donor scores.' },
    },
    {
      '@type': 'Question',
      name: 'How does CROS support fundraising without being a donor CRM?',
      acceptedAnswer: { '@type': 'Answer', text: 'CROS helps organizations remember people, capture relationship moments, and build narrative around community engagement. Basic giving records provide relational context — honoring generosity as part of a person\'s story, not as a transaction to manage.' },
    },
  ],
};

export default function RelationalFundraising() {
  useEffect(() => {
    document.title = 'Fundraising Without a Donor CRM | CROS';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'CROS includes basic generosity records to honor giving — but it is not a donor CRM. Learn how relationship memory replaces donor management.');
    else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = 'CROS includes basic generosity records to honor giving — but it is not a donor CRM. Learn how relationship memory replaces donor management.';
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <SeoHead title="Fundraising Without a Donor CRM — Relational Generosity" description="Why relationships come before donations. A narrative on relational generosity, and how CROS supports basic generosity records without turning people into donors." canonical="/fundraising-without-a-donor-crm" />
        {/* Hero */}
        <header className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-4">
            <Heart className="h-3.5 w-3.5" /> Philosophy
          </span>
          <h1
            className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-5"
            style={serif}
          >
            Fundraising Without a Donor CRM
          </h1>
          <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-xl mx-auto">
            CROS™ includes basic generosity records — but it is not a donor management system.
            <br />
            It supports the relationships that make giving possible.
          </p>
        </header>

        {/* Section 1: Why relationships > transactions */}
        <section className="mb-16">
          <h2
            className="text-xl sm:text-2xl font-semibold text-[hsl(var(--marketing-navy))] mb-4"
            style={serif}
          >
            Why Relationships Matter More Than Transactions
          </h2>
          <div className="space-y-4 text-sm sm:text-base text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed">
            <p>
              Most nonprofit technology begins with money. How much was given. When. By whom. What campaign triggered it. The entire architecture is designed around the transaction.
            </p>
            <p>
              But generosity doesn't begin with a transaction. It begins with trust. With presence. With someone showing up — again and again — until a relationship forms that makes giving feel natural, not extracted.
            </p>
            <p>
              CROS was built on a different premise: <strong className="text-[hsl(var(--marketing-navy))]">if you remember the people, the generosity follows.</strong> Not because you tracked it. Because you earned it.
            </p>
          </div>
        </section>

        {/* Section 2: Generosity in CROS */}
        <section className="mb-16">
          <h2
            className="text-xl sm:text-2xl font-semibold text-[hsl(var(--marketing-navy))] mb-4"
            style={serif}
          >
            What CROS Does — and What It Doesn't
          </h2>
          <div className="space-y-4 text-sm sm:text-base text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed mb-8">
            <p>
              CROS includes <strong className="text-[hsl(var(--marketing-navy))]">basic generosity records</strong> — date, amount, whether it's recurring, and a personal note. These records live on a person's profile as relational context, not as financial data to manage.
            </p>
            <p>
              This is not donor management. There are no campaigns, pledge tracking, tax receipts, donor scores, or fundraising thermometers. Generosity data never influences how NRI™ prioritizes people or relationships — that boundary is architecturally enforced.
            </p>
            <p>
              Instead, CROS gives you <strong className="text-[hsl(var(--marketing-navy))]">relationship memory</strong>. Every reflection, every event attended, every conversation captured becomes part of a living narrative — and generosity is simply one thread in that story.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: HandHeart, label: 'Generosity Records', desc: 'Basic giving history — date, amount, recurring status — honored, not managed.' },
              { icon: Sparkles, label: 'NRI Intelligence', desc: 'Narrative insights grounded in human experience. Generosity never drives prioritization.' },
              { icon: Users, label: 'Relationship Memory', desc: 'Reflections, journeys, and conversations — the context that makes generosity meaningful.' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[hsl(var(--marketing-border))] p-5 text-center">
                <item.icon className="h-6 w-6 text-[hsl(var(--marketing-blue))] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">{item.label}</p>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Real ministry examples */}
        <section className="mb-16">
          <h2
            className="text-xl sm:text-2xl font-semibold text-[hsl(var(--marketing-navy))] mb-6"
            style={serif}
          >
            Real Ministry Examples
          </h2>
          <div className="space-y-6">
            {EXAMPLES.map((ex) => (
              <div key={ex.title} className="rounded-xl border border-[hsl(var(--marketing-border))] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <ex.icon className="h-5 w-5 text-[hsl(var(--marketing-blue))] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
                      {ex.title}
                    </h3>
                    <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
                      {ex.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* If you already have a donor CRM */}
        <section className="mb-16">
          <div className="rounded-xl bg-[hsl(var(--marketing-surface))] border border-[hsl(var(--marketing-border))] p-6 sm:p-8">
            <h3
              className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3"
              style={serif}
            >
              Already have a donor CRM?
            </h3>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-3">
              CROS doesn't replace your donor CRM — it complements it. With CROS Bridge™, you can sync contacts and relationship data from platforms like Bloomerang, DonorPerfect, Little Green Light, NeonCRM, and CiviCRM. Generosity records from these systems flow into CROS as read-only relational context.
            </p>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed italic">
              Your donor CRM handles the receipts. CROS holds the relationships.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center pt-8 border-t border-[hsl(var(--marketing-border))]">
          <h3
            className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-2"
            style={serif}
          >
            Ready to lead with relationships?
          </h3>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-6">
            CROS helps your organization grow without losing its humanity.
          </p>
          <Link to="/contact">
            <Button className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-6 h-11 text-sm">
              Start a conversation <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </section>
      </div>
  );
}
