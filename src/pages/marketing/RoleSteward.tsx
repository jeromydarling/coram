/**
 * RoleSteward — Steward role deep page.
 *
 * WHAT: Full narrative page for the Steward role with workspace setup, modules, guides.
 * WHERE: /roles/steward
 * WHY: SEO entry point for workspace admins discovering CROS through role identity.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Settings, Users, Plug } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import ConceptLinks from '@/components/seo/ConceptLinks';
import { articleSchema } from '@/lib/seo/seoConfig';
import { getRoleNode } from '@/lib/seo/roleGraph';
import { getGuidesForRole } from '@/content/roleGuides';
import { useRoleCapture } from '@/hooks/useRoleCapture';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const features = [
  { Icon: Settings, title: 'Workspace Setup', subtitle: 'Archetype · Modules · Defaults', description: 'Configure your CROS™ workspace once. Choose your mission archetype, activate the right modules, and let the system adapt to your context.' },
  { Icon: Users, title: 'Team Management', subtitle: 'Invite · Roles · Permissions', description: 'Invite your team by email. Each person chooses their own role — Shepherd, Companion, or Visitor. Self-selection builds ownership.' },
  { Icon: Plug, title: 'Integrations', subtitle: 'Relatio · Migration · Connectors', description: 'Connect existing tools through Relatio or migrate from a legacy CRM. Your relationship history travels with you.' },
];

export default function RoleSteward() {
  const { t } = useTranslation('marketing');
  useRoleCapture();
  const node = getRoleNode('steward');
  const guides = getGuidesForRole('steward');

  return (
    <div className="bg-white">
      <SeoHead
        title="Steward — Tend the Workspace"
        description="Stewards set up and maintain the CROS™ workspace. See how the admin experience stays simple, human, and focused on your team's needs."
        keywords={['CROS steward', 'workspace admin', 'nonprofit admin', 'team management', 'CRM setup']}
        canonical="/roles/steward"
        ogType="article"
        jsonLd={articleSchema({ headline: 'Steward — Tend the Workspace', description: 'The Steward experience inside CROS™.', url: '/roles/steward' })}
      />

      <section className="max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 text-center">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Roles', to: '/roles' }, { label: 'Steward' }]} />
        <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--marketing-blue)/0.08)] flex items-center justify-center mx-auto mb-6">
          <Shield className="h-7 w-7 text-[hsl(var(--marketing-blue))]" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-2">{t('roleDeepPage.steward.eyebrow')}</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4" style={serif}>
          {t('roleDeepPage.steward.heroHeading')}
        </h1>
        <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed">
          {t('roleDeepPage.steward.heroBody')}
        </p>
      </section>

      <section className="max-w-[960px] mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-2xl font-semibold text-[hsl(var(--marketing-navy))] text-center mb-10" style={serif}>{t('roleDeepPage.whatYouDoHeading')}</h2>
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

      {node && (
        <section className="max-w-[640px] mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>{t('roleDeepPage.stewardModulesHeading')}</h2>
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
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5" style={serif}>{t('roleDeepPage.setupGuidesHeading')}</h2>
          <div className="space-y-2.5">
            {guides.map((g) => (
              <Link key={g.slug} to={`/roles/steward/${g.slug}`} className="block rounded-xl border border-[hsl(var(--marketing-border))] p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all">
                <h3 className="text-sm font-medium text-[hsl(var(--marketing-navy))]">{g.title}</h3>
                <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)] mt-1">{g.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-[hsl(var(--marketing-surface))] py-16">
        <div className="max-w-[640px] mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>{t('roleDeepPage.steward.roleInEcosystemHeading')}</h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-8">
            {t('roleDeepPage.steward.teamFitBody')}
          </p>
          <Link to="/pricing">
            <Button size="lg" className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base">
              {t('roleDeepPage.seePricing')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <ConceptLinks conceptSlug="cros" heading={t('roleDeepPage.relatedConceptsHeading')} />

      <SeoInternalLinks
        heading={t('roleDeepPage.seoLinksHeading')}
        links={[
          { label: 'Shepherd', to: '/roles/shepherd', description: 'Guide the mission with awareness.' },
          { label: 'Companion', to: '/roles/companion', description: 'Keep the thread of care alive.' },
          { label: 'Visitor', to: '/roles/visitor', description: 'Show up where life happens.' },
        ]}
      />
    </div>
  );
}
