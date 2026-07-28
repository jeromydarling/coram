import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ManualEmailEntryProps {
  value: string;
  onChange: (value: string) => void;
}

export function ManualEmailEntry({ value, onChange }: ManualEmailEntryProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="manual-emails">Paste Emails</Label>
      <Textarea
        id="manual-emails"
        placeholder={`Enter emails, one per line or comma-separated.

Supports formats:
• email@example.com
• John Doe <john@example.com>
• jane@example.com, bob@example.com`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Emails will be normalized to lowercase and deduplicated.
      </p>
    </div>
  );
}
