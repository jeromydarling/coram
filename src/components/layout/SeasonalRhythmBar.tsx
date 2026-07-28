import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

const SEASONS = [
  { key: 'advent', months: [11, 0], hue: 270 },
  { key: 'christmas', months: [0], hue: 40 },
  { key: 'lent', months: [1, 2, 3], hue: 280 },
  { key: 'easter', months: [3, 4], hue: 50 },
  { key: 'pentecost', months: [5], hue: 0 },
  { key: 'ordinary', months: [6, 7, 8, 9, 10], hue: 150 },
] as const;

export function SeasonalRhythmBar() {
  const { t } = useTranslation('navigation');
  const now = new Date();
  const month = now.getMonth();
  const current = SEASONS.find(s => (s.months as readonly number[]).includes(month)) ?? SEASONS[5];

  return (
    <div className="w-full border-b border-border/30 bg-muted/20 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-4 py-1.5 md:px-6 md:py-2">
        {/* Color calendar pills */}
        <div className="flex gap-0.5 shrink-0">
          {SEASONS.map(s => (
            <div
              key={s.key}
              className="rounded-full transition-all duration-500"
              style={{
                width: s.key === current.key ? 20 : 6,
                height: 6,
                backgroundColor: `hsl(${s.hue}, ${s.key === current.key ? '50%' : '30%'}, ${s.key === current.key ? '60%' : '30%'})`,
                opacity: s.key === current.key ? 1 : 0.4,
              }}
            />
          ))}
        </div>

        {/* Season label */}
        <p className="text-[11px] md:text-xs font-serif text-muted-foreground truncate">
          <span className="font-semibold text-foreground/80">{t(`seasons.${current.key}.label`)}</span>
          <span className="text-muted-foreground/50"> · </span>
          <span className="text-foreground/70">{t(`seasons.${current.key}.secular`)}</span>
          <span className="hidden sm:inline text-muted-foreground/60"> · {format(now, 'MMMM yyyy')}</span>
        </p>
      </div>
    </div>
  );
}
