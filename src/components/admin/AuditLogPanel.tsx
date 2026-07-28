import { useState } from 'react';
import { useAuditLog, AuditLogEntry } from '@/hooks/useAuditLog';
import { useUsers } from '@/hooks/useUsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Pencil, Trash2, Clock, User, Database } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const ENTITY_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'opportunity', label: 'Opportunities' },
  { value: 'contact', label: 'Contacts' },
  { value: 'event', label: 'Events' },
  { value: 'anchor', label: 'Anchors' },
  { value: 'anchor_pipeline', label: 'Pipeline' },
  { value: 'activity', label: 'Activities' },
  { value: 'metro', label: 'Metros' },
];

function ActionBadge({ action }: { action: string }) {
  const config = {
    create: { icon: Plus, className: 'bg-green-100 text-green-800 border-green-200' },
    update: { icon: Pencil, className: 'bg-blue-100 text-blue-800 border-blue-200' },
    delete: { icon: Trash2, className: 'bg-red-100 text-red-800 border-red-200' },
  };

  const { icon: Icon, className } = config[action as keyof typeof config] || config.update;

  return (
    <Badge variant="outline" className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {action}
    </Badge>
  );
}

function ChangesDialog({ entry }: { entry: AuditLogEntry }) {
  if (!entry.changes || Object.keys(entry.changes).length === 0) {
    return <span className="text-muted-foreground text-sm">No details</span>;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          View Changes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change Details</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {Object.entries(entry.changes).map(([field, values]) => (
              <div key={field} className="border rounded-lg p-3">
                <div className="font-medium text-sm mb-2 capitalize">
                  {field.replace(/_/g, ' ')}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Before:</span>
                    <div className="bg-destructive/10 text-destructive rounded p-2 mt-1 break-words">
                      {values.old === null || values.old === undefined 
                        ? <em className="text-muted-foreground">empty</em>
                        : String(values.old)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">After:</span>
                    <div className="bg-primary/10 text-primary rounded p-2 mt-1 break-words">
                      {values.new === null || values.new === undefined 
                        ? <em className="text-muted-foreground">empty</em>
                        : String(values.new)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function AuditLogPanel() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  
  const { data: users } = useUsers();
  const { data: logs, isLoading, error } = useAuditLog({
    entityType: entityTypeFilter === 'all' ? undefined : entityTypeFilter,
    userId: userFilter === 'all' ? undefined : userFilter,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error loading audit logs: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Activity History
        </CardTitle>
        <CardDescription>
          Track all changes made by users across the system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger>
                <Database className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger>
                <User className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users?.map(user => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.display_name || 'Unnamed User'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logs Table */}
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No activity logged yet
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      <div title={format(new Date(entry.created_at), 'PPpp')}>
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.user_name}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={entry.action} />
                    </TableCell>
                    <TableCell className="capitalize">
                      {entry.entity_type.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={entry.entity_name || undefined}>
                      {entry.entity_name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <ChangesDialog entry={entry} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
