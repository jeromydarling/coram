import { useState } from 'react';
import { useGrantAlignments, useCreateGrantAlignment, useUpdateGrantAlignment, useDeleteGrantAlignment, GrantAlignment } from '@/hooks/useGrantAlignments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Pencil, Trash2, GripVertical, FileText } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const COLOR_PRESETS = [
  'hsl(200, 80%, 50%)',   // Blue
  'hsl(150, 70%, 45%)',   // Green
  'hsl(30, 80%, 55%)',    // Orange
  'hsl(280, 70%, 55%)',   // Purple
  'hsl(0, 70%, 55%)',     // Red
  'hsl(45, 80%, 50%)',    // Yellow
  'hsl(180, 60%, 45%)',   // Teal
  'hsl(320, 70%, 55%)',   // Pink
];

interface GrantAlignmentFormData {
  name: string;
  description: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const defaultFormData: GrantAlignmentFormData = {
  name: '',
  description: '',
  color: COLOR_PRESETS[0],
  sort_order: 0,
  is_active: true,
};

export function GrantAlignmentsPanel() {
  const { data: grantAlignments, isLoading } = useGrantAlignments();
  const createGrantAlignment = useCreateGrantAlignment();
  const updateGrantAlignment = useUpdateGrantAlignment();
  const deleteGrantAlignment = useDeleteGrantAlignment();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGrantAlignment, setEditingGrantAlignment] = useState<GrantAlignment | null>(null);
  const [formData, setFormData] = useState<GrantAlignmentFormData>(defaultFormData);

  const handleOpenCreate = () => {
    setFormData({
      ...defaultFormData,
      sort_order: (grantAlignments?.length || 0) + 1,
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (grantAlignment: GrantAlignment) => {
    setFormData({
      name: grantAlignment.name,
      description: grantAlignment.description || '',
      color: grantAlignment.color || COLOR_PRESETS[0],
      sort_order: grantAlignment.sort_order,
      is_active: grantAlignment.is_active,
    });
    setEditingGrantAlignment(grantAlignment);
  };

  const handleCreate = async () => {
    await createGrantAlignment.mutateAsync({
      name: formData.name,
      description: formData.description || null,
      color: formData.color,
      sort_order: formData.sort_order,
      is_active: formData.is_active,
    });
    setIsCreateOpen(false);
    setFormData(defaultFormData);
  };

  const handleUpdate = async () => {
    if (!editingGrantAlignment) return;
    await updateGrantAlignment.mutateAsync({
      id: editingGrantAlignment.id,
      name: formData.name,
      description: formData.description || null,
      color: formData.color,
      sort_order: formData.sort_order,
      is_active: formData.is_active,
    });
    setEditingGrantAlignment(null);
    setFormData(defaultFormData);
  };

  const handleDelete = async (id: string) => {
    await deleteGrantAlignment.mutateAsync(id);
  };

  const handleToggleActive = async (grantAlignment: GrantAlignment) => {
    await updateGrantAlignment.mutateAsync({
      id: grantAlignment.id,
      is_active: !grantAlignment.is_active,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 flex-shrink-0" />
              <span>Grant Alignments</span>
            </CardTitle>
            <CardDescription>
              Manage grant alignment categories used across opportunities
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="w-full sm:w-auto flex-shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Grant Alignment
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Grant Alignment</DialogTitle>
              <DialogDescription>
                Add a new grant alignment category for opportunities
              </DialogDescription>
            </DialogHeader>
            <GrantAlignmentForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!formData.name || createGrantAlignment.isPending}
              >
                {createGrantAlignment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grantAlignments?.map((grantAlignment) => (
              <TableRow key={grantAlignment.id}>
                <TableCell>
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                </TableCell>
                <TableCell className="font-medium">{grantAlignment.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">
                  {grantAlignment.description || '—'}
                </TableCell>
                <TableCell>
                  <div 
                    className="w-6 h-6 rounded-full border"
                    style={{ backgroundColor: grantAlignment.color || undefined }}
                  />
                </TableCell>
                <TableCell>{grantAlignment.sort_order}</TableCell>
                <TableCell>
                  <Switch
                    checked={grantAlignment.is_active}
                    onCheckedChange={() => handleToggleActive(grantAlignment)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Dialog 
                      open={editingGrantAlignment?.id === grantAlignment.id} 
                      onOpenChange={(open) => !open && setEditingGrantAlignment(null)}
                    >
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleOpenEdit(grantAlignment)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Grant Alignment</DialogTitle>
                          <DialogDescription>
                            Update this grant alignment category
                          </DialogDescription>
                        </DialogHeader>
                        <GrantAlignmentForm formData={formData} setFormData={setFormData} />
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditingGrantAlignment(null)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleUpdate} 
                            disabled={!formData.name || updateGrantAlignment.isPending}
                          >
                            {updateGrantAlignment.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Grant Alignment</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{grantAlignment.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(grantAlignment.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {grantAlignments?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No grant alignments found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GrantAlignmentForm({ 
  formData, 
  setFormData 
}: { 
  formData: GrantAlignmentFormData; 
  setFormData: React.Dispatch<React.SetStateAction<GrantAlignmentFormData>>;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Digital Equity"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of this grant alignment"
        />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2 flex-wrap">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setFormData(prev => ({ ...prev, color }))}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sort_order">Sort Order</Label>
        <Input
          id="sort_order"
          type="number"
          value={formData.sort_order}
          onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
          min={0}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>
    </div>
  );
}
