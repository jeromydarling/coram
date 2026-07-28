/**
 * RoleGuidePage — Workflow micro-guide at /roles/:role/:guideSlug.
 *
 * WHAT: 400-700 word action-oriented guide for a specific role workflow.
 * WHERE: /roles/:role/:guideSlug
 * WHY: SEO-rich practical content showing how roles use CROS features.
 */
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { getGuide, getGuidesForRole } from '@/content/roleGuides';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import SeoInternalLinks from '@/components/seo/SeoInternalLinks';
import { articleSchema } from '@/lib/seo/seoConfig';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function RoleGuidePage() {
  const { t } = useTranslation('marketing');
  const { role, guideSlug } = useParams<{ role: string; guideSlug: string }>();
  const guide = role && guideSlug ? getGuide(role, guideSlug) : undefined;

  if (!guide) return <Navigate to="/roles" replace />;

  const otherGuides = getGuidesForRole(guide.role).filter((g) => g.slug !== guide.slug);

  return (
    <div className="bg-white">
      <SeoHead
        title={guide.title}
        description={guide.description}
        keywords={guide.keywords}
        canonical={`/roles/${guide.role}/${guide.slug}`}
        ogType="article"
        jsonLd={articleSchema({
          headline: guide.title,
          description: guide.description,
          url: `/roles/${guide.role}/${guide.slug}`,
          datePublished: guide.datePublished,
        })}
      />
      <SeoBreadcrumb
        items={[
          { label: 'Home', to: '/' },
          { label: 'Roles', to: '/roles' },
          { label: t(`roleGuidePage.roleLabels.${guide.role}`, { defaultValue: guide.role }), to: `/roles/${guide.role}` },
          { label: guide.title },
        ]}
      />

      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
        <Link
          to={`/roles/${guide.role}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--marketing-blue))] mb-6 hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> {t('roleGuidePage.backToRole', { role: t(`roleGuidePage.roleLabels.${guide.role}`, { defaultValue: guide.role }) })}
        </Link>

        <header className="mb-10">
          <span className="inline-block text-xs font-medium text-[hsl(var(--marketing-blue))] bg-[hsl(var(--marketing-blue)/0.08)] px-3 py-1 rounded-full mb-4">
            {t('roleGuidePage.guideLabel', { role: t(`roleGuidePage.roleLabels.${guide.role}`, { defaultValue: guide.role }) })}
          </span>
          <h1
            className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.2] tracking-tight mb-3"
            style={serif}
          >
            {guide.title}
          </h1>
          <p className="text-base text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
            {guide.description}
          </p>
        </header>

        <div className="space-y-8">
          {guide.sections.map((section, i) => (
            <section key={i}>
              <h2
                className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3"
                style={serif}
              >
                {section.heading}
              </h2>
              <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed whitespace-pre-line">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        {otherGuides.length > 0 && (
          <div className="mt-14 pt-8 border-t border-[hsl(var(--marketing-border))]">
            <h3 className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider mb-4">
              {t('roleGuidePage.moreGuidesHeading', { role: t(`roleGuidePage.roleLabels.${guide.role}`, { defaultValue: guide.role }) })}
            </h3>
            <div className="space-y-2">
              {otherGuides.map((g) => (
                <Link
                  key={g.slug}
                  to={`/roles/${g.role}/${g.slug}`}
                  className="block rounded-xl border border-[hsl(var(--marketing-border))] p-4 hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all"
                >
                  <h4 className="text-sm font-medium text-[hsl(var(--marketing-navy))]">{g.title}</h4>
                  <p className="text-xs text-[hsl(var(--marketing-navy)/0.45)] mt-1">{g.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {t('roleGuidePage.seePricing')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </article>

      <SeoInternalLinks
        heading={t('roleGuidePage.seoLinksHeading')}
        links={[
          { label: t(`roleGuidePage.roleLabels.${guide.role}`, { defaultValue: guide.role }), to: `/roles/${guide.role}`, description: `The ${t(`roleGuidePage.roleLabels.${guide.role}`, { defaultValue: guide.role })} experience in CROS™.` },
          { label: 'All Roles', to: '/roles', description: 'Shepherd, Companion, or Visitor.' },
          { label: 'Archetypes', to: '/archetypes', description: 'Find your mission type.' },
        ]}
      />
    </div>
  );
}
