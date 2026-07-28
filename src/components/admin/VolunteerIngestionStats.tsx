import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Inbox } from 'lucide-react';
import { format, startOfDay, subDays } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function VolunteerIngestionStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-volunteer-ingestion-stats'],
    queryFn: async () => {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const weekStart = startOfDay(subDays(now, 7)).toISOString();

      const [todayParsed, todayReview, weekParsed, weekReview, latest] = await Promise.all([
        supabase.from('volunteer_hours_inbox').select('id', { count: 'exact', head: true })
          .eq('parse_status', 'parsed').gte('created_at', todayStart),
        supabase.from('volunteer_hours_inbox').select('id', { count: 'exact', head: true })
          .eq('parse_status', 'needs_review').gte('created_at', todayStart),
        supabase.from('volunteer_hours_inbox').select('id', { count: 'exact', head: true })
          .eq('parse_status', 'parsed').gte('created_at', weekStart),
        supabase.from('volunteer_hours_inbox').select('id', { count: 'exact', head: true })
          .eq('parse_status', 'needs_review').gte('created_at', weekStart),
        supabase.from('volunteer_hours_inbox').select('created_at')
          .order('created_at', { ascending: false }).limit(1),
      ]);

      return {
        todayParsed: todayParsed.count || 0,
        todayReview: todayReview.count || 0,
        weekParsed: weekParsed.count || 0,
        weekReview: weekReview.count || 0,
        lastEntry: latest.data?.[0]?.created_at || null,
      };
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
                <Inbox className="w-4 h-4 text-muted-foreground" />
                Volunteer Hours Ingestion
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Today</p>
                    <p className="font-medium">{data?.todayParsed} parsed · {data?.todayReview} review</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                    <p className="font-medium">{data?.weekParsed} parsed · {data?.weekReview} review</p>
                  </div>
                  {data?.lastEntry && (
                    <div className="col-span-2 text-xs text-muted-foreground">
                      Last entry: {format(new Date(data.lastEntry), 'MMM d, h:mm a')}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p><strong>What:</strong> Volunteer hours email parsing stats</p>
          <p><strong>Where:</strong> Data from volunteer_hours_inbox</p>
          <p><strong>Why:</strong> Monitor ingestion health and review backlog</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
