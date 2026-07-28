import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Mail, Shield, Users, Repeat, CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';
import relatioHero from '@/assets/relatio-campaigns-hero.webp';
import SeoHead from '@/components/seo/SeoHead';

const migrationSources = [
  'Mailchimp',
  'Constant Contact',
  'Brevo',
  'ConvertKit',
  'HubSpot (via Relatio Bridge)',
  'Salesforce (via Relatio Bridge)',
  'Bloomerang, NeonCRM, DonorPerfect, Kindful, Little Green Light',
  'Planning Center, Rock RMS, Breeze, ParishSoft, MinistryPlatform, FellowshipOne',
  'FluentCRM, Jetpack CRM, WP ERP (WordPress-native)',
  'Zoho CRM, Airtable',
];

const migrationTools = [
  'CSV import and normalization',
  'Audience cleanup',
  'Contact deduplication',
  'Journey-aware tagging',
];

const howItWorks = [
  {
    icon: Users,
    title: 'Start with Relationships',
    body: 'Your contacts, journeys, and reflections already live inside CROS.\nRelatio uses that living context to guide who you reach — and why.',
  },
  {
    icon: Mail,
    title: 'Send through Gmail or Outlook',
    body: 'Your organization keeps ownership of its sending infrastructure.\nNo external bulk mail server required.',
  },
  {
    icon: Shield,
    title: 'Protect your voice',
    body: 'Relatio is built for thoughtful communication, not aggressive automation.\nDaily limits and safeguards help protect your reputation.',
  },
];

const whenToAdd = [
  "You're tired of exporting lists between systems",
  'Your outreach should reflect real conversations',
  'You want email tied to journeys, not funnels',
  "You're leaving Mailchimp, Constant Contact, or similar tools",
];

const safetyPoints = [
  'respects Gmail & Outlook sending limits',
  'prevents sudden volume spikes',
  'warns before approaching thresholds',
  'protects your sender reputation',
];

const comparisonRows: [string, string, string][] = [
  ['Approach', 'Subscriber-first', 'Relationship-first'],
  ['Workflow', 'Automation-heavy', 'Narrative-aware'],
  ['Metrics', 'Growth metrics focused', 'Human-centered outreach'],
  ['Integration', 'Separate from your CRM', 'Built inside CROS'],
  ['Audience', 'Designed for marketers', 'Designed for ministries, nonprofits, and community builders'],
];

export default function RelatioCampaigns() {
  useEffect(() => {
    document.title = 'Relatio Campaigns™ — Relationship-Based Email Outreach Inside CROS';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Send thoughtful outreach through Gmail or Outlook without exporting lists or managing complex marketing systems. Relatio Campaigns connects email directly to your living relationships inside CROS.');
  }, []);

  return (
    <>
      <SeoHead title="Relatio Campaigns — Thoughtful Outreach Through Your Own Inbox" description="Send thoughtful outreach through Gmail or Outlook without exporting lists or managing complex marketing systems. Relatio connects email directly to your relationships inside CROS." canonical="/relatio-campaigns" />
      <div className="bg-white">
        {/* ─── HERO ─── */}
        <header className="relative overflow-hidden">
          <img src={relatioHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
          <section className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14 sm:pb-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-4">
            Paid Add-on · $29 /mo
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-5">
            Relatio Campaigns™
          </h1>
          <p className="text-xl sm:text-2xl text-[hsl(var(--marketing-navy)/0.75)] font-medium leading-snug mb-6">
            Outreach built on relationships — not lists.
          </p>
          <div className="space-y-4 text-[hsl(var(--marketing-navy)/0.65)] text-base sm:text-lg leading-relaxed mb-10">
            <p>
              Most email platforms start with subscribers.<br />
              Relatio Campaigns begins with people you already know.
            </p>
            <p>
              Instead of exporting contacts into another system, your outreach grows directly from the relationships, journeys, and reflections inside CROS.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/pricing">
              <Button
                size="lg"
                className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
              >
                Add Campaigns to Your Plan <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#migration">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-8 h-12 text-base"
              >
                See How Migration Works
              </Button>
            </a>
          </div>
        </section>
        </header>

        {/* ─── WHY RELATIO EXISTS ─── */}
        <section className="bg-[hsl(var(--marketing-surface))]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-6">
              You don't need another marketing platform.
            </h2>
            <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] text-base sm:text-lg leading-relaxed">
              <p>
                Churches, nonprofits, and social enterprises often inherit complex email tools designed for growth metrics — not human connection.
              </p>
              <p>
                You end up managing lists instead of people.<br />
                Segments instead of stories.<br />
                Automation instead of intention.
              </p>
              <p>
                Relatio Campaigns removes that friction.
              </p>
              <p>
                It connects directly to Gmail or Outlook and turns your existing relationships into thoughtful outreach — without leaving CROS.
              </p>
            </div>
            <ul className="mt-8 space-y-3">
              {[
                'No exporting CSV files',
                'No juggling multiple systems',
                'No turning neighbors into "subscribers"',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-[hsl(var(--marketing-navy))] font-medium">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(var(--marketing-blue))] flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-10 text-center">
            Outreach that grows from your narrative.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((col) => (
              <div key={col.title} className="space-y-3">
                <col.icon className="h-8 w-8 text-[hsl(var(--marketing-blue))]" />
                <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))]">{col.title}</h3>
                <p className="text-[hsl(var(--marketing-navy)/0.6)] whitespace-pre-line leading-relaxed text-sm">
                  {col.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── WHEN TO ADD ─── */}
        <section className="bg-[hsl(var(--marketing-surface))]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3">
              You don't need campaigns on day one.
            </h2>
            <p className="text-[hsl(var(--marketing-navy)/0.6)] text-lg mb-8">
              You add them when your relationships begin asking to be heard.
            </p>
            <p className="text-[hsl(var(--marketing-navy)/0.75)] font-medium mb-4">Use Relatio when:</p>
            <ul className="space-y-3">
              {whenToAdd.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[hsl(var(--marketing-navy)/0.65)]">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-blue))] flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── MIGRATION ─── */}
        <section id="migration" className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-4">
            Leave bloated systems behind — gently.
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.65)] text-base sm:text-lg leading-relaxed mb-8">
            Many organizations start with email platforms because they feel like the easiest way to communicate at scale. But over time, those tools become heavier than the work itself.
          </p>

          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <h3 className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-3">
                Supported migrations from:
              </h3>
              <ul className="space-y-2">
                {migrationSources.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-[hsl(var(--marketing-navy)/0.65)]">
                    <Repeat className="h-3.5 w-3.5 text-[hsl(var(--marketing-blue))] flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-3">
                Migration tools included:
              </h3>
              <ul className="space-y-2">
                {migrationTools.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm text-[hsl(var(--marketing-navy)/0.65)]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--marketing-blue))] flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-8 text-sm text-[hsl(var(--marketing-navy)/0.5)] italic">
            Important: Relatio does NOT recreate complex marketing automation. It replaces the need for it.
          </p>

          <div className="mt-10 p-6 rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))]">
            <p className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-2">
              CROS connects to 30+ platforms — and counting.
            </p>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] mb-4">
              Whether you keep your existing CRM, ChMS, or donor platform as a companion — or let CROS run the whole show — your campaign audiences stay connected to real relationships.
            </p>
            <Link to="/integrations">
              <Button
                variant="outline"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-white px-6"
              >
                See all integrations <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* ─── HUMAN FIRST ─── */}
        <section className="bg-[hsl(var(--marketing-surface))]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-6">
              Campaigns should never replace presence.
            </h2>
            <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] text-base sm:text-lg leading-relaxed">
              <p>
                Relatio is designed around Narrative Relationship Intelligence (NRI™).
              </p>
              <p>
                That means:<br />
                • Email is part of the story — not the strategy.<br />
                • Outreach grows from reflection and experience.<br />
                • Technology supports your mission instead of reshaping it.
              </p>
              <p>
                You remain the nervous system of CROS.<br />
                Relatio simply amplifies what already exists.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SAFETY ─── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-6">
            Built for sustainable communication.
          </h2>
          <ul className="space-y-3 mb-6">
            {safetyPoints.map((pt) => (
              <li key={pt} className="flex items-center gap-3 text-[hsl(var(--marketing-navy))] font-medium">
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--marketing-blue))] flex-shrink-0" />
                {pt}
              </li>
            ))}
          </ul>
          <p className="text-[hsl(var(--marketing-navy)/0.6)] italic">
            Because the goal isn't more email. It's better connection.
          </p>
        </section>

        {/* ─── COMPARISON TABLE ─── */}
        <section className="bg-[hsl(var(--marketing-surface))]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-8 text-center">
              Relatio vs Traditional Email Platforms
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--marketing-border))]">
                    <th className="text-left py-3 pr-4 font-medium text-[hsl(var(--marketing-navy)/0.5)]" />
                    <th className="text-left py-3 px-4 font-semibold text-[hsl(var(--marketing-navy)/0.5)]">
                      Traditional Platforms
                    </th>
                    <th className="text-left py-3 pl-4 font-semibold text-[hsl(var(--marketing-navy))]">
                      Relatio Campaigns™
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map(([label, trad, rel]) => (
                    <tr key={label} className="border-b border-[hsl(var(--marketing-border))]">
                      <td className="py-3 pr-4 font-medium text-[hsl(var(--marketing-navy))]">{label}</td>
                      <td className="py-3 px-4 text-[hsl(var(--marketing-navy)/0.5)]">{trad}</td>
                      <td className="py-3 pl-4 text-[hsl(var(--marketing-navy))] font-medium">{rel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-4">
            When your relationships begin to speak,<br className="hidden sm:block" /> Relatio helps you listen — and respond.
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.6)] text-base sm:text-lg max-w-xl mx-auto mb-8">
            CROS works beautifully without campaigns. But when your community grows and your voice needs to travel further, Relatio Campaigns is ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/pricing">
              <Button
                size="lg"
                className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
              >
                Add Relatio Campaigns™ <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button
                variant="ghost"
                size="lg"
                className="text-[hsl(var(--marketing-navy)/0.6)] hover:text-[hsl(var(--marketing-navy))]"
              >
                Back to Pricing
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
