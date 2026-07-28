import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useHasWebhookKey, useRegenerateWebhookKey, useNameAliases, useUpdateNameAliases } from '@/hooks/useReadAISettings';
import { Copy, RefreshCw, Loader2, X, Plus, Mic, ChevronDown, ExternalLink, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

export function ReadAISettingsCard() {
  const { data: hasKey, isLoading: keyLoading } = useHasWebhookKey();
  const { data: aliases, isLoading: aliasesLoading } = useNameAliases();
  const regenerateKey = useRegenerateWebhookKey();
  const updateAliases = useUpdateNameAliases();
  
  const [newAlias, setNewAlias] = useState('');
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrlTemplate = `${supabaseUrl}/functions/v1/read-ai-webhook?key=[YOUR_KEY]`;

  const handleAddAlias = () => {
    if (!newAlias.trim()) return;
    const trimmed = newAlias.trim();
    if (aliases?.includes(trimmed)) {
      toast.error('Alias already exists');
      return;
    }
    updateAliases.mutate([...(aliases || []), trimmed]);
    setNewAlias('');
  };

  const handleRemoveAlias = (alias: string) => {
    updateAliases.mutate((aliases || []).filter(a => a !== alias));
  };

  if (keyLoading || aliasesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Read.ai Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Read.ai Integration
        </CardTitle>
        <CardDescription>
          Automatically capture meeting notes and action items from Read.ai via Zapier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Webhook Key Status */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Webhook Key Status
          </Label>
          {hasKey ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Configured
              </Badge>
              <span className="text-xs text-muted-foreground">
                Your webhook key is active. For security, the key value is not displayed.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline">Not configured</Badge>
              <span className="text-xs text-muted-foreground">
                Click "Generate Key" below to create your webhook key.
              </span>
            </div>
          )}
        </div>

        {/* Generate/Regenerate Key */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{hasKey ? 'Regenerate Key' : 'Generate Key'}</Label>
            <p className="text-xs text-muted-foreground">
              {hasKey 
                ? 'Create a new key if your current one is compromised' 
                : 'Generate a webhook key to enable the integration'}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={regenerateKey.isPending}>
                {regenerateKey.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {hasKey ? 'Regenerate' : 'Generate Key'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{hasKey ? 'Regenerate Webhook Key?' : 'Generate Webhook Key?'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {hasKey 
                    ? "This will invalidate your current webhook URL. You'll need to update the URL in Zapier."
                    : "This will create a new webhook key. Follow the setup instructions below to configure Zapier."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => regenerateKey.mutate()}>
                  {hasKey ? 'Regenerate' : 'Generate'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Name Aliases */}
        <div className="space-y-3">
          <div>
            <Label>Name Aliases</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Alternative names to match in action items (e.g., Dan, Danny for Daniel)
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {aliases?.map((alias) => (
              <Badge key={alias} variant="secondary" className="gap-1">
                {alias}
                <button
                  onClick={() => handleRemoveAlias(alias)}
                  className="ml-1 hover:text-destructive"
                  disabled={updateAliases.isPending}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {aliases?.length === 0 && (
              <span className="text-sm text-muted-foreground">No aliases set</span>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add a nickname..."
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
              className="h-8"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddAlias}
              disabled={!newAlias.trim() || updateAliases.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Setup Instructions - Collapsible */}
        <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="font-medium">Setup Instructions</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${instructionsOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
              {/* Security Note */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Security Note:</strong> For your protection, webhook keys are write-only and never displayed after generation. 
                  Contact your administrator if you need to set up or update your Zapier integration.
                </p>
              </div>

              {/* AI Prompt Section - Highlighted */}
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <h4 className="font-semibold text-sm">Quick Setup with Zapier Copilot</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy this prompt template and use it with Zapier's Copilot AI assistant. Replace [YOUR_KEY] with your actual key:
                </p>
                <div className="relative">
                  <div className="rounded border bg-background p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap text-foreground">
{`Create a Zap that triggers when a Read.ai meeting completes and sends the meeting data to a webhook.

Trigger: Read.ai → Meeting Completed

Action: Webhooks by Zapier → POST
- URL: ${webhookUrlTemplate}
- Payload Type: JSON
- Data fields to map:
  • meeting_id → Read.ai Meeting ID
  • meeting_title → Read.ai Meeting Title  
  • meeting_start_time → Read.ai Start Time
  • summary → Read.ai Summary
  • action_items → Read.ai Action Items
  • attendees → Read.ai Attendees`}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      const prompt = `Create a Zap that triggers when a Read.ai meeting completes and sends the meeting data to a webhook.

Trigger: Read.ai → Meeting Completed

Action: Webhooks by Zapier → POST
- URL: ${webhookUrlTemplate}
- Payload Type: JSON
- Data fields to map:
  • meeting_id → Read.ai Meeting ID
  • meeting_title → Read.ai Meeting Title  
  • meeting_start_time → Read.ai Start Time
  • summary → Read.ai Summary
  • action_items → Read.ai Action Items
  • attendees → Read.ai Attendees`;
                      navigator.clipboard.writeText(prompt);
                      toast.success('AI prompt copied to clipboard');
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Prompt
                  </Button>
                </div>
                <a 
                  href="https://zapier.com/app/zaps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open Zapier and use Copilot <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 border-t" />
                <span>or follow manual steps</span>
                <div className="flex-1 border-t" />
              </div>

              {/* Step 1 */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">1</span>
                  Generate Your Webhook Key
                </h4>
                <p className="text-xs text-muted-foreground pl-7">
                  Click "Generate Key" above. Your administrator will provide you with the complete webhook URL.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">2</span>
                  Create a New Zap in Zapier
                </h4>
                <div className="text-xs text-muted-foreground pl-7 space-y-1">
                  <p>Go to Zapier and create a new Zap:</p>
                  <a 
                    href="https://zapier.com/app/zaps" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open Zapier <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">3</span>
                  Set Up the Trigger
                </h4>
                <ul className="text-xs text-muted-foreground pl-7 space-y-1 list-disc list-inside">
                  <li>Search for and select <strong>Read.ai</strong> as your trigger app</li>
                  <li>Choose <strong>"Meeting Completed"</strong> as the trigger event</li>
                  <li>Connect your Read.ai account and test the trigger</li>
                </ul>
              </div>

              {/* Step 4 */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">4</span>
                  Set Up the Action
                </h4>
                <ul className="text-xs text-muted-foreground pl-7 space-y-1 list-disc list-inside">
                  <li>Search for and select <strong>Webhooks by Zapier</strong></li>
                  <li>Choose <strong>"POST"</strong> as the action event</li>
                  <li>Paste your webhook URL into the <strong>URL</strong> field</li>
                  <li>Set <strong>Payload Type</strong> to <strong>JSON</strong></li>
                </ul>
              </div>

              {/* Step 5 */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">5</span>
                  Map the Data Fields
                </h4>
                <p className="text-xs text-muted-foreground pl-7 mb-2">
                  In the <strong>Data</strong> section, create these fields and map them to Read.ai values:
                </p>
                <div className="ml-7 rounded border bg-background p-3 font-mono text-xs overflow-x-auto">
                  <div className="space-y-1">
                    <div><span className="text-muted-foreground">meeting_id:</span> <span className="text-primary">[Read.ai Meeting ID]</span></div>
                    <div><span className="text-muted-foreground">meeting_title:</span> <span className="text-primary">[Read.ai Meeting Title]</span></div>
                    <div><span className="text-muted-foreground">meeting_start_time:</span> <span className="text-primary">[Read.ai Start Time]</span></div>
                    <div><span className="text-muted-foreground">meet_url:</span> <span className="text-primary">[Read.ai Google Meet URL]</span></div>
                    <div><span className="text-muted-foreground">recording_url:</span> <span className="text-primary">[Read.ai Recording URL]</span></div>
                    <div><span className="text-muted-foreground">summary:</span> <span className="text-primary">[Read.ai Summary]</span></div>
                    <div><span className="text-muted-foreground">action_items:</span> <span className="text-primary">[Read.ai Action Items]</span></div>
                    <div><span className="text-muted-foreground">attendees:</span> <span className="text-primary">[Read.ai Attendees]</span></div>
                  </div>
                </div>
              </div>

              {/* Step 6 */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">6</span>
                  Test and Publish
                </h4>
                <ul className="text-xs text-muted-foreground pl-7 space-y-1 list-disc list-inside">
                  <li>Click <strong>Test action</strong> to send a test meeting to the CRM</li>
                  <li>Verify the meeting appears in the Person profile's Meeting History</li>
                  <li>Turn on your Zap by clicking <strong>Publish</strong></li>
                </ul>
              </div>

              {/* What Happens */}
              <div className="mt-4 pt-4 border-t space-y-2">
                <h4 className="font-semibold text-sm">What Happens When a Meeting Ends</h4>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Read.ai sends meeting data to Zapier</li>
                  <li>Zapier forwards it to your CRM webhook</li>
                  <li>The meeting is matched to your Google Calendar event</li>
                  <li>The meeting is <strong>automatically marked as attended</strong></li>
                  <li>Meeting summary and notes are saved to linked contacts</li>
                  <li>Action items assigned to you become tasks (based on your Full Name and aliases above)</li>
                </ul>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
