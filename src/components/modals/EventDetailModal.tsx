import { useState, useEffect, useMemo } from 'react';
import { parseISO, startOfToday } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar, 
  MapPin,
  Users, 
  Laptop, 
  Wifi, 
  CheckCircle2, 
  XCircle,
  Copy,
  Pencil,
  Building2,
  ExternalLink,
  Target,
  Compass,
  Flag,
  Car,
  Zap,
  Link,
  UserPlus,
  TrendingUp,
  Gauge
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NoteHistoryPanel } from '@/components/notes/NoteHistoryPanel';
import { useContactsByEvent } from '@/hooks/useEventContactsCount';
import { useEventContactsCount } from '@/hooks/useEventContactsCount';
import { useUpdateEvent } from '@/hooks/useEvents';
import { calculateEventROIWithStats, getROICategoryStyle } from '@/lib/eventRoiCalculator';

type GrantNarrativeValue = 'High' | 'Medium' | 'Low';

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
  devices_distributed?: number | null;
  internet_signups?: number | null;
  anchor_identified_yn?: boolean | null;
  grant_narrative_value?: GrantNarrativeValue | null;
  notes?: string | null;
  description?: string | null;
  metros?: { metro: string } | null;
  // New fields
  city?: string | null;
  host_organization?: string | null;
  target_populations?: string[] | null;
  strategic_lanes?: string[] | null;
  pcs_goals?: string[] | null;
  priority?: 'High' | 'Medium' | 'Low' | null;
  status?: 'Registered' | 'Not Registered' | null;
  travel_required?: 'Local' | 'Regional' | null;
  expected_households?: string | null;
  expected_referrals?: string | null;
  anchor_potential?: 'High' | 'Medium' | 'Very High' | 'Extremely High' | null;
  url?: string | null;
  attended?: boolean | null;
}

interface EventDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
  onEdit: () => void;
  onDuplicate: () => void;
  isDuplicating?: boolean;
}

