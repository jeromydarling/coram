import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
// NOTE: We intentionally use native scrolling here.
// Radix ScrollArea can clip the right edge on some mobile browsers.
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, CheckCircle2, XCircle, Clock, Mail } from 'lucide-react';
import { useAISuggestions, useApproveSuggestion, useDismissSuggestion } from '@/hooks/useAISuggestions';
import { useSyncAndAnalyzeEmails } from '@/hooks/useSyncAndAnalyzeEmails';
import { EmailSuggestionCard } from './EmailSuggestionCard';

interface EmailInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TABS = [
  { value: 'pending', label: 'Pending', statuses: ['pending'], icon: Clock },
  { value: 'approved', label: 'Approved', statuses: ['approved', 'auto_approved'], icon: CheckCircle2 },
  { value: 'dismissed', label: 'Dismissed', statuses: ['dismissed'], icon: XCircle },
];

export function EmailInsightsPanel({ open, onOpenChange }: EmailInsightsPanelProps) {
  const [activeTab, setActiveTab] = useState('pending');
  
  const currentStatuses = TABS.find(t => t.value === activeTab)?.statuses || ['pending'];
  
  const { 
    data: suggestionsData, 
    isLoading, 
    fetchNextPage, 
    hasNextPage,
    isFetchingNextPage 
  } = useAISuggestions({ 
    source: 'email_analysis', 
    status: currentStatuses 
  });
  
  const syncAndAnalyze = useSyncAndAnalyzeEmails();
  const approveSuggestion = useApproveSuggestion();
  const dismissSuggestion = useDismissSuggestion();
  
  const suggestions = suggestionsData?.pages.flat() || [];
  
  const handleSyncAndAnalyze = () => {
    syncAndAnalyze.mutate();
  };
  
  const handleApprove = (id: string) => {
    approveSuggestion.mutate(id);
  };
  
  const handleDismiss = (id: string) => {
    dismissSuggestion.mutate(id);
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Email Insights</SheetTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAndAnalyze}
              disabled={syncAndAnalyze.isPending}
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
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 mx-4 mt-4 shrink-0">
            {TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {TABS.map(tab => (
            <TabsContent key={tab.value} value={tab.value} className="flex-1 m-0 min-h-0 overflow-hidden">
              <div className="h-full w-full overflow-y-auto overscroll-contain">
                <div className="space-y-3 p-4">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </>
                  ) : suggestions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <tab.icon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No {tab.label.toLowerCase()} suggestions</p>
                      {tab.value === 'pending' && (
                        <p className="text-sm mt-1">
                          Click "Sync & Analyze" to fetch and scan emails
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {suggestions.map(suggestion => (
                        <EmailSuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          onApprove={handleApprove}
                          onDismiss={handleDismiss}
                          showActions={tab.value === 'pending'}
                          isApproving={approveSuggestion.isPending && approveSuggestion.variables === suggestion.id}
                          isDismissing={dismissSuggestion.isPending && dismissSuggestion.variables === suggestion.id}
                        />
                      ))}
                      
                      {hasNextPage && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                        >
                          {isFetchingNextPage ? 'Loading...' : 'Load More'}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
