/**
 * RoleShepherd — Shepherd role deep page.
 *
 * WHAT: Full narrative page for the Shepherd role with daily rhythm, modules, guides, stories.
 * WHERE: /roles/shepherd
 * WHY: SEO entry point for leadership-minded visitors discovering CROS through role identity.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, Compass, BookOpen, Radio, Eye } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import ConceptLinks from '@/components/seo/ConceptLinks';
import { articleSchema } from '@/lib/seo/seoConfig';
import { getRoleNode, getRoleStories, getRoleInsights } from '@/lib/seo/roleGraph';
import { getGuidesForRole } from '@/content/roleGuides';
import { roleStories } from '@/content/roleStories';
import { useRoleCapture } from '@/hooks/useRoleCapture';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const features = [
  {
    Icon: BookOpen,
    title: 'Relationship Memory',
    subtitle: 'Reflections · Email history',
    description: 'Every conversation, reflection, and touchpoint is held gently — so you never lose the thread of a relationship, even across years.',
  },
  {
    Icon: Radio,
    title: 'Community Awareness',
    subtitle: 'Signum · Local sources',
    description: 'A quiet pulse of what\'s happening in your community — local events, emerging needs, and shifts worth noticing. No alerts. Just awareness.',
  },
  {
    Icon: Eye,
    title: 'Narrative Intelligence',
    subtitle: 'Metro Narrative · Drift signals',
    description: 'Patterns emerge over time. CROS™ gently surfaces when relationships are deepening, when engagement is drifting, and when a story is worth revisiting.',
  },
];

const dailyRhythm = [
  { time: 'Monday morning', activity: 'Read the Metro Narrative — your community\'s weekly story.' },
  { time: 'Midweek', activity: 'Review Testimonium signals — notice who\'s drifting, who\'s deepening.' },
  { time: 'Before a meeting', activity: 'Glance at a partner\'s Journey — remember where the relationship stands.' },
  { time: 'After a conversation', activity: 'Write a brief Reflection — capture what you noticed.' },
  { time: 'End of week', activity: 'Assign visits, check volunteer hours, prepare for the next narrative.' },
];

export default function RoleShepherd() {
  const { t } = useTranslation('marketing');
  useRoleCapture();
  const node = getRoleNode('shepherd');
  const guides = getGuidesForRole('shepherd');
  const stories = roleStories.filter((s) => s.role === 'shepherd');
  const relatedInsights = getRoleInsights('shepherd');

  return (
    <div className="bg-white">
      <SeoHead
        title="Shepherd — Keep the Story"
        description="Shepherds carry the vision and hold the story. See how CROS™ supports leadership with narrative intelligence, community awareness, and relationship memory."
        keywords={['CROS shepherd', 'pastoral leadership', 'community leadership', 'narrative intelligence', 'relationship management']}
        canonical="/roles/shepherd"
        ogType="article"
        jsonLd={articleSchema({
          headline: 'Shepherd — Keep the Story',
          description: 'The Shepherd experience inside CROS™ — for leaders who guide with awareness.',
          url: '/roles/shepherd',
        })}
      />
      <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Roles', to: '/roles' }, { label: 'Shepherd' }]} />

      {/* Hero */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mx-auto mb-6">
          <Compass className="h-7 w-7 text-[hsl(var(--marketing-blue))]" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-2">{t('roleDeepPage.shepherd.eyebrow')}</p>
        <h1
          className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4"
          style={serif}
        >
          {t('roleDeepPage.shepherd.heroHeading')}
        </h1>
        <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed">
          {t('roleDeepPage.shepherd.heroBody')}
        </p>
      </section>

      {/* Features */}
      <section className="max-w-[960px] mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-2xl font-semibold text-[hsl(var(--marketing-navy))] text-center mb-10" style={serif}>
          {t('roleDeepPage.whatYouLoveHeading')}
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map(({ Icon, title, subtitle, description }) => (
            <div key={title} className="bg-white rounded-2xl border border-[hsl(var(--marketing-border))] p-6 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all">
              <div className="w-11 h-11 rounded-xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-[hsl(var(--marketing-blue))]" />
              </div>
              <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-0.5" style={serif}>{title}</h3>
              <p className="text-xs text-[hsl(var(--marketing-navy)/0.4)] mb-3">{subtitle}</p>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Daily Rhythm */}
      <section className="max-w-[640px] mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-6" style={serif}>
          {t('roleDeepPage.shepherd.dailyRhythmHeading')}
        </h2>
        <div className="space-y-3">
          {dailyRhythm.map((item, i) => (
            <div key={i} className="flex gap-4 items-start">
              <span className="text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.08)] px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 mt-0.5">
                {item.time}
              </span>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{item.activity}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      {node && (
        <section className="max-w-[640px] mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('roleDeepPage.modulesHeading')}
          </h2>
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

      {/* Workflow Guides */}
      {guides.length > 0 && (
        <section className="max-w-[640px] mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('roleDeepPage.workflowGuidesHeading')}
          </h2>
          <div className="space-y-2.5">
            {guides.map((g) => (
              <Link
                key={g.slug}
                to={`/roles/shepherd/${g.slug}`}
                className="block rounded-xl border border-[hsl(var(--marketing-border))] p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
              >
                <h3 className="text-sm font-medium text-[hsl(var(--marketing-navy))]">{g.title}</h3>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)] mt-1">{g.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Role Stories */}
      {stories.length > 0 && (
        <section className="max-w-[640px] mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>
            {t('roleDeepPage.storiesHeading')}
          </h2>
          <div className="space-y-2.5">
            {stories.map((s) => (
              <Link
                key={s.slug}
                to={`/stories/roles/${s.slug}`}
                className="block rounded-xl border border-[hsl(var(--marketing-border))] p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
              >
                <h3 className="text-sm font-medium text-[hsl(var(--marketing-navy))]">{s.title}</h3>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)] mt-1">{s.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Team fit + CTA */}
      <section className="bg-[hsl(var(--marketing-surface))] py-16">
        <div className="max-w-[640px] mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>
            {t('roleDeepPage.teamFitHeading')}
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-8">
            {t('roleDeepPage.shepherd.teamFitBody')}
          </p>
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {t('roleDeepPage.seePricing')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <ConceptLinks conceptSlug="shepherd" heading={t('roleDeepPage.relatedConceptsHeading')} />

      <SeoInternalLinks
        heading={t('roleDeepPage.seoLinksHeading')}
        links={[
          { label: 'Companion', to: '/roles/companion', description: 'Keep the thread of care alive.' },
          { label: 'Visitor', to: '/roles/visitor', description: 'Show up where life happens.' },
          { label: 'Archetypes', to: '/archetypes', description: 'Find your mission type.' },
        ]}
      />
    </div>
  );
}