export function EventDetailModal({ 
  open, 
  onOpenChange, 
  event, 
  onEdit, 
  onDuplicate,
  isDuplicating 
}: EventDetailModalProps) {
  const { data: contactsMade } = useContactsByEvent(event?.id || null);
  const { data: contactStats } = useEventContactsCount();
  const updateEvent = useUpdateEvent();
  
  // Local state for optimistic UI updates
  const [attended, setAttended] = useState(event?.attended || false);
  
  // Sync local state when event prop changes
  useEffect(() => {
    setAttended(event?.attended || false);
  }, [event?.attended]);
  
  const eventStats = event?.id ? contactStats?.[event.id] : null;
  
  if (!event) return null;

  const handleAttendedChange = async (checked: boolean) => {
    // Optimistic update
    setAttended(checked);
    await updateEvent.mutateAsync({
      id: event.id,
      attended: checked,
    });
  };

  const getTypeBadge = (type: string | null) => {
    const styles: Record<string, string> = {
      'Distribution': 'bg-success/15 text-success',
      'Sign-up': 'bg-primary/15 text-primary',
      'Tabling': 'bg-info/15 text-info',
      'Workshop': 'bg-warning/15 text-warning',
      'Partner Event': 'bg-accent/15 text-accent',
    };
    return type ? (styles[type] || 'bg-muted text-muted-foreground') : 'bg-muted text-muted-foreground';
  };

  const getNarrativeValueBadge = (value: GrantNarrativeValue) => {
    const styles = {
      'High': 'text-success',
      'Medium': 'text-warning',
      'Low': 'text-muted-foreground'
    };
    return styles[value] || 'text-muted-foreground';
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      'High': 'bg-destructive/15 text-destructive',
      'Medium': 'bg-warning/15 text-warning',
      'Low': 'bg-muted text-muted-foreground'
    };
    return styles[priority] || 'bg-muted text-muted-foreground';
  };

  const getAnchorPotentialBadge = (potential: string) => {
    const styles: Record<string, string> = {
      'Extremely High': 'bg-primary/15 text-primary',
      'Very High': 'bg-success/15 text-success',
      'High': 'bg-info/15 text-info',
      'Medium': 'bg-muted text-muted-foreground'
    };
    return styles[potential] || 'bg-muted text-muted-foreground';
  };

  const hhPerStaff = (event.staff_deployed || 0) > 0 
    ? ((event.households_served || 0) / (event.staff_deployed || 1)).toFixed(1) 
    : '0';

  const generateMapsLink = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const ensureExternalUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        {/* Attended Banner */}
        <div 
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors",
            attended 
              ? "bg-success/10 border-success/50" 
              : "bg-destructive/10 border-destructive/50 hover:bg-destructive/15"
          )}
          onClick={() => handleAttendedChange(!attended)}
        >
          <Checkbox 
            checked={attended}
            onCheckedChange={handleAttendedChange}
            className={cn(
              "h-6 w-6",
              attended 
                ? "border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                : "border-destructive"
            )}
          />
          <span className={cn(
            "font-semibold text-lg",
            attended ? "text-success" : "text-destructive"
          )}>
            {attended ? "✓ Attended" : "Not Attended Yet"}
          </span>
        </div>

        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">{event.event_name}</DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={cn('font-medium', getTypeBadge(event.event_type))}>
                  {event.event_type}
                </Badge>
                {event.priority && (
                  <Badge className={cn('font-medium', getPriorityBadge(event.priority))}>
                    {event.priority} Priority
                  </Badge>
                )}
                {event.status && (
                  <Badge variant="outline">
                    {event.status}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {parseISO(event.event_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                  {event.end_date && event.end_date !== event.event_date && (
                    <>
                      {' — '}
                      {parseISO(event.end_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Location & Host */}
          <div className="space-y-2">
          {event.url && (
              <div className="flex items-center gap-2 text-sm">
                <Link className="w-4 h-4 text-muted-foreground" />
                <a 
                  href={ensureExternalUrl(event.url)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Event Page
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{event.metros?.metro || 'No metro assigned'}</span>
            </div>
            {event.city && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <span className="whitespace-pre-wrap">{event.city}</span>
                  <a 
                    href={generateMapsLink(event.city)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 ml-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Map
                  </a>
                </div>
              </div>
            )}
            {event.host_organization && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{event.host_organization}</span>
              </div>
            )}
            {event.travel_required && (
              <div className="flex items-center gap-2 text-sm">
                <Car className="w-4 h-4 text-muted-foreground" />
                <span>Travel: {event.travel_required}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{event.households_served || 0}</p>
              <p className="text-xs text-muted-foreground">Households</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Laptop className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl font-bold text-foreground">{event.devices_distributed || 0}</p>
              <p className="text-xs text-muted-foreground">Devices</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Wifi className="w-4 h-4 text-info" />
              </div>
              <p className="text-2xl font-bold text-foreground">{event.internet_signups || 0}</p>
              <p className="text-xs text-muted-foreground">Signups</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-4 h-4 text-warning" />
              </div>
              <p className="text-2xl font-bold text-foreground">{hhPerStaff}</p>
              <p className="text-xs text-muted-foreground">HH/Staff</p>
            </div>
          </div>

          {/* Contacts Made */}
          {contactsMade && contactsMade.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Contacts Made ({contactsMade.length})
                </div>
                {eventStats && eventStats.count > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-muted-foreground">
                      {eventStats.withOpportunity} converted 
                      <span className="text-success font-medium ml-1">
                        ({eventStats.conversionRate.toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {contactsMade.slice(0, 5).map((contact) => (
                  <Badge 
                    key={contact.id} 
                    variant={contact.opportunity_id ? "default" : "secondary"} 
                    className={cn("text-xs", contact.opportunity_id && "bg-success/15 text-success")}
                  >
                    {contact.name}
                    {contact.opportunities?.organization && (
                      <span className="text-success/70 ml-1">
                        → {contact.opportunities.organization}
                      </span>
                    )}
                  </Badge>
                ))}
                {contactsMade.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{contactsMade.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}
          {(event.expected_households || event.expected_referrals) && (
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 rounded-lg p-3">
              {event.expected_households && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Expected HH:</span>
                  <span className="font-medium">{event.expected_households}</span>
                </div>
              )}
              {event.expected_referrals && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Expected Referrals:</span>
                  <span className="font-medium">{event.expected_referrals}</span>
                </div>
              )}
            </div>
          )}

          {/* Target Population */}
          {event.target_populations && event.target_populations.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Target className="w-4 h-4 text-muted-foreground" />
                Target Population
              </div>
              <div className="flex flex-wrap gap-1">
                {event.target_populations.map((pop) => (
                  <Badge key={pop} variant="secondary" className="text-xs">
                    {pop}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Strategic Lanes */}
          {event.strategic_lanes && event.strategic_lanes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Compass className="w-4 h-4 text-muted-foreground" />
                Strategic Lane
              </div>
              <div className="flex flex-wrap gap-1">
                {event.strategic_lanes.map((lane) => (
                  <Badge key={lane} variant="outline" className="text-xs">
                    {lane}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* PCS Goals */}
          {event.pcs_goals && event.pcs_goals.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Flag className="w-4 h-4 text-muted-foreground" />
                PCS Goal
              </div>
              <div className="flex flex-wrap gap-1">
                {event.pcs_goals.map((goal) => (
                  <Badge key={goal} variant="secondary" className="text-xs bg-primary/10 text-primary">
                    {goal}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Staff Deployed:</span>
              <span className="font-medium">{event.staff_deployed || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Anchor Identified:</span>
              {event.anchor_identified_yn ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-muted" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Narrative Value:</span>
              <span className={cn('font-medium', getNarrativeValueBadge(event.grant_narrative_value as GrantNarrativeValue))}>
                {event.grant_narrative_value || 'Not set'}
              </span>
            </div>
            {event.anchor_potential && (
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Anchor Potential:</span>
                <Badge className={cn('font-medium', getAnchorPotentialBadge(event.anchor_potential))}>
                  {event.anchor_potential}
                </Badge>
              </div>
            )}
          </div>

          {/* ROI Breakdown Panel - only show for past events with actual data */}
          <ROIBreakdownPanel event={event} contactStats={eventStats} />

          {/* Note History */}
          <NoteHistoryPanel 
            entityType="event" 
            entityId={event.id} 
            className="pt-4 border-t border-border"
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={onDuplicate}
              disabled={isDuplicating}
            >
              <Copy className="w-4 h-4" />
              {isDuplicating ? 'Duplicating...' : 'Duplicate'}
            </Button>
            <Button className="gap-2" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
              Edit Event
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ROI Breakdown Panel Component
function ROIBreakdownPanel({ 
  event, 
  contactStats 
}: { 
  event: {
    id: string;
    event_date: string;
    households_served?: number | null;
    devices_distributed?: number | null;
    internet_signups?: number | null;
    anchor_identified_yn?: boolean | null;
    cost_estimated?: number | null;
    staff_deployed?: number | null;
  };
  contactStats?: { count: number; withOpportunity: number; conversionRate: number } | null;
}) {
  const isPastEvent = parseISO(event.event_date) < startOfToday();
  const hasActualData = (event.households_served || 0) > 0 || (event.devices_distributed || 0) > 0;
  
  const roiResult = useMemo(() => {
    if (!isPastEvent || !hasActualData) return null;
    return calculateEventROIWithStats(event, contactStats ?? undefined);
  }, [event, contactStats, isPastEvent, hasActualData]);
  
  if (!roiResult) return null;
  
  const roiStyle = getROICategoryStyle(roiResult.category);
  
  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Gauge className="w-4 h-4 text-muted-foreground" />
          Event ROI Score
        </div>
        <Badge className={cn('text-sm px-3 py-1 font-semibold', roiStyle.className)}>
          {roiResult.score} / 100 — {roiStyle.label}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-muted-foreground">Contacts Made</p>
          <p className="font-medium">{contactStats?.count ?? 0} × 2 = <span className="text-primary">{roiResult.breakdown.contactsPoints} pts</span></p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-muted-foreground">Conversions</p>
          <p className="font-medium">{contactStats?.withOpportunity ?? 0} × 5 = <span className="text-success">{roiResult.breakdown.conversionsPoints} pts</span></p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-muted-foreground">Households</p>
          <p className="font-medium">{event.households_served ?? 0} × 1 = <span className="text-primary">{roiResult.breakdown.householdsPoints} pts</span></p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-muted-foreground">Devices</p>
          <p className="font-medium">{event.devices_distributed ?? 0} × 1.5 = <span className="text-success">{roiResult.breakdown.devicesPoints} pts</span></p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-muted-foreground">Internet Signups</p>
          <p className="font-medium">{event.internet_signups ?? 0} × 2 = <span className="text-info">{roiResult.breakdown.signupsPoints} pts</span></p>
        </div>
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-muted-foreground">Anchor Bonus</p>
          <p className="font-medium">{event.anchor_identified_yn ? 'Yes' : 'No'} = <span className="text-warning">{roiResult.breakdown.anchorPoints} pts</span></p>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
        <span>Total Points: <span className="font-medium text-foreground">{roiResult.breakdown.totalPoints}</span></span>
        <span>÷ Cost per Staff Hour: <span className="font-medium text-foreground">${roiResult.breakdown.costPerStaffHour.toFixed(0)}</span></span>
        <span>= Normalized Score: <span className="font-medium text-foreground">{roiResult.score}</span></span>
      </div>
    </div>
  );
}
