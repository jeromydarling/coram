/**
 * useProjects — Query hooks for Projects (Good Works).
 *
 * WHAT: CRUD for activities with activity_type = 'Project' and child notes.
 * WHERE: Projects list page, detail page.
 * WHY: Projects are activities — no separate table. Parent/child linked via parent_activity_id.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { handleMutationError } from '@/lib/permissionErrors';

export interface Project {
  id: string;
  activity_id: string;
  title: string | null;
  location: string | null;
  project_status: string | null;
  activity_date_time: string;
  notes: string | null;
  subject_contact_id: string | null;
  tenant_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  contacts?: { id: string; name: string } | null;
  // Computed from child query
  helpers_count?: number;
  served_count?: number;
  last_reflection_at?: string | null;
}

export interface ProjectNote {
  id: string;
  title: string | null;
  notes: string | null;
  activity_date_time: string;
  subject_contact_id: string | null;
  created_at: string | null;
  contacts?: { id: string; name: string } | null;
}

export function useProjects() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['projects', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id, activity_id, title, location, project_status,
          activity_date_time, notes, subject_contact_id,
          tenant_id, created_at, updated_at
        `)
        .eq('activity_type', 'Project' as any)
        .eq('tenant_id', tenantId!)
        .is('parent_activity_id', null)
        .order('activity_date_time', { ascending: false });

      if (error) throw error;

      // Get participant + child note counts per project
      const projectIds = (data || []).map(p => p.id);
      if (projectIds.length === 0) return [] as Project[];

      const [participantsRes, childrenRes] = await Promise.all([
        supabase
          .from('activity_participants')
          .select('activity_id')
          .in('activity_id', projectIds),
        supabase
          .from('activities')
          .select('parent_activity_id, activity_date_time')
          .in('parent_activity_id', projectIds)
          .order('activity_date_time', { ascending: false }),
      ]);

      const helperCounts: Record<string, number> = {};
      (participantsRes.data || []).forEach((p: any) => {
        helperCounts[p.activity_id] = (helperCounts[p.activity_id] || 0) + 1;
      });

      const lastReflection: Record<string, string> = {};
      (childrenRes.data || []).forEach((c: any) => {
        if (c.parent_activity_id && !lastReflection[c.parent_activity_id]) {
          lastReflection[c.parent_activity_id] = c.activity_date_time;
        }
      });

      return (data || []).map(p => ({
        ...p,
        helpers_count: helperCounts[p.id] || 0,
        last_reflection_at: lastReflection[p.id] || null,
      })) as Project[];
    },
  });
}

export function useProject(projectId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', projectId!)
        .eq('activity_type', 'Project' as any)
        .single();

      if (error) throw error;
      return data as Project;
    },
  });
}

export function useProjectNotes(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-notes', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id, title, notes, activity_date_time,
          subject_contact_id, created_at,
          contacts:contacts!activities_subject_contact_id_fkey (id, name)
        `)
        .eq('parent_activity_id', projectId!)
        .order('activity_date_time', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ProjectNote[];
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      activityDateTime: string;
      location?: string;
      notes?: string;
      subjectContactId?: string;
      showOnCalendar?: boolean;
      participants?: Array<{
        volunteer_id?: string | null;
        contact_id?: string | null;
        display_name: string;
        role?: string;
      }>;
    }) => {
      if (!tenantId || !user?.id) throw new Error('Missing tenant or user');

      const activityId = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // 1) Insert the Project activity
      const { data: project, error: projErr } = await supabase
        .from('activities')
        .insert({
          activity_id: activityId,
          activity_type: 'Project' as any,
          activity_date_time: input.activityDateTime,
          title: input.title,
          location: input.location || null,
          notes: input.notes || null,
          project_status: 'Planned',
          tenant_id: tenantId,
          subject_contact_id: input.subjectContactId || null,
        })
        .select()
        .single();

      if (projErr) throw projErr;

      // 2) Insert participants
      if (input.participants?.length) {
        const rows = input.participants.map(p => ({
          tenant_id: tenantId,
          activity_id: project.id,
          volunteer_id: p.volunteer_id || null,
          contact_id: p.contact_id || null,
          display_name: p.display_name,
          role: p.role || 'helper',
          created_by: user.id,
        }));
        const { error: partErr } = await supabase
          .from('activity_participants')
          .insert(rows);
        if (partErr) throw partErr;
      }

      // 3) Optionally create a calendar event
      if (input.showOnCalendar !== false) {
        await supabase.from('events').insert({
          event_name: input.title,
          event_date: input.activityDateTime,
          location: input.location || null,
          status: 'Planned',
          attended: false,
          tenant_id: tenantId,
        } as any);
      }

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      toast.success('Project created');
    },
    onError: (error) => {
      handleMutationError(error, `Failed to create project: ${error.message}`);
    },
  });
}

export function useAddProjectNote() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      notes: string;
      subjectContactId?: string;
    }) => {
      if (!tenantId) throw new Error('Missing tenant');

      const { data, error } = await supabase
        .from('activities')
        .insert({
          activity_id: `project-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          activity_type: 'Project Note' as any,
          activity_date_time: new Date().toISOString(),
          parent_activity_id: input.projectId,
          notes: input.notes,
          tenant_id: tenantId,
          subject_contact_id: input.subjectContactId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Note added');
    },
    onError: (error) => {
      handleMutationError(error, `Failed to add note: ${error.message}`);
    },
  });
}

export function useUpdateProjectStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: string }) => {
      const { error } = await supabase
        .from('activities')
        .update({ project_status: status })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });
}
