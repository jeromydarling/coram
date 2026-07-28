/**
 * OperatorPeoplePage — Gardener-level sales contacts/prospects.
 *
 * WHAT: People the gardener is cultivating as potential customers — independent of tenant contacts.
 * WHERE: /operator/people (CRESCERE zone)
 * WHY: Operators need their own contact list for outreach, not tenant-scoped contacts.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { Search, Users, Plus, Loader2, Mail, Phone, Building2, ArrowRight, Trash2 } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { format } from 'date-fns';

interface OperatorContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  organization: string | null;
  opportunity_id: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
}

function useOperatorContacts() {
  return useQuery({
    queryKey: ['operator-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_contacts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OperatorContact[];
    },
  });
}

const EMPTY_FORM = { name: '', email: '', phone: '', title: '', organization: '', notes: '' };

export default function OperatorPeoplePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: contacts, isLoading } = useOperatorContacts();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const addMutation = useMutation({
    mutationFn: async (values: typeof EMPTY_FORM) => {
      const { error } = await supabase.from('operator_contacts').insert({
        name: values.name.trim(),
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        title: values.title.trim() || null,
        organization: values.organization.trim() || null,
        notes: values.notes.trim() || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-contacts'] });
      toast.success('Contact added');
      setShowAdd(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('operator_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-contacts'] });
      toast.success('Contact removed');
    },
  });

  const filtered = (contacts || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.organization?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            People
            <HelpTooltip
              what="Your gardener-level contact list — people you're cultivating as potential customers."
              where="Operator Console → People (CRESCERE)"
              why="Keeps your sales contacts separate from tenant data. These are people you're reaching out to, not your customers' contacts."
            />
          </h1>
          <p className="text-sm text-muted-foreground">Prospects and contacts for outreach — separate from tenant data.</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Person
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, or organization…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {contacts?.length ? 'No matching contacts' : 'No contacts yet. Add someone you\'re reaching out to.'}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Organization</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Added</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{c.name}</div>
                      {c.source && c.source !== 'manual' && (
                        <Badge variant="outline" className="text-xs mt-0.5">{c.source}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {c.organization || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {c.title || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex gap-2 text-muted-foreground">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="hover:text-primary" title={c.email}>
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="hover:text-primary" title={c.phone}>
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {!c.email && !c.phone && '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                      {format(new Date(c.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(c.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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
            <DialogTitle>Add a Contact</DialogTitle>
            <DialogDescription>Add someone you're reaching out to as a potential customer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="oc-name">Name *</Label>
              <Input id="oc-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="oc-email">Email</Label>
                <Input id="oc-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@org.com" />
              </div>
              <div>
                <Label htmlFor="oc-phone">Phone</Label>
                <Input id="oc-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="oc-org">Organization</Label>
                <Input id="oc-org" value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="oc-title">Title</Label>
                <Input id="oc-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="oc-notes">Notes</Label>
              <Textarea id="oc-notes" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button onClick={() => addMutation.mutate(form)} disabled={!form.name.trim() || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
