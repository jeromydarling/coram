import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { profundaPage } from '@/content/features';
import profundaHero from '@/assets/profunda-hero.webp';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function Profunda() {
  const { t } = useTranslation('marketing');
  return (
    <div className="bg-white">
      <SeoHead title="Profunda™ — Where Relationships Become Movement" description="Every meeting, provision, volunteer hour, and event becomes part of a living system — not as isolated data, but as movement." canonical="/profunda" />

      <header className="relative overflow-hidden">
        <img src={profundaHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-3">{t('featurePage.eyebrow.story')}</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4" style={serif}>{profundaPage.hero}</h1>
          <p className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed" style={serif}>{profundaPage.subtitle}</p>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10">
        <SeoBreadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Profunda™' }]} />
        <div className="space-y-6">
          {profundaPage.body.map((p, i) => (
            <p key={i} className="text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed whitespace-pre-line text-base sm:text-lg">{p}</p>
          ))}
        </div>
      </section>

      <section className="bg-[hsl(var(--marketing-surface))] py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {profundaPage.modules.map((m) => (
              <Link key={m.name} to={m.to} className="group bg-white rounded-2xl p-6 border border-[hsl(var(--marketing-border))] hover:border-[hsl(var(--marketing-blue)/0.3)] hover:shadow-sm transition-all">
                <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))]">{m.role}</span>
                <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mt-2 mb-2" style={serif}>{m.name}</h3>
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">{m.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center">
        <p className="text-lg sm:text-xl text-[hsl(var(--marketing-navy))] font-medium whitespace-pre-line leading-relaxed mb-8" style={serif}>{profundaPage.closing}</p>
        <Link to="/pricing">
          <Button size="lg" className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base">
            {t('featurePage.getStarted')} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}
