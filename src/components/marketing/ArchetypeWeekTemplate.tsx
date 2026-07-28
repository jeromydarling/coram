import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { articleSchema } from '@/lib/seo/seoConfig';
import { useTranslation } from 'react-i18next';

export interface WeekDay {
  day: string;
  title: string;
  narrative: string;
}

interface ArchetypeWeekTemplateProps {
  archetypeTitle: string;
  introLine: string;
  sections: WeekDay[];
  closingReflection: string;
  slug?: string;
}

export default function ArchetypeWeekTemplate({
  archetypeTitle,
  introLine,
  sections,
  closingReflection,
  slug,
}: ArchetypeWeekTemplateProps) {
  const { t } = useTranslation('marketing');
  const pageTitle = `${t('archetypeWeekTemplate.titlePrefix')} — ${archetypeTitle}`;
  const canonical = slug ? `/archetypes/${slug}` : undefined;

  return (
      <div className="bg-background">
        <SeoHead
          title={pageTitle}
          description={introLine}
          keywords={['CROS archetype', archetypeTitle.toLowerCase(), 'community relationship example']}
          canonical={canonical}
          ogType="article"
          jsonLd={articleSchema({
            headline: pageTitle,
            description: introLine,
            url: canonical ?? '/archetypes',
          })}
        />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <SeoBreadcrumb items={[
            { label: t('archetypeWeekTemplate.breadcrumb.home'), to: '/' },
            { label: t('archetypeWeekTemplate.breadcrumb.archetypes'), to: '/archetypes' },
            { label: archetypeTitle },
          ]} />
          {/* Back link */}
          <Link
            to="/archetypes"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('archetypeWeekTemplate.backLink')}
          </Link>

          {/* Hero */}
          <header className="mb-14">
            <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-3">
              {archetypeTitle}
            </p>
            <h1
              className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] mb-4"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {t('archetypeWeekTemplate.titlePrefix')}
            </h1>
            <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-2xl">
              {introLine}
            </p>
          </header>

          {/* Day cards */}
          <div className="space-y-6">
            {sections.map((s, i) => (
              <article
                key={i}
                className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-white p-6 sm:p-8"
              >
                <h3
                  className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  {s.day} — {s.title}
                </h3>
                <p className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed whitespace-pre-line">
                  {s.narrative}
                </p>
              </article>
            ))}
          </div>

          {/* Closing reflection */}
          <div className="mt-14 rounded-2xl bg-[hsl(var(--marketing-surface))] p-6 sm:p-8">
            <h3
              className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-3"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {t('archetypeWeekTemplate.closingReflectionHeading')}
            </h3>
            <p className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed italic">
              {closingReflection}
            </p>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Link to="/pricing">
              <Button
                size="lg"
                className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12"
              >
                {t('archetypeWeekTemplate.seePricing')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
    </div>
  );
}
