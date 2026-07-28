/**
 * seePeople.ts — Content for the /see-people discernment page.
 *
 * WHAT: Reflection questions and Ignatian narrative copy.
 * WHERE: Rendered by src/pages/marketing/SeePeople.tsx.
 * WHY: Helps nonprofit leaders discern whether their tools help them see people.
 */

export const seePeopleHero = {
  heading: 'Before choosing software, pause and ask a different question.',
  subtext:
    'This is not a feature comparison.\nIt\'s a moment to notice what your tools help you see \u2014 and what they might be hiding.',
  cta: 'Start the Reflection',
};

export interface ReflectionQuestion {
  category: string;
  question: string;
  followUp: string;
}

export const reflectionQuestions: ReflectionQuestion[] = [
  // Mission Awareness
  {
    category: 'Mission Awareness',
    question: 'If you opened your current system right now, could you quickly see who needs help today?',
    followUp: 'Many leaders discover that their tools show tasks \u2014 but not the people behind them.',
  },
  {
    category: 'Mission Awareness',
    question: 'Does your team know what\'s changing in your community this week?',
    followUp: 'Awareness of movement \u2014 a new family, a closing shelter, a shifting need \u2014 often lives in hallway conversations, not in software.',
  },

  // Human Context
  {
    category: 'Human Context',
    question: 'Do your tools show stories \u2014 or only statistics?',
    followUp: 'Numbers measure what happened. Stories remember why it mattered.',
  },
  {
    category: 'Human Context',
    question: 'When was the last time your system helped you remember a conversation \u2014 not just that it happened?',
    followUp: 'Over time, many leaders find that their records capture dates but lose the human thread.',
  },

  // Daily Work
  {
    category: 'Daily Work',
    question: 'Do your field workers look forward to using the system \u2014 or do they work around it?',
    followUp: 'If logging a visit feels like paperwork, the richest details often stay unrecorded.',
  },
  {
    category: 'Daily Work',
    question: 'Can someone log a touchpoint in under 30 seconds, on a phone, while standing in a parking lot?',
    followUp: 'The best records come from the moment itself \u2014 not from the office, hours later.',
  },

  // Leadership Insight
  {
    category: 'Leadership Insight',
    question: 'Can your leadership see movement, or only reports?',
    followUp: 'A quarterly report tells you what was. A living system helps you see what is becoming.',
  },
  {
    category: 'Leadership Insight',
    question: 'When you prepare for a board meeting, does your software help you tell the story \u2014 or do you start from scratch?',
    followUp: 'Perhaps the system could carry the narrative forward, so you don\'t have to rebuild it each quarter.',
  },

  // Community Connection
  {
    category: 'Community Connection',
    question: 'Could you name three volunteers who quietly showed up again and again this year?',
    followUp: 'Faithful presence often goes unnoticed \u2014 not because leaders don\'t care, but because systems don\'t surface it.',
  },
  {
    category: 'Community Connection',
    question: 'Does your system help you notice when someone drifts away?',
    followUp: 'Absence is hard to measure. But it is often the most important signal a community receives.',
  },

  // Adoption Reality
  {
    category: 'Adoption Reality',
    question: 'Are volunteers and part-time staff empowered by the system, or do they avoid logging in?',
    followUp: 'If only full-time staff use it, the system captures strategy but misses the frontline story.',
  },
  {
    category: 'Adoption Reality',
    question: 'If you removed your current tool tomorrow, what would your team actually miss?',
    followUp: 'This question often reveals whether the system serves the mission \u2014 or the mission serves the system.',
  },
];

export const ignatianExamen = {
  sections: [
    {
      label: 'Noticing',
      body: 'You may begin to notice how much of your day is spent translating human experience into fields and forms. The visit happened \u2014 but the system asked for a dropdown, not a story. The volunteer showed up \u2014 but there was no place to say she\'s been here every Tuesday for a year. Perhaps you notice that the most important things \u2014 presence, trust, quiet faithfulness \u2014 have no column in your spreadsheet.',
    },
    {
      label: 'Reflection',
      body: 'Over time, many leaders find that their tools were built for a different kind of organization. Systems designed for sales pipelines carry that shape into mission work \u2014 urgency over patience, metrics over meaning, transactions over relationships. This is not a failure of intention. It is a mismatch of design. And it often leaves the people closest to the work feeling unseen.',
    },
    {
      label: 'Discernment',
      body: 'There is a difference between a tool that tracks activity and one that remembers people. One counts. The other witnesses. Discernment invites you to ask: does our system help us grow closer to the people we serve? Or does it quietly pull us toward efficiency at the cost of presence? Neither answer is wrong. But the question deserves honest attention.',
    },
    {
      label: 'Invitation',
      body: 'Perhaps this invites a different question entirely. Not which software has the best features \u2014 but which system helps us see the people we are called to serve? Technology should carry the weight. Humans carry the meaning. When both are honored, something lasting grows.',
    },
  ],
};

export const teamGuide = {
  heading: 'Want to bring this conversation to your team?',
  body: 'Download a printable one-page reflection guide \u2014 no email required.',
  cta: 'Download Reflection Guide',
};

export const softClose = {
  heading: 'You\'re not failing your mission.',
  subheading: 'Your tools may simply not be built for it.',
  cta: 'See How CROS Approaches This Differently',
  ctaTo: '/manifesto',
};
