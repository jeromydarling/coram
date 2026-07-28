import { useState, useEffect } from 'react';
import { useRegionsWithLeads, useCreateRegion, useUpdateRegion, useDeleteRegion, RegionWithLead } from '@/hooks/useRegions';
import { useMetrosWithComputed, useCreateMetro, useUpdateMetro, useDeleteMetro, MetroWithComputed } from '@/hooks/useMetros';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Pencil, Trash2, Globe, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Region Edit/Create Dialog
function RegionDialog({ 
  region, 
  open, 
  onOpenChange 
}: { 
  region?: RegionWithLead; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(region?.name || '');
  const [color, setColor] = useState(region?.color || '#3b82f6');
  const createRegion = useCreateRegion();
  const updateRegion = useUpdateRegion();
  
  const isEdit = !!region;
  const isPending = createRegion.isPending || updateRegion.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEdit) {
      updateRegion.mutate({
        id: region.id,
        _previousData: region as unknown as Record<string, unknown>,
        name,
        color
      }, {
        onSuccess: () => onOpenChange(false)
      });
    } else {
      // Generate region_id from name
      const region_id = name.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
      createRegion.mutate({
        region_id,
        name,
        color
      }, {
        onSuccess: () => {
          setName('');
          setColor('#3b82f6');
          onOpenChange(false);
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Region' : 'Add Region'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update region details' : 'Create a new geographic region'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Region Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Great Plains"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-10 p-1 cursor-pointer"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="flex-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Region'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Metro Edit/Create Dialog
function MetroDialog({ 
  metro, 
  regions,
  open, 
  onOpenChange 
}: { 
  metro?: MetroWithComputed; 
  regions: RegionWithLead[];
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(metro?.metro || '');
  const [regionId, setRegionId] = useState(metro?.region_id || '');
  const createMetro = useCreateMetro();
  const updateMetro = useUpdateMetro();
  
  const isEdit = !!metro;
  const isPending = createMetro.isPending || updateMetro.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEdit) {
      updateMetro.mutate({
        id: metro.id,
        _previousData: metro as unknown as Record<string, unknown>,
        metro: name,
        region_id: regionId || null
      }, {
        onSuccess: () => onOpenChange(false)
      });
    } else {
      // Generate metro_id from name
      const metro_id = name.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
      createMetro.mutate({
        metro_id,
        metro: name,
        region_id: regionId || undefined
      } as any, {
        onSuccess: () => {
          setName('');
          setRegionId('');
          onOpenChange(false);
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Metro' : 'Add Metro'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update metro details' : 'Create a new metro area'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metro-name">Metro Name</Label>
            <Input
              id="metro-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kansas City"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Select value={regionId} onValueChange={setRegionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No region assigned</span>
                </SelectItem>
                {regions.map(region => (
                  <SelectItem key={region.id} value={region.id}>
                    <div className="flex items-center gap-2">
                      {region.color && (
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: region.color }}
                        />
                      )}
                      {region.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Metro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegionsMetrosPanel() {
  const { data: regions, isLoading: regionsLoading } = useRegionsWithLeads();
  const { data: metros, isLoading: metrosLoading } = useMetrosWithComputed();
  const deleteRegion = useDeleteRegion();
  const deleteMetro = useDeleteMetro();
  const { openMetroModal } = useGlobalModal();
  
  const [editingRegion, setEditingRegion] = useState<RegionWithLead | null>(null);
  const [showAddRegion, setShowAddRegion] = useState(false);
  const [showAddMetro, setShowAddMetro] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [hasInitialExpand, setHasInitialExpand] = useState(false);

  // Default-expand all regions on first load
  useEffect(() => {
    if (!hasInitialExpand && regions && regions.length > 0) {
      setExpandedRegions(new Set(regions.map(r => r.id)));
      setHasInitialExpand(true);
    }
  }, [regions, hasInitialExpand]);

  const isLoading = regionsLoading || metrosLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group metros by region
  const metrosByRegion = new Map<string, MetroWithComputed[]>();
  const unassignedMetros: MetroWithComputed[] = [];
  
  metros?.forEach(metro => {
    if (metro.region_id) {
      const existing = metrosByRegion.get(metro.region_id) || [];
      existing.push(metro);
      metrosByRegion.set(metro.region_id, existing);
    } else {
      unassignedMetros.push(metro);
    }
  });

  const toggleRegion = (regionId: string) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(regionId)) {
        next.delete(regionId);
      } else {
        next.add(regionId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 flex-shrink-0" />
                <span>Regions</span>
              </CardTitle>
              <CardDescription>
                Manage geographic regions and their metros
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => setShowAddRegion(true)} className="w-full sm:w-auto flex-shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Region
              </Button>
              <Button onClick={() => setShowAddMetro(true)} variant="outline" className="w-full sm:w-auto flex-shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Metro
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {regions?.map(region => {
              const regionMetros = metrosByRegion.get(region.id) || [];
              const isExpanded = expandedRegions.has(region.id);
              
              return (
                <Collapsible key={region.id} open={isExpanded}>
                  <div className="border rounded-lg">
                    <div className="flex items-center justify-between p-4">
                      <CollapsibleTrigger 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleRegion(region.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        {region.color && (
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: region.color }}
                          />
                        )}
                        <span className="font-medium">{region.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {regionMetros.length} metro{regionMetros.length !== 1 ? 's' : ''}
                        </Badge>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingRegion(region)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              disabled={regionMetros.length > 0}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Region</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{region.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteRegion.mutate({ id: region.id, name: region.name })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <CollapsibleContent>
                      {regionMetros.length > 0 ? (
                        <div className="border-t px-4 py-2 bg-muted/30">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Metro</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {regionMetros.map(metro => (
                                <TableRow key={metro.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-4 h-4 text-muted-foreground" />
                                      {metro.metro}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{metro.metroStatus}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openMetroModal(metro as unknown as Record<string, unknown>, 'edit')}
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Metro</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete "{metro.metro}"? This will also remove all associated data.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => deleteMetro.mutate({ id: metro.id, name: metro.metro })}
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
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="border-t px-4 py-6 text-center text-muted-foreground bg-muted/30">
                          No metros assigned to this region
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* All Metros Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 flex-shrink-0" />
                <span>All Metros</span>
              </CardTitle>
              <CardDescription>
                {metros?.length || 0} metro areas configured
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddMetro(true)} className="w-full sm:w-auto flex-shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Add Metro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(metros?.length || 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No metros configured yet. Add your first metro to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metro</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(metros || []).map(metro => {
                  const region = regions?.find(r => r.id === metro.region_id);
                  return (
                    <TableRow key={metro.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {metro.metro}
                        </div>
                      </TableCell>
                      <TableCell>
                        {region ? (
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: region.color || 'hsl(var(--muted-foreground))' }}
                            />
                            <span>{region.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{metro.metroStatus}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openMetroModal(metro as unknown as Record<string, unknown>, 'edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Metro</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{metro.metro}"? This will also remove all associated data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMetro.mutate({ id: metro.id, name: metro.metro })}
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <RegionDialog 
        open={showAddRegion} 
        onOpenChange={setShowAddRegion} 
      />
      <RegionDialog 
        region={editingRegion || undefined}
        open={!!editingRegion} 
        onOpenChange={(open) => !open && setEditingRegion(null)} 
      />
      <MetroDialog 
        regions={regions || []}
        open={showAddMetro} 
        onOpenChange={setShowAddMetro} 
      />
    </div>
  );
}