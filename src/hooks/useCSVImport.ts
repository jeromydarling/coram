import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLogAudit } from './useAuditLog';
import { extractHouseholdFromRow, type HouseholdMemberInput } from '@/utils/parseHousehold';

// Note: mission_snapshot, best_partnership_angle, and grant_alignment are free-text
// arrays on the opportunity. They do NOT need to be inserted into lookup tables.
// Lookup tables are admin-curated defaults only.


// Helper to parse pipe-separated values from CSV
function parsePipeSeparatedValues(value: string | null | undefined): string[] {
  if (!value || value.trim() === '') return [];
  
  // Split by pipe, trim whitespace
  return value
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Valid partner tier values from the database enum
const VALID_PARTNER_TIERS = ['Anchor', 'Distribution', 'Referral', 'Workforce', 'Housing', 'Education', 'Other'] as const;
type PartnerTier = typeof VALID_PARTNER_TIERS[number];

// Valid opportunity stage values from the database enum
const VALID_OPPORTUNITY_STAGES = [
  'Target Identified', 'Contacted', 'Discovery Scheduled', 'Discovery Held',
  'Proposal Sent', 'Agreement Pending', 'Agreement Signed', 'First Volume',
  'Stable Producer', 'Closed - Not a Fit'
] as const;

// Stage aliases for common CSV values
const STAGE_ALIASES: Record<string, typeof VALID_OPPORTUNITY_STAGES[number]> = {
  'Prospect': 'Target Identified',
  'Lead': 'Target Identified',
  'Qualified': 'Discovery Scheduled',
  'Negotiation': 'Proposal Sent',
  'Closed Won': 'Agreement Signed',
  'Closed Lost': 'Closed - Not a Fit',
};
type OpportunityStage = typeof VALID_OPPORTUNITY_STAGES[number];

// Helper to validate and filter partner tiers to only valid enum values
function validatePartnerTiers(tiers: string[]): PartnerTier[] {
  return tiers.filter((tier): tier is PartnerTier => 
    VALID_PARTNER_TIERS.includes(tier as PartnerTier)
  );
}

// Helper to validate opportunity stage (with aliases for common values)
function validateOpportunityStage(stage: string | null | undefined): OpportunityStage | null {
  if (!stage) return null;
  const trimmed = stage.trim();
  
  // Check if it's a valid stage directly
  if (VALID_OPPORTUNITY_STAGES.includes(trimmed as OpportunityStage)) {
    return trimmed as OpportunityStage;
  }
  
  // Check aliases
  if (STAGE_ALIASES[trimmed]) {
    return STAGE_ALIASES[trimmed];
  }
  
  console.warn(`Stage "${trimmed}" not recognized, defaulting to Target Identified`);
  return 'Target Identified';
}

// ─── Batch helper: normalize a contact name for dedup matching ───
function normalizeNameForDedup(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ImportTrackingRecord {
  entity_type: string;
  entity_id: string;
  operation: 'created' | 'updated';
  previous_data?: Record<string, unknown> | null;
}

// ─── Parsed contact row (intermediate) ───
interface ParsedContact {
  raw: Record<string, unknown>;
  contactName: string;
  contactEmail: string | null;
  orgName: string | null;
  missionSnapshots: string[];
  partnershipAngles: string[];
  partnerTiers: PartnerTier[];
  grantAlignments: string[];
  stage: OpportunityStage | null;
  metroValue: string | null;
}

export function useImportContacts() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();

  return useMutation({
    mutationFn: async (contacts: Record<string, unknown>[]) => {
      const trackedRecords: ImportTrackingRecord[] = [];
      let opportunitiesCreated = 0;
      let createdCount = 0;
      let updatedCount = 0;
      let householdMembersInserted = 0;
      
      console.log(`Starting batch import of ${contacts.length} contacts...`);
      const startTime = Date.now();

      // ═══════════════════════════════════════════════
      // PHASE 1: Parse all rows synchronously
      // ═══════════════════════════════════════════════
      const parsed: ParsedContact[] = contacts.map(contact => {
        const missionSnapshots = parsePipeSeparatedValues(contact.mission_snapshot ? String(contact.mission_snapshot) : null);
        const partnershipAngles = parsePipeSeparatedValues(contact.best_partnership_angle ? String(contact.best_partnership_angle) : null);
        const rawPartnerTiers = parsePipeSeparatedValues(contact.partner_tiers ? String(contact.partner_tiers) : null);
        const partnerTiers = validatePartnerTiers(rawPartnerTiers);
        const grantAlignments = parsePipeSeparatedValues(contact.grant_alignment ? String(contact.grant_alignment) : null);
        const stage = validateOpportunityStage(contact.stage ? String(contact.stage) : null);
        const metroValue = contact.metro ? String(contact.metro).trim() : null;

        return {
          raw: contact,
          contactName: String(contact.name || '').trim(),
          contactEmail: contact.email ? String(contact.email).trim().toLowerCase() : null,
          orgName: contact.organization ? String(contact.organization).trim() : null,
          missionSnapshots,
          partnershipAngles,
          partnerTiers,
          grantAlignments,
          stage,
          metroValue,
        };
      });

      console.log(`Phase 1 complete: ${parsed.length} rows parsed`);

      // ═══════════════════════════════════════════════
      // PHASE 2: Bulk resolve metros
      // ═══════════════════════════════════════════════
      const uniqueMetroNames = [...new Set(parsed.map(p => p.metroValue).filter(Boolean))] as string[];
      const metroNameToId = new Map<string, string>();

      if (uniqueMetroNames.length > 0) {
        // Fetch metros by name (case-insensitive via ilike would need per-item, use in() for exact + tolower)
        const { data: metros } = await supabase
          .from('metros')
          .select('id, metro')
          .limit(500);

        if (metros) {
          const metroLookup = new Map(metros.map(m => [m.metro.toLowerCase(), m.id]));
          for (const name of uniqueMetroNames) {
            const id = metroLookup.get(name.toLowerCase());
            if (id) metroNameToId.set(name, id);
          }
        }

        // For unresolved names, try regions
        const unresolvedMetros = uniqueMetroNames.filter(n => !metroNameToId.has(n));
        if (unresolvedMetros.length > 0) {
          const { data: regions } = await supabase
            .from('regions')
            .select('id, name')
            .limit(200);

          if (regions) {
            const regionLookup = new Map(regions.map(r => [r.name.toLowerCase(), r.id]));
            const regionIdsToResolve: string[] = [];
            const regionNameToMetroName = new Map<string, string>();

            for (const name of unresolvedMetros) {
              const regionId = regionLookup.get(name.toLowerCase());
              if (regionId) {
                regionIdsToResolve.push(regionId);
                regionNameToMetroName.set(regionId, name);
              }
            }

            if (regionIdsToResolve.length > 0) {
              const { data: regionMetros } = await supabase
                .from('metros')
                .select('id, region_id')
                .in('region_id', regionIdsToResolve)
                .order('metro', { ascending: true });

              if (regionMetros) {
                const regionToFirstMetro = new Map<string, string>();
                for (const m of regionMetros) {
                  if (m.region_id && !regionToFirstMetro.has(m.region_id)) {
                    regionToFirstMetro.set(m.region_id, m.id);
                  }
                }
                for (const [regionId, metroId] of regionToFirstMetro) {
                  const originalName = regionNameToMetroName.get(regionId);
                  if (originalName) metroNameToId.set(originalName, metroId);
                }
              }
            }
          }
        }
      }

      console.log(`Phase 2 complete: ${metroNameToId.size}/${uniqueMetroNames.length} metros resolved`);

      // ═══════════════════════════════════════════════
      // PHASE 3: Bulk resolve/create opportunities
      // ═══════════════════════════════════════════════
      const uniqueOrgNames = [...new Set(parsed.map(p => p.orgName).filter(Boolean))] as string[];
      const orgNameToOppId = new Map<string, string>();
      const existingOppData = new Map<string, Record<string, unknown>>();

      if (uniqueOrgNames.length > 0) {
        // Fetch all existing opportunities by org name
        // Use chunks of 100 for the in() query
        for (let i = 0; i < uniqueOrgNames.length; i += 100) {
          const chunk = uniqueOrgNames.slice(i, i + 100);
          const { data: existingOpps } = await supabase
            .from('opportunities')
            .select('id, organization, mission_snapshot, best_partnership_angle, partner_tiers, grant_alignment, stage, metro_id')
            .in('organization', chunk);

          if (existingOpps) {
            for (const opp of existingOpps) {
              orgNameToOppId.set(opp.organization, opp.id);
              existingOppData.set(opp.organization, opp as unknown as Record<string, unknown>);
            }
          }
        }

        // Collect orgs that need to be created
        const orgsToCreate: string[] = uniqueOrgNames.filter(n => !orgNameToOppId.has(n));

        // Aggregate data from all rows for each org (for merge fields on new orgs)
        const orgAggregated = new Map<string, {
          missionSnapshots: Set<string>;
          partnershipAngles: Set<string>;
          partnerTiers: Set<string>;
          grantAlignments: Set<string>;
          stage: OpportunityStage | null;
          metroId: string | null;
        }>();

        for (const p of parsed) {
          if (!p.orgName) continue;
          if (!orgAggregated.has(p.orgName)) {
            orgAggregated.set(p.orgName, {
              missionSnapshots: new Set(),
              partnershipAngles: new Set(),
              partnerTiers: new Set(),
              grantAlignments: new Set(),
              stage: null,
              metroId: null,
            });
          }
          const agg = orgAggregated.get(p.orgName)!;
          p.missionSnapshots.forEach(s => agg.missionSnapshots.add(s));
          p.partnershipAngles.forEach(s => agg.partnershipAngles.add(s));
          p.partnerTiers.forEach(s => agg.partnerTiers.add(s));
          p.grantAlignments.forEach(s => agg.grantAlignments.add(s));
          if (p.stage && !agg.stage) agg.stage = p.stage;
          if (p.metroValue && !agg.metroId) {
            agg.metroId = metroNameToId.get(p.metroValue) || null;
          }
        }

        // Batch-create new opportunities in chunks of 100
        if (orgsToCreate.length > 0) {
          for (let i = 0; i < orgsToCreate.length; i += 100) {
            const chunk = orgsToCreate.slice(i, i + 100);
            const insertPayloads = chunk.map(orgName => {
              const agg = orgAggregated.get(orgName);
              const partnerTiersArr = agg ? [...agg.partnerTiers].filter((t): t is PartnerTier => VALID_PARTNER_TIERS.includes(t as PartnerTier)) : [];
              const finalTiers = partnerTiersArr.length > 0 ? partnerTiersArr : ['Other' as PartnerTier];

              return {
                opportunity_id: `OPP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                organization: orgName,
                stage: agg?.stage || 'Target Identified',
                status: 'Active' as const,
                partner_tier: finalTiers[0],
                partner_tiers: finalTiers,
                mission_snapshot: agg && agg.missionSnapshots.size > 0 ? [...agg.missionSnapshots] : null,
                best_partnership_angle: agg && agg.partnershipAngles.size > 0 ? [...agg.partnershipAngles] : null,
                grant_alignment: agg && agg.grantAlignments.size > 0 ? [...agg.grantAlignments] : null,
                metro_id: agg?.metroId || null,
              };
            });

            const { data: created, error } = await supabase
              .from('opportunities')
              .insert(insertPayloads)
              .select('id, organization');

            if (error) {
              console.warn('Batch opportunity create error:', error.message);
              // Fallback: try one-by-one
              for (const payload of insertPayloads) {
                const { data: single, error: singleErr } = await supabase
                  .from('opportunities')
                  .insert(payload)
                  .select('id, organization')
                  .single();
                if (!singleErr && single) {
                  orgNameToOppId.set(single.organization, single.id);
                  opportunitiesCreated++;
                }
              }
            } else if (created) {
              for (const opp of created) {
                orgNameToOppId.set(opp.organization, opp.id);
                opportunitiesCreated++;
              }
            }
          }
        }

        // Update existing opportunities with merged fields
        const existingOrgsToUpdate = uniqueOrgNames.filter(n => existingOppData.has(n));
        const updatePromises: Promise<void>[] = [];

        for (const orgName of existingOrgsToUpdate) {
          const existing = existingOppData.get(orgName)!;
          const agg = orgAggregated.get(orgName);
          if (!agg) continue;

          const updates: Record<string, unknown> = {};

          // Merge array fields
          const mergeArrayField = (fieldName: string, newValues: Set<string>) => {
            if (newValues.size === 0) return;
            const existingArr = (existing[fieldName] as string[]) || [];
            const merged = [...new Set([...existingArr, ...newValues])];
            if (merged.length > existingArr.length) {
              updates[fieldName] = merged;
            }
          };

          mergeArrayField('mission_snapshot', agg.missionSnapshots);
          mergeArrayField('best_partnership_angle', agg.partnershipAngles);
          mergeArrayField('grant_alignment', agg.grantAlignments);

          if (agg.partnerTiers.size > 0) {
            const existingTiers = (existing.partner_tiers as string[]) || [];
            const validNewTiers = [...agg.partnerTiers].filter((t): t is PartnerTier => VALID_PARTNER_TIERS.includes(t as PartnerTier));
            const merged = [...new Set([...existingTiers, ...validNewTiers])];
            if (merged.length > existingTiers.length) {
              updates.partner_tiers = merged;
            }
          }

          if (agg.stage && existing.stage !== agg.stage) {
            updates.stage = agg.stage;
          }
          if (agg.metroId && existing.metro_id !== agg.metroId) {
            updates.metro_id = agg.metroId;
          }

          if (Object.keys(updates).length > 0) {
            updatePromises.push(
              (async () => {
                await supabase
                  .from('opportunities')
                  .update(updates)
                  .eq('id', existing.id as string);
              })()
            );
          }
        }

        // Execute updates in parallel groups of 10
        for (let i = 0; i < updatePromises.length; i += 10) {
          await Promise.all(updatePromises.slice(i, i + 10));
        }
      }

      console.log(`Phase 3 complete: ${orgNameToOppId.size} orgs resolved (${opportunitiesCreated} created)`);

      // ═══════════════════════════════════════════════
      // PHASE 4: Bulk dedup contacts
      // ═══════════════════════════════════════════════
      const allOppIds = [...new Set([...orgNameToOppId.values()])];
      const existingContactsByOpp = new Map<string, { id: string; name: string; email: string | null; opportunity_id: string | null; title: string | null; phone: string | null; is_primary: boolean | null; notes: string | null }[]>();

      if (allOppIds.length > 0) {
        for (let i = 0; i < allOppIds.length; i += 100) {
          const chunk = allOppIds.slice(i, i + 100);
          const { data: existingContacts } = await supabase
            .from('contacts')
            .select('id, name, email, opportunity_id, title, phone, is_primary, notes')
            .in('opportunity_id', chunk);

          if (existingContacts) {
            for (const c of existingContacts) {
              if (!c.opportunity_id) continue;
              if (!existingContactsByOpp.has(c.opportunity_id)) {
                existingContactsByOpp.set(c.opportunity_id, []);
              }
              existingContactsByOpp.get(c.opportunity_id)!.push(c);
            }
          }
        }
      }

      console.log(`Phase 4 complete: ${[...existingContactsByOpp.values()].reduce((s, a) => s + a.length, 0)} existing contacts loaded`);

      // ═══════════════════════════════════════════════
      // PHASE 5: Partition into toCreate and toUpdate
      // ═══════════════════════════════════════════════
      interface CreateEntry { parsed: ParsedContact; opportunityId: string | null; contactId: string; }
      interface UpdateEntry { parsed: ParsedContact; existingId: string; opportunityId: string | null; previousData: Record<string, unknown>; }

      const toCreate: CreateEntry[] = [];
      const toUpdate: UpdateEntry[] = [];

      for (const p of parsed) {
        if (!p.contactName) continue;
        
        const opportunityId = p.orgName ? (orgNameToOppId.get(p.orgName) || null) : null;
        const normalizedName = normalizeNameForDedup(p.contactName);

        // Try to find existing contact
        let existing: typeof existingContactsByOpp extends Map<string, (infer T)[]> ? T : never | null = null;

        if (opportunityId) {
          const oppContacts = existingContactsByOpp.get(opportunityId) || [];
          // Match by name + email
          if (p.contactEmail) {
            existing = oppContacts.find(c => 
              c.email?.toLowerCase() === p.contactEmail && normalizeNameForDedup(c.name) === normalizedName
            ) || null;
          }
          // Match by name + opportunity
          if (!existing) {
            existing = oppContacts.find(c => normalizeNameForDedup(c.name) === normalizedName) || null;
          }
        } else if (p.contactEmail) {
          // No org: match by name + email globally (skip expensive global query — only per-opp dedup)
        }

        if (existing) {
          toUpdate.push({
            parsed: p,
            existingId: existing.id,
            opportunityId: opportunityId || existing.opportunity_id,
            previousData: {
              title: existing.title,
              email: existing.email,
              phone: existing.phone,
              is_primary: existing.is_primary,
              notes: existing.notes,
              opportunity_id: existing.opportunity_id,
            }
          });
        } else {
          toCreate.push({
            parsed: p,
            opportunityId,
            contactId: `CON-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          });
        }
      }

      console.log(`Phase 5 complete: ${toCreate.length} to create, ${toUpdate.length} to update`);

      // ═══════════════════════════════════════════════
      // PHASE 6: Batch insert new contacts (chunks of 100)
      // ═══════════════════════════════════════════════
      const createdContacts: { id: string; entry: CreateEntry }[] = [];

      for (let i = 0; i < toCreate.length; i += 100) {
        const chunk = toCreate.slice(i, i + 100);
        const insertPayloads = chunk.map(entry => ({
          contact_id: entry.contactId,
          name: entry.parsed.contactName,
          title: entry.parsed.raw.title ? String(entry.parsed.raw.title) : null,
          email: entry.parsed.contactEmail,
          phone: entry.parsed.raw.phone ? String(entry.parsed.raw.phone) : null,
          is_primary: Boolean(entry.parsed.raw.is_primary),
          notes: entry.parsed.raw.notes ? String(entry.parsed.raw.notes) : null,
          opportunity_id: entry.opportunityId,
        }));

        const { data: inserted, error } = await supabase
          .from('contacts')
          .insert(insertPayloads)
          .select('id');

        if (error) {
          console.warn('Batch contact insert error, falling back to sequential:', error.message);
          // Fallback: one-by-one
          for (let j = 0; j < insertPayloads.length; j++) {
            const { data: single, error: singleErr } = await supabase
              .from('contacts')
              .insert(insertPayloads[j])
              .select('id')
              .single();
            if (!singleErr && single) {
              createdContacts.push({ id: single.id, entry: chunk[j] });
              createdCount++;
              trackedRecords.push({ entity_type: 'contact', entity_id: single.id, operation: 'created', previous_data: null });
            }
          }
        } else if (inserted) {
          for (let j = 0; j < inserted.length; j++) {
            createdContacts.push({ id: inserted[j].id, entry: chunk[j] });
            createdCount++;
            trackedRecords.push({ entity_type: 'contact', entity_id: inserted[j].id, operation: 'created', previous_data: null });
          }
        }
      }

      console.log(`Phase 6 complete: ${createdCount} contacts created`);

      // ═══════════════════════════════════════════════
      // PHASE 7: Batch update existing contacts (parallel groups of 10)
      // ═══════════════════════════════════════════════
      for (let i = 0; i < toUpdate.length; i += 10) {
        const chunk = toUpdate.slice(i, i + 10);
        await Promise.all(chunk.map(async (entry) => {
          const p = entry.parsed;
          const { error } = await supabase
            .from('contacts')
            .update({
              title: p.raw.title ? String(p.raw.title) : undefined,
              email: p.contactEmail || undefined,
              phone: p.raw.phone ? String(p.raw.phone) : undefined,
              is_primary: Boolean(p.raw.is_primary),
              notes: p.raw.notes ? String(p.raw.notes) : undefined,
              opportunity_id: entry.opportunityId || undefined,
            })
            .eq('id', entry.existingId);

          if (!error) {
            updatedCount++;
            trackedRecords.push({
              entity_type: 'contact',
              entity_id: entry.existingId,
              operation: 'updated',
              previous_data: entry.previousData,
            });
          }
        }));
      }

      console.log(`Phase 7 complete: ${updatedCount} contacts updated`);

      // ═══════════════════════════════════════════════
      // PHASE 8: Bulk update primary contacts on opportunities
      // ═══════════════════════════════════════════════
      const primaryUpdates: Promise<void>[] = [];

      for (const { id, entry } of createdContacts) {
        if (entry.opportunityId && Boolean(entry.parsed.raw.is_primary)) {
          primaryUpdates.push(
            (async () => {
              await supabase
                .from('opportunities')
                .update({ primary_contact_id: id })
                .eq('id', entry.opportunityId!);
            })()
          );
        }
      }
      for (const entry of toUpdate) {
        if (entry.opportunityId && Boolean(entry.parsed.raw.is_primary)) {
          primaryUpdates.push(
            (async () => {
              await supabase
                .from('opportunities')
                .update({ primary_contact_id: entry.existingId })
                .eq('id', entry.opportunityId!);
            })()
          );
        }
      }

      for (let i = 0; i < primaryUpdates.length; i += 10) {
        await Promise.all(primaryUpdates.slice(i, i + 10));
      }

      // Handle household members for created contacts
      for (const { id, entry } of createdContacts) {
        const { members } = extractHouseholdFromRow(entry.parsed.raw);
        if (members.length > 0) {
          const { data: contactRow } = await supabase
            .from('contacts')
            .select('tenant_id')
            .eq('id', id)
            .single();

          if (contactRow?.tenant_id) {
            const householdRows = members.map((m: HouseholdMemberInput) => ({
              tenant_id: contactRow.tenant_id,
              contact_id: id,
              name: m.name,
              relationship: m.relationship,
              notes: m.notes,
            }));
            const { error: hhError } = await supabase
              .from('contact_household_members')
              .insert(householdRows);
            if (!hhError) {
              householdMembersInserted += members.length;
            }
          }
        }
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);
      console.log(`Import complete! ${createdCount + updatedCount} contacts processed (${householdMembersInserted} household members) in ${duration}s`);
      
      return { 
        results: [...createdContacts.map(c => ({ id: c.id }))],
        opportunitiesCreated, 
        trackedRecords,
        createdCount,
        updatedCount,
        householdMembersInserted
      };
    },
    onSuccess: async ({ results, opportunitiesCreated, trackedRecords, createdCount, updatedCount, householdMembersInserted }) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
      
      // Save import history for rollback capability
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        
        if (userId && trackedRecords.length > 0) {
          // Create import history entry
          const { data: importEntry, error: historyError } = await supabase
            .from('csv_import_history')
            .insert({
              import_type: 'contacts',
              total_rows: results.length,
              created_count: createdCount,
              updated_count: updatedCount,
              imported_by: userId
            })
            .select()
            .single();
          
          if (!historyError && importEntry) {
            // Add tracked records in chunks
            for (let i = 0; i < trackedRecords.length; i += 100) {
              const chunk = trackedRecords.slice(i, i + 100);
              const recordsToInsert = chunk.map(record => ({
                import_id: importEntry.id,
                entity_type: record.entity_type,
                entity_id: record.entity_id,
                operation: record.operation,
                previous_data: record.previous_data ? JSON.parse(JSON.stringify(record.previous_data)) : null
              }));
              
              await supabase.from('csv_import_records').insert(recordsToInsert);
            }
          }
        }
      } catch (e) {
        console.error('Failed to save import history:', e);
      }
      
      let message = `Successfully imported ${results.length} contacts`;
      const extras = [];
      if (opportunitiesCreated > 0) {
        extras.push(`${opportunitiesCreated} new organizations`);
      }
      if (householdMembersInserted > 0) {
        extras.push(`${householdMembersInserted} household members`);
      }
      if (extras.length > 0) {
        message += ` (${extras.join(', ')})`;
      }
      toast.success(message);
      
      logAudit.mutate({
        action: 'import',
        entityType: 'contact',
        entityId: 'bulk',
        entityName: `${results.length} contacts imported`
      });
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    }
  });
}

export interface EventImportPayload {
  event_name: string;
  event_date: string;
  end_date?: string | null;
  metro_id?: string;
  event_type?: string | null;
  staff_deployed?: number;
  households_served?: number;
  devices_distributed?: number;
  internet_signups?: number;
  referrals_generated?: number;
  cost_estimated?: number;
  anchor_identified_yn?: boolean;
  followup_meeting_yn?: boolean;
  grant_narrative_value?: 'High' | 'Medium' | 'Low';
  notes?: string;
  city?: string;
  host_organization?: string;
  target_populations?: string[];
  strategic_lanes?: string[];
  pcs_goals?: string[];
  priority?: 'High' | 'Medium' | 'Low';
  status?: 'Registered' | 'Not Registered';
  travel_required?: 'Local' | 'Regional';
  expected_households?: string;
  expected_referrals?: string;
  anchor_potential?: 'High' | 'Medium' | 'Very High' | 'Extremely High';
  is_recurring?: boolean;
  recurrence_pattern?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  recurrence_end_date?: string;
  url?: string;
  description?: string;
}

// Helper to ensure event type exists, creating it if needed
async function ensureEventTypeExists(eventType: string | null | undefined): Promise<string | null> {
  if (!eventType || eventType.trim() === '') return null;
  
  const trimmedType = eventType.trim();
  
  const { data: existing } = await supabase
    .from('event_types')
    .select('name')
    .eq('name', trimmedType)
    .maybeSingle();
  
  if (existing) {
    return trimmedType;
  }
  
  const { data: maxOrder } = await supabase
    .from('event_types')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const newSortOrder = (maxOrder?.sort_order || 0) + 1;
  
  const { error } = await supabase
    .from('event_types')
    .insert({ name: trimmedType, sort_order: newSortOrder });
  
  if (error) {
    console.warn(`Failed to create event type "${trimmedType}":`, error.message);
    return null;
  }
  
  return trimmedType;
}

export interface ImportEventsOptions {
  upsertMode?: boolean;
}

export function useImportEvents() {
  const queryClient = useQueryClient();
  const logAudit = useLogAudit();

  return useMutation({
    mutationFn: async ({ events, options }: { events: EventImportPayload[]; options?: ImportEventsOptions }) => {
      const results = [];
      const trackedRecords: ImportTrackingRecord[] = [];
      let insertedCount = 0;
      let updatedCount = 0;
      
      // Collect unique event types and ensure they all exist first
      const uniqueEventTypes = [...new Set(events.map(e => e.event_type).filter(Boolean))];
      const eventTypeMap = new Map<string, string | null>();
      
      for (const eventType of uniqueEventTypes) {
        if (eventType) {
          const validatedType = await ensureEventTypeExists(eventType);
          eventTypeMap.set(eventType, validatedType);
        }
      }

      // If upsert mode, fetch existing events by name for matching
      let existingEventsByName = new Map<string, Record<string, unknown>>();
      if (options?.upsertMode) {
        const eventNames = events.map(e => e.event_name);
        const { data: existingEvents } = await supabase
          .from('events')
          .select('*')
          .in('event_name', eventNames);
        
        if (existingEvents) {
          existingEvents.forEach(e => {
            existingEventsByName.set(e.event_name, e as unknown as Record<string, unknown>);
          });
        }
      }
      
      for (const event of events) {
        const validatedEventType = event.event_type 
          ? eventTypeMap.get(event.event_type) ?? event.event_type 
          : null;

        const eventPayload = {
          event_name: event.event_name,
          event_date: event.event_date,
          end_date: event.end_date || null,
          metro_id: event.metro_id || null,
          event_type: validatedEventType,
          staff_deployed: event.staff_deployed || 0,
          households_served: event.households_served || 0,
          devices_distributed: event.devices_distributed || 0,
          internet_signups: event.internet_signups || 0,
          referrals_generated: event.referrals_generated || 0,
          cost_estimated: event.cost_estimated || 0,
          anchor_identified_yn: event.anchor_identified_yn || false,
          followup_meeting_yn: event.followup_meeting_yn || false,
          grant_narrative_value: event.grant_narrative_value || 'Medium',
          notes: event.notes || null,
          city: event.city || null,
          host_organization: event.host_organization || null,
          target_populations: event.target_populations || null,
          strategic_lanes: event.strategic_lanes || null,
          pcs_goals: event.pcs_goals || null,
          priority: event.priority || null,
          status: event.status || null,
          travel_required: event.travel_required || null,
          expected_households: event.expected_households || null,
          expected_referrals: event.expected_referrals || null,
          anchor_potential: event.anchor_potential || null,
          is_recurring: event.is_recurring || false,
          recurrence_pattern: event.recurrence_pattern || null,
          recurrence_end_date: event.recurrence_end_date || null,
          url: event.url || null,
          description: event.description || null,
        };

        const existingEvent = existingEventsByName.get(event.event_name);

        if (options?.upsertMode && existingEvent) {
          const { data, error } = await supabase
            .from('events')
            .update(eventPayload)
            .eq('id', existingEvent.id as string)
            .select()
            .single();

          if (error) throw error;
          results.push(data);
          updatedCount++;
          
          trackedRecords.push({
            entity_type: 'event',
            entity_id: existingEvent.id as string,
            operation: 'updated',
            previous_data: existingEvent
          });
        } else {
          const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const { data, error } = await supabase
            .from('events')
            .insert({
              event_id: eventId,
              ...eventPayload
            })
            .select()
            .single();

          if (error) throw error;
          results.push(data);
          insertedCount++;
          
          trackedRecords.push({
            entity_type: 'event',
            entity_id: data.id,
            operation: 'created',
            previous_data: null
          });
        }
      }
      
      return { results, trackedRecords, insertedCount, updatedCount };
    },
    onSuccess: async ({ results, trackedRecords, insertedCount, updatedCount }) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
      
      // Save import history for rollback
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        
        if (userId && trackedRecords.length > 0) {
          const { data: importEntry, error: historyError } = await supabase
            .from('csv_import_history')
            .insert({
              import_type: 'events' as 'contacts' | 'events' | 'grants',
              total_rows: results.length,
              created_count: insertedCount,
              updated_count: updatedCount,
              imported_by: userId
            })
            .select()
            .single();
          
          if (!historyError && importEntry) {
            const recordsToInsert = trackedRecords.map(record => ({
              import_id: importEntry.id,
              entity_type: record.entity_type,
              entity_id: record.entity_id,
              operation: record.operation,
              previous_data: record.previous_data ? JSON.parse(JSON.stringify(record.previous_data)) : null
            }));
            
            await supabase.from('csv_import_records').insert(recordsToInsert);
          }
        }
      } catch (e) {
        console.error('Failed to save event import history:', e);
      }
      
      const message = `Imported ${results.length} events (${insertedCount} new, ${updatedCount} updated)`;
      toast.success(message);
      
      logAudit.mutate({
        action: 'import',
        entityType: 'event',
        entityId: 'bulk',
        entityName: `${results.length} events imported`
      });
    },
    onError: (error) => {
      toast.error(`Event import failed: ${error.message}`);
    }
  });
}
