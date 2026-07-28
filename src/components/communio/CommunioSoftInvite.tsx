/**
 * CommunioSoftInvite — Gentle sharing banner for Stewards in Communio.
 *
 * WHAT: A subtle banner encouraging relational sharing of archetype stories.
 * WHERE: Top of Communio page, visible only to Stewards.
 * WHY: Human-centered growth through trusted relationships, not referral codes.
 */
import { useState } from 'react';
import { Heart, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const ARCHETYPES = [
  { key: 'church', label: 'Church / Faith Community' },
  { key: 'catholic_outreach', label: 'Catholic Outreach' },
  { key: 'digital_inclusion', label: 'Digital Inclusion Nonprofit' },
  { key: 'social_enterprise', label: 'Social Enterprise' },
  { key: 'workforce_development', label: 'Workforce Development' },
  { key: 'refugee_support', label: 'Refugee Support' },
];

interface CommunioSoftInviteProps {
  isSteward: boolean;
}

export default function CommunioSoftInvite({ isSteward }: CommunioSoftInviteProps) {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedArchetype, setSelectedArchetype] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isSteward || dismissed) return null;

  const shareUrl = selectedArchetype
    ? `${window.location.origin}/archetypes/${selectedArchetype.replace(/_/g, '-')}-week`
    : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <>
      <div className="relative bg-muted/50 border border-border rounded-lg p-4 flex items-start gap-3">
        <Heart className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground" style={serif}>
            Working with another organization?
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            You can invite them to explore CROS through a story that fits their mission.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs text-primary hover:text-primary/80 gap-1 p-0 h-auto"
            onClick={() => setOpen(true)}
          >
            Share Archetype Story →
          </Button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={serif}>Share an Archetype Story</DialogTitle>
            <DialogDescription>
              Choose an archetype that fits the organization you'd like to share with.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={selectedArchetype} onValueChange={setSelectedArchetype}>
              <SelectTrigger>
                <SelectValue placeholder="Select an archetype…" />
              </SelectTrigger>
              <SelectContent>
                {ARCHETYPES.map((a) => (
                  <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedArchetype && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 text-xs bg-muted px-3 py-2 rounded border border-border truncate"
                />
                <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground italic" style={serif}>
              No referral codes. No rewards. Just a story worth sharing.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
