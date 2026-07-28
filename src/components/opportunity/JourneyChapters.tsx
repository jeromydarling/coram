import { cn } from '@/lib/utils';
import { CHAPTERS, Chapter, toChapterLabel, CHAPTER_COLORS } from '@/lib/journeyChapters';
import { useUpdateOpportunity } from '@/hooks/useOpportunities';
import { ChevronRight } from 'lucide-react';

interface JourneyChaptersProps {
  opportunityId: string;
  currentStage: string | null | undefined;
  className?: string;
}

export function JourneyChapters({ opportunityId, currentStage, className }: JourneyChaptersProps) {
  const currentChapter = toChapterLabel(currentStage);
  const updateOpportunity = useUpdateOpportunity();

  const handleChapterClick = async (chapter: Chapter) => {
    if (chapter === currentChapter) return;
    await updateOpportunity.mutateAsync({
      id: opportunityId,
      stage: chapter as any,
    });
  };

  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide', className)}>
      {CHAPTERS.map((chapter, index) => {
        const isActive = chapter === currentChapter;
        const color = CHAPTER_COLORS[chapter];

        return (
          <div key={chapter} className="flex items-center flex-shrink-0">
            <button
              onClick={() => handleChapterClick(chapter)}
              disabled={updateOpportunity.isPending}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border whitespace-nowrap',
                isActive
                  ? 'text-white shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
              )}
              style={isActive ? { backgroundColor: color, borderColor: color } : undefined}
            >
              {chapter}
            </button>
            {index < CHAPTERS.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 mx-0.5 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
