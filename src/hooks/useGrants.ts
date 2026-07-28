import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { crosToast } from '@/lib/crosToast';
import { useLogAudit, computeChanges } from './useAuditLog';

export type GrantStage = 
  | 'Researching'
  | 'Eligible'
  | 'Cultivating'
  | 'LOI Submitted'
  | 'Full Proposal Submitted'
  | 'Awarded'
  | 'Declined'
  | 'Closed';

export type FunderType = 
  | 'Foundation'
  | 'Government - Federal'
  | 'Government - State'
  | 'Government - Local'
  | 'Corporate'
  | 'Other';

export type ReportingFrequency = 'Quarterly' | 'Annual' | 'End of Grant';
export type GrantStatus = 'Active' | 'Closed';

export interface Grant {
  id: string;
  grant_id: string;
  grant_name: string;
  funder_name: string;
  funder_type: FunderType;
  star_rating: number;
  opportunity_id: string | null;
  metro_id: string | null;
  owner_id: string;
  stage: GrantStage;
  stage_entry_date: string;
  status: GrantStatus;
  available_funding: number | null;
  amount_requested: number | null;
  amount_awarded: number | null;
  fiscal_year: number | null;
  grant_term_start: string | null;
  grant_term_end: string | null;
  is_multiyear: boolean | null;
  grant_types: string[];
  strategic_focus: string[];
  match_required: boolean | null;
  reporting_required: boolean | null;
  reporting_frequency: ReportingFrequency | null;
  notes: string | null;
  internal_strategy_notes: string | null;
  source_url: string | null;
  application_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  metros?: { metro: string } | null;
  opportunities?: { organization: string } | null;
  owner?: { display_name: string } | null;
}

export interface GrantInput {
  grant_name: string;
  funder_name: string;
  funder_type?: FunderType;
  star_rating?: number;
  opportunity_id?: string | null;
  metro_id?: string | null;
  owner_id: string;
  stage?: GrantStage;
  status?: GrantStatus;
  available_funding?: number | null;
  amount_requested?: number | null;
  amount_awarded?: number | null;
  fiscal_year?: number | null;
  grant_term_start?: string | null;
  grant_term_end?: string | null;
  is_multiyear?: boolean;
  grant_types?: string[];
  strategic_focus?: string[];
  match_required?: boolean;
  reporting_required?: boolean;
  reporting_frequency?: ReportingFrequency | null;
  notes?: string | null;
  internal_strategy_notes?: string | null;
  source_url?: string | null;
  application_url?: string | null;
}

function generateGrantId(): string {
  return 'GR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function useGrants(filters?: { 
  stage?: GrantStage; 
  status?: GrantStatus; 
  funder_type?: FunderType;
  metro_id?: string;
  owner_id?: string;
  min_star_rating?: number;
}) {
  return useQuery({
    queryKey: ['grants', filters],
    queryFn: async () => {
      let query = supabase
        .from('grants')
        .select(`
          *,
          metros:metro_id(metro),
          opportunities:opportunity_id(organization)
        `)
        .order('created_at', { ascending: false });
      
      if (filters?.stage) {
        query = query.eq('stage', filters.stage);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.funder_type) {
        query = query.eq('funder_type', filters.funder_type);
      }
      if (filters?.metro_id) {
        query = query.eq('metro_id', filters.metro_id);
      }
      if (filters?.owner_id) {
        query = query.eq('owner_id', filters.owner_id);
      }
      if (filters?.min_star_rating) {
        query = query.gte('star_rating', filters.min_star_rating);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Grant[];
    }
  });
}

export function useGrant(id: string | null) {
  return useQuery({
    queryKey: ['grant', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('grants')
        .select(`
          *,
          metros:metro_id(metro),
          opportunities:opportunity_id(organization)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Grant;
    },
    enabled: !!id
  });
}

export function useCreateGrant() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (input: GrantInput) => {
      const grantData = {
        ...input,
        grant_id: generateGrantId(),
        stage: input.stage || 'Researching',
        status: input.status || 'Active',
        funder_type: input.funder_type || 'Other',
        star_rating: input.star_rating || 3,
      };
      
      const { data, error } = await supabase
        .from('grants')
        .insert(grantData as never)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log audit
      await logAudit.mutateAsync({
        action: 'create',
        entityType: 'grant' as any,
        entityId: data.id,
        entityName: input.grant_name
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grants'] });
      crosToast.noted('Grant recorded');
    },
    onError: (error) => {
      crosToast.gentle(`Something didn't go through: ${error.message}`);
    }
  });
}

export function useUpdateGrant() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<GrantInput> & { id: string }) => {
      // Get current data for audit
      const { data: current } = await supabase
        .from('grants')
        .select('*')
        .eq('id', id)
        .single();
      
      const { data, error } = await supabase
        .from('grants')
        .update(input as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log audit with changes
      if (current) {
        const changes = computeChanges(current, input);
        await logAudit.mutateAsync({
          action: 'update',
          entityType: 'grant' as any,
          entityId: id,
          entityName: data.grant_name,
          changes: changes || undefined
        });
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grants'] });
      queryClient.invalidateQueries({ queryKey: ['grant'] });
      crosToast.updated();
    },
    onError: (error) => {
      crosToast.gentle(`Something didn't go through: ${error.message}`);
    }
  });
}

