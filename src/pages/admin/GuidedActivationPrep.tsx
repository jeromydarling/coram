/**
 * GuidedActivationPrep — Customer-facing preparation checklist page.
 *
 * WHAT: Calm, category-organized checklist for tenant admins to prepare for their Guided Activation session.
 * WHERE: /:tenantSlug/admin/guided-activation
 * WHY: Ensures customers arrive prepared, reducing session friction.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, HelpCircle, Key, Database, Compass, Target, Loader2, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

const CATEGORY_META: Record<string, { label: string; icon: typeof Key; description: string }> = {
  access: { label: 'Bring Your Keys', icon: Key, description: 'Credentials and permissions you will need.' },
  data: { label: 'Bring Your Story', icon: Database, description: 'The data and context that matters most.' },
  decisions: { label: 'Bring Your Compass', icon: Compass, description: 'A few choices to make before we begin.' },
  goals: { label: 'Bring Your Focus', icon: Target, description: 'What you want to walk away with.' },
};

export default function GuidedActivationPrep() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch checklist
  const { data: checklist, isLoading: checklistLoading } = useQuery({
    queryKey: ['activation-checklist', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activation_checklists')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch items
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['activation-checklist-items', checklist?.id],
    enabled: !!checklist?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activation_checklist_items')
        .select('*')
        .eq('checklist_id', checklist!.id)
        .order('category')
        .order('required', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch activation offer (for consent toggle)
  const { data: offer } = useQuery({
    queryKey: ['activation-offer', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('activation_offers')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .maybeSingle();
      return data;
    },
  });

  // Toggle item completion
  const toggleItem = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      const { error } = await supabase
        .from('activation_checklist_items')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          completed_by: completed ? user?.id : null,
        })
        .eq('id', itemId);
      if (error) throw error;

      // Recompute score
      if (checklist?.id) {
        await supabase.functions.invoke('activation-recompute', {
          body: { checklist_id: checklist.id },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activation-checklist', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['activation-checklist-items', checklist?.id] });
    },
  });

  // Update item notes
  const updateNotes = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      const { error } = await supabase
        .from('activation_checklist_items')
        .update({ notes: notes.slice(0, 2000) })
        .eq('id', itemId);
      if (error) throw error;
    },
  });

  // Toggle consent
  const toggleConsent = useMutation({
    mutationFn: async (granted: boolean) => {
      if (!tenant?.id) return;
      const { error } = await supabase
        .from('activation_offers')
        .upsert({
          tenant_id: tenant.id,
          consent_granted: granted,
          consent_granted_at: granted ? new Date().toISOString() : null,
          consent_granted_by: granted ? user?.id : null,
        }, { onConflict: 'tenant_id' });
      if (error) throw error;
    },
    onSuccess: (_, granted) => {
      toast.success(granted ? 'Operator access enabled' : 'Operator access revoked');
      queryClient.invalidateQueries({ queryKey: ['activation-offer', tenant?.id] });
    },
  });

  const isLoading = checklistLoading || itemsLoading;

  if (isLoading) {
    return (
      <MainLayout title="Prepare for Guided Activation">
        <div className="space-y-4 max-w-3xl">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </MainLayout>
    );
  }

  if (!checklist) {
    return (
      <MainLayout title="Prepare for Guided Activation">
        <div className="max-w-3xl text-center py-16">
          <Sparkles className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            Your checklist is being prepared
          </h2>
          <p className="text-muted-foreground text-sm">
            Once your Guided Activation session is confirmed, your preparation checklist will appear here.
          </p>
        </div>
      </MainLayout>
    );
  }

  // Group items by category
  const grouped = (items ?? []).reduce((acc, item) => {
    const cat = (item as any).category as string;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const statusBadge = {
    not_started: { label: 'Not Started', variant: 'outline' as const },
    in_progress: { label: 'In Progress', variant: 'secondary' as const },
    ready: { label: 'Ready', variant: 'default' as const },
    blocked: { label: 'Needs Help', variant: 'destructive' as const },
  };

  const st = statusBadge[checklist.status as keyof typeof statusBadge] ?? statusBadge.not_started;

  return (
    <MainLayout title="Prepare for Guided Activation" subtitle="A few small things to bring so we can move quickly together.">
      <div className="space-y-6 max-w-3xl">
        {/* Progress header */}
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Readiness</span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
              <span className="text-sm text-muted-foreground">{checklist.readiness_score}%</span>
            </div>
            <Progress value={checklist.readiness_score} className="h-2" />
          </CardContent>
        </Card>

        {/* Consent toggle */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Allow Operator Access</Label>
                <p className="text-xs text-muted-foreground">
                  Let the CROS team view your workspace during your activation session. Fully audited.
                </p>
              </div>
              <Switch
                checked={offer?.consent_granted ?? false}
                onCheckedChange={(checked) => toggleConsent.mutate(checked)}
                disabled={toggleConsent.isPending}
              />
            </div>
          </CardContent>
        </Card>

        {/* Checklist sections */}
        {['access', 'data', 'decisions', 'goals'].map((category) => {
          const catItems = grouped[category] ?? [];
          if (catItems.length === 0) return null;
          const meta = CATEGORY_META[category];
          const Icon = meta.icon;
          const completed = catItems.filter((i: any) => i.completed).length;

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" />
                  <span style={{ fontFamily: 'Georgia, serif' }}>{meta.label}</span>
                  <span className="text-xs text-muted-foreground font-normal ml-auto">
                    {completed}/{catItems.length}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">{meta.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {catItems.map((item: any) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onToggle={(completed) => toggleItem.mutate({ itemId: item.id, completed })}
                    onNotesBlur={(notes) => updateNotes.mutate({ itemId: item.id, notes })}
                    disabled={toggleItem.isPending}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })}

        {/* Mark as ready */}
        {checklist.readiness_score >= 90 && checklist.status !== 'ready' && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              You are ready. Let's begin.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function ChecklistItem({
  item,
  onToggle,
  onNotesBlur,
  disabled,
}: {
  item: any;
  onToggle: (completed: boolean) => void;
  onNotesBlur: (notes: string) => void;
  disabled: boolean;
}) {
  const [notes, setNotes] = useState(item.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!item.notes);

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={item.completed}
          onCheckedChange={(checked) => onToggle(!!checked)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {item.label}
            </span>
            {item.required && (
              <Badge variant="outline" className="text-[9px] px-1 py-0">required</Badge>
            )}
          </div>
          {item.help && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.help}</p>
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Add a note or flag if you're stuck</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {showNotes && (
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onNotesBlur(notes)}
          placeholder="Where I got stuck…"
          rows={2}
          className="text-xs"
        />
      )}
    </div>
  );
}
