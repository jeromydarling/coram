-- ============================================================================
-- CROS Federation — SEO Synthesis: per-satellite templates + meta
-- ============================================================================
-- WHAT: Adds structured SEO metadata to essay_templates and seeds one row per
--       SEO-active federation satellite with its master-prompt fields.
-- WHERE: Lives on thecros. Read by library-essay-pipeline (after augmentation)
--        to generate the monthly synthesis essay for each satellite.
-- WHY:  We need {synthesis_voice}, {audience}, {topic_scope_keywords} for
--       every satellite. Storing them in essay_templates keeps configuration
--       in-database (not in function code), so non-engineering edits become
--       single-row updates.
-- ============================================================================

BEGIN;

-- 1) Add structured SEO metadata column (jsonb so we can grow it later)
ALTER TABLE public.essay_templates
  ADD COLUMN IF NOT EXISTS seo_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.essay_templates.seo_meta IS
  'Structured per-satellite SEO config: {audience, topic_scope_keywords[], primary_domain, schedule_cron}.';

-- 2) The master synthesis prompt — identical text across satellites, with
--    {placeholders} the pipeline fills at runtime from seo_meta + the
--    federated_apps row.
--    Edits to this prompt are a single UPDATE statement.
--
-- Variables substituted by the pipeline at run time:
--   {satellite_display_name}, {primary_domain}, {synthesis_voice},
--   {synthesis_audience}, {topic_scope_keywords}, {month_name}, {year},
--   {seed_summaries}, {seed_count}
--
-- NOTE: We embed the prompt in voice_notes for the legacy daily generator;
--       the new federated pipeline reads it from `prompt`. Both copies stay
--       in sync via this seed.

INSERT INTO public.essay_templates (source_app, name, prompt, voice_notes, category, enabled, seo_meta)
VALUES
-- ── bitoku — martial arts dojo SaaS ────────────────────────────────────────
('bitoku', 'Bitoku Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize the following {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO. Draw connections, identify themes, deliver a unified narrative useful to the audience above.

Structure:
- H1 title (evocative + keyword-aware)
- 3-4 H2 sections with substance
- One concrete example or scenario per H2
- Closing "What to watch in {month_name}" paragraph
- FAQ block of 5 Q&A at the end (use ## FAQ as the section header)

Rules:
- Match the voice cue precisely
- Never use marketing language, CTAs, or "buy/subscribe/sign up"
- Never mention CROS, NRI, the platform, or competitor product names
- Include at most one internal-link placeholder per H2 in the form [INTERNAL_LINK:{primary_domain}/<slug>]
- Cite sources inline like [Source N] referring to the numbered list below
- Output markdown only (no preamble, no closing notes)

SOURCES TO SYNTHESIZE:
{seed_summaries}$prompt$,
'practical, dojo-operator-savvy voice — speaks to school owners and instructors with concrete operational examples',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Martial arts school owners, head instructors, and dojo-operations staff balancing pedagogy with billing, attendance, and tournament logistics.',
  'topic_scope_keywords', jsonb_build_array(
    'martial arts school management',
    'dojo operations software',
    'belt rank tracking',
    'tournament management',
    'youth athletics waivers'
  ),
  'schedule', 'monthly'
)
),

-- ── communis — worker cooperative OS ──────────────────────────────────────
('communis', 'Communis Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize the following {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO. Draw connections, identify themes, deliver a unified narrative useful to the audience above.

Structure:
- H1 title (evocative + keyword-aware)
- 3-4 H2 sections with substance
- One concrete example or scenario per H2
- Closing "What to watch in {month_name}" paragraph
- FAQ block of 5 Q&A at the end (use ## FAQ as the section header)

Rules:
- Match the voice cue precisely
- Never use marketing language, CTAs, or "buy/subscribe/sign up"
- Never mention CROS, NRI, the platform, or competitor product names
- Include at most one internal-link placeholder per H2 in the form [INTERNAL_LINK:{primary_domain}/<slug>]
- Cite sources inline like [Source N] referring to the numbered list below
- Output markdown only

SOURCES TO SYNTHESIZE:
{seed_summaries}$prompt$,
'earnest cooperative-movement voice with technical precision on patronage, governance, and 1099-PATR mechanics',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Worker-cooperative member-owners, co-op accountants, and cooperative development practitioners managing democratic governance and patronage distributions.',
  'topic_scope_keywords', jsonb_build_array(
    'worker cooperative software',
    '1099-PATR filing',
    'patronage distribution',
    'democratic governance tools',
    'cooperative equity tracking'
  ),
  'schedule', 'monthly'
)
),

