import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDiscernmentSignal } from '@/hooks/useDiscernmentSignal';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Church, Building2, Users, Heart, Library, GraduationCap, HeartHandshake, Globe, Mountain } from 'lucide-react';
import archetypesHero from '@/assets/archetypes-hero.webp';
import { archetypes, type ArchetypeKey } from '@/config/brand';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import RoleIdentityBlock from '@/components/seo/RoleIdentityBlock';
import RoleSelector from '@/components/marketing/RoleSelector';
import NarrativeCTA from '@/components/marketing/NarrativeCTA';
import CivicSignalBlock from '@/components/marketing/CivicSignalBlock';

const iconMap: Record<ArchetypeKey, React.ComponentType<{ className?: string }>> = {
  church: Church,
  digital_inclusion: Building2,
  social_enterprise: Building2,
  workforce: Users,
  refugee_support: Heart,
  education_access: GraduationCap,
  library_system: Library,
  caregiver_solo: HeartHandshake,
  caregiver_agency: HeartHandshake,
  missionary_org: Globe,
  retreat_center: Mountain,
};

const weekRoutes: Partial<Record<ArchetypeKey, string>> = {
  church: '/archetypes/church-week',
  digital_inclusion: '/archetypes/nonprofit-week',
  social_enterprise: '/archetypes/social-enterprise-week',
  refugee_support: '/archetypes/community-network-week',
  workforce: '/archetypes/ministry-outreach-week',
  caregiver_solo: '/archetypes/caregiver-solo-week',
  caregiver_agency: '/archetypes/caregiver-agency-week',
  missionary_org: '/archetypes/missionary-org-week',
};

const examples: Record<ArchetypeKey, { journeys: string[]; reflections: string; signals: string }> = {
  church: {
    journeys: ['First Visit', 'Pastoral Care', 'Small Group', 'Serving Team', 'Leadership'],
    reflections: '"Spoke with Marcus after the service — his family is still adjusting after the move."',
    signals: 'Local food pantry announced expanded Saturday hours.',
  },
  digital_inclusion: {
    journeys: ['Identified Need', 'Device Matched', 'Connected', 'Digital Skills', 'Self-Sufficient'],
    reflections: '"The Rivera family now has stable internet — kids are doing homework online for the first time."',
    signals: 'FCC broadband funding application deadline approaching.',
  },
  social_enterprise: {
    journeys: ['Community Contact', 'Needs Assessment', 'Program Enrollment', 'Active Participant', 'Advocate'],
    reflections: '"Our partnership with the credit union is opening doors we didn\'t expect."',
    signals: 'New social enterprise accelerator launching in the metro.',
  },
  workforce: {
    journeys: ['Employer Outreach', 'Needs Mapping', 'Training Program', 'Placement', 'Retention Check-in'],
    reflections: '"Three graduates from the March cohort have been promoted within 6 months."',
    signals: 'Major employer announced 200 new warehouse positions.',
  },
  refugee_support: {
    journeys: ['Arrival', 'Housing Settled', 'Language Support', 'Employment Readiness', 'Community Integration'],
    reflections: '"Amina\'s family celebrated their first Thanksgiving with their sponsor family."',
    signals: 'New resettlement cohort arriving next month — 12 families.',
  },
  education_access: {
    journeys: ['Outreach', 'Enrollment Support', 'Tutoring Match', 'Progress Tracking', 'Graduation'],
    reflections: '"The after-school program at Lincoln Elementary is at capacity — we need a second site."',
    signals: 'State education funding bill passed committee.',
  },
  library_system: {
    journeys: ['Community Contact', 'Program Awareness', 'Regular Patron', 'Volunteer', 'Ambassador'],
    reflections: '"The ESL conversation circles are drawing 30+ people on Tuesday evenings."',
    signals: 'City council discussing extended library weekend hours.',
  },
  caregiver_solo: {
    journeys: ['First Visit', 'Building Trust', 'Steady Rhythm', 'Deepening Care', 'Transition'],
    reflections: '"Mrs. Chen smiled today for the first time in weeks — she told me about her garden."',
    signals: 'New respite care program available in your county.',
  },
  caregiver_agency: {
    journeys: ['Intake', 'Care Team Assigned', 'Active Care', 'Progress Review', 'Care Transition'],
    reflections: '"Three caregivers independently noted that Mr. Davis seems more withdrawn this month."',
    signals: 'State licensing renewal deadline approaching for home care agencies.',
  },
  missionary_org: {
    journeys: ['Field Discovery', 'Relationship Building', 'Active Partnership', 'Local Leadership', 'Multiplication'],
    reflections: '"The team in Quito noticed families are asking about literacy classes — same pattern as last year in Medellín."',
    signals: 'New visa requirements announced for mission workers in Southeast Asia.',
  },
  retreat_center: {
    journeys: ['Inquiry', 'Registered', 'Retreatant', 'Returning Guest', 'Spiritual Companion'],
    reflections: '"Sister Maria noticed that this year\'s silent retreat group is the most reflective she\'s seen in a decade."',
    signals: 'Diocesan formation office seeking retreat partners for Lenten season.',
  },
};

