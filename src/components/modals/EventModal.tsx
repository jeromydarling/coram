import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete';
import { PartnerCombobox } from '@/components/shared/PartnerCombobox';

import { useCreateEvent, useUpdateEvent } from '@/hooks/useEvents';
import { useMetros } from '@/hooks/useMetros';
import { useEventTargetPopulations, useEventStrategicLanes, useEventPcsGoals } from '@/hooks/useEventLookups';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDirtyClose } from '@/hooks/useDirtyClose';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

interface Event {
  id: string;
  event_id: string;
  event_name: string;
  event_date: string;
  end_date?: string | null;
  metro_id?: string | null;
  event_type: string | null;
  staff_deployed?: number | null;
  households_served?: number | null;
  anchor_identified_yn?: boolean | null;
  notes?: string | null;
  description?: string | null;
  city?: string | null;
  host_organization?: string | null;
  host_opportunity_id?: string | null;
  target_populations?: string[] | null;
  strategic_lanes?: string[] | null;
  pcs_goals?: string[] | null;
  priority?: 'High' | 'Medium' | 'Low' | null;
  status?: 'Registered' | 'Not Registered' | null;
  travel_required?: 'Local' | 'Regional' | null;
  expected_households?: string | null;
  anchor_potential?: 'High' | 'Medium' | 'Very High' | 'Extremely High' | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | null;
  recurrence_end_date?: string | null;
  url?: string | null;
}

interface EventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event | null;
}

interface FieldErrors {
  event_name?: string;
  event_date?: string;
  staff_deployed?: string;
  households_served?: string;
  notes?: string;
}

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const;
const STATUS_OPTIONS = ['Registered', 'Not Registered'] as const;
const TRAVEL_OPTIONS = ['Local', 'Regional'] as const;
const ANCHOR_POTENTIAL_OPTIONS = ['High', 'Medium', 'Very High', 'Extremely High'] as const;
const RECURRENCE_PATTERN_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

// Common event type suggestions
const EVENT_TYPE_SUGGESTIONS = [
  'Conference', 'Workshop', 'Community Gathering', 'Fundraiser',
  'Training', 'Networking', 'Outreach', 'Meeting', 'Volunteer Day',
  'Panel Discussion', 'Webinar', 'Open House', 'Festival', 'Service Day'
];

