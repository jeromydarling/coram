import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import {
  Search,
  Loader2,
  ExternalLink,
  Plus,
  MapPin,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Eye,
  ShieldAlert,
  Bookmark,
  Sparkles,
  History,
  EyeOff,
  Mail,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Users,
  Waves,
} from 'lucide-react';
import { useMutation as useReactMutation } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTenantTerritories, getScopeLabel } from '@/hooks/useTenantTerritories';
import { useTenant } from '@/contexts/TenantContext';
import {
  useIntentProfile,
  checkBlockedPatternsClient,
  buildEnforcedQueryPreview,
  ROLE_FOCUS_OPTIONS,
  buildCustomRoleBias,
  SAMPLE_PHRASES_METRO,
  SAMPLE_PHRASES_NATIONAL,
} from '@/hooks/useIntentProfile';
import { SavedSearchesPanel } from './SavedSearchesPanel';
import { SearchBriefCard } from './SearchBriefCard';
import { SuggestedSegments, type Segment } from './SuggestedSegments';
import { SearchMemoryBanner } from './SearchMemoryBanner';
import { Checkbox } from '@/components/ui/checkbox';
import { useDiscoverySignal } from '@/hooks/useDiscoverySignal';

import {
  useCreateSavedSearch,
  useSavedSearchResults,
  useMarkSeen,
} from '@/hooks/useSavedSearches';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const ENTITY_LABELS: Record<string, { singular: string; plural: string; icon: typeof Calendar }> = {
  event: { singular: 'Event', plural: 'Events', icon: Calendar },
  opportunity: { singular: 'Organization', plural: 'Organizations', icon: Building2 },
  people: { singular: 'Person', plural: 'People', icon: Building2 },
  grant: { singular: 'Grant', plural: 'Grants', icon: Building2 },
};

// Module name mapping for saved searches (plural form)
const SEARCH_TYPE_TO_MODULE: Record<string, string> = {
  event: 'events',
  opportunity: 'opportunities',
  people: 'people',
  grant: 'grants',
};

// Explicit workflow key mapping — no string concatenation
const SEARCH_TYPE_TO_WORKFLOW_KEY: Record<string, string> = {
  event: 'search_events',
  opportunity: 'search_opportunities',
  people: 'search_people',
  grant: 'search_grants',
};

interface SearchResult {
  id: string;
  result_index: number;
  title: string;
  description: string | null;
  url: string | null;
  source: string | null;
  location: string | null;
  date_info: string | null;
  organization: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  confidence: number | null;
  entity_created: boolean;
  created_entity_id: string | null;
  is_new?: boolean;
  raw_data: Record<string, unknown> | null;
  matched_keywords?: string[];
  resonance_annotation?: string | null;
}

interface SearchBrief {
  summary: string;
  what_we_found: string[];
  what_may_be_missing: string[];
  helpful_sites: { name: string; url: string; why: string }[];
  suggested_queries: string[];
  confidence: number | null;
  caveats: string[];
}

interface SearchRun {
  id: string;
  run_id: string;
  query: string;
  raw_query: string | null;
  enforced_query: string | null;
  status: string;
  result_count: number;
  error_message: string | null;
  created_at: string;
  search_brief: SearchBrief | null;
  merged_results_count: number | null;
  prior_runs_merged: number | null;
}

interface CreateFormData {
  name: string;
  description: string;
  url: string;
  location: string;
  organization: string;
  contact_name: string;
  contact_email: string;
  // Grant-specific fields from raw_data
  grant_amount: string;
  grant_deadline: string;
  grant_eligibility: string;
}

interface FindPageProps {
  searchType: 'event' | 'opportunity' | 'grant' | 'people';
  noLayout?: boolean;
}

