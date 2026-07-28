import { useState } from 'react';
import { useImportHistory, useImportRecords, useRollbackImport } from '@/hooks/useImportHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, History, RotateCcw, FileSpreadsheet, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const IMPORT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'events', label: 'Events' },
  { value: 'grants', label: 'Grants' },
];

function ImportTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    contacts: 'bg-blue-100 text-blue-800 border-blue-200',
    events: 'bg-purple-100 text-purple-800 border-purple-200',
    grants: 'bg-green-100 text-green-800 border-green-200',
  };

  return (
    <Badge variant="outline" className={colors[type] || 'bg-gray-100 text-gray-800'}>
      {type}
    </Badge>
  );
}

function RecordsDialog({ 
  importId, 
  open, 
  onOpenChange 
}: { 
  importId: string | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { data: records, isLoading } = useImportRecords(importId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Records</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : records && records.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Record ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="capitalize">{record.entity_type}</TableCell>
                    <TableCell>
                      <Badge variant={record.operation === 'created' ? 'default' : 'secondary'}>
                        {record.operation}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.entity_id.slice(0, 8)}...
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No records tracked for this import
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ImportHistoryPanel() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [viewRecordsId, setViewRecordsId] = useState<string | null>(null);

  const { data: history, isLoading, error } = useImportHistory(typeFilter);
  const rollback = useRollbackImport();

  const handleRollback = async () => {
    if (!rollbackId) return;
    await rollback.mutateAsync(rollbackId);
    setRollbackId(null);
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
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Error loading import history: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Import History
        </CardTitle>
        <CardDescription>
          View past CSV imports and rollback if needed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter */}
        <div className="flex gap-4">
          <div className="w-48">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* History Table */}
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No imports recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                history?.map(entry => (
                  <TableRow key={entry.id} className={entry.is_rolled_back ? 'opacity-60' : ''}>
                    <TableCell className="text-sm">
                      <div title={format(new Date(entry.imported_at), 'PPpp')}>
                        {formatDistanceToNow(new Date(entry.imported_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ImportTypeBadge type={entry.import_type} />
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={entry.file_name || undefined}>
                      {entry.file_name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.total_rows}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      +{entry.created_count}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      ~{entry.updated_count}
                    </TableCell>
                    <TableCell>
                      {entry.user_name}
                    </TableCell>
                    <TableCell>
                      {entry.is_rolled_back ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <XCircle className="w-3 h-3 mr-1" />
                          Rolled Back
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewRecordsId(entry.id)}
                          title="View records"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {!entry.is_rolled_back && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRollbackId(entry.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Rollback import"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={!!rollbackId} onOpenChange={() => setRollbackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Import</AlertDialogTitle>
            <AlertDialogDescription>
              This will undo the import by:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Deleting</strong> all records that were created by this import</li>
                <li><strong>Restoring</strong> all records that were updated to their previous state</li>
              </ul>
              <p className="mt-3 text-amber-600 font-medium">
                This action cannot be undone. Are you sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rollback.isPending}
            >
              {rollback.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Rollback Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Records View Dialog */}
      <RecordsDialog
        importId={viewRecordsId}
        open={!!viewRecordsId}
        onOpenChange={(open) => !open && setViewRecordsId(null)}
      />
    </Card>
  );
}
