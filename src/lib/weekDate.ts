import { startOfWeek, format, parseISO, addDays, getDay } from 'date-fns';

/**
 * Get the Monday of the current week as yyyy-MM-dd string
 */
export function getWeekStartDate(date: Date = new Date()): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

/**
 * Get a human-readable week range display
 * Uses parseISO + addDays to avoid UTC parsing issues
 */
export function getWeekDisplayRange(weekStartDate: string): string {
  const start = parseISO(weekStartDate);
  const end = addDays(start, 6);
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
}

/**
 * Determine if current day is in "Focus" mode (Mon-Thu) or "Review" mode (Fri-Sun)
 */
export function getWeekMode(date: Date = new Date()): 'focus' | 'review' {
  const day = getDay(date);
  // 0 = Sunday, 5 = Friday, 6 = Saturday
  return day >= 5 || day === 0 ? 'review' : 'focus';
}
