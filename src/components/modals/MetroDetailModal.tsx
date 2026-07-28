import { useState, useEffect } from 'react';
import { MetroWithComputed, useUpdateMetro } from '@/hooks/useMetros';
import { useRegions } from '@/hooks/useRegions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, TrendingUp, Users, Building2, Save, Globe, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetroNarrativePanel } from '@/components/metro/MetroNarrativePanel';

interface MetroDetailModalProps {
  metro: MetroWithComputed | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MetroDetailModal({ metro, open, onOpenChange }: MetroDetailModalProps) {
  const updateMetro = useUpdateMetro();
  const { data: regions } = useRegions();
  const [formData, setFormData] = useState({
    region_id: null as string | null,
    referrals_per_month: 0,
    partner_inquiries_per_month: 0,
    waitlist_size: 0,
    distribution_partner_yn: false,
    storage_ready_yn: false,
    staff_coverage_1to5: 1,
    workforce_partners: 0,
    housing_refugee_partners: 0,
    schools_libraries: 0,
    recommendation: 'Hold' as 'Invest' | 'Build Anchors' | 'Hold' | 'Triage',
    notes: '',
    quarterly_target: 500
  });

  useEffect(() => {
    if (metro) {
      setFormData({
        region_id: metro.region_id || null,
        referrals_per_month: metro.referrals_per_month || 0,
        partner_inquiries_per_month: metro.partner_inquiries_per_month || 0,
        waitlist_size: metro.waitlist_size || 0,
        distribution_partner_yn: metro.distribution_partner_yn || false,
        storage_ready_yn: metro.storage_ready_yn || false,
        staff_coverage_1to5: metro.staff_coverage_1to5 || 1,
        workforce_partners: metro.workforce_partners || 0,
        housing_refugee_partners: metro.housing_refugee_partners || 0,
        schools_libraries: metro.schools_libraries || 0,
        recommendation: metro.recommendation || 'Hold',
        notes: metro.notes || '',
        quarterly_target: (metro as any).quarterly_target ?? 500
      });
    }
  }, [metro]);

  const handleSave = async () => {
    if (!metro) return;
    
    await updateMetro.mutateAsync({
      id: metro.id,
      _previousData: metro as unknown as Record<string, unknown>,
      ...formData
    });
    
    onOpenChange(false);
  };

  if (!metro) return null;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Expansion Ready': return 'bg-primary/10 text-primary border-primary/20';
      case 'Anchor Build': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-primary';
    if (score >= 50) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{metro.metro}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={getStatusBadgeClass(metro.metroStatus)}>
                  {metro.metroStatus}
                </Badge>
                <span className="text-muted-foreground">•</span>
                <span>Readiness Index: <strong className={getScoreColor(metro.metroReadinessIndex)}>{metro.metroReadinessIndex}</strong></span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="story" className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Story
            </TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-4">
            {/* Region Assignment */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Region
              </Label>
              <Select 
                value={formData.region_id || 'unassigned'} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, region_id: v === 'unassigned' ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(regions || []).map(region => (
                    <SelectItem key={region.id} value={region.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: region.color || 'hsl(var(--muted-foreground))' }} 
                        />
                        {region.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Users className="w-5 h-5 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Anchor Score</p>
                <p className={cn("text-2xl font-bold", getScoreColor(metro.anchorScore))}>
                  {metro.anchorScore}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <TrendingUp className="w-5 h-5 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Demand Score</p>
                <p className={cn("text-2xl font-bold", getScoreColor(metro.demandScore))}>
                  {metro.demandScore}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Building2 className="w-5 h-5 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Ops Score</p>
                <p className={cn("text-2xl font-bold", getScoreColor(metro.opsScore))}>
                  {metro.opsScore}
                </p>
              </div>
            </div>

            {/* Demand Metrics */}
            <div className="space-y-4">
              <h4 className="font-medium">Demand Metrics</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Referrals / Month</Label>
                  <Input
                    type="number"
                    value={formData.referrals_per_month}
                    onChange={(e) => setFormData(prev => ({ ...prev, referrals_per_month: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Partner Inquiries / Month</Label>
                  <Input
                    type="number"
                    value={formData.partner_inquiries_per_month}
                    onChange={(e) => setFormData(prev => ({ ...prev, partner_inquiries_per_month: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Waitlist Size</Label>
                  <Input
                    type="number"
                    value={formData.waitlist_size}
                    onChange={(e) => setFormData(prev => ({ ...prev, waitlist_size: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>

            {/* Partner Counts */}
            <div className="space-y-4">
              <h4 className="font-medium">Partner Network</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Workforce Partners</Label>
                  <Input
                    type="number"
                    value={formData.workforce_partners}
                    onChange={(e) => setFormData(prev => ({ ...prev, workforce_partners: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Housing/Refugee Partners</Label>
                  <Input
                    type="number"
                    value={formData.housing_refugee_partners}
                    onChange={(e) => setFormData(prev => ({ ...prev, housing_refugee_partners: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Schools/Libraries</Label>
                  <Input
                    type="number"
                    value={formData.schools_libraries}
                    onChange={(e) => setFormData(prev => ({ ...prev, schools_libraries: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="space-y-2">
              <Label>Recommendation</Label>
              <Select 
                value={formData.recommendation} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, recommendation: v as typeof formData.recommendation }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Invest">Invest</SelectItem>
                  <SelectItem value="Build Anchors">Build Anchors</SelectItem>
                  <SelectItem value="Hold">Hold</SelectItem>
                  <SelectItem value="Triage">Triage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="operations" className="space-y-6 mt-4">
            {/* Staff Coverage */}
            <div className="space-y-2">
              <Label>Staff Coverage (1-5)</Label>
              <Select 
                value={formData.staff_coverage_1to5.toString()} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, staff_coverage_1to5: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Minimal</SelectItem>
                  <SelectItem value="2">2 - Limited</SelectItem>
                  <SelectItem value="3">3 - Adequate</SelectItem>
                  <SelectItem value="4">4 - Good</SelectItem>
                  <SelectItem value="5">5 - Full Coverage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Operational Readiness */}
            <div className="space-y-4">
              <h4 className="font-medium">Operational Readiness</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Distribution Partner</Label>
                    <p className="text-sm text-muted-foreground">Has an established distribution partner</p>
                  </div>
                  <Switch
                    checked={formData.distribution_partner_yn}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, distribution_partner_yn: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Storage Ready</Label>
                    <p className="text-sm text-muted-foreground">Storage facilities are available</p>
                  </div>
                  <Switch
                    checked={formData.storage_ready_yn}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, storage_ready_yn: checked }))}
                  />
                </div>
              </div>
            </div>

            {/* Quarterly Target */}
            <div className="space-y-2">
              <Label>Quarterly Target (devices/month)</Label>
              <Input
                type="number"
                value={formData.quarterly_target}
                onChange={(e) => setFormData(prev => ({ ...prev, quarterly_target: parseInt(e.target.value) || 0 }))}
                placeholder="500"
              />
              <p className="text-xs text-muted-foreground">
                Monthly device volume target used in the Friday Scorecard funnel tracking
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Active Anchors</p>
                <p className="text-2xl font-bold text-primary">{metro.activeAnchors}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Pipeline</p>
                <p className="text-2xl font-bold">{metro.anchorsInPipeline}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="story" className="mt-4">
            <MetroNarrativePanel metroId={metro.id} metroName={metro.metro} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-4">
            {/* Legacy notes field */}
            <div className="space-y-2">
              <Label>General Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes about this metro..."
                className="min-h-[100px]"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.notes.length}/2000
              </p>
            </div>

            {/* Note History - using 'metro' as entity type even though it's not in the original schema */}
            {/* For now, we'll skip note history for metros since the DB doesn't have policies for it */}
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMetro.isPending}>
            {updateMetro.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
