import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { User, ListTodo, Bell, Activity, Pencil, AlertTriangle, Building2 } from 'lucide-react';
import { ConfidenceBadge } from './ConfidenceBadge';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AISuggestion = Database['public']['Tables']['ai_suggestions']['Row'];

const TYPE_ICONS: Record<string, React.ElementType> = {
  new_contact: User,
  new_opportunity: Building2,
  activity: Activity,
  task: ListTodo,
  followup: Bell,
};

const TYPE_LABELS: Record<string, string> = {
  new_contact: 'Create Contact',
  new_opportunity: 'Create Organization',
  activity: 'Log Activity',
  task: 'Create Task',
  followup: 'Follow-up',
};

interface BundleSuggestionRowProps {
  suggestion: AISuggestion;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onEdit: () => void;
  dependencyMissing?: boolean;
  dependencyName?: string;
}

export function BundleSuggestionRow({
  suggestion,
  checked,
  onCheckedChange,
  onEdit,
  dependencyMissing = false,
  dependencyName,
}: BundleSuggestionRowProps) {
  const Icon = TYPE_ICONS[suggestion.suggestion_type] || ListTodo;
  const typeLabel = TYPE_LABELS[suggestion.suggestion_type] || suggestion.suggestion_type;
  
  // Build title and subtitle based on type
  let title = '';
  let subtitle = '';
  
  if (suggestion.suggestion_type === 'new_contact') {
    title = suggestion.suggested_name || 'Unknown Contact';
    const parts = [];
    if (suggestion.suggested_email) parts.push(suggestion.suggested_email);
    if (suggestion.suggested_title) parts.push(suggestion.suggested_title);
    subtitle = parts.join(' · ');
  } else if (suggestion.suggestion_type === 'new_opportunity') {
    title = suggestion.suggested_organization || 'Unknown Organization';
    const parts = [];
    if (suggestion.task_title) parts.push(`Stage: ${suggestion.task_title}`);
    subtitle = parts.join(' · ');
  } else if (suggestion.suggestion_type === 'task') {
    title = suggestion.task_title || 'Untitled Task';
    const parts = [];
    if (suggestion.task_due_date) {
      parts.push(`Due: ${new Date(suggestion.task_due_date).toLocaleDateString()}`);
    }
    if (suggestion.task_priority) {
      parts.push(`Priority: ${suggestion.task_priority}`);
    }
    subtitle = parts.join(' · ');
  } else if (suggestion.suggestion_type === 'followup') {
    title = suggestion.followup_reason || 'Follow-up';
    if (suggestion.task_due_date) {
      subtitle = `Due: ${new Date(suggestion.task_due_date).toLocaleDateString()}`;
    }
  } else if (suggestion.suggestion_type === 'activity') {
    title = 'Log Activity';
    subtitle = suggestion.ai_reasoning || '';
  }
  
  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border bg-card transition-colors",
        checked ? "border-primary/30 bg-primary/5" : "border-border",
        dependencyMissing && checked && "border-warning/50 bg-warning/5"
      )}
    >
      <Checkbox
        id={`sugg-${suggestion.id}`}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-1"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground">{typeLabel}</span>
          {suggestion.confidence_score && (
            <ConfidenceBadge score={suggestion.confidence_score} />
          )}
        </div>
        
        <p className="font-medium text-sm truncate">{title}</p>
        
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
        
        {dependencyMissing && checked && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 mt-1 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Requires {dependencyName || 'contact'}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>This action depends on the contact being approved first</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" />
        <span className="sr-only">Edit</span>
      </Button>
    </div>
  );
}
