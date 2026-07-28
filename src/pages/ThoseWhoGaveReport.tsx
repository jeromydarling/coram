/**
 * ThoseWhoGaveReport — Board-ready generosity report.
 *
 * WHAT: Printable list of givers with totals for a selected timeframe.
 * WHERE: /reports/those-who-gave (tenant route).
 * WHY: Calm, grateful, human acknowledgment — not fundraising analytics.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useGenerositySummary } from '@/hooks/useGenerosity';
import { format, startOfYear, endOfYear } from 'date-fns';

export default function ThoseWhoGaveReport() {
  const { t } = useTranslation('reports');
  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfYear(now), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(now), 'yyyy-MM-dd'));

  const { data: records, isLoading } = useGenerositySummary(startDate, endDate);

  const summary = useMemo(() => {
    if (!records) return { givers: [], totalAmount: 0, totalGivers: 0 };

    const byPerson: Record<string, { name: string; total: number; isRecurring: boolean }> = {};
    for (const r of records) {
      const name = (r.contacts as any)?.name ?? 'Unknown';
      const cid = r.contact_id;
      if (!byPerson[cid]) byPerson[cid] = { name, total: 0, isRecurring: false };
      byPerson[cid].total += Number(r.amount);
      if (r.is_recurring) byPerson[cid].isRecurring = true;
    }

    const givers = Object.values(byPerson).sort((a, b) => a.name.localeCompare(b.name));
    return {
      givers,
      totalAmount: givers.reduce((s, g) => s + g.total, 0),
      totalGivers: givers.length,
    };
  }, [records]);

  return (
    <MainLayout title={t('thoseWhoGave.title')} subtitle={t('thoseWhoGave.subtitle')}>
      <div className="max-w-2xl mx-auto space-y-6 print:max-w-full">
        {/* Filters — hidden in print */}
        <div className="flex flex-wrap gap-4 items-end print:hidden">
          <div>
            <Label className="text-xs">{t('thoseWhoGave.filters.from')}</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">{t('thoseWhoGave.filters.to')}</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            {t('thoseWhoGave.filters.print')}
          </Button>
          <HelpTooltip
            what={t('thoseWhoGave.helpWhat')}
            where={t('thoseWhoGave.helpWhere')}
            why={t('thoseWhoGave.helpWhy')}
          />
        </div>

        {/* Report body */}
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle
              className="text-xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {t('thoseWhoGave.report.heading')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {format(new Date(startDate), 'MMMM d, yyyy')} — {format(new Date(endDate), 'MMMM d, yyyy')}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Totals */}
            <div className="flex justify-center gap-8 text-sm text-muted-foreground border-b pb-4">
              <span>{summary.totalGivers} {summary.totalGivers === 1 ? t('thoseWhoGave.report.personSingular') : t('thoseWhoGave.report.peoplePlural')} {t('thoseWhoGave.report.gaveLabel')}</span>
              <span>{t('thoseWhoGave.report.totalLabel')} ${summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>

            {isLoading ? (
              <p className="text-sm text-center text-muted-foreground py-8">{t('thoseWhoGave.report.loading')}</p>
            ) : summary.givers.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-8">{t('thoseWhoGave.report.empty')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 font-medium">{t('thoseWhoGave.table.name')}</th>
                    <th className="py-2 font-medium text-right">{t('thoseWhoGave.table.total')}</th>
                    <th className="py-2 font-medium text-center">{t('thoseWhoGave.table.recurring')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.givers.map((g, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2">{g.name}</td>
                      <td className="py-2 text-right">${g.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 text-center">{g.isRecurring ? t('thoseWhoGave.table.yes') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
