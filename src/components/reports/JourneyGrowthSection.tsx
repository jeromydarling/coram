import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sprout } from 'lucide-react';
import type { JourneyGrowthData } from '@/hooks/useHumanImpactData';

interface JourneyGrowthSectionProps {
  data: JourneyGrowthData;
}

export function JourneyGrowthSection({ data }: JourneyGrowthSectionProps) {
  const maxCount = Math.max(...data.chapters.map(c => c.count), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sprout className="w-5 h-5 text-primary" />
          Where Relationships Are Growing
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {data.totalActive} active partnership{data.totalActive !== 1 ? 's' : ''} across every chapter of the journey
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.chapters.map(({ chapter, count, color }) => (
            <div key={chapter} className="flex items-center gap-3">
              <span className="text-xs font-medium w-[110px] shrink-0 truncate text-right text-muted-foreground">
                {chapter}
              </span>
              <div className="flex-1 h-7 bg-muted/30 rounded overflow-hidden relative">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${Math.max((count / maxCount) * 100, count > 0 ? 8 : 0)}%`,
                    backgroundColor: color,
                    opacity: 0.75,
                  }}
                />
                {count > 0 && (
                  <span className="absolute inset-y-0 flex items-center px-2 text-xs font-semibold text-foreground">
                    {count}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
