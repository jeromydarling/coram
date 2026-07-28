/**
 * IntakeForm — Human-centered help request dialog.
 *
 * WHAT: Replaces FeedbackForm for operator intake submissions.
 * WHERE: Avatar menu → "Help / Report something".
 * WHY: Routes submissions to Operator Console with tenant + route context.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useOperatorIntake, collectClientMeta, detectModuleKey } from '@/hooks/useOperatorIntake';
import { useTenant } from '@/contexts/TenantContext';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Sparkles, HelpCircle } from 'lucide-react';

interface IntakeFormProps {
  trigger?: React.ReactNode;
}

export function IntakeForm({ trigger }: IntakeFormProps) {
  const [open, setOpen] = useState(false);
  const [intakeType, setIntakeType] = useState<'problem' | 'request'>('problem');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [includeTechDetails, setIncludeTechDetails] = useState(false);

  const { submitIntake } = useOperatorIntake();
  const { tenantId } = useTenant();
  const location = useLocation();

  const resetForm = () => {
    setTitle('');
    setBody('');
    setIntakeType('problem');
    setIncludeTechDetails(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    const pagePath = location.pathname;
    const moduleKey = detectModuleKey(pagePath);
    const clientMeta = includeTechDetails ? collectClientMeta() : {};

    await submitIntake.mutateAsync({
      tenant_id: tenantId,
      intake_type: intakeType,
      title: title.trim(),
      body: body.trim(),
      module_key: moduleKey,
      page_path: pagePath,
      client_meta: clientMeta,
    });

    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <HelpCircle className="w-4 h-4 mr-2" />
            Ask for help
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Ask for help</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Tell us what's going on — we'll take it from here.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIntakeType('problem')}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                intakeType === 'problem'
                  ? 'border-destructive/50 bg-destructive/5 text-destructive'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Something isn't working
            </button>
            <button
              type="button"
              onClick={() => setIntakeType('request')}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                intakeType === 'request'
                  ? 'border-primary/50 bg-primary/5 text-primary'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              I wish it could…
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="intake-title">
              {intakeType === 'problem' ? 'What happened?' : 'What do you wish for?'}
            </Label>
            <Input
              id="intake-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={intakeType === 'problem' ? "e.g. Can't save a reflection" : "e.g. Filter contacts by event"}
              required
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground text-right">{title.length}/120</p>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="intake-body">Tell us a little more</Label>
            <Textarea
              id="intake-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                intakeType === 'problem'
                  ? "What were you trying to do? What did you expect? What happened instead?"
                  : "How would this help your work? Any details that would help us understand?"
              }
              rows={5}
              required
              maxLength={6000}
            />
            <p className="text-xs text-muted-foreground text-right">{body.length}/6000</p>
          </div>

          {/* Route context */}
          <p className="text-xs text-muted-foreground">
            📍 You're on <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{location.pathname}</code>
          </p>

          {/* Tech details toggle */}
          <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg">
            <div>
              <p className="text-sm font-medium">Include technical details</p>
              <p className="text-xs text-muted-foreground">Browser, viewport, timezone — helps us reproduce issues faster</p>
            </div>
            <Switch checked={includeTechDetails} onCheckedChange={setIncludeTechDetails} />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitIntake.isPending || !title.trim() || !body.trim()}>
              {submitIntake.isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
