import { HelpCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { HELP_CONTENT, type HelpKey } from '@/lib/helpContent';

interface HelpTooltipProps {
  /** Key from the centralized help content registry */
  contentKey?: HelpKey;
  /** Or provide content directly */
  content?: string;
  /** Structured what/where/why for operator sections */
  what?: string;
  where?: string;
  why?: string;
  /** Optional className for the trigger icon */
  className?: string;
  /** Size of the icon */
  size?: 'sm' | 'md';
  /** Popover alignment */
  align?: 'start' | 'center' | 'end';
  /** Popover side */
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function HelpTooltip({
  contentKey,
  content,
  what,
  where,
  why,
  className,
  size = 'sm',
  align = 'center',
  side = 'bottom',
}: HelpTooltipProps) {
  const registryText = contentKey ? HELP_CONTENT[contentKey] : undefined;
  const hasStructured = what || where || why;

  if (!content && !registryText && !hasStructured) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            size === 'sm' && 'w-4 h-4',
            size === 'md' && 'w-5 h-5',
            className,
          )}
          aria-label="Help"
        >
          <HelpCircle className={cn(size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5')} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="max-w-xs text-sm text-muted-foreground leading-relaxed p-3"
      >
        {hasStructured ? (
          <div className="space-y-1 text-xs">
            {what && <p><span className="font-medium text-foreground">What:</span> {what}</p>}
            {where && <p><span className="font-medium text-foreground">Where:</span> {where}</p>}
            {why && <p><span className="font-medium text-foreground">Why:</span> {why}</p>}
          </div>
        ) : (
          content || registryText
        )}
      </PopoverContent>
    </Popover>
  );
}
