/**
 * MetroExpansionPlanTab — Expansion planning for a metro.
 *
 * WHAT: CRUD for metro_expansion_plans with narrative-focused layout.
 * WHERE: Metro Detail page → Expansion Plan tab.
 * WHY: Track metro-level growth intent before opportunities exist.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTestimoniumCapture } from '@/hooks/useTestimoniumCapture';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarIcon, Save, Sprout } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { toast } from '@/components/ui/sonner';

const STATUSES = [
  { value: 'research', label: 'Research', color: 'bg-muted text-muted-foreground' },
  { value: 'relationships', label: 'Relationships', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'pilot', label: 'Pilot', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'launching', label: 'Launching', color: 'bg-primary/10 text-primary' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'paused', label: 'Paused', color: 'bg-destructive/10 text-destructive' },
] as const;

interface Props {
  metroId: string;
  metroName: string;
}

export function MetroExpansionPlanTab({ metroId, metroName }: Props) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { captureTestimonium } = useTestimoniumCapture();
  const queryClient = useQueryClient();

  const { data: plan, isLoading } = useQuery({
    queryKey: ['metro-expansion-plan', metroId, tenant?.id],
    queryFn: async () => {
      const query = supabase
        .from('metro_expansion_plans')
        .select('*')
        .eq('metro_id', metroId);
      if (tenant?.id) query.eq('tenant_id', tenant.id);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as any | null;
    },
  });

  const [status, setStatus] = useState('research');
  const [priority, setPriority] = useState(0);
  const [targetDate, setTargetDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (plan) {
      setStatus(plan.status || 'research');
      setPriority(plan.priority || 0);
      setTargetDate(plan.target_launch_date ? new Date(plan.target_launch_date) : undefined);
      setNotes(plan.notes || '');
    }
  }, [plan]);

  const upsert = useMutation({
    mutationFn: async () => {
      const row: Record<string, unknown> = {
        metro_id: metroId,
        tenant_id: tenant?.id || null,
        status,
        priority,
        target_launch_date: targetDate ? format(targetDate, 'yyyy-MM-dd') : null,
        notes,
        owner_user_id: user?.id || null,
      };
      if (plan?.id) {
        const { error } = await supabase
          .from('metro_expansion_plans')
          .update(row)
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('metro_expansion_plans')
          .insert(row as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metro-expansion-plan', metroId] });
      toast.success('Expansion plan saved');
      // Testimonium capture on status change
      if (plan && plan.status !== status) {
        captureTestimonium({
          sourceModule: 'journey',
          eventKind: 'expansion_status_changed',
          metroId,
          summary: `${metroName} expansion status changed from ${plan.status} to ${status}`,
          metadata: { previous: plan.status, current: status },
        });
      }
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const statusCfg = STATUSES.find(s => s.value === status);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Sprout className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-serif font-medium text-foreground">Expansion Plan</h3>
        <HelpTooltip content="Track metro-level growth intent before opportunities exist. Plan expansion phases from research through launch." />
      </div>

      <Card className="rounded-xl border-primary/10">
        <CardContent className="pt-6 space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Expansion Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-xs', s.color)}>{s.label}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusCfg && (
              <Badge className={cn('text-xs mt-1', statusCfg.color)}>
                Current: {statusCfg.label}
              </Badge>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Priority (0–10)</Label>
            <div className="flex items-center gap-4 max-w-xs">
              <Slider
                value={[priority]}
                onValueChange={([v]) => setPriority(v)}
                min={0}
                max={10}
                step={1}
              />
              <span className="text-sm font-mono text-muted-foreground w-6 text-right">{priority}</span>
            </div>
          </div>

          {/* Target Launch Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Launch Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-[240px] justify-start text-left font-normal', !targetDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetDate ? format(targetDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Narrative Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Narrative Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe the expansion vision for this metro — relationships being cultivated, community signals, early conversations..."
              className="min-h-[140px] font-serif leading-relaxed"
              maxLength={4000}
            />
            <p className="text-xs text-muted-foreground text-right">{notes.length}/4000</p>
          </div>

          {/* Save */}
          <Button onClick={() => upsert.mutate()} disabled={upsert.isPending} size="sm">
            {upsert.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {plan ? 'Update Plan' : 'Create Plan'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
