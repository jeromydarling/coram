import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UsersRound } from 'lucide-react';

interface CommunioGroupCardProps {
  name: string;
  description?: string | null;
  memberCount: number;
  sharingLevel: string;
}

const sharingLabels: Record<string, string> = {
  none: 'Not sharing',
  signals: 'Sharing signals',
  reflections: 'Sharing reflections',
  collaboration: 'Full collaboration',
};

const sharingVariant: Record<string, 'secondary' | 'default' | 'outline'> = {
  none: 'outline',
  signals: 'secondary',
  reflections: 'secondary',
  collaboration: 'default',
};

export function CommunioGroupCard({ name, description, memberCount, sharingLevel }: CommunioGroupCardProps) {
  return (
    <Card className="rounded-xl border-border/50 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/50 flex items-center justify-center flex-shrink-0">
              <UsersRound className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
              )}
            </div>
          </div>
          <Badge variant={sharingVariant[sharingLevel] || 'outline'} className="flex-shrink-0 text-xs">
            {sharingLabels[sharingLevel] || sharingLevel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">
          {memberCount} {memberCount === 1 ? 'organization' : 'organizations'}
        </p>
      </CardContent>
    </Card>
  );
}
