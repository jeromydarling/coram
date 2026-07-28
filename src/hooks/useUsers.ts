import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

type AppRole = 'admin' | 'regional_lead' | 'staff' | 'leadership';

export interface UserWithDetails {
  id: string;
  user_id: string;
  display_name: string | null;
  created_at: string;
  email?: string;
  roles: AppRole[];
  region_assignment: { region_id: string; region_name: string } | null;
  metro_assignments: { metro_id: string; metro_name: string }[];
  is_approved: boolean;
  approved_at: string | null;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users-admin'],
    queryFn: async () => {
      const [profilesResult, rolesResult, regionResult, metroResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('*'),
        supabase.from('user_region_assignments').select('*, regions (name)'),
        supabase.from('user_metro_assignments').select('*, metros (metro)'),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;
      if (regionResult.error) throw regionResult.error;
      if (metroResult.error) throw metroResult.error;

      const users: UserWithDetails[] = profilesResult.data.map(profile => {
        const regionAssignment = regionResult.data.find(a => a.user_id === profile.user_id);
        const metroAssignments = metroResult.data
          .filter(a => a.user_id === profile.user_id)
          .map(a => ({
            metro_id: a.metro_id,
            metro_name: (a.metros as { metro: string })?.metro || 'Unknown',
          }));

        return {
          id: profile.id,
          user_id: profile.user_id,
          display_name: profile.display_name,
          created_at: profile.created_at || '',
          roles: rolesResult.data
            .filter(r => r.user_id === profile.user_id)
            .map(r => r.role as AppRole),
          region_assignment: regionAssignment ? {
            region_id: regionAssignment.region_id,
            region_name: (regionAssignment.regions as { name: string })?.name || 'Unknown'
          } : null,
          metro_assignments: metroAssignments,
          is_approved: (profile as any).is_approved ?? false,
          approved_at: (profile as any).approved_at || null
        };
      });

      return users;
    }
  });
}

export function useUserRoles() {
  return useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('Role assigned successfully');
    },
    onError: (error) => {
      toast.error(`Failed to assign role: ${error.message}`);
    }
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('Role removed successfully');
    },
    onError: (error) => {
      toast.error(`Failed to remove role: ${error.message}`);
    }
  });
}

export function useAssignRegion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, regionId }: { userId: string; regionId: string }) => {
      // First, remove any existing region assignment for this user
      await supabase
        .from('user_region_assignments')
        .delete()
        .eq('user_id', userId);
      
      // Then insert the new assignment
      const { data, error } = await supabase
        .from('user_region_assignments')
        .insert({ user_id: userId, region_id: regionId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      toast.success('Region assigned successfully');
    },
    onError: (error) => {
      toast.error(`Failed to assign region: ${error.message}`);
    }
  });
}

export function useRemoveRegionAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { error } = await supabase
        .from('user_region_assignments')
        .delete()
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      toast.success('Region assignment removed successfully');
    },
    onError: (error) => {
      toast.error(`Failed to remove region assignment: ${error.message}`);
    }
  });
}

// Keep the old hooks for backwards compatibility during transition
export function useAssignMetro() {
  return useAssignRegion();
}

export function useRemoveMetroAssignment() {
  return useRemoveRegionAssignment();
}

export function useAssignUserMetro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, metroId }: { userId: string; metroId: string }) => {
      const { data, error } = await supabase
        .from('user_metro_assignments')
        .upsert({ user_id: userId, metro_id: metroId }, { onConflict: 'user_id,metro_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      toast.success('Metro access granted');
    },
    onError: (error) => {
      toast.error(`Failed to assign metro: ${error.message}`);
    }
  });
}

export function useRemoveUserMetro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, metroId }: { userId: string; metroId: string }) => {
      const { error } = await supabase
        .from('user_metro_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('metro_id', metroId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      toast.success('Metro access removed');
    },
    onError: (error) => {
      toast.error(`Failed to remove metro access: ${error.message}`);
    }
  });
}

export function useApproveUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await supabase
        .rpc('approve_user', { target_user_id: userId });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      toast.success('User approved successfully');
    },
    onError: (error) => {
      toast.error(`Failed to approve user: ${error.message}`);
    }
  });
}

export function useRevokeUserApproval() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await supabase
        .rpc('revoke_user_approval', { target_user_id: userId });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      toast.success('User approval revoked');
    },
    onError: (error) => {
      toast.error(`Failed to revoke approval: ${error.message}`);
    }
  });
}