-- ── fabrica-forge — makerspace / repair café / craft guild ────────────────
('fabrica-forge', 'Fabrica Forge Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize the following {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO. Draw connections, identify themes, deliver a unified narrative useful to the audience above.

Structure: H1, 3-4 H2 sections with substance, one concrete example per H2, "What to watch in {month_name}" closing paragraph, ## FAQ with 5 Q&A.

Rules: Match the voice cue. No CTAs. Never mention CROS, NRI, the platform, or competitor product names. At most one [INTERNAL_LINK:{primary_domain}/<slug>] per H2. Inline [Source N] citations. Markdown only.

SOURCES:
{seed_summaries}$prompt$,
'craft-forward, practical, community-rooted, and movement-aware — speaks to makerspace operators in their own dialect',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Makerspace operators, repair-café coordinators, tool-library stewards, and craft-guild organizers looking for actionable sector intelligence.',
  'topic_scope_keywords', jsonb_build_array(
    'makerspace management software',
    'repair cafe community',
    'tool library operations',
    'apprenticeship skill tracking',
    'maker culture news'
  ),
  'schedule', 'monthly'
)
),

-- ── hortus — place-aware gardening OS ─────────────────────────────────────
('hortus', 'Hortus Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO.

Structure: H1, 3-4 H2 sections, one concrete example per H2, "What to watch in {month_name}" closing, ## FAQ with 5 Q&A.

Rules: Match the voice. No CTAs. No CROS/NRI mentions. One [INTERNAL_LINK:{primary_domain}/<slug>] per H2. Inline [Source N] citations. Markdown only.

SOURCES:
{seed_summaries}$prompt$,
'place-aware horticultural voice — pairs soil and zone literacy with seasonal narrative; speaks to gardeners as practitioners not consumers',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Home gardeners, community garden coordinators, and small-scale growers who want place-specific guidance grounded in soil, zone, and season.',
  'topic_scope_keywords', jsonb_build_array(
    'gardening management software',
    'soil and zone intelligence',
    'community garden coordination',
    'seasonal planting guides',
    'horticultural news'
  ),
  'schedule', 'monthly'
)
),

-- ── propria — community land trust platform ───────────────────────────────
('propria', 'Propria Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO.

Structure: H1, 3-4 H2 sections, one concrete example per H2, "What to watch in {month_name}" closing, ## FAQ with 5 Q&A.

Rules: Match the voice. No CTAs. No CROS/NRI mentions. One [INTERNAL_LINK:{primary_domain}/<slug>] per H2. Inline [Source N] citations. Markdown only.

SOURCES:
{seed_summaries}$prompt$,
'CST-grounded community development voice — pairs property-rights stewardship with subsidiarity; quotes Chesterton sparingly but unapologetically',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Community land trust staff, CCHD-aligned organizers, and housing-justice advocates who steward shared property and intergenerational stability.',
  'topic_scope_keywords', jsonb_build_array(
    'community land trust software',
    'CLT stewardship',
    'shared-equity housing',
    'CCHD community organizing',
    'affordable housing platform'
  ),
  'schedule', 'monthly'
)
),

-- ── refugium — survivor-centered disaster recovery ────────────────────────
('refugium', 'Refugium Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO.

Structure: H1, 3-4 H2 sections, one concrete example per H2, "What to watch in {month_name}" closing, ## FAQ with 5 Q&A.

Rules: Match the voice. No CTAs. No CROS/NRI mentions. One [INTERNAL_LINK:{primary_domain}/<slug>] per H2. Inline [Source N] citations. Markdown only.

SOURCES:
{seed_summaries}$prompt$,
'restrained humanitarian brief with practical urgency — credible, sober, never sensational',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Small humanitarian organizations, mutual aid coordinators, and disaster recovery practitioners seeking concise, credible monthly intelligence.',
  'topic_scope_keywords', jsonb_build_array(
    'disaster recovery software',
    'humanitarian response platform',
    'mutual aid coordination',
    'emergency preparedness tools',
    'survivor-centered case management'
  ),
  'schedule', 'monthly'
)
),

-- ── rehearso — relational rehearsal OS ────────────────────────────────────
('rehearso', 'Rehearso Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO.

Structure: H1, 3-4 H2 sections, one concrete example per H2, "What to watch in {month_name}" closing, ## FAQ with 5 Q&A.

Rules: Match the voice. No CTAs. No CROS/NRI mentions. One [INTERNAL_LINK:{primary_domain}/<slug>] per H2. Inline [Source N] citations. Markdown only.

SOURCES:
{seed_summaries}$prompt$,
'ensemble-conductor voice — patient, attuned to relational dynamics between musicians and players; treats rehearsal as a discipline, not a chore',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Choir, band, theater, and orchestra leaders coordinating rehearsal schedules, attendance, and ensemble dynamics across long arcs.',
  'topic_scope_keywords', jsonb_build_array(
    'rehearsal scheduling software',
    'choir management',
    'theater company operations',
    'ensemble attendance tracking',
    'orchestra rehearsal tools'
  ),
  'schedule', 'monthly'
)
),

