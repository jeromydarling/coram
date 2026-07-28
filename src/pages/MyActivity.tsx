import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePersonalActivityReport, TimePeriod } from '@/hooks/usePersonalActivityReport';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Award,
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

function TrendBadge({ value }: { value: number }) {
  const { t } = useTranslation('activities');
  if (value === 0) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Minus className="w-3 h-3" />
        {t('myStats.noChange')}
      </Badge>
    );
  }
  
  if (value > 0) {
    return (
      <Badge className="gap-1 bg-success/15 text-success border-success/30">
        <TrendingUp className="w-3 h-3" />
        +{value}%
      </Badge>
    );
  }
  
  return (
    <Badge className="gap-1 bg-destructive/15 text-destructive border-destructive/30">
      <TrendingDown className="w-3 h-3" />
      {value}%
    </Badge>
  );
}

function StatCard({
  title,
  value,
  attendedValue,
  icon: Icon,
  trend,
  color,
  ytd,
  ytdAttended,
}: {
  title: string;
  value: number;
  attendedValue?: number;
  icon: React.ElementType;
  trend: number;
  color: string;
  ytd: number;
  ytdAttended?: number;
}) {
  const { t } = useTranslation('activities');
  const hasAttended = attendedValue !== undefined;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            {hasAttended ? (
              <div className="space-y-1">
                <p className="text-3xl font-bold text-success">{attendedValue} <span className="text-lg font-normal text-muted-foreground">{t('myStats.attended')}</span></p>
                <p className="text-sm text-muted-foreground">{t('myStats.missedOf', { total: value, count: value - (attendedValue ?? 0) })}</p>
              </div>
            ) : (
              <p className="text-3xl font-bold">{value}</p>
            )}
            <div className="flex items-center gap-2">
              <TrendBadge value={trend} />
              <span className="text-xs text-muted-foreground">{t('myStats.vsPrevious')}</span>
            </div>
          </div>
          <div className={cn("p-3 rounded-lg", color)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          {hasAttended ? (
            <p className="text-xs text-muted-foreground">
              {t('myStats.ytdLabel', { attended: ytdAttended, total: ytd })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('myStats.yearToDate', { count: ytd })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyActivity() {
  const { t } = useTranslation('activities');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('weekly');
  const { profile } = useAuth();
  const { data, isLoading } = usePersonalActivityReport(timePeriod);

  const periodLabel = timePeriod === 'weekly'
    ? t('myStats.periodThisWeek')
    : timePeriod === 'monthly'
    ? t('myStats.periodThisMonth')
    : t('myStats.periodThisYear');

  return (
    <MainLayout
      title={t('myStats.title')}
      mobileTitle={t('myStats.mobileTitle')}
      subtitle={t('myStats.subtitle', { name: profile?.nickname || profile?.display_name || 'you' })}
    >
      <div className="space-y-6">
        {/* Time Period Tabs */}
        <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <TabsList>
            <TabsTrigger value="weekly">{t('myStats.weekly')}</TabsTrigger>
            <TabsTrigger value="monthly">{t('myStats.monthly')}</TabsTrigger>
            <TabsTrigger value="yearly">{t('myStats.yearly')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title={`${t('myStats.meetings')} (${periodLabel})`}
                value={data?.currentPeriod.meetings || 0}
                attendedValue={data?.currentPeriod.meetingsAttended || 0}
                icon={Users}
                trend={data?.percentChange.meetingsAttended || 0}
                color="bg-primary/15 text-primary"
                ytd={data?.ytdTotals.meetings || 0}
                ytdAttended={data?.ytdTotals.meetingsAttended || 0}
              />
              <StatCard
                title={`${t('myStats.events')} (${periodLabel})`}
                value={data?.currentPeriod.events || 0}
                attendedValue={data?.currentPeriod.eventsAttended || 0}
                icon={Calendar}
                trend={data?.percentChange.eventsAttended || 0}
                color="bg-warning/15 text-warning"
                ytd={data?.ytdTotals.events || 0}
                ytdAttended={data?.ytdTotals.eventsAttended || 0}
              />
              <StatCard
                title={`${t('myStats.tasksCompleted')} (${periodLabel})`}
                value={data?.currentPeriod.tasksCompleted || 0}
                icon={CheckSquare}
                trend={data?.percentChange.tasksCompleted || 0}
                color="bg-success/15 text-success"
                ytd={data?.ytdTotals.tasksCompleted || 0}
              />
              <StatCard
                title={`${t('myStats.totalActivities')} (${periodLabel})`}
                value={data?.currentPeriod.total || 0}
                icon={Award}
                trend={data?.percentChange.total || 0}
                color="bg-info/15 text-info"
                ytd={data?.ytdTotals.total || 0}
              />
            </div>

            {/* Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('myStats.activityTrends')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data?.periods || []}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorMeetings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis 
                        dataKey="label" 
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = {
                            'counts.meetings': t('myStats.meetings'),
                            'counts.events': t('myStats.events'),
                            'counts.tasksCompleted': t('myStats.tasksCompleted'),
                          };
                          return [value, labels[name] || name];
                        }}
                      />
                      <Legend
                        formatter={(value) => {
                          const labels: Record<string, string> = {
                            'counts.meetings': t('myStats.meetings'),
                            'counts.events': t('myStats.events'),
                            'counts.tasksCompleted': t('myStats.tasksCompleted'),
                          };
                          return labels[value] || value;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="counts.meetings"
                        stroke="hsl(var(--primary))"
                        fillOpacity={1}
                        fill="url(#colorMeetings)"
                        strokeWidth={2}
                        name="counts.meetings"
                      />
                      <Area
                        type="monotone"
                        dataKey="counts.events"
                        stroke="hsl(var(--warning))"
                        fillOpacity={1}
                        fill="url(#colorEvents)"
                        strokeWidth={2}
                        name="counts.events"
                      />
                      <Area
                        type="monotone"
                        dataKey="counts.tasksCompleted"
                        stroke="hsl(var(--success))"
                        fillOpacity={1}
                        fill="url(#colorTasks)"
                        strokeWidth={2}
                        name="counts.tasksCompleted"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* YTD Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  {t('myStats.ytdAccomplishments')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="text-center p-6 rounded-lg bg-primary/5 border border-primary/20">
                    <Users className="w-10 h-10 mx-auto text-primary mb-3" />
                    <p className="text-4xl font-bold text-success">{data?.ytdTotals.meetingsAttended || 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('myStats.meetingsAttended')}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('myStats.missedOf', { total: data?.ytdTotals.meetings || 0, count: (data?.ytdTotals.meetings || 0) - (data?.ytdTotals.meetingsAttended || 0) })}
                    </p>
                  </div>
                  <div className="text-center p-6 rounded-lg bg-warning/5 border border-warning/20">
                    <Calendar className="w-10 h-10 mx-auto text-warning mb-3" />
                    <p className="text-4xl font-bold text-success">{data?.ytdTotals.eventsAttended || 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('myStats.eventsAttended')}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('myStats.missedOf', { total: data?.ytdTotals.events || 0, count: (data?.ytdTotals.events || 0) - (data?.ytdTotals.eventsAttended || 0) })}
                    </p>
                  </div>
                  <div className="text-center p-6 rounded-lg bg-success/5 border border-success/20">
                    <CheckSquare className="w-10 h-10 mx-auto text-success mb-3" />
                    <p className="text-4xl font-bold text-success">{data?.ytdTotals.tasksCompleted || 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('myStats.tasksCompleted')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
