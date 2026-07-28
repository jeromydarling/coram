import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface GrantAlignment {
  id: string;
  grant_id: string;
  score: number;
  rationale: string | null;
  grants?: { grant_name: string; funder_name: string | null } | null;
}

interface GrantAlignmentPanelProps {
  orgId: string;
}

function scoreColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
  return 'bg-muted text-muted-foreground border-border';
}

export function GrantAlignmentPanel({ orgId }: GrantAlignmentPanelProps) {
  const { data: alignments, isLoading } = useQuery({
    queryKey: ['grant-alignment', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grant_alignment')
        .select('id, grant_id, score, rationale, grants(grant_name, funder_name)')
        .eq('org_id', orgId)
        .order('score', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as unknown as GrantAlignment[];
    },
    enabled: !!orgId,
  });

  if (isLoading || !alignments || alignments.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Grant Fit Scores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alignments.map(a => (
          <div key={a.id} className="flex items-start gap-3 p-2 rounded-lg border bg-card">
            <Badge variant="outline" className={`shrink-0 text-xs font-bold ${scoreColor(a.score)}`}>
              {a.score}%
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {a.grants?.grant_name || 'Unknown Grant'}
              </p>
              {a.grants?.funder_name && (
                <p className="text-xs text-muted-foreground truncate">{a.grants.funder_name}</p>
              )}
              {a.rationale && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.rationale}</p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
