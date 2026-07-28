import { Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableCardProps {
  id: string;
  index: number;
  children: React.ReactNode;
  className?: string;
}

export function DraggableCard({ id, index, children, className }: DraggableCardProps) {
  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            'relative group transition-shadow duration-200',
            snapshot.isDragging && 'shadow-xl ring-2 ring-primary/20 rounded-xl',
            className
          )}
        >
          {/* Drag handle */}
          <div
            {...provided.dragHandleProps}
            className={cn(
              'absolute -left-2 top-1/2 -translate-y-1/2 z-10',
              'p-1.5 rounded-md bg-muted/80 border border-border shadow-sm',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
              'cursor-grab active:cursor-grabbing hover:bg-muted',
              snapshot.isDragging && 'opacity-100'
            )}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          {children}
        </div>
      )}
    </Draggable>
  );
}
