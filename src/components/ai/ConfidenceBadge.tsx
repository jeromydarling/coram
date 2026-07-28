import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  score: number;
  className?: string;
  showPercentage?: boolean;
}

export function ConfidenceBadge({ score, className, showPercentage = true }: ConfidenceBadgeProps) {
  const percentage = Math.round(score * 100);
  
  const getVariant = () => {
    if (score >= 0.9) return 'default';
    if (score >= 0.7) return 'secondary';
    if (score >= 0.5) return 'outline';
    return 'destructive';
  };
  
  const getLabel = () => {
    if (score >= 0.9) return 'High';
    if (score >= 0.7) return 'Medium';
    if (score >= 0.5) return 'Low';
    return 'Very Low';
  };
  
  return (
    <Badge 
      variant={getVariant()} 
      className={cn('text-xs', className)}
    >
      {getLabel()}{showPercentage && ` (${percentage}%)`}
    </Badge>
  );
}
