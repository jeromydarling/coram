import { useState } from 'react';
import { useAllPartnershipAngles, useCreatePartnershipAngle, useUpdatePartnershipAngle } from '@/hooks/usePartnershipAngles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, GripVertical, Handshake } from 'lucide-react';
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

interface PartnershipAngle {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
}

interface PartnershipAngleFormData {
  name: string;
  description: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const defaultFormData: PartnershipAngleFormData = {
  name: '',
  description: '',
  color: COLOR_PRESETS[0],
  sort_order: 0,
  is_active: true,
};

export function PartnershipAnglesPanel() {
  const { data: partnershipAngles, isLoading } = useAllPartnershipAngles();
  const createPartnershipAngle = useCreatePartnershipAngle();
  const updatePartnershipAngle = useUpdatePartnershipAngle();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPartnershipAngle, setEditingPartnershipAngle] = useState<PartnershipAngle | null>(null);
  const [formData, setFormData] = useState<PartnershipAngleFormData>(defaultFormData);

  const handleOpenCreate = () => {
    setFormData({
      ...defaultFormData,
      sort_order: (partnershipAngles?.length || 0) + 1,
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (partnershipAngle: PartnershipAngle) => {
    setFormData({
      name: partnershipAngle.name,
      description: partnershipAngle.description || '',
      color: partnershipAngle.color || COLOR_PRESETS[0],
      sort_order: partnershipAngle.sort_order,
      is_active: partnershipAngle.is_active,
    });
    setEditingPartnershipAngle(partnershipAngle);
  };

  const handleCreate = async () => {
    await createPartnershipAngle.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
      color: formData.color,
    });
    setIsCreateOpen(false);
    setFormData(defaultFormData);
  };

  const handleUpdate = async () => {
    if (!editingPartnershipAngle) return;
    await updatePartnershipAngle.mutateAsync({
      id: editingPartnershipAngle.id,
      name: formData.name,
      description: formData.description || undefined,
      color: formData.color,
      sort_order: formData.sort_order,
      is_active: formData.is_active,
    });
    setEditingPartnershipAngle(null);
    setFormData(defaultFormData);
  };

  const handleToggleActive = async (partnershipAngle: PartnershipAngle) => {
    await updatePartnershipAngle.mutateAsync({
      id: partnershipAngle.id,
      is_active: !partnershipAngle.is_active,
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
              <Handshake className="w-5 h-5 flex-shrink-0" />
              <span>Partnership Angles</span>
            </CardTitle>
            <CardDescription>
              Manage partnership approach types used across opportunities
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="w-full sm:w-auto flex-shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Partnership Angle
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Partnership Angle</DialogTitle>
              <DialogDescription>
                Add a new partnership approach type for opportunities
              </DialogDescription>
            </DialogHeader>
            <PartnershipAngleForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!formData.name || createPartnershipAngle.isPending}
              >
                {createPartnershipAngle.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
            {partnershipAngles?.map((partnershipAngle) => (
              <TableRow key={partnershipAngle.id}>
                <TableCell>
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                </TableCell>
                <TableCell className="font-medium">{partnershipAngle.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">
                  {partnershipAngle.description || '—'}
                </TableCell>
                <TableCell>
                  <div 
                    className="w-6 h-6 rounded-full border"
                    style={{ backgroundColor: partnershipAngle.color || undefined }}
                  />
                </TableCell>
                <TableCell>{partnershipAngle.sort_order}</TableCell>
                <TableCell>
                  <Switch
                    checked={partnershipAngle.is_active}
                    onCheckedChange={() => handleToggleActive(partnershipAngle)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Dialog 
                    open={editingPartnershipAngle?.id === partnershipAngle.id} 
                    onOpenChange={(open) => !open && setEditingPartnershipAngle(null)}
                  >
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleOpenEdit(partnershipAngle)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Partnership Angle</DialogTitle>
                        <DialogDescription>
                          Update this partnership approach type
                        </DialogDescription>
                      </DialogHeader>
                      <PartnershipAngleForm formData={formData} setFormData={setFormData} />
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingPartnershipAngle(null)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleUpdate} 
                          disabled={!formData.name || updatePartnershipAngle.isPending}
                        >
                          {updatePartnershipAngle.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Save Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
            {partnershipAngles?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No partnership angles found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PartnershipAngleForm({ 
  formData, 
  setFormData 
}: { 
  formData: PartnershipAngleFormData; 
  setFormData: React.Dispatch<React.SetStateAction<PartnershipAngleFormData>>;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Device Distribution"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of this partnership approach"
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
