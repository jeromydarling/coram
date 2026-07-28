/**
 * RoleVisitor — Visitor role deep page.
 *
 * WHAT: Full narrative page for the Visitor role with daily rhythm, voice-note example, guides, stories.
 * WHERE: /roles/visitor
 * WHY: SEO entry point for field workers discovering CROS through role identity.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, Mic, Smartphone, Wifi } from 'lucide-react';
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
  { Icon: Mic, title: 'Voice Notes', subtitle: 'Speak it. We remember it.', description: 'Tap record, say what happened. Your voice becomes a transcript, which becomes a Visit Note — and NRI™ can understand it. No typing required.' },
  { Icon: Smartphone, title: 'Mobile-first design', subtitle: 'Works on the device you carry', description: 'Large buttons, simple screens, no clutter. Designed for people who may not be comfortable with complex apps — and for anyone in a hurry.' },
  { Icon: Wifi, title: 'Works on any device', subtitle: 'Browser-based · No app store needed', description: 'CROS™ runs in your browser on any phone, tablet, or computer. Add it to your home screen and it works like a native app — no download required.' },
];

const dailyRhythm = [
  { time: 'Before leaving', activity: 'Check your Visit Assignments — see who to visit and any notes from your Shepherd.' },
  { time: 'At the visit', activity: 'Be present. Listen. Notice. No forms needed.' },
  { time: 'After the visit', activity: 'Record a 30-second voice note in your car.' },
  { time: 'That\'s it', activity: 'Your voice note becomes part of the community\'s living story.' },
];

export default function RoleVisitor() {
  const { t } = useTranslation('marketing');
  useRoleCapture();
  const node = getRoleNode('visitor');
  const guides = getGuidesForRole('visitor');
  const stories = roleStories.filter((s) => s.role === 'visitor');

  return (
    <div className="bg-white">
      <SeoHead
        title="Visitor — Keep the Witness"
        description="Visitors show up where life happens. See how CROS™ makes field work simple with voice notes, mobile-first design, and zero forms."
        keywords={['CROS visitor', 'home visits', 'field work', 'voice notes', 'mobile CRM', 'volunteer tools']}
        canonical="/roles/visitor"
        ogType="article"
        jsonLd={articleSchema({ headline: 'Visitor — Keep the Witness', description: 'The Visitor experience inside CROS™.', url: '/roles/visitor' })}
      />

      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 text-center">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Roles', to: '/roles' }, { label: 'Visitor' }]} />
        <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mx-auto mb-6">
          <MapPin className="h-7 w-7 text-[hsl(var(--marketing-blue))]" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-2">{t('roleDeepPage.visitor.eyebrow')}</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4" style={serif}>
          {t('roleDeepPage.visitor.heroHeading')}
        </h1>
        <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed">
          {t('roleDeepPage.visitor.heroBody')}
        </p>
      </section>

      {/* The promise */}
      <section className="max-w-[540px] mx-auto px-4 sm:px-6 pb-12 text-center">
        <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl p-6 sm:p-8 border border-[hsl(var(--marketing-border))]">
          <p className="text-xl text-[hsl(var(--marketing-navy))] font-medium leading-relaxed" style={serif}>
            {t('roleDeepPage.visitor.promiseHeading')}
          </p>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.5)] mt-2">{t('roleDeepPage.visitor.promiseSubtext')}</p>
        </div>
      </section>

      {/* Voice note example */}
      <section className="max-w-[540px] mx-auto px-4 sm:px-6 pb-12">
        <div className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-6">
          <div className="flex items-center gap-2 mb-3">
            <Mic className="h-4 w-4 text-[hsl(var(--marketing-blue))]" />
            <span className="text-xs font-medium text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider">{t('roleDeepPage.visitor.voiceNoteLabel')}</span>
          </div>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed italic" style={serif}>
            {t('roleDeepPage.visitor.voiceNoteTranscript')}
          </p>
          <p className="text-xs text-[hsl(var(--marketing-navy)/0.35)] mt-3">{t('roleDeepPage.visitor.voiceNoteMeta')}</p>
        </div>
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
        <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-6" style={serif}>{t('roleDeepPage.visitor.dailyRhythmHeading')}</h2>
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
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>{t('roleDeepPage.visitorModulesHeading')}</h2>
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
              <Link key={g.slug} to={`/roles/visitor/${g.slug}`} className="block rounded-xl border border-[hsl(var(--marketing-border))] p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all">
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
            {t('roleDeepPage.visitor.teamFitBody')}
          </p>
          <Link to="/pricing">
            <Button size="lg" className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base">
              {t('roleDeepPage.seePricing')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <ConceptLinks conceptSlug="visitor" heading={t('roleDeepPage.relatedConceptsHeading')} />

      <SeoInternalLinks
        heading={t('roleDeepPage.seoLinksHeading')}
        links={[
          { label: 'Shepherd', to: '/roles/shepherd', description: 'Guide the mission with awareness.' },
          { label: 'Companion', to: '/roles/companion', description: 'Keep the thread of care alive.' },
          { label: 'Archetypes', to: '/archetypes', description: 'Find your mission type.' },
        ]}
      />
    </div>
  );
}
