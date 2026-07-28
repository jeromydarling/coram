/**
 * setupGuides — Step-by-step human-friendly setup instructions per connector.
 *
 * WHAT: Provides step content for IntegrationGuidePanel.
 * WHERE: /:tenantSlug/relatio/companion/:connectorKey
 * WHY: TurboTax-style guided experience for ministry leaders.
 *
 * Content sourced from the ChMS API Setup Guide (compiled Feb 2026).
 */

export interface SetupStep {
  title: string;
  description: string;
  copyableText?: string;
  encouragement?: string;
  /** Path to a screenshot image in /public/images/relatio/ */
  screenshotPath?: string;
  /** Alt text / caption for the screenshot */
  screenshotCaption?: string;
  /** Tip callout displayed in a highlight box */
  tip?: string;
  /** Warning or important note */
  note?: string;
}

export interface ConnectorGuide {
  difficulty: 'easy' | 'guided' | 'requires_support';
  estimatedTime: string;
  steps: SetupStep[];
  /** What data can be read (for the connected state) */
  availableData?: string[];
}

export const SETUP_GUIDES: Record<string, ConnectorGuide> = {
  breeze: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['People / Contacts', 'Families / Households', 'Events', 'Event Attendance', 'Tags / Groups'],
    steps: [
      {
        title: 'Sign in to Breeze',
        description: 'Open your browser and go to yourchurch.breezechms.com. Sign in with your Breeze username and password. You need to be the Account Owner or an Admin.',
        tip: 'Your subdomain is the "yourchurch" part of your URL — write it down, you\'ll need it along with the API key.',
        encouragement: 'This will be quick.',
        screenshotPath: '/images/relatio/breeze-step1.jpg',
        screenshotCaption: 'Click the gear icon in the top-right, then select "Manage Account."',
      },
      {
        title: 'Open Gear → Manage Account → API Key',
        description: 'Look in the top-right corner for the gear icon. Click it and select "Manage Account." Then click "API Key" in the left sidebar menu.',
        note: 'If you don\'t see "API Key" in the menu, your account may not have the API feature. Contact Breeze support.',
        screenshotPath: '/images/relatio/breeze-step1.jpg',
        screenshotCaption: 'Navigate: Gear → Manage Account → API Key in the left menu.',
      },
      {
        title: 'Copy Your API Key and Subdomain',
        description: 'On the API Key page, you\'ll see your unique API key — a long string. Click copy or select and copy the text. Also note your subdomain (the "yourchurch" part from your URL).',
        note: 'Keep your API key private — it\'s like a password. Anyone with this key can read your Breeze data.',
        screenshotPath: '/images/relatio/breeze-step2.jpg',
        screenshotCaption: 'Copy both the API Key and your subdomain.',
        encouragement: 'One more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your people, families, and events daily. Nothing changes in Breeze — your system stays the source of record.',
        encouragement: "That's it! Your church data is gently connected.",
      },
    ],
  },
  planningcenter: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['People', 'Households', 'Calendar / Events', 'Check-Ins / Attendance', 'Groups', 'Webhooks'],
    steps: [
      {
        title: 'Open the Planning Center Developer Portal',
        description: 'Go to api.planningcenteronline.com and sign in with your normal Planning Center username and password.',
        copyableText: 'https://api.planningcenteronline.com',
        tip: 'You need to be logged into a Planning Center account that belongs to your church organization. Any staff account with sufficient permissions will work.',
        encouragement: "You're off to a great start.",
        screenshotPath: '/images/relatio/planningcenter-step1.jpg',
        screenshotCaption: 'The Planning Center Developer Portal — click "Personal Access Tokens" tab.',
      },
      {
        title: 'Create a New Personal Access Token',
        description: 'Click on "Personal Access Tokens" in the navigation. Then click "+ New Personal Access Token." Give it a name like "CROS Companion" and select the scopes: People, Calendar, and Check-Ins.',
        tip: 'Giving is optional — only check it if you want donation data visible in CROS.',
        encouragement: 'Almost there — just one more detail.',
        screenshotPath: '/images/relatio/planningcenter-step2.jpg',
        screenshotCaption: 'Fill in the token name and select which Planning Center apps CROS needs access to.',
      },
      {
        title: 'Copy Your App ID and Secret',
        description: 'After saving, you\'ll be shown your App ID and Secret. Copy both immediately — the Secret may only be shown once.',
        note: 'The Secret may only be displayed once. If you lose it, you\'ll need to delete the token and create a new one.',
        encouragement: 'Store them safely — then paste them below.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your data quietly. Nothing changes in your existing system. Your Planning Center stays the source of record.',
        tip: 'Planning Center supports Webhooks — CROS can automatically receive updates when something changes, without having to ask repeatedly.',
        encouragement: "You did it! Your ministry data is in good hands.",
      },
    ],
  },
  ministryplatform: {
    difficulty: 'guided',
    estimatedTime: '15 minutes',
    availableData: ['Contacts / People', 'Households', 'Addresses', 'Groups', 'Events', 'Event Participants'],
    steps: [
      {
        title: 'Sign in as a Platform Administrator',
        description: 'Open your MinistryPlatform URL (looks like mychurch.ministryplatform.com) and log in with an account that has Administrator privileges. Only admins can create API clients.',
        tip: 'If you\'re not sure whether you have admin access, look for "Administration" in the main navigation menu. If you don\'t see it, ask your IT admin.',
        encouragement: 'Great — you know your system well.',
        screenshotPath: '/images/relatio/ministryplatform-step1.jpg',
        screenshotCaption: 'Navigate to Administration → API Clients in MinistryPlatform.',
      },
      {
        title: 'Create a New API Client',
        description: 'Navigate to Administration → API Clients. Click "+ New API Client." Set the Display Name to "CROS Companion." Enter a simple Client ID like "cros-companion." Click the magic wand icon to auto-generate a Client Secret. Select "API User" for the Client User.',
        note: 'The Client User you assign determines what data can be accessed. Make sure it has read permissions for people, households, and events.',
        screenshotPath: '/images/relatio/ministryplatform-step2.jpg',
        screenshotCaption: 'Fill in the API Client form. Use the magic wand to generate a secure Client Secret.',
      },
      {
        title: 'Copy Your Credentials and API URL',
        description: 'Copy the Client ID and Client Secret. Also note your API URL — it\'s your platform URL with "/ministryplatformapi" at the end.',
        copyableText: '/ministryplatformapi',
        tip: 'To confirm your API URL works, open it in a browser — you should see a "Platform REST API Test Page."',
        encouragement: 'One more step and you\'re connected.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will connect via OAuth2 and read your events, households, and people. Nothing is modified in MinistryPlatform.',
        encouragement: 'Your ministry data is now gently connected to CROS.',
      },
    ],
  },
  rock: {
    difficulty: 'guided',
    estimatedTime: '20 minutes',
    availableData: ['People', 'Families (Groups)', 'Addresses', 'Events', 'Event Occurrences', 'Attendance'],
    steps: [
      {
        title: 'Sign in to Rock as an Administrator',
        description: 'Navigate to your Rock RMS URL (e.g., https://rock.mychurch.org) and log in with an administrator account.',
        tip: 'You need Rock administrator access. If you\'re a regular user, you won\'t see the Admin Tools menu.',
        encouragement: "You're in the right place.",
        screenshotPath: '/images/relatio/rock-step1.jpg',
        screenshotCaption: 'Navigate to Admin Tools → Security → REST Keys in Rock RMS.',
      },
      {
        title: 'Create a REST Key',
        description: 'Go to Admin Tools → Security → REST Keys. Click the + button. Name it "CROS Companion Key." Click "Generate Key" — Rock will create a random 24-character key. Make sure "Active" is checked, then click Save.',
        screenshotPath: '/images/relatio/rock-step2.jpg',
        screenshotCaption: 'Click + to add a new REST Key, give it a name, click "Generate Key," then Save.',
      },
      {
        title: 'Assign Security Permissions',
        description: 'After saving the REST key, Rock creates a user account linked to it. Go to Admin Tools → Security → User Accounts, find the account matching your key\'s name, open it, click the Security tab, and add the "RSR - Rock Administration" security role.',
        note: 'This is the step most people miss! Without assigning the security role, your API key will return 401 errors even though the key exists.',
        encouragement: 'Almost connected.',
      },
      {
        title: 'Copy Your Key and Rock URL',
        description: 'Copy the 24-character REST Key and your Rock URL (e.g., https://rock.mychurch.org). Paste both below.',
        copyableText: 'https://rock.mychurch.org',
        tip: 'If you can\'t find the REST key after saving, go back to Admin Tools → Security → REST Keys — it will be listed there.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will poll your Rock RMS instance hourly for people, groups, and events. Nothing is modified.',
        encouragement: 'Your community data is now gently listening.',
      },
    ],
  },
  parishsoft: {
    difficulty: 'requires_support',
    estimatedTime: '1–5 business days',
    availableData: ['Family Records', 'Members / People', 'Sacrament Records', 'Contributions', 'Organizations'],
    steps: [
      {
        title: 'Confirm Your Account Details',
        description: 'Log in to ParishSOFT Family Suite at your organization\'s URL (looks like yourdiocese.parishsoftfamilysuite.com). Note your church name, diocese, and account contact email.',
        tip: 'Note your URL carefully — it includes your diocese code, which support will ask for.',
        encouragement: "We'll wait for your key — no rush.",
        screenshotPath: '/images/relatio/parishsoft-step1.jpg',
        screenshotCaption: 'The ParishSOFT API Explorer — you\'ll use this after you receive your key.',
      },
      {
        title: 'Contact ParishSOFT Support',
        description: 'Email support@parishsoft.com with the subject: "Request for Family Suite API Key — [Your Parish Name]." Include your full name, role, parish name, diocese, account URL, and that you need read-only access for CRM integration.',
        copyableText: 'support@parishsoft.com',
        tip: 'Call if you need it faster — phone support is available during business hours at parishsoft.com/support.',
        screenshotPath: '/images/relatio/parishsoft-step2.jpg',
        screenshotCaption: 'ParishSOFT API access requires contacting support — there is no self-serve key generation.',
      },
      {
        title: 'Wait for Your API Key',
        description: 'ParishSOFT will email you an API key (looks like: a1b2c3d4-e5f6-7890-abcd-ef1234567890). They\'ll also provide your Diocese ID. This typically takes 1–5 business days.',
        encouragement: 'Take your time. We\'ll be here when you\'re ready.',
      },
      {
        title: 'Enter Your API Key',
        description: 'Paste the API key from ParishSOFT below. The API base URL is fsapi.parishsoft.app.',
        copyableText: 'https://fsapi.parishsoft.app',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your parish data quietly — families, members, and constituents. Nothing is changed in ParishSOFT.',
        encouragement: 'Your parish relationships are now gently connected.',
      },
    ],
  },
  fellowshipone: {
    difficulty: 'requires_support',
    estimatedTime: '1–3 business days',
    availableData: ['People', 'Households', 'Groups', 'Activities / Events', 'Contributions', 'Attributes'],
    steps: [
      {
        title: 'Identify Your Church Code',
        description: 'Your FellowshipOne Church Code is the subdomain part of your F1 portal URL. For example, if your portal is at mychurch.fellowshipchurchconnect.com, your church code is "mychurch."',
        tip: 'Log in to your F1 portal and check the URL in your browser — the part before the first dot is your church code.',
        encouragement: "We'll wait — no rush at all.",
        screenshotPath: '/images/relatio/fellowshipone-step1.jpg',
        screenshotCaption: 'The FellowshipOne developer site key request form.',
      },
      {
        title: 'Apply for a 2nd Party Key',
        description: 'Go to developer.fellowshipone.com. Register or log in, then fill out the key request form with your church name, church code, and application name "CROS Companion." Select the realms: People, Groups, and Events/Activities.',
        copyableText: 'http://developer.fellowshipone.com',
        note: 'If the developer site is unavailable, contact your F1 account representative directly.',
        screenshotPath: '/images/relatio/fellowshipone-step2.jpg',
        screenshotCaption: 'Fill in all fields and select your required Realms (People, Groups, Events).',
      },
      {
        title: 'Receive Your Consumer Key and Secret',
        description: 'FellowshipOne will email you a Consumer Key and Consumer Secret, typically within 1–3 business days. You may receive separate keys for Staging and Production.',
        tip: 'Request a Staging key first for testing before using Production keys.',
        encouragement: 'Take your time.',
      },
      {
        title: 'Create a Portal User for the API',
        description: 'Log in to your F1 admin portal and create a dedicated portal user (e.g., "cros.companion@mychurch.org"). This user must be linked to a Person record in F1 — if not linked, the API will fail.',
        note: 'This is a critical step — the portal user must be linked to a Person record.',
      },
      {
        title: 'Enter Your Credentials',
        description: 'Paste the Consumer Key, Consumer Secret, Church Code, and Portal User credentials below.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your people, households, and activities hourly. Nothing is modified in FellowshipOne.',
        encouragement: 'Your ministry relationships are now gently connected.',
      },
    ],
  },
  salesforce: {
    difficulty: 'guided',
    estimatedTime: '15–20 minutes',
    availableData: ['Contacts', 'Accounts / Organizations', 'Leads', 'Opportunities / Deals', 'Tasks & Activities', 'Notes', 'Custom Objects', 'Files / Attachments'],
    steps: [
      {
        title: 'Log in as a Salesforce Administrator',
        description: 'Go to your Salesforce org URL (e.g., https://mychurch.my.salesforce.com) and log in with an account that has System Administrator permissions. You must be an admin to create Connected Apps.',
        tip: 'Not sure if you\'re an admin? Go to your profile picture → Settings → My Profile. If you see "System Administrator" in your profile, you\'re good to go.',
        encouragement: 'This process takes about 15 minutes — you\'re in good hands.',
        screenshotPath: '/images/relatio/salesforce-step1.jpg',
        screenshotCaption: 'Log into Salesforce and click the gear icon to open Setup.',
      },
      {
        title: 'Navigate to App Manager',
        description: 'Click the gear icon in the top-right corner, then select "Setup." In the Setup panel, use the Quick Find search box on the left and type "App Manager." Click on App Manager in the results.',
        tip: 'Full path: Platform Tools → Apps → App Manager. You\'ll see a list of all existing apps.',
        screenshotPath: '/images/relatio/salesforce-step2.jpg',
        screenshotCaption: 'Find App Manager in Setup, then click "New Connected App."',
      },
      {
        title: 'Create a New Connected App',
        description: 'Click "New Connected App" at the top right. Fill in: Connected App Name → "CROS Companion", Contact Email → your email. Then scroll to "API (Enable OAuth Settings)" and CHECK the box "Enable OAuth Settings." Set Callback URL to https://login.salesforce.com/services/oauth2/success. Add scopes: "Manage user data via APIs (api)" and "Perform requests at any time (refresh_token, offline_access)." Click Save.',
        copyableText: 'https://login.salesforce.com/services/oauth2/success',
        note: 'If you skip enabling OAuth Settings, the Connected App won\'t work. This checkbox is easy to miss!',
        screenshotPath: '/images/relatio/salesforce-step3.jpg',
        screenshotCaption: 'Enable OAuth Settings and select the API scope.',
      },
      {
        title: 'Wait 2–10 Minutes, Then Copy Credentials',
        description: 'After saving, wait 2–10 minutes for Salesforce to activate the app. Then go to the app detail page, scroll to "API (Enable OAuth Settings)" and click "Manage Consumer Details." Copy your Consumer Key (Client ID) and Consumer Secret (Client Secret). Also note your Instance URL from your browser bar (e.g., https://mychurch.my.salesforce.com).',
        tip: 'Your CRM may call these "Consumer Key/Secret," "Client ID/Secret," or "App ID/App Secret" — they\'re the same values.',
        note: 'The 2–10 minute wait is real. If you get errors immediately after saving, just wait and try again.',
        screenshotPath: '/images/relatio/salesforce-step4.jpg',
        screenshotCaption: 'Copy your Consumer Key and reveal the Consumer Secret.',
        encouragement: 'Almost there — one more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your contacts, accounts, opportunities, and activities from Salesforce. Nothing is modified — your Salesforce instance stays the source of record.',
        encouragement: 'Your CRM data is now gently connected to CROS.',
      },
    ],
  },
  hubspot: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['Contacts', 'Companies', 'Deals', 'Tickets', 'Activities / Engagements', 'Lists / Segments', 'Owners (Users)', 'Custom Objects (Pro+)'],
    steps: [
      {
        title: 'Log in with a Super Admin Account',
        description: 'Go to app.hubspot.com and log in. You need to be a Super Admin on the HubSpot account to create Private Apps. Regular users cannot access this feature.',
        tip: 'To check your role: go to Settings → Users & Teams and find your name. "Super Admin" will be listed as your permission set.',
        encouragement: 'This takes about 5 minutes — really quick.',
        screenshotPath: '/images/relatio/hubspot-step1.jpg',
        screenshotCaption: 'Navigate to Settings → Integrations → Private Apps.',
      },
      {
        title: 'Go to Settings → Integrations → Private Apps',
        description: 'Click the gear icon in the top navigation bar to open HubSpot Settings. In the left sidebar, scroll to "Integrations" and click "Private Apps." Then click the "Create a private app" button.',
        screenshotPath: '/images/relatio/hubspot-step2.jpg',
        screenshotCaption: 'Click "Create a private app" to start.',
      },
      {
        title: 'Name Your App and Select Scopes',
        description: 'On the Basic Info tab, name it "CROS Companion." Switch to the Scopes tab and add: crm.objects.contacts.read, crm.objects.companies.read, crm.objects.deals.read, crm.objects.owners.read. Add write scopes only if needed.',
        tip: 'Start with read-only scopes — you can always create a new app with more permissions later.',
        note: 'HubSpot deprecated legacy API keys in November 2022. You must use a Private App.',
        screenshotPath: '/images/relatio/hubspot-step3.jpg',
        screenshotCaption: 'Select read scopes for contacts, companies, deals, and owners.',
      },
      {
        title: 'Create App and Copy Access Token',
        description: 'Click "Create app" at the top right. On the app detail page, find the Access Token section, click "Show token," then click "Copy." The token starts with "pat-na-" and is very long — copy the entire string.',
        note: 'The token is very long (starts with "pat-na-"). Copy the entire string — don\'t cut it off.',
        tip: 'Your Portal ID is visible in the URL when logged in: app.hubspot.com/contacts/XXXXXXXX.',
        screenshotPath: '/images/relatio/hubspot-step4.jpg',
        screenshotCaption: 'Click "Show token" to reveal your access token, then copy the full value.',
        encouragement: 'One more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your contacts, companies, deals, and activities from HubSpot. Nothing is modified — your HubSpot account stays the source of record.',
        tip: 'Private App tokens never expire, making them ideal for ongoing CRM sync.',
        encouragement: 'Your HubSpot data is now gently connected to CROS.',
      },
    ],
  },
  airtable: {
    difficulty: 'easy',
    estimatedTime: '3–5 minutes',
    availableData: ['Records (any table)', 'Fields / Column data', 'Linked Records', 'Attachments / Files', 'Base Schema', 'Views', 'Webhooks (optional)'],
    steps: [
      {
        title: 'Log in to Airtable',
        description: 'Go to airtable.com and log in with your regular username and password. Any Airtable user can create Personal Access Tokens — you don\'t need to be an admin.',
        tip: 'The token you create will only have access to bases that you\'ve been shared on. If you need data from a base owned by someone else, have them share it with you first.',
        encouragement: 'This is the quickest setup — about 3 minutes.',
        screenshotPath: '/images/relatio/airtable-step1.jpg',
        screenshotCaption: 'Click your profile icon in the top-right corner, then select "Builder Hub."',
      },
      {
        title: 'Open Builder Hub → Personal Access Tokens',
        description: 'Click your profile icon in the top-right corner. Select "Builder Hub" from the dropdown. In the left sidebar, click "Personal access tokens." Then click "+ Create new token."',
        screenshotPath: '/images/relatio/airtable-step2.jpg',
        screenshotCaption: 'Inside Builder Hub, click "Personal access tokens," then "+ Create new token."',
      },
      {
        title: 'Name Token, Set Scopes, and Choose Bases',
        description: 'Name it "CROS Companion." Add scopes: data.records:read and schema.bases:read. Under Access, choose the specific base your data lives in — or select "All bases" for convenience. Click "Create token."',
        tip: 'Start with just the two read scopes. You can always create a new token with more scopes later.',
        note: 'Legacy API Keys were deprecated February 1, 2024 — they no longer work. You must use a Personal Access Token.',
        screenshotPath: '/images/relatio/airtable-step3.jpg',
        screenshotCaption: 'Set scopes and choose which bases this token can access.',
      },
      {
        title: 'Copy Token and Find Your Base ID',
        description: 'Copy the token immediately — it starts with "pat" and is only shown once. Then open your Airtable base and look at the URL: airtable.com/appXXXXXXXXXXXXXX/... The "appXXX" part is your Base ID. Copy it too.',
        note: 'If you close the token window without copying, you cannot get it back — you\'ll need to create a new one.',
        tip: 'You can also find the Base ID in Help → API documentation inside your base.',
        encouragement: 'One more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your records, tables, and relationships from Airtable. Nothing is modified — your Airtable bases stay the source of record.',
        tip: 'Airtable\'s biggest advantage: since it\'s a flexible database, CROS can pull any data structure you\'ve built — custom fields work exactly like built-in ones.',
        encouragement: 'Your Airtable data is now gently connected to CROS.',
      },
    ],
  },
  bloomerang: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['Constituents', 'Donations', 'Interactions / Notes', 'Campaigns', 'Funds', 'Appeals', 'Custom Fields'],
    steps: [
      {
        title: 'Sign in to Bloomerang as an Administrator',
        description: 'Open your browser and go to app.bloomerang.co. Sign in with an account that has Administrator-level permissions. Only administrators can generate API keys.',
        tip: 'Not sure if you\'re an admin? Check your user profile — it should say "Administrator" under your role.',
        encouragement: 'This will be quick — about 5 minutes.',
        screenshotPath: '/images/relatio/bloomerang-step1.jpg',
        screenshotCaption: 'Click the user icon in the upper-right corner, then select "Edit My User."',
      },
      {
        title: 'Navigate to API Keys',
        description: 'Click the user icon in the upper-right corner. Select "Edit My User" from the dropdown. Scroll down to the "API Keys" section.',
        screenshotPath: '/images/relatio/bloomerang-step1.jpg',
        screenshotCaption: 'Find the API Keys section within Edit My User.',
      },
      {
        title: 'Generate and Copy Your API Key',
        description: 'Click "Generate New Key." A new private API key will appear. Copy and securely store the key — it\'s displayed in full here.',
        note: 'The private key gives full read/write access to all your data. Never paste it in code or share it publicly.',
        encouragement: 'One more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your constituents, donations, and interactions from Bloomerang. Nothing is modified — your Bloomerang stays the source of record.',
        encouragement: 'Your donor relationships are now gently connected to CROS.',
      },
    ],
  },
  neoncrm: {
    difficulty: 'easy',
    estimatedTime: '5–10 minutes',
    availableData: ['Accounts (Constituents)', 'Donations', 'Events & Attendees', 'Memberships', 'Households', 'Volunteers', 'Custom Fields'],
    steps: [
      {
        title: 'Find Your Organization ID',
        description: 'Log in to NeonCRM. Click the Settings gear icon. Go to Organization Profile → Account Information and note your Organization ID.',
        tip: 'Your Org ID is a short alphanumeric code (e.g., myorg123). It\'s paired with your API key for authentication.',
        encouragement: 'Two quick steps to go.',
        screenshotPath: '/images/relatio/neoncrm-step1.jpg',
        screenshotCaption: 'Settings → Organization Profile → find your Org ID.',
      },
      {
        title: 'Create an Integration User and Generate API Key',
        description: 'Go to Settings → Users & Roles → New User. Name it "CROS Integration User" with read-only permissions. Log in as that user, click Edit Profile, find the API Keys section, and click "Generate API Key." Copy the key.',
        note: 'API keys inherit the user\'s permissions. Always use a minimum-permissions user for integrations.',
        screenshotPath: '/images/relatio/neoncrm-step1.jpg',
        screenshotCaption: 'Generate an API key from the user\'s profile page.',
      },
      {
        title: 'Enter Your Org ID and API Key',
        description: 'Paste your Organization ID and the API key you just generated below.',
        encouragement: 'Almost there.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your accounts, donations, events, and memberships from NeonCRM. Nothing is modified — NeonCRM stays the source of record.',
        encouragement: 'Your nonprofit data is now gently connected to CROS.',
      },
    ],
  },
  lgl: {
    difficulty: 'requires_support',
    estimatedTime: '1–3 business days',
    availableData: ['Constituents', 'Gifts / Donations', 'Appeals', 'Groups', 'Notes'],
    steps: [
      {
        title: 'Request API Access from LGL Support',
        description: 'Email support@littlegreenlight.com to request API access. Briefly describe your use case (e.g., "syncing data with CROS"). Review and agree to the LGL API Terms of Use.',
        copyableText: 'support@littlegreenlight.com',
        tip: 'Mention that you\'ve reviewed the API Terms to speed up approval.',
        encouragement: 'We\'ll wait — no rush at all.',
        screenshotPath: '/images/relatio/lgl-step1.jpg',
        screenshotCaption: 'The LGL API is in beta — you must request access first.',
      },
      {
        title: 'Get Your API Key',
        description: 'Once approved (typically 1–3 days), log in to your LGL account. Navigate to Settings → API (exact path provided in the approval email). Copy your API key.',
        note: 'The API is in beta. Some LGL features may not yet be available via the API.',
      },
      {
        title: 'Enter Your API Key',
        description: 'Paste the API key from Little Green Light below.',
        encouragement: 'One more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your constituents, gifts, and appeals from Little Green Light. Nothing is modified — LGL stays the source of record.',
        encouragement: 'Your donor data is now gently connected to CROS.',
      },
    ],
  },
  donorperfect: {
    difficulty: 'requires_support',
    estimatedTime: '1–3 business days',
    availableData: ['Donors', 'Gifts / Donations', 'Pledges', 'Contacts / Notes', 'User-Defined Fields'],
    steps: [
      {
        title: 'Create a Dedicated Integration User',
        description: 'Log in to DonorPerfect as an admin. Go to Settings → User Management → Add New User. Name it "api_integration" (20 chars max, no spaces). Set Location to "CROS Integration." Grant minimum permissions: Main: Edit, Gifts: Access + Edit.',
        tip: 'Setting the Location field helps DonorPerfect support identify your API account.',
        screenshotPath: '/images/relatio/donorperfect-step1.jpg',
        screenshotCaption: 'Create a dedicated integration user with minimal permissions.',
      },
      {
        title: 'Request Your API Key from Support',
        description: 'Email api@softerware.com or contact your DonorPerfect account manager. Tell them you need an API key for the integration user you just created.',
        copyableText: 'api@softerware.com',
        note: 'DonorPerfect does NOT provide self-service API key generation. Plan for 1–3 business days.',
        encouragement: 'We\'ll be here when you hear back.',
      },
      {
        title: 'Enter Your API Key',
        description: 'Paste the API key DonorPerfect emailed you below.',
        encouragement: 'Almost connected.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your donors, gifts, and pledges from DonorPerfect. Nothing is modified — DonorPerfect stays the source of record.',
        note: 'DonorPerfect uses an XML-based API. CROS handles the XML parsing automatically.',
        encouragement: 'Your fundraising data is now gently connected to CROS.',
      },
    ],
  },
  kindful: {
    difficulty: 'easy',
    estimatedTime: '10 minutes',
    availableData: ['Contacts', 'Transactions / Donations', 'Campaigns', 'Groups / Tags', 'Pledges', 'Notes'],
    steps: [
      {
        title: 'Log in to Kindful',
        description: 'Go to your Kindful URL (e.g., https://yourorg.kindful.com) and log in. Note your subdomain — the "yourorg" part of your URL.',
        tip: 'Your subdomain forms the base of all API calls. Write it down — you\'ll need it below.',
        encouragement: 'Quick setup — about 10 minutes.',
        screenshotPath: '/images/relatio/kindful-step1.jpg',
        screenshotCaption: 'Navigate to Settings → Integrations → Custom App.',
      },
      {
        title: 'Create a Custom App',
        description: 'Navigate to Settings → Integrations → Custom App. Click "Create New Application." Name it "CROS Companion." Your Application Token will be generated and displayed.',
        note: 'This is the Customer API path (your org only). If you need multi-org access, contact partners@kindful.com for Partner API.',
        screenshotPath: '/images/relatio/kindful-step1.jpg',
        screenshotCaption: 'Create a new Custom App to get your Application Token.',
      },
      {
        title: 'Copy Token and Subdomain',
        description: 'Copy the Application Token. Also confirm your subdomain from your Kindful URL. Paste both below.',
        encouragement: 'One more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your contacts, transactions, and campaigns from Kindful. Nothing is modified — Kindful stays the source of record.',
        encouragement: 'Your nonprofit data is now gently connected to CROS.',
      },
    ],
  },
  zoho: {
    difficulty: 'guided',
    estimatedTime: '15–20 minutes',
    availableData: ['Contacts', 'Accounts / Organizations', 'Deals', 'Activities', 'Notes', 'Custom Modules', 'Campaigns'],
    steps: [
      {
        title: 'Register Your Application in the Zoho API Console',
        description: 'Go to api-console.zoho.com and log in with your Zoho account. Click "Add Client" and choose "Self Client" (simplest for server integrations). You\'ll see your Client ID and Client Secret.',
        copyableText: 'https://api-console.zoho.com',
        tip: 'Choose "Self Client" unless you\'re building a multi-user app. It\'s the simplest path.',
        encouragement: 'A few more steps — you\'re doing great.',
        screenshotPath: '/images/relatio/zoho-step1.jpg',
        screenshotCaption: 'Register your application at api-console.zoho.com.',
      },
      {
        title: 'Generate an Authorization Code',
        description: 'In the API Console, click on your Self Client. Enter scope: ZohoCRM.modules.ALL. Set duration to 10 minutes. Click "Create." Copy the generated authorization code.',
        note: 'The authorization code expires in 10 minutes and can only be used once. Complete the next step quickly.',
        screenshotPath: '/images/relatio/zoho-step2.jpg',
        screenshotCaption: 'Generate a one-time authorization code with the correct scope.',
      },
      {
        title: 'Copy Your Client ID and Client Secret',
        description: 'From the API Console, copy your Client ID and Client Secret. Also note your Zoho region — use accounts.zoho.com (US), accounts.zoho.eu (EU), or accounts.zoho.in (India).',
        tip: 'Zoho uses "Zoho-oauthtoken" not "Bearer" as the auth prefix — CROS handles this automatically.',
        note: 'If your org is in the EU or India, the wrong region URL will cause auth errors.',
        encouragement: 'Almost there.',
      },
      {
        title: 'Enter Your Credentials',
        description: 'Paste the Client ID, Client Secret, and the authorization code below. CROS will exchange the code for long-lived tokens automatically.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your contacts, accounts, deals, and activities from Zoho CRM. Nothing is modified — Zoho CRM stays the source of record.',
        tip: 'Access tokens expire every hour — CROS automatically refreshes them using your refresh token.',
        encouragement: 'Your CRM data is now gently connected to CROS.',
      },
    ],
  },
  pushpay: {
    difficulty: 'guided',
    estimatedTime: '10–15 minutes',
    availableData: ['People / Individuals', 'Families / Households', 'Groups', 'Events', 'Attendance', 'Giving'],
    steps: [
      {
        title: 'Sign in to CCB as an Administrator',
        description: 'Log in to your Church Community Builder account at yourchurch.ccbchurch.com. You must be an administrator to access API settings.',
        tip: 'Your API URL follows this pattern: https://yourchurch.ccbchurch.com/api.php',
        encouragement: 'This takes about 10 minutes.',
      },
      {
        title: 'Create an API User',
        description: 'Navigate to the API Admin section in your CCB settings. Click "Add a new API User." Enter a name like "cros-bridge," a unique username, and a strong password (at least 8 characters, 1 uppercase, 1 number).',
        note: 'The API user name must be unique within your system.',
      },
      {
        title: 'Assign Service Permissions',
        description: 'Click on the API user\'s name, then go to the Services tab. Enable all 13 services needed for full CROS integration. Click Save.',
        encouragement: 'Almost there — one more detail.',
      },
      {
        title: 'Note Your API URL and Credentials',
        description: 'Your API URL is shown in the API Admin section. Copy the URL along with the API username and password you created. All requests use HTTP Basic Authentication.',
        copyableText: 'https://yourchurch.ccbchurch.com/api.php',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your people, groups, events, and attendance from CCB. Nothing is modified — your CCB stays the source of record.',
        encouragement: 'Your church community data is now gently connected to CROS.',
      },
    ],
  },
  virtuous: {
    difficulty: 'easy',
    estimatedTime: '5–10 minutes',
    availableData: ['Contacts', 'Contact Individuals', 'Gifts / Donations', 'Gift Designations', 'Projects', 'Tasks', 'Notes', 'Tags', 'Communication History'],
    steps: [
      {
        title: 'Sign in to Virtuous CRM',
        description: 'Go to app.virtuoussoftware.com and sign in with your admin account. You need admin access (Settings menu visible) to create API keys.',
        encouragement: 'This is the simplest integration CROS Bridge supports — about 5–10 minutes total.',
      },
      {
        title: 'Generate an API Key',
        description: 'Click the gear icon to open Settings. Navigate to Integrations → API Keys. Click "+ Create New API Key." Name it "CROS Bridge Integration" and click Generate Key.',
        note: 'IMMEDIATELY copy the API Key value — it will only be shown once! If you navigate away, you\'ll need to generate a new one.',
        screenshotPath: '/images/relatio/virtuous-step1-api-keys.png',
        screenshotCaption: 'Figure 1: Generate a new API key in Virtuous Settings → Integrations → API Keys.',
      },
      {
        title: 'Set API Key Permissions',
        description: 'From the API Keys page, click on your new "CROS Bridge Integration" key. Click Permissions. Enable: Contacts (read), Gifts (read), Contact Methods (read), Tags (read). Click Save Permissions.',
        tip: 'Enable only the permissions CROS Bridge needs. You can always add more later without regenerating the API key.',
        screenshotPath: '/images/relatio/virtuous-step2-permissions.png',
        screenshotCaption: 'Figure 2: Set API key permissions — enable Contacts, Gifts, Contact Methods, and Tags.',
      },
      {
        title: 'Configure Webhooks (Optional)',
        description: 'For real-time sync, navigate to Settings → Integrations → Webhooks. Click "+ Add Webhook." Enter the webhook URL provided by CROS Bridge. Select events: Contact Created, Contact Updated, Gift Created, Tag Added. Click Save Webhook.',
        tip: 'Webhooks are optional but recommended. Without them, CROS Bridge polls every 15 minutes. With webhooks, changes sync in near real-time.',
        screenshotPath: '/images/relatio/virtuous-step3-webhooks.png',
        screenshotCaption: 'Figure 3: Configure webhook events for real-time sync.',
      },
      {
        title: 'Connect in CROS Bridge',
        description: 'Paste the API key below. Optionally enter your organization slug (your Virtuous subdomain). Click "Test Connection" — if successful, you\'ll see a green checkmark. Then click "Save & Connect" to begin the initial sync.',
        encouragement: 'The initial sync is typically fast — most organizations complete it in under 5 minutes, even with 10,000+ contacts.',
        screenshotPath: '/images/relatio/virtuous-step4-connect.png',
        screenshotCaption: 'Figure 4: Enter your API key and connect CROS Bridge to Virtuous.',
      },
    ],
  },
  oracle: {
    difficulty: 'guided',
    estimatedTime: '15–20 minutes',
    availableData: ['Contacts', 'Accounts', 'Opportunities', 'Activities', 'Campaigns', 'Households', 'Notes', 'Leads'],
    steps: [
      {
        title: 'Access Oracle Cloud Console',
        description: 'Go to cloud.oracle.com and sign in with your organization\'s admin account. You\'ll need admin access to Oracle Identity Cloud Service (IDCS) and your Oracle CRM instance URL (e.g., https://yourorg.fa.us2.oraclecloud.com).',
        encouragement: 'This takes about 15–20 minutes. You\'ll need your IT administrator if you don\'t have admin access.',
      },
      {
        title: 'Register a Confidential Application',
        description: 'Navigate to Identity & Security → Domains → Default Domain. Click Applications → "+ Add Application" and select Confidential Application. Name it "CROS Bridge Integration." Click Next through configuration screens. Copy the Client ID from the overview page.',
        screenshotPath: '/images/relatio/oracle-step1-app.png',
        screenshotCaption: 'Figure 1: Register a Confidential Application in Oracle Identity Cloud Service.',
      },
      {
        title: 'Generate a Client Secret',
        description: 'From your registered application\'s page, click the Configuration tab. Under Client Credentials, click "Generate Secret." IMMEDIATELY copy the Client Secret value — it will only be shown once!',
        note: 'You now have 2 credentials: Client ID + Client Secret. Store them in your organization\'s password manager. Never share via email or Slack.',
        screenshotPath: '/images/relatio/oracle-step2-secret.png',
        screenshotCaption: 'Figure 2: Generate and copy the Client Secret from the application configuration.',
      },
      {
        title: 'Set API Scopes',
        description: 'From your registered application, click the Resources tab. Click "+ Add Scope." Search for "CRM REST API" and select it. Check the box for Full Access. Click Add. Verify the scope appears with a green checkmark.',
        tip: 'If you don\'t see "CRM REST API" in the scope list, your Oracle Cloud instance may need the CRM module enabled. Contact your Oracle administrator.',
        screenshotPath: '/images/relatio/oracle-step3-scopes.png',
        screenshotCaption: 'Figure 3: Add CRM REST API → Full Access scope to the application.',
      },
      {
        title: 'Connect in CROS Bridge',
        description: 'Enter your Oracle CRM Instance URL (e.g., https://yourorg.fa.us2.oraclecloud.com), the Client ID from Step 2, and the Client Secret from Step 3. Click "Test Connection" — if successful, you\'ll see a green checkmark. Then click "Save & Connect."',
        encouragement: 'The initial sync may take several minutes depending on database size. 10,000+ contacts may take 10–15 minutes for the first full sync.',
        screenshotPath: '/images/relatio/oracle-step4-connect.png',
        screenshotCaption: 'Figure 4: Enter your Oracle credentials and connect CROS Bridge.',
      },
    ],
  },
  shelbynext: {
    difficulty: 'guided',
    estimatedTime: '30–60 minutes',
    availableData: ['Members / People', 'Families / Households', 'Groups', 'Interactions', 'Contributions', 'Attendance'],
    steps: [
      {
        title: 'Understand the Migration Process',
        description: 'ShelbyNext does not have a public API. Your data will be exported as CSV files and imported into CROS using our guided mapping tool. This is a one-time migration — not a live sync.',
        note: 'ShelbyNext confirmed as of February 2026: no public API is available.',
        encouragement: 'We\'ll walk you through every step.',
      },
      {
        title: 'Export People / Members',
        description: 'Log in to ShelbyNext as an administrator. Navigate to People → All People. Click the Export icon (download arrow) in the toolbar. Select fields: Name, Email, Phone, Address, Family ID, Membership Status, Groups. Choose CSV format and save.',
        tip: 'Use the "Active Members Only" filter to start with your most relevant data.',
      },
      {
        title: 'Export Families / Households',
        description: 'Navigate to People → Families. Click Export. Include: Family Name, Family ID, Address, Head of Household, Members. Save as CSV.',
      },
      {
        title: 'Export Groups & Contributions (Optional)',
        description: 'For Groups: go to Groups → All Groups, export with Group Name, Type, Leader, Members. For Contributions: go to Giving → Contributions, set a date range (last 3 years minimum), and export.',
        tip: 'Contribution data helps CROS recognize engagement patterns — recommended if available.',
      },
      {
        title: 'Upload Your CSV Files',
        description: 'Return to CROS and use the CSV Import tool. Upload each file — CROS will auto-detect ShelbyNext column names and suggest field mappings.',
        encouragement: 'Your data will be mapped into CROS relationships automatically.',
      },
      {
        title: 'Review and Confirm',
        description: 'Review the mapping preview. Adjust any fields that weren\'t auto-detected. Click Import to bring your relationships into CROS.',
        encouragement: 'Your story begins now. Every relationship carries forward.',
      },
    ],
  },
  servantkeeper: {
    difficulty: 'guided',
    estimatedTime: '30–60 minutes',
    availableData: ['Members / People', 'Families / Households', 'Attendance', 'Contributions', 'Groups / Ministries'],
    steps: [
      {
        title: 'Understand the Migration Process',
        description: 'Servant Keeper does not have a public API. Your data will be exported using built-in query tools and imported into CROS as CSV files. This is a one-time migration.',
        note: 'Servant Keeper is a desktop application — you\'ll need access to the installed software.',
        encouragement: 'We\'ll guide you through the export process.',
      },
      {
        title: 'Export Members via Query',
        description: 'Open Servant Keeper on your computer. Go to Queries → People Queries → All People. Run the query, then click File → Export to CSV. Include: Name, Address, Phone, Email, Family ID, Member Status.',
        tip: 'Choose "All People" rather than filtered views to ensure a complete export.',
      },
      {
        title: 'Export Families',
        description: 'Go to Queries → Family Queries → All Families. Run and export to CSV. Include: Family Name, Family ID, Address, Members.',
      },
      {
        title: 'Export Contributions & Attendance (Optional)',
        description: 'For Contributions: go to Queries → Financial Queries → Contribution Detail. Set a date range and export. For Attendance: go to Queries → Event Queries → Attendance, run and export.',
        tip: 'Even partial contribution data helps CROS understand engagement patterns.',
      },
      {
        title: 'Upload Your CSV Files',
        description: 'Return to CROS and use the CSV Import tool. Upload each file — CROS will attempt to auto-map Servant Keeper fields.',
        encouragement: 'Almost there — your community data is ready to become a living narrative.',
      },
      {
        title: 'Review and Confirm',
        description: 'Review the field mappings. Servant Keeper exports may need some manual adjustments. Click Import when ready.',
        encouragement: 'Your faithful record-keeping now becomes a story of relationships.',
      },
    ],
  },
  wildapricot: {
    difficulty: 'easy',
    estimatedTime: '10 minutes',
    availableData: ['Contacts / Members', 'Events & Registrations', 'Membership Levels', 'Donations / Payments', 'Invoices', 'Tags'],
    steps: [
      {
        title: 'Sign in to Wild Apricot',
        description: 'Open your browser and go to your Wild Apricot admin URL. Sign in with an account that has administrator privileges. You\'ll land on the Dashboard showing contacts, events, and donations.',
        tip: 'Wild Apricot is free for up to 50 contacts — you can test the integration before committing.',
        encouragement: 'This will take about 10 minutes.',
        screenshotPath: '/images/relatio/wildapricot-step1.png',
        screenshotCaption: 'The Wild Apricot Dashboard — navigate using the left sidebar. Click "Settings" to configure API access.',
      },
      {
        title: 'Navigate to Settings → Security → Authorized Applications',
        description: 'In the left sidebar, click "Settings." Then find "Security" and click "Authorized applications." This is where you\'ll create the connection that lets CROS read your data.',
        screenshotPath: '/images/relatio/wildapricot-step6.png',
        screenshotCaption: 'Settings → Security → Authorized Applications — create a server app for CROS.',
      },
      {
        title: 'Create a Server Application',
        description: 'Click "Authorize application." Enter the name "CROS Bridge Integration." Set the type to "Server application (API key)." Set the scope to "Full access." Click Save.',
        note: 'The system will generate a Client ID and API Key. Copy both values immediately — the API Key may only be shown once.',
        screenshotPath: '/images/relatio/wildapricot-step6.png',
        screenshotCaption: 'After saving, you\'ll receive your Client ID and API Key. Copy both!',
      },
      {
        title: 'Find Your Account ID',
        description: 'Your Account ID is visible in the Wild Apricot URL when logged in — it\'s the number in the address bar (e.g., admin.wildapricot.org/admin/12345). You can also find it under Settings → Account Details.',
        tip: 'The Account ID is needed for API calls. It\'s a short number, not the same as Client ID.',
        encouragement: 'Almost there — one more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will use OAuth 2.0 to read your contacts, events, memberships, and donations from Wild Apricot. Nothing is modified — Wild Apricot stays the source of record.',
        tip: 'Wild Apricot access tokens expire every 30 minutes — CROS handles token refresh automatically.',
        encouragement: 'Your membership community is now gently connected to CROS.',
      },
    ],
  },
  fluentcrm: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['Contacts / Subscribers', 'Lists', 'Tags', 'Companies', 'Custom Fields', 'Campaigns (read-only)', 'Automation Funnels (read-only)'],
    steps: [
      {
        title: 'Log in to your WordPress admin dashboard',
        description: 'Open your browser and go to yourchurch.org/wp-admin. Sign in with your WordPress username and password. You need to be an administrator or have been added as a FluentCRM Manager.',
        tip: 'Your site URL is the "yourchurch.org" part of your WordPress address. Write it down — you\'ll need it along with the API key.',
        encouragement: 'This will be quick.',
      },
      {
        title: 'Navigate to FluentCRM → Settings → REST API',
        description: 'In the WordPress sidebar, click FluentCRM (it may have a teal/purple icon). Then click Settings from the FluentCRM sub-menu. On the Settings page, click the REST API tab.',
        screenshotPath: '/images/relatio/fluentcrm-step2.png',
        screenshotCaption: 'Navigate: FluentCRM → Settings → REST API tab to manage API keys.',
      },
      {
        title: 'Click "Add New Key"',
        description: 'On the REST API tab, click the "+ Add New Key" button. A form will appear. Set the Description to "CROS Bridge Sync," select your admin user as the Manager, and set Permissions to "Read." Click "Generate Key."',
        screenshotPath: '/images/relatio/fluentcrm-step3.png',
        screenshotCaption: 'Generate API key — name it, select Read permissions, click Generate. Copy both values immediately.',
      },
      {
        title: 'Copy your API Username and API Password',
        description: 'After generating, you\'ll be shown two values: an API Username (starts with ck_) and an API Password (starts with cs_). Copy both immediately.',
        note: 'Copy both values now! The API Password will NOT be shown again. If you lose it, you\'ll need to revoke the key and create a new one.',
        encouragement: 'One more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your subscribers, lists, tags, and companies from FluentCRM. Nothing is modified — FluentCRM stays the source of record.',
        screenshotPath: '/images/relatio/fluentcrm-step5.png',
        screenshotCaption: 'Enter your FluentCRM credentials into CROS Bridge. Click Test Connection to verify, then Save.',
        encouragement: 'Your contact data is now gently connected to CROS.',
      },
    ],
  },
  jetpackcrm: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['Contacts / Customers', 'Transactions', 'Invoices', 'Events / Tasks', 'Quotes (in development)'],
    steps: [
      {
        title: 'Log in to your WordPress admin dashboard',
        description: 'Open your browser and go to yourchurch.org/wp-admin. Sign in with your WordPress username and password. You need administrator access.',
        encouragement: 'This will be quick.',
      },
      {
        title: 'Enable the API Module',
        description: 'Navigate to Jetpack CRM → Settings (or Core Modules). Find the API module in the list and toggle it ON. This step is required — the API is disabled by default.',
        note: 'If you skip this step, there will be no API tab in CRM Settings and you won\'t be able to generate keys.',
        screenshotPath: '/images/relatio/jetpackcrm-step2.png',
        screenshotCaption: 'Jetpack CRM → Settings → Modules — the API module must be activated before you can generate keys.',
      },
      {
        title: 'Navigate to CRM Settings → API',
        description: 'Once the API module is active, go to Jetpack CRM → CRM Settings. Click the API tab. You\'ll see the API status (should say "Active") and a list of any existing keys.',
      },
      {
        title: 'Click "Generate API Key"',
        description: 'Click the "Generate API Key" button. Jetpack CRM will create two values: an API Key (starts with jck_) and an API Secret (starts with jcs_). Copy both immediately.',
        note: 'Copy both values immediately! Store them in a safe place.',
        screenshotPath: '/images/relatio/jetpackcrm-step4.png',
        screenshotCaption: 'CRM Settings → API tab — click "Generate API Key." Copy both the Key and Secret.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your contacts, transactions, invoices, and events from Jetpack CRM. Nothing is modified — Jetpack CRM stays the source of record.',
        tip: 'Jetpack CRM requires pretty permalinks. If the API returns 404 errors, go to WordPress Settings → Permalinks and select any option other than "Plain."',
        screenshotPath: '/images/relatio/jetpackcrm-step5.png',
        screenshotCaption: 'Enter your Jetpack CRM credentials into CROS Bridge. Click Test Connection to verify, then Save.',
        encouragement: 'Your CRM data is now gently connected to CROS.',
      },
    ],
  },
  wperp: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['CRM Contacts', 'Companies', 'Contact Groups', 'Activity Logs', 'Lifecycle Stages'],
    steps: [
      {
        title: 'Log in to your WordPress admin dashboard',
        description: 'Open your browser and go to yourchurch.org/wp-admin. Sign in with an administrator account. Note your username — you\'ll need it for the API connection.',
        encouragement: 'This will be quick.',
      },
      {
        title: 'Navigate to Users → Profile',
        description: 'In the WordPress sidebar, click Users, then click Profile (or Your Profile). Scroll down to the Application Passwords section near the bottom of the page.',
      },
      {
        title: 'Generate an Application Password',
        description: 'In the Application Passwords section, enter a name like "CROS Bridge API" and click "Add New Application Password." WordPress generates a 24-character password with spaces.',
        note: 'Copy this password immediately! It will NOT be shown again. If you lose it, revoke it and create a new one.',
        screenshotPath: '/images/relatio/wperp-step3.png',
        screenshotCaption: 'Application Passwords section — enter a name and click "Add New." Copy the generated password immediately.',
      },
      {
        title: 'Note your WordPress username',
        description: 'Scroll to the top of your Profile page. Your username is shown in the first field (it\'s grayed out and can\'t be changed). Write it down — you\'ll need both the username and the Application Password.',
        screenshotPath: '/images/relatio/wperp-step4.png',
        screenshotCaption: 'Your WordPress username (top of Profile) + Application Password = your API credentials.',
        encouragement: 'One more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your CRM contacts, companies, groups, and activity logs from WP ERP. Nothing is modified — WP ERP stays the source of record.',
        tip: 'WP ERP uses the same Application Password that other WordPress REST API plugins use. If you already have one, you can reuse it.',
        screenshotPath: '/images/relatio/wperp-step5.png',
        screenshotCaption: 'Enter your WP ERP credentials into CROS Bridge. Click Test Connection to verify, then Save.',
        encouragement: 'Your community data is now gently connected to CROS.',
      },
    ],
  },
  google_contacts: {
    difficulty: 'guided',
    estimatedTime: '10 minutes',
    availableData: ['Contacts', 'Contact Groups', 'Labels', 'Email Addresses', 'Phone Numbers'],
    steps: [
      {
        title: 'Sign in to Google Cloud Console',
        description: 'Go to console.cloud.google.com and sign in with the Google account that owns the contacts you want to connect. If you don\'t have a project yet, create one — it\'s free.',
        copyableText: 'https://console.cloud.google.com',
        tip: 'Any Google account works — personal or Google Workspace. You must own the contacts.',
        encouragement: 'This takes about 10 minutes.',
      },
      {
        title: 'Enable the People API',
        description: 'In the Cloud Console, go to APIs & Services → Library. Search for "People API" and click Enable. This is what allows CROS to read your contacts.',
        tip: 'The People API is free for personal use. Google may ask you to set up billing, but you won\'t be charged.',
      },
      {
        title: 'Create OAuth Credentials',
        description: 'Go to APIs & Services → Credentials. Click "Create Credentials" → "OAuth Client ID." Select "Web application." Add the CROS callback URL as an authorized redirect URI.',
        note: 'If prompted to configure the consent screen first, choose "External" and fill in the required fields. You can leave it in testing mode.',
        encouragement: 'Almost there.',
      },
      {
        title: 'Copy Your Client ID and Secret',
        description: 'After creating the OAuth client, Google shows your Client ID and Client Secret. Copy both and paste them below.',
        note: 'Keep your Client Secret private — treat it like a password.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your Google Contacts and groups daily. Nothing is modified in Google — your contacts stay the source of record.',
        encouragement: 'Your contacts are now gently connected to CROS.',
      },
    ],
  },
  outlook_contacts: {
    difficulty: 'guided',
    estimatedTime: '10–15 minutes',
    availableData: ['Contacts', 'Contact Folders', 'Categories', 'Email Addresses', 'Phone Numbers'],
    steps: [
      {
        title: 'Sign in to Azure Portal',
        description: 'Go to portal.azure.com and sign in with your Microsoft 365 or Outlook account that has admin access. Navigate to Azure Active Directory → App registrations.',
        copyableText: 'https://portal.azure.com',
        tip: 'You need a Microsoft work/school account or a personal Microsoft account with Azure access.',
        encouragement: 'This takes about 10–15 minutes.',
      },
      {
        title: 'Register a New Application',
        description: 'Click "New registration." Name it "CROS Companion." Under "Supported account types," select the option that matches your organization. Add the CROS callback URL as a Redirect URI (Web type).',
      },
      {
        title: 'Add API Permissions',
        description: 'Go to API Permissions → Add a permission → Microsoft Graph → Delegated. Add: Contacts.Read (for read-only) or Contacts.ReadWrite (for two-way sync). Click "Grant admin consent."',
        note: 'For two-way sync, you need Contacts.ReadWrite permission. Read-only uses Contacts.Read only.',
        tip: 'Admin consent is required for organizational accounts. Personal accounts auto-consent.',
      },
      {
        title: 'Create a Client Secret',
        description: 'Go to Certificates & Secrets → New client secret. Give it a description and expiration period. Copy the Value immediately — it won\'t be shown again.',
        note: 'Copy the secret Value (not the Secret ID). It disappears after you leave the page.',
        encouragement: 'One more step.',
      },
      {
        title: 'Copy Your Application (Client) ID',
        description: 'Go back to the Overview page. Copy the Application (client) ID and the Directory (tenant) ID. Paste both below along with your Client Secret.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your Outlook contacts and folders via Microsoft Graph. Nothing is modified unless two-way sync is enabled by your Shepherd.',
        encouragement: 'Your Outlook contacts are now gently connected to CROS.',
      },
    ],
  },
  apple_contacts: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['Contacts', 'Contact Groups', 'Email Addresses', 'Phone Numbers'],
    steps: [
      {
        title: 'Open iCloud Contacts',
        description: 'Go to icloud.com/contacts and sign in with your Apple ID. You\'ll see all your contacts listed.',
        copyableText: 'https://www.icloud.com/contacts',
        encouragement: 'This will be quick — just an export and upload.',
      },
      {
        title: 'Select and Export Contacts',
        description: 'Select the contacts you want to export (or press Cmd+A / Ctrl+A to select all). Click the gear icon at the bottom-left and choose "Export vCard." A .vcf file will download.',
        tip: 'You can also export a specific group by selecting the group first, then exporting.',
        screenshotCaption: 'Click the gear icon → Export vCard to download your contacts.',
      },
      {
        title: 'Upload to CROS',
        description: 'In CROS, go to the Import section and upload the .vcf file. CROS will parse the vCard format and map each contact automatically.',
        note: 'Apple does not offer a public API for Contacts. Re-export and re-upload whenever you want to refresh.',
        encouragement: 'That\'s it! Your Apple contacts are imported.',
      },
      {
        title: 'Confirm Import',
        description: 'CROS has imported your Apple contacts. Since there\'s no live API, you can re-export from iCloud whenever you want a fresh import.',
        encouragement: 'Your contacts are now part of your CROS story.',
      },
    ],
  },
  monicacrm: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['Contacts', 'Activities', 'Notes', 'Reminders', 'Tasks', 'Debts', 'Relationships'],
    steps: [
      {
        title: 'Sign in to Monica',
        description: 'Go to your Monica instance (app.monicahq.com for hosted, or your self-hosted URL) and log in.',
        copyableText: 'https://app.monicahq.com',
        tip: 'Self-hosted users: your URL will be whatever you configured (e.g., monica.yourdomain.com).',
        encouragement: 'This will be quick.',
      },
      {
        title: 'Navigate to API Settings',
        description: 'Click your profile icon in the top-right → Settings → API. You\'ll see a section for Personal Access Tokens.',
      },
      {
        title: 'Create a Personal Access Token',
        description: 'Click "Create New Token." Name it "CROS Companion." Monica will generate a long token string. Copy it immediately — it won\'t be shown again.',
        note: 'This token has full read access to your Monica data. Keep it private.',
        encouragement: 'One more step.',
      },
      {
        title: 'Enter Your Token and URL',
        description: 'Paste the Personal Access Token below. If you\'re self-hosted, also enter your Monica instance URL.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your contacts, activities, notes, and reminders from Monica. Nothing is modified — Monica stays the source of record.',
        encouragement: 'Your personal relationships are now gently connected to CROS.',
      },
    ],
  },
  contactsplus: {
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    availableData: ['Contacts', 'Tags', 'Notes', 'Social Profiles', 'Companies'],
    steps: [
      {
        title: 'Sign in to Contacts+',
        description: 'Go to contactsplus.com and sign in with your Contacts+ account.',
        copyableText: 'https://www.contactsplus.com',
        encouragement: 'This will be quick.',
      },
      {
        title: 'Navigate to Integrations or API Settings',
        description: 'In your Contacts+ dashboard, look for Settings → Integrations or API Access. Generate an API key or Personal Access Token.',
        tip: 'If you don\'t see API access, you may need a paid plan. Contact Contacts+ support for help.',
      },
      {
        title: 'Copy Your API Key',
        description: 'Copy the API key from the settings page. This key allows CROS to read your unified address book.',
        note: 'Keep your API key private — it grants read access to all your contacts.',
        encouragement: 'One more step.',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will read your contacts, tags, notes, and social profiles from Contacts+. Nothing is modified — Contacts+ stays the source of record.',
        encouragement: 'Your contacts are now gently connected to CROS.',
      },
    ],
  },
  civicrm: {
    difficulty: 'guided',
    estimatedTime: '30–45 minutes',
    availableData: ['Contacts (Individuals & Organizations)', 'Activities', 'Events & Participants', 'Cases / Programs', 'Contributions (read-only)', 'Groups & Tags', 'Volunteers (CiviVolunteer)'],
    steps: [
      {
        title: 'Identify Your Hosting Platform',
        description: 'CiviCRM runs on WordPress, Drupal, Joomla, or Backdrop. The steps below differ slightly by platform — knowing yours helps us guide you correctly.',
        tip: 'Not sure? Check your website login URL: /wp-admin = WordPress, /user/login = Drupal, /administrator = Joomla, /admin = Backdrop.',
        encouragement: 'This will take about 30 minutes — you\'re in good hands.',
      },
      {
        title: 'Confirm Your CiviCRM Version (5.36+)',
        description: 'Log into CiviCRM as an administrator. Click "Support" → "About CiviCRM." Your version must be 5.36 or higher for APIv4 support.',
        tip: 'If your version is older than 5.36, contact your hosting provider to request an update before continuing.',
      },
      {
        title: 'Create a Dedicated CROS Integration User',
        description: 'In CiviCRM, go to Contacts → New Individual. Name it "CROS Integration" with an email like cros-integration@yourorg.example. Then create a matching CMS user account.',
        tip: 'Think of this like a service door key — separate from your personal login for security and easy revocation.',
        note: 'WordPress: Users → Add New. Drupal: Admin → People → Add User. Joomla: Users → Manage → New. Backdrop: Admin → People → Add User. The CMS user must be linked to the CiviCRM contact for the API key to work.',
      },
      {
        title: 'Assign API Permissions',
        description: 'Give the CROS Integration user these CiviCRM permissions: access CiviCRM, view all contacts, edit all contacts, access all custom data, view all activities, edit all activities, access CiviEvent, access CiviContribute (read-only), and authenticate with api key.',
        note: 'WordPress: use a permissions plugin or CiviCRM ACL settings. Drupal: People → Permissions. Joomla: Users → Groups → Permissions. Backdrop: Admin → Config → People → Permissions.',
      },
      {
        title: 'Generate Your API Key',
        description: 'Navigate to the CROS Integration contact record in CiviCRM. Open the contact for editing. Scroll to the "API Key" field and generate a random key. Copy this key immediately and store it securely.',
        note: 'The API key is like a password — anyone with this key can access your CiviCRM data. Keep it private.',
        encouragement: 'Almost there — one more step.',
      },
      {
        title: 'Enter Your API Key and Site URL',
        description: 'Paste the API key below. Also enter your CiviCRM site URL — this is the base URL of your CiviCRM installation (e.g., https://your-org.example.org).',
        copyableText: 'https://your-org.example.org',
      },
      {
        title: 'Confirm Companion Mode',
        description: 'CROS will sync your contacts, activities, events, and cases via CiviCRM APIv4. Contribution data is read-only — CROS never modifies donation or payment records. CiviCRM stays the source of truth for all transactional data.',
        encouragement: 'Your community relationships are now gently connected to CROS.',
      },
    ],
  },
};

export function getDifficultyLabel(difficulty: ConnectorGuide['difficulty']): string {
  switch (difficulty) {
    case 'easy': return 'Easy';
    case 'guided': return 'Guided';
    case 'requires_support': return 'Requires Support';
  }
}

export function getDifficultyColor(difficulty: ConnectorGuide['difficulty']): string {
  switch (difficulty) {
    case 'easy': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30';
    case 'guided': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30';
    case 'requires_support': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30';
  }
}
