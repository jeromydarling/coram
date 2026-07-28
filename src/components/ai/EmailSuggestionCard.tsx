import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfidenceBadge } from './ConfidenceBadge';
import { Check, X, User, ListTodo, ArrowRight, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Decode HTML entities like &#39; -> ' */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

interface Suggestion {
  id: string;
  suggestion_type: string;
  suggested_name?: string | null;
  suggested_email?: string | null;
  suggested_organization?: string | null;
  task_title?: string | null;
  task_due_date?: string | null;
  followup_reason?: string | null;
  confidence_score?: number | null;
  ai_reasoning?: string | null;
  source_snippet?: string | null;
  status: string;
  linked_contact_id?: string | null;
  linked_contact?: {
    id: string;
    name: string;
    opportunity_id: string | null;
    opportunities?: {
      id: string;
      organization: string;
    } | null;
  } | null;
}

interface EmailSuggestionCardProps {
  suggestion: Suggestion;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
  isApproving?: boolean;
  isDismissing?: boolean;
  showActions?: boolean;
}

export function EmailSuggestionCard({
  suggestion,
  onApprove,
  onDismiss,
  isApproving,
  isDismissing,
  showActions = suggestion.status === 'pending'
}: EmailSuggestionCardProps) {
  const getTypeIcon = () => {
    switch (suggestion.suggestion_type) {
      case 'new_contact':
        return <User className="h-4 w-4" />;
      case 'task':
        return <ListTodo className="h-4 w-4" />;
      case 'followup':
        return <ArrowRight className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };
  
  const getTypeLabel = () => {
    switch (suggestion.suggestion_type) {
      case 'new_contact':
        return 'New Contact';
      case 'task':
        return 'Task';
      case 'followup':
        return 'Follow-up';
      case 'stage_change':
        return 'Stage Update';
      default:
        return 'Suggestion';
    }
  };
  
  const getTitle = () => {
    switch (suggestion.suggestion_type) {
      case 'new_contact':
        return suggestion.suggested_name || 'Unknown Contact';
      case 'task':
        return suggestion.task_title || 'New Task';
      case 'followup':
        return `Follow up: ${suggestion.followup_reason || 'Contact'}`;
      default:
        return 'Suggestion';
    }
  };
  
  const getSubtitle = () => {
    switch (suggestion.suggestion_type) {
      case 'new_contact':
        return [suggestion.suggested_email, suggestion.suggested_organization]
          .filter(Boolean)
          .join(' • ') || 'No additional info';
      case 'task':
      case 'followup':
        // Show contact and organization context for tasks
        const contactName = suggestion.linked_contact?.name;
        const organization = suggestion.linked_contact?.opportunities?.organization || suggestion.suggested_organization;
        if (contactName && organization) {
          return `For: ${contactName} · ${organization}`;
        } else if (contactName) {
          return `For: ${contactName}`;
        } else if (organization) {
          return `For: ${organization}`;
        }
        return suggestion.ai_reasoning || '';
      default:
        return '';
    }
  };
  
  const isProcessing = isApproving || isDismissing;
  
  return (
    <Card className={cn(
      "transition-opacity overflow-hidden w-full max-w-full",
      isProcessing && "opacity-50"
    )}>
      <CardContent className="p-4">
        <div className="flex w-full max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
          <div className="flex w-full min-w-0 items-start gap-3">
          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
            suggestion.suggestion_type === 'new_contact' && "bg-primary/10 text-primary",
            suggestion.suggestion_type === 'task' && "bg-warning/10 text-warning",
            suggestion.suggestion_type === 'followup' && "bg-info/10 text-info"
          )}>
            {getTypeIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                {getTypeLabel()}
              </Badge>
              {suggestion.confidence_score && (
                <ConfidenceBadge score={suggestion.confidence_score} />
              )}
            </div>
            
            <h4 className="font-medium truncate">{getTitle()}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {getSubtitle()}
            </p>
            
            {suggestion.source_snippet && (
              <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded italic line-clamp-2">
                "{decodeHtmlEntities(suggestion.source_snippet)}"
              </p>
            )}
          </div>
          </div>
          
           {showActions && (
            <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto sm:justify-start">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => onDismiss(suggestion.id)}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-success hover:bg-success/10"
                onClick={() => onApprove(suggestion.id)}
                disabled={isProcessing}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
