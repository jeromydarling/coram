/**
 * RoleCompanion — Companion role deep page.
 *
 * WHAT: Full narrative page for the Companion role with daily rhythm, modules, guides, stories.
 * WHERE: /roles/companion
 * WHY: SEO entry point for care workers discovering CROS through role identity.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, HeartHandshake, Mail, PenLine, Calendar } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import ConceptLinks from '@/components/seo/ConceptLinks';
import { articleSchema } from '@/lib/seo/seoConfig';
import { getRoleNode } from '@/lib/seo/roleGraph';
import { getGuidesForRole } from '@/content/roleGuides';
import { roleStories } from '@/content/roleStories';
import { useRoleCapture } from '@/hooks/useRoleCapture';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const features = [
  { Icon: Mail, title: 'Email-to-tasks', subtitle: 'Follow-ups that appear naturally', description: 'When an email signals a next step, CROS™ gently surfaces it. No manual entry. No lost threads. Just care that follows through.' },
  { Icon: PenLine, title: 'Reflections & Journaling', subtitle: 'Impulsus · Private impact journal', description: 'Write what you noticed, felt, or learned from a conversation. Reflections stay private — they\'re for you and the relationship, not a report.' },
  { Icon: Calendar, title: 'Events & Calendar', subtitle: 'Show up. Connect. Remember.', description: 'See community events, schedule visits, and let CROS™ remember who you met — so every encounter builds on the last.' },
];

const dailyRhythm = [
  { time: 'Morning', activity: 'Check your task list — follow-ups surfaced from email and calendar.' },
  { time: 'After a call', activity: 'Write a Reflection — two sentences about what you noticed.' },
  { time: 'Before a visit', activity: 'Glance at the person\'s Journey — remember where things stand.' },
  { time: 'After an event', activity: 'Log a quick note — who was there, what mattered.' },
  { time: 'End of day', activity: 'Review volunteer hours and provisions pending.' },
];

export default function RoleCompanion() {
  const { t } = useTranslation('marketing');
  useRoleCapture();
  const node = getRoleNode('companion');
  const guides = getGuidesForRole('companion');
  const stories = roleStories.filter((s) => s.role === 'companion');

  return (
    <div className="bg-white">
      <SeoHead
        title="Companion — Keep the Thread"
        description="Companions walk alongside people, keeping the thread of care unbroken. See how CROS™ supports daily relationship work."
        keywords={['CROS companion', 'care worker', 'relationship management', 'follow-up', 'community care']}
        canonical="/roles/companion"
        ogType="article"
        jsonLd={articleSchema({ headline: 'Companion — Keep the Thread', description: 'The Companion experience inside CROS™.', url: '/roles/companion' })}
      />

      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 text-center">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Roles', to: '/roles' }, { label: 'Companion' }]} />
        <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mx-auto mb-6">
          <HeartHandshake className="h-7 w-7 text-[hsl(var(--marketing-blue))]" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-2">{t('roleDeepPage.companion.eyebrow')}</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4" style={serif}>
          {t('roleDeepPage.companion.heroHeading')}
        </h1>
        <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed">
          {t('roleDeepPage.companion.heroBody')}
        </p>
      </section>

      <section className="max-w-[960px] mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-2xl font-semibold text-[hsl(var(--marketing-navy))] text-center mb-10" style={serif}>{t('roleDeepPage.whatYouLoveHeading')}</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map(({ Icon, title, subtitle, description }) => (
            <div key={title} className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] p-6 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all">
              <div className="w-11 h-11 rounded-xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mb-4"><Icon className="h-5 w-5 text-[hsl(var(--marketing-blue))]" /></div>
              <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-0.5" style={serif}>{title}</h3>
              <p className="text-xs text-[hsl(var(--marketing-navy)/0.4)] mb-3">{subtitle}</p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[640px] mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-6" style={serif}>{t('roleDeepPage.companion.dailyRhythmHeading')}</h2>
        <div className="space-y-3">
          {dailyRhythm.map((item, i) => (
            <div key={i} className="flex gap-4 items-start">
              <span className="text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.08)] px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 mt-0.5">{item.time}</span>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{item.activity}</p>
            </div>
          ))}
        </div>
      </section>

      {node && (
        <section className="max-w-[640px] mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>{t('roleDeepPage.modulesHeading')}</h2>
          <div className="space-y-2.5">
            {node.modules.map((m) => (
              <div key={m.name} className="flex items-center justify-between rounded-xl border border-[hsl(var(--marketing-border))] px-5 py-3">
                <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]">{m.name}</span>
                <span className="text-xs text-[hsl(var(--marketing-navy)/0.45)]">{m.description}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {guides.length > 0 && (
        <section className="max-w-[640px] mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>{t('roleDeepPage.workflowGuidesHeading')}</h2>
          <div className="space-y-2.5">
            {guides.map((g) => (
              <Link key={g.slug} to={`/roles/companion/${g.slug}`} className="block rounded-xl border border-[hsl(var(--marketing-border))] p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all">
                <h3 className="text-sm font-medium text-[hsl(var(--marketing-navy))]">{g.title}</h3>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)] mt-1">{g.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {stories.length > 0 && (
        <section className="max-w-[640px] mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>{t('roleDeepPage.storiesHeading')}</h2>
          <div className="space-y-2.5">
            {stories.map((s) => (
              <Link key={s.slug} to={`/stories/roles/${s.slug}`} className="block rounded-xl border border-[hsl(var(--marketing-border))] p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all">
                <h3 className="text-sm font-medium text-[hsl(var(--marketing-navy))]">{s.title}</h3>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)] mt-1">{s.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-[hsl(var(--marketing-surface))] py-16">
        <div className="max-w-[640px] mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>{t('roleDeepPage.teamFitHeading')}</h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-8">
            {t('roleDeepPage.companion.teamFitBody')}
          </p>
          <Link to="/pricing">
            <Button size="lg" className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base">
              {t('roleDeepPage.seePricing')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <ConceptLinks conceptSlug="companion" heading={t('roleDeepPage.relatedConceptsHeading')} />

      <SeoInternalLinks
        heading={t('roleDeepPage.seoLinksHeading')}
        links={[
          { label: 'Shepherd', to: '/roles/shepherd', description: 'Guide the mission with awareness.' },
          { label: 'Visitor', to: '/roles/visitor', description: 'Show up where life happens.' },
          { label: 'Archetypes', to: '/archetypes', description: 'Find your mission type.' },
        ]}
      />
    </div>
  );
}
