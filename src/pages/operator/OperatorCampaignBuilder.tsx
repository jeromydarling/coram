/**
 * OperatorCampaignBuilder — Campaign creation/editing for the operator console.
 *
 * WHAT: Full campaign builder (content, audience, review, send) scoped to operator.
 * WHERE: /operator/outreach/campaigns/:id
 * WHY: Operators need their own campaign workspace without tenant gating.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Send, ArrowLeft, Users, CheckCircle2, AlertTriangle, Mail, Eye, Pause, Play, RotateCcw, BarChart3, MessageSquare, ShieldCheck } from 'lucide-react';
import { AudienceBuilder } from '@/components/outreach/AudienceBuilder';
import { AudienceListPanel } from '@/components/outreach/AudienceListPanel';
import { CampaignStatusBadge } from '@/components/outreach/CampaignStatusBadge';
import { MergeTagsHelper } from '@/components/outreach/MergeTagsHelper';
import { CampaignMonitorPanel } from '@/components/outreach/CampaignMonitorPanel';
import { CampaignAnalyticsPanel } from '@/components/outreach/CampaignAnalyticsPanel';
import { CampaignRepliesPanel } from '@/components/outreach/CampaignRepliesPanel';
import { EmailPreviewDialog } from '@/components/outreach/EmailPreviewDialog';
import { SendGuardrailsPanel, QuotaInfoCard, useSendBlockers } from '@/components/outreach/SendGuardrails';
import { SendIntentPanel } from '@/components/outreach/SendIntentPanel';
import { useCampaignAudience } from '@/hooks/useCampaignAudience';
import {
  useEmailCampaign,
  useCreateEmailCampaign,
  useUpdateEmailCampaign,
} from '@/hooks/useEmailCampaigns';
import {
  useSendTestEmail,
  useSendCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useRetryFailedRecipients,
  useGmailConnectionStatus,
} from '@/hooks/useGmailCampaignSend';
import { toast } from '@/components/ui/sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function OperatorCampaignBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data: existingCampaign, isLoading: isLoadingCampaign } = useEmailCampaign(
    isNew ? undefined : id
  );

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [fromName, setFromName] = useState('');
  const [audienceCount, setAudienceCount] = useState(0);
  const [testEmail, setTestEmail] = useState('');
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [intentReady, setIntentReady] = useState(false);
  const [sendProvider, setSendProvider] = useState<'gmail' | 'outlook'>('gmail');

  const createCampaign = useCreateEmailCampaign();
  const updateCampaign = useUpdateEmailCampaign();
  const sendTestEmail = useSendTestEmail();
  const sendCampaign = useSendCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const retryFailed = useRetryFailedRecipients();
  const { data: gmailStatus } = useGmailConnectionStatus();
  const { data: audience = [] } = useCampaignAudience(isNew ? undefined : id);

  useEffect(() => {
    if (existingCampaign) {
      setName(existingCampaign.name);
      setSubject(existingCampaign.subject);
      setPreheader(existingCampaign.preheader || '');
      setHtmlBody(existingCampaign.html_body || '');
      setFromName(existingCampaign.from_name || '');
      setAudienceCount(existingCampaign.audience_count ?? 0);
    }
  }, [existingCampaign]);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) {
      toast.error('Name and subject are required');
      return;
    }

    if (isNew) {
      const created = await createCampaign.mutateAsync({
        name: name.trim(),
        subject: subject.trim(),
        preheader: preheader || undefined,
        html_body: htmlBody || undefined,
        from_name: fromName || undefined,
      });
      navigate(`/operator/outreach/campaigns/${created.id}`, { replace: true });
    } else if (id) {
      await updateCampaign.mutateAsync({
        id,
        name: name.trim(),
        subject: subject.trim(),
        preheader: preheader || null,
        html_body: htmlBody || null,
        from_name: fromName || null,
      });
    }
  };

  const handleSendCampaign = async () => {
    if (!id || isNew) return;
    setShowSendConfirm(false);

    await updateCampaign.mutateAsync({
      id,
      name: name.trim(),
      subject: subject.trim(),
      preheader: preheader || null,
      html_body: htmlBody || null,
      from_name: fromName || null,
    });

    await sendCampaign.mutateAsync(id);
  };

  const handleResumeCampaign = async () => {
    if (!id) return;
    setShowResumeConfirm(false);
    resumeCampaign.mutate(id);
    sendCampaign.mutate(id);
  };

  const handleSendTest = async () => {
    if (!id || !testEmail.trim()) return;
    await sendTestEmail.mutateAsync({ campaignId: id, toEmail: testEmail.trim() });
  };

  const isSaving = createCampaign.isPending || updateCampaign.isPending;
  const isSending = sendCampaign.isPending;
  const status = existingCampaign?.status || 'draft';
  const isEditable = ['draft', 'audience_ready'].includes(status);

  const campaignForGuardrails = existingCampaign || {
    id: '',
    created_by: '',
    name,
    subject,
    preheader: null,
    html_body: htmlBody,
    from_name: fromName,
    from_email: null,
    reply_to: null,
    segment_id: null,
    status: 'draft' as const,
    scheduled_at: null,
    audience_count: audienceCount,
    sent_count: 0,
    failed_count: 0,
    last_sent_at: null,
    metadata: null,
    created_at: '',
    updated_at: '',
  };

  const { canSend } = useSendBlockers({
    campaign: campaignForGuardrails,
    audience,
    gmailConnected: !!(gmailStatus?.isConnected && gmailStatus?.senderEmail),
    htmlBody,
    subject,
  });

  if (!isNew && isLoadingCampaign) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/operator/outreach')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Outreach
        </Button>
        <div className="flex items-center gap-2">
          {!isNew && existingCampaign && (
            <>
              <CampaignStatusBadge status={existingCampaign.status} />
              {existingCampaign.sent_count > 0 && (
                <span className="text-sm text-muted-foreground">
                  {existingCampaign.sent_count} sent
                  {existingCampaign.failed_count > 0 && `, ${existingCampaign.failed_count} failed`}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isNew ? 'New Campaign' : name || 'Edit Campaign'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isNew ? 'Create a new email campaign' : 'Edit campaign details'}
        </p>
      </div>

      <Tabs defaultValue={['sending', 'sent', 'failed', 'paused'].includes(status) ? 'monitor' : 'content'}>
        <TabsList>
          <TabsTrigger value="content">
            <Mail className="h-4 w-4 mr-1" />
            Content
          </TabsTrigger>
          <TabsTrigger value="audience" disabled={isNew}>
            <Users className="h-4 w-4 mr-1" />
            Audience
          </TabsTrigger>
          <TabsTrigger value="review" disabled={isNew || audienceCount === 0}>
            <Send className="h-4 w-4 mr-1" />
            Review & Send
          </TabsTrigger>
          {!isNew && ['sending', 'sent', 'failed', 'paused'].includes(status) && (
            <TabsTrigger value="monitor">
              <Eye className="h-4 w-4 mr-1" />
              Monitor
            </TabsTrigger>
          )}
          {!isNew && ['sent', 'failed'].includes(status) && (
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-1" />
              Analytics
            </TabsTrigger>
          )}
          {!isNew && ['sent', 'failed'].includes(status) && (
            <TabsTrigger value="replies">
              <MessageSquare className="h-4 w-4 mr-1" />
              Replies
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── CONTENT TAB ─── */}
        <TabsContent value="content" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
                <CardDescription>Basic information about your campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name *</Label>
                  <Input
                    id="name" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Q1 Partner Outreach" disabled={!isEditable}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Email Subject *</Label>
                  <Input
                    id="subject" value={subject} onChange={(e) => setSubject(e.target.value)}
                    placeholder="Update from your organization" disabled={!isEditable}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preheader">Preheader</Label>
                  <Input
                    id="preheader" value={preheader} onChange={(e) => setPreheader(e.target.value)}
                    placeholder="Preview text shown in inbox" disabled={!isEditable}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName" value={fromName} onChange={(e) => setFromName(e.target.value)}
                    placeholder="Your Name" disabled={!isEditable}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Send via</Label>
                  <Select value={sendProvider} onValueChange={(v) => setSendProvider(v as 'gmail' | 'outlook')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmail">Gmail</SelectItem>
                      <SelectItem value="outlook">Microsoft Outlook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>From Email</Label>
                  {sendProvider === 'gmail' ? (
                    gmailStatus?.isConnected && gmailStatus?.senderEmail ? (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-sm">{gmailStatus.senderEmail}</span>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Gmail not connected. Connect Gmail in settings to send campaigns.
                        </AlertDescription>
                      </Alert>
                    )
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Uses connected Outlook account</span>
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-border bg-muted/50 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Email Compliance
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All campaigns include an unsubscribe link and respect the Do Not Email suppression list.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Body</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RichTextEditor
                    content={htmlBody}
                    onChange={setHtmlBody}
                    placeholder="Write your email content here..."
                    editorClassName="min-h-[250px]"
                  />
                  {isEditable && <MergeTagsHelper />}
                </CardContent>
              </Card>

              {isEditable && (
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />Save Draft</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── AUDIENCE TAB ─── */}
        <TabsContent value="audience" className="space-y-6">
          {isNew ? (
            <Alert>
              <AlertDescription>Save the campaign first to build your audience.</AlertDescription>
            </Alert>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              {isEditable && (
                <AudienceBuilder campaignId={id!} onAudienceBuilt={setAudienceCount} />
              )}
              <AudienceListPanel
                campaignId={id!}
                onCountChange={setAudienceCount}
                isEditable={isEditable}
              />
            </div>
          )}
        </TabsContent>

        {/* ── REVIEW & SEND TAB ─── */}
        <TabsContent value="review" className="space-y-6">
          {existingCampaign && (
            <SendGuardrailsPanel
              campaign={existingCampaign}
              audience={audience}
              gmailConnected={!!(gmailStatus?.isConnected && gmailStatus?.senderEmail)}
              htmlBody={htmlBody}
              subject={subject}
            />
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Recipients</p>
                    <p className="text-2xl font-bold">{audienceCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <CampaignStatusBadge status={status} />
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground">Subject</p>
                  <p className="font-medium">{subject || '(none)'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="font-medium">
                    {fromName || 'Not set'} &lt;{gmailStatus?.senderEmail || '...'}&gt;
                  </p>
                </div>

                {!isNew && id && (
                  <Button variant="outline" className="w-full" onClick={() => setShowPreview(true)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Email
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* Quota Info */}
              <QuotaInfoCard />

              {/* Test Email */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Send Test Email</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="test@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={handleSendTest}
                      disabled={sendTestEmail.isPending || !testEmail.trim() || !id}
                    >
                      {sendTestEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Test'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Send Intent Panel */}
              {!isNew && id && ['draft', 'audience_ready', 'paused'].includes(status) && (
                <SendIntentPanel
                  campaignId={id}
                  audienceCount={audienceCount}
                  canSend={canSend}
                  onIntentReady={() => setIntentReady(true)}
                />
              )}

              {/* Campaign Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="h-4 w-4" />
                    Campaign Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {canSend && intentReady && status !== 'paused' && (
                    <Button
                      onClick={() => setShowSendConfirm(true)}
                      disabled={isSending}
                      className="w-full"
                    >
                      {isSending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                      ) : (
                        <><Send className="mr-2 h-4 w-4" />Send to {audienceCount.toLocaleString()} recipients</>
                      )}
                    </Button>
                  )}

                  {canSend && !intentReady && status !== 'paused' && ['draft', 'audience_ready'].includes(status) && (
                    <p className="text-sm text-muted-foreground text-center">
                      Create and authorize a send intent above to enable sending.
                    </p>
                  )}

                  {!canSend && status !== 'paused' && ['draft', 'audience_ready'].includes(status) && (
                    <p className="text-sm text-muted-foreground text-center">
                      Fix the issues above to enable sending.
                    </p>
                  )}

                  {status === 'paused' && (
                    <Button
                      onClick={() => {
                        if (existingCampaign && existingCampaign.failed_count > 0) {
                          setShowResumeConfirm(true);
                        } else {
                          handleResumeCampaign();
                        }
                      }}
                      disabled={resumeCampaign.isPending}
                      className="w-full"
                    >
                      <Play className="mr-2 h-4 w-4" />Resume Sending
                    </Button>
                  )}

                  {status === 'sending' && (
                    <Button variant="outline" onClick={() => pauseCampaign.mutate(id!)} disabled={pauseCampaign.isPending} className="w-full">
                      <Pause className="mr-2 h-4 w-4" />Pause Campaign
                    </Button>
                  )}

                  {(status === 'failed' || status === 'sent') && existingCampaign && existingCampaign.failed_count > 0 && (
                    <Button variant="outline" onClick={() => retryFailed.mutate(id!)} disabled={retryFailed.isPending} className="w-full">
                      <RotateCcw className="mr-2 h-4 w-4" />Retry {existingCampaign.failed_count} Failed
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── MONITOR TAB ─── */}
        {!isNew && ['sending', 'sent', 'failed', 'paused'].includes(status) && (
          <TabsContent value="monitor">
            <CampaignMonitorPanel campaignId={id!} campaign={existingCampaign!} />
          </TabsContent>
        )}

        {/* ── ANALYTICS TAB ─── */}
        {!isNew && ['sent', 'failed'].includes(status) && (
          <TabsContent value="analytics">
            <CampaignAnalyticsPanel campaignId={id!} campaign={existingCampaign!} />
          </TabsContent>
        )}

        {/* ── REPLIES TAB ─── */}
        {!isNew && ['sent', 'failed'].includes(status) && (
          <TabsContent value="replies">
            <CampaignRepliesPanel campaignId={id!} />
          </TabsContent>
        )}
      </Tabs>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to send "{subject}" to {audienceCount.toLocaleString()} recipients. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendCampaign}>Send Now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resume Confirmation */}
      <AlertDialog open={showResumeConfirm} onOpenChange={setShowResumeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              {existingCampaign?.failed_count || 0} recipients failed in a prior attempt.
              Resuming will continue sending to queued recipients only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResumeCampaign}>Resume</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Preview Dialog */}
      {showPreview && id && (
        <EmailPreviewDialog
          campaignId={id}
          open={showPreview}
          onOpenChange={setShowPreview}
        />
      )}
    </div>
  );
}
