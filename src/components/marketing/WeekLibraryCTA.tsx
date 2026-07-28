/**
 * WeekLibraryCTA — Reusable CTA linking to the week-in-life narrative library.
 *
 * WHAT: A calm, narrative-tone card that links to /week stories.
 * WHERE: Embedded on /archetypes, /roles, and homepage sections.
 * WHY: Drives discovery of human-centered storytelling pages for SEO + adoption.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function WeekLibraryCTA() {
  const { t } = useTranslation('marketing');
  return (
    <section className="py-8">
      <Link
        to="/week/catholic-visitor"
        className="block rounded-2xl bg-[hsl(var(--marketing-surface))] border border-[hsl(var(--marketing-navy)/0.06)] p-6 sm:p-8 hover:bg-white transition-colors group"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)] mb-2">
          {t('weekLibraryCTA.eyebrow')}
        </p>
        <h3
          className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-2"
          style={serif}
        >
          {t('weekLibraryCTA.heading')}
        </h3>
        <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-4">
          {t('weekLibraryCTA.body')}
        </p>
        <span className="inline-flex items-center text-sm font-medium text-[hsl(var(--marketing-navy)/0.7)] group-hover:text-[hsl(var(--marketing-navy))] transition-colors">
          {t('weekLibraryCTA.linkText')} <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </span>
      </Link>
    </section>
  );
}