export function useUpdateGrantStage() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: GrantStage }) => {
      const { data: current } = await supabase
        .from('grants')
        .select('stage, grant_name')
        .eq('id', id)
        .single();
      
      const { data, error } = await supabase
        .from('grants')
        .update({ stage } as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log stage change
      await logAudit.mutateAsync({
        action: 'update',
        entityType: 'grant' as any,
        entityId: id,
        entityName: current?.grant_name,
        changes: { stage: { old: current?.stage, new: stage } }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grants'] });
      queryClient.invalidateQueries({ queryKey: ['grant'] });
      crosToast.updated('Stage updated');
    },
    onError: (error) => {
      crosToast.gentle(`Something didn't go through: ${error.message}`);
    }
  });
}

export function useDeleteGrant() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Get grant name for audit
      const { data: grant } = await supabase
        .from('grants')
        .select('grant_name')
        .eq('id', id)
        .single();
      
      const { error } = await supabase
        .from('grants')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Log deletion
      await logAudit.mutateAsync({
        action: 'delete',
        entityType: 'grant' as any,
        entityId: id,
        entityName: grant?.grant_name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grants'] });
      crosToast.removed();
    },
    onError: (error) => {
      crosToast.gentle(`Something didn't go through: ${error.message}`);
    }
  });
}

// Dashboard KPI hooks
export function useGrantKPIs() {
  return useQuery({
    queryKey: ['grant-kpis'],
    queryFn: async () => {
      const { data: grants, error } = await supabase
        .from('grants')
        .select('stage, status, amount_requested, amount_awarded, star_rating, opportunity_id');
      
      if (error) throw error;
      
      const activeGrants = grants.filter(g => g.status === 'Active');
      const pipelineStages: GrantStage[] = ['Researching', 'Eligible', 'Cultivating', 'LOI Submitted', 'Full Proposal Submitted'];
      const inPipeline = grants.filter(g => pipelineStages.includes(g.stage as GrantStage) && g.status === 'Active');
      
      const totalRequested = grants.reduce((sum, g) => sum + (Number(g.amount_requested) || 0), 0);
      const totalAwarded = grants.filter(g => g.stage === 'Awarded').reduce((sum, g) => sum + (Number(g.amount_awarded) || 0), 0);
      const linkedToOpportunity = grants.filter(g => g.opportunity_id).length;
      const avgStarRating = grants.length > 0 
        ? grants.reduce((sum, g) => sum + (g.star_rating || 3), 0) / grants.length 
        : 0;
      
      return {
        activeGrants: activeGrants.length,
        grantsInPipeline: inPipeline.length,
        totalRequested,
        totalAwarded,
        linkedToOpportunity,
        avgStarRating: Math.round(avgStarRating * 10) / 10
      };
    }
  });
}
