/**
 * OperatorPartnersPage — Gardener's own sales pipeline (operator_opportunities).
 *
 * WHAT: Organizations the gardener is cultivating — completely separate from tenant data.
 * WHERE: /operator/partners (CRESCERE zone)
 * WHY: The gardener needs their own CRM for prospects, not access to tenant opportunities.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Search, Building2, Plus, Loader2, Filter, ArrowRight } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { format } from 'date-fns';

const STAGES = [
  'Researching', 'Contacted', 'Discovery Scheduled', 'Discovery Held',
  'Proposal Sent', 'Agreement Pending', 'Agreement Signed', 'Onboarding',
  'Active Customer', 'Closed - Not a Fit',
];

interface OperatorOpportunity {
  id: string;
  organization: string;
  website: string | null;
  notes: string | null;
  stage: string;
  status: string;
  metro: string | null;
  primary_contact_id: string | null;
  source: string | null;
  created_at: string;
  primary_contact?: { id: string; name: string } | null;
}

function useOperatorOpportunities() {
  return useQuery({
    queryKey: ['operator-opportunities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_opportunities')
        .select('*, primary_contact:operator_contacts!operator_opportunities_primary_contact_id_fkey(id, name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as OperatorOpportunity[];
    },
  });
}

const EMPTY_FORM = { organization: '', website: '', metro: '', notes: '', stage: 'Researching' };

export default function OperatorPartnersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: opportunities, isLoading, error } = useOperatorOpportunities();
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const addMutation = useMutation({
    mutationFn: async (values: typeof EMPTY_FORM) => {
      const { error } = await supabase.from('operator_opportunities').insert({
        organization: values.organization.trim(),
        website: values.website.trim() || null,
        metro: values.metro.trim() || null,
        notes: values.notes.trim() || null,
        stage: values.stage,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-opportunities'] });
      toast.success('Opportunity added');
      setShowAdd(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = (opportunities || []).filter((opp) => {
    const matchesSearch =
      opp.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.metro?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'all' || opp.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const getStageBadgeVariant = (stage: string) => {
    if (['Agreement Signed', 'Onboarding', 'Active Customer'].includes(stage)) return 'default' as const;
    if (['Closed - Not a Fit'].includes(stage)) return 'destructive' as const;
    return 'secondary' as const;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error loading opportunities: {(error as any).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Partners
            <HelpTooltip
              what="Your sales pipeline — organizations you're cultivating as potential CROS customers or ecosystem partners."
              where="Operator Console → Partners (CRESCERE)"
              why="This is your own CRM, completely separate from your tenants' data. Track prospects through the journey from research to active customer."
            />
          </h1>
          <p className="text-sm text-muted-foreground">Your sales pipeline — organizations you're cultivating.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Opportunity
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by organization or metro…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {opportunities?.length ? 'No matching opportunities' : 'No opportunities yet. Start building your pipeline.'}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Organization</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Stage</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Metro</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Primary Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((opp) => (
                  <tr
                    key={opp.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/operator/partners/${opp.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{opp.organization}</div>
                      {opp.source && opp.source !== 'manual' && (
                        <span className="text-xs text-muted-foreground">{opp.source}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant={getStageBadgeVariant(opp.stage)}>{opp.stage}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {opp.metro || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {opp.primary_contact?.name || '—'}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                      {format(new Date(opp.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { if (!open) { setShowAdd(false); setForm(EMPTY_FORM); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an Opportunity</DialogTitle>
            <DialogDescription>Add an organization you're cultivating as a prospect or partner.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="oo-org">Organization *</Label>
              <Input id="oo-org" value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} placeholder="Acme Nonprofit" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="oo-website">Website</Label>
                <Input id="oo-website" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://…" />
              </div>
              <div>
                <Label htmlFor="oo-metro">Metro / City</Label>
                <Input id="oo-metro" value={form.metro} onChange={(e) => setForm((f) => ({ ...f, metro: e.target.value }))} placeholder="Atlanta" />
              </div>
            </div>
            <div>
              <Label htmlFor="oo-stage">Starting Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                <SelectTrigger id="oo-stage"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="oo-notes">Notes</Label>
              <Textarea id="oo-notes" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button onClick={() => addMutation.mutate(form)} disabled={!form.organization.trim() || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Add Opportunity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
