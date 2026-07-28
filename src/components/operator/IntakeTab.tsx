/**
 * IntakeTab — Operator Console intake inbox.
 *
 * WHAT: Filterable list + detail drawer for user help requests.
 * WHERE: Operator Console → "Intake" tab.
 * WHY: Central triage point for all tenant submissions.
 */
import { useState, useMemo } from 'react';
import { useOperatorIntake, IntakeStatus, OperatorIntakeRow } from '@/hooks/useOperatorIntake';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { AlertTriangle, Sparkles, ChevronDown, Search } from 'lucide-react';

const statusLabels: Record<IntakeStatus, string> = {
  open: 'Open',
  triaged: 'Triaged',
  in_progress: 'In Progress',
  needs_more_info: 'Needs More Info',
  resolved: 'Resolved',
  closed: 'Closed',
};

const statusVariants: Record<IntakeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'secondary',
  triaged: 'default',
  in_progress: 'default',
  needs_more_info: 'destructive',
  resolved: 'outline',
  closed: 'outline',
};

export function IntakeTab() {
  const { allIntake, isLoadingAllIntake, updateIntake } = useOperatorIntake();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<OperatorIntakeRow | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<IntakeStatus>('open');

  const filtered = useMemo(() => {
    return allIntake.filter((item) => {
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (filterType !== 'all' && item.intake_type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allIntake, filterStatus, filterType, searchQuery]);

  const openDetail = (item: OperatorIntakeRow) => {
    setSelected(item);
    setEditNotes(item.operator_notes || '');
    setEditStatus(item.status as IntakeStatus);
  };

  const handleSave = async () => {
    if (!selected) return;
    await updateIntake.mutateAsync({
      id: selected.id,
      status: editStatus,
      operator_notes: editNotes || null,
      resolved_at: editStatus === 'resolved' || editStatus === 'closed' ? new Date().toISOString() : null,
    });
    setSelected(null);
  };

  if (isLoadingAllIntake) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title or body…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="problem">Problem</SelectItem>
            <SelectItem value="request">Request</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No submissions match your filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Module</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(item)}
                  >
                    <TableCell>
                      {item.intake_type === 'problem' ? (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-primary" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">{item.title}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                      {item.module_key || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[item.status as IntakeStatus]}>
                        {statusLabels[item.status as IntakeStatus] || item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {format(new Date(item.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-base">
                  {selected.intake_type === 'problem' ? (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-primary" />
                  )}
                  {selected.title}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5 mt-6">
                {/* Body */}
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{selected.body}</p>
                </div>

                {/* Route */}
                {selected.page_path && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Page</Label>
                    <p className="mt-1 text-sm font-mono text-muted-foreground">{selected.page_path}</p>
                  </div>
                )}

                {/* Client meta (collapsed) */}
                {Object.keys(selected.client_meta || {}).length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="h-3 w-3" />
                      Technical details
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(selected.client_meta, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Timestamps */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Submitted {format(new Date(selected.created_at), 'MMM d, yyyy h:mm a')}</span>
                  {selected.resolved_at && (
                    <span>Resolved {format(new Date(selected.resolved_at), 'MMM d')}</span>
                  )}
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={(v) => setEditStatus(v as IntakeStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Gardener notes */}
                <div className="space-y-1.5">
                  <Label>Gardener Notes</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Internal notes — not visible to submitter"
                    rows={4}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={updateIntake.isPending} className="flex-1">
                    {updateIntake.isPending ? 'Saving…' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditStatus('needs_more_info');
                      handleSave();
                    }}
                    disabled={updateIntake.isPending}
                  >
                    Needs More Info
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
