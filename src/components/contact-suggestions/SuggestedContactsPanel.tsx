import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UserPlus, X, Mail, Phone, ExternalLink, Loader2, Users, Pencil, Check, ChevronDown } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface SuggestedContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  source_url?: string | null;
  confidence?: number | null;
}

interface ContactSuggestionRow {
  id: string;
  run_id: string;
  entity_type: string;
  entity_id: string;
  source_url: string;
  suggestions: SuggestedContact[];
  status: string;
  applied_indices: number[];
  dismissed_at: string | null;
  created_at: string;
}

interface SuggestedContactsPanelProps {
  entityType: 'event' | 'opportunity' | 'grant';
  entityId: string;
}

interface EditState {
  name: string;
  email: string;
  phone: string;
  title: string;
}

export function SuggestedContactsPanel({ entityType, entityId }: SuggestedContactsPanelProps) {
  const queryClient = useQueryClient();
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const [isBulkApplying, setIsBulkApplying] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6);
  const [showBelowThreshold, setShowBelowThreshold] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: '', email: '', phone: '', title: '' });

  const queryKey = ['contact-suggestions', entityType, entityId];

  const { data: response, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return null;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-suggestions-get?entity_type=${entityType}&entity_id=${entityId}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) return null;
      return await res.json() as {
        ok: boolean;
        suggestions: ContactSuggestionRow[];
        default_confidence_threshold: number;
      };
    },
    enabled: !!entityId,
    staleTime: 30_000,
  });

  // Fetch actual contacts for this entity to cross-check applied status
  const { data: existingContacts } = useQuery({
    queryKey: ['contacts', entityType, entityId],
    queryFn: async () => {
      if (entityType !== 'opportunity') return [];
      const { data } = await supabase
        .from('contacts')
        .select('name, email')
        .eq('opportunity_id', entityId);
      return data || [];
    },
    enabled: !!entityId,
    staleTime: 30_000,
  });

  const existingContactSet = new Set(
    (existingContacts || []).map((c) => (c.name || '').toLowerCase().trim())
  );

  const suggestionRows = response?.suggestions || [];

  const applyMutation = useMutation({
    mutationFn: async ({ suggestionIndex, override }: { suggestionIndex: number; override?: Partial<EditState> }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-suggestions-apply`;
      const payload: Record<string, unknown> = {
        entity_type: entityType,
        entity_id: entityId,
        suggestion_index: suggestionIndex,
      };
      if (override) payload.override = override;

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!result.ok) throw new Error(result.error || 'Apply failed');
      return result;
    },
    onSuccess: (result) => {
      if (result.created) {
        toast.success('Contact added successfully');
      } else {
        toast.info(result.reason === 'duplicate' ? 'Contact already exists' : (result.reason || 'Already applied'));
      }
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => {
      setApplyingIndex(null);
      setEditingIndex(null);
    },
  });

  const bulkApplyMutation = useMutation({
    mutationFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-suggestions-apply-bulk`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          min_confidence: confidenceThreshold,
        }),
      });

      const result = await res.json();
      if (!result.ok) throw new Error(result.error || 'Bulk apply failed');
      return result;
    },
    onSuccess: (result) => {
      const msg = `Added ${result.created_count} contact(s)`;
      const parts = [msg];
      if (result.skipped_duplicate > 0) parts.push(`${result.skipped_duplicate} duplicate(s) skipped`);
      if (result.skipped_applied > 0) parts.push(`${result.skipped_applied} already applied`);
      toast.success(parts.join(', '));
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setIsBulkApplying(false),
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-suggestions-dismiss`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
      });

      const result = await res.json();
      if (!result.ok) throw new Error(result.error || 'Dismiss failed');
      return result;
    },
    onSuccess: () => {
      toast.success('Suggestions dismissed');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setIsDismissing(false),
  });

  const startEdit = useCallback((contact: SuggestedContact, idx: number) => {
    setEditingIndex(idx);
    setEditState({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      title: contact.title || '',
    });
  }, []);

  const handleApplyWithEdit = useCallback((idx: number) => {
    const override = editingIndex === idx ? {
      name: editState.name || undefined,
      email: editState.email || undefined,
      phone: editState.phone || undefined,
      title: editState.title || undefined,
    } : undefined;

    setApplyingIndex(idx);
    applyMutation.mutate({ suggestionIndex: idx, override });
  }, [editingIndex, editState, applyMutation]);

  // Flatten ready rows
  const readyRows = suggestionRows.filter((r) => r.status === 'ready');
  const appliedRows = suggestionRows.filter((r) => r.status === 'applied');
  const isAllApplied = appliedRows.length > 0 && readyRows.length === 0;
  const isDismissedAll = suggestionRows.length > 0 && readyRows.length === 0 && appliedRows.length === 0;

  // Build flat suggestion list from ready rows
  const allSuggestions: { contact: SuggestedContact; globalIndex: number; sourceUrl: string; isApplied: boolean }[] = [];
  readyRows.forEach((row) => {
    if (Array.isArray(row.suggestions)) {
      const appliedIndices = row.applied_indices || [];
      row.suggestions.forEach((contact, idx) => {
        // Cross-check: only mark as applied if the contact actually exists
        const markedApplied = appliedIndices.includes(idx);
        const actuallyExists = markedApplied && contact.name 
          ? existingContactSet.has(contact.name.toLowerCase().trim())
          : false;
        allSuggestions.push({
          contact,
          globalIndex: idx,
          sourceUrl: contact.source_url || row.source_url,
          isApplied: actuallyExists,
        });
      });
    }
  });

  // Filter by confidence
  const filteredSuggestions = allSuggestions.filter((item) => {
    if (item.isApplied) return true; // always show applied
    if (showBelowThreshold) return true;
    const conf = item.contact.confidence;
    if (conf === null || conf === undefined) return true; // no confidence = show
    return conf >= confidenceThreshold;
  });

  const aboveThresholdCount = allSuggestions.filter((item) => {
    if (item.isApplied) return false;
    const conf = item.contact.confidence;
    if (conf === null || conf === undefined) return true;
    return conf >= confidenceThreshold;
  }).length;

  if (!isLoading && (!suggestionRows || suggestionRows.length === 0)) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Suggested Contacts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading suggestions...
          </div>
        ) : isAllApplied ? (
          <div className="text-sm text-muted-foreground py-2">
            <Badge variant="secondary" className="bg-green-500/15 text-green-600">Applied</Badge>
            <span className="ml-2">All contact suggestions have been applied.</span>
          </div>
        ) : isDismissedAll ? (
          <p className="text-sm text-muted-foreground py-2">Suggestions were dismissed.</p>
        ) : allSuggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No suggested contacts found.</p>
        ) : (
          <div className="space-y-4">
            {/* Confidence filter */}
            {allSuggestions.some((s) => s.contact.confidence !== null && s.contact.confidence !== undefined) && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Confidence threshold: {(confidenceThreshold * 100).toFixed(0)}%
                  </Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="show-below" className="text-xs text-muted-foreground">Show below</Label>
                    <Switch
                      id="show-below"
                      checked={showBelowThreshold}
                      onCheckedChange={setShowBelowThreshold}
                    />
                  </div>
                </div>
                <Slider
                  value={[confidenceThreshold]}
                  onValueChange={([v]) => setConfidenceThreshold(v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>
            )}

            {/* Suggestion cards */}
            {filteredSuggestions.map((item, i) => {
              const isEditing = editingIndex === item.globalIndex;
              const isApplying = applyingIndex === item.globalIndex;
              const belowThreshold = item.contact.confidence !== null &&
                item.contact.confidence !== undefined &&
                item.contact.confidence < confidenceThreshold;

              return (
                <div
                  key={i}
                  className={`p-3 rounded-lg border transition-colors ${
                    item.isApplied
                      ? 'bg-green-500/5 border-green-500/20'
                      : belowThreshold
                        ? 'bg-muted/10 border-border/30 opacity-60'
                        : 'bg-muted/30 border-border/50'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Name"
                          value={editState.name}
                          onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="Title"
                          value={editState.title}
                          onChange={(e) => setEditState((s) => ({ ...s, title: e.target.value }))}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="Email"
                          value={editState.email}
                          onChange={(e) => setEditState((s) => ({ ...s, email: e.target.value }))}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="Phone"
                          value={editState.phone}
                          onChange={(e) => setEditState((s) => ({ ...s, phone: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={isApplying}
                          onClick={() => handleApplyWithEdit(item.globalIndex)}
                        >
                          {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Save & Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingIndex(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {item.contact.name || 'Unknown'}
                          </span>
                          {item.contact.confidence !== null && item.contact.confidence !== undefined && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                item.contact.confidence >= 0.8
                                  ? 'border-green-500/50 text-green-600'
                                  : item.contact.confidence >= 0.5
                                    ? 'border-yellow-500/50 text-yellow-600'
                                    : 'border-red-500/50 text-red-500'
                              }`}
                            >
                              {(item.contact.confidence * 100).toFixed(0)}%
                            </Badge>
                          )}
                          {item.isApplied && (
                            <Badge variant="secondary" className="text-[10px] bg-green-500/15 text-green-600">
                              Added
                            </Badge>
                          )}
                        </div>
                        {item.contact.title && (
                          <p className="text-xs text-muted-foreground">
                            {item.contact.title}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {item.contact.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {item.contact.email}
                            </span>
                          )}
                          {item.contact.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {item.contact.phone}
                            </span>
                          )}
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Source
                            </a>
                          )}
                        </div>
                      </div>
                      {!item.isApplied && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => startEdit(item.contact, item.globalIndex)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={isApplying}
                            onClick={() => {
                              setApplyingIndex(item.globalIndex);
                              applyMutation.mutate({ suggestionIndex: item.globalIndex });
                            }}
                          >
                            {isApplying ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            Add
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bulk actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              {aboveThresholdCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={isBulkApplying || bulkApplyMutation.isPending}
                  onClick={() => {
                    setIsBulkApplying(true);
                    bulkApplyMutation.mutate();
                  }}
                >
                  {bulkApplyMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  Add All Above Threshold ({aboveThresholdCount})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                disabled={isDismissing || dismissMutation.isPending}
                onClick={() => {
                  setIsDismissing(true);
                  dismissMutation.mutate();
                }}
              >
                {dismissMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                Dismiss all
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
