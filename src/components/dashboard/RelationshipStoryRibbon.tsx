import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Heart } from 'lucide-react';
import { useCommandCenter } from '@/hooks/useCommandCenter';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export function RelationshipStoryRibbon() {
  const { t } = useTranslation('dashboard');
  const { data, isLoading } = useCommandCenter();
  const navigate = useNavigate();

  const focusPartners = useMemo(() => {
    if (!data?.focusItems) return [];
    // Deduplicate by name, take first 8
    const seen = new Set<string>();
    return data.focusItems.filter(item => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    }).slice(0, 8);
  }, [data?.focusItems]);

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-28 w-52 shrink-0 rounded-lg" />
        ))}
      </div>
    );
  }

  if (focusPartners.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">{t('relationshipStoryRibbon.emptyState')}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-3">
        {focusPartners.map(partner => (
          <Card
            key={partner.id}
            className="shrink-0 w-56 cursor-pointer hover:bg-accent/50 transition-colors group"
            onClick={() => partner.link && navigate(`/opportunities?selected=${partner.link.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm truncate flex-1">{partner.name}</h4>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              {partner.metroName && (
                <Badge variant="outline" className="text-xs mb-2">{partner.metroName}</Badge>
              )}
              <p className="text-xs text-muted-foreground line-clamp-2">
                {partner.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
