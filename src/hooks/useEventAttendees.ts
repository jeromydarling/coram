/**
 * Event Attendees Hook
 * 
 * CRUD operations, matching, and target ranking for conference attendees.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

// ============================================================================
// MUTATION: Quick Add Attendee (fast mobile capture)
// ============================================================================

export function useQuickAddAttendee(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (attendee: {
      raw_full_name: string;
      raw_org?: string | null;
      raw_title?: string | null;
      raw_email?: string | null;
    }) => {
      const { error } = await supabase
        .from('event_attendees')
        .insert({
          event_id: eventId,
          raw_full_name: attendee.raw_full_name,
          raw_org: attendee.raw_org || null,
          raw_title: attendee.raw_title || null,
          raw_email: attendee.raw_email || null,
          match_status: 'unmatched',
          confidence_score: 0,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Attendee added');
    },
    onError: (error) => {
      toast.error(`Failed to add attendee: ${error.message}`);
    },
  });
}
import type { Json } from '@/integrations/supabase/types';
import { 
  EventAttendee, 
  AttendeeImportRow, 
  AttendeeMatchStatus,
  MatchResult,
  ConferencePlanItem,
  TARGET_SCORING_WEIGHTS,
  TARGET_TITLE_KEYWORDS,
  ORG_GOAL_KEYWORDS 
} from '@/types/event-planner';

// ============================================================================
// QUERY: Fetch attendees for an event
// ============================================================================

export function useEventAttendees(eventId: string | null) {
  return useQuery({
    queryKey: ['event-attendees', eventId],
    queryFn: async (): Promise<EventAttendee[]> => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('event_attendees')
        .select(`
          *,
          matched_contact:contacts!event_attendees_matched_contact_id_fkey(id, name, email, title),
          matched_opportunity:opportunities!event_attendees_matched_opportunity_id_fkey(id, organization, stage)
        `)
        .eq('event_id', eventId)
        .order('target_score', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        tags: Array.isArray(row.tags) ? row.tags : [],
        target_reasons: Array.isArray(row.target_reasons) ? row.target_reasons : [],
        matched_contact: row.matched_contact || null,
        matched_opportunity: row.matched_opportunity || null,
      })) as EventAttendee[];
    },
    enabled: !!eventId,
  });
}

// ============================================================================
// MUTATION: Import attendees
// ============================================================================

export function useImportAttendees(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (rows: AttendeeImportRow[]) => {
      if (!eventId || rows.length === 0) return { count: 0, import_batch_id: null as string | null };
      
      // Generate a batch ID for this import
      const importBatchId = crypto.randomUUID();
      
      const insertRows = rows.map(row => ({
        event_id: eventId,
        raw_full_name: row.raw_full_name,
        raw_org: row.raw_org || null,
        raw_title: row.raw_title || null,
        raw_email: row.raw_email || null,
        raw_phone: row.raw_phone || null,
        linkedin_url: row.linkedin_url || null,
        match_status: 'unmatched' as AttendeeMatchStatus,
        import_batch_id: importBatchId,
      }));
      
      const { data, error } = await supabase
        .from('event_attendees')
        .insert(insertRows)
        .select();
      
      if (error) throw error;
      
      // Update attendee_count on event - log audit
      try {
        await supabase.rpc('log_audit_entry', {
          p_entity_type: 'event',
          p_entity_id: eventId,
          p_action: 'attendees_imported',
          p_entity_name: `${rows.length} attendees`,
        });
      } catch {
        // Ignore audit errors
      }
      
      return { count: data?.length || 0, import_batch_id: importBatchId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(`Imported ${result.count} attendees`);
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
}

// ============================================================================
// MATCHING HELPERS
// ============================================================================

function normalizeString(s: string | null | undefined): string {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function fuzzyNameMatch(attendeeName: string, contactName: string): boolean {
  const a = normalizeString(attendeeName);
  const c = normalizeString(contactName);
  
  // Exact match
  if (a === c) return true;
  
  // Contains match (either direction)
  if (a.includes(c) || c.includes(a)) return true;
  
  // First/last name match
  const aParts = a.split(' ').filter(p => p.length > 1);
  const cParts = c.split(' ').filter(p => p.length > 1);
  
  // Check if first name matches
  if (aParts[0] && cParts[0] && aParts[0] === cParts[0]) return true;
  
  // Check if last name matches
  if (aParts.length > 1 && cParts.length > 1) {
    const aLast = aParts[aParts.length - 1];
    const cLast = cParts[cParts.length - 1];
    if (aLast === cLast) return true;
  }
  
  return false;
}

// ============================================================================
// MUTATION: Run attendee matching
// ============================================================================

export function useRunAttendeeMatching(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Fetch unmatched attendees
      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('*')
        .eq('event_id', eventId)
        .in('match_status', ['unmatched', 'possible']);
      
      if (!attendees || attendees.length === 0) {
        return { matched: 0, possible: 0, newCount: 0 };
      }
      
      // Fetch all contacts with their opportunities
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email, title, opportunity_id, opportunities:opportunity_id(id, organization)');
      
      const contactList = contacts || [];
      let matchedCount = 0;
      let possibleCount = 0;
      let newCount = 0;
      
      for (const attendee of attendees) {
        // Skip already confirmed matched
        if (attendee.match_status === 'matched') continue;
        
        const result = matchAttendee(attendee, contactList);
        
        const updateData: Record<string, unknown> = {
          match_status: result.status,
          confidence_score: result.confidence,
        };
        
        if (result.contact) {
          updateData.matched_contact_id = result.contact.id;
        }
        if (result.opportunity) {
          updateData.matched_opportunity_id = result.opportunity.id;
        }
        
        await supabase
          .from('event_attendees')
          .update(updateData)
          .eq('id', attendee.id);
        
        if (result.status === 'matched') matchedCount++;
        else if (result.status === 'possible') possibleCount++;
        else newCount++;
      }
      
      return { matched: matchedCount, possible: possibleCount, newCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      toast.success(`Matching complete: ${result.matched} matched, ${result.possible} possible, ${result.newCount} new`);
    },
    onError: (error) => {
      toast.error(`Matching failed: ${error.message}`);
    },
  });
}

function matchAttendee(
  attendee: { raw_full_name: string; raw_email: string | null; raw_org: string | null },
  contacts: Array<{ id: string; name: string; email: string | null; opportunity_id: string | null; opportunities: { id: string; organization: string } | null }>
): MatchResult {
  const normalizedEmail = normalizeString(attendee.raw_email);
  const normalizedName = normalizeString(attendee.raw_full_name);
  const normalizedOrg = normalizeString(attendee.raw_org);
  
  // 1. Email exact match -> confidence 1.0, matched
  if (normalizedEmail) {
    const emailMatch = contacts.find(c => 
      normalizeString(c.email) === normalizedEmail
    );
    if (emailMatch) {
      return { 
        status: 'matched', 
        confidence: 1.0, 
        contact: { id: emailMatch.id, name: emailMatch.name, email: emailMatch.email },
        opportunity: emailMatch.opportunities ? { id: emailMatch.opportunities.id, organization: emailMatch.opportunities.organization } : null,
      };
    }
  }
  
  // 2. Fuzzy name + org match
  for (const contact of contacts) {
    const contactName = normalizeString(contact.name);
    const contactOrg = contact.opportunities?.organization 
      ? normalizeString(contact.opportunities.organization) 
      : '';
    
    const nameMatch = fuzzyNameMatch(attendee.raw_full_name, contact.name);
    const orgMatch = contactOrg && normalizedOrg && 
                     (contactOrg.includes(normalizedOrg) || normalizedOrg.includes(contactOrg));
    
    if (nameMatch && orgMatch) {
      return { 
        status: 'possible', 
        confidence: 0.85, 
        contact: { id: contact.id, name: contact.name, email: contact.email },
        opportunity: contact.opportunities ? { id: contact.opportunities.id, organization: contact.opportunities.organization } : null,
      };
    }
    if (nameMatch) {
      return { 
        status: 'possible', 
        confidence: 0.5, 
        contact: { id: contact.id, name: contact.name, email: contact.email },
        opportunity: contact.opportunities ? { id: contact.opportunities.id, organization: contact.opportunities.organization } : null,
      };
    }
  }
  
  // 3. No match
  return { status: 'new', confidence: 0 };
}

// ============================================================================
// MUTATION: Rank targets
// ============================================================================

export function useRankTargets(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Fetch attendees
      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('*')
        .eq('event_id', eventId);
      
      if (!attendees || attendees.length === 0) return { ranked: 0 };
      
      // Fetch opportunities and anchors for scoring
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('id, organization, stage, metro_id');
      
      const { data: anchors } = await supabase
        .from('anchors')
        .select('id, opportunity_id');
      
      const oppList = opportunities || [];
      const anchorOppIds = new Set((anchors || []).map(a => a.opportunity_id).filter(Boolean));
      
      let rankedCount = 0;
      
      for (const attendee of attendees) {
        const { score, reasons } = computeTargetScore(attendee, oppList, anchorOppIds);
        
        await supabase
          .from('event_attendees')
          .update({ 
            target_score: score, 
            target_reasons: reasons,
          })
          .eq('id', attendee.id);
        
        rankedCount++;
      }
      
      return { ranked: rankedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      toast.success(`Ranked ${result.ranked} attendees`);
    },
    onError: (error) => {
      toast.error(`Ranking failed: ${error.message}`);
    },
  });
}

function computeTargetScore(
  attendee: { matched_contact_id: string | null; raw_org: string | null; raw_title: string | null },
  opportunities: Array<{ id: string; organization: string; stage: string; metro_id: string | null }>,
  anchorOppIds: Set<string>
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  
  // +20: Already in CRM (matched_contact_id exists)
  if (attendee.matched_contact_id) {
    score += TARGET_SCORING_WEIGHTS.ALREADY_IN_CRM;
    reasons.push('Already in CRM');
  }
  
  // +25: Org is anchor or high-volume opportunity
  const normalizedOrg = normalizeString(attendee.raw_org);
  if (normalizedOrg) {
    const orgMatch = opportunities.find(o => 
      normalizeString(o.organization).includes(normalizedOrg) ||
      normalizedOrg.includes(normalizeString(o.organization))
    );
    
    if (orgMatch) {
      const isAnchor = anchorOppIds.has(orgMatch.id);
      const isStableProducer = orgMatch.stage === 'Stable Producer';
      
      if (isAnchor || isStableProducer) {
        score += TARGET_SCORING_WEIGHTS.ORG_IS_ANCHOR_HIGH_VOLUME;
        reasons.push(isAnchor ? 'Anchor organization' : 'Stable Producer org');
      }
    }
  }
  
  // +15: Title contains decision-maker keywords
  const titleLower = normalizeString(attendee.raw_title);
  if (titleLower) {
    const hasKeyword = TARGET_TITLE_KEYWORDS.some(k => titleLower.includes(k));
    if (hasKeyword) {
      score += TARGET_SCORING_WEIGHTS.TITLE_DIRECTOR_VP_PARTNERSHIPS;
      reasons.push('Decision-maker title');
    }
  }
  
  // +15: Org keywords match goals
  if (normalizedOrg) {
    const hasGoalKeyword = ORG_GOAL_KEYWORDS.some(k => normalizedOrg.includes(k));
    if (hasGoalKeyword) {
      score += TARGET_SCORING_WEIGHTS.ORG_KEYWORDS_MATCH_GOALS;
      reasons.push('Org matches impact goals');
    }
  }
  
  // +10: Local metro relevance (if org opportunity has metro_id)
  // Simplified: if org matches any opportunity, give local bonus
  if (normalizedOrg) {
    const orgMatch = opportunities.find(o => 
      normalizeString(o.organization).includes(normalizedOrg) ||
      normalizedOrg.includes(normalizeString(o.organization))
    );
    
    if (orgMatch?.metro_id) {
      score += TARGET_SCORING_WEIGHTS.LOCAL_METRO_RELEVANCE;
      reasons.push('Local organization');
    }
  }
  
  return { score, reasons };
}

// ============================================================================
// MUTATION: Update attendee
// ============================================================================

export function useUpdateAttendee(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { 
      id: string; 
      match_status?: AttendeeMatchStatus;
      matched_contact_id?: string | null;
      matched_opportunity_id?: string | null;
      is_target?: boolean;
      raw_full_name?: string;
      raw_org?: string | null;
      raw_title?: string | null;
      raw_email?: string | null;
      raw_phone?: string | null;
    }) => {
      const { id, ...updates } = params;
      
      const { error } = await supabase
        .from('event_attendees')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });
}

// ============================================================================
// MUTATION: Delete attendee
// ============================================================================

export function useDeleteAttendee(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (attendeeId: string) => {
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('id', attendeeId);
      
      if (error) throw error;
      return { id: attendeeId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      toast.success('Attendee removed');
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });
}

// ============================================================================
// MUTATION: Bulk delete attendees
// ============================================================================

export function useBulkDeleteAttendees(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (attendeeIds: string[]) => {
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .in('id', attendeeIds);
      
      if (error) throw error;
      return { count: attendeeIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      toast.success(`Removed ${result.count} attendees`);
    },
    onError: (error) => {
      toast.error(`Bulk delete failed: ${error.message}`);
    },
  });
}

// ============================================================================
// MUTATION: Generate conference plan
// ============================================================================

// Helper function for conference plan CTA logic (file-local, no export)
function getConferencePlanCTA(attendee: {
  matched_contact_id: string | null;
  raw_email: string | null;
  raw_phone: string | null;
}): {
  recommended_action: string;
  primary_cta: { label: string; action: 'log_activity' | 'create_contact' | 'open_attendee' };
} {
  if (attendee.matched_contact_id) {
    return {
      recommended_action: 'Log an in-person touch + set next step',
      primary_cta: { label: 'Log Activity', action: 'log_activity' },
    };
  }
  if (attendee.raw_email || attendee.raw_phone) {
    return {
      recommended_action: 'Create contact from attendee info',
      primary_cta: { label: 'Create Contact', action: 'create_contact' },
    };
  }
  return {
    recommended_action: 'Open attendee and capture contact details',
    primary_cta: { label: 'Open Attendee', action: 'open_attendee' },
  };
}

export function useGenerateConferencePlan(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Fetch top targets - use OR grouping to guarantee dismissed are excluded
      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('*')
        .eq('event_id', eventId)
        .or('and(match_status.neq.dismissed,is_target.eq.true),and(match_status.neq.dismissed,target_score.gte.20)')
        .order('target_score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(10);
      
      if (!attendees || attendees.length === 0) {
        throw new Error('No targets found. Run matching and ranking first.');
      }
      
      // Generate plan items
      const planItems: ConferencePlanItem[] = attendees.map((att, index) => {
        const { recommended_action, primary_cta } = getConferencePlanCTA(att);
        return {
          id: crypto.randomUUID(),
          rank: index + 1,
          attendee_id: att.id,
          attendee_name: att.raw_full_name,
          organization: att.raw_org,
          title: att.raw_title,
          recommended_action,
          primary_cta,
          score: att.target_score || 0,
          reasons: [
            ...(Array.isArray(att.target_reasons) ? (att.target_reasons as string[]) : []),
            'Conference plan target',
          ],
          status: 'open' as const,
        };
      });
      
      // Save to event
      const { error } = await supabase
        .from('events')
        .update({
          conference_plan_json: planItems as unknown as Json,
          conference_plan_generated_at: new Date().toISOString(),
        })
        .eq('id', eventId);
      
      if (error) throw error;
      
      return { count: planItems.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(`Conference plan generated with ${result.count} targets`);
    },
    onError: (error) => {
      toast.error(`Plan generation failed: ${error.message}`);
    },
  });
}

// ============================================================================
// MUTATION: Update conference plan item status
// ============================================================================

export function useUpdateConferencePlanItem(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { itemId: string; status: 'open' | 'done' | 'dismissed' }) => {
      const { itemId, status } = params;
      
      // Fetch current event for optimistic concurrency
      const { data: current, error: fetchError } = await supabase
        .from('events')
        .select('updated_at, conference_plan_json')
        .eq('id', eventId)
        .single();
      
      if (fetchError || !current) {
        throw new Error('Event not found');
      }
      
      const currentPlan = Array.isArray(current.conference_plan_json) 
        ? current.conference_plan_json as unknown as ConferencePlanItem[]
        : [];
      
      const updatedPlan = currentPlan.map(item => 
        item.id === itemId ? { ...item, status } : item
      );
      
      // Update with optimistic concurrency check
      const { data, error } = await supabase
        .from('events')
        .update({ conference_plan_json: updatedPlan as unknown as Json })
        .eq('id', eventId)
        .eq('updated_at', current.updated_at)
        .select('id')
        .single();
      
      if (error || !data) {
        throw new Error('Update conflict. Please refresh and try again.');
      }
      
      return { itemId, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: (error) => {
      const message = error.message;
      if (message.toLowerCase().includes('conflict')) {
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['event', eventId] });
        queryClient.invalidateQueries({ queryKey: ['events', eventId] });
        toast.error(message);
      } else {
        toast.error(`Update failed: ${message}`);
      }
    },
  });
}

// ============================================================================
// MUTATION: Generate event follow-ups (calls edge function)
// ============================================================================

export function useGenerateEventFollowups(eventId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) throw new Error('Not authenticated');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/profunda-ai?mode=event-followups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate follow-ups');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      toast.success(`Generated ${result.suggestions_created || 0} follow-up suggestions`);
    },
    onError: (error) => {
      toast.error(`Follow-up generation failed: ${error.message}`);
    },
  });
}

// ============================================================================
// HELPER: Find or create opportunity by org name
// ============================================================================

async function findOrCreateOpportunity(
  orgName: string | null,
  tenantId: string | null,
  eventMetroId: string | null,
): Promise<string | null> {
  if (!orgName || !orgName.trim()) return null;

  const trimmed = orgName.trim();

  // Search for existing opportunity by org name (case-insensitive)
  const { data: existing } = await supabase
    .from('opportunities')
    .select('id')
    .ilike('organization', trimmed)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create a new opportunity
  const { data: created, error } = await supabase
    .from('opportunities')
    .insert({
      opportunity_id: crypto.randomUUID().slice(0, 8).toUpperCase(),
      organization: trimmed,
      stage: 'Found',
      status: 'Active',
      tenant_id: tenantId,
      metro_id: eventMetroId,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Failed to create opportunity for "${trimmed}":`, error);
    return null;
  }

  return created.id;
}

// ============================================================================
// MUTATION: Create contact from attendee (individual)
// ============================================================================

export function useCreateContactFromAttendee(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendee: EventAttendee) => {
      // Skip if already matched to a contact
      if (attendee.matched_contact_id) {
        throw new Error('This attendee is already linked to a contact');
      }

      // Check for duplicate by email
      if (attendee.raw_email) {
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('email', attendee.raw_email)
          .limit(1)
          .maybeSingle();

        if (existing) {
          // Link existing contact instead of creating duplicate
          await supabase
            .from('event_attendees')
            .update({
              matched_contact_id: existing.id,
              match_status: 'matched',
              confidence_score: 1.0,
            })
            .eq('id', attendee.id);

          return { created: false, contactId: existing.id, skipped: true };
        }
      }

      // Get event's tenant_id
      const { data: event } = await supabase
        .from('events')
        .select('tenant_id, metro_id')
        .eq('id', eventId)
        .maybeSingle();

      // Resolve opportunity: use existing match, or find/create from org name
      const opportunityId = attendee.matched_opportunity_id
        || await findOrCreateOpportunity(attendee.raw_org, event?.tenant_id || null, event?.metro_id || null);

      // Create the contact
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          contact_id: crypto.randomUUID().slice(0, 8).toUpperCase(),
          name: attendee.raw_full_name,
          title: attendee.raw_title || null,
          email: attendee.raw_email || null,
          phone: attendee.raw_phone || null,
          met_at_event_id: eventId,
          opportunity_id: opportunityId,
          tenant_id: event?.tenant_id || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Link back to attendee
      await supabase
        .from('event_attendees')
        .update({
          matched_contact_id: contact.id,
          match_status: 'matched',
          confidence_score: 1.0,
        })
        .eq('id', attendee.id);

      return { created: true, contactId: contact.id, skipped: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      if (result.skipped) {
        toast.info('Contact already exists — linked to attendee');
      } else {
        toast.success('Contact created from attendee');
      }
    },
    onError: (error) => {
      toast.error(`Failed to create contact: ${error.message}`);
    },
  });
}

// ============================================================================
// MUTATION: Bulk create contacts from all new attendees
// ============================================================================

export function useBulkCreateContactsFromAttendees(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendees: EventAttendee[]) => {
      const newAttendees = attendees.filter(
        a => !a.matched_contact_id && (a.match_status === 'new' || a.match_status === 'unmatched')
      );

      if (newAttendees.length === 0) {
        return { created: 0, skipped: 0 };
      }

      // Get event's tenant_id and metro_id
      const { data: event } = await supabase
        .from('events')
        .select('tenant_id, metro_id')
        .eq('id', eventId)
        .maybeSingle();

      // Collect existing emails for dedup
      const emails = newAttendees
        .map(a => a.raw_email)
        .filter((e): e is string => !!e && e.trim() !== '');

      let existingByEmail: Record<string, string> = {};
      if (emails.length > 0) {
        const { data: existing } = await supabase
          .from('contacts')
          .select('id, email')
          .in('email', emails);

        for (const c of existing || []) {
          if (c.email) existingByEmail[c.email.toLowerCase()] = c.id;
        }
      }

      // Cache resolved org → opportunity_id to avoid duplicate lookups
      const orgOppCache: Record<string, string | null> = {};

      let created = 0;
      let skipped = 0;

      for (const att of newAttendees) {
        const emailKey = att.raw_email?.toLowerCase();
        const existingId = emailKey ? existingByEmail[emailKey] : undefined;

        if (existingId) {
          // Link existing contact
          await supabase
            .from('event_attendees')
            .update({
              matched_contact_id: existingId,
              match_status: 'matched',
              confidence_score: 1.0,
            })
            .eq('id', att.id);
          skipped++;
          continue;
        }

        // Resolve opportunity: use existing match, or find/create from org name
        let opportunityId = att.matched_opportunity_id || null;
        if (!opportunityId && att.raw_org) {
          const cacheKey = att.raw_org.trim().toLowerCase();
          if (cacheKey in orgOppCache) {
            opportunityId = orgOppCache[cacheKey];
          } else {
            opportunityId = await findOrCreateOpportunity(att.raw_org, event?.tenant_id || null, event?.metro_id || null);
            orgOppCache[cacheKey] = opportunityId;
          }
        }

        // Create new contact
        const { data: contact, error } = await supabase
          .from('contacts')
          .insert({
            contact_id: crypto.randomUUID().slice(0, 8).toUpperCase(),
            name: att.raw_full_name,
            title: att.raw_title || null,
            email: att.raw_email || null,
            phone: att.raw_phone || null,
            met_at_event_id: eventId,
            opportunity_id: opportunityId,
            tenant_id: event?.tenant_id || null,
          })
          .select('id')
          .single();

        if (error) {
          console.error(`Failed to create contact for ${att.raw_full_name}:`, error);
          continue;
        }

        // Link back
        await supabase
          .from('event_attendees')
          .update({
            matched_contact_id: contact.id,
            match_status: 'matched',
            confidence_score: 1.0,
          })
          .eq('id', att.id);

        created++;
      }

      return { created, skipped };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      const parts = [];
      if (result.created > 0) parts.push(`${result.created} created`);
      if (result.skipped > 0) parts.push(`${result.skipped} linked to existing`);
      toast.success(`Contacts: ${parts.join(', ') || 'none to create'}`);
    },
    onError: (error) => {
      toast.error(`Bulk contact creation failed: ${error.message}`);
    },
  });
}
