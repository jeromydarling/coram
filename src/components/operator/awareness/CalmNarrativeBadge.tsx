/**
 * CalmNarrativeBadge — Category badge using warm, human-centered language.
 *
 * WHAT: Displays the awareness event category as a gentle narrative label.
 * WHERE: Inside AwarenessCard components.
 * WHY: Reinforces the calm, non-urgent design language of the operator experience.
 */
import { Badge } from '@/components/ui/badge';
import { Leaf, Compass, Globe, Wind, Plug, Sparkles } from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  narrative: {
    label: 'Narrative Movement',
    icon: Leaf,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  activation: {
    label: 'Activation Progress',
    icon: Compass,
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  },
  expansion: {
    label: 'Expansion Moment',
    icon: Globe,
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  },
  friction: {
    label: 'Friction Signal',
    icon: Wind,
    className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800',
  },
  migration: {
    label: 'Integration Health',
    icon: Plug,
    className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800',
  },
  growth: {
    label: 'Growth Signal',
    icon: Sparkles,
    className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800',
  },
};

export function CalmNarrativeBadge({ category }: { category: string }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.growth;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`text-[10px] gap-1 font-medium px-1.5 py-0 ${config.className}`}>
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </Badge>
  );
}
