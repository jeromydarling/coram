/**
 * ImpulsusEmptyState — gentle empty state for the Impulsus timeline.
 *
 * WHAT: Shows a warm message when no entries exist yet.
 * WHERE: Rendered by ImpulsusTimeline when the list is empty.
 * WHY: Sets the tone for the scrapbook journal experience.
 */

import { BookOpen } from 'lucide-react';

export function ImpulsusEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-6">
        <BookOpen className="w-8 h-8 text-primary" />
      </div>
      <p className="text-lg font-serif text-muted-foreground max-w-md leading-relaxed">
        I haven't built much here yet — but this will become a quiet record of the relationships I'm growing.
      </p>
    </div>
  );
}