export function EventModal({ open, onOpenChange, event }: EventModalProps) {
  const dirtyGuard = useDirtyClose(onOpenChange);
  // Core fields
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [metroId, setMetroId] = useState<string>('');
  const [eventType, setEventType] = useState<string>('');
  const [staffDeployed, setStaffDeployed] = useState('');
  const [householdsServed, setHouseholdsServed] = useState('');
  const [anchorIdentified, setAnchorIdentified] = useState(false);
  const [notes, setNotes] = useState('');
  
  // New fields
  const [city, setCity] = useState('');
  const [hostOrganization, setHostOrganization] = useState('');
  const [hostOpportunityId, setHostOpportunityId] = useState<string | null>(null);
  const [targetPopulations, setTargetPopulations] = useState<string[]>([]);
  const [strategicLanes, setStrategicLanes] = useState<string[]>([]);
  const [pcsGoals, setPcsGoals] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [travelRequired, setTravelRequired] = useState<string>('');
  const [expectedHouseholds, setExpectedHouseholds] = useState('');
  const [anchorPotential, setAnchorPotential] = useState<string>('');
  // Recurring fields
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<string>('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isConference, setIsConference] = useState(false);
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [isEnriching, setIsEnriching] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Event type input
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false);
  // Goal input
  const [goalInput, setGoalInput] = useState('');
  // Target Population input
  const [popInput, setPopInput] = useState('');
  // Strategic Lane input
  const [laneInput, setLaneInput] = useState('');
  
  const { data: metros } = useMetros();
  const { data: targetPopulationOptions } = useEventTargetPopulations();
  const { data: strategicLaneOptions } = useEventStrategicLanes();
  const { data: pcsGoalOptions } = useEventPcsGoals();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const isEditMode = !!event;

  useEffect(() => {
    if (event) {
      setEventName(event.event_name || '');
      setEventDate(event.event_date || '');
      setEndDate(event.end_date || '');
      setMetroId(event.metro_id || '');
      setEventType(event.event_type || '');
      setStaffDeployed(event.staff_deployed?.toString() || '');
      setHouseholdsServed(event.households_served?.toString() || '');
      setAnchorIdentified(event.anchor_identified_yn || false);
      setNotes(event.notes || '');
      setCity(event.city || '');
      setHostOrganization(event.host_organization || '');
      setHostOpportunityId(event.host_opportunity_id || null);
      setTargetPopulations(event.target_populations || []);
      setStrategicLanes(event.strategic_lanes || []);
      setPcsGoals(event.pcs_goals || []);
      setPriority(event.priority || '');
      setStatus(event.status || '');
      setTravelRequired(event.travel_required || '');
      setExpectedHouseholds(event.expected_households || '');
      setAnchorPotential(event.anchor_potential || '');
      setIsRecurring(event.is_recurring || false);
      setRecurrencePattern(event.recurrence_pattern || '');
      setRecurrenceEndDate(event.recurrence_end_date || '');
      setDescription(event.description || '');
      setUrl(event.url || '');
      setIsConference((event as any).is_conference || false);
      setLocation((event as any).location || '');
      setCapacity((event as any).capacity?.toString() || '');
    } else {
      resetForm();
    }
    setFieldErrors({});
    setGoalInput('');
    setPopInput('');
    setLaneInput('');
  }, [event, open]);

  const resetForm = () => {
    setEventName('');
    setEventDate('');
    setEndDate('');
    setMetroId('');
    setEventType('');
    setStaffDeployed('');
    setHouseholdsServed('');
    setAnchorIdentified(false);
    setNotes('');
    setCity('');
    setHostOrganization('');
    setHostOpportunityId(null);
    setTargetPopulations([]);
    setStrategicLanes([]);
    setPcsGoals([]);
    setPriority('');
    setStatus('');
    setTravelRequired('');
    setExpectedHouseholds('');
    setAnchorPotential('');
    setIsRecurring(false);
    setRecurrencePattern('');
    setRecurrenceEndDate('');
    setUrl('');
    setDescription('');
    setIsConference(false);
    setLocation('');
    setCapacity('');
    setFieldErrors({});
    setGoalInput('');
    setPopInput('');
    setLaneInput('');
  };

  const generateMapsLink = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const parseNumericInput = (val: string): number | null => {
    if (!val || val.trim() === '') return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  };

  const handleAddGoal = () => {
    const trimmed = goalInput.trim();
    if (trimmed && !pcsGoals.includes(trimmed)) {
      setPcsGoals([...pcsGoals, trimmed]);
      setGoalInput('');
    }
  };

  const handleRemoveGoal = (goal: string) => {
    setPcsGoals(pcsGoals.filter(g => g !== goal));
  };

  const handleAddPop = () => {
    const trimmed = popInput.trim();
    if (trimmed && !targetPopulations.includes(trimmed)) {
      setTargetPopulations([...targetPopulations, trimmed]);
      setPopInput('');
    }
  };

  const handleAddLane = () => {
    const trimmed = laneInput.trim();
    if (trimmed && !strategicLanes.includes(trimmed)) {
      setStrategicLanes([...strategicLanes, trimmed]);
      setLaneInput('');
    }
  };

  const handleEnrichFromUrl = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !/^https?:\/\/.+/i.test(trimmedUrl)) {
      toast.error('Please enter a valid URL first');
      return;
    }
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('event-enrich-from-url', {
        body: { url: trimmedUrl },
      });
      if (error || !data?.ok) {
        toast.error(data?.error || error?.message || 'Enrichment failed');
        return;
      }
      const ex = data.extracted;
      let filled = 0;
      if (ex.event_name && !eventName) { setEventName(ex.event_name); filled++; }
      if (ex.description) { setDescription(ex.description); filled++; }
      if (ex.event_date && !eventDate) { setEventDate(ex.event_date); filled++; }
      if (ex.end_date && !endDate) { setEndDate(ex.end_date); filled++; }
      if (ex.event_type && !eventType) { setEventType(ex.event_type); filled++; }
      if (ex.city && !city) { setCity(ex.city); filled++; }
      if (ex.host_organization && !hostOrganization) { setHostOrganization(ex.host_organization); filled++; }
      if (ex.target_populations?.length && targetPopulations.length === 0) { setTargetPopulations(ex.target_populations); filled++; }
      if (ex.is_recurring != null) { setIsRecurring(!!ex.is_recurring); }
      if (ex.recurrence_pattern && !recurrencePattern) { setRecurrencePattern(ex.recurrence_pattern); }
      if (ex.is_conference != null) { setIsConference(!!ex.is_conference); }

      const extras: string[] = [];
      if (ex.cost) extras.push(`Cost: ${ex.cost}`);
      if (ex.expected_attendance) extras.push(`Expected attendance: ${ex.expected_attendance}`);
      if (ex.speakers?.length) extras.push(`Speakers: ${ex.speakers.join(', ')}`);
      if (ex.topics?.length) extras.push(`Topics: ${ex.topics.join(', ')}`);
      if (ex.contact_email) extras.push(`Contact: ${ex.contact_email}`);
      if (ex.contact_phone) extras.push(`Phone: ${ex.contact_phone}`);
      if (ex.host_description) extras.push(`Host: ${ex.host_description}`);
      if (ex.registration_required != null) extras.push(`Registration required: ${ex.registration_required ? 'Yes' : 'No'}`);

      if (extras.length > 0) {
        const enrichedNotes = `--- Enriched from URL ---\n${extras.join('\n')}`;
        setNotes(prev => prev ? `${prev}\n\n${enrichedNotes}` : enrichedNotes);
        filled += extras.length;
      }

      toast.success(`Enriched ${filled} field(s) from event page`);
    } catch (err: any) {
      console.error('Event enrichment error:', err);
      toast.error('Failed to enrich from URL');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const errors: FieldErrors = {};
    if (!eventName.trim()) errors.event_name = 'Event name is required';
    if (!eventDate) errors.event_date = 'Event date is required';
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      Object.values(errors).forEach(err => toast.error(err));
      return;
    }

    try {
      const eventPayload = {
        event_name: eventName.trim(),
        event_date: eventDate,
        end_date: endDate || null,
        metro_id: metroId || null,
        event_type: eventType || null,
        staff_deployed: parseNumericInput(staffDeployed) ?? undefined,
        households_served: parseNumericInput(householdsServed) ?? undefined,
        anchor_identified_yn: anchorIdentified,
        notes: notes || undefined,
        city: city || null,
        host_organization: hostOrganization || null,
        host_opportunity_id: hostOpportunityId || null,
        target_populations: targetPopulations.length > 0 ? targetPopulations : null,
        strategic_lanes: strategicLanes.length > 0 ? strategicLanes : null,
        pcs_goals: pcsGoals.length > 0 ? pcsGoals : null,
        priority: priority || null,
        status: isConference ? (status || null) : null,
        travel_required: travelRequired || null,
        expected_households: expectedHouseholds || null,
        anchor_potential: anchorPotential || null,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern || null : null,
        recurrence_end_date: isRecurring ? recurrenceEndDate || null : null,
        url: url || null,
        description: description || null,
        is_conference: isConference,
        location: location || null,
        capacity: parseNumericInput(capacity) ?? null,
        slug: !isEditMode ? eventName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) : undefined,
      };

      if (isEditMode && event) {
        await updateEvent.mutateAsync({
          id: event.id,
          ...eventPayload
        });
      } else {
        const eventId = `EVT-${Date.now()}`;
        await createEvent.mutateAsync({
          event_id: eventId,
          ...eventPayload
        });
      }
      
      resetForm();
      dirtyGuard.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save event');
    }
  };

  const isPending = createEvent.isPending || updateEvent.isPending;

  // Suggestions from lookups, excluding already-selected items
  const allPopSuggestions = (targetPopulationOptions || [])
    .map(o => o.name)
    .filter(p => !targetPopulations.includes(p));

  const allLaneSuggestions = (strategicLaneOptions || [])
    .map(o => o.name)
    .filter(l => !strategicLanes.includes(l));

  // Combine lookup goals with existing goals for suggestions
  const allGoalSuggestions = [
    ...(pcsGoalOptions || []).map(o => o.name),
  ].filter((g, i, arr) => arr.indexOf(g) === i && !pcsGoals.includes(g));

  // Filter event type suggestions based on input
  const filteredTypeSuggestions = EVENT_TYPE_SUGGESTIONS.filter(
    t => t.toLowerCase().includes(eventType.toLowerCase()) && t !== eventType
  );

  return (
    <>
    <Dialog open={open} onOpenChange={dirtyGuard.handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" onChange={dirtyGuard.markDirty}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Event' : 'Add New Event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Name & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventName">Event Name *</Label>
              <Input
                id="eventName"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                maxLength={200}
                required
                placeholder="Event name"
                className={fieldErrors.event_name ? 'border-destructive' : ''}
              />
              {fieldErrors.event_name && (
                <p className="text-xs text-destructive">{fieldErrors.event_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventDate">Start Date *</Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className={fieldErrors.event_date ? 'border-destructive' : ''}
              />
              {fieldErrors.event_date && (
                <p className="text-xs text-destructive">{fieldErrors.event_date}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date <span className="text-muted-foreground text-xs">(optional, for multi-day)</span></Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={eventDate}
              />
            </div>
          </div>

          {/* Recurring Event Options */}
          <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Switch
                id="isRecurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
              <Label htmlFor="isRecurring" className="font-medium">Recurring Event</Label>
            </div>
            
            {isRecurring && (
              <>
                <div className="flex-1 max-w-[160px]">
                  <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pattern..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_PATTERN_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="recurrenceEndDate" className="text-sm whitespace-nowrap">Until</Label>
                  <Input
                    id="recurrenceEndDate"
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
              </>
            )}
          </div>

          {/* Conference Mode Toggle */}
          <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Switch
                id="isConference"
                checked={isConference}
                onCheckedChange={setIsConference}
              />
              <Label htmlFor="isConference" className="font-medium">
                Conference Mode
              </Label>
            </div>
            <span className="text-xs text-muted-foreground">
              Enables attendee tracking and target ranking
            </span>
          </div>

          {/* Row 2: Metro & Event Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="metro">Metro</Label>
              <Select value={metroId} onValueChange={setMetroId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select metro" />
                </SelectTrigger>
                <SelectContent>
                  {metros?.map((metro) => (
                    <SelectItem key={metro.id} value={metro.id}>
                      {metro.metro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="eventType">Event Type</Label>
              <Input
                id="eventType"
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value);
                  setShowTypeSuggestions(true);
                }}
                onFocus={() => setShowTypeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTypeSuggestions(false), 200)}
                placeholder="e.g. Workshop, Conference, Outreach..."
              />
              {showTypeSuggestions && filteredTypeSuggestions.length > 0 && eventType.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-40 overflow-y-auto">
                  {filteredTypeSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setEventType(suggestion);
                        setShowTypeSuggestions(false);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Address & Host Organization */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <AddressAutocomplete
                value={city}
                onChange={setCity}
                placeholder="Search for an address or venue…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hostOrg">Host Organization</Label>
              <PartnerCombobox
                value={hostOrganization}
                onChange={setHostOrganization}
                selectedPartnerId={hostOpportunityId}
                onPartnerSelected={setHostOpportunityId}
                placeholder="Search partners or type a name…"
              />
            </div>
          </div>

          {/* URL Field */}
          <div className="space-y-2">
            <Label htmlFor="url">Event URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              {url && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(url, '_blank')}
                  title="Open URL"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleEnrichFromUrl}
                disabled={!url.trim() || isEnriching}
                title="Auto-fill event details from this URL"
                className="gap-1.5 whitespace-nowrap"
              >
                {isEnriching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isEnriching ? 'Enriching…' : 'Enrich'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste an event page URL and click Enrich to auto-fill details
            </p>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter event description"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Location & Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Full Address / Venue</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="123 Main St, City, State"
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="capacity"
                type="number"
                min="0"
                max="100000"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
          </div>

          {/* Target Population — free-text with suggestions */}
          <div className="space-y-2">
            <Label>Target Population</Label>
            <div className="flex gap-2">
              <Input
                value={popInput}
                onChange={(e) => setPopInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPop();
                  }
                }}
                placeholder="Type a population and press Enter..."
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddPop} disabled={!popInput.trim()}>
                Add
              </Button>
            </div>
            {allPopSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-xs text-muted-foreground mr-1">Suggestions:</span>
                {allPopSuggestions.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => setTargetPopulations([...targetPopulations, s])}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
            {targetPopulations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {targetPopulations.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {p}
                    <button type="button" onClick={() => setTargetPopulations(targetPopulations.filter(x => x !== p))} className="hover:text-destructive">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Strategic Lane — free-text with suggestions */}
          <div className="space-y-2">
            <Label>Strategic Lane</Label>
            <div className="flex gap-2">
              <Input
                value={laneInput}
                onChange={(e) => setLaneInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLane();
                  }
                }}
                placeholder="Type a lane and press Enter..."
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddLane} disabled={!laneInput.trim()}>
                Add
              </Button>
            </div>
            {allLaneSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-xs text-muted-foreground mr-1">Suggestions:</span>
                {allLaneSuggestions.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => setStrategicLanes([...strategicLanes, s])}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
            {strategicLanes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {strategicLanes.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {l}
                    <button type="button" onClick={() => setStrategicLanes(strategicLanes.filter(x => x !== l))} className="hover:text-destructive">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Goals — free-text input with suggestion chips */}
          <div className="space-y-2">
            <Label>Goals</Label>
            <div className="flex gap-2">
              <Input
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddGoal();
                  }
                }}
                placeholder="Type a goal and press Enter..."
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddGoal} disabled={!goalInput.trim()}>
                Add
              </Button>
            </div>
            {/* Suggestion chips from lookup */}
            {allGoalSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-xs text-muted-foreground mr-1">Suggestions:</span>
                {allGoalSuggestions.slice(0, 6).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => setPcsGoals([...pcsGoals, suggestion])}
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            )}
            {/* Selected goals */}
            {pcsGoals.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {pcsGoals.map((goal) => (
                  <span key={goal} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {goal}
                    <button type="button" onClick={() => handleRemoveGoal(goal)} className="hover:text-destructive">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Priority, Status (conference only), Travel, Anchor Potential */}
          <div className={cn("grid gap-3", isConference ? "grid-cols-4" : "grid-cols-3")}>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isConference && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Travel</Label>
              <Select value={travelRequired} onValueChange={setTravelRequired}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {TRAVEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Anchor Potential</Label>
              <Select value={anchorPotential} onValueChange={setAnchorPotential}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {ANCHOR_POTENTIAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expected Attendance & Staff */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expectedHH">Expected Attendance</Label>
              <Input
                id="expectedHH"
                value={expectedHouseholds}
                onChange={(e) => setExpectedHouseholds(e.target.value)}
                placeholder="e.g. 50-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff">Staff</Label>
              <Input
                id="staff"
                type="number"
                min="0"
                max="10000"
                value={staffDeployed}
                onChange={(e) => setStaffDeployed(e.target.value)}
                placeholder="0"
                className={fieldErrors.staff_deployed ? 'border-destructive' : ''}
              />
              {fieldErrors.staff_deployed && (
                <p className="text-xs text-destructive">{fieldErrors.staff_deployed}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="attended"># Attended</Label>
              <Input
                id="attended"
                type="number"
                min="0"
                max="100000"
                value={householdsServed}
                onChange={(e) => setHouseholdsServed(e.target.value)}
                placeholder="0"
                className={fieldErrors.households_served ? 'border-destructive' : ''}
              />
              {fieldErrors.households_served && (
                <p className="text-xs text-destructive">{fieldErrors.households_served}</p>
              )}
            </div>
          </div>

          {/* Anchor Identified Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="anchorIdentified"
              checked={anchorIdentified}
              onCheckedChange={setAnchorIdentified}
            />
            <Label htmlFor="anchorIdentified">Anchor Identified at Event</Label>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="Event notes..."
              rows={3}
              className={fieldErrors.notes ? 'border-destructive' : ''}
            />
            {fieldErrors.notes && (
              <p className="text-xs text-destructive">{fieldErrors.notes}</p>
            )}
            <p className="text-xs text-muted-foreground">{notes.length}/2000</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => dirtyGuard.handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Event')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog
      open={dirtyGuard.showPrompt}
      onDiscard={dirtyGuard.discard}
      onCancel={dirtyGuard.cancelPrompt}
    />
    </>
  );
}
