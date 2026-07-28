import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Mail, Users, Copy, MoreHorizontal, Trash2, Send, CheckCircle2 } from 'lucide-react';
import { useEmailCampaigns, useDuplicateEmailCampaign, useDeleteEmailCampaign } from '@/hooks/useEmailCampaigns';
import { CampaignStatusBadge } from '@/components/outreach/CampaignStatusBadge';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

export default function Campaigns() {
  const navigate = useNavigate();
  const { data: campaigns, isLoading } = useEmailCampaigns();
  const duplicateCampaign = useDuplicateEmailCampaign();
  const deleteCampaign = useDeleteEmailCampaign();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDuplicate = async (id: string) => {
    const newCampaign = await duplicateCampaign.mutateAsync(id);
    navigate(`/outreach/campaigns/${newCampaign.id}`);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCampaign.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <MainLayout title="Email Campaigns" subtitle="Create and manage bulk email campaigns" helpKey="page.outreach">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-2 text-muted-foreground" data-tour="campaigns-count">
            <Mail className="h-5 w-5" />
            <span>{campaigns?.length || 0} campaigns</span>
          </div>
          <Button asChild data-tour="campaigns-new-button">
            <Link to="/outreach/campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Link>
          </Button>
        </div>

        <Card data-tour="campaigns-table">
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>
              Send targeted emails to partners via your connected Gmail
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : campaigns?.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first email campaign to reach partners.
                </p>
                <Button asChild>
                  <Link to="/outreach/campaigns/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </Link>
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
                          to={`/outreach/campaigns/${campaign.id}`}
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
      </div>

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
    </MainLayout>
  );
}
