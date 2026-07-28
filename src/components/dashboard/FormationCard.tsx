/**
 * FormationCard — Gentle, role-aware formation prompts card.
 *
 * WHAT: Shows active formation prompts for the current user.
 * WHERE: Command Center sidebar.
 * WHY: Helps users stay present without overwhelm.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useTranslation } from 'react-i18next';

export function FormationCard() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t } = useTranslation('dashboard');

  const { data: prompts, isLoading } = useQuery({
    queryKey: ['formation-prompts', tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('formation_prompts' as any)
        .select('id, content, prompt_type, role, source')
        .eq('tenant_id', tenantId!)
        .or(`user_id.eq.${user!.id},user_id.is.null`)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(2);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; content: string; prompt_type: string; role: string; source: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!prompts?.length) return null;

  return (
    <Card className="border-primary/10 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-serif">
          <Heart className="w-4 h-4 text-primary/60" />
          {t('formation.title')}
          <HelpTooltip content={t('formation.tooltipContent')} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {prompts.map((p) => (
          <div key={p.id} className="text-sm text-foreground/80 leading-relaxed italic">
            "{p.content}"
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
