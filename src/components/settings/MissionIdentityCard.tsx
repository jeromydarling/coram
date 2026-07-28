/**
 * MissionIdentityCard — Tenant-facing archetype & narrative tone selector.
 *
 * WHAT: Lets tenants view and gently update their mission archetype and relational orientation.
 * WHERE: Settings → Modules tab.
 * WHY: As organizations grow, their identity may shift — a workforce org may add faith community work.
 *       This gives them agency without requiring a Gardener to intervene.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Compass, Save, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { HelpTooltip } from '@/components/ui/help-tooltip';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const ORIENTATION_OPTIONS = [
  { value: 'people_first', label: 'People-first', desc: 'Relationships with individuals drive your mission' },
  { value: 'institution_focused', label: 'Partner-first', desc: 'Organizational partnerships drive your mission' },
  { value: 'community_based', label: 'Community-based', desc: 'Neighborhood and geographic presence drive your mission' },
];

export function MissionIdentityCard() {
  const { tenant } = useTenant();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch available archetypes
  const { data: archetypes } = useQuery({
    queryKey: ['archetypes-list'],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('archetypes')
        .select('key, name, description')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const currentArchetype = (tenant as any)?.archetype ?? '';
  const currentOrientation = (tenant as any)?.relational_orientation ?? 'institution_focused';

  const [archetype, setArchetype] = useState(currentArchetype);
  const [orientation, setOrientation] = useState(currentOrientation);

  useEffect(() => {
    setArchetype((tenant as any)?.archetype ?? '');
    setOrientation((tenant as any)?.relational_orientation ?? 'institution_focused');
  }, [tenant]);

  const hasChanges = archetype !== currentArchetype || orientation !== currentOrientation;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No organization');
      const { error } = await supabase
        .from('tenants')
        .update({
          archetype: archetype || null,
          relational_orientation: orientation,
        })
        .eq('id', tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Mission identity updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Only admins can change mission identity
  if (!isAdmin) {
    const archetypeLabel = archetypes?.find(a => a.key === currentArchetype)?.name ?? currentArchetype;
    const orientationLabel = ORIENTATION_OPTIONS.find(o => o.value === currentOrientation)?.label ?? currentOrientation;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Compass className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base" style={serif}>Mission Identity</CardTitle>
              <CardDescription>Your organization's archetype and relational focus</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Archetype:</span>{' '}
              <span className="font-medium">{archetypeLabel || 'Not set'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Orientation:</span>{' '}
              <span className="font-medium">{orientationLabel}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Ask an admin to update these if your mission has shifted.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="mission-identity-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Compass className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base" style={serif}>Mission Identity</CardTitle>
            <CardDescription>
              How CROS understands your organization's work and language
            </CardDescription>
          </div>
          <HelpTooltip
            what="Your mission archetype shapes journey stages, keyword sets, and narrative tone throughout CROS."
            where="Settings → Modules"
            why="As your organization evolves, the system should evolve with you."
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Archetype */}
        <div className="space-y-2">
          <Label htmlFor="archetype-select">Mission Archetype</Label>
          <Select value={archetype} onValueChange={setArchetype}>
            <SelectTrigger id="archetype-select">
              <SelectValue placeholder="Choose your archetype" />
            </SelectTrigger>
            <SelectContent>
              {(archetypes ?? []).map((a) => (
                <SelectItem key={a.key} value={a.key}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {archetype && archetypes && (
            <p className="text-xs text-muted-foreground">
              {archetypes.find(a => a.key === archetype)?.description}
            </p>
          )}
        </div>

        {/* Relational Orientation */}
        <div className="space-y-2">
          <Label htmlFor="orientation-select">Relational Orientation</Label>
          <Select value={orientation} onValueChange={setOrientation}>
            <SelectTrigger id="orientation-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIENTATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {ORIENTATION_OPTIONS.find(o => o.value === orientation)?.desc}
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          Changing your archetype adjusts suggested journey stages, discovery keywords, and narrative tone.
          Your existing data is never altered.
        </p>

        {hasChanges && (
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-2 h-3.5 w-3.5" /> Save Identity</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
