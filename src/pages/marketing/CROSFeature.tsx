import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { crosPage } from '@/content/features';
import crosHero from '@/assets/cros-feature-hero.webp';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function CROSFeature() {
  const { t } = useTranslation('marketing');
  return (
    <div className="bg-white">
      <SeoHead title="CROS™ — The Operating System Built for Relationships" description="Where traditional systems manage files and workflows, CROS manages living networks of people, partners, and communities." canonical="/cros" />

      <header className="relative overflow-hidden">
        <img src={crosHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-3">{t('crosFeaturePage.eyebrow')}</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4" style={serif}>{crosPage.hero}</h1>
          <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed" style={serif}>{crosPage.subtitle}</p>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'CROS™' }]} />
        <div className="space-y-6">
          {crosPage.body.map((p, i) => (
            <p key={i} className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed whitespace-pre-line text-base sm:text-lg">{p}</p>
          ))}
        </div>
      </section>

      {crosPage.sections?.map((section, i) => (
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

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-4" style={serif}>{t('crosFeaturePage.capabilitiesHeading')}</h2>
        <ul className="space-y-2.5">
          {crosPage.capabilities.map((item) => (
            <li key={item} className="flex items-center gap-3 text-[hsl(var(--marketing-navy)/0.65)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-blue))] flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-[hsl(var(--marketing-surface))]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center">
          <p className="text-lg sm:text-xl text-[hsl(var(--marketing-navy))] font-medium whitespace-pre-line leading-relaxed mb-8" style={serif}>{crosPage.closing}</p>
          <Link to="/pricing">
            <Button size="lg" className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base">
              {t('crosFeaturePage.getStarted')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
