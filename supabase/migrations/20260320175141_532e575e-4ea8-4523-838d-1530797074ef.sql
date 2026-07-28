-- Expand demo anon SELECT policies — batch 2 (corrected for column existence)

-- Core tables with tenant_id
CREATE POLICY "demo_anon_contact_household" ON public.contact_household_members FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_life_events" ON public.life_events FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_activity_impact" ON public.activity_impact FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_activity_participants" ON public.activity_participants FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Narrative & story tables
CREATE POLICY "demo_anon_narrative_threads" ON public.narrative_threads FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_narrative_moments" ON public.narrative_moments FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_narrative_story_drafts" ON public.narrative_story_drafts FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_nri_signals" ON public.nri_signals FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_nri_story_signals" ON public.nri_story_signals FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Event registration fields
CREATE POLICY "demo_anon_event_reg_fields" ON public.event_registration_fields FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Communio tables
CREATE POLICY "demo_anon_communio_memberships" ON public.communio_memberships FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_communio_shared_events" ON public.communio_shared_events FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_communio_shared_signals" ON public.communio_shared_signals FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_communio_activity" ON public.communio_activity_log FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_communio_public_profiles" ON public.communio_public_profiles FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Discovery & intelligence
CREATE POLICY "demo_anon_discovery_briefings" ON public.discovery_briefings FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_discovery_runs" ON public.discovery_runs FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_discovery_signals" ON public.discovery_signals FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Email campaigns (read-only)
CREATE POLICY "demo_anon_email_campaigns" ON public.email_campaigns FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_email_comms" ON public.email_communications FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Testimonium
CREATE POLICY "demo_anon_testimonium_events" ON public.testimonium_events FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Field notes & provisions
CREATE POLICY "demo_anon_field_notes" ON public.field_notes FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Tenant config
CREATE POLICY "demo_anon_tenant_settings" ON public.tenant_settings FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_tenant_users" ON public.tenant_users FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_entity_richness" ON public.entity_richness_overrides FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_compass_state" ON public.compass_user_state FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Archive
CREATE POLICY "demo_anon_archive_reflections" ON public.archive_reflections FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));

-- Global reference tables (no tenant_id, public read)
CREATE POLICY "demo_anon_metros" ON public.metros FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_regions" ON public.regions FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_archetypes" ON public.archetypes FOR SELECT TO anon USING (true);
CREATE POLICY "demo_anon_archetype_profiles" ON public.archetype_profiles FOR SELECT TO anon USING (true);

-- Expansion & momentum
CREATE POLICY "demo_anon_expansion_signals" ON public.expansion_signals FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));
CREATE POLICY "demo_anon_expansion_moments" ON public.expansion_moments FOR SELECT TO anon USING (public.is_demo_tenant(tenant_id));