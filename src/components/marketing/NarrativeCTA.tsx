/**
 * NarrativeCTA — Quiet, identity-aware call-to-action for marketing pages.
 *
 * WHAT: Gentle CTA that adapts language based on variant and optional context.
 * WHERE: Bottom of marketing pages, role pages, archetype pages.
 * WHY: Visitors should feel recognized before they feel sold to.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

type CTAVariant = 'begin_rhythm' | 'see_city_story' | 'walk_first_week';

const variantRoutes: Record<CTAVariant, string> = {
  begin_rhythm: '/pricing',
  see_city_story: '/metros',
  walk_first_week: '/archetypes',
};

interface Props {
  variant: CTAVariant;
  archetype?: string;
  role?: string;
}

export default function NarrativeCTA({ variant, archetype, role }: Props) {
  const { t } = useTranslation('marketing');

  const variantKeyMap: Record<CTAVariant, string> = {
    begin_rhythm: 'beginRhythm',
    see_city_story: 'seeCityStory',
    walk_first_week: 'walkFirstWeek',
  };

  const vk = variantKeyMap[variant];
  const content = {
    heading: t(`narrativeCTA.${vk}.heading`),
    body: t(`narrativeCTA.${vk}.body`),
    buttonText: t(`narrativeCTA.${vk}.button`),
    to: variantRoutes[variant],
  };
  const to = archetype ? `${content.to}?archetype=${archetype}` : content.to;

  return (
    <section className="py-12 text-center">
      <div className="max-w-md mx-auto px-4">
        <h3
          className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-2"
          style={serif}
        >
          {content.heading}
        </h3>
        <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed mb-6">
          {content.body}
        </p>
        <Link to={to}>
          <Button
            className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-6 h-11 text-sm"
          >
            {content.buttonText} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
