/**
 * GoogleFormIntakePage — Connect a Google Form to this workspace.
 *
 * WHAT: Generates a per-tenant intake URL + token and provides an Apps Script
 *       snippet customers paste into their Form's linked Sheet.
 * WHERE: /:tenantSlug/settings/google-forms
 * WHY: Lets stewards capture Google Form responses as Leads without leaving
 *      their existing form — each submission lands in the inbox below for
 *      review and promotion to a Person record.
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { Copy, Check, Plus, Archive, FileText, ArrowRight, Trash2 } from 'lucide-react';

type Intake = {
  id: string;
  label: string;
  token: string;
  submission_count: number;
  last_seen_at: string | null;
  archived_at: string | null;
  created_at: string;
};

type Submission = {
  id: string;
  intake_id: string;
  parsed_name: string | null;
  parsed_email: string | null;
  parsed_phone: string | null;
  parsed_notes: string | null;
  raw_payload: { answers?: Record<string, unknown> };
  status: string;
  created_at: string;
};

const INTAKE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-form-intake`;

export default function GoogleFormIntakePage() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [scriptIntake, setScriptIntake] = useState<Intake | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    void load();
  }, [tenant?.id]);

  async function load() {
    if (!tenant?.id) return;
    setLoading(true);
    const [{ data: i }, { data: s }] = await Promise.all([
      supabase
        .from('tenant_form_intakes')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('form_intake_submissions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    setIntakes((i ?? []) as Intake[]);
    setSubmissions((s ?? []) as Submission[]);
    setLoading(false);
  }

  async function createIntake() {
    if (!tenant?.id || !newLabel.trim()) return;
    const { data, error } = await supabase
      .from('tenant_form_intakes')
      .insert({ tenant_id: tenant.id, label: newLabel.trim(), source: 'google_form' })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setNewLabel('');
    setScriptIntake(data as Intake);
    void load();
    toast.success('Form connection created');
  }

  async function archiveIntake(id: string) {
    const { error } = await supabase
      .from('tenant_form_intakes')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    void load();
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied');
    setTimeout(() => setCopiedKey(null), 1500);
  }

  async function promote(sub: Submission) {
    if (!tenant?.id) return;
    const name = sub.parsed_name?.trim() || sub.parsed_email?.split('@')[0] || 'New contact';
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenant.id,
        name,
        email: sub.parsed_email,
        phone: sub.parsed_phone,
        notes: sub.parsed_notes,
        person_type: 'partner_contact',
        created_by: user?.id,
      })
      .select('id')
      .single();
    if (error) { toast.error(error.message); return; }
    await supabase
      .from('form_intake_submissions')
      .update({
        status: 'promoted',
        promoted_contact_id: contact.id,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', sub.id);
    toast.success('Person added');
    void load();
  }

  async function dismiss(id: string) {
    await supabase
      .from('form_intake_submissions')
      .update({
        status: 'dismissed',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);
    void load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Google Form Intake</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect a Google Form so each response arrives here for gentle review,
          then becomes a Person in your workspace when you're ready.
        </p>
      </div>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">
            Inbox
            {submissions.length > 0 && (
              <Badge variant="secondary" className="ml-2">{submissions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="connections">Connected Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-3 mt-4">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : submissions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No new submissions to review.</p>
              </CardContent>
            </Card>
          ) : (
            submissions.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-medium text-foreground">{s.parsed_name || '(no name)'}</span>
                    {s.parsed_email && <span className="text-sm text-muted-foreground">{s.parsed_email}</span>}
                    {s.parsed_phone && <span className="text-sm text-muted-foreground">{s.parsed_phone}</span>}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                  {s.parsed_notes && (
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground bg-muted/40 rounded p-2 max-h-40 overflow-auto">
                      {s.parsed_notes}
                    </pre>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => promote(s)}>
                      Add as Person <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dismiss(s.id)}>
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="connections" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif">Connect a new Form</CardTitle>
              <CardDescription>
                Give it a name (e.g. "Volunteer interest 2026"), then paste the
                provided snippet into your Form's Apps Script.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Volunteer interest form"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createIntake()}
                />
                <Button onClick={createIntake} disabled={!newLabel.trim()}>
                  <Plus className="mr-1 h-4 w-4" /> Create
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            intakes.map((intake) => (
              <Card key={intake.id} className={intake.archived_at ? 'opacity-60' : ''}>
                <CardContent className="pt-5 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{intake.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {intake.submission_count} submission{intake.submission_count === 1 ? '' : 's'} ·{' '}
                      {intake.last_seen_at
                        ? `last received ${new Date(intake.last_seen_at).toLocaleString()}`
                        : 'no submissions yet'}
                    </div>
                  </div>
                  {intake.archived_at ? (
                    <Badge variant="outline">Archived</Badge>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setScriptIntake(intake)}>
                        Setup script
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => archiveIntake(intake.id)}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <SetupDialog
        intake={scriptIntake}
        onClose={() => setScriptIntake(null)}
        copyText={copyText}
        copiedKey={copiedKey}
      />
    </div>
  );
}

function SetupDialog({
  intake,
  onClose,
  copyText,
  copiedKey,
}: {
  intake: Intake | null;
  onClose: () => void;
  copyText: (t: string, k: string) => void;
  copiedKey: string | null;
}) {
  const script = useMemo(() => {
    if (!intake) return '';
    return `// CROS Google Form intake — paste into your Form's linked Sheet
// (Extensions → Apps Script). Then add a trigger:
//   Triggers → Add trigger → onFormSubmit → From form → On form submit
const CROS_INTAKE_URL = '${INTAKE_URL}';
const CROS_TOKEN = '${intake.token}';

function onFormSubmit(e) {
  const answers = {};
  e.response.getItemResponses().forEach(r => {
    answers[r.getItem().getTitle()] = r.getResponse();
  });
  UrlFetchApp.fetch(CROS_INTAKE_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      token: CROS_TOKEN,
      answers: answers,
      meta: { submittedAt: new Date().toISOString() }
    }),
    muteHttpExceptions: true
  });
}`;
  }, [intake]);

  return (
    <Dialog open={!!intake} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Connect "{intake?.label}"</DialogTitle>
          <DialogDescription>
            Open your Google Form, click <strong>⋮ → Script editor</strong> (or
            from the linked Sheet: <strong>Extensions → Apps Script</strong>),
            then paste this script and add an <em>onFormSubmit</em> trigger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Apps Script</span>
              <Button size="sm" variant="ghost" onClick={() => copyText(script, 'script')}>
                {copiedKey === 'script' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <pre className="text-xs font-mono overflow-auto max-h-72 whitespace-pre-wrap">{script}</pre>
          </div>

          <p className="text-xs text-muted-foreground">
            Keep this token private — it identifies your workspace. Archive the
            connection here at any time to immediately stop accepting submissions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
