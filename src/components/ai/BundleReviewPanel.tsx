import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Mail, Inbox } from 'lucide-react';
import { BundleCard } from './BundleCard';
import { useAIBundles, useApproveBundleMutation, useDismissBundleMutation } from '@/hooks/useAIBundles';
import { useSyncAndAnalyzeEmails } from '@/hooks/useSyncAndAnalyzeEmails';
import type { ApproveBundleRequest } from '@/hooks/useAIBundles';

interface BundleReviewPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BundleReviewPanel({ open, onOpenChange }: BundleReviewPanelProps) {
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [approvingSourceId, setApprovingSourceId] = useState<string | null>(null);
  const [dismissingSourceId, setDismissingSourceId] = useState<string | null>(null);
  
  const { data: bundles, isLoading } = useAIBundles();
  const syncAndAnalyze = useSyncAndAnalyzeEmails();
  const approveMutation = useApproveBundleMutation();
  const dismissMutation = useDismissBundleMutation();
  
  const handleSyncAndAnalyze = () => {
    syncAndAnalyze.mutate();
  };
  
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
  
  const handleEditSuggestion = (suggestionId: string) => {
    setEditingSuggestionId(suggestionId);
    // TODO: Open edit modal for the suggestion
    // For now, just log - can be wired to existing edit modal pattern
    console.log('Edit suggestion:', suggestionId);
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[540px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle>Email Suggestions</SheetTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAndAnalyze}
              disabled={syncAndAnalyze.isPending}
              data-tour="bundle-filter"
            >
              {syncAndAnalyze.isPending ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-1" />
              )}
              Sync & Analyze
            </Button>
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </>
            ) : !bundles || bundles.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No pending suggestions</p>
                <p className="text-sm mt-1">
                  Click "Sync & Analyze" to fetch and scan emails
                </p>
              </div>
            ) : (
              bundles.map(bundle => (
                <BundleCard
                  key={bundle.source_id}
                  bundle={bundle}
                  onApprove={handleApprove}
                  onDismiss={handleDismiss}
                  onEditSuggestion={handleEditSuggestion}
                  isApproving={approvingSourceId === bundle.source_id}
                  isDismissing={dismissingSourceId === bundle.source_id}
                />
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
