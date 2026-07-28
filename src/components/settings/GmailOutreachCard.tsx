 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Alert, AlertDescription } from '@/components/ui/alert';
 import { Loader2, Mail, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
 import { useGmailConnectionStatus } from '@/hooks/useGmailCampaignSend';
 import { supabase } from '@/integrations/supabase/client';
 import { useState } from 'react';
 import { toast } from '@/components/ui/sonner';
 
 export function GmailOutreachCard() {
   const { data: status, isLoading, refetch } = useGmailConnectionStatus();
   const [isConnecting, setIsConnecting] = useState(false);
 
   const handleConnect = async () => {
     setIsConnecting(true);
     try {
       const { data: { session } } = await supabase.auth.getSession();
       if (!session) {
         toast.error('Please sign in first');
         return;
       }
 
       // Get OAuth URL from existing google-calendar-sync function
       const response = await fetch(
         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync?action=auth-url`,
         {
           headers: {
             Authorization: `Bearer ${session.access_token}`,
           },
         }
       );
 
       const result = await response.json();
       if (result.authUrl) {
         window.location.href = result.authUrl;
       } else {
         toast.error(result.error || 'Failed to get auth URL');
       }
     } catch (error) {
       console.error('Connect error:', error);
       toast.error('Failed to start connection');
     } finally {
       setIsConnecting(false);
     }
   };
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <Mail className="h-5 w-5" />
           Gmail for Campaigns
         </CardTitle>
         <CardDescription>
           Send email campaigns from your Gmail account
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-4">
         {isLoading ? (
           <div className="flex items-center gap-2 text-muted-foreground">
             <Loader2 className="h-4 w-4 animate-spin" />
             Checking connection...
           </div>
        ) : status?.isConnected && status?.senderEmail ? (
           <Alert>
             <CheckCircle2 className="h-4 w-4 text-primary" />
             <AlertDescription className="flex items-center gap-2">
               <span>Connected as</span>
               <strong>{status.senderEmail}</strong>
             </AlertDescription>
           </Alert>
        ) : status?.isConnected && !status?.senderEmail ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Gmail needs reconnection. The sending permission scope was updated - please reconnect below.
            </AlertDescription>
          </Alert>
         ) : (
           <Alert variant="destructive">
             <AlertTriangle className="h-4 w-4" />
             <AlertDescription>
               Gmail not connected. Connect your account to send campaigns.
             </AlertDescription>
           </Alert>
         )}
 
         <div className="space-y-2">
           <p className="text-sm text-muted-foreground">
             {status?.isConnected
               ? 'Your campaigns will be sent from this Gmail address. Reconnect to update permissions or use a different account.'
               : 'Connect your Google Workspace Gmail to send campaigns. This grants permission to send emails on your behalf.'}
           </p>
 
           <Button
             onClick={handleConnect}
             disabled={isConnecting}
             variant={status?.isConnected ? 'outline' : 'default'}
           >
             {isConnecting ? (
               <>
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 Connecting...
               </>
             ) : status?.isConnected ? (
               <>
                 <ExternalLink className="mr-2 h-4 w-4" />
                 Reconnect Gmail
               </>
             ) : (
               <>
                 <Mail className="mr-2 h-4 w-4" />
                 Connect Gmail
               </>
             )}
           </Button>
         </div>
 
         {!status?.isConnected && (
           <p className="text-xs text-muted-foreground">
             Note: You'll be asked to grant permission to send emails. 
             Only the "gmail.send" scope is used for campaigns.
           </p>
         )}
       </CardContent>
     </Card>
   );
 }