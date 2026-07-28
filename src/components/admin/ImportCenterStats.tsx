import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload } from 'lucide-react';
import { format, startOfDay, subDays } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ImportCenterStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-import-center-stats'],
    queryFn: async () => {
      const weekStart = startOfDay(subDays(new Date(), 7)).toISOString();

      const { data: runs, error } = await supabase
        .from('import_runs')
        .select('id, status, stats, created_at')
        .gte('created_at', weekStart)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalRuns = runs?.length || 0;
      const totalRows = runs?.reduce((sum, r) => {
        const s = r.stats as any;
        return sum + (s?.total_rows || s?.created || 0);
      }, 0) || 0;
      const lastRun = runs?.[0]?.created_at || null;

      return { totalRuns, totalRows, lastRun };
    },
    refetchInterval: 60_000,
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-muted-foreground" />
                Import Center
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Runs (7d)</p>
                    <p className="font-medium">{data?.totalRuns}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rows processed</p>
                    <p className="font-medium">{data?.totalRows}</p>
                  </div>
                  {data?.lastRun && (
                    <div className="col-span-2 text-xs text-muted-foreground">
                      Last run: {format(new Date(data.lastRun), 'MMM d, h:mm a')}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p><strong>What:</strong> CSV import activity summary</p>
          <p><strong>Where:</strong> Data from import_runs table</p>
          <p><strong>Why:</strong> Track CRM migration and data import health</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
