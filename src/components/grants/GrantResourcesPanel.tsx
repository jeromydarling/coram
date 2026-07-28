import { format } from 'date-fns';
import { useGrantResources } from '@/hooks/useGrantResources';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileDown, Link2, Calendar, ExternalLink, Loader2 } from 'lucide-react';

interface GrantResourcesPanelProps {
  grantId: string;
}

export function GrantResourcesPanel({ grantId }: GrantResourcesPanelProps) {
  const { data: resources, isLoading } = useGrantResources(grantId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading resources…
      </div>
    );
  }

  if (!resources || resources.length === 0) return null;

  const downloads = resources.filter(r => r.resource_type === 'download');
  const links = resources.filter(r => r.resource_type === 'link');
  const dates = resources.filter(r => r.resource_type === 'date');

  const iconMap: Record<string, React.ReactNode> = {
    download: <FileDown className="w-4 h-4 text-muted-foreground shrink-0" />,
    link: <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />,
    date: <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />,
  };

  const renderSection = (title: string, items: typeof resources, type: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-start gap-2 text-sm">
              {iconMap[type]}
              <div className="min-w-0 flex-1">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {item.label}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="font-medium">{item.label}</span>
                )}
                {item.resource_date && (
                  <span className="ml-2 text-muted-foreground">
                    {format(new Date(item.resource_date), 'MMM d, yyyy')}
                  </span>
                )}
                {item.description && !item.resource_date && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {item.source}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <FileDown className="w-4 h-4" />
          Resources & Downloads
        </h4>
        {renderSection('Important Dates', dates, 'date')}
        {renderSection('Downloads', downloads, 'download')}
        {renderSection('Related Links', links, 'link')}
      </CardContent>
    </Card>
  );
}
