import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { useTranslation } from 'react-i18next';

interface FeaturePageLayoutProps {
  hero: string;
  paragraphs: string[];
  closing?: string;
  listTitle?: string;
  listItems?: string[];
  children?: React.ReactNode;
  /** SEO: canonical path like /impulsus */
  canonical?: string;
  /** SEO: meta description override */
  seoDescription?: string;
}

/** Reusable layout for individual feature marketing pages (Impulsus, Signum, etc.) */
export default function FeaturePageLayout({
  hero,
  paragraphs,
  closing,
  listTitle,
  listItems,
  children,
  canonical,
  seoDescription,
}: FeaturePageLayoutProps) {
  const { t } = useTranslation('marketing');
  return (
    <div className="bg-white">
      <SeoHead
        title={hero}
        description={seoDescription ?? paragraphs[0]?.slice(0, 155) ?? hero}
        canonical={canonical}
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-20">
        {canonical && (
          <SeoBreadcrumb items={[{ label: t('featurePageLayout.breadcrumb.home'), to: '/' }, { label: hero }]} />
        )}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-10">
          {hero}
        </h1>

        <div className="space-y-6">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed whitespace-pre-line text-base sm:text-lg"
            >
              {p}
            </p>
          ))}
        </div>

        {listTitle && listItems && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-4">
              {listTitle}
            </h2>
            <ul className="space-y-2.5">
              {listItems.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-[hsl(var(--marketing-navy)/0.65)]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-blue))] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {children}

        {closing && (
          <div className="mt-14 pt-10 border-t border-[hsl(var(--marketing-border))]">
            <p className="text-lg sm:text-xl text-[hsl(var(--marketing-navy))] font-medium whitespace-pre-line leading-relaxed">
              {closing}
            </p>
          </div>
        )}

        <div className="mt-12">
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
            >
              {t('featurePageLayout.getStarted')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
