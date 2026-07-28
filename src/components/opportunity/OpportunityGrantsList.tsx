import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FileText, DollarSign, Calendar, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GrantStageBadge } from '@/components/grants/GrantStageBadge';
import { StarRatingControl } from '@/components/grants/StarRatingControl';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useState } from 'react';
import { GrantModal } from '@/components/modals/GrantModal';

interface OpportunityGrantsListProps {
  opportunityId: string;
  opportunityName?: string;
}

export function OpportunityGrantsList({ opportunityId, opportunityName }: OpportunityGrantsListProps) {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const { data: grants, isLoading } = useQuery({
    queryKey: ['opportunity-grants', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grants')
        .select('id, grant_name, funder_name, stage, star_rating, amount_requested, amount_awarded, grant_term_end')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!opportunityId,
  });
  
  const formatCurrency = (amount: number | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          Linked Grants ({grants?.length || 0})
        </p>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-xs gap-1"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="w-3 h-3" />
          Add Grant
        </Button>
      </div>
      
      {grants?.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No grants linked to this opportunity</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grants?.map((grant) => (
            <div 
              key={grant.id}
              onClick={() => navigate(`/grants/${grant.id}`)}
              className="p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{grant.grant_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{grant.funder_name}</p>
                </div>
                <StarRatingControl value={grant.star_rating} readonly size="sm" />
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <GrantStageBadge stage={grant.stage} />
                {grant.amount_awarded ? (
                  <Badge variant="secondary" className="text-xs bg-success/15 text-success">
                    <DollarSign className="w-3 h-3 mr-0.5" />
                    {formatCurrency(grant.amount_awarded)}
                  </Badge>
                ) : grant.amount_requested ? (
                  <Badge variant="secondary" className="text-xs">
                    <DollarSign className="w-3 h-3 mr-0.5" />
                    {formatCurrency(grant.amount_requested)} req.
                  </Badge>
                ) : null}
                {grant.grant_term_end && (
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="w-3 h-3 mr-0.5" />
                    {format(new Date(grant.grant_term_end), 'MMM yyyy')}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <GrantModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        defaultOpportunityId={opportunityId}
      />
    </div>
  );
}
