import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, HandHeart } from 'lucide-react';
import type { SupportDeliveredData } from '@/hooks/useHumanImpactData';
import { useProvisionMode } from '@/hooks/useProvisionMode';

interface SupportDeliveredSectionProps {
  data: SupportDeliveredData;
}

const statusLabels: Record<string, string> = {
  draft: 'Drafting',
  submitted: 'Submitted',
  approved: 'Approved',
  ordered: 'Ordered',
  shipped: 'Shipped',
  delivered: 'Delivered',
  canceled: 'Canceled',
};

const modeTitles: Record<string, string> = {
  care: 'Care & Support Delivered',
  stewardship: 'Stewardship Summary',
  enterprise: 'Items Delivered',
};

const modeUnitLabels: Record<string, string> = {
  care: 'Items Provided',
  stewardship: 'Resources Shared',
  enterprise: 'Items Sold',
};

export function SupportDeliveredSection({ data }: SupportDeliveredSectionProps) {
  const { mode } = useProvisionMode();
  const title = modeTitles[mode] || 'Care & Support Delivered';
  const unitLabel = modeUnitLabels[mode] || 'Total Items';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <HandHeart className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top-level numbers */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <HandHeart className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.totalUnits.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground">{unitLabel}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{data.totalProvisions}</div>
            <div className="text-[11px] text-muted-foreground">Provisions</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{data.avgUnitsPerPartner}</div>
            <div className="text-[11px] text-muted-foreground">Avg per Partner</div>
          </div>
        </div>

        {/* Status breakdown */}
        {Object.keys(data.byStatus).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.byStatus).map(([status, count]) => (
              <Badge key={status} variant="outline" className="text-xs gap-1">
                {statusLabels[status] || status}
                <span className="font-bold">{count}</span>
              </Badge>
            ))}
          </div>
        )}

        {data.totalProvisions === 0 && (
          <p className="text-sm text-muted-foreground/60 italic text-center py-4">
            No provisions recorded yet. Care begins with a single act.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
