/**
 * FirstReflectionPrompt — Guided first reflection for new users.
 *
 * WHAT: Prompts the user to write about one relationship they're nurturing.
 * WHERE: Shown after onboarding completes or via /narrative/start route.
 * WHY: Gently invites the first narrative action — the heart of CROS.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { useNavigate, useParams } from 'react-router-dom';

export function FirstReflectionPrompt() {
  const { tenant, tenantId } = useTenant();
  const { user } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = useState('');
  const [reflection, setReflection] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error('Not authenticated');

      // Create opportunity if org name provided
      let opportunityId: string | null = null;
      if (orgName.trim()) {
        const { data: opp, error: oppErr } = await supabase
          .from('opportunities')
          .insert([{
            opportunity_id: `OPP-${Date.now()}`,
            organization: orgName.trim(),
            tenant_id: tenantId,
            owner_id: user.id,
            stage: 'Found' as any,
            status: 'Active' as any,
          }])
          .select('id')
          .single();
        if (oppErr) throw oppErr;
        opportunityId = opp.id;
      }

      // Create reflection
      if (reflection.trim() && opportunityId) {
        const { error: refErr } = await supabase
          .from('opportunity_reflections')
          .insert([{
            opportunity_id: opportunityId,
            author_id: user.id,
            body: reflection.trim(),
          }]);
        if (refErr) throw refErr;
      }

      // Mark onboarding step complete if available
      try {
        await supabase.functions.invoke('onboarding-step-complete', {
          body: { tenant_id: tenantId, step_key: 'create_first_reflection', action: 'complete' },
        });
      } catch {
        // Non-critical
      }

      return { opportunityId };
    },
    onSuccess: () => {
      toast.success('Your first story has begun.');
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] });
      navigate(`/${tenantSlug}/`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl font-serif">
            Tell me about one relationship you're nurturing.
          </CardTitle>
          <p className="text-sm text-muted-foreground font-serif leading-relaxed">
            Every great story starts with a single connection. Share the name of an
            organization you're building a relationship with, and a brief reflection
            about where things stand.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              placeholder="e.g. Riverside Community Center"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reflection">Your reflection</Label>
            <Textarea
              id="reflection"
              placeholder="We met at a community event last month. They're interested in partnering on digital literacy programs…"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1 rounded-full"
              disabled={!orgName.trim() || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Begin this story
            </Button>
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={() => navigate(`/${tenantSlug}/`)}
            >
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
