import { useState } from 'react';
import { format } from 'date-fns';
import { 
  X, 
  Pencil, 
  Trash2, 
  Building2, 
  MapPin, 
  Calendar, 
  DollarSign, 
  FileText,
  Clock,
  User,
  Link2,
  Plus,
  Copy
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGrant, Grant } from '@/hooks/useGrants';
import { useDuplicateGrant } from '@/hooks/useDuplicateGrant';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';
import { useGrantActivities, useCreateGrantActivity, GrantActivityType } from '@/hooks/useGrantActivities';
import { GrantStageBadge } from '@/components/grants/GrantStageBadge';
import { StarRatingControl } from '@/components/grants/StarRatingControl';
import { GrantActivityTimeline } from '@/components/grants/GrantActivityTimeline';
import { LinkedAnchorsPanel } from '@/components/grants/LinkedAnchorsPanel';
import { GrantModal } from './GrantModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { SuggestedContactsPanel } from '@/components/contact-suggestions/SuggestedContactsPanel';

interface GrantDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grantId: string | null;
}

const ACTIVITY_TYPES: GrantActivityType[] = [
  'Research',
  'Call',
  'Meeting',
  'Writing',
  'Submission',
  'Reporting'
];

export function GrantDetailModal({ open, onOpenChange, grantId }: GrantDetailModalProps) {
  const { user, hasAnyRole } = useAuth();
  const { data: grant, isLoading } = useGrant(grantId);
  const { data: activities } = useGrantActivities(grantId);
  const { deleteRecord, isDeleting } = useDeleteWithUndo();
  const createActivity = useCreateGrantActivity();
  const duplicateGrant = useDuplicateGrant();
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_type: 'Research' as GrantActivityType,
    activity_date: new Date().toISOString().split('T')[0],
    notes: '',
    next_action: '',
    next_action_due: ''
  });
  
  const canViewStrategyNotes = hasAnyRole(['admin', 'leadership']);
  
  const handleDuplicate = async () => {
    if (grant) {
      const newGrant = await duplicateGrant.mutateAsync(grant);
      if (newGrant) {
        onOpenChange(false);
      }
    }
  };
  
  const handleDelete = async () => {
    if (grantId) {
      await deleteRecord(grantId, 'grant');
      onOpenChange(false);
    }
  };
  
  const handleAddActivity = async () => {
    if (!grantId || !user) return;
    
    await createActivity.mutateAsync({
      grant_id: grantId,
      activity_type: activityForm.activity_type,
      activity_date: new Date(activityForm.activity_date).toISOString(),
      notes: activityForm.notes || null,
      next_action: activityForm.next_action || null,
      next_action_due: activityForm.next_action_due ? new Date(activityForm.next_action_due).toISOString() : null,
      owner_id: user.id
    });
    
    setActivityForm({
      activity_type: 'Research',
      activity_date: new Date().toISOString().split('T')[0],
      notes: '',
      next_action: '',
      next_action_due: ''
    });
    setIsAddActivityOpen(false);
  };
  
  const formatCurrency = (amount: number | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };
  
  if (!grant && !isLoading) return null;
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex items-center justify-between sm:hidden">
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handleDuplicate}
                        disabled={duplicateGrant.isPending}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Duplicate for next fiscal year</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button variant="outline" size="icon" onClick={() => setIsEditModalOpen(true)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Grant?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this grant? You'll have 8 seconds to undo this action.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{grant?.grant_name || 'Loading...'}</DialogTitle>
              <p className="text-muted-foreground mt-1">{grant?.funder_name}</p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleDuplicate}
                      disabled={duplicateGrant.isPending}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Duplicate for next fiscal year</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" size="icon" onClick={() => setIsEditModalOpen(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Grant?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this grant? You'll have 8 seconds to undo this action.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-150px)]">
            {grant && (
              <div className="space-y-6 pr-4">
                {/* Status Bar */}
                <div className="flex flex-wrap items-center gap-3">
                  <GrantStageBadge stage={grant.stage} />
                  <Badge variant={grant.status === 'Active' ? 'default' : 'secondary'}>
                    {grant.status}
                  </Badge>
                  <Badge variant="outline">{grant.funder_type}</Badge>
                  <div className="ml-auto">
                    <StarRatingControl value={grant.star_rating} readonly size="md" />
                  </div>
                </div>
                
                <Separator />
                
                <Tabs defaultValue="details">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="activities">Activities ({activities?.length || 0})</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="details" className="space-y-6 mt-4">
                    {/* Relationships */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Metro:</span>
                        <span className="text-sm font-medium">{grant.metros?.metro || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Opportunity:</span>
                        <span className="text-sm font-medium">{grant.opportunities?.organization || '—'}</span>
                      </div>
                    </div>
                    
                    {/* Source URL */}
                    {grant.source_url && (
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Source:</span>
                        <a 
                          href={grant.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline truncate max-w-[400px]"
                        >
                          {grant.source_url}
                        </a>
                      </div>
                    )}
                    
                    {/* Amounts */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Funding
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Requested</p>
                          <p className="text-lg font-semibold">{formatCurrency(grant.amount_requested)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Awarded</p>
                          <p className="text-lg font-semibold text-success">{formatCurrency(grant.amount_awarded)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Fiscal Year</p>
                          <p className="text-lg font-semibold">{grant.fiscal_year || '—'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Timeline */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Grant Term
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Start Date</p>
                          <p className="font-medium">
                            {grant.grant_term_start ? format(new Date(grant.grant_term_start), 'MMM d, yyyy') : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">End Date</p>
                          <p className="font-medium">
                            {grant.grant_term_end ? format(new Date(grant.grant_term_end), 'MMM d, yyyy') : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Multi-year</p>
                          <p className="font-medium">{grant.is_multiyear ? 'Yes' : 'No'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tags */}
                    {(grant.grant_types?.length > 0 || grant.strategic_focus?.length > 0) && (
                      <div className="space-y-3">
                        {grant.grant_types?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Grant Types</p>
                            <div className="flex flex-wrap gap-1">
                              {grant.grant_types.map(type => (
                                <Badge key={type} variant="outline">{type}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {grant.strategic_focus?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Strategic Focus</p>
                            <div className="flex flex-wrap gap-1">
                              {grant.strategic_focus.map(focus => (
                                <Badge key={focus} variant="secondary">{focus}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Requirements */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Match Required:</span>
                        <span className={grant.match_required ? 'text-warning font-medium' : ''}>
                          {grant.match_required ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Reporting:</span>
                        <span>
                          {grant.reporting_required 
                            ? grant.reporting_frequency || 'Required' 
                            : 'Not required'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Notes */}
                    {grant.notes && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Notes
                        </h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{grant.notes}</p>
                      </div>
                    )}
                    
                    {/* Internal Strategy Notes - Admin/Leadership only */}
                    {canViewStrategyNotes && grant.internal_strategy_notes && (
                      <div className="border border-warning/30 bg-warning/5 rounded-lg p-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-warning">
                          <FileText className="w-4 h-4" />
                          Internal Strategy Notes
                        </h4>
                        <p className="text-sm whitespace-pre-wrap">{grant.internal_strategy_notes}</p>
                      </div>
                    )}
                    
                    <Separator />
                    
                    {/* Suggested Contacts */}
                    {grant.id && (
                      <SuggestedContactsPanel entityType="grant" entityId={grant.id} />
                    )}
                    
                    <Separator />
                    
                    {/* Linked Anchors */}
                    <LinkedAnchorsPanel grantId={grant.id} grantName={grant.grant_name} />
                    
                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {format(new Date(grant.created_at), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        Stage since {format(new Date(grant.stage_entry_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="activities" className="mt-4">
                    {isAddActivityOpen ? (
                      <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-medium">Log Activity</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Activity Type</Label>
                            <Select 
                              value={activityForm.activity_type} 
                              onValueChange={(v) => setActivityForm(prev => ({ ...prev, activity_type: v as GrantActivityType }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTIVITY_TYPES.map(type => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Date</Label>
                            <Input 
                              type="date" 
                              value={activityForm.activity_date}
                              onChange={(e) => setActivityForm(prev => ({ ...prev, activity_date: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea 
                            value={activityForm.notes}
                            onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="What happened?"
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Next Action</Label>
                            <Input 
                              value={activityForm.next_action}
                              onChange={(e) => setActivityForm(prev => ({ ...prev, next_action: e.target.value }))}
                              placeholder="What's next?"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Due Date</Label>
                            <Input 
                              type="date" 
                              value={activityForm.next_action_due}
                              onChange={(e) => setActivityForm(prev => ({ ...prev, next_action_due: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleAddActivity} disabled={createActivity.isPending}>
                            Save Activity
                          </Button>
                          <Button variant="outline" onClick={() => setIsAddActivityOpen(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <GrantActivityTimeline 
                        activities={activities || []} 
                        onAddActivity={() => setIsAddActivityOpen(true)}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {grant && (
        <GrantModal 
          open={isEditModalOpen} 
          onOpenChange={setIsEditModalOpen} 
          grant={grant}
        />
      )}
    </>
  );
}
