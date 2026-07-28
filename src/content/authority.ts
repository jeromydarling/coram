/**
 * authority — Content registry for the CROS™ Authority Hub.
 *
 * WHAT: Curated narrative content positioning CROS as the leading voice in human-centered relational systems.
 * WHERE: Rendered on /authority/* public routes.
 * WHY: Builds long-form SEO authority through pastoral storytelling.
 */

export interface AuthoritySection {
  slug: string;
  category: 'week' | 'adoption' | 'story' | 'leadership' | 'field_dispatch';
  archetype: string;
  roleFocus: string;
  title: string;
  description: string;
  body: string;
  featured?: boolean;
}

export const AUTHORITY_SECTIONS: AuthoritySection[] = [
  // ── Week Stories ──────────────────────────────────────
  {
    slug: 'catholic-outreach-week',
    category: 'week',
    archetype: 'church',
    roleFocus: 'shepherd',
    title: 'A Week in Catholic Outreach',
    description: 'How relational ministry unfolds when visits, reflections, and community signals work together.',
    featured: true,
    body: `Monday begins with a review. Father Miguel opens CROS and reads through the weekend's reflections — communion visitors noting quiet homes, lively conversations, a family asking about baptism preparation.

By Tuesday, he's drafting a follow-up list. Not from a CRM pipeline. From the stories his visitors told. Mrs. Fernandez seemed withdrawn. The Nguyens asked about the school fair. David noticed the lights were off at the Morales home.

Wednesday is for visits. Miguel takes the Morales visit himself. Thursday, Sister Catherine handles the east-side rounds. By Friday, the parish secretary has entered three new reflections and processed two provisioning requests — communion supplies for the homebound route.

Saturday is quiet. Sunday, the visitors go out again. And the cycle renews — not because a dashboard demands it, but because presence has its own rhythm.`,
  },
  {
    slug: 'digital-inclusion-week',
    category: 'week',
    archetype: 'digital_inclusion',
    roleFocus: 'companion',
    title: 'A Week in Digital Inclusion',
    description: 'How a digital equity team uses CROS to track device distribution, training sessions, and community engagement.',
    body: `Monday: The steward reviews the Prōvīsiō queue. Four laptops need deployment to the south side community center. Three households have requested hotspot devices.

Tuesday: Companions run a digital literacy workshop at the library. Twelve participants attend. Three are new — the companion logs brief reflections for each.

Wednesday: Follow-up visits. A companion checks in with Mrs. Johnson, who received a tablet last month. She's using video calling to talk to her grandchildren. The companion writes: "Dorothy's face lights up when she talks about the video calls. This is why we do this."

Thursday: The steward processes a provisioning request from a school partner. Five Chromebooks for a homework club. Journey stage: Building Together.

Friday: Team reflection meeting. The shepherd reads the week's entries aloud. Everyone notices: the south side is growing. More families, more requests, more stories. A momentum signal, witnessed by humans.`,
  },
  {
    slug: 'refugee-resettlement-week',
    category: 'week',
    archetype: 'refugee',
    roleFocus: 'companion',
    title: 'A Week in Refugee Resettlement',
    description: 'How a resettlement team uses reflections and journey chapters to accompany families through their first months.',
    body: `Monday: The case coordinator opens CROS to review three families arriving this week. Each has a journey chapter already started — "Welcome & Orientation." Housing confirmations, airport pickup schedules, and cultural orientation dates are noted as reflections by the advance team.

Tuesday: The Ahmadi family arrives. Their companion meets them at the apartment, walks through the pantry, and writes a brief reflection: "Fatima asked about the nearest mosque. The children were quiet but curious about the playground." No case note form. Just noticing.

Wednesday: A volunteer logs hours helping the Duong family navigate the bus system. The companion notices in CROS that Mrs. Duong mentioned wanting to cook Vietnamese food — she adds a Prōvīsiō request for a rice cooker.

Thursday: Team meeting. The shepherd reads this week's reflections aloud. A pattern emerges: three families have asked about English classes in the same neighborhood. A Local Pulse signal confirms a community college is offering free ESL starting next month.

Friday: Journey stage update. The Ahmadi family moves from "Welcome" to "Finding Footing." The companion writes: "They're beginning to ask questions about the future. That's how you know the settling has started."`,
  },
  {
    slug: 'workforce-development-week',
    category: 'week',
    archetype: 'workforce',
    roleFocus: 'steward',
    title: 'A Week in Workforce Development',
    description: 'How an employment program uses CROS to track participant journeys without reducing people to placement metrics.',
    body: `Monday: The program director reviews the week's journey chapters. Fourteen participants are in "Building Together" — the stage where skills training meets real employer connections. Two have interviews this week.

Tuesday: A companion meets with Marcus after his welding certification exam. He passed. The companion writes: "Marcus held the certificate like it was made of gold. He said his daughter asked if he was a welder now. He said, 'I'm becoming one.'" This is the kind of moment case management software never captures.

Wednesday: Drift detection flags a participant — Keisha hasn't attended sessions in eight days. No alarm. Just a gentle signal. The companion reaches out with a text, then logs a reflection: "Childcare fell through. She wants to come back. We're working on it."

Thursday: The steward processes three Prōvīsiō requests — steel-toe boots for Marcus, a bus pass for Keisha, and interview clothes for another participant.

Friday: Weekly narrative. The shepherd reads the week's reflections to the team. The mood is different from a metrics review. People are named. Stories are told. The work feels real.`,
  },
  {
    slug: 'library-system-week',
    category: 'week',
    archetype: 'library',
    roleFocus: 'steward',
    title: 'A Week in a Library System',
    description: 'How a public library network uses CROS to deepen community connection beyond book circulation.',
    body: `Monday: The community engagement librarian opens CROS. Last week's Local Pulse flagged a neighborhood meeting about a proposed bus route change — one that would affect access to three branch libraries. She creates a reflection: "This route serves our most isolated patrons. We should be present at the next meeting."

Tuesday: A teen services librarian logs a reflection after the afterschool program: "Jaylen brought his younger sister today. She sat in the corner reading while he worked on his college essay. He's the first in his family to apply." No form. Just witnessing.

Wednesday: The director reviews journey chapters for community partner organizations. The food bank has moved from "Exploring" to "Building Together" — they now host a monthly pop-up at the main branch.

Thursday: A companion at the east branch notices a regular patron hasn't been in for two weeks. She writes a reflection and the team decides to mail a handwritten note with upcoming program flyers.

Friday: Prōvīsiō requests reviewed. The teen room needs new headphones. The makerspace needs filament. The west branch needs bilingual signage. Each request tells a story about who's showing up and what they need.`,
  },

  // ── Adoption Guidance ────────────────────────────────
  {
    slug: 'workforce-adoption-guide',
    category: 'adoption',
    archetype: 'workforce',
    roleFocus: 'leader',
    title: 'Adopting CROS in Workforce Development',
    description: 'Non-technical guidance for leaders bringing CROS into employment programs.',
    body: `Adopting any new system in workforce development is complicated. Teams are stretched. Participants need immediate attention. The idea of "learning new software" feels like a luxury no one has time for.

CROS was designed for this reality. It doesn't ask for comprehensive data entry. It asks for noticing.

Start with reflections. After each participant meeting, write one sentence about what you observed. Not a case note. Not a compliance form. Just: "Marcus seemed excited about the welding track today." Over time, these reflections build a narrative layer that case notes never capture.

Next, customize your journey stages. The default labels may not fit. "Intake → Assessment → Training → Placement" is fine for reporting. But "Welcome → Understanding → Building Together → Stepping Forward" might be truer to your mission. CROS lets your language shape your system.

The rest — drift detection, signals, provisioning — comes naturally. The foundation is the reflection habit. Everything else grows from there.`,
  },
  {
    slug: 'leadership-adoption-principles',
    category: 'adoption',
    archetype: 'church',
    roleFocus: 'leader',
    title: 'Five Principles for Leadership Adoption',
    description: 'How leaders can model the adoption behaviors that make CROS come alive.',
    body: `1. Write the first reflection yourself. Don't ask your team to do something you haven't done. Open CROS, think about a conversation you had this week, and write one sentence. Your team will follow.

2. Name your journey stages together. Don't accept the defaults without discussion. The naming process is itself a mission-alignment exercise. It reveals how your team thinks about the people you serve.

3. Celebrate quiet dashboards. When your dashboard has no urgent signals, that means your team is in rhythm. Say so out loud. "Nothing urgent today" is a success worth naming.

4. Read reflections weekly. Not to monitor your team — to learn from them. Your visitors and companions see things you don't. Their reflections are a gift. Treat them that way.

5. Trust the slow build. CROS doesn't deliver ROI in week one. It builds narrative depth over months. The organizations that thrive with CROS are the ones willing to let the story unfold at its own pace.`,
  },
  {
    slug: 'first-thirty-days',
    category: 'adoption',
    archetype: 'nonprofit',
    roleFocus: 'steward',
    title: 'Your First Thirty Days with CROS',
    description: 'A gentle roadmap for the opening month — what to focus on, what to let emerge.',
    body: `Week one is about breathing. Don't try to import contacts. Don't customize every field. Just open CROS, write one reflection about someone you met with this week, and close it. That's enough.

Week two: invite one colleague. Not the whole team. One person who cares about relationships the way you do. Ask them to write a reflection too. Now you have two voices in the system.

Week three: look at your journey stages. Do the defaults match your language? If not, rename them. This is the moment CROS starts speaking your dialect. "Prospect" might become "New Friend." "Closed" might become "Walking Together." Use words your team would actually say aloud.

Week four: read everything. Open the reflections tab and scroll. You'll see patterns — themes, names that recur, neighborhoods that surface. This is the narrative layer building beneath you. No dashboard will show you what these stories reveal.

The rest of CROS — provisioning, drift detection, Local Pulse — all of it grows from this foundation. The reflections are the roots. Give them room.`,
  },
  {
    slug: 'overcoming-crm-fatigue',
    category: 'adoption',
    archetype: 'nonprofit',
    roleFocus: 'leader',
    title: 'Overcoming CRM Fatigue',
    description: 'Why your team resists new systems — and how CROS earns trust differently.',
    featured: true,
    body: `Your team has seen systems come and go. They've been told to "log everything" and "update the database" and "track your touches." They did it — reluctantly, resentfully — because leadership said so. And then the system was replaced, and the data was abandoned, and the cycle started again.

CROS doesn't ask for compliance. It asks for noticing.

The difference matters. "Log this meeting" is a command. "What did you notice about Maria today?" is an invitation. One produces data. The other produces insight.

When introducing CROS to a team with CRM fatigue, don't start with a training session. Start with a question: "Who did you see this week?" Write their answer as a reflection. Show them what it looks like in the system. Then ask: "Does that feel different from what you were doing before?"

Most people will say yes. And that's the opening.

The technical features — journey stages, drift signals, provisioning — those come later. The first gift you give a tired team is the experience of being heard by the system instead of interrogated by it.`,
  },

  // ── Narrative Essays ─────────────────────────────────
  {
    slug: 'why-not-a-crm',
    category: 'story',
    archetype: 'nonprofit',
    roleFocus: 'leader',
    title: 'Why CROS Is Not a CRM',
    description: 'A narrative essay on the difference between tracking transactions and remembering people.',
    featured: true,
    body: `CRMs were built to manage customers. The acronym says it all: Customer Relationship Management. The relationship exists in service of the transaction.

CROS inverts this. The relationship is the point. There is no transaction to optimize. There is no pipeline to close. There is only the ongoing, evolving, sometimes messy, always sacred reality of people in community.

When a nonprofit director opens a CRM, they see a funnel. Leads at the top, conversions at the bottom. The visual grammar says: move people through.

When a CROS user opens their dashboard, they see reflections. Stories. Signals. Journey chapters. The visual grammar says: notice what's happening.

This is not a semantic difference. It shapes every interaction. When your system measures "days since last contact," it creates urgency. When your system notices "reflections this week," it creates awareness. Urgency exhausts. Awareness sustains.

CROS was built for organizations that are tired of being measured and ready to be remembered.`,
  },
  {
    slug: 'the-reflection-habit',
    category: 'story',
    archetype: 'nonprofit',
    roleFocus: 'companion',
    title: 'The Reflection Habit',
    description: 'Why one sentence after a visit changes everything.',
    body: `It takes eleven seconds to write a reflection. "Rosa seemed lighter today." "The kids were fighting again but David handled it with grace." "She asked about the food pantry — first time in months."

Eleven seconds. And yet most systems never capture this layer.

Case notes capture what happened. Reflections capture what was noticed. The difference is the difference between a medical chart and a letter from a friend. Both have value. But only one builds a relationship over time.

When a companion writes "Rosa seemed lighter today" and then reads it back three months later, something happens. The memory returns — not as data, but as presence. The companion remembers the porch, the weather, the way Rosa smiled when she mentioned her garden.

This is narrative memory. And it's the foundation CROS is built on.

Organizations that adopt the reflection habit consistently report the same thing: "We started noticing more." Not because the system told them to notice. But because the act of writing taught them to pay attention.

The habit is simple. After every meaningful encounter, write one sentence about what you noticed. Not what you did. What you noticed. The system holds it. And over time, the system holds a story that no database query could ever construct.`,
  },
  {
    slug: 'on-silence-in-systems',
    category: 'story',
    archetype: 'nonprofit',
    roleFocus: 'leader',
    title: 'On Silence in Systems',
    description: 'Why a quiet dashboard is not a failure.',
    body: `Most software treats silence as a problem. No notifications? Something must be wrong. Empty inbox? Check again. Dashboard showing green? Time to find something to optimize.

CROS treats silence differently. A quiet Compass means your relationships are in rhythm. No drift. No overdue follow-ups. No signals crying for attention. That's not a failure. That's faithfulness.

The temptation in any organization is to fill silence with activity. To create urgency where none exists. To justify the system by proving it always has something to say.

But the wisest leaders know that silence is data too. When the system is quiet, it means the human rhythms are holding. The companions are visiting. The stewards are provisioning. The shepherds are watching. Everything is as it should be.

CROS was built for organizations that can sit with silence. That don't need constant validation from their tools. That understand: the absence of noise is the presence of faithfulness.

When your dashboard is quiet, take a breath. Your team is doing the work. The system knows. And it's choosing not to interrupt.`,
  },
  {
    slug: 'what-we-mean-by-journey',
    category: 'story',
    archetype: 'nonprofit',
    roleFocus: 'shepherd',
    title: 'What We Mean by "Journey"',
    description: 'Redefining progress in relational work — away from funnels, toward chapters.',
    body: `In most software, a "stage" is a step in a pipeline. A person enters at the top and exits — ideally — at the bottom. The metaphor is industrial: raw material in, finished product out.

CROS uses the word "journey" deliberately. A journey doesn't have a conversion point. It has chapters. And chapters don't always move forward. Sometimes they loop. Sometimes they pause. Sometimes a person returns to an earlier chapter because life demanded it.

Consider Maria. She entered the program in "Welcome." She moved to "Building Together" over three months. Then her mother got sick, and she went silent for six weeks. In a pipeline, she'd be "lost." In CROS, she's in a chapter called "Holding Still."

The companion wrote a reflection during that silence: "Maria hasn't been in. I called once. She said she's okay, just tired. I believe her." That reflection held the relationship open. When Maria returned two months later, the companion didn't need to "re-intake" her. The journey continued.

This is what we mean by journey. Not a funnel with stages. A story with chapters. Some short. Some long. Some written in pencil, ready to be revised. But all of them — every single one — worth telling.`,
  },

  // ── Leadership Reflections ───────────────────────────
  {
    slug: 'leading-without-metrics',
    category: 'leadership',
    archetype: 'nonprofit',
    roleFocus: 'leader',
    title: 'Leading Without Metrics',
    description: 'How to steward an organization when the most important things cannot be counted.',
    featured: true,
    body: `Your board wants numbers. Your funders want outcomes. Your staff wants clarity. And the most important work you do — the conversation in the parking lot, the handwritten note, the decision to not give up on someone — has no metric.

This is the central tension of mission-driven leadership. You are accountable for outcomes you cannot fully measure.

CROS doesn't pretend to solve this tension. But it changes the evidence you bring to the table. Instead of "We served 847 people this quarter," you can say: "Let me read you three reflections from this month. Let me show you a journey chapter. Let me tell you about Maria."

Narrative evidence is not softer than quantitative evidence. It is different. It answers different questions. "How many?" tells you scale. "What happened?" tells you meaning.

The leaders who thrive with CROS are the ones willing to stand in front of a board and say: "I can't give you a number for what changed this quarter. But I can give you a story. And if you listen, you'll know."

That takes courage. But it's the kind of courage mission work was built on.`,
  },
  {
    slug: 'the-stewards-burden',
    category: 'leadership',
    archetype: 'nonprofit',
    roleFocus: 'steward',
    title: 'The Steward\'s Burden',
    description: 'On carrying the operational weight so others can do relational work.',
    body: `Every mission-driven organization has someone who carries the operational weight. The person who orders supplies. Who tracks budgets. Who makes sure the van has gas and the volunteers have badges and the building is unlocked on Saturday morning.

In CROS, we call this person the Steward. Not "administrator." Not "office manager." Steward — because the role is sacred.

The steward sees everything. They know which companion is burning out because the Prōvīsiō requests are getting shorter and more frequent. They notice which neighborhoods are generating more provisioning needs. They feel the rhythm of the organization through its logistics.

CROS gives stewards something most systems deny them: a narrative layer for operational work. When a steward processes a request for diapers, they can write: "Third request this month from the east corridor. Something is shifting in this neighborhood." That reflection sits alongside the companion's visit note and the shepherd's strategic review.

The steward's work is not separate from the mission. It is the infrastructure of presence. CROS was built to honor that.`,
  },
  {
    slug: 'when-to-let-go',
    category: 'leadership',
    archetype: 'nonprofit',
    roleFocus: 'shepherd',
    title: 'When to Let Go of a Relationship',
    description: 'Discerning the difference between patience and persistence in relational work.',
    body: `Not every relationship continues. Some people move away. Some choose to disengage. Some simply stop returning calls, and after the third voicemail, you have to decide: do I keep trying, or do I let this rest?

CROS doesn't make this decision for you. But it gives you the narrative context to make it wisely.

When you open a journey chapter that's been in "Holding Still" for four months, you can read the reflections leading up to the silence. Was there a conflict? A life change? A gradual cooling? The reflections tell a story that "days since last contact" never could.

Sometimes the story says: keep reaching. Sometimes it says: this season is over. And sometimes — most honestly — it says: we don't know yet.

CROS honors the "not knowing." Unlike pipeline-driven systems that flag silence as failure, CROS simply holds the space. The journey chapter stays open. The reflections remain. And if the person returns — in a month, a year, a decade — the story is still there.

Letting go is not the same as forgetting. In CROS, you can release a relationship from active care without erasing the record of what you shared. That's a form of dignity most systems can't offer.`,
  },

  // ── Field Dispatches ─────────────────────────────────
  {
    slug: 'dispatch-from-appalachia',
    category: 'field_dispatch',
    archetype: 'church',
    roleFocus: 'companion',
    title: 'Dispatch from Appalachia',
    description: 'A companion\'s account of relational ministry in rural mountain communities.',
    body: `The roads here don't have names on maps. You navigate by landmarks — the red barn, the fallen oak, the creek that floods in April. GPS is unreliable. Relationships are not.

Sister Theresa has been visiting the same seven families on this route for three years. She knows which dogs to watch for, which gates to open, which porches are safe to step on. CROS holds her reflections from every visit.

"Edith was sitting outside today, which she never does. She said the house felt too quiet since Harold passed. I sat with her for forty minutes. We didn't talk about much. But she held my hand when I left."

This is the data that matters in Appalachian ministry. Not contact counts. Not pipeline stages. The fact that Edith held her hand.

In the hollow below the ridge, cell service drops. Sister Theresa writes her reflections in a small notebook and enters them into CROS when she gets back to the parish office. The system doesn't mind the delay. It was built for people who do their work where signals don't reach.

Next week, she'll visit the same families. Some conversations will repeat. Some will surprise her. But she'll notice — because that's what companions do. And CROS will hold what she notices — because that's what the system was built for.`,
  },
  {
    slug: 'dispatch-from-the-food-bank',
    category: 'field_dispatch',
    archetype: 'nonprofit',
    roleFocus: 'steward',
    title: 'Dispatch from the Food Bank',
    description: 'How a regional food bank uses CROS to see beyond pounds distributed.',
    body: `The warehouse smells like cardboard and cold storage. Pallets arrive at 6 AM. By noon, the sorting team has processed 4,000 pounds of produce, dairy, and protein. The numbers go into the grant report. The stories go into CROS.

"A grandmother came with her two grandchildren today. She apologized for needing help. The volunteer — Diane — told her there's nothing to apologize for. The grandmother cried. The little boy held her hand."

The food bank measures impact by pounds distributed. The funders want that number. But the executive director also wants to know: who are we serving? What are their lives like? What patterns are emerging?

CROS answers these questions not through analytics but through accumulated reflections. Over six months, the director can read through the narrative layer and see things no spreadsheet reveals: the same families returning monthly, new faces from a neighborhood where a factory closed, volunteers who are themselves food-insecure.

The system doesn't editorialize. It doesn't flag trends with red badges. It simply holds what people noticed. And when the director needs to speak to the board about impact, she doesn't open a dashboard. She opens CROS and reads aloud.`,
  },
  {
    slug: 'dispatch-from-the-clinic-waiting-room',
    category: 'field_dispatch',
    archetype: 'caregiver_agency',
    roleFocus: 'companion',
    title: 'Dispatch from the Clinic Waiting Room',
    description: 'A community health worker\'s reflections on accompaniment in primary care.',
    body: `The waiting room is where the real work happens. Before the doctor's name is called, before the vitals are taken, there's a conversation in a plastic chair between a community health worker and a patient who almost didn't come.

"Mrs. Reyes said she stopped taking her medication because she couldn't afford the copay. She didn't want to 'be a bother.' I told her that's exactly why I'm here."

The community health worker enters this reflection into CROS during a break. She doesn't log a "case interaction." She writes what she noticed. The system holds it alongside Mrs. Reyes' journey chapter — which shows three visits in the last two months, a move from "Hesitant" to "Trusting," and a Prōvīsiō request for medication assistance.

In clinical software, Mrs. Reyes is a patient ID and a diagnosis code. In CROS, she is a person who almost didn't come, who was afraid of being a bother, who needed someone to say: "That's exactly why I'm here."

The waiting room empties. The health worker moves to the next conversation. And the story continues — one reflection at a time.`,
  },
];

/** Get authority section by slug. */
export function getAuthoritySection(slug: string): AuthoritySection | undefined {
  return AUTHORITY_SECTIONS.find((s) => s.slug === slug);
}

/** Get sections by category. */
export function getAuthoritySectionsByCategory(category: AuthoritySection['category']): AuthoritySection[] {
  return AUTHORITY_SECTIONS.filter((s) => s.category === category);
}

/** Get featured sections. */
export function getFeaturedAuthoritySections(): AuthoritySection[] {
  return AUTHORITY_SECTIONS.filter((s) => s.featured);
}
