/**
 * Kbd — Keyboard key display component.
 *
 * WHAT: Renders a styled keyboard key badge.
 * WHERE: Used in keyboard shortcuts overlay and help content.
 * WHY: Consistent visual representation of keyboard keys.
 */
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface KbdProps {
  children: ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono font-medium',
        'rounded border border-border bg-muted text-muted-foreground shadow-sm',
        'min-w-[1.5rem]',
        className
      )}
    >
      {children}
    </kbd>
  );
}