-- ── resurrectio — reentry platform ────────────────────────────────────────
('resurrectio', 'Resurrectio Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO.

Structure: H1, 3-4 H2 sections, one concrete example per H2, "What to watch in {month_name}" closing, ## FAQ with 5 Q&A.

Rules: Match the voice. No CTAs. No CROS/NRI mentions. One [INTERNAL_LINK:{primary_domain}/<slug>] per H2. Inline [Source N] citations. Markdown only.

SOURCES:
{seed_summaries}$prompt$,
'compassionate, data-literate, and justice-policy grounded — honors human dignity without sentimentalizing reentry challenges',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Reentry nonprofit staff, prison ministry leaders, and policy-minded practitioners supporting returning citizens through housing, work, and family reconnection.',
  'topic_scope_keywords', jsonb_build_array(
    'reentry case management software',
    'prison ministry platform',
    'recidivism reduction tools',
    'returning citizen support',
    'criminal justice restoration'
  ),
  'schedule', 'monthly'
)
),

-- ── transitus — environmental justice / just transition ───────────────────
('transitus', 'Transitus Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO.

Structure: H1, 3-4 H2 sections, one concrete example per H2, "What to watch in {month_name}" closing, ## FAQ with 5 Q&A.

Rules: Match the voice. No CTAs. No CROS/NRI mentions. One [INTERNAL_LINK:{primary_domain}/<slug>] per H2. Inline [Source N] citations. Markdown only.

SOURCES:
{seed_summaries}$prompt$,
'activist-civic, terrain-poetic, and policy-literate — names environmental burdens precisely while honoring community agency',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Environmental justice organizers, faith-based climate stewards, and municipal/community resilience practitioners managing place-based transition work.',
  'topic_scope_keywords', jsonb_build_array(
    'environmental justice platform',
    'just transition software',
    'climate resilience data',
    'civic coalition CRM',
    'place-based stewardship tools'
  ),
  'schedule', 'monthly'
)
),

-- ── via-publica — walkability audit + courtyard urbanism ──────────────────
('via-publica', 'Via Publica Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO.

Structure: H1, 3-4 H2 sections, one concrete example per H2, "What to watch in {month_name}" closing, ## FAQ with 5 Q&A.

Rules: Match the voice. No CTAs. No CROS/NRI mentions. One [INTERNAL_LINK:{primary_domain}/<slug>] per H2. Inline [Source N] citations. Markdown only.

SOURCES:
{seed_summaries}$prompt$,
'civic-walkability voice — pairs Strong-Towns-style fiscal pragmatism with courtyard humanism; argues for cities at human scale',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Walkability advocates, citizen planners, and small-city civic leaders running streetscape audits and courtyard urbanism campaigns.',
  'topic_scope_keywords', jsonb_build_array(
    'walkability audit tool',
    'pedestrian advocacy platform',
    'courtyard urbanism',
    'streetscape assessment software',
    'human-scale city planning'
  ),
  'schedule', 'monthly'
)
),

-- ── vigilia — Catholic eldercare pastoral journal ─────────────────────────
('vigilia', 'Vigilia Monthly SEO Synthesis',
$prompt$You are writing the monthly synthesis essay for {satellite_display_name} at {primary_domain}.

Voice: {synthesis_voice}
Audience: {synthesis_audience}
Topic scope: {topic_scope_keywords}

Synthesize {seed_count} articles from the past 30 days into ONE cohesive 1200-1500 word essay optimized for SEO.

Structure: H1, 3-4 H2 sections, one concrete example per H2, "What to watch in {month_name}" closing, ## FAQ with 5 Q&A.

Rules: Match the voice. No CTAs. No CROS/NRI mentions. One [INTERNAL_LINK:{primary_domain}/<slug>] per H2. Inline [Source N] citations. Markdown only.

SOURCES:
{seed_summaries}$prompt$,
'devotional and liturgically warm — a liturgy of attention; honors caregiving as vocation, names suffering without abstracting it',
'monthly_seo', true,
jsonb_build_object(
  'audience', 'Catholic family caregivers, pastoral-care volunteers, and senior-living chaplains coordinating eldercare attention as spiritual practice.',
  'topic_scope_keywords', jsonb_build_array(
    'Catholic eldercare platform',
    'pastoral care journal',
    'senior living spiritual care',
    'family caregiver tools',
    'liturgy of attention'
  ),
  'schedule', 'monthly'
)
)
ON CONFLICT DO NOTHING;

COMMIT;