export default function ArchetypesPage() {
  const { t } = useTranslation('marketing');
  const emit = useDiscernmentSignal('archetypes');
  useEffect(() => { emit('page_view'); }, [emit]);
  return (
    <div className="bg-white">
      <SeoHead
        title={t('archetypesPage.title')}
        description={t('archetypesPage.description')}
        keywords={['mission archetypes', 'church CRM', 'nonprofit CRM', 'social enterprise tools', 'community technology']}
        canonical="/archetypes"
      />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img src={archetypesHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {t('archetypesPage.title')}
          </h1>
          <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed">
            {t('archetypesPage.heroBody')}
          </p>
        </div>
      </section>

      {/* Archetype cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Archetypes' }]} />
        <div className="space-y-6">
          {(Object.keys(archetypes) as ArchetypeKey[]).map((key) => {
            const arch = archetypes[key];
            const Icon = iconMap[key];
            const ex = examples[key];
            const weekRoute = weekRoutes[key];
            return (
              <div
                key={key}
                className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] p-6 sm:p-8 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))]">{arch.name}</h3>
                    <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)]">{arch.tagline}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-5 text-sm">
                  <div>
                    <p className="font-medium text-[hsl(var(--marketing-navy)/0.4)] uppercase text-xs tracking-wider mb-2">
                      {t('archetypesPage.exampleJourneysLabel')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ex.journeys.map((j) => (
                        <span
                          key={j}
                          className="inline-block bg-[hsl(var(--marketing-surface))] text-[hsl(var(--marketing-navy)/0.7)] px-2.5 py-1 rounded-full text-xs"
                        >
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-[hsl(var(--marketing-navy)/0.4)] uppercase text-xs tracking-wider mb-2">
                      {t('archetypesPage.exampleReflectionLabel')}
                    </p>
                    <p className="text-[hsl(var(--marketing-navy)/0.6)] italic leading-relaxed">{ex.reflections}</p>
                  </div>
                  <div>
                    <p className="font-medium text-[hsl(var(--marketing-navy)/0.4)] uppercase text-xs tracking-wider mb-2">
                      {t('archetypesPage.communitySignalLabel')}
                    </p>
                    <p className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{ex.signals}</p>
                  </div>
                </div>

                {weekRoute && (
                  <div className="mt-5 pt-5 border-t border-[hsl(var(--marketing-border))] flex flex-wrap gap-2">
                    <Link to={weekRoute}>
                      <Button
                        variant="outline"
                        className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy)/0.7)] hover:text-[hsl(var(--marketing-navy))] hover:border-[hsl(var(--marketing-navy)/0.4)]"
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        {t('archetypesPage.readWeekInside')}
                      </Button>
                    </Link>
                    <Link to={`/archetypes/${key}/deep`}>
                      <Button
                        variant="outline"
                        className="rounded-full border-[hsl(var(--marketing-blue)/0.2)] text-[hsl(var(--marketing-blue))] hover:border-[hsl(var(--marketing-blue)/0.4)]"
                      >
                        {t('archetypesPage.deepDive')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Role Selector */}
        <RoleSelector />

        {/* Role identity block */}
        <RoleIdentityBlock heading={t('archetypesPage.roleIdentityHeading')} />
      </section>

      {/* Civic Signals */}
      <CivicSignalBlock />

      {/* Quiet CTA */}
      <NarrativeCTA variant="begin_rhythm" />
      <SeoInternalLinks
        heading={t('archetypesPage.seoLinks.heading')}
        links={[
          { label: t('archetypesPage.seoLinks.pricing'), to: '/pricing', description: t('archetypesPage.seoLinks.pricingDesc') },
          { label: t('archetypesPage.seoLinks.roles'), to: '/roles', description: t('archetypesPage.seoLinks.rolesDesc') },
          { label: t('archetypesPage.seoLinks.insights'), to: '/insights', description: t('archetypesPage.seoLinks.insightsDesc') },
        ]}
      />
    </div>
  );
}
