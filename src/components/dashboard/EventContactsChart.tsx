import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEvents } from '@/hooks/useEvents';
import { useEventContactsCount } from '@/hooks/useEventContactsCount';
import { Loader2, UserPlus } from 'lucide-react';

interface EventContactsChartProps {
  className?: string;
  limit?: number;
}

export function EventContactsChart({ className, limit = 10 }: EventContactsChartProps) {
  const { t } = useTranslation('dashboard');
  const { data: events, isLoading: eventsLoading } = useEvents();
  const { data: contactsCounts, isLoading: countsLoading } = useEventContactsCount();

  const chartData = useMemo(() => {
    if (!events || !contactsCounts) return [];

    // Create data with event name and contact count
    const data = events.map(event => {
      const stats = contactsCounts[event.id];
      return {
        id: event.id,
        name: event.event_name.length > 20
          ? event.event_name.substring(0, 20) + '...'
          : event.event_name,
        fullName: event.event_name,
        date: new Date(event.event_date).toLocaleDateString(),
        contacts: stats?.count || 0,
        converted: stats?.withOpportunity || 0,
        conversionRate: stats?.conversionRate || 0,
        households: event.households_served || 0,
        type: event.event_type
      };
    });

    // Sort by contacts made (descending) and take top N
    return data
      .sort((a, b) => b.contacts - a.contacts)
      .filter(d => d.contacts > 0)
      .slice(0, limit);
  }, [events, contactsCounts, limit]);

  const isLoading = eventsLoading || countsLoading;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {t('eventContactsChart.contactsMadeByEvent')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {t('eventContactsChart.contactsMadeByEvent')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          {t('eventContactsChart.noContactsLinked')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          {t('eventContactsChart.topEventsByContacts')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" className="text-xs fill-muted-foreground" />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              className="text-xs fill-muted-foreground"
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                      <p className="font-medium text-foreground">{data.fullName}</p>
                      <p className="text-sm text-muted-foreground">{data.date}</p>
                      <p className="text-sm mt-1">
                        <span className="text-primary font-medium">{data.contacts}</span> {t('eventContactsChart.contactsMade')}
                      </p>
                      <p className="text-sm">
                        <span className="text-success font-medium">{data.converted}</span> {t('eventContactsChart.convertedToOpportunities')}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">{data.conversionRate.toFixed(0)}%</span> {t('eventContactsChart.conversionRate')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {data.households} {t('eventContactsChart.householdsServed')}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="contacts"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
              name={t('eventContactsChart.contactsMadeBar')}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
