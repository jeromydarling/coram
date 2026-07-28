import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TimeRange = '30d' | '60d' | '90d' | 'q1' | 'q2' | 'q3' | 'q4' | 'fy';

interface TimeRangeFilterProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: '30d', label: '30d' },
  { value: '60d', label: '60d' },
  { value: '90d', label: '90d' },
  { value: 'q1', label: 'Q1' },
  { value: 'q2', label: 'Q2' },
  { value: 'q3', label: 'Q3' },
  { value: 'q4', label: 'Q4' },
  { value: 'fy', label: 'FY' },
];

export function TimeRangeFilter({ value, onChange, className }: TimeRangeFilterProps) {
  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {timeRanges.map((range) => (
        <Button
          key={range.value}
          variant={value === range.value ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-2 text-xs',
            value === range.value && 'bg-primary text-primary-foreground'
          )}
          onClick={() => onChange(range.value)}
        >
          {range.label}
        </Button>
      ))}
    </div>
  );
}