export function FindPage({ searchType, noLayout }: FindPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const labels = ENTITY_LABELS[searchType];
  const module = SEARCH_TYPE_TO_MODULE[searchType];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState<string>('all');
  // Legacy alias for downstream references
  const selectedMetro = selectedTerritory;

  // Persist selectedRunId and activeSavedSearchId in URL params
  const selectedRunId = searchParams.get('run') || null;
  const activeSavedSearchId = searchParams.get('saved') || null;

  const setSelectedRunId = useCallback((runId: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (runId) next.set('run', runId);
      else next.delete('run');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setActiveSavedSearchId = useCallback((savedId: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (savedId) next.set('saved', savedId);
      else next.delete('saved');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [showEnforcedPreview, setShowEnforcedPreview] = useState(false);
  const [roleFocus, setRoleFocus] = useState<string>('none');
  const [customRoleText, setCustomRoleText] = useState('');
  const [createFormData, setCreateFormData] = useState<CreateFormData>({
    name: '', description: '', url: '', location: '', organization: '', contact_name: '', contact_email: '',
    grant_amount: '', grant_deadline: '', grant_eligibility: '',
  });
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeSegmentKey, setActiveSegmentKey] = useState<string | null>(null);

  const { tenant } = useTenant();
  const { data: activatedTerritories } = useTenantTerritories();
  const scopeLabels = getScopeLabel(tenant?.archetype);
  const isCaregiverSolo = tenant?.archetype === 'caregiver_solo';
  const { data: profile } = useIntentProfile(searchType);
  const queryClient = useQueryClient();
  const createSavedSearch = useCreateSavedSearch();
  const markSeen = useMarkSeen();
  const { emit: emitSignal, signalledResults } = useDiscoverySignal({ searchType });

  // Compute blocked pattern warning + enforced query preview
  const blockedWarning = useMemo(() => {
    if (!profile || !searchQuery.trim()) return null;
    return checkBlockedPatternsClient(searchQuery, profile.blocked_patterns);
  }, [searchQuery, profile]);

  /** Territory-aware scope name (replaces selectedMetroName) */
  const selectedTerritoryName = useMemo(() => {
    if (selectedTerritory === 'all' || !activatedTerritories) return null;
    const t = activatedTerritories.find(t => t.territory_id === selectedTerritory);
    return t?.name || null;
  }, [selectedTerritory, activatedTerritories]);
  // Legacy alias for downstream references
  const selectedMetroName = selectedTerritoryName;

  // Compute role bias clause (opportunity only)
  const roleBiasClause = useMemo(() => {
    if (searchType !== 'opportunity') return null;
    if (roleFocus === 'none') return null;
    if (roleFocus === 'custom') return buildCustomRoleBias(customRoleText);
    const opt = ROLE_FOCUS_OPTIONS.find(o => o.key === roleFocus);
    return opt?.clause ?? null;
  }, [searchType, roleFocus, customRoleText]);

  const enforcedPreview = useMemo(() => {
    if (!profile || !searchQuery.trim()) return '';
    return buildEnforcedQueryPreview(searchQuery.trim(), profile, selectedMetroName, roleBiasClause);
  }, [searchQuery, profile, selectedMetroName, roleBiasClause]);

  // Intent pills
  const intentPills = useMemo(() => {
    if (!profile) return [];
    const pills: { label: string; type: 'required' | 'any' }[] = [];
    for (const kw of profile.required_all) {
      pills.push({ label: kw, type: 'required' });
    }
    for (const kw of profile.required_any) {
      pills.push({ label: kw, type: 'any' });
    }
    return pills;
  }, [profile]);

  // Fetch recent search runs for this type
  const { data: searchRuns, isLoading: runsLoading } = useQuery({
    queryKey: ['search-runs', searchType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('search_runs')
        .select('*')
        .eq('search_type', searchType)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as unknown as SearchRun[];
    },
    refetchInterval: (query) => {
      // Poll every 3s while there's an active (pending/running) search
      const runs = query.state.data;
      const hasActive = runs?.some((r: SearchRun) => r.status === 'pending' || r.status === 'running');
      return hasActive ? 3000 : false;
    },
  });

  // Fetch results for selected run (normal mode, not saved search)
  const activeRunDbId = searchRuns?.find(r => r.run_id === selectedRunId)?.id ?? null;
  const { data: searchResults, isLoading: resultsLoading } = useQuery({
    queryKey: ['search-results', selectedRunId, activeRunDbId],
    queryFn: async () => {
      if (!selectedRunId || activeSavedSearchId || !activeRunDbId) return [];
      const { data, error } = await supabase
        .from('search_results')
        .select('*')
        .eq('search_run_id', activeRunDbId)
        .order('result_index', { ascending: true });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        matched_keywords: r.raw_data?.matched_keywords || undefined,
        resonance_annotation: r.raw_data?.resonance_annotation || null,
      })) as SearchResult[];
    },
    enabled: !!selectedRunId && !activeSavedSearchId && !!activeRunDbId,
    refetchInterval: () => {
      const run = searchRuns?.find(r => r.run_id === selectedRunId);
      return run?.status === 'pending' || run?.status === 'running' ? 3000 : false;
    },
  });

  // Fetch saved search results (with is_new annotations)
  const { data: savedSearchResultsData } = useSavedSearchResults(
    activeSavedSearchId ? selectedRunId : null,
    activeSavedSearchId,
  );

  // Determine which results to display
  const displayResults: SearchResult[] = activeSavedSearchId
    ? (savedSearchResultsData?.results || [])
    : (searchResults || []);
  const newCount = savedSearchResultsData?.summary?.new_count ?? 0;
  const totalCount = savedSearchResultsData?.summary?.total ?? displayResults.length;

  // Dispatch search mutation
  const dispatchSearch = useMutation({
    mutationFn: async () => {
      if (!searchQuery.trim()) throw new Error('Enter a search query');
      if (blockedWarning) throw new Error(`Query contains disallowed pattern: "${blockedWarning}"`);

      const workflowKey = SEARCH_TYPE_TO_WORKFLOW_KEY[searchType];
      if (!workflowKey) throw new Error(`Unknown search type: ${searchType}`);
      const { data, error } = await supabase.functions.invoke('n8n-dispatch', {
        body: {
          workflow_key: workflowKey,
          query: searchQuery.trim(),
          search_type: searchType,
          // Pass both territory_id and metro_id for backward compat with n8n workflows
          ...(selectedTerritory !== 'all' ? {
            territory_id: selectedTerritory,
            metro_id: activatedTerritories?.find(t => t.territory_id === selectedTerritory)?.metro_id || selectedTerritory,
          } : {}),
        },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; run_id?: string; message?: string; error?: string };
      if (!result?.ok) {
        throw new Error(result?.message || result?.error || 'Search dispatch failed');
      }
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Search dispatched — run ${result.run_id?.slice(0, 8)}…`);
      // Set both params atomically to avoid double history entries
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (result.run_id) next.set('run', result.run_id);
        else next.delete('run');
        next.delete('saved');
        return next;
      }, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['search-runs', searchType] });
    },
    onError: (err) => {
      toast.error('Search failed. Please try again.', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  // Create entity mutation
  const createEntity = useMutation({
    mutationFn: async () => {
      if (!createFormData.name.trim()) throw new Error('Name is required');

      let entityId: string | null = null;

      if (searchType === 'event') {
        if (!user?.id) throw new Error('Must be logged in to create an event');

        // Parse date from the search result's date_info field
        const selectedResult = displayResults.find(r => r.id === selectedResultId);
        let eventDate = new Date().toISOString().split('T')[0];
        if (selectedResult?.date_info) {
          try {
            const parsed = new Date(selectedResult.date_info);
            if (!isNaN(parsed.getTime())) eventDate = parsed.toISOString().split('T')[0];
          } catch { /* fall back to today */ }
        }

        const { data, error } = await supabase.from('events').insert({
          event_name: createFormData.name,
          event_id: crypto.randomUUID().slice(0, 8),
          event_date: eventDate,
          description: createFormData.description || null,
          url: createFormData.url || null,
          city: createFormData.location || null,
          metro_id: activatedTerritories?.find(t => t.territory_id === selectedTerritory)?.metro_id || null,
          tenant_id: tenant?.id || null,
          attended_by: user.id,
        }).select('id').single();
        if (error) throw error;
        entityId = data.id;
      } else if (searchType === 'opportunity') {
        const { data, error } = await supabase.from('opportunities').insert({
          organization: createFormData.name,
          opportunity_id: crypto.randomUUID().slice(0, 8),
          notes: createFormData.description || null,
          website_url: createFormData.url || null,
          metro_id: activatedTerritories?.find(t => t.territory_id === selectedTerritory)?.metro_id || null,
          stage: 'Target Identified',
          status: 'Active',
        }).select('id').single();
        if (error) throw error;
        entityId = data.id;
      } else if (searchType === 'people') {
        // For people searches, create a contact record
        const { data, error } = await supabase.from('contacts').insert({
          name: createFormData.name,
          contact_id: crypto.randomUUID().slice(0, 8),
          title: createFormData.organization || null,
          email: createFormData.url || null, // URL field repurposed as email for people
          notes: createFormData.description || null,
        }).select('id').single();
        if (error) throw error;
        entityId = data.id;
      } else if (searchType === 'grant') {
        if (!user?.id) throw new Error('Must be logged in to create a grant');
        // Build notes from extracted details
        const noteParts: string[] = [];
        if (createFormData.description) noteParts.push(createFormData.description);
        if (createFormData.grant_eligibility) noteParts.push(`Eligibility: ${createFormData.grant_eligibility}`);
        if (createFormData.grant_deadline) noteParts.push(`Deadline: ${createFormData.grant_deadline}`);
        if (createFormData.grant_amount) noteParts.push(`Amount: ${createFormData.grant_amount}`);

        // Parse amount to number for amount_requested
        let amountRequested: number | null = null;
        if (createFormData.grant_amount) {
          // Extract first number from strings like "$50,000 to $150,000" or "$1,000,000"
          const amountMatch = createFormData.grant_amount.replace(/,/g, '').match(/\$?([\d.]+)/);
          if (amountMatch) amountRequested = parseFloat(amountMatch[1]);
        }

        // Parse deadline to a date for grant_term_end
        let grantTermEnd: string | null = null;
        if (createFormData.grant_deadline) {
          try {
            const parsed = new Date(createFormData.grant_deadline);
            if (!isNaN(parsed.getTime())) grantTermEnd = parsed.toISOString().split('T')[0];
          } catch { /* ignore unparseable dates */ }
        }

        // Extract raw_data fields from the selected result
        const selectedResult = displayResults.find(r => r.id === selectedResultId);
        const rd = selectedResult?.raw_data || {};

        const { data, error } = await supabase.from('grants').insert({
          grant_name: createFormData.name,
          grant_id: crypto.randomUUID().slice(0, 8),
          funder_name: createFormData.organization || 'Unknown',
          notes: noteParts.join('\n') || null,
          metro_id: activatedTerritories?.find(t => t.territory_id === selectedTerritory)?.metro_id || null,
          owner_id: user.id,
          amount_requested: amountRequested,
          grant_term_end: grantTermEnd,
          internal_strategy_notes: createFormData.grant_eligibility || null,
          source_url: createFormData.url || null,
        } as any).select('id').single();
        if (error) throw error;
        entityId = data.id;
      }

      // Mark the search result as entity_created
      if (selectedResultId && entityId) {
        await supabase.from('search_results').update({
          entity_created: true,
          created_entity_id: entityId,
          created_entity_type: searchType,
        }).eq('id', selectedResultId);
      }

      // Trigger enrichment if we have a URL
      if (entityId && createFormData.url) {
        await supabase.functions.invoke('enrichment-job-enqueue', {
          body: {
            entity_type: searchType,
            entity_id: entityId,
            source_url: createFormData.url,
          },
        }).catch(() => {});

        // Dispatch grant enrichment n8n workflow
        if (searchType === 'grant') {
          await supabase.functions.invoke('n8n-dispatch', {
            body: {
              workflow_key: 'grant_enrich',
              grant_id: entityId,
              source_url: createFormData.url,
              grant_name: createFormData.name,
              funder_name: createFormData.organization || 'Unknown',
            },
          }).catch((err) => console.error('grant_enrich dispatch error:', err));
        }
      }

      return entityId;
    },
    onSuccess: () => {
      toast.success(`${labels.singular} created successfully`);
      setCreateDialogOpen(false);
      setSelectedResultId(null);
      queryClient.invalidateQueries({ queryKey: ['search-results', selectedRunId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (activeSavedSearchId) {
        queryClient.invalidateQueries({ queryKey: ['saved-search-results'] });
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create entity');
    },
  });

  const handleAddFromResult = (result: SearchResult) => {
    setSelectedResultId(result.id);
    const rd = result.raw_data || {};
    setCreateFormData({
      name: result.title || '',
      description: result.description || '',
      url: result.url || '',
      location: result.location || '',
      organization: result.organization || '',
      contact_name: result.contact_name || '',
      contact_email: result.contact_email || '',
      grant_amount: rd.amount ? String(rd.amount) : '',
      grant_deadline: rd.deadline ? String(rd.deadline) : (result.date_info || ''),
      grant_eligibility: rd.eligibility ? String(rd.eligibility) : '',
    });
    setCreateDialogOpen(true);
  };

  const handleSaveSearch = () => {
    if (!searchQuery.trim()) return;
    const scopeLabel = selectedTerritoryName || scopeLabels.all;
    setSaveSearchName(`${labels.plural} - ${scopeLabel} - ${searchQuery.trim().slice(0, 40)}`);
    setSaveDialogOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!saveSearchName.trim() || !searchQuery.trim()) return;
    await createSavedSearch.mutateAsync({
      module,
      scope: selectedTerritory !== 'all' ? 'territory' : 'national',
      metro_id: activatedTerritories?.find(t => t.territory_id === selectedTerritory)?.metro_id || undefined,
      name: saveSearchName.trim(),
      raw_query: searchQuery.trim(),
    });
    setSaveDialogOpen(false);
  };

  const handleSavedSearchRun = (runId: string, savedSearchId: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('run', runId);
      next.set('saved', savedSearchId);
      return next;
    }, { replace: true });
    queryClient.invalidateQueries({ queryKey: ['search-runs', searchType] });
  };

  const handleMarkAllSeen = () => {
    if (!activeSavedSearchId || !selectedRunId) return;
    markSeen.mutate({ saved_search_id: activeSavedSearchId, run_id: selectedRunId });
  };

  const handleSegmentClick = useCallback((segment: Segment) => {
    if (activeSegmentKey === segment.key) {
      // Deselect
      setActiveSegmentKey(null);
      setSelectedIds(new Set());
    } else {
      setActiveSegmentKey(segment.key);
      setSelectedIds(new Set(segment.matchingIds));
    }
  }, [activeSegmentKey]);

  const toggleResultSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setActiveSegmentKey(null); // clear segment highlight when manually toggling
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setActiveSegmentKey(null);
  }, []);

  // Campaign creation from search results (opportunity only)
  const createCampaignFromSearch = useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke('campaign-create-from-search', {
        body: { run_id: runId },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; campaign_id?: string; audience_count?: number; enrichment_used?: boolean; message?: string; error?: string };
      if (!result?.ok) throw new Error(result?.message || result?.error || 'Failed to create campaign');
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Draft campaign created with ${result.audience_count} contacts${result.enrichment_used ? ' (enriched)' : ''}`);
      if (result.campaign_id) {
        navigate(`/outreach/campaigns/${result.campaign_id}`);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign');
    },
  });

  // F8: Add + Draft Outreach (bulk add contacts, create orgs, enrich, draft campaign)
  const addAndDraftOutreach = useMutation({
    mutationFn: async () => {
      const selectedResults = displayResults.filter(r => selectedIds.has(r.id) && !r.entity_created);
      if (selectedResults.length === 0) throw new Error('No unprocessed contacts selected');

      const people = selectedResults.map(r => ({
        name: r.contact_name || r.title,
        title: r.title || undefined,
        email: r.contact_email || undefined,
        organization: r.organization || undefined,
        url: r.url || undefined,
        location: r.location || undefined,
        search_result_id: r.id,
      }));

      const { data, error } = await supabase.functions.invoke('add-and-draft-outreach', {
        body: {
          people,
          metro_id: activatedTerritories?.find(t => t.territory_id === selectedTerritory)?.metro_id || undefined,
          idempotency_key: `add-draft-${selectedRunId}-${Array.from(selectedIds).sort().join(',')}`,
        },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; campaign_id?: string; contacts_created?: number; opportunities_created?: number; audience_count?: number; message?: string; error?: string; duplicate?: boolean };
      if (!result?.ok) throw new Error(result?.message || result?.error || 'Failed');
      return result;
    },
    onSuccess: (result) => {
      if (result.duplicate) {
        toast.info('Already processed — navigating to draft');
      } else {
        toast.success(`Added ${result.contacts_created} contacts, ${result.opportunities_created} orgs → campaign draft`);
      }
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['search-results', selectedRunId] });
      if (result.campaign_id) {
        navigate(`/outreach/campaigns/${result.campaign_id}`);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to add + draft');
    },
  });

  const activeRun = searchRuns?.find(r => r.run_id === selectedRunId);
  const isSearching = activeRun?.status === 'pending' || activeRun?.status === 'running';
  const canSearch = searchQuery.trim().length > 0 && !blockedWarning && !dispatchSearch.isPending;

  // Force re-render every 10s while searching so timeout states update
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isSearching) return;
    const interval = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(interval);
  }, [isSearching]);

  // Compute elapsed time for active search to show timeout UX
  const searchElapsedMs = activeRun && isSearching
    ? Date.now() - new Date(activeRun.created_at).getTime()
    : 0;
  const isStale = searchElapsedMs > 30_000;
  const isTimedOut = searchElapsedMs > 90_000;

  // Auto-fail stuck runs after 90s so the user isn't blocked
  const [autoFailedRunIds, setAutoFailedRunIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isTimedOut || !activeRun || autoFailedRunIds.has(activeRun.run_id)) return;
    setAutoFailedRunIds(prev => new Set(prev).add(activeRun.run_id));
    supabase
      .from('search_runs')
      .update({
        status: 'failed',
        error_message: 'Timed out — no callback received within 90 seconds',
        completed_at: new Date().toISOString(),
      })
      .eq('run_id', activeRun.run_id)
      .eq('status', 'pending')
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['search-runs'] });
      });
  }, [isTimedOut, activeRun?.run_id]);

  const searchHistoryContent = (
    <>
      {runsLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading…
        </div>
      )}
      {!runsLoading && (!searchRuns || searchRuns.length === 0) && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Your recent searches will appear here.
        </p>
      )}
      {searchRuns && searchRuns.length > 0 && searchRuns.slice(0, 10).map((run) => (
        <button
          key={run.run_id}
          onClick={() => {
            setSearchParams(prev => {
              const next = new URLSearchParams(prev);
              next.set('run', run.run_id);
              next.delete('saved');
              return next;
            }, { replace: true });
          }}
          className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
            selectedRunId === run.run_id
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/30'
          }`}
        >
          <p className="text-xs font-medium truncate">{run.raw_query || run.query}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">
              {new Date(run.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
            {run.status === 'completed' && (
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                {run.result_count}
              </Badge>
            )}
            {run.status === 'failed' && (
              <Badge variant="destructive" className="text-[10px] py-0 h-4">
                Failed
              </Badge>
            )}
            {(run.status === 'pending' || run.status === 'running') && (
              <Badge variant="secondary" className="text-[10px] py-0 h-4">
                <RefreshCw className="w-2.5 h-2.5 mr-0.5 animate-spin" />
                …
              </Badge>
            )}
          </div>
        </button>
      ))}
    </>
  );

  const content = (
    <>
      <div className="flex flex-col lg:flex-row gap-6">
      {/* Left column: search form + results */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Search form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search for {searchType === 'people' ? 'People' : labels.plural}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder={searchType === 'people' ? 'Search for people (e.g. community impact director)' : `Search for ${labels.plural.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && canSearch && dispatchSearch.mutate()}
              />
              <Select value={selectedTerritory} onValueChange={setSelectedTerritory}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder={scopeLabels.all} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{scopeLabels.all}</SelectItem>
                  {activatedTerritories?.map((t) => (
                    <SelectItem key={t.territory_id} value={t.territory_id}>
                      {t.territory_type === 'county' ? `${t.name} (County)` : t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  onClick={() => dispatchSearch.mutate()}
                  disabled={!canSearch}
                  className="gap-2"
                >
                  {dispatchSearch.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </Button>
                {searchQuery.trim() && !blockedWarning && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSaveSearch}
                    title="Save this search"
                  >
                    <Bookmark className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Intent pills (locked) */}
            {intentPills.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground mr-1">Enforced keywords:</span>
                {intentPills.map((pill) => (
                  <Badge
                    key={pill.label}
                    variant="secondary"
                    className="text-xs gap-1 cursor-default select-none"
                  >
                    {pill.type === 'required' && <Lock className="w-2.5 h-2.5" />}
                    {pill.label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Role Focus selector (opportunity only) */}
            {searchType === 'people' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Role Focus (optional)</Label>
                <RadioGroup
                  value={roleFocus}
                  onValueChange={setRoleFocus}
                  className="flex flex-wrap gap-x-4 gap-y-2"
                  data-testid="role-focus-selector"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="none" id="role-none" />
                    <Label htmlFor="role-none" className="text-xs font-normal cursor-pointer">None</Label>
                  </div>
                  {ROLE_FOCUS_OPTIONS.map(opt => (
                    <div key={opt.key} className="flex items-center gap-1.5">
                      <RadioGroupItem value={opt.key} id={`role-${opt.key}`} />
                      <Label htmlFor={`role-${opt.key}`} className="text-xs font-normal cursor-pointer">{opt.label}</Label>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="custom" id="role-custom" />
                    <Label htmlFor="role-custom" className="text-xs font-normal cursor-pointer">Custom</Label>
                  </div>
                </RadioGroup>
                {roleFocus === 'custom' && (
                  <Input
                    placeholder="e.g. fundraising, outreach, engagement"
                    value={customRoleText}
                    onChange={(e) => setCustomRoleText(e.target.value)}
                    className="text-sm h-8"
                    data-testid="custom-role-input"
                  />
                )}
              </div>
            )}

            {/* Sample search phrases (opportunity only) */}
            {searchType === 'people' && !searchQuery.trim() && (
              <div className="space-y-2" data-testid="sample-phrases">
                <span className="text-xs text-muted-foreground font-medium">Try one of these:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedMetro !== 'all' ? SAMPLE_PHRASES_METRO : SAMPLE_PHRASES_NATIONAL).map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      className="text-xs bg-muted hover:bg-accent hover:text-accent-foreground rounded-full px-3 py-1 transition-colors"
                      onClick={() => setSearchQuery(phrase)}
                      data-testid="sample-phrase"
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Blocked pattern warning */}
            {blockedWarning && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-md px-3 py-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  Query contains blocked pattern: <strong>"{blockedWarning}"</strong>. Please rephrase.
                </span>
              </div>
            )}

            {/* Enforced query preview */}
            {searchQuery.trim() && !blockedWarning && enforcedPreview && (
              <div className="space-y-1">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowEnforcedPreview(!showEnforcedPreview)}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showEnforcedPreview ? 'Hide' : 'Show'} enforced query preview
                </button>
                {showEnforcedPreview && (
                  <div className="bg-muted/50 rounded-md px-3 py-2 text-xs font-mono text-muted-foreground break-all">
                    {enforcedPreview}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Searches Panel */}
        <SavedSearchesPanel module={module} onRunStarted={handleSavedSearchRun} />

        {/* Search Brief */}
        {activeRun?.status === 'completed' && activeRun?.search_brief && !activeSavedSearchId && (
          <SearchBriefCard
            brief={activeRun.search_brief}
            onSuggestedQueryClick={(q) => setSearchQuery(q)}
          />
        )}

        {/* Results */}
        {selectedRunId && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">Results</CardTitle>
                  {activeRun?.status === 'completed' && displayResults.length > 0 && !activeSavedSearchId && (
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        Results: {displayResults.length} found • {displayResults.filter(r => r.entity_created).length} added
                      </p>
                      {(activeRun?.merged_results_count ?? 0) > 0 && (
                        <SearchMemoryBanner
                          mergedCount={activeRun!.merged_results_count!}
                          priorRunsMerged={activeRun!.prior_runs_merged ?? 0}
                        />
                      )}
                      {searchType === 'people' && displayResults.some(r => r.contact_email) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => selectedRunId && createCampaignFromSearch.mutate(selectedRunId)}
                          disabled={createCampaignFromSearch.isPending}
                        >
                          {createCampaignFromSearch.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Mail className="w-3 h-3" />
                          )}
                          Create Draft Campaign
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {activeSavedSearchId && activeRun?.status === 'completed' && displayResults.length > 0 && (
                  <div className="flex items-center gap-3">
                    {newCount > 0 && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                        <Sparkles className="w-3 h-3" />
                        {newCount} new / {totalCount} total
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={handleMarkAllSeen}
                      disabled={markSeen.isPending}
                    >
                      {markSeen.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <EyeOff className="w-3 h-3" />
                      )}
                      Mark all as seen
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isSearching && !isTimedOut && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isStale ? 'Still processing… This may take a moment.' : 'Searching… Results will appear here.'}</span>
                  </div>
                  {isStale && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => dispatchSearch.mutate()}
                      disabled={dispatchSearch.isPending}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Re-dispatch
                    </Button>
                  )}
                </div>
              )}

              {isSearching && isTimedOut && (
                <div className="text-center py-8 text-destructive">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-medium">Search timed out</p>
                  <p className="text-sm text-muted-foreground mb-3">No results received after 90 seconds.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dispatchSearch.mutate()}
                    disabled={dispatchSearch.isPending}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry Search
                  </Button>
                </div>
              )}

              {activeRun?.status === 'failed' && (
                <div className="text-center py-8 text-destructive">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-medium">Search failed</p>
                  <p className="text-sm text-muted-foreground">{activeRun.error_message}</p>
                </div>
              )}

              {activeRun?.status === 'completed' && displayResults.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No results found. Try a different search.</p>
                </div>
              )}

              {activeRun?.status === 'completed' && displayResults.length > 0 && (
                <div className="space-y-3">
                  {/* Suggested segment chips (people only) */}
                  {searchType === 'people' && (
                    <SuggestedSegments
                      results={displayResults}
                      selectedIds={selectedIds}
                      onSegmentClick={handleSegmentClick}
                      activeSegmentKey={activeSegmentKey}
                    />
                  )}

                  {displayResults.map((result) => {
                    const isChecked = selectedIds.has(result.id);
                    return (
                    <div
                      key={result.id}
                      className={`p-3 sm:p-4 rounded-lg border transition-colors ${
                        isChecked
                          ? 'border-primary/50 bg-primary/5'
                          : result.entity_created
                          ? 'bg-muted/30 border-muted'
                          : result.is_new
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Title row with checkbox + badges */}
                        <div className="flex items-start gap-2">
                          {searchType === 'people' && !result.entity_created && (
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleResultSelection(result.id)}
                              className="mt-0.5 shrink-0"
                            />
                          )}
                          <h4 className="font-medium text-sm leading-snug flex-1 min-w-0">{result.title}</h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {result.is_new && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 shrink-0 gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" />
                                New
                              </Badge>
                            )}
                            {result.confidence !== null && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                {Math.round(result.confidence * 100)}%
                              </Badge>
                            )}
                            {result.entity_created && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Added
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        {result.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{result.description}</p>
                        )}

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {result.organization && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 shrink-0" /> {result.organization}
                            </span>
                          )}
                          {result.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" /> {result.location}
                            </span>
                          )}
                          {result.date_info && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 shrink-0" /> {result.date_info}
                            </span>
                          )}
                        </div>

                        {/* Why this appears — keyword transparency */}
                        {result.matched_keywords && result.matched_keywords.length > 0 && (
                          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/70">
                            <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>
                              Matched your keywords: {result.matched_keywords.join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Communio Resonance — calm annotation */}
                        {result.resonance_annotation && (
                          <div className="flex items-start gap-1.5 text-[10px] text-primary/60 italic">
                            <Waves className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{result.resonance_annotation}</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          {result.url && (
                            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                              <a href={result.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3 h-3" />
                                <span className="hidden sm:inline">View</span>
                              </a>
                            </Button>
                          )}
                          {!result.entity_created && (
                            <Button
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleAddFromResult(result)}
                            >
                              <Plus className="w-3 h-3" />
                              Add {labels.singular}
                            </Button>
                          )}

                          {/* Community discernment signals */}
                          <div className="ml-auto flex items-center gap-1">
                            {signalledResults[result.id] === 'relevance' ? (
                              <span className="text-[10px] text-muted-foreground italic">Noted ✓</span>
                            ) : signalledResults[result.id] === 'noise' ? (
                              <span className="text-[10px] text-muted-foreground italic">Adjusted ✓</span>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-primary"
                                  onClick={() => emitSignal(result.id, 'relevance', result.title)}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  <span className="hidden sm:inline">More like this</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-muted-foreground/80"
                                  onClick={() => emitSignal(result.id, 'noise', result.title)}
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                  <span className="hidden sm:inline">Not relevant</span>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bulk selection action bar */}
        {searchType === 'people' && selectedIds.size > 0 && activeRun?.status === 'completed' && (
          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-medium">{selectedIds.size} contacts selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => selectedRunId && createCampaignFromSearch.mutate(selectedRunId)}
                disabled={createCampaignFromSearch.isPending}
              >
                {createCampaignFromSearch.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Mail className="w-3 h-3" />
                )}
                Create Campaign
              </Button>
              <Button
                size="sm"
                variant="default"
                className="gap-1.5"
                onClick={() => addAndDraftOutreach.mutate()}
                disabled={addAndDraftOutreach.isPending}
              >
                {addAndDraftOutreach.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Add + Draft Outreach
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedRunId && (!searchRuns || searchRuns.length === 0) && !runsLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No searches yet</p>
            <p className="text-sm">Enter a query above to find {searchType === 'people' ? 'people' : labels.plural.toLowerCase()}.</p>
          </div>
        )}
      </div>

      {/* Right sidebar: Search History — collapsible on mobile, sticky sidebar on desktop */}
      <div className="w-full lg:w-72 xl:w-80 shrink-0 order-last">
        {/* Mobile: collapsible */}
        <div className="lg:hidden">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between text-sm text-muted-foreground gap-2">
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Search History
                  {searchRuns && searchRuns.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] py-0 h-4">{searchRuns.length}</Badge>
                  )}
                </span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1.5">
              {searchHistoryContent}
            </CollapsibleContent>
          </Collapsible>
        </div>
        {/* Desktop: sticky card */}
        <Card className="hidden lg:block lg:sticky lg:top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <History className="w-4 h-4" />
              Search History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {searchHistoryContent}
          </CardContent>
        </Card>
      </div>
      </div>

      {/* Create entity dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add {labels.singular}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={createFormData.name}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={createFormData.description}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                value={createFormData.url}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Location</Label>
                <Input
                  value={createFormData.location}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div>
                <Label>Organization</Label>
                <Input
                  value={createFormData.organization}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, organization: e.target.value }))}
                />
              </div>
            </div>
            {searchType === 'grant' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Funding Amount</Label>
                    <Input
                      value={createFormData.grant_amount}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, grant_amount: e.target.value }))}
                      placeholder="e.g., $50,000 - $150,000"
                    />
                  </div>
                  <div>
                    <Label>Deadline</Label>
                    <Input
                      value={createFormData.grant_deadline}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, grant_deadline: e.target.value }))}
                      placeholder="e.g., March 31, 2026"
                    />
                  </div>
                </div>
                <div>
                  <Label>Eligibility</Label>
                  <Input
                    value={createFormData.grant_eligibility}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, grant_eligibility: e.target.value }))}
                    placeholder="Who can apply?"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createEntity.mutate()}
              disabled={createEntity.isPending || !createFormData.name.trim()}
              className="gap-2"
            >
              {createEntity.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create {labels.singular}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save search dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="w-5 h-5" />
              Save Search
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                placeholder="My saved search"
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmSave()}
                autoFocus
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Query:</strong> {searchQuery.trim()}</p>
              <p><strong>Scope:</strong> {selectedTerritory !== 'all' ? selectedTerritoryName || 'Territory' : scopeLabels.all}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={createSavedSearch.isPending || !saveSearchName.trim()}
              className="gap-2"
            >
              {createSavedSearch.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (noLayout) return content;

  return (
    <MainLayout title={searchType === 'people' ? 'Find People' : `Find ${labels.plural}`} subtitle={searchType === 'people' ? 'Discover new contacts and decision-makers' : `Discover new ${labels.plural.toLowerCase()} in your community`} helpKey="page.discovery">
      {content}
    </MainLayout>
  );
}
