import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, User, Building2, Star, RotateCcw, UserPlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventAttendee } from '@/types/event-planner';

interface AttendeeMatchCardProps {
  attendee: EventAttendee;
  onConfirmMatch?: () => void;
  onRejectMatch?: () => void;
  onToggleTarget?: () => void;
  onDismiss?: () => void;
  onRestore?: () => void;
  onCreateContact?: () => void;
  isCreatingContact?: boolean;
  showActions?: boolean;
}

export function AttendeeMatchCard({ 
  attendee, 
  onConfirmMatch, 
  onRejectMatch, 
  onToggleTarget,
  onDismiss,
  onRestore,
  onCreateContact,
  isCreatingContact,
  showActions = true 
}: AttendeeMatchCardProps) {
  const confidencePercent = Math.round((attendee.confidence_score || 0) * 100);
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{attendee.raw_full_name}</span>
              {attendee.is_target && (
                <Star className="w-4 h-4 text-warning fill-warning" />
              )}
            </div>
            
            {attendee.raw_org && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building2 className="w-3 h-3" />
                <span className="truncate">{attendee.raw_org}</span>
              </div>
            )}
            
            {attendee.raw_title && (
              <p className="text-xs text-muted-foreground truncate">{attendee.raw_title}</p>
            )}
            
            {attendee.raw_email && (
              <p className="text-xs text-muted-foreground truncate">{attendee.raw_email}</p>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {attendee.match_status === 'possible' && (
              <Badge 
                variant="outline" 
                className={cn(
                  'text-xs',
                  confidencePercent >= 80 ? 'bg-success/10 text-success' :
                  confidencePercent >= 50 ? 'bg-warning/10 text-warning' :
                  'bg-muted text-muted-foreground'
                )}
              >
                {confidencePercent}% match
              </Badge>
            )}
            
            {attendee.match_status === 'matched' && (
              <Badge className="bg-success/10 text-success">
                Matched
              </Badge>
            )}
            
            {attendee.match_status === 'new' && (
              <Badge variant="secondary">New</Badge>
            )}
            
            {attendee.match_status === 'dismissed' && (
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                Dismissed
              </Badge>
            )}
            
            {attendee.target_score > 0 && (
              <Badge variant="outline" className="text-xs">
                Score: {attendee.target_score}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Matched contact info */}
        {attendee.matched_contact && (
          <div className="mt-3 p-2 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-primary" />
              <span className="font-medium">{attendee.matched_contact.name}</span>
              {attendee.matched_opportunity && (
                <span className="text-muted-foreground">
                  → {attendee.matched_opportunity.organization}
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Actions */}
        {showActions && (
          <div className="mt-3 flex items-center gap-2">
            {attendee.match_status === 'possible' && (
              <>
                <Button size="sm" variant="outline" onClick={onConfirmMatch} className="gap-1">
                  <Check className="w-3 h-3" />
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={onRejectMatch} className="gap-1">
                  <X className="w-3 h-3" />
                  Not a Match
                </Button>
              </>
            )}
            
            {/* Dismiss action for new/unmatched attendees */}
            {onDismiss && (attendee.match_status === 'new' || attendee.match_status === 'unmatched') && (
              <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-1">
                <X className="w-3 h-3" />
                Dismiss
              </Button>
            )}
            
            {/* Create contact from new/unmatched attendee */}
            {onCreateContact && !attendee.matched_contact_id && (attendee.match_status === 'new' || attendee.match_status === 'unmatched') && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onCreateContact}
                disabled={isCreatingContact}
                className="gap-1"
              >
                {isCreatingContact ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <UserPlus className="w-3 h-3" />
                )}
                Create Contact
              </Button>
            )}
            
            {/* Restore action for dismissed attendees */}
            {onRestore && attendee.match_status === 'dismissed' && (
              <Button size="sm" variant="outline" onClick={onRestore} className="gap-1">
                <RotateCcw className="w-3 h-3" />
                Restore
              </Button>
            )}
            
            {onToggleTarget && (
              <Button 
                size="sm" 
                variant={attendee.is_target ? "default" : "outline"} 
                onClick={onToggleTarget}
                className="gap-1 ml-auto"
              >
                <Star className={cn("w-3 h-3", attendee.is_target && "fill-current")} />
                {attendee.is_target ? 'Target' : 'Mark Target'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
