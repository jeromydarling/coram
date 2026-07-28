import { useState, useRef } from 'react';
import { useSectors, useCreateSector, useUpdateSector, useDeleteSector, Sector } from '@/hooks/useSectors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Pencil, Trash2, GripVertical, Tag } from 'lucide-react';

interface SectorFormData {
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  sort_order: number;
}

const DEFAULT_FORM: SectorFormData = {
  name: '',
  description: '',
  color: '#6366f1',
  is_active: true,
  sort_order: 0
};

const COLOR_PRESETS = [
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Lime', value: '#84cc16' },
];

export function SectorsPanel() {
  const { data: sectors, isLoading } = useSectors();
  const createSector = useCreateSector();
  const updateSector = useUpdateSector();
  const deleteSector = useDeleteSector();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [formData, setFormData] = useState<SectorFormData>(DEFAULT_FORM);

  const handleOpenCreate = () => {
    setEditingSector(null);
    setFormData({
      ...DEFAULT_FORM,
      sort_order: (sectors?.length || 0) + 1
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (sector: Sector) => {
    setEditingSector(sector);
    setFormData({
      name: sector.name,
      description: sector.description || '',
      color: sector.color || '#6366f1',
      is_active: sector.is_active,
      sort_order: sector.sort_order
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    
    if (editingSector) {
      await updateSector.mutateAsync({
        id: editingSector.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        color: formData.color,
        is_active: formData.is_active,
        sort_order: formData.sort_order
      });
    } else {
      await createSector.mutateAsync({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        color: formData.color,
        is_active: formData.is_active,
        sort_order: formData.sort_order
      });
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteSector.mutateAsync(id);
  };

  const handleToggleActive = async (sector: Sector) => {
    await updateSector.mutateAsync({
      id: sector.id,
      is_active: !sector.is_active
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
              <Tag className="w-5 h-5 flex-shrink-0" />
              <span>Partner Sectors</span>
            </CardTitle>
            <CardDescription>
              Manage partner tier categories for opportunities
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="w-full sm:w-auto flex-shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Sector
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSector ? 'Edit Sector' : 'Add Sector'}</DialogTitle>
              <DialogDescription>
                {editingSector ? 'Update the sector details' : 'Create a new partner sector category'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Healthcare"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this sector"
                  maxLength={200}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  {COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color: preset.value }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === preset.value 
                          ? 'border-foreground scale-110' 
                          : 'border-transparent hover:border-muted-foreground'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.label}
                    />
                  ))}
                  <label className="relative block w-10 h-10 cursor-pointer">
                    <input
                      type="color"
                      value={formData.color.startsWith('#') ? formData.color : '#6366f1'}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      title="Pick custom color"
                    />
                    <div
                      className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                        !COLOR_PRESETS.some(p => p.value === formData.color)
                          ? 'border-foreground scale-110'
                          : 'border-dashed border-muted-foreground hover:border-foreground'
                      }`}
                      style={{
                        backgroundColor: !COLOR_PRESETS.some(p => p.value === formData.color)
                          ? formData.color
                          : 'transparent'
                      }}
                    >
                      {COLOR_PRESETS.some(p => p.value === formData.color) && (
                        <Plus className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  </label>
                </div>
                {formData.color && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: formData.color }} />
                    <span>{formData.color}</span>
                  </div>
                )}
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!formData.name.trim() || createSector.isPending || updateSector.isPending}
              >
                {(createSector.isPending || updateSector.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingSector ? 'Save Changes' : 'Create Sector'}
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
              <TableHead className="w-12">Order</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors?.map(sector => (
              <TableRow key={sector.id}>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <GripVertical className="w-4 h-4" />
                    {sector.sort_order}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: sector.color || 'hsl(var(--muted-foreground))' }}
                    />
                    <span className="font-medium">{sector.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                  {sector.description || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sector.is_active}
                      onCheckedChange={() => handleToggleActive(sector)}
                      disabled={updateSector.isPending}
                    />
                    <Badge variant={sector.is_active ? 'default' : 'secondary'}>
                      {sector.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(sector)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Sector?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{sector.name}"? This action cannot be undone.
                            Existing opportunities using this sector will retain their values.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(sector.id)}
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
            {sectors?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No sectors configured. Add your first sector to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
