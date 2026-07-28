import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFeedback, FeedbackRequest, FeedbackStatus } from '@/hooks/useFeedback';
import { FeedbackAttachments } from '@/components/feedback/FeedbackAttachments';
import { FeedbackAuditTrail } from './FeedbackAuditTrail';
import { useUsers } from '@/hooks/useUsers';
import { Bug, Lightbulb, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Send, Paperclip, History } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';

const statusConfig: Record<FeedbackStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  open: { label: 'Open', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: 'In Progress', variant: 'default', icon: <AlertCircle className="w-3 h-3" /> },
  resolved: { label: 'Resolved', variant: 'outline', icon: <CheckCircle className="w-3 h-3" /> },
  declined: { label: 'Declined', variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
};

export function FeedbackPanel() {
  const { allFeedback, isLoadingAllFeedback, updateFeedback, deleteFeedback } = useFeedback();
  const { data: users = [] } = useUsers();
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState<FeedbackStatus>('open');

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.display_name || 'Unknown User';
  };

  const filteredFeedback = allFeedback.filter((f) => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    if (filterType !== 'all' && f.type !== filterType) return false;
    return true;
  });

  const handleUpdate = async () => {
    if (!selectedFeedback) return;
    
    await updateFeedback.mutateAsync({
      id: selectedFeedback.id,
      status: newStatus,
      admin_notes: adminNotes || undefined,
    });
    
    setSelectedFeedback(null);
  };

  const handleSendToLovable = (feedback: FeedbackRequest) => {
    const typeLabel = feedback.type === 'bug' ? 'Bug Report' : 'Feature Request';
    const userName = getUserName(feedback.user_id);
    const attachmentCount = feedback.attachments?.length || 0;
    
    let formattedText = `${typeLabel}: ${feedback.title}

${feedback.description}

Priority: ${feedback.priority.charAt(0).toUpperCase() + feedback.priority.slice(1)}
Submitted by: ${userName}
Date: ${format(new Date(feedback.created_at), 'MMM d, yyyy')}`;

    if (attachmentCount > 0) {
      formattedText += `\n\nNote: This request has ${attachmentCount} attachment(s) - view them in the Admin panel.`;
    }

    navigator.clipboard.writeText(formattedText);
    toast.success('Copied to clipboard! Paste it in Lovable chat.');
  };

  const openDetailDialog = (feedback: FeedbackRequest) => {
    setSelectedFeedback(feedback);
    setNewStatus(feedback.status);
    setAdminNotes(feedback.admin_notes || '');
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Status:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Type:</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[100px] sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="bug">Bugs</SelectItem>
              <SelectItem value="feature">Features</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground sm:ml-auto">
          {filteredFeedback.length} request(s)
        </div>
      </div>

      {/* Feedback List */}
      {isLoadingAllFeedback ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading feedback...
          </CardContent>
        </Card>
      ) : filteredFeedback.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No feedback requests found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFeedback.map((feedback) => {
            const status = statusConfig[feedback.status];
            const attachmentCount = feedback.attachments?.length || 0;
            return (
              <Card key={feedback.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {feedback.type === 'bug' ? (
                        <Bug className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                      ) : (
                        <Lightbulb className="w-5 h-5 text-warning mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground break-words">{feedback.title}</h3>
                          <Badge variant={status.variant} className="flex items-center gap-1 shrink-0">
                            {status.icon}
                            {status.label}
                          </Badge>
                          {attachmentCount > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                              <Paperclip className="w-3 h-3" />
                              {attachmentCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">
                          {feedback.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 text-xs text-muted-foreground">
                          <span>From: {getUserName(feedback.user_id)}</span>
                          <span>Priority: {feedback.priority}</span>
                          <span>{format(new Date(feedback.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendToLovable(feedback)}
                        title="Copy formatted request to clipboard"
                        className="w-full sm:w-auto"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        <span className="sm:inline">Send to Lovable</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetailDialog(feedback)}
                        className="w-full sm:w-auto"
                      >
                        Manage
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this feedback request? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteFeedback.mutate(feedback.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail/Edit Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedFeedback?.type === 'bug' ? (
                <Bug className="w-5 h-5 text-destructive" />
              ) : (
                <Lightbulb className="w-5 h-5 text-warning" />
              )}
              Manage Feedback
            </DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">{selectedFeedback.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{selectedFeedback.description}</p>
              </div>

              {/* Attachments */}
              {selectedFeedback.attachments && selectedFeedback.attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Attachments</h4>
                  <FeedbackAttachments attachments={selectedFeedback.attachments} />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Submitted by:</span>{' '}
                  {getUserName(selectedFeedback.user_id)}
                </div>
                <div>
                  <span className="text-muted-foreground">Priority:</span>{' '}
                  {selectedFeedback.priority}
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{' '}
                  {format(new Date(selectedFeedback.created_at), 'MMM d, yyyy h:mm a')}
                </div>
                {selectedFeedback.resolved_at && (
                  <div>
                    <span className="text-muted-foreground">Resolved:</span>{' '}
                    {format(new Date(selectedFeedback.resolved_at), 'MMM d, yyyy h:mm a')}
                  </div>
                )}
              </div>

              {/* Audit Trail */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Activity History
                </h4>
                <FeedbackAuditTrail feedbackId={selectedFeedback.id} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as FeedbackStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Notes</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes for the user (optional)"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updateFeedback.isPending}>
                  {updateFeedback.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}