/**
 * OrganizationsTab — Settings tab showing tenant memberships and pending invitations.
 *
 * WHAT: Displays organizations the user belongs to, pending invitations, and the absorption acceptance flow.
 * WHERE: Settings → Organizations tab.
 * WHY: Free Companions need a calm, dignified way to see and join organizations while controlling relationship privacy.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Building2, Mail, Clock, CheckCircle, Shield, Copy, ArrowRight, Heart, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crosToast } from '@/lib/crosToast';

type RelationshipStrategy = 'private' | 'move' | 'copy';

interface PendingInvite {
  id: string;
  email: string;
  ministry_role: string;
  expires_at: string;
  tenant_id: string;
  tenant_name?: string;
}

export function OrganizationsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [acceptingInvite, setAcceptingInvite] = useState<PendingInvite | null>(null);
  const [strategy, setStrategy] = useState<RelationshipStrategy>('private');
  const [selectedOpps, setSelectedOpps] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  // Fetch user's organizations
  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ['my-organizations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase
        .from('tenant_users')
        .select('tenant_id, role, joined_from_companion, created_at')
        .eq('user_id', user.id);

      if (!memberships?.length) return [];

      const tenantIds = memberships.map(m => m.tenant_id);
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name, slug, archetype, logo_url')
        .in('id', tenantIds);

      return (tenants || []).map(t => ({
        ...t,
        membership: memberships.find(m => m.tenant_id === t.id),
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch pending invitations for this user's email
  const { data: pendingInvites, isLoading: invitesLoading } = useQuery({
    queryKey: ['my-pending-invites', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const { data: invites } = await supabase
        .from('tenant_invites')
        .select('id, email, ministry_role, expires_at, tenant_id')
        .eq('email', user.email.toLowerCase())
        .is('accepted_at', null)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString());

      if (!invites?.length) return [];

      // Get tenant names
      const tenantIds = invites.map(i => i.tenant_id);
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name')
        .in('id', tenantIds);

      return invites.map(i => ({
        ...i,
        tenant_name: tenants?.find(t => t.id === i.tenant_id)?.name || 'Unknown Organization',
      })) as PendingInvite[];
    },
    enabled: !!user?.email,
  });

  // Fetch personal relationships (for move/copy selection)
  const { data: personalRelationships } = useQuery({
    queryKey: ['personal-relationships', user?.id],
    queryFn: async () => {
      if (!user?.id) return { opportunities: [], contacts: [] };

      // Find user's personal (caregiver_solo) tenant
      const { data: memberships } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id);

      if (!memberships?.length) return { opportunities: [], contacts: [] };

      const tenantIds = memberships.map(m => m.tenant_id);
      const { data: soloTenants } = await supabase
        .from('tenants')
        .select('id')
        .in('id', tenantIds)
        .eq('archetype', 'caregiver_solo')
        .limit(1);

      const soloTenantId = soloTenants?.[0]?.id;
      if (!soloTenantId) return { opportunities: [], contacts: [] };

      const [oppsResult, contactsResult] = await Promise.all([
        supabase.from('opportunities')
          .select('id, organization, stage, contact_name')
          .eq('tenant_id', soloTenantId)
          .is('deleted_at', null)
          .order('organization')
          .limit(100),
        supabase.from('contacts')
          .select('id, name, email')
          .eq('tenant_id', soloTenantId)
          .is('deleted_at', null)
          .order('name')
          .limit(100),
      ]);

      return {
        opportunities: oppsResult.data || [],
        contacts: contactsResult.data || [],
      };
    },
    enabled: !!acceptingInvite && strategy !== 'private',
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!acceptingInvite) throw new Error('No invitation selected');

      const { data, error } = await supabase.functions.invoke('companion-absorb', {
        body: {
          invite_id: acceptingInvite.id,
          relationship_strategy: strategy,
          selected_opportunity_ids: strategy !== 'private' ? selectedOpps : [],
          selected_contact_ids: strategy !== 'private' ? selectedContacts : [],
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Failed to join');
      return data;
    },
    onSuccess: (data) => {
      crosToast.held(data.message || "You've joined the organization. The thread is still here.");
      setAcceptingInvite(null);
      setStrategy('private');
      setSelectedOpps([]);
      setSelectedContacts([]);
      queryClient.invalidateQueries({ queryKey: ['my-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['my-pending-invites'] });
    },
    onError: (err: Error) => crosToast.gentle(err.message),
  });

  const toggleOpp = (id: string) => {
    setSelectedOpps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const isLoading = orgsLoading || invitesLoading;

  return (
    <div className="space-y-6">
      {/* Your Organizations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Your Organizations
              </CardTitle>
              <CardDescription className="mt-1">
                Organizations you belong to and invitations awaiting your response.
              </CardDescription>
            </div>
            <HelpTooltip
              what="Shows every organization you're connected to"
              where="Settings → Organizations"
              why="Companions can belong to multiple organizations while keeping personal relationships private"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : organizations?.length ? (
            <div className="space-y-3">
              {organizations.map(org => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt="" className="h-8 w-8 rounded-full object-cover border border-border shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{org.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{org.membership?.role || 'member'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {org.membership?.joined_from_companion && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Heart className="h-3 w-3" />
                        Companion
                      </Badge>
                    )}
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <Building2 className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground font-serif">
                You're not connected to any organization yet.
              </p>
              <p className="text-xs text-muted-foreground">
                When you receive an invitation, it will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvites && pendingInvites.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Mail className="h-5 w-5" />
              Invitations
            </CardTitle>
            <CardDescription>
              You've been invited to join the following organizations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvites.map(invite => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-primary/20 bg-primary/5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">{invite.tenant_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">{invite.ministry_role}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setAcceptingInvite(invite);
                      setStrategy('private');
                      setSelectedOpps([]);
                      setSelectedContacts([]);
                    }}
                    className="gap-1.5 shrink-0"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Respond
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acceptance Dialog */}
      <Dialog open={!!acceptingInvite} onOpenChange={(open) => { if (!open) setAcceptingInvite(null); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              You've been invited to join {acceptingInvite?.tenant_name}
            </DialogTitle>
            <DialogDescription>
              Role: <span className="capitalize font-medium">{acceptingInvite?.ministry_role || 'Companion'}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Relationship Strategy */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">How would you like to handle your existing relationships?</Label>
              <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as RelationshipStrategy)} className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="private" className="mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      Keep all relationships private
                    </p>
                    <p className="text-xs text-muted-foreground">
                      They remain only in your personal Companion space. Nothing is shared.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="move" className="mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5 text-primary" />
                      Move selected relationships
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Transfers them into the organization's care. They will no longer live in your personal space.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value="copy" className="mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Copy className="h-3.5 w-3.5 text-primary" />
                      Copy selected relationships
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Keeps your original while creating an organization version.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Relationship Selection (only for move/copy) */}
            {strategy !== 'private' && (
              <div className="space-y-4">
                <Separator />

                {/* Opportunities (Journeys/People) */}
                {personalRelationships?.opportunities?.length ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Select relationships to {strategy}
                    </Label>
                    <div className="max-h-[200px] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                      {personalRelationships.opportunities.map((opp: any) => (
                        <label
                          key={opp.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedOpps.includes(opp.id)}
                            onCheckedChange={() => toggleOpp(opp.id)}
                          />
                          <div className="min-w-0">
                            <p className="text-sm truncate">{opp.organization}</p>
                            {opp.contact_name && (
                              <p className="text-xs text-muted-foreground truncate">{opp.contact_name}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedOpps.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedOpps.length} relationship{selectedOpps.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Contacts */}
                {personalRelationships?.contacts?.length ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Select people to {strategy}
                    </Label>
                    <div className="max-h-[200px] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                      {personalRelationships.contacts.map((contact: any) => (
                        <label
                          key={contact.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedContacts.includes(contact.id)}
                            onCheckedChange={() => toggleContact(contact.id)}
                          />
                          <div className="min-w-0">
                            <p className="text-sm truncate">{contact.name}</p>
                            {contact.email && (
                              <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedContacts.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedContacts.length} {selectedContacts.length !== 1 ? 'people' : 'person'} selected
                      </p>
                    )}
                  </div>
                ) : null}

                {!personalRelationships?.opportunities?.length && !personalRelationships?.contacts?.length && (
                  <p className="text-sm text-muted-foreground text-center py-4 font-serif">
                    No relationships found in your personal space.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setAcceptingInvite(null)}
              disabled={acceptMutation.isPending}
            >
              Not now
            </Button>
            <Button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending || (strategy !== 'private' && selectedOpps.length === 0 && selectedContacts.length === 0)}
              className="gap-1.5"
            >
              {acceptMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Joining…</>
              ) : (
                <><Heart className="h-4 w-4" /> Join {acceptingInvite?.tenant_name}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
