import { useState } from 'react';
import { useAllMissionSnapshots, useCreateMissionSnapshot, useUpdateMissionSnapshot } from '@/hooks/useMissionSnapshots';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, GripVertical, Target } from 'lucide-react';
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

interface MissionSnapshot {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
}

interface MissionSnapshotFormData {
  name: string;
  description: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const defaultFormData: MissionSnapshotFormData = {
  name: '',
  description: '',
  color: COLOR_PRESETS[0],
  sort_order: 0,
  is_active: true,
};

export function MissionSnapshotsPanel() {
  const { data: missionSnapshots, isLoading } = useAllMissionSnapshots();
  const createMissionSnapshot = useCreateMissionSnapshot();
  const updateMissionSnapshot = useUpdateMissionSnapshot();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMissionSnapshot, setEditingMissionSnapshot] = useState<MissionSnapshot | null>(null);
  const [formData, setFormData] = useState<MissionSnapshotFormData>(defaultFormData);

  const handleOpenCreate = () => {
    setFormData({
      ...defaultFormData,
      sort_order: (missionSnapshots?.length || 0) + 1,
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (missionSnapshot: MissionSnapshot) => {
    setFormData({
      name: missionSnapshot.name,
      description: missionSnapshot.description || '',
      color: missionSnapshot.color || COLOR_PRESETS[0],
      sort_order: missionSnapshot.sort_order,
      is_active: missionSnapshot.is_active,
    });
    setEditingMissionSnapshot(missionSnapshot);
  };

  const handleCreate = async () => {
    await createMissionSnapshot.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
      color: formData.color,
      sort_order: formData.sort_order,
    });
    setIsCreateOpen(false);
    setFormData(defaultFormData);
  };

  const handleUpdate = async () => {
    if (!editingMissionSnapshot) return;
    await updateMissionSnapshot.mutateAsync({
      id: editingMissionSnapshot.id,
      name: formData.name,
      description: formData.description || undefined,
      color: formData.color,
      sort_order: formData.sort_order,
      is_active: formData.is_active,
    });
    setEditingMissionSnapshot(null);
    setFormData(defaultFormData);
  };

  const handleToggleActive = async (missionSnapshot: MissionSnapshot) => {
    await updateMissionSnapshot.mutateAsync({
      id: missionSnapshot.id,
      is_active: !missionSnapshot.is_active,
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
              <Target className="w-5 h-5 flex-shrink-0" />
              <span>Mission Snapshots</span>
            </CardTitle>
            <CardDescription>
              Manage mission focus areas used across opportunities
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="w-full sm:w-auto flex-shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Mission Snapshot
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Mission Snapshot</DialogTitle>
              <DialogDescription>
                Add a new mission focus area for opportunities
              </DialogDescription>
            </DialogHeader>
            <MissionSnapshotForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!formData.name || createMissionSnapshot.isPending}
              >
                {createMissionSnapshot.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
            {missionSnapshots?.map((missionSnapshot) => (
              <TableRow key={missionSnapshot.id}>
                <TableCell>
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                </TableCell>
                <TableCell className="font-medium">{missionSnapshot.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">
                  {missionSnapshot.description || '—'}
                </TableCell>
                <TableCell>
                  <div 
                    className="w-6 h-6 rounded-full border"
                    style={{ backgroundColor: missionSnapshot.color || undefined }}
                  />
                </TableCell>
                <TableCell>{missionSnapshot.sort_order}</TableCell>
                <TableCell>
                  <Switch
                    checked={missionSnapshot.is_active}
                    onCheckedChange={() => handleToggleActive(missionSnapshot)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Dialog 
                    open={editingMissionSnapshot?.id === missionSnapshot.id} 
                    onOpenChange={(open) => !open && setEditingMissionSnapshot(null)}
                  >
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleOpenEdit(missionSnapshot)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Mission Snapshot</DialogTitle>
                        <DialogDescription>
                          Update this mission focus area
                        </DialogDescription>
                      </DialogHeader>
                      <MissionSnapshotForm formData={formData} setFormData={setFormData} />
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMissionSnapshot(null)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleUpdate} 
                          disabled={!formData.name || updateMissionSnapshot.isPending}
                        >
                          {updateMissionSnapshot.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Save Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
            {missionSnapshots?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No mission snapshots found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MissionSnapshotForm({ 
  formData, 
  setFormData 
}: { 
  formData: MissionSnapshotFormData; 
  setFormData: React.Dispatch<React.SetStateAction<MissionSnapshotFormData>>;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Digital Access"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of this mission focus"
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
