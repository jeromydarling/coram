/**
 * CallingPage — Thematic calling pages for deep topical SEO authority.
 *
 * WHAT: Narrative page connecting a calling theme to roles, archetypes, and civic signals.
 * WHERE: /calling/:themeSlug
 * WHY: Generates organic discovery by matching visitor intent to mission themes.
 */
import { useParams, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { articleSchema, faqSchema, breadcrumbSchema } from '@/lib/seo/seoConfig';
import CivicSignalBlock from '@/components/marketing/CivicSignalBlock';
import { useArchetypeCapture } from '@/hooks/useArchetypeCapture';
import { supabase } from '@/integrations/supabase/client';
import type { ArchetypeKey } from '@/config/brand';
import { archetypes } from '@/config/brand';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface CallingData {
  title: string;
  description: string;
  seoDesc: string;
  narrative: string;
  themes: string[];
  archetypes: ArchetypeKey[];
  roles: { slug: string; label: string; why: string }[];
  faq: { question: string; answer: string }[];
}

const callingContent: Record<string, CallingData> = {
  'home-visitation': {
    title: 'Home Visitation',
    description: 'The ministry of presence — going where people are, listening before speaking, and carrying stories back.',
    seoDesc: 'Home visitation ministry and outreach — how CROS\u2122 supports teams who go where the people are.',
    narrative: 'Home visitation is one of the oldest forms of community care. It requires trust, consistency, and the ability to hold stories gently. CROS\u2122 was built with this rhythm in mind — mobile-first field notes, voice capture, and relationship memory that keeps the thread between visits.',
    themes: ['Field presence', 'Voice-to-transcript notes', 'Relationship continuity', 'Drift detection'],
    archetypes: ['church', 'refugee_support'],
    roles: [
      { slug: 'visitor', label: 'Visitor', why: 'Visitors carry the witness — recording moments in the field that become the community\u2019s memory.' },
      { slug: 'companion', label: 'Companion', why: 'Companions follow up on what Visitors discover, turning observations into sustained care.' },
      { slug: 'shepherd', label: 'Shepherd', why: 'Shepherds hold the longer arc — noticing when families drift and guiding the team\u2019s response.' },
    ],
    faq: [
      { question: 'How does CROS\u2122 support home visitation teams?', answer: 'CROS\u2122 provides mobile-first voice notes, field note capture, and relationship memory so nothing is lost between visits.' },
      { question: 'Can Visitors use CROS\u2122 without a laptop?', answer: 'Yes. CROS\u2122 is designed mobile-first — Visitors can record voice notes, update journeys, and capture moments entirely from their phone.' },
    ],
  },
  'parish-outreach': {
    title: 'Parish Outreach',
    description: 'Reaching beyond the walls — connecting with the neighborhood, the overlooked, and the not-yet-known.',
    seoDesc: 'Parish outreach and community engagement — how CROS\u2122 helps faith communities extend their reach with care.',
    narrative: 'Parish outreach is not a program — it\u2019s a posture. It means showing up in the neighborhood, noticing who isn\u2019t at the table, and building bridges that didn\u2019t exist before. CROS\u2122 supports this by tracking community signals, surfacing local events, and remembering the relationships that matter most.',
    themes: ['Community signals', 'Event discovery', 'Volunteer coordination', 'Narrative storytelling'],
    archetypes: ['church', 'social_enterprise'],
    roles: [
      { slug: 'shepherd', label: 'Shepherd', why: 'Shepherds guide outreach strategy by reading community patterns and holding the mission\u2019s longer story.' },
      { slug: 'companion', label: 'Companion', why: 'Companions maintain the human connection — following up, checking in, and keeping relationships warm.' },
      { slug: 'steward', label: 'Steward', why: 'Stewards keep the systems running — managing volunteer data, event tracking, and reporting.' },
    ],
    faq: [
      { question: 'How is CROS\u2122 different from a church management system?', answer: 'CROS\u2122 is not a church management system. It\u2019s a relationship operating system that helps you remember, notice, and serve people — without reducing them to data points.' },
      { question: 'Can CROS\u2122 help with volunteer coordination?', answer: 'Yes. Volunt\u0101rium tracks volunteer hours, availability, and engagement patterns so your outreach team stays coordinated.' },
    ],
  },
  'community-support': {
    title: 'Community Support',
    description: 'Sustaining the daily work of caring — for neighbors, families, and the systems that hold them.',
    seoDesc: 'Community support and social services — how CROS\u2122 helps organizations sustain the daily work of caring.',
    narrative: 'Community support work is relentless and often invisible. It requires remembering who needs what, when they last received it, and what changed since then. CROS\u2122 brings relationship memory to this work — so nothing falls through the cracks and every interaction builds on the last.',
    themes: ['Case continuity', 'Partner journeys', 'Resource coordination', 'Impact storytelling'],
    archetypes: ['digital_inclusion', 'workforce', 'education_access'],
    roles: [
      { slug: 'companion', label: 'Companion', why: 'Companions are the backbone of community support — managing daily interactions and keeping the thread alive.' },
      { slug: 'steward', label: 'Steward', why: 'Stewards ensure data flows cleanly, integrations work, and the team has the tools they need.' },
      { slug: 'visitor', label: 'Visitor', why: 'Visitors bring field intelligence back to the team — what\u2019s actually happening in people\u2019s lives.' },
    ],
    faq: [
      { question: 'Can CROS\u2122 replace our case management system?', answer: 'CROS\u2122 is not a case management system, but it complements one. It focuses on the relational layer — the human memory that case files can\u2019t capture.' },
      { question: 'How does CROS\u2122 handle sensitive data?', answer: 'CROS\u2122 is privacy-first. Reflections are sacred and private. No PII appears in public narratives. All data is tenant-isolated.' },
    ],
  },
};

const validSlugs = Object.keys(callingContent);

export default function CallingPage() {
  const { t } = useTranslation('marketing');
  const { themeSlug } = useParams<{ themeSlug: string }>();
  useArchetypeCapture();

  if (!themeSlug || !validSlugs.includes(themeSlug)) {
    return <Navigate to="/roles" replace />;
  }

  const data = callingContent[themeSlug];

  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Callings', to: '/roles' },
    { label: data.title },
  ];

  return (
    <>
      <SeoHead
        title={`${data.title} — CROS\u2122`}
        description={data.seoDesc}
        canonical={`/calling/${themeSlug}`}
        jsonLd={[
          articleSchema({ headline: data.title, description: data.seoDesc, url: `/calling/${themeSlug}` }),
          faqSchema(data.faq),
          breadcrumbSchema(crumbs.map(c => ({ name: c.label, url: c.to ?? '' }))),
        ]}
      />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pb-20">
        {/* Hero */}
        <section className="pt-10 pb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-3">
            {t('callingPage.eyebrow')}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
            {data.title}
          </h1>
          <p className="text-base text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-lg mx-auto" style={serif}>
            {data.description}
          </p>
        </section>

        {/* Narrative */}
        <section className="py-8">
          <SeoBreadcrumb items={crumbs} />
          <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] p-6 sm:p-8">
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed" style={serif}>
              {data.narrative}
            </p>
          </div>
        </section>

        {/* Themes */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('callingPage.narrativeThemesHeading')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.themes.map((t) => (
              <span
                key={t}
                className="inline-block bg-[hsl(var(--marketing-surface))] text-[hsl(var(--marketing-navy)/0.6)] px-4 py-2 rounded-full text-sm border border-[hsl(var(--marketing-navy)/0.08)]"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* Archetypes engaged */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('callingPage.archetypesHeading')}
          </h2>
          <div className="space-y-3">
            {data.archetypes.map((key) => {
              const arch = archetypes[key];
              if (!arch) return null;
              return (
                <Link
                  key={key}
                  to={`/archetypes/${key}/deep`}
                  className="block rounded-xl bg-[hsl(var(--marketing-surface))] p-5 hover:bg-white transition-colors"
                >
                  <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">{arch.name}</h3>
                  <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)]">{arch.tagline}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Civic Signals */}
        <CivicSignalBlock />

        {/* Suggested Roles */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('callingPage.rolesHeading')}
          </h2>
          <div className="space-y-3">
            {data.roles.map((r) => (
              <Link
                key={r.slug}
                to={`/path/${r.slug}`}
                className="block rounded-xl bg-[hsl(var(--marketing-surface))] p-5 hover:bg-white transition-colors"
              >
                <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy))] mb-1">{r.label}</h3>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed">{r.why}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="py-8">
          <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('callingPage.faqHeading')}
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
            {t('callingPage.ctaHeading')}
          </h3>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-6">
            {t('callingPage.ctaBody')}
          </p>
          <Link to={`/pricing?archetype=${data.archetypes[0]}`}>
            <Button className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-6 h-11 text-sm">
              {t('callingPage.ctaButton')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </section>
      </div>
    </>
  );
}
