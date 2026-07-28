import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Mail, Sparkles, ChevronRight, AlertCircle } from 'lucide-react';
import { useAIBundles } from '@/hooks/useAIBundles';
import { useAIUserSettings, useEnableGmailAI } from '@/hooks/useAIUserSettings';
import { useEmailInsightsPanel } from '@/contexts/EmailInsightsPanelContext';

export function EmailInsightsCard() {
  const { setIsOpen } = useEmailInsightsPanel();
  const { data: settings, isLoading: settingsLoading } = useAIUserSettings();
  const { data: bundles, isLoading: bundlesLoading } = useAIBundles();
  const enableGmailAI = useEnableGmailAI();
  
  const isGmailConnected = !!settings?.gmail_connected_at;
  const isAIEnabled = settings?.gmail_ai_enabled && settings?.gmail_ai_enabled_at;
  
  // Count pending bundles and total pending suggestions
  const bundleCount = bundles?.length || 0;
  const suggestionCount = bundles?.reduce((sum, b) => sum + b.suggestions.length, 0) || 0;
  
  if (settingsLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card id="email-insights-card" data-tour="email-insights-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="w-4 h-4 text-primary" />
          Email Insights
          <HelpTooltip contentKey="card.email-insights" />
          {isAIEnabled && bundleCount > 0 && (
            <Badge variant="default" className="ml-auto">
              {bundleCount} bundle{bundleCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isGmailConnected ? (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Connect Gmail to enable email insights
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/calendar">Connect Gmail</a>
            </Button>
          </div>
        ) : !isAIEnabled ? (
          <div className="text-center py-4">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary/50" />
            <p className="text-sm text-muted-foreground mb-2">
              Enable analysis to scan your emails
            </p>
            <Button 
              size="sm"
              onClick={() => enableGmailAI.mutate()}
              disabled={enableGmailAI.isPending}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Enable Email Analysis
            </Button>
          </div>
        ) : bundlesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">{bundleCount}</div>
                <p className="text-xs text-muted-foreground">Bundles</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-foreground">{suggestionCount}</div>
                <p className="text-xs text-muted-foreground">Suggestions</p>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setIsOpen(true)}
              data-tour="review-suggestions"
            >
              Review Suggestions
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
