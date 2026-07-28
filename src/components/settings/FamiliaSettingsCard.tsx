/**
 * FamiliaSettingsCard — Familia status and management for tenant Settings.
 *
 * WHAT: Shows current Familia status with create/join/leave actions.
 * WHERE: Settings page — appears as a card in the main settings layout.
 * WHY: Lightweight surface for optional organizational kinship — no nav bloat.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, HelpCircle, Loader2 } from 'lucide-react';
import { useFamiliaStatus, useCreateFamilia, useLeaveFamilia, useFamiliaSuggestions } from '@/hooks/useFamilia';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export function FamiliaSettingsCard() {
  const { t } = useTranslation('settings');
  const { isAdmin, isSteward } = useAuth();
  const canManageFamilia = isAdmin || isSteward;

  const { data: status, isLoading } = useFamiliaStatus();
  const { data: suggestions = [] } = useFamiliaSuggestions();
  const createFamilia = useCreateFamilia();
  const leaveFamilia = useLeaveFamilia();
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || !canManageFamilia) return;
    try {
      await createFamilia.mutateAsync(newName.trim());
      toast.success(t('familia.created'));
      setNewName('');
      setShowCreate(false);
    } catch {
      toast.error(t('familia.error'));
    }
  };

  const handleLeave = async () => {
    if (!canManageFamilia) return;
    try {
      await leaveFamilia.mutateAsync();
      toast.success(t('familia.left'));
    } catch {
      toast.error(t('familia.error'));
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{t('familia.title')}</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
              <p><strong>What:</strong> {t('familia.tooltipWhat')}</p>
              <p><strong>Where:</strong> {t('familia.tooltipWhere')}</p>
              <p><strong>Why:</strong> {t('familia.tooltipWhy')}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          {t('familia.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canManageFamilia && (
          <p className="text-xs text-muted-foreground">
            {t('familia.leadershipOnly', { defaultValue: 'Only stewardship roles can create or leave a Familia.' })}
          </p>
        )}

        {status?.isInFamilia ? (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{status.membership?.familias?.name}</Badge>
              <Badge variant="outline" className="text-xs">
                {status.membership?.role === 'founder' ? t('familia.founder') : t('familia.member')}
              </Badge>
            </div>

            {canManageFamilia && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">{t('familia.leaveFamilia')}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('familia.leaveConfirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('familia.leaveConfirmDesc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('familia.stay')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLeave}>{t('familia.leave')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t('familia.independent')}</Badge>
            </div>

            {canManageFamilia && (
              <>
                {!showCreate ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                      {t('familia.startFamilia')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="familia-name" className="text-sm">{t('familia.familiaName')}</Label>
                      <Input
                        id="familia-name"
                        placeholder={t('familia.familiaNamePlaceholder')}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreate} disabled={createFamilia.isPending || !newName.trim()}>
                        {createFamilia.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {t('familia.create')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>{t('familia.cancel')}</Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {suggestions.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">
                  {t('familia.nriNoticed')}
                </p>
                {suggestions.slice(0, 3).map(s => (
                  <p key={s.id} className="text-sm text-foreground/80 mb-1">
                    • {s.candidate_hint}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
