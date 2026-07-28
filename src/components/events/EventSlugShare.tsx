/**
 * EventSlugShare — Slug management and public link sharing for events.
 *
 * WHAT: Displays auto-generated slug, allows editing, provides copy-link and QR code.
 * WHERE: Used on EventDetail page and EventModal.
 * WHY: Tenants need a way to share public registration links for their events.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/sonner';
import { Copy, Check, ExternalLink, QrCode, Pencil, Globe } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { supabase } from '@/integrations/supabase/client';

interface EventSlugShareProps {
  eventId: string;
  eventName: string;
  currentSlug: string | null;
  onSlugUpdated?: (newSlug: string) => void;
  compact?: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function EventSlugShare({ eventId, eventName, currentSlug, onSlugUpdated, compact = false }: EventSlugShareProps) {
  const [slug, setSlug] = useState(currentSlug || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (currentSlug) {
      setSlug(currentSlug);
    } else if (eventName && !slug) {
      setSlug(slugify(eventName));
    }
  }, [currentSlug, eventName]);

  const publicUrl = slug ? `${window.location.origin}/events/${slug}` : '';

  const handleSaveSlug = async () => {
    if (!slug.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({ slug: slug.trim() })
        .eq('id', eventId);
      if (error) throw error;
      toast.success('Public link updated');
      onSlugUpdated?.(slug.trim());
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update slug');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutoGenerate = async () => {
    const newSlug = slugify(eventName);
    setSlug(newSlug);
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({ slug: newSlug })
        .eq('id', eventId);
      if (error) throw error;
      toast.success('Public link generated');
      onSlugUpdated?.(newSlug);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate link');
    } finally {
      setIsSaving(false);
    }
  };

  // No slug yet — show generate button
  if (!currentSlug && !isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAutoGenerate}
          disabled={isSaving}
          className="gap-1.5"
        >
          <Globe className="h-3.5 w-3.5" />
          Generate Public Link
        </Button>
        <HelpTooltip
          what="Creates a shareable registration page for this event"
          where="Visible to anyone with the link"
          why="Lets community members register without needing an account"
        />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="gap-1 text-xs font-normal">
          <Globe className="h-3 w-3" />
          Public
        </Badge>
        <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded max-w-[200px] truncate">
          /events/{slug}
        </code>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(publicUrl, '_blank')}>
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Globe className="h-4 w-4 text-primary" />
          Public Registration Link
        </Label>
        <HelpTooltip
          what="A shareable URL where anyone can register for this event"
          where="Shared via email, social media, or printed materials"
          why="Enables community-facing event registration without requiring accounts"
        />
      </div>

      {isEditing ? (
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">/events/</span>
            <Input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className="h-8 text-sm"
              placeholder="event-slug"
            />
          </div>
          <Button type="button" size="sm" onClick={handleSaveSlug} disabled={isSaving || !slug.trim()}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setSlug(currentSlug || ''); setIsEditing(false); }}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="text-sm text-muted-foreground bg-background px-3 py-1.5 rounded border border-input flex-1 truncate">
            {publicUrl}
          </code>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy} title="Copy link">
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsEditing(true)} title="Edit slug">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => window.open(publicUrl, '_blank')} title="Open page">
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="QR Code">
                <QrCode className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4">
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium">QR Code</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}`}
                  alt="Event QR Code"
                  className="mx-auto rounded"
                  width={200}
                  height={200}
                />
                <p className="text-xs text-muted-foreground">Scan to open registration page</p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
