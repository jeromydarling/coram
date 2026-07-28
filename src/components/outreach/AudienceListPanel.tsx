import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Trash2, Search, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useCampaignAudience } from '@/hooks/useCampaignAudience';
import { useRemoveRecipients } from '@/hooks/useGmailCampaignSend';
import { useBulkSelection } from '@/hooks/useBulkSelection';
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

interface AudienceListPanelProps {
  campaignId: string;
  onCountChange?: (count: number) => void;
  isEditable?: boolean;
}

const statusIcons: Record<string, React.ReactNode> = {
  queued: <Clock className="h-3 w-3 text-muted-foreground" />,
  sent: <CheckCircle2 className="h-3 w-3 text-green-600" />,
  failed: <XCircle className="h-3 w-3 text-destructive" />,
};

export function AudienceListPanel({ campaignId, onCountChange, isEditable = true }: AudienceListPanelProps) {
  const [search, setSearch] = useState('');
  const { data: audience = [], isLoading, dataUpdatedAt } = useCampaignAudience(campaignId);
  const removeRecipients = useRemoveRecipients();
  const selection = useBulkSelection<{ id: string }>();

  useEffect(() => {
    selection.clearSelection();
  }, [dataUpdatedAt]);

  useEffect(() => {
    onCountChange?.(audience.length);
  }, [audience.length, onCountChange]);

  const filteredAudience = audience.filter((member) => {
    const searchLower = search.toLowerCase();
    return (
      member.email.toLowerCase().includes(searchLower) ||
      (member.name?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const handleDeleteOne = async (id: string) => {
    const result = await removeRecipients.mutateAsync({ campaignId, recipientIds: [id] });
    onCountChange?.(result.new_count);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selection.selectedIds);
    const result = await removeRecipients.mutateAsync({ campaignId, recipientIds: ids });
    selection.clearSelection();
    onCountChange?.(result.new_count);
  };

  const isDeleting = removeRecipients.isPending;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Audience List
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Audience List
            </CardTitle>
            <CardDescription>
              {audience.length} recipients in this campaign
            </CardDescription>
          </div>
          {isEditable && selection.selectedCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Remove {selection.selectedCount}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Recipients</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove {selection.selectedCount} recipient(s)?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete}>Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {audience.length > 0 && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipients..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch('')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isEditable && (
              <div className="flex items-center gap-2 border-b pb-2">
                <Checkbox
                  checked={selection.isAllSelected(filteredAudience)}
                  onCheckedChange={(checked) => {
                    if (checked) selection.selectAll(filteredAudience);
                    else selection.clearSelection();
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {search ? `${filteredAudience.length} of ${audience.length}` : `${audience.length} total`}
                </span>
              </div>
            )}

            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {filteredAudience.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent group">
                    {isEditable && (
                      <Checkbox
                        checked={selection.isSelected(member.id)}
                        onCheckedChange={() => selection.toggle(member.id)}
                      />
                    )}
                    {statusIcons[member.status] || statusIcons.queued}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.name || member.email}</p>
                      {member.name && (
                        <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{member.source}</Badge>
                    {isEditable && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteOne(member.id)}
                        disabled={isDeleting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {filteredAudience.length === 0 && search && (
                  <p className="text-center py-8 text-muted-foreground">No recipients match "{search}"</p>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        {audience.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recipients yet</p>
            <p className="text-sm">Build your audience using the filters</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
