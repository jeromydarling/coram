/**
 * RolePathwayPage — Identity-first discovery page for each role.
 *
 * WHAT: Narrative journey page that helps visitors recognize their role before signup.
 * WHERE: /path/:roleSlug (shepherd, companion, steward, visitor)
 * WHY: Visitors should feel recognized before they feel sold to.
 */
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { articleSchema, faqSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import ArchetypeResonanceCard from '@/components/marketing/ArchetypeResonanceCard';
import { useRoleCapture } from '@/hooks/useRoleCapture';
import type { ArchetypeKey } from '@/config/brand';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface RoleData {
  title: string;
  identity: string;
  description: string;
  seoDesc: string;
  signals: string[];
  weekCards: { day: string; moment: string }[];
  archetypes: ArchetypeKey[];
  faq: { question: string; answer: string }[];
}

const roleContent: Record<string, RoleData> = {
  shepherd: {
    title: 'The Shepherd',
    identity: 'You might be a Shepherd if\u2026',
    description: 'You hold the longer story. You notice when someone drifts. You carry the mission forward even when no one is watching.',
    seoDesc: 'Discover the Shepherd pathway in CROS\u2122 \u2014 for those who hold the longer story of their community.',
    signals: [
      'You notice when a family stops showing up before anyone else does.',
      'You think in seasons, not sprints.',
      'You remember stories others have forgotten.',
      'You lead by listening first.',
    ],
    weekCards: [
      { day: 'Monday', moment: 'Review last week\u2019s reflections. A Companion flagged two families needing follow-up.' },
      { day: 'Tuesday', moment: 'NRI surfaces a drift signal \u2014 a long-standing volunteer hasn\u2019t been seen in three weeks.' },
      { day: 'Wednesday', moment: 'You write a private reflection about what the community needs this season.' },
      { day: 'Thursday', moment: 'Testimonium generates a narrative summary of this month\u2019s outreach rhythms.' },
      { day: 'Friday', moment: 'You share a gentle nudge with your Companions about next week\u2019s focus.' },
    ],
    archetypes: ['church', 'refugee_support', 'social_enterprise'],
    faq: [
      { question: 'What does a Shepherd do in CROS\u2122?', answer: 'A Shepherd holds the longer narrative of a community \u2014 tracking mission continuity, drift detection, and reflective leadership.' },
      { question: 'Is the Shepherd role for pastors only?', answer: 'No. Any mission leader, executive director, or program visionary can serve as a Shepherd.' },
    ],
  },
  companion: {
    title: 'The Companion',
    identity: 'You might be a Companion if\u2026',
    description: 'You keep the thread. You follow up. You remember the small details that make people feel known.',
    seoDesc: 'Discover the Companion pathway in CROS\u2122 \u2014 for those who keep the thread of daily relationship work.',
    signals: [
      'You\u2019re the one who remembers birthdays, check-ins, and last conversations.',
      'You turn emails into action without being asked.',
      'You bridge the gap between the mission and the person.',
      'You notice when something feels off \u2014 and you act on it gently.',
    ],
    weekCards: [
      { day: 'Monday', moment: 'Your task inbox shows three follow-ups from last week\u2019s conversations.' },
      { day: 'Tuesday', moment: 'An email arrives \u2014 NRI suggests linking it to a partner journey.' },
      { day: 'Wednesday', moment: 'You record a quick reflection after a meaningful phone call.' },
      { day: 'Thursday', moment: 'Signum flags a local event that matches a partner\u2019s interests.' },
      { day: 'Friday', moment: 'You update a journey chapter \u2014 the story continues.' },
    ],
    archetypes: ['church', 'digital_inclusion', 'education_access'],
    faq: [
      { question: 'What does a Companion do in CROS\u2122?', answer: 'A Companion handles day-to-day relationship work \u2014 follow-ups, email-to-task flows, and maintaining the human connection.' },
      { question: 'Do I need to be full-time to be a Companion?', answer: 'No. Many Companions are part-time staff or dedicated volunteers who simply care about keeping relationships alive.' },
    ],
  },
  steward: {
    title: 'The Steward',
    identity: 'You might be a Steward if\u2026',
    description: 'You keep the systems running. You make sure the data is clean, the tools are ready, and the team can focus on people.',
    seoDesc: 'Discover the Steward pathway in CROS\u2122 \u2014 for those who keep the systems running behind the mission.',
    signals: [
      'You care about clean data as much as good relationships.',
      'You\u2019re the one who sets up the tools so others can do the work.',
      'You think about privacy, security, and sustainable systems.',
      'You find joy in making things run smoothly.',
    ],
    weekCards: [
      { day: 'Monday', moment: 'Review system health \u2014 check import status and data quality signals.' },
      { day: 'Tuesday', moment: 'Configure a new Relatio integration for the team.' },
      { day: 'Wednesday', moment: 'Run a Pr\u014dv\u012bsi\u014d request for a partner who needs a new device.' },
      { day: 'Thursday', moment: 'Review volunteer hour submissions in the Volunt\u0101rium inbox.' },
      { day: 'Friday', moment: 'Generate a Testimonium report for the board meeting.' },
    ],
    archetypes: ['digital_inclusion', 'library_system', 'workforce'],
    faq: [
      { question: 'What does a Steward do in CROS\u2122?', answer: 'A Steward manages the operational layer \u2014 data imports, integrations, provisions, and reporting.' },
      { question: 'Is the Steward role technical?', answer: 'It can be, but CROS\u2122 is designed so that Stewards don\u2019t need engineering skills \u2014 just care and attention.' },
    ],
  },
  visitor: {
    title: 'The Visitor',
    identity: 'You might be a Visitor if\u2026',
    description: 'You go where the people are. You listen first. You bring back stories that change how the mission moves.',
    seoDesc: 'Discover the Visitor pathway in CROS\u2122 \u2014 for those who carry the witness through mobile-first field work.',
    signals: [
      'You spend more time in the field than at a desk.',
      'You capture moments \u2014 voice notes, quick observations, quiet realizations.',
      'You\u2019re the eyes and ears of the mission.',
      'You believe presence matters more than process.',
    ],
    weekCards: [
      { day: 'Monday', moment: 'Check today\u2019s visit schedule on your phone. Three homes, one community center.' },
      { day: 'Tuesday', moment: 'Record a voice note after a home visit \u2014 it becomes a field note in Impulsus.' },
      { day: 'Wednesday', moment: 'A quick photo capture adds context to a partner\u2019s journey.' },
      { day: 'Thursday', moment: 'Your Companion follows up on yesterday\u2019s observations.' },
      { day: 'Friday', moment: 'The Shepherd reads your week\u2019s notes \u2014 a pattern emerges.' },
    ],
    archetypes: ['church', 'refugee_support', 'education_access'],
    faq: [
      { question: 'What does a Visitor do in CROS\u2122?', answer: 'A Visitor works mobile-first in the field \u2014 recording voice notes, capturing moments, and bringing stories back to the team.' },
      { question: 'Do Visitors need a laptop?', answer: 'No. CROS\u2122 is designed mobile-first, so Visitors can do everything from their phone.' },
    ],
  },
};

const validSlugs = Object.keys(roleContent);

export default function RolePathwayPage() {
  const { t } = useTranslation('marketing');
  const { roleSlug } = useParams<{ roleSlug: string }>();
  useRoleCapture();

  if (!roleSlug || !validSlugs.includes(roleSlug)) {
    return <Navigate to="/roles" replace />;
  }

  const data = roleContent[roleSlug];

  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Roles', to: '/roles' },
    { label: data.title },
  ];

  return (
    <>
      <SeoHead
        title={`${data.title} Pathway — CROS\u2122`}
        description={data.seoDesc}
        canonical={`/path/${roleSlug}`}
        jsonLd={[
          articleSchema({ headline: `${data.title} Pathway`, description: data.seoDesc, url: `/path/${roleSlug}` }),
          faqSchema(data.faq),
          breadcrumbSchema(crumbs.map(c => ({ name: c.label, url: c.to ?? '' }))),
        ]}
      />
      <SeoBreadcrumb items={crumbs} />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-20">
        {/* Hero */}
        <section className="pt-10 pb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-3">
            {t('rolePathwayPage.eyebrow')}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
            {data.identity}
          </h1>
          <p className="text-base text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-lg mx-auto" style={serif}>
            {data.description}
          </p>
        </section>

        {/* Identity Signals */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('rolePathwayPage.signalsHeading')}
          </h2>
          <ul className="space-y-3">
            {data.signals.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.25)] flex-shrink-0" />
                <span className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Week-in-Life */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('rolePathwayPage.weekHeading')}
          </h2>
          <div className="space-y-3">
            {data.weekCards.map((card) => (
              <div
                key={card.day}
                className="rounded-xl bg-[hsl(var(--marketing-surface))] p-4 sm:p-5"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-1.5">
                  {card.day}
                </p>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed" style={serif}>
                  {card.moment}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Archetype Resonance */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('rolePathwayPage.archetypesHeading')}
          </h2>
          <div className="space-y-4">
            {data.archetypes.map((a) => (
              <ArchetypeResonanceCard key={a} archetypeSlug={a} />
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('rolePathwayPage.faqHeading')}
          </h2>
          <div className="space-y-4">
            {data.faq.map((f, i) => (
              <div key={i} className="rounded-xl bg-[hsl(var(--marketing-surface))] p-5">
                <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-2">{f.question}</h3>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{f.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Quiet CTA */}
        <section className="py-12 text-center">
          <h3 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-2" style={serif}>
            {t('rolePathwayPage.ctaHeading')}
          </h3>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-6">
            {t('rolePathwayPage.ctaBody')}
          </p>
          <Link to={`/pricing?role=${roleSlug}`}>
            <Button className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-6 h-11 text-sm">
              {t('rolePathwayPage.ctaButton')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </section>
      </div>
    </>
  );
}
