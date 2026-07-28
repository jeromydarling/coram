import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit } from './useAuditLog';

export function useBulkUpdateContacts() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ ids, updates }: { 
      ids: string[]; 
      updates: Record<string, unknown>;
    }) => {
      // Update each contact
      const { error } = await supabase
        .from('contacts')
        .update(updates)
        .in('id', ids);
      
      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Updated ${data.count} contact(s)`);
      
      // Log audit for bulk update (simplified - just log the action without detailed changes)
      variables.ids.forEach(id => {
        logAudit.mutate({
          action: 'bulk_update',
          entityType: 'contact',
          entityId: id,
        });
      });
    },
    onError: (error) => {
      toast.error(`Failed to update contacts: ${error.message}`);
    }
  });
}

export function useBulkUpdateOpportunities() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ ids, updates }: { 
      ids: string[]; 
      updates: Record<string, unknown>;
    }) => {
      // Handle partner_tier update if partner_tiers is being set
      const processedUpdates = { ...updates };
      if (processedUpdates.partner_tiers && Array.isArray(processedUpdates.partner_tiers)) {
        processedUpdates.partner_tier = (processedUpdates.partner_tiers as string[])[0] || 'Other';
      }
      
      const { error } = await supabase
        .from('opportunities')
        .update(processedUpdates)
        .in('id', ids);
      
      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] }); // Contacts may reference opportunities
      toast.success(`Updated ${data.count} opportunity(ies)`);
      
      // Log audit for bulk update
      variables.ids.forEach(id => {
        logAudit.mutate({
          action: 'bulk_update',
          entityType: 'opportunity',
          entityId: id,
        });
      });
    },
    onError: (error) => {
      toast.error(`Failed to update opportunities: ${error.message}`);
    }
  });
}

export function useBulkUpdateGrants() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();
  
  return useMutation({
    mutationFn: async ({ ids, updates }: { 
      ids: string[]; 
      updates: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from('grants')
        .update(updates)
        .in('id', ids);
      
      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['grants'] });
      toast.success(`Updated ${data.count} grant(s)`);
      
      // Log audit for bulk update
      variables.ids.forEach(id => {
        logAudit.mutate({
          action: 'bulk_update',
          entityType: 'grant',
          entityId: id,
        });
      });
    },
    onError: (error) => {
      toast.error(`Failed to update grants: ${error.message}`);
    }
  });
}
