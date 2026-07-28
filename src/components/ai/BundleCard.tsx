import { useState, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Camera, MessageSquare, FileText, Loader2 } from 'lucide-react';
import { BundleSuggestionRow } from './BundleSuggestionRow';
import { formatDistanceToNow } from 'date-fns';
import type { AIBundle, ApproveBundleRequest } from '@/hooks/useAIBundles';

/** Decode HTML entities like &#39; -> ' */
function decodeHtmlEntities(text: string): string {
  if (typeof document === 'undefined') return text;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  email_analysis: Mail,
  ocr: Camera,
  chat: MessageSquare,
  manual: FileText,
};

const SOURCE_LABELS: Record<string, string> = {
  email_analysis: 'Email',
  ocr: 'Business Card',
  chat: 'Chat',
  manual: 'Manual Entry',
};

interface BundleCardProps {
  bundle: AIBundle;
  onApprove: (request: ApproveBundleRequest) => void;
  onDismiss: (source_id: string) => void;
  onEditSuggestion: (suggestionId: string) => void;
  isApproving?: boolean;
  isDismissing?: boolean;
}

export function BundleCard({
  bundle,
  onApprove,
  onDismiss,
  onEditSuggestion,
  isApproving = false,
  isDismissing = false,
}: BundleCardProps) {
  // Track which suggestions are selected (default all checked)
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    bundle.suggestions.forEach(s => {
      initial[s.id] = true;
    });
    return initial;
  });
  
  const Icon = SOURCE_ICONS[bundle.source] || FileText;
  const sourceLabel = SOURCE_LABELS[bundle.source] || bundle.source;
  
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected = selectedCount === bundle.suggestions.length;
  const someSelected = selectedCount > 0 && !allSelected;
  
  // Find dependencies and check if parent is unchecked
  const dependencyMap = useMemo(() => {
    const map: Record<string, { missing: boolean; name: string }> = {};
    
    for (const sugg of bundle.suggestions) {
      if (sugg.depends_on_suggestion_id) {
        const parent = bundle.suggestions.find(s => s.id === sugg.depends_on_suggestion_id);
        if (parent) {
          map[sugg.id] = {
            missing: !selected[parent.id],
            name: parent.suggested_name || 'contact',
          };
        }
      }
    }
    
    return map;
  }, [bundle.suggestions, selected]);
  
  const toggleAll = () => {
    const newValue = !allSelected;
    const updated: Record<string, boolean> = {};
    bundle.suggestions.forEach(s => {
      updated[s.id] = newValue;
    });
    setSelected(updated);
  };
  
  const handleApprove = () => {
    const approvals = bundle.suggestions.map(s => ({
      suggestion_id: s.id,
      include: selected[s.id] || false,
    }));
    
    onApprove({
      source_id: bundle.source_id,
      approvals,
    });
  };
  
  const handleDismiss = () => {
    onDismiss(bundle.source_id);
  };
  
  // Extract source preview (email sender, etc.)
  const sourcePreview = useMemo(() => {
    const firstSugg = bundle.suggestions[0];
    if (bundle.source === 'email_analysis' && firstSugg?.sender_email) {
      return firstSugg.sender_email;
    }
    return null;
  }, [bundle]);
  
  const timeAgo = formatDistanceToNow(new Date(bundle.created_at), { addSuffix: true });
  
  const isLoading = isApproving || isDismissing;
  
  return (
    <Card className="overflow-hidden" data-tour="bundle-card">
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-sm truncate">
              {sourcePreview || sourceLabel}
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{timeAgo}</span>
        </div>
        
        {bundle.source_snippet && (
          <p className="text-xs text-muted-foreground line-clamp-2 italic">
            "{decodeHtmlEntities(bundle.source_snippet)}"
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-2 pb-3" data-tour="bundle-detail">
        {bundle.suggestions.map(suggestion => (
          <BundleSuggestionRow
            key={suggestion.id}
            suggestion={suggestion}
            checked={selected[suggestion.id] || false}
            onCheckedChange={(checked) => {
              setSelected(prev => ({ ...prev, [suggestion.id]: checked }));
            }}
            onEdit={() => onEditSuggestion(suggestion.id)}
            dependencyMissing={dependencyMap[suggestion.id]?.missing}
            dependencyName={dependencyMap[suggestion.id]?.name}
          />
        ))}
      </CardContent>
      
      <CardFooter className="flex items-center justify-between gap-2 pt-0 pb-3 px-4 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`select-all-${bundle.source_id}`}
            checked={allSelected}
            // @ts-expect-error indeterminate is valid but not in types
            indeterminate={someSelected}
            onCheckedChange={toggleAll}
          />
          <label 
            htmlFor={`select-all-${bundle.source_id}`}
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Select all
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={isLoading}
          >
            {isDismissing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Dismiss All
          </Button>
          
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={selectedCount === 0 || isLoading}
            data-tour="bundle-approve"
          >
            {isApproving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Approve{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
