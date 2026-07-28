/**
 * GardenerMergeTagsHelper — copy-paste personalization tags for Federation campaigns.
 *
 * WHAT: Compact reference of merge tags the gardener-campaign-send edge function
 *       resolves per recipient (from CSV metadata: first_name, last_name,
 *       organization, role, city, state, plus email/name).
 * WHERE: Rendered inside the Import CSV dialog on GardenerFederationCampaignsPage.
 * WHY: Gardeners author federation campaign subject/body in Outreach — they need
 *      to know which tags will actually be replaced at send time. The tenant-side
 *      MergeTagsHelper uses `{{ contact.FIRSTNAME }}` syntax; federation sends use
 *      snake_case tokens, so this cannot be shared with tenant Outreach UI.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Copy, Check, Tags } from 'lucide-react';
import { toast } from 'sonner';

interface Tag {
  tag: string;
  description: string;
  csvColumn: string;
}

const FEDERATION_TAGS: Tag[] = [
  { tag: '{{first_name}}', description: 'Recipient first name', csvColumn: 'first_name (or first token of name)' },
  { tag: '{{last_name}}', description: 'Recipient last name', csvColumn: 'last_name (or remaining tokens of name)' },
  { tag: '{{name}}', description: 'Full name', csvColumn: 'name' },
  { tag: '{{email}}', description: 'Email address', csvColumn: 'email (required)' },
  { tag: '{{organization}}', description: 'Organization / company', csvColumn: 'organization' },
  { tag: '{{role}}', description: 'Job title / role', csvColumn: 'role' },
  { tag: '{{city}}', description: 'City', csvColumn: 'city' },
  { tag: '{{state}}', description: 'State / region', csvColumn: 'state' },
];

export function GardenerMergeTagsHelper() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag);
      setCopied(tag);
      toast.success('Copied');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between px-3 py-2 h-auto font-normal">
          <span className="flex items-center gap-2 text-xs">
            <Tags className="h-3.5 w-3.5" />
            Personalization tags ({FEDERATION_TAGS.length})
          </span>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <p className="text-[11px] text-muted-foreground mb-2">
          Paste these into the campaign's subject or HTML body in Outreach. At send time each tag is
          replaced with the matching CSV column for that recipient. Missing columns render as empty.
        </p>
        <div className="space-y-1">
          {FEDERATION_TAGS.map((t) => (
            <div
              key={t.tag}
              className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <code className="text-xs font-mono text-primary">{t.tag}</code>
                <div className="text-[10px] text-muted-foreground truncate">
                  {t.description} — CSV: <span className="font-mono">{t.csvColumn}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => copy(t.tag)}
                aria-label={`Copy ${t.tag}`}
              >
                {copied === t.tag ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
