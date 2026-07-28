/**
 * OperatorOutreachPage — Outreach campaigns and tracking links management.
 *
 * WHAT: Tabbed interface for email campaigns and signup tracking links.
 * WHERE: /operator/outreach
 * WHY: Operators need their own campaign workspace + lead attribution tracking.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { Link2, Plus, Copy, Loader2, Mail, Send, Users, MoreHorizontal, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEmailCampaigns, useDuplicateEmailCampaign, useDeleteEmailCampaign } from '@/hooks/useEmailCampaigns';
import { CampaignStatusBadge } from '@/components/outreach/CampaignStatusBadge';
import { format } from 'date-fns';

// ── Tracking Links hooks ──
function useSignupLinks() {
  return useQuery({
    queryKey: ['operator-signup-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_signup_links' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

function useCreateSignupLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (link: { slug: string; campaign_name: string; default_archetype?: string }) => {
      const { data, error } = await supabase
        .from('operator_signup_links' as any)
        .insert(link)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-signup-links'] });
      toast.success('Signup link created');
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export default function OperatorOutreachPage() {
  const navigate = useNavigate();

  // ── Campaigns state ──
  const { data: campaigns, isLoading: campaignsLoading } = useEmailCampaigns();
  const duplicateCampaign = useDuplicateEmailCampaign();
  const deleteCampaign = useDeleteEmailCampaign();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Tracking Links state ──
  const { data: links, isLoading: linksLoading } = useSignupLinks();
  const createLink = useCreateSignupLink();
  const [showCreate, setShowCreate] = useState(false);
  const [slug, setSlug] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [archetype, setArchetype] = useState('');

  const baseUrl = window.location.origin;

  const handleCopy = (linkSlug: string) => {
    navigator.clipboard.writeText(`${baseUrl}/go/${linkSlug}`);
    toast.success('Link copied to clipboard');
  };

  const handleCreateLink = () => {
    if (!slug.trim() || !campaignName.trim()) return;
    createLink.mutate(
      { slug: slug.trim(), campaign_name: campaignName.trim(), default_archetype: archetype || undefined },
      {
        onSuccess: () => {
          setSlug('');
          setCampaignName('');
          setArchetype('');
          setShowCreate(false);
        },
      }
    );
  };

  const handleDuplicate = async (id: string) => {
    const newCampaign = await duplicateCampaign.mutateAsync(id);
    navigate(`/operator/outreach/campaigns/${newCampaign.id}`);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCampaign.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Outreach</h1>
        <p className="text-sm text-muted-foreground">Email campaigns and tracking links for lead attribution</p>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">
            <Mail className="w-4 h-4 mr-1" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="links">
            <Link2 className="w-4 h-4 mr-1" />
            Tracking Links
          </TabsTrigger>
        </TabsList>

        {/* ── CAMPAIGNS TAB ── */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-5 w-5" />
              <span>{campaigns?.length || 0} campaigns</span>
            </div>
            <Button onClick={() => navigate('/operator/outreach/campaigns/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Email Campaigns</CardTitle>
              <CardDescription>Send targeted emails to partners via your connected email</CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : campaigns?.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No campaigns yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first email campaign to reach partners.</p>
                  <Button onClick={() => navigate('/operator/outreach/campaigns/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        <Users className="h-4 w-4 inline mr-1" />
                        Audience
                      </TableHead>
                      <TableHead className="text-right">
                        <Send className="h-4 w-4 inline mr-1" />
                        Sent
                      </TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns?.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <Link
                            to={`/operator/outreach/campaigns/${campaign.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {campaign.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {campaign.subject}
                        </TableCell>
                        <TableCell>
                          <CampaignStatusBadge status={campaign.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {campaign.audience_count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {campaign.sent_count > 0 ? (
                            <span className="flex items-center justify-end gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              {campaign.sent_count}
                              {campaign.failed_count > 0 && (
                                <span className="text-destructive text-xs">+{campaign.failed_count} failed</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDuplicate(campaign.id)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteId(campaign.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TRACKING LINKS TAB ── */}
        <TabsContent value="links" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link2 className="h-5 w-5" />
              <span>{links?.length || 0} tracking links</span>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Link
            </Button>
          </div>

          {linksLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !links?.length ? (
            <div className="text-center py-12">
              <Link2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tracking links yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {links.map((link: any) => (
                <Card key={link.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-primary" />
                      {link.campaign_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">/go/{link.slug}</code>
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(link.slug)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    {link.default_archetype && (
                      <p className="text-xs text-muted-foreground">Archetype: {link.default_archetype}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create tracking link dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Tracking Link</DialogTitle>
            <DialogDescription>Create a signup link for campaign attribution</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreateLink(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Spring 2026 Outreach" required />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. spring-2026" required />
              <p className="text-xs text-muted-foreground">{baseUrl}/go/{slug || 'your-slug'}</p>
            </div>
            <div className="space-y-2">
              <Label>Default Archetype (optional)</Label>
              <Input value={archetype} onChange={(e) => setArchetype(e.target.value)} placeholder="e.g. digital_inclusion" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={!slug.trim() || !campaignName.trim() || createLink.isPending}>
                {createLink.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete campaign dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
