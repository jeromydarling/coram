/**
 * GardenerFederationCampaignsPage — SCIENTIA surface for the CROS Federation email tracker.
 *
 * WHAT: Lists Gardener-tracked federation campaigns (starting with Propria), lets the
 *       Gardener import a CSV audience (dry-run preview + commit), trigger the tracked
 *       Gmail send, and inspect per-recipient status (opens, clicks, replies, signups,
 *       customer conversions). Also shows unmatched signup orphans for reconciliation.
 * WHERE: /operator/scientia/federation-campaigns (Gardener/operator only).
 * WHY: Gardener needs a calm, single place to run outreach across the CROS Federation
 *      without touching tenant tables. All data is admin-only via RLS.
 */
import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Mail, Send, Upload, MousePointerClick, Eye, MessageCircle, UserCheck, DollarSign,
  HelpCircle, AlertCircle, CheckCircle2, Users, ArrowLeft, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  useTrackedCampaigns, useTrackedSends, useSignupOrphans, useUntrackedCampaigns,
  useFederationApps, useImportCsv, useSendTrackedCampaign, fileToBase64,
  type TrackedCampaignRow,
} from '@/hooks/useGardenerFederationCampaigns';
import { GardenerMergeTagsHelper } from '@/components/operator/GardenerMergeTagsHelper';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
        </TooltipTrigger>
        <TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function GardenerFederationCampaignsPage() {
  const [appSlug, setAppSlug] = useState<string>('propria');
  const [selectedTc, setSelectedTc] = useState<TrackedCampaignRow | null>(null);
  const { data: apps = [] } = useFederationApps();
  const { data: campaigns = [], isLoading } = useTrackedCampaigns(appSlug);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground font-serif">
            Federation Campaigns
          </h1>
          <HelpTip text="A gentle way to see who is receiving, opening, and responding to your CROS Federation outreach — and who becomes a customer of a federated app. Admin-only. Data stays in the operator console." />
        </div>
        <p className="text-sm text-muted-foreground">
          Send tracked outreach to prospective customers of federated apps. Every open, click, reply, and signup is remembered against the person you contacted.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-xs text-muted-foreground">Federation app</Label>
        <Select value={appSlug} onValueChange={setAppSlug}>
          <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {apps.map((a: any) => (
              <SelectItem key={a.slug} value={a.slug}>{a.name}</SelectItem>
            ))}
            {apps.length === 0 && <SelectItem value="propria">Propria</SelectItem>}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <ImportCsvDialog appSlug={appSlug} />
      </div>

      {selectedTc ? (
        <CampaignDetail tc={selectedTc} onBack={() => setSelectedTc(null)} />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Tracked campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
              ) : campaigns.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  No tracked campaigns yet for this federation app.<br />
                  <span className="text-xs">Create an email campaign, then import a CSV to begin tracking.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((c) => (
                    <CampaignRow key={c.id} tc={c} onOpen={() => setSelectedTc(c)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <OrphansPanel appSlug={appSlug} />
        </>
      )}
    </div>
  );
}

function CampaignRow({ tc, onOpen }: { tc: TrackedCampaignRow; onOpen: () => void }) {
  const s = tc.stats ?? { total: 0, sent: 0, opened: 0, clicked: 0, replied: 0, signed_up: 0, customers: 0 };
  const subject = tc.campaign?.subject || '(no subject)';
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-lg border border-border/60 bg-card hover:bg-muted/40 transition p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{subject}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {tc.campaign?.from_name ? `${tc.campaign.from_name} · ` : ''}
            Imported {tc.csv_import_filename ? `“${tc.csv_import_filename}”` : 'audience'} ·{' '}
            {formatDistanceToNow(new Date(tc.created_at), { addSuffix: true })}
          </div>
        </div>
        <Badge variant={tc.tracking_enabled ? 'default' : 'outline'} className="shrink-0">
          {tc.tracking_enabled ? 'Tracking on' : 'Paused'}
        </Badge>
      </div>
      <div className="grid grid-cols-7 gap-2 mt-4 text-center">
        <Stat label="Audience" value={s.total} />
        <Stat label="Sent" value={s.sent} tone="ok" />
        <Stat label="Opened" value={s.opened} icon={<Eye className="h-3 w-3" />} />
        <Stat label="Clicked" value={s.clicked} icon={<MousePointerClick className="h-3 w-3" />} />
        <Stat label="Replied" value={s.replied} icon={<MessageCircle className="h-3 w-3" />} />
        <Stat label="Signed up" value={s.signed_up} icon={<UserCheck className="h-3 w-3" />} tone="accent" />
        <Stat label="Customer" value={s.customers} icon={<DollarSign className="h-3 w-3" />} tone="accent" />
      </div>
    </button>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon?: React.ReactNode; tone?: 'ok' | 'accent' }) {
  const cls =
    tone === 'ok' ? 'text-green-600' :
    tone === 'accent' ? 'text-primary' : 'text-foreground';
  return (
    <div>
      <div className={`text-lg font-semibold ${cls} flex items-center justify-center gap-1`}>
        {icon}{value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

/* ─────────────────────────── Import dialog ─────────────────────────── */

function ImportCsvDialog({ appSlug }: { appSlug: string }) {
  const [open, setOpen] = useState(false);
  const [campaignId, setCampaignId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [disclosePixel, setDisclosePixel] = useState(true);
  const [preview, setPreview] = useState<any | null>(null);
  const { data: untracked = [] } = useUntrackedCampaigns();
  const importMut = useImportCsv();

  const filtered = useMemo(() => untracked.filter((c: any) =>
    !c.federation_app_slug || c.federation_app_slug === appSlug
  ), [untracked, appSlug]);

  async function runDryRun() {
    if (!file || !campaignId) { toast.error('Pick a campaign and a CSV file.'); return; }
    try {
      const csv_base64 = await fileToBase64(file);
      const result = await importMut.mutateAsync({
        campaign_id: campaignId, federation_app_slug: appSlug,
        csv_base64, filename: file.name, dry_run: true, disclose_pixel: disclosePixel,
      });
      setPreview(result.preview);
    } catch (e: any) {
      toast.error(e.message || 'Preview failed');
    }
  }

  async function commit() {
    if (!file || !campaignId) return;
    try {
      const csv_base64 = await fileToBase64(file);
      const result = await importMut.mutateAsync({
        campaign_id: campaignId, federation_app_slug: appSlug,
        csv_base64, filename: file.name, dry_run: false, disclose_pixel: disclosePixel,
      });
      toast.success(`Imported ${result.inserted ?? 0} recipients.`);
      setOpen(false); setPreview(null); setFile(null); setCampaignId('');
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview(null); setFile(null); } }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Upload className="h-4 w-4" /> Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import audience for a Federation campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Email campaign</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger><SelectValue placeholder="Choose an existing campaign…" /></SelectTrigger>
              <SelectContent>
                {filtered.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.subject || '(no subject)'} — {c.status ?? 'draft'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Create the campaign in Outreach first (subject + HTML body). This import queues its recipients.
            </p>
          </div>
          <div>
            <Label className="text-xs">CSV file <HelpTip text="Required column: email. Optional: name, first_name, last_name, organization, role, city, state, notes." /></Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <GardenerMergeTagsHelper />
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm">Disclose tracking pixel</div>
              <div className="text-xs text-muted-foreground">Adds a small line at the bottom of the email.</div>
            </div>
            <Switch checked={disclosePixel} onCheckedChange={setDisclosePixel} />
          </div>

          {preview && (
            <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
              <div className="font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Preview</div>
              <div className="grid grid-cols-2 gap-x-4 text-xs">
                <div>Total rows: <span className="font-medium">{preview.rows_total}</span></div>
                <div>Valid: <span className="font-medium text-green-700">{preview.rows_valid}</span></div>
                <div>Invalid: <span className="font-medium text-destructive">{preview.rows_invalid}</span></div>
                <div>Duplicate in CSV: <span className="font-medium">{preview.rows_duped_in_csv}</span></div>
                <div>Already imported: <span className="font-medium">{preview.rows_duped_against_existing}</span></div>
              </div>
              {preview.sample?.length > 0 && (
                <div className="text-xs text-muted-foreground pt-1">
                  e.g. {preview.sample.slice(0, 3).map((r: any) => r.email).join(', ')}…
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          {!preview ? (
            <Button onClick={runDryRun} disabled={importMut.isPending || !file || !campaignId}>
              {importMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Preview
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setPreview(null)}>Back</Button>
              <Button onClick={commit} disabled={importMut.isPending || preview.rows_valid === 0}>
                {importMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Import {preview.rows_valid} recipients
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Detail view ─────────────────────────── */

function CampaignDetail({ tc, onBack }: { tc: TrackedCampaignRow; onBack: () => void }) {
  const { data: sends = [], isLoading } = useTrackedSends(tc.id);
  const sendMut = useSendTrackedCampaign();
  const queued = sends.filter((s: any) => !s.sent_at).length;

  async function handleSend() {
    try {
      const res = await sendMut.mutateAsync(tc.campaign_id);
      if (res.failed && res.failed > 0) {
        toast.warning(`Sent ${res.sent}, ${res.failed} failed`);
      } else {
        toast.success(`Sent ${res.sent} messages`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Send failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> All campaigns
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sendMut.isPending || queued === 0}
          className="gap-1.5"
        >
          {sendMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send {queued > 0 ? `${queued} queued` : ''}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tc.campaign?.subject || '(no subject)'}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {tc.federation_app_slug} · imported {formatDistanceToNow(new Date(tc.created_at), { addSuffix: true })}
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="recipients">
            <TabsList>
              <TabsTrigger value="recipients">Recipients ({sends.length})</TabsTrigger>
              <TabsTrigger value="signups">Signups ({sends.filter((s: any) => s.first_signup_at).length})</TabsTrigger>
            </TabsList>
            <TabsContent value="recipients">
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-4">Loading…</div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead className="text-center">Opens</TableHead>
                        <TableHead className="text-center">Clicks</TableHead>
                        <TableHead>Reply</TableHead>
                        <TableHead>Signed up</TableHead>
                        <TableHead>Customer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sends.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="text-sm">{s.recipient_name || s.recipient_email}</div>
                            {s.recipient_name && <div className="text-xs text-muted-foreground">{s.recipient_email}</div>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {s.sent_at ? formatDistanceToNow(new Date(s.sent_at), { addSuffix: true }) : <Badge variant="outline">queued</Badge>}
                          </TableCell>
                          <TableCell className="text-center text-sm">{s.open_count || 0}</TableCell>
                          <TableCell className="text-center text-sm">{s.click_count || 0}</TableCell>
                          <TableCell>
                            {s.replied_at ? <Badge variant="secondary" className="gap-1"><MessageCircle className="h-3 w-3" />Yes</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            {s.first_signup_at ? <Badge className="gap-1"><UserCheck className="h-3 w-3" />Signed up</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            {s.first_customer_at ? (
                              <Badge className="gap-1 bg-primary/90">
                                <DollarSign className="h-3 w-3" />
                                {s.customer_amount_cents ? `$${(s.customer_amount_cents / 100).toFixed(0)}` : 'Yes'}
                              </Badge>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>
            <TabsContent value="signups">
              <div className="text-sm text-muted-foreground py-2">
                Recipients who signed up on {tc.federation_app_slug} after receiving this email.
              </div>
              <div className="space-y-2">
                {sends.filter((s: any) => s.first_signup_at).map((s: any) => (
                  <div key={s.id} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">{s.recipient_name || s.recipient_email}</div>
                    <div className="text-xs text-muted-foreground">
                      Signed up {formatDistanceToNow(new Date(s.first_signup_at), { addSuffix: true })}
                      {s.first_customer_at && ` · became customer ${formatDistanceToNow(new Date(s.first_customer_at), { addSuffix: true })}`}
                      {s.customer_plan && ` · ${s.customer_plan}`}
                    </div>
                  </div>
                ))}
                {sends.filter((s: any) => s.first_signup_at).length === 0 && (
                  <div className="text-sm text-muted-foreground italic py-4 text-center">No signups yet.</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────── Orphans ─────────────────────────── */

function OrphansPanel({ appSlug }: { appSlug: string }) {
  const { data: orphans = [] } = useSignupOrphans(appSlug);
  if (orphans.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          Unmatched signups <HelpTip text="Signups reported by the federation app that couldn't be matched to a tracked recipient — usually because the person signed up with a different email, or the cros_sid was missing." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orphans.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <div className="font-medium">{o.recipient_email || '(hashed)'}</div>
                <div className="text-xs text-muted-foreground">
                  {o.event_type} · {formatDistanceToNow(new Date(o.occurred_at), { addSuffix: true })}
                </div>
              </div>
              <Badge variant="outline">{o.reason || 'unmatched'}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
