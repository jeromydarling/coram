import jsPDF from 'jspdf';

interface CardInfo {
  name: string;
  description: string;
  proposedTab: string;
}

const CARDS: CardInfo[] = [
  {
    name: 'Header Card',
    description: 'Displays the organization name, metro location, current stage (e.g. Target Identified → Stable Producer), status (Active/On Hold/Closed), and partner tier badges (Anchor, Distribution, Referral, etc.). Also shows enrichment status indicators and the next action due date with overdue warnings.',
    proposedTab: 'At a Glance',
  },
  {
    name: 'Next Step',
    description: 'A compact callout showing the RIM\'s next planned action for this organization — keeps the immediate to-do front and center.',
    proposedTab: 'At a Glance',
  },
  {
    name: 'Primary Contact',
    description: 'Highlights the main point of contact at the organization with their name, title, email, and phone. Links directly to their People detail page.',
    proposedTab: 'People',
  },
  {
    name: 'All People',
    description: 'Lists every contact associated with this organization, with quick links to their individual People pages. Shows primary contact badge and title.',
    proposedTab: 'People',
  },
  {
    name: 'Suggested Contacts',
    description: 'AI-discovered contact suggestions scraped from the organization\'s website via the contact-suggestions n8n workflow. Allows one-click import into the CRM.',
    proposedTab: 'People',
  },
  {
    name: 'Mission Snapshot',
    description: 'Tag-style badges summarizing the organization\'s core mission areas (e.g. "Digital Equity", "Workforce Development"). Populated during AI enrichment.',
    proposedTab: 'At a Glance',
  },
  {
    name: 'Best Partnership Angle',
    description: 'AI-generated tags identifying the strongest collaboration opportunities between PCs for People and this organization (e.g. "Device Distribution", "Grant Co-applicant").',
    proposedTab: 'At a Glance',
  },
  {
    name: 'Grant Alignment',
    description: 'Tags showing which grant themes align with this organization\'s mission, used to identify co-application or referral opportunities.',
    proposedTab: 'At a Glance',
  },
  {
    name: 'Recent Orders (OpportunityOrdersCard)',
    description: 'Displays recent device orders placed through this organization, including volume trends and stage-update suggestions based on order activity.',
    proposedTab: 'The Journey',
  },
  {
    name: 'Relationship Momentum (MomentumCard)',
    description: 'A visual indicator of relationship health based on recent activity frequency, response patterns, and engagement signals. Shows momentum trend (rising/stable/cooling).',
    proposedTab: 'What We Know',
  },
  {
    name: 'Relationship Actions (RelationshipActionsCard)',
    description: 'Priority-scored action items triggered by relationship intelligence — leadership changes, upcoming events, momentum shifts, and grant discoveries. Each action includes a score and recommended response.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Weekly Briefing (WeeklyBriefingCard)',
    description: 'A periodic AI-generated narrative summarizing the week\'s relationship developments, new signals, and recommended focus areas for this organization.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Next Best Actions (NextBestActionsPanel)',
    description: 'AI-recommended next steps based on the organization\'s current stage, relationship signals, and pipeline position. Provides actionable suggestions ranked by impact.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Opportunity Signals (OpportunitySignalsPanel)',
    description: 'High-value outreach signals surfaced from grant discovery, metro matching, contact enrichment, and other intelligence sources. Each signal includes confidence scores and mission alignment.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Enrichment Pipeline Timeline',
    description: 'Visual timeline showing the status of the three-phase enrichment pipeline: Org Knowledge extraction, Neighborhood Insights, and full AI enrichment. Tracks processing state for each phase.',
    proposedTab: 'The Journey',
  },
  {
    name: 'Prospect Pack (ProspectPackCard)',
    description: 'AI-generated research briefing including organization summary, mission snapshot, partnership angles, outreach suggestions, and potential risks. Also embeds Grant Fit Scores showing alignment percentages with specific grants.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Org Knowledge (OrgKnowledgePanel)',
    description: 'Admin-only panel showing the raw knowledge profile extracted from the organization\'s website via Perplexity research. Includes parsed programs, leadership, focus areas, and service regions.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Neighborhood Insights (NeighborhoodInsightsCard)',
    description: 'Community context for the organization\'s location using Census tract demographics (ACS 5-Year) and Perplexity-sourced neighborhood research. Shows population, income, broadband access, and community needs within ~10 mile radius.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Org Insights (OrgInsightsPanel)',
    description: 'Aggregated intelligence panel combining signals from multiple enrichment sources into a unified view of organizational insights and strategic context.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Campaign Intelligence (CampaignIntelligenceCard)',
    description: 'Shows email campaign performance for this organization — delivery rates, engagement metrics, and AI-suggested follow-up campaigns based on signal patterns.',
    proposedTab: 'The Journey',
  },
  {
    name: 'Actions Timeline (OrgActionTimeline)',
    description: 'Chronological feed of all relationship actions taken with this organization — meetings, emails, calls, and automated touchpoints — providing a complete interaction history.',
    proposedTab: 'The Journey',
  },
  {
    name: 'Smart Outreach Drafts (OutreachDraftCard)',
    description: 'Pre-filled, AI-generated email drafts tailored to the organization\'s context and current relationship stage. Requires human review and approval before sending.',
    proposedTab: 'The Journey',
  },
  {
    name: 'Outreach Suggestions (OutreachSuggestionsCard)',
    description: 'AI-recommended outreach strategies based on recent signals and relationship context — suggests optimal timing, channel, and messaging approach.',
    proposedTab: 'The Journey',
  },
  {
    name: 'Grant Suggestions (GrantSuggestionsPanel)',
    description: 'AI-matched grants that align with this organization\'s mission and programs. Shows match scores and allows one-click linking of grants to the opportunity.',
    proposedTab: 'The Journey',
  },
  {
    name: 'Linked Grants (OpportunityGrantsList)',
    description: 'Grants that have been explicitly linked to this opportunity, showing grant names, funders, deadlines, and alignment rationale.',
    proposedTab: 'The Journey',
  },
  {
    name: 'Watchlist Card',
    description: 'Controls for the organization\'s website monitoring — shows watchlist enrollment status, monitoring cadence (weekly), and the tracked URL. Allows toggling monitoring on/off.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Recent Snapshots (RecentSnapshotsPanel)',
    description: 'Displays the last website research results — timestamps, content hashes, and snapshot IDs. Used to track when the organization\'s website was last analyzed.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Recent Changes (RecentChangesPanel)',
    description: 'Content diffs detected between website snapshots — shows added/removed character counts and AI-extracted signals (hiring, funding, new programs, leadership changes) with confidence scores.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Discovery Briefings (DiscoveryBriefingPanel)',
    description: 'AI-generated research summaries from the Discovery pipeline — news articles, events, leadership changes, and other publicly available information relevant to the organization.',
    proposedTab: 'What We Know',
  },
  {
    name: 'Documents (DocumentAttachmentsPanel)',
    description: 'File attachments associated with this opportunity — agreements, proposals, MOUs, and other documents stored in secure cloud storage with upload/download capabilities.',
    proposedTab: 'The Journey',
  },
  {
    name: 'Note History (NoteHistoryPanel)',
    description: 'Chronological log of all notes added to this opportunity by RIMs, with timestamps and content. Provides context continuity across team members and over time.',
    proposedTab: 'The Journey',
  },
];

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function addPageFooter(doc: jsPDF, pageNum: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Profunda — Opportunity Detail Cards • Page ${pageNum}`, PAGE_WIDTH / 2, pageHeight - 8, { align: 'center' });
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), PAGE_WIDTH - MARGIN, pageHeight - 8, { align: 'right' });
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, pageNum: { current: number }): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    addPageFooter(doc, pageNum.current);
    doc.addPage();
    pageNum.current++;
    return 25;
  }
  return y;
}

export function generateOpportunityCardsPdf() {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageNum = { current: 1 };
  let y = 20;

  // Title
  doc.setFontSize(22);
  doc.setTextColor(30);
  doc.text('Profunda', MARGIN, y);
  y += 9;
  doc.setFontSize(13);
  doc.setTextColor(80);
  doc.text('Opportunity Detail — Card & Panel Reference', MARGIN, y);
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, MARGIN, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(`${CARDS.length} cards / panels total`, MARGIN, y);
  y += 6;

  // Divider
  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  // Group by proposed tab
  const tabs = ['At a Glance', 'What We Know', 'People', 'The Journey'];
  
  for (const tab of tabs) {
    const tabCards = CARDS.filter(c => c.proposedTab === tab);
    
    y = checkPageBreak(doc, y, 20, pageNum);
    
    // Tab header
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text(`📋  ${tab}`, MARGIN, y);
    y += 3;
    doc.setDrawColor(180);
    doc.line(MARGIN, y, MARGIN + 60, y);
    y += 7;

    for (const card of tabCards) {
      y = checkPageBreak(doc, y, 22, pageNum);

      // Card name
      doc.setFontSize(10);
      doc.setTextColor(40);
      doc.text(card.name, MARGIN + 2, y);
      y += 5;

      // Description
      doc.setFontSize(8.5);
      doc.setTextColor(70);
      const descLines = doc.splitTextToSize(card.description, CONTENT_WIDTH - 6);
      doc.text(descLines, MARGIN + 4, y);
      y += descLines.length * 3.8 + 5;
    }

    y += 4;
  }

  addPageFooter(doc, pageNum.current);
  doc.save('Profunda-Opportunity-Cards-Reference.pdf');
}
