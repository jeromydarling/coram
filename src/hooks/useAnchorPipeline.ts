import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { calculateDaysInStage } from '@/lib/computations';
import { useLogAudit, computeChanges } from './useAuditLog';

export type PipelineStage = 
  | 'Target Identified'
  | 'Contacted'
  | 'Discovery Held'
  | 'Proposal Sent'
  | 'Agreement Pending'
  | 'Agreement Signed'
  | 'First Volume';

export interface PipelineWithComputed {
  id: string;
  anchor_pipeline_id: string;
  opportunity_id: string | null;
  metro_id: string | null;
  owner: string | null;
  stage: PipelineStage | null;
  stage_entry_date: string | null;
  last_activity_date: string | null;
  next_action: string | null;
  next_action_due: string | null;
  expected_anchor_yn: boolean | null;
  probability: number | null;
  target_first_volume_date: string | null;
  estimated_monthly_volume: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined
  organization?: string;
  metro?: string;
  // Computed
  daysInStage: number;
}

function computePipelineFields(pipeline: any): PipelineWithComputed {
  const daysInStage = calculateDaysInStage(pipeline.stage_entry_date);
  
  return {
    ...pipeline,
    // Use the opportunity's stage as source of truth for chapter mapping
    // since JourneyChapters updates opportunities.stage, not anchor_pipeline.stage
    stage: pipeline.opportunities?.stage ?? pipeline.stage,
    organization: pipeline.opportunities?.organization,
    metro: pipeline.metros?.metro,
    daysInStage
  };
}

export function useAnchorPipeline() {
  return useQuery({
    queryKey: ['anchor-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anchor_pipeline')
        .select(`
          *,
          opportunities (organization, stage),
          metros (metro)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(computePipelineFields);
    }
  });
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (pipeline: {
      anchor_pipeline_id: string;
      opportunity_id?: string;
      metro_id?: string;
      owner?: string;
      stage?: PipelineStage;
      expected_anchor_yn?: boolean;
      probability?: number;
      target_first_volume_date?: string;
      estimated_monthly_volume?: number;
      next_action?: string;
      next_action_due?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('anchor_pipeline')
        .insert(pipeline)
        .select(`
          *,
          opportunities (organization),
          metros (metro)
        `)
        .single();
      
      if (error) throw error;
      return computePipelineFields(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['anchor-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      toast.success('Pipeline record created successfully');
      
      // Log audit
      logAudit.mutate({
        action: 'create',
        entityType: 'anchor_pipeline',
        entityId: data.id,
        entityName: data.organization || data.anchor_pipeline_id
      });
    },
    onError: (error) => {
      toast.error(`Failed to create pipeline record: ${error.message}`);
    }
  });
}

export function useUpdatePipeline() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, _previousData, ...pipeline }: {
      id: string;
      _previousData?: Record<string, unknown>;
      owner?: string;
      stage?: PipelineStage;
      expected_anchor_yn?: boolean;
      probability?: number;
      target_first_volume_date?: string;
      estimated_monthly_volume?: number;
      next_action?: string;
      next_action_due?: string | null;
      last_activity_date?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('anchor_pipeline')
        .update(pipeline)
        .eq('id', id)
        .select(`
          *,
          opportunities (organization),
          metros (metro)
        `)
        .single();
      
      if (error) throw error;
      return { data: computePipelineFields(data), previousData: _previousData };
    },
    onSuccess: ({ data, previousData }) => {
      queryClient.invalidateQueries({ queryKey: ['anchor-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      toast.success('Pipeline record updated successfully');
      
      // Log audit with changes
      const changes = previousData 
        ? computeChanges(previousData, data as unknown as Record<string, unknown>)
        : null;
      
      logAudit.mutate({
        action: 'update',
        entityType: 'anchor_pipeline',
        entityId: data.id,
        entityName: data.organization || data.anchor_pipeline_id,
        changes: changes || undefined
      });
    },
    onError: (error) => {
      toast.error(`Failed to update pipeline record: ${error.message}`);
    }
  });
}

export function useDeletePipeline() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ id, entityName }: { id: string; entityName?: string }) => {
      const { error } = await supabase
        .from('anchor_pipeline')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, entityName };
    },
    onSuccess: ({ id, entityName }) => {
      queryClient.invalidateQueries({ queryKey: ['anchor-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      toast.success('Pipeline record deleted successfully');
      
      // Log audit
      logAudit.mutate({
        action: 'delete',
        entityType: 'anchor_pipeline',
        entityId: id,
        entityName: entityName
      });
    },
    onError: (error) => {
      toast.error(`Failed to delete pipeline record: ${error.message}`);
    }
  });
}

// Convert pipeline to anchor
export function useConvertPipelineToAnchor() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      // 1. Get the pipeline record with related data
      const { data: pipeline, error: pipelineError } = await supabase
        .from('anchor_pipeline')
        .select(`
          *,
          opportunities (id, organization, primary_contact_name)
        `)
        .eq('id', pipelineId)
        .single();
      
      if (pipelineError) throw pipelineError;
      if (!pipeline) throw new Error('Pipeline record not found');
      
      // 2. Generate anchor ID
      const anchorId = `ANC-${Date.now().toString(36).toUpperCase()}`;
      
      // 3. Create anchor record with copied fields
      const { data: anchor, error: anchorError } = await supabase
        .from('anchors')
        .insert({
          anchor_id: anchorId,
          opportunity_id: pipeline.opportunity_id,
          metro_id: pipeline.metro_id,
          anchor_tier: 'Standard',
          agreement_signed_date: new Date().toISOString().split('T')[0],
          notes: pipeline.notes
        })
        .select(`
          *,
          opportunities (organization),
          metros (metro)
        `)
        .single();
      
      if (anchorError) throw anchorError;
      
      // 3. Optionally delete the pipeline record (or mark as converted)
      const { error: deleteError } = await supabase
        .from('anchor_pipeline')
        .delete()
        .eq('id', pipelineId);
      
      if (deleteError) throw deleteError;
      
      return { anchor, pipelineOrg: pipeline.opportunities?.organization };
    },
    onSuccess: ({ anchor, pipelineOrg }) => {
      queryClient.invalidateQueries({ queryKey: ['anchor-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['anchors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      toast.success('Successfully converted pipeline to anchor!');
      
      // Log both actions
      logAudit.mutate({
        action: 'create',
        entityType: 'anchor',
        entityId: anchor.id,
        entityName: `${pipelineOrg || anchor.anchor_id} (converted from pipeline)`
      });
    },
    onError: (error) => {
      toast.error(`Failed to convert to anchor: ${error.message}`);
    }
  });
}
