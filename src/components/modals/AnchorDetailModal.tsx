import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Anchor, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Star
} from 'lucide-react';
import { AnchorWithComputed } from '@/hooks/useAnchors';
import { SupportingGrantsPanel } from '@/components/anchors/SupportingGrantsPanel';
import { cn } from '@/lib/utils';

interface AnchorDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: AnchorWithComputed | null;
}

export function AnchorDetailModal({ open, onOpenChange, anchor }: AnchorDetailModalProps) {
  if (!anchor) return null;
  
  const getTierBadge = (tier: string | null) => {
    const styles: Record<string, string> = {
      'Strategic': 'bg-accent/15 text-accent',
      'Standard': 'bg-primary/15 text-primary',
      'Pilot': 'bg-muted text-muted-foreground'
    };
    return styles[tier || 'Standard'] || styles['Standard'];
  };
  
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'Scale': 'bg-success/15 text-success',
      'Stable': 'bg-primary/15 text-primary',
      'Ramp': 'bg-warning/15 text-warning',
      'Pre-Production': 'bg-muted text-muted-foreground'
    };
    return styles[status] || styles['Pre-Production'];
  };
  
  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'Up':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'Down':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };
  
  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return format(parseISO(date), 'MMM d, yyyy');
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-accent" />
            {anchor.organization || anchor.anchor_id}
          </DialogTitle>
          <DialogDescription>
            View production metrics, lifecycle timeline, and linked grants for this anchor.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Status Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn(getTierBadge(anchor.anchor_tier))}>
                {anchor.anchor_tier || 'Standard'}
              </Badge>
              <Badge className={cn(getStatusBadge(anchor.productionStatus))}>
                {anchor.productionStatus}
              </Badge>
              <div className="flex items-center gap-1 text-sm">
                {getTrendIcon(anchor.growth_trend)}
                <span className={cn(
                  anchor.growth_trend === 'Up' && 'text-success',
                  anchor.growth_trend === 'Down' && 'text-destructive'
                )}>
                  {anchor.growth_trend || 'Flat'}
                </span>
              </div>
            </div>
            
            {/* Metro */}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{anchor.metro || 'No metro assigned'}</span>
            </div>
            
            <Separator />
            
            {/* Volume Stats */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-3">Production Volume</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{anchor.last_30_day_volume || 0}</p>
                  <p className="text-xs text-muted-foreground">Last 30 Days</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{anchor.avg_monthly_volume || 0}</p>
                  <p className="text-xs text-muted-foreground">Monthly Avg</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{anchor.peak_monthly_volume || 0}</p>
                  <p className="text-xs text-muted-foreground">Peak</p>
                </div>
              </div>
            </div>
            
            {/* Timeline */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Lifecycle Timeline
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">First Contact</p>
                  <p className="font-medium">{formatDate(anchor.first_contact_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Discovery</p>
                  <p className="font-medium">{formatDate(anchor.discovery_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Agreement Signed</p>
                  <p className="font-medium">{formatDate(anchor.agreement_signed_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">First Volume</p>
                  <p className="font-medium">{formatDate(anchor.first_volume_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stable Producer</p>
                  <p className="font-medium">{formatDate(anchor.stable_producer_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Months Active</p>
                  <p className="font-medium">{anchor.monthsActive || 0} months</p>
                </div>
              </div>
            </div>
            
            {/* Cycle Times */}
            {(anchor.daysContactToAgreement || anchor.daysAgreementToFirstVolume || anchor.daysFirstToStable) && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Cycle Times</h4>
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  {anchor.daysContactToAgreement && (
                    <div>
                      <p className="text-lg font-bold">{anchor.daysContactToAgreement}</p>
                      <p className="text-xs text-muted-foreground">Days to Agreement</p>
                    </div>
                  )}
                  {anchor.daysAgreementToFirstVolume && (
                    <div>
                      <p className="text-lg font-bold">{anchor.daysAgreementToFirstVolume}</p>
                      <p className="text-xs text-muted-foreground">Days to First Volume</p>
                    </div>
                  )}
                  {anchor.daysFirstToStable && (
                    <div>
                      <p className="text-lg font-bold">{anchor.daysFirstToStable}</p>
                      <p className="text-xs text-muted-foreground">Days to Stable</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Strategic Value */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Strategic Value</span>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i}
                    className={cn(
                      'w-5 h-5',
                      i < (anchor.strategic_value_1to5 || 3)
                        ? 'fill-warning text-warning' 
                        : 'text-muted'
                    )}
                  />
                ))}
              </div>
            </div>
            
            <Separator />
            
            {/* Supporting Grants */}
            <SupportingGrantsPanel anchorId={anchor.id} />
            
            {/* Notes */}
            {anchor.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {anchor.notes}
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
