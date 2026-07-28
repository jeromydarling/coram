/**
 * Roles — Role selector marketing page.
 *
 * WHAT: Presents the three CROS™ human roles: Shepherd, Companion, Visitor.
 * WHERE: /roles
 * WHY: Helps visitors instantly see "this is for me" without jargon overload.
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDiscernmentSignal } from '@/hooks/useDiscernmentSignal';
import { Button } from '@/components/ui/button';
import { ArrowRight, Compass, HeartHandshake, MapPin, Shield } from 'lucide-react';
import rolesHero from '@/assets/roles-hero.webp';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import RoleSelector from '@/components/marketing/RoleSelector';
import NarrativeCTA from '@/components/marketing/NarrativeCTA';
import CivicSignalBlock from '@/components/marketing/CivicSignalBlock';
import { faqSchema } from '@/lib/seo/seoConfig';
import RelatedNarrativesCard from '@/components/marketing/RelatedNarrativesCard';

const rolesFaq = [
  { question: 'What is a Shepherd in CROS?', answer: 'A Shepherd carries the vision and holds the story of a community — guiding mission, nurturing long-term relationships, and noticing patterns across people and time.' },
  { question: 'What is a Companion?', answer: 'A Companion walks alongside people, keeping the thread of care unbroken through follow-ups, reflections, and day-to-day relationship tasks.' },
  { question: 'What is a Visitor?', answer: 'A Visitor shows up where life happens — homes, events, neighborhoods — and captures moments with voice notes instead of forms.' },
  { question: 'What is a Steward?', answer: 'A Steward is the workspace caretaker — they set up CROS, invite the team, and manage integrations. Often they also serve as a Shepherd or Companion.' },
];

type RoleKey = 'shepherd' | 'companion' | 'visitor' | 'steward';
const roleIconMap: { key: RoleKey; Icon: React.ComponentType<{ className?: string }>; to: string }[] = [
  { key: 'shepherd', Icon: Compass, to: '/roles/shepherd' },
  { key: 'companion', Icon: HeartHandshake, to: '/roles/companion' },
  { key: 'visitor', Icon: MapPin, to: '/roles/visitor' },
  { key: 'steward', Icon: Shield, to: '/roles/steward' },
];
const bulletKeys = ['whatYouDo', 'whatYouSee', 'whatYouAvoid'] as const;

export default function Roles() {
  const { t } = useTranslation('marketing');
  const emit = useDiscernmentSignal('roles');
  useEffect(() => { emit('page_view'); }, [emit]);
  return (
    <div className="bg-white">
      <SeoHead
        title="Roles — Shepherd, Companion, Visitor"
        description="CROS™ adapts to how you serve people — whether you lead, walk alongside, or show up in the field."
        keywords={['CROS roles', 'shepherd', 'companion', 'visitor', 'nonprofit roles', 'community roles']}
        canonical="/roles"
        jsonLd={faqSchema(rolesFaq)}
      />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img src={rolesHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-12 text-center">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {t('rolesPage.heroHeading')}
        </h1>
        <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed">
          {t('rolesPage.heroSubheading')}
        </p>
        </div>
      </section>

      {/* Role cards */}
      <section className="max-w-[960px] mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Roles' }]} />
        <div className="grid gap-6 sm:gap-8">
          {roleIconMap.map(({ key, Icon, to }) => (
            <div
              key={key}
              className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] p-6 sm:p-8 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center shrink-0">
                  <Icon className="h-6 w-6 text-[hsl(var(--marketing-blue))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2
                    className="text-xl sm:text-2xl font-semibold text-[hsl(var(--marketing-navy))] mb-1"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    {t(`rolesPageCards.${key}.title`)}
                  </h2>
                  <p className="text-[hsl(var(--marketing-navy)/0.6)] mb-4 leading-relaxed">{t(`rolesPageCards.${key}.identity`)}</p>
                  <ul className="space-y-2.5 mb-5">
                    {bulletKeys.map((bk) => (
                      <li key={bk} className="text-sm leading-relaxed">
                        <span className="font-medium text-[hsl(var(--marketing-navy))]">{t(`rolesPageCards.bulletLabels.${bk}`)}:</span>{' '}
                        <span className="text-[hsl(var(--marketing-navy)/0.55)]">{t(`rolesPageCards.${key}.bullets.${bk}`)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={to}>
                    <Button
                      variant="outline"
                      className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy))] hover:bg-[hsl(var(--marketing-surface))] px-6"
                    >
                      {t(`rolesPageCards.${key}.cta`)} <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Role Selector */}
      <section className="max-w-[960px] mx-auto px-4 sm:px-6">
        <RoleSelector />
      </section>

      {/* Civic Signals */}
      <CivicSignalBlock />

      {/* Quiet CTA */}
      <NarrativeCTA variant="begin_rhythm" />

      {/* Narrative graph connections */}
      <div className="max-w-[960px] mx-auto px-4 sm:px-6">
        <RelatedNarrativesCard currentPath="/roles" />
      </div>

      <SeoInternalLinks
        heading={t('rolesPage.seoLinksHeading')}
        links={[
          { label: 'Archetypes', to: '/archetypes', description: 'Find your mission type.' },
          { label: 'NRI', to: '/nri', description: 'Narrative Relational Intelligence explained.' },
          { label: 'Signals', to: '/signals', description: 'Anonymized narrative signals.' },
          { label: 'Pricing', to: '/pricing', description: 'Plans for every mission size.' },
        ]}
      />
    </div>
  );
}
