/**
 * legalPages — Content registry for CROS™ legal foundation pages.
 *
 * WHAT: Structured, human-centered legal content for Terms, Privacy, DPA, AUP, and AI Transparency.
 * WHERE: Rendered by LegalPageLayout on /legal/* routes.
 * WHY: Legal pages should feel like a field guide, not a corporate wall.
 */

export interface LegalSection {
  id: string;
  title: string;
  body: string;
}

export interface LegalPageContent {
  title: string;
  route: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export const TERMS_CONTENT: LegalPageContent = {
  title: 'Terms of Use',
  route: '/legal/terms',
  lastUpdated: '2026-02-01',
  intro: 'CROS exists to help organizations care for people with clarity, memory, and dignity. These terms explain how we work together.',
  sections: [
    { id: 'using-cros', title: 'Using CROS', body: 'CROS™ is a relationship operating system designed for mission-driven organizations. By creating an account, you agree to use it in service of your community — with care, honesty, and respect for the people whose stories pass through it.' },
    { id: 'your-data', title: 'Your Data Belongs To You', body: 'All data you enter into CROS — reflections, contacts, journey notes, visit records — belongs to your organization. We are custodians, not owners. You may export your data at any time. If you leave CROS, your data leaves with you.' },
    { id: 'accounts', title: 'Accounts & Roles', body: 'Each organization receives its own isolated tenant. User roles — Steward, Shepherd, Companion, Visitor — determine what each person can see and do. Role assignments are managed by your organization\'s administrators, not by CROS.' },
    { id: 'communications', title: 'Communications & Email Intake', body: 'If you connect email, CROS processes incoming messages to surface relationship insights. Email content is never shared across organizations. Processing is opt-in, and you can disconnect at any time. We do not read, store, or sell email content for advertising.' },
    { id: 'ai', title: 'AI Assistance', body: 'CROS uses AI to organize reflections, suggest follow-ups, and surface narrative patterns. AI never makes decisions for your organization. Humans remain responsible for every relationship, every visit, every choice. AI assists the story — it never writes it.' },
    { id: 'availability', title: 'Availability', body: 'We work to keep CROS available and reliable. Scheduled maintenance will be communicated in advance. We do not guarantee 100% uptime, but we commit to transparency about any disruptions.' },
    { id: 'respectful-use', title: 'Respectful Use', body: 'CROS is built for organizations that serve people. We ask that you use it with the same care you bring to your mission. Harassment, exploitation, or use of CROS to harm vulnerable communities will result in account termination.' },
    { id: 'ending', title: 'Ending Service', body: 'Either party may end the relationship at any time. Upon termination, your data will be available for export for 90 days. After that period, it will be permanently deleted from our systems.' },
    { id: 'changes', title: 'Changes', body: 'We may update these terms as CROS evolves. Material changes will be communicated via email to account administrators at least 30 days before taking effect.' },
    { id: 'contact', title: 'Contact', body: 'Questions about these terms? Reach us at legal@thecros.com. We respond to every inquiry with the same care we put into building the platform.' },
  ],
};

export const PRIVACY_CONTENT: LegalPageContent = {
  title: 'Privacy Policy',
  route: '/legal/privacy',
  lastUpdated: '2026-02-01',
  intro: 'CROS was built to help organizations remember people — not to harvest them.',
  sections: [
    { id: 'what-we-collect', title: 'What We Collect', body: 'We collect account information (name, email, organization), relationship data you enter (contacts, reflections, visit notes, journey records), and minimal usage data (login frequency, feature adoption patterns). We do not collect browsing history, location data, or device fingerprints.' },
    { id: 'how-used', title: 'How Data Is Used', body: 'Your data serves one purpose: helping your organization care for your community. We use it to power reflections, signals, journey tracking, and narrative intelligence. We never sell data. We never share individual data across organizations. Aggregated, anonymized patterns may inform public ecosystem signals — but these never identify any person or organization.' },
    { id: 'discovery-personalization', title: 'Discovery Personalization', body: 'We use publicly available information from organization websites or public profiles to personalize discovery. When you provide a website URL or social profile during onboarding, we extract mission-relevant keywords to help you find events, grants, and partners aligned with your work. We never include private tenant data, person names, case notes, or internal activities in external search queries. You can view, edit, or remove your discovery keywords at any time from Settings.' },
    { id: 'voice-notes', title: 'Voice Notes & Transcription', body: 'If you use voice notes, audio is transcribed and stored as text reflections. Audio files are deleted after transcription. Transcription is processed securely and never shared with third parties for training purposes.' },
    { id: 'email-intake', title: 'Email Intake Processing', body: 'When email integration is enabled, CROS processes incoming emails to identify relationship-relevant content. Processing respects sender patterns and domain filters. Email content is scoped to the individual user and never visible to other team members unless explicitly shared.' },
    { id: 'cookies', title: 'Cookies & Minimal Analytics', body: 'CROS uses essential cookies for authentication only. We do not use tracking pixels, advertising cookies, or third-party analytics that follow you across the web. If we measure feature usage, it is aggregate and anonymous.' },
    { id: 'discernment-signals', title: 'Anonymous Interaction Signals', body: 'We observe anonymous interaction patterns on our marketing pages to improve clarity of our mission language. These signals capture only which pages and questions draw attention — never who is visiting. We do not track individual visitors, store IP addresses, or use fingerprinting. All patterns are aggregated before they reach our team.' },
    { id: 'companion-mode', title: 'Companion Mode', body: 'When Narrative Companion Mode is enabled, CROS may show gentle contextual guidance while you work. This feature logs only whether guidance was shown, accepted, or dismissed -- along with the page and trigger type. It never records what you type, who you interact with, or any contact or relationship data. You can disable Companion Mode at any time from your Settings or the user menu.' },
    { id: 'security', title: 'Data Security', body: 'All data is encrypted in transit and at rest. Each organization exists in an isolated tenant with row-level security. Access is controlled by role-based permissions that your administrators manage. We conduct regular security reviews and maintain incident response procedures.' },
    { id: 'your-rights', title: 'Your Rights', body: 'You have the right to access, correct, export, or delete your data at any time. Data export is available in standard formats. Deletion requests are honored within 30 days. These rights apply regardless of your geographic location.' },
    { id: 'familia', title: 'Familia & Organizational Kinship', body: 'CROS may suggest organizational relationships using anonymized proximity and mission signals. These suggestions are based on geographic closeness, archetype similarity, and enrichment keyword overlap. You control whether you join or reveal your presence. No tenant names are disclosed without mutual public consent. All suggestions are optional and reversible.' },
    { id: 'children', title: 'Children & Sensitive Data', body: 'CROS is designed for organizational use by adults. We do not knowingly collect data from children under 16. If your organization serves minors, you are responsible for ensuring that any data entered complies with applicable child protection laws.' },
    { id: 'changes', title: 'Changes', body: 'We will notify account administrators of material privacy changes at least 30 days before they take effect. Your continued use of CROS after changes constitutes acceptance.' },
  ],
};

export const DPA_CONTENT: LegalPageContent = {
  title: 'Data Processing Addendum',
  route: '/legal/data-processing',
  lastUpdated: '2026-02-01',
  intro: 'This addendum clarifies how data flows between your organization and CROS — who controls what, and what protections are in place.',
  sections: [
    { id: 'ownership', title: 'Data Ownership', body: 'Your organization (the "Controller") owns all data entered into CROS. CROS (the "Processor") processes this data solely on your behalf, according to your instructions, and for the purposes you define. We do not process your data for our own purposes beyond providing the service.' },
    { id: 'scope', title: 'Processing Scope', body: 'CROS processes relationship data (contacts, reflections, visits, journey records), communication data (email intake when enabled), and organizational configuration (journey stages, roles, metro assignments). Processing activities include storage, retrieval, narrative intelligence generation, and signal aggregation.' },
    { id: 'security-practices', title: 'Security Practices', body: 'We implement industry-standard security measures: encryption at rest and in transit, row-level security isolation between tenants, role-based access controls, regular security audits, and automated monitoring for unauthorized access attempts.' },
    { id: 'retention', title: 'Data Retention & Export', body: 'Active data is retained for the duration of your subscription. Upon termination, data is available for export for 90 days, then permanently deleted. Backup copies are purged within 30 days of primary deletion. You may request earlier deletion at any time.' },
    { id: 'subprocessors', title: 'Subprocessors', body: 'CROS uses the following subprocessors: cloud infrastructure for hosting and database services, payment processing for billing, and email delivery services for transactional notifications. We maintain a current list of subprocessors and will notify you of changes with 30 days\' notice.' },
    { id: 'incidents', title: 'Incident Communication', body: 'In the event of a data breach, we will notify affected organizations within 72 hours of discovery. Notifications will include the nature of the breach, affected data categories, remediation steps taken, and recommended actions for your organization.' },
  ],
};

export const ACCEPTABLE_USE_CONTENT: LegalPageContent = {
  title: 'Acceptable Use',
  route: '/legal/acceptable-use',
  lastUpdated: '2026-02-01',
  intro: 'CROS is built to support care, not control.',
  sections: [
    { id: 'respectful', title: 'Respectful Use', body: 'Use CROS to strengthen relationships, support communities, and honor the dignity of the people your organization serves. The platform is designed for mission-driven work — treat it, and the people within it, accordingly.' },
    { id: 'no-harassment', title: 'No Harassment or Exploitation', body: 'CROS must never be used to harass, stalk, intimidate, or exploit any person. This includes using relationship data to pressure, manipulate, or coerce individuals. If we become aware of such use, we will terminate access immediately.' },
    { id: 'lawful', title: 'Lawful Data Practices', body: 'You are responsible for ensuring that all data entered into CROS is collected lawfully and with appropriate consent. This is especially important when working with vulnerable populations, minors, or communities with heightened privacy needs.' },
    { id: 'protection', title: 'Protection of Vulnerable Communities', body: 'Many CROS organizations serve people in fragile circumstances — refugees, people experiencing homelessness, families in crisis. Extra care must be taken with their data. Never share identifying information outside your organization without explicit consent. CROS enforces tenant isolation to support this, but organizational responsibility is paramount.' },
  ],
};

export const AI_TRANSPARENCY_CONTENT: LegalPageContent = {
  title: 'AI Transparency — NRI™',
  route: '/legal/ai-transparency',
  lastUpdated: '2026-02-01',
  intro: 'NRI™ helps organize stories. It does not replace human discernment.',
  sections: [
    { id: 'what-ai-does', title: 'What AI Does Inside CROS', body: 'AI in CROS assists with organizing reflections into themes, suggesting follow-up actions based on visit patterns, surfacing narrative signals from aggregated activity, identifying drift patterns when relational rhythms change, and generating summary narratives from structured data. Every AI suggestion is presented as a gentle observation — never as a directive.' },
    { id: 'what-ai-never-does', title: 'What AI Never Does', body: 'AI in CROS never makes decisions about people. It never scores donors. It never ranks relationships by "value." It never profiles individuals across organizations. It never shares insights between tenants. It never replaces the shepherd\'s discernment or the companion\'s presence.' },
    { id: 'human-oversight', title: 'Human Oversight', body: 'Every AI-generated suggestion can be accepted, modified, or dismissed by a human. No automated action is taken without human review. Reflection summaries, drift signals, and narrative suggestions are always presented as observations — "we\'re noticing" rather than "you must." The human in the loop is not optional. It is the entire point.' },
    { id: 'nri-vs-automation', title: 'Narrative Relational Intelligence vs Automation', body: 'NRI is not automation. Automation executes predefined rules. NRI witnesses patterns. It is built from reflections, visits, events, and community signals — all entered by humans, all interpreted by humans. The "intelligence" in NRI belongs to the relationships, not the algorithm. AI assists the organization of that intelligence. It does not generate it.' },
    { id: 'data-boundaries', title: 'Data Boundaries', body: 'AI processing in CROS operates within strict boundaries: tenant isolation is absolute — no model learns from one organization\'s data to serve another. Reflections are never used to train external AI models. Email content processed for intake is never shared or stored beyond the user\'s own account. Aggregated signals used for public ecosystem pages are anonymized and cannot be traced to any individual or organization.' },
  ],
};

export const ALL_LEGAL_PAGES = [
  TERMS_CONTENT,
  PRIVACY_CONTENT,
  DPA_CONTENT,
  ACCEPTABLE_USE_CONTENT,
  AI_TRANSPARENCY_CONTENT,
];
