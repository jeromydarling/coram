import { DollarSign, Calendar, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAnchorGrantLinks } from '@/hooks/useGrantAnchorLinks';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface SupportingGrantsPanelProps {
  anchorId: string;
}

export function SupportingGrantsPanel({ anchorId }: SupportingGrantsPanelProps) {
  const { data: links, isLoading } = useAnchorGrantLinks(anchorId);
  
  const getLinkTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      'funded': 'bg-success/15 text-success',
      'supported': 'bg-primary/15 text-primary',
      'influenced': 'bg-info/15 text-info'
    };
    return styles[type] || 'bg-muted text-muted-foreground';
  };
  
  const getStageBadge = (stage: string) => {
    const styles: Record<string, string> = {
      'Awarded': 'bg-success/15 text-success',
      'Submitted': 'bg-info/15 text-info',
      'Writing': 'bg-warning/15 text-warning',
    };
    return styles[stage] || 'bg-muted text-muted-foreground';
  };
  
  const formatCurrency = (amount: number | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      maximumFractionDigits: 0 
    }).format(amount);
  };
  
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading grants...</div>;
  }
  
  if (!links || links.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No grants linked to this anchor.</p>
      </div>
    );
  }
  
  // Calculate total awarded
  const totalAwarded = links.reduce((sum, link) => {
    return sum + (link.grants?.amount_awarded || 0);
  }, 0);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Award className="w-4 h-4" />
          Supporting Grants
        </h4>
        {totalAwarded > 0 && (
          <span className="text-sm font-medium text-success">
            {formatCurrency(totalAwarded)} awarded
          </span>
        )}
      </div>
      
      <div className="space-y-3">
        {links.map((link) => {
          const grant = link.grants;
          if (!grant) return null;
          
          return (
            <div 
              key={link.id} 
              className="p-3 bg-muted/50 rounded-lg space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{grant.grant_name}</p>
                  <p className="text-sm text-muted-foreground">{grant.funder_name}</p>
                </div>
                <div className="flex gap-1">
                  <Badge className={cn('text-xs', getLinkTypeBadge(link.link_type))}>
                    {link.link_type}
                  </Badge>
                  <Badge className={cn('text-xs', getStageBadge(grant.stage))}>
                    {grant.stage}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {grant.amount_awarded && (
                  <span className="flex items-center gap-1 text-success font-medium">
                    <DollarSign className="w-3 h-3" />
                    {formatCurrency(grant.amount_awarded)}
                  </span>
                )}
                {grant.grant_term_start && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Started {format(parseISO(grant.grant_term_start), 'MMM yyyy')}
                  </span>
                )}
              </div>
              
              {link.notes && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                  {link.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
