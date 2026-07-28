/**
 * NetworkPresenceCard — Network opt-in/out and profile settings.
 *
 * WHAT: Toggle network visibility, set display name, bio, tags, contact visibility.
 * WHERE: CaregiverNetworkPage "Presence" tab.
 * WHY: Privacy-first controls — default OFF, approximate region only.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, Eye, EyeOff, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useCaregiverProfile, useUpsertCaregiverProfile } from '@/hooks/useCaregiverNetwork';

const AVAILABILITY_OPTIONS = [
  'Open to respite care',
  'Available for check-ins',
  'Can share transport',
  'Experienced with dementia',
  'Experienced with disability',
  'Experienced with pediatrics',
  'Open to mentoring',
];

const SUPPORT_NEEDS_OPTIONS = [
  'Looking for respite',
  'Need emotional support',
  'Seeking local advice',
  'Want to share experiences',
  'Need practical help',
];

export default function NetworkPresenceCard() {
  const { data: profile, isLoading } = useCaregiverProfile();
  const upsert = useUpsertCaregiverProfile();

  const [displayName, setDisplayName] = useState('');
  const [bioShort, setBioShort] = useState('');
  const [networkOptIn, setNetworkOptIn] = useState(false);
  const [contactVisibility, setContactVisibility] = useState<string>('relay_only');
  const [availTags, setAvailTags] = useState<string[]>([]);
  const [supportNeeds, setSupportNeeds] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setBioShort(profile.bio_short || '');
      setNetworkOptIn(profile.network_opt_in);
      setContactVisibility(profile.contact_visibility || 'relay_only');
      setAvailTags(profile.availability_tags || []);
      setSupportNeeds(profile.support_needs || []);
      setHidden(!!profile.hidden_at);
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        display_name: displayName.trim() || 'A caregiver',
        bio_short: bioShort.trim() || null,
        network_opt_in: networkOptIn,
        contact_visibility: contactVisibility,
        availability_tags: availTags,
        support_needs: supportNeeds,
        hidden_at: hidden ? new Date().toISOString() : null,
      });
      toast.success('Your network presence has been updated.');
    } catch {
      toast.error('Something did not go as expected. Please try again.');
    }
  };

  const toggleTag = (tag: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag]);
  };

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Loading…</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Network Presence</CardTitle>
        <CardDescription>
          Control how — and whether — other caregivers can find you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Main opt-in toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg border">
          <Switch
            id="network-opt-in"
            checked={networkOptIn}
            onCheckedChange={setNetworkOptIn}
          />
          <Label htmlFor="network-opt-in" className="cursor-pointer font-medium">
            Let other caregivers find me (approximate region only)
          </Label>
        </div>

        {/* Hide-me-instantly */}
        {networkOptIn && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
            <Switch
              id="hide-me"
              checked={hidden}
              onCheckedChange={setHidden}
            />
            <div className="flex items-center gap-2">
              {hidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              <Label htmlFor="hide-me" className="cursor-pointer text-sm">
                {hidden ? 'You are hidden — no one can see your profile right now' : 'Hide me instantly'}
              </Label>
            </div>
          </div>
        )}

        {/* Display name */}
        <div className="space-y-2">
          <Label>Display name</Label>
          <Input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="First name or nickname"
            maxLength={50}
          />
          <p className="text-xs text-muted-foreground">This is what other caregivers will see. First name only is fine.</p>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label>Short bio <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea
            value={bioShort}
            onChange={e => setBioShort(e.target.value)}
            placeholder="A brief note about your caregiving journey…"
            maxLength={200}
            rows={2}
          />
        </div>

        {/* Contact visibility */}
        <div className="space-y-2">
          <Label>Contact preference</Label>
          <Select value={contactVisibility} onValueChange={setContactVisibility}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relay_only">Relay only — messages through CROS</SelectItem>
              <SelectItem value="reveal_on_request">Reveal on request — share after I accept</SelectItem>
              <SelectItem value="public_email_optional">Public email — visible on my card</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Availability tags */}
        <div className="space-y-2">
          <Label>What I can offer</Label>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABILITY_OPTIONS.map(tag => (
              <Badge
                key={tag}
                variant={availTags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleTag(tag, availTags, setAvailTags)}
              >
                {tag}
                {availTags.includes(tag) && <X className="h-3 w-3 ml-1" />}
              </Badge>
            ))}
          </div>
        </div>

        {/* Support needs */}
        <div className="space-y-2">
          <Label>What I'm looking for</Label>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORT_NEEDS_OPTIONS.map(tag => (
              <Badge
                key={tag}
                variant={supportNeeds.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleTag(tag, supportNeeds, setSupportNeeds)}
              >
                {tag}
                {supportNeeds.includes(tag) && <X className="h-3 w-3 ml-1" />}
              </Badge>
            ))}
          </div>
        </div>

        {/* Privacy reminder */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground mb-0.5">Your privacy is sacred</p>
            <p>Your exact address is never shown. Only your city/state (or state only) is visible. You can hide yourself at any time.</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={upsert.isPending} className="w-full">
          {upsert.isPending ? 'Saving…' : 'Save Presence'}
        </Button>
      </CardContent>
    </Card>
  );
}
