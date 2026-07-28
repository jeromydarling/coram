/**
 * CaregiverNetworkModerationTab — Gardener moderation for caregiver network.
 *
 * WHAT: View abuse reports, disable profiles, see aggregate network stats.
 * WHERE: /operator/communio (Caregiver tab).
 * WHY: Gardener can moderate without seeing private message content (unless reported with consent).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, AlertTriangle, ShieldOff, Check } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export default function CaregiverNetworkModerationTab() {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Aggregate stats
  const { data: stats } = useQuery({
    queryKey: ['caregiver-network-stats'],
    queryFn: async () => {
      const [profileRes, optInRes, reportRes] = await Promise.all([
        supabase.from('caregiver_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('caregiver_profiles').select('id', { count: 'exact', head: true }).eq('network_opt_in', true).is('hidden_at', null),
        supabase.from('caregiver_network_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      return {
        total: profileRes.count ?? 0,
        active: optInRes.count ?? 0,
        openReports: reportRes.count ?? 0,
      };
    },
  });

  // Open reports
  const { data: reports = [] } = useQuery({
    queryKey: ['caregiver-network-reports-open'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caregiver_network_reports')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolution note per report
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  // Resolve report
  const resolveReport = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from('caregiver_network_reports')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
          resolution_note: note || 'Reviewed and resolved.',
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['caregiver-network-reports-open'] });
      qc.invalidateQueries({ queryKey: ['caregiver-network-stats'] });
      setResolutionNotes(prev => { const n = { ...prev }; delete n[vars.id]; return n; });
      toast.success('Report resolved.');
    },
  });

  // Disable a profile
  const disableProfile = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('caregiver_profiles')
        .update({ network_opt_in: false, hidden_at: new Date().toISOString() })
        .eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caregiver-network-stats'] });
      toast.success('Profile has been hidden from the network.');
    },
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-semibold">{stats?.total ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Total profiles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-semibold">{stats?.active ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Active & visible</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-semibold">{stats?.openReports ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Open reports</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Open reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open Reports</CardTitle>
          <CardDescription>Reports from caregivers that need review. You cannot see message content unless the reporter explicitly included it.</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No open reports. The network is peaceful.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r: any) => (
                <div key={r.id} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">Report</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                  </div>
                  <p className="text-sm">{r.reason}</p>
                  <Input
                    placeholder="Resolution note (optional)…"
                    value={resolutionNotes[r.id] || ''}
                    onChange={e => setResolutionNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                    className="text-xs h-8"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => resolveReport.mutate({ id: r.id, note: resolutionNotes[r.id] || '' })}
                      disabled={resolveReport.isPending}
                    >
                      <Check className="h-3 w-3" /> Resolve
                    </Button>
                    {r.reported_profile_id && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs gap-1"
                        onClick={() => disableProfile.mutate(r.reported_profile_id)}
                        disabled={disableProfile.isPending}
                      >
                        <ShieldOff className="h-3 w-3" /> Disable Profile
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
