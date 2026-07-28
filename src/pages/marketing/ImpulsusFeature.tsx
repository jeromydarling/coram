import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { impulsusPage } from '@/content/features';
import impulsusHero from '@/assets/impulsus-hero.webp';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function ImpulsusFeature() {
  const { t } = useTranslation('marketing');
  return (
    <div className="bg-white">
      <SeoHead title="Impulsus — The Memory of Your Work" description="A private scrapbook of impact, written as you serve. Every reflection and event becomes part of a living narrative." canonical="/impulsus" />

      <header className="relative overflow-hidden">
        <img src={impulsusHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-3">{t('featurePage.eyebrow.story')}</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4" style={serif}>{impulsusPage.title}</h1>
          <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed" style={serif}>{impulsusPage.subtitle}</p>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Impulsus' }]} />
        <div className="space-y-6">
          {impulsusPage.body.map((p, i) => (
            <p key={i} className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed whitespace-pre-line text-base sm:text-lg">{p}</p>
          ))}
        </div>
      </section>

      {impulsusPage.sections?.map((section, i) => (
        <section key={i} className={i % 2 === 0 ? 'bg-[hsl(var(--marketing-surface))]' : 'bg-white'}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>{section.title}</h2>
            {section.image && (
              <img src={section.image} alt={section.title} loading="lazy" className="w-full max-w-lg mx-auto rounded-xl shadow-md border border-[hsl(var(--marketing-navy)/0.08)] mb-6" />
            )}
            <p className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg">{section.body}</p>
          </div>
        </section>
      ))}

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center">
        <Link to="/pricing">
          <Button size="lg" className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base">
            {t('featurePage.getStarted')} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}
