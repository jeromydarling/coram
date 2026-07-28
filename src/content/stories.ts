/**
 * Stories — Narrative story content registry for /stories/:slug.
 *
 * WHAT: Hypothetical but realistic weekly stories showing CROS in action.
 * WHERE: Powers StoryPage component at /stories/:slug.
 * WHY: Creates narrative SEO authority by illustrating real-world CROS usage.
 */

export interface Story {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  datePublished: string;
  archetypeKey: string;
  timeline: StoryMoment[];
  closing: string;
}

export interface StoryMoment {
  time: string;
  title: string;
  narrative: string;
  role?: 'shepherd' | 'companion' | 'visitor';
  feature?: string;
}

export const stories: Story[] = [
  {
    slug: 'first-week-at-grace-church',
    title: 'First Week at Grace Church',
    description: 'How a small church used CROS™ to notice a returning family, connect a newcomer, and remember what mattered — without a single spreadsheet.',
    keywords: ['church CRM story', 'faith community technology', 'pastoral care', 'relationship memory'],
    datePublished: '2026-02-15',
    archetypeKey: 'church',
    timeline: [
      {
        time: 'Monday Morning',
        title: 'The Quiet Review',
        narrative: 'Pastor Beth opens CROS™ with coffee. NRI has noticed the Ramirez family attended both services — their first visit in six weeks. A Reflection from last month reads: "Carlos mentioned stress at work." No alarm. Just a gentle flag: "You may want to reach out."',
        role: 'shepherd',
        feature: 'NRI Narrative',
      },
      {
        time: 'Tuesday Afternoon',
        title: 'A Companion Captures a Moment',
        narrative: 'Sarah leads the Tuesday women\'s group. Afterward, she logs a quick Reflection: "Three new women today. One named Denise — recently moved from Houston. Stayed for coffee." She doesn\'t know that another Companion mentioned a newcomer too. NRI notices the pattern quietly.',
        role: 'companion',
        feature: 'Reflections',
      },
      {
        time: 'Wednesday Evening',
        title: 'A Voice Note in the Hallway',
        narrative: 'Deacon James visits Brother Thomas at Memorial Hospital. He taps the microphone: "Hip replacement went well. Wants his brown Bible from the office. Daughter Angela arriving Thursday." Thirty seconds. No forms. The visit is logged.',
        role: 'visitor',
        feature: 'Visitor Voice Notes',
      },
      {
        time: 'Thursday',
        title: 'The Weekly Narrative',
        narrative: 'NRI compiles the week: "The Ramirez family re-engaged. Two newcomers appeared in different groups. A faithful member is recovering well. The food pantry may need restocking." Pastor Beth reads this in 90 seconds. It tells a story no spreadsheet could.',
        role: 'shepherd',
        feature: 'Metro Narrative',
      },
      {
        time: 'Friday',
        title: 'A Community Signal',
        narrative: 'Signum surfaces a local news item: "City announces family shelter opening on Oak Street — three blocks from the church." It appears in the Local Pulse feed. Pastor Beth adds a note: "Invite shelter director to our community dinner."',
        feature: 'Signum',
      },
      {
        time: 'Saturday',
        title: 'Drift Detection',
        narrative: 'Drift Detection shows two volunteers have been quiet for three weeks. Not a warning — just a gentle note. Beth texts David. He\'s dealing with a family matter. Rosa is fine — just busy with grandkids. No crisis. Just care.',
        role: 'shepherd',
        feature: 'Testimonium',
      },
      {
        time: 'Sunday',
        title: 'The Living Story',
        narrative: 'As the congregation gathers, Pastor Beth knows things no attendance sheet could tell her. The Ramirez family needs warmth. Denise needs a follow-up. Brother Thomas wants his Bible. The food pantry needs vegetables. A new shelter is opening nearby. CROS™ didn\'t create this knowledge. The people did. CROS™ just remembered.',
        role: 'shepherd',
      },
    ],
    closing: 'Technology didn\'t replace the pastor\'s intuition. It honored it — by remembering what she noticed and helping her notice what she might have missed.',
  },
  {
    slug: 'harbor-nonprofits-quiet-week',
    title: 'Harbor Nonprofit\'s Quiet Week',
    description: 'A digital inclusion nonprofit uses CROS™ to track device distributions, volunteer hours, and community shifts — all without losing the human thread.',
    keywords: ['nonprofit CRM story', 'digital inclusion', 'volunteer management', 'community technology'],
    datePublished: '2026-02-18',
    archetypeKey: 'digital_inclusion',
    timeline: [
      {
        time: 'Monday',
        title: 'The Week Begins',
        narrative: 'Program Director Ana reviews last week\'s Testimonium summary. Three families received devices. Two volunteers clocked 12 hours each. One new referral came in from the library. She adds a Reflection: "The Rivera kids are finally doing homework online."',
        role: 'shepherd',
        feature: 'Testimonium',
      },
      {
        time: 'Tuesday',
        title: 'Companions in the Field',
        narrative: 'Tech volunteer Marcus delivers a refurbished laptop to the Garcia household. He logs a quick note through Voluntarium: "Delivered Chromebook. Set up Wi-Fi. Mrs. Garcia wants to learn email." The hours are tracked. The relationship is remembered.',
        role: 'companion',
        feature: 'Voluntarium',
      },
      {
        time: 'Wednesday',
        title: 'A Visit to the Community Center',
        narrative: 'Ana visits the Eastside Community Center to check on the new computer lab. She records a voice note: "Lab is being used daily. Need two more monitors. Director mentioned interest in a coding class for teens." No clipboard. No intake form. Just presence.',
        role: 'visitor',
        feature: 'Visitor Voice Notes',
      },
      {
        time: 'Thursday',
        title: 'Signals and Patterns',
        narrative: 'Signum flags: "FCC broadband funding deadline in 30 days." NRI connects this to three recent conversations about internet access gaps. It doesn\'t create a task — it creates awareness.',
        feature: 'Signum',
      },
      {
        time: 'Friday',
        title: 'The Weekly Story',
        narrative: 'The Metro Narrative reads: "This was a week of quiet progress. Three devices delivered. One partnership deepened. A funding window is opening." Ana shares this with her board chair. Two paragraphs. No dashboard login required.',
        role: 'shepherd',
        feature: 'Metro Narrative',
      },
    ],
    closing: 'The best technology work happens when technology disappears — when the focus stays on the person in front of you.',
  },
];
