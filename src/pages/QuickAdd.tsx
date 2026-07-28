import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Mail, Inbox, Sparkles, CheckCheck } from 'lucide-react';
import { BundleCard } from '@/components/ai/BundleCard';
import { EditSuggestionModal } from '@/components/ai/EditSuggestionModal';
import { useAIBundles, useApproveBundleMutation, useDismissBundleMutation } from '@/hooks/useAIBundles';
import { useApproveAllBundlesMutation } from '@/hooks/useApproveAllBundles';
import { useSyncAndAnalyzeEmails } from '@/hooks/useSyncAndAnalyzeEmails';
import type { ApproveBundleRequest } from '@/hooks/useAIBundles';
import type { Database } from '@/integrations/supabase/types';

type AISuggestion = Database['public']['Tables']['ai_suggestions']['Row'];

export default function QuickAdd() {
  const { t } = useTranslation('common');
  const [approvingSourceId, setApprovingSourceId] = useState<string | null>(null);
  const [dismissingSourceId, setDismissingSourceId] = useState<string | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<AISuggestion | null>(null);

  const { data: bundles, isLoading } = useAIBundles();

  const handleEditSuggestion = (suggestionId: string) => {
    const suggestion = bundles
      ?.flatMap((b) => b.suggestions)
      .find((s) => s.id === suggestionId);
    if (suggestion) setEditingSuggestion(suggestion);
  };

  const syncAndAnalyze = useSyncAndAnalyzeEmails();
  const approveMutation = useApproveBundleMutation();
  const dismissMutation = useDismissBundleMutation();
  const approveAllMutation = useApproveAllBundlesMutation();

  const handleApprove = (request: ApproveBundleRequest) => {
    setApprovingSourceId(request.source_id);
    approveMutation.mutate(request, {
      onSettled: () => setApprovingSourceId(null),
    });
  };

  const handleDismiss = (source_id: string) => {
    setDismissingSourceId(source_id);
    dismissMutation.mutate(source_id, {
      onSettled: () => setDismissingSourceId(null),
    });
  };

  const handleApproveAll = () => {
    if (!bundles || bundles.length === 0) return;
    approveAllMutation.mutate(bundles);
  };

  const pendingCount = bundles?.reduce((sum, b) => sum + b.suggestions.length, 0) || 0;

  return (
    <MainLayout
      title={t('quickAdd.title')}
      mobileTitle={t('quickAdd.mobileTitle')}
      subtitle={t('quickAdd.subtitle')}
    >
      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              {t(pendingCount === 1 ? 'quickAdd.pendingCount_one' : 'quickAdd.pendingCount_other', { count: pendingCount })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleApproveAll}
                disabled={approveAllMutation.isPending || pendingCount === 0}
              >
                {approveAllMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4 mr-1" />
                )}
                {t('quickAdd.approveAll')}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncAndAnalyze.mutate()}
              disabled={syncAndAnalyze.isPending}
            >
              {syncAndAnalyze.isPending ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-1" />
              )}
              {t('quickAdd.syncAndAnalyze')}
            </Button>
          </div>
        </div>

        {/* Bundles list */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !bundles || bundles.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t('quickAdd.noPendingSuggestions')}</p>
              <p className="text-sm mt-1">
                {t('quickAdd.noPendingDesc')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bundles.map(bundle => (
              <BundleCard
                key={bundle.source_id}
                bundle={bundle}
                onApprove={handleApprove}
                onDismiss={handleDismiss}
                onEditSuggestion={handleEditSuggestion}
                isApproving={approvingSourceId === bundle.source_id}
                isDismissing={dismissingSourceId === bundle.source_id}
              />
            ))}
          </div>
        )}
      </div>

      <EditSuggestionModal
        suggestion={editingSuggestion}
        open={!!editingSuggestion}
        onOpenChange={(open) => { if (!open) setEditingSuggestion(null); }}
      />
    </MainLayout>
  );
}
