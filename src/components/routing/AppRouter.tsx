import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}

import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { TenantRouteGuard } from '@/components/routing/TenantRouteGuard';
import { LegacyPathRedirect } from '@/components/routing/LegacyPathRedirect';
import { Skeleton } from '@/components/ui/skeleton';
import { MainLayout } from '@/components/layout/MainLayout';

// Marketing layout + pages (public)
import PublicLayout from '@/components/marketing/PublicLayout';
import Landing from '@/pages/marketing/Landing';
import Manifesto from '@/pages/marketing/Manifesto';
import Pricing from '@/pages/marketing/Pricing';
import ArchetypesPage from '@/pages/marketing/Archetypes';
import Security from '@/pages/marketing/Security';
import Contact from '@/pages/marketing/Contact';
import NRI from '@/pages/marketing/NRI';
import CROSFeature from '@/pages/marketing/CROSFeature';
import ProfundaPage from '@/pages/marketing/Profunda';
import UniversalCaseStudy from '@/pages/marketing/UniversalCaseStudy';
import ImpulsusFeature from '@/pages/marketing/ImpulsusFeature';
import TestimoniumFeature from '@/pages/marketing/TestimoniumFeature';
import CommunioFeature from '@/pages/marketing/CommunioFeature';
import SignumFeature from '@/pages/marketing/SignumFeature';
import VoluntariumFeature from '@/pages/marketing/VoluntariumFeature';
import ProvisioFeature from '@/pages/marketing/ProvisioFeature';
import RelatioCampaigns from '@/pages/marketing/RelatioCampaigns';
import Proof from '@/pages/marketing/Proof';
import Compare from '@/pages/marketing/Compare';
import Roles from '@/pages/marketing/Roles';
import RoleShepherd from '@/pages/marketing/RoleShepherd';
import RoleCompanion from '@/pages/marketing/RoleCompanion';
import RoleVisitor from '@/pages/marketing/RoleVisitor';
import ChurchWeek from '@/pages/marketing/archetypes/ChurchWeek';
import NonprofitWeek from '@/pages/marketing/archetypes/NonprofitWeek';
import SocialEnterpriseWeek from '@/pages/marketing/archetypes/SocialEnterpriseWeek';
import CommunityNetworkWeek from '@/pages/marketing/archetypes/CommunityNetworkWeek';
import MinistryOutreachWeek from '@/pages/marketing/archetypes/MinistryOutreachWeek';
import CaregiverSoloWeek from '@/pages/marketing/archetypes/CaregiverSoloWeek';
import CaregiverAgencyWeek from '@/pages/marketing/archetypes/CaregiverAgencyWeek';
import MissionaryOrgWeek from '@/pages/marketing/archetypes/MissionaryOrgWeek';
import InsightsIndex from '@/pages/marketing/InsightsIndex';
import InsightPage from '@/pages/marketing/InsightPage';
import ArchetypeDeepPage from '@/pages/marketing/ArchetypeDeepPage';
import StoryPage from '@/pages/marketing/StoryPage';
import CompareSlugRouter from '@/pages/marketing/CompareSlugRouter';
import RoleSteward from '@/pages/marketing/RoleSteward';
import RoleGuidePage from '@/pages/marketing/RoleGuidePage';
import RoleStoryPage from '@/pages/marketing/RoleStoryPage';
import MetroPublicPage from '@/pages/marketing/MetroPublicPage';
import MetroArchetypePage from '@/pages/marketing/MetroArchetypePage';
import RolePathwayPage from '@/pages/marketing/RolePathwayPage';
import CallingPage from '@/pages/marketing/CallingPage';
import LibraryIndexPage from '@/pages/marketing/LibraryIndexPage';
import LibraryConceptPage from '@/pages/marketing/LibraryConceptPage';
import CommunioNetworkPage from '@/pages/marketing/CommunioNetworkPage';
import TenantPublicMirror from '@/pages/marketing/TenantPublicMirror';
import WeekNarrativePage from '@/pages/marketing/WeekNarrativePage';
import MissionAtlas from '@/pages/marketing/MissionAtlas';
import MissionAtlasDetail from '@/pages/marketing/MissionAtlasDetail';
import Lexicon from '@/pages/marketing/Lexicon';
import LexiconTerm from '@/pages/marketing/LexiconTerm';
import FieldJournal from '@/pages/marketing/FieldJournal';
import FieldJournalEntryPage from '@/pages/marketing/FieldJournalEntry';
import RelationalFundraising from '@/pages/marketing/RelationalFundraising';
import DonorHumanity from '@/pages/marketing/DonorHumanity';
import WhyCros from '@/pages/marketing/WhyCros';
import NetworkDirectory from '@/pages/marketing/NetworkDirectory';
import CommunioProfileSetupWizard from '@/components/communio/CommunioProfileSetupWizard';
import PublicPresencePage from '@/pages/marketing/PublicPresencePage';
import Authority from '@/pages/marketing/Authority';
import SeePeople from '@/pages/marketing/SeePeople';
import ImagineThis from '@/pages/marketing/ImagineThis';
import AuthorityCategory from '@/pages/marketing/AuthorityCategory';
import AuthorityArticle from '@/pages/marketing/AuthorityArticle';
import LegalTerms from '@/pages/marketing/legal/LegalTerms';
import LegalPrivacy from '@/pages/marketing/legal/LegalPrivacy';
import LegalDPA from '@/pages/marketing/legal/LegalDPA';
import LegalAcceptableUse from '@/pages/marketing/legal/LegalAcceptableUse';
import LegalAITransparency from '@/pages/marketing/legal/LegalAITransparency';
import PublicEventPage from '@/pages/marketing/PublicEventPage';
import Integrations from '@/pages/marketing/Integrations';
import Features from '@/pages/marketing/Features';
import SitemapRoute from '@/pages/marketing/SitemapRoute';
import Unsubscribe from '@/pages/Unsubscribe';
import EssaysIndex from '@/pages/marketing/EssaysIndex';
import EssayPage from '@/pages/marketing/EssayPage';
import FieldNotesIndex from '@/pages/marketing/FieldNotesIndex';
import ReflectionsIndex from '@/pages/marketing/ReflectionsIndex';
import ForCaregivers from '@/pages/marketing/ForCaregivers';
import TheModel from '@/pages/marketing/TheModel';
import RetreatCenters from '@/pages/marketing/RetreatCenters';
import Diocese from '@/pages/marketing/Diocese';
import CaregiverGuide from '@/pages/help/CaregiverGuide';

// Auth pages
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import JoinPage from '@/pages/JoinPage';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// Phase A perf: heavy pages are route-level code-split.
const Onboarding = lazy(() => import('@/pages/Onboarding'));
import SponsoredSetup from '@/pages/SponsoredSetup';
import NotFound from '@/pages/NotFound';
import DemoGatePage from '@/pages/DemoGatePage';
import { SubscriptionGate } from '@/components/gates/SubscriptionGate';
import { FeatureGate } from '@/components/gates/FeatureGate';
import { CampaignsGate } from '@/components/gates/CampaignsGate';
import { MetroIntelligenceGate } from '@/components/gates/MetroIntelligenceGate';

// Stub pages
import RelatioMarketplace from '@/pages/RelatioMarketplace';
import ImportWizard from '@/pages/relatio/ImportWizard';
import IntegrationGuidePanel from '@/components/relatio/IntegrationGuidePanel';
import ImportJobDetail from '@/pages/relatio/ImportJobDetail';
import Communio from '@/pages/Communio';
import CaregiverNetworkPage from '@/pages/CaregiverNetworkPage';
import OnboardingGuide from '@/pages/OnboardingGuide';
import EnneagramAssessmentPage from '@/pages/EnneagramAssessmentPage';

// App pages
import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import MovementIntelligence from '@/pages/MovementIntelligence';
import Metros from '@/pages/Metros';
import MetroDetail from '@/pages/MetroDetail';
import MetroNews from '@/pages/MetroNews';
import MomentumMap from '@/pages/MomentumMap';
import Radar from '@/pages/Radar';
import Opportunities from '@/pages/Opportunities';
import OpportunityDetail from '@/pages/OpportunityDetail';
import Pipeline from '@/pages/Pipeline';
import Anchors from '@/pages/Anchors';
import Provisions from '@/pages/Provisions';
import ProvisionDetail from '@/pages/ProvisionDetail';
import People from '@/pages/People';
import PersonDetail from '@/pages/PersonDetail';
import FindPeople from '@/pages/FindPeople';
import RelationshipGraph from '@/pages/RelationshipGraph';
import Events from '@/pages/Events';
import EventDetail from '@/pages/EventDetail';
import FindEvents from '@/pages/FindEvents';
import CalendarPage from '@/pages/Calendar';
import CalendarEventPage from '@/pages/CalendarEventPage';
import Activities from '@/pages/Activities';
import Campaigns from '@/pages/outreach/Campaigns';
import CampaignBuilder from '@/pages/outreach/CampaignBuilder';
import Grants from '@/pages/Grants';
import GrantDetail from '@/pages/GrantDetail';
import FindGrants from '@/pages/FindGrants';
import Volunteers from '@/pages/Volunteers';
import VolunteerDetail from '@/pages/VolunteerDetail';
import VolunteerHoursInbox from '@/pages/VolunteerHoursInbox';
import Impulsus from '@/pages/Impulsus';
import FieldNotesPage from '@/components/fieldnotes/FieldNotesPage';
import Visits from '@/pages/Visits';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Testimonium from '@/pages/Testimonium';
import TestimoniumReport from '@/pages/TestimoniumReport';
import TestimoniumExports from '@/pages/TestimoniumExports';
import NarrativeStudio from '@/pages/NarrativeStudio';
import NarrativeThreads from '@/pages/NarrativeThreads';
import IntelligenceFeed from '@/pages/IntelligenceFeed';
import MomentumRankings from '@/pages/MomentumRankings';
import Reports from '@/pages/Reports';
import ImpactExport from '@/pages/ImpactExport';
import ThoseWhoGaveReport from '@/pages/ThoseWhoGaveReport';
import ImportCenter from '@/pages/ImportCenter';
import QuickAdd from '@/pages/QuickAdd';
import Playbooks from '@/pages/Playbooks';
import WorkflowDownloads from '@/pages/WorkflowDownloads';
const TechnicalDocumentation = lazy(() => import('@/pages/TechnicalDocumentation'));
import BuildReportPage from '@/pages/BuildReportPage';
import FinancialActivity from '@/pages/FinancialActivity';
import Settings from '@/pages/Settings';
import VoiceSettings from '@/pages/settings/VoiceSettings';
import ImpactDimensionsPage from '@/pages/settings/ImpactDimensionsPage';
import GoogleFormIntakePage from '@/pages/settings/GoogleFormIntakePage';
import MyActivity from '@/pages/MyActivity';
const Help = lazy(() => import('@/pages/Help'));
import AdoptionHub from '@/pages/help/AdoptionHub';
import Feedback from '@/pages/Feedback';

// Tenant admin pages
import Admin from '@/pages/Admin';
import Activation from '@/pages/admin/Activation';
import TeamManagement from '@/pages/admin/TeamManagement';
import AdminHowTo from '@/pages/admin/AdminHowTo';
import FlocknoteImportWizard from '@/pages/admin/FlocknoteImportWizard';
import DoNotEmail from '@/pages/admin/DoNotEmail';
import EmailProviders from '@/pages/admin/EmailProviders';
import GuidedActivationPrep from '@/pages/admin/GuidedActivationPrep';

// Operator layout (eagerly loaded — thin wrapper)
import { OperatorLayout } from '@/components/layout/OperatorLayout';

// ── Lazy-loaded operator pages (code-split for bundle size) ──
import {
  OperatorOverview, OperatorTenantsPage, OperatorAppsPage, OperatorConsoleAppsPage, OperatorAuditPage,
  OperatorScientiaPage, OperatorScientiaTemplatesPage, GardenerFederationCampaignsPage, OperatorTenantDetailPage,
  OperatorIntakePage, OperatorAutomationPage, OperatorSystemPage,
  OperatorIntegrationsPage, OperatorPlatformPage, OperatorCommunioPage,
  OperatorTestimoniumPage, ScenarioLabPage, TourRunnerPage,
  OperatorHowToPage, OperatorMetrosPage, OperatorPartnersPage,
  OperatorPartnerDetailPage, OperatorSchedulingPage, OperatorOutreachPage,
  OperatorCampaignBuilder, OperatorTimeMachinePage, OperatorOverridesPage,
  OperatorAnnouncementsPage, OperatorEcosystemPage, OperatorActivationPage,
  ErrorDeskPage, OperatorQAPage, OperatorManualsPage, OnboardingFlowGuide,
  OperatorSettingsPage, OperatorSeoPage, OperatorPeoplePage, AIObservatoryPage, OrientationDebugPage,
  // Nexus
  OperatorNexusHome, OperatorPlaybooks, OperatorSupportInbox,
  OperatorExpansionWatch, OperatorKnowledge, OperatorRhythmPage,
  OperatorPresencePage, OperatorSignumPage, OperatorGuidancePage,
  OperatorLumenPage, ArrivalFlow, OperatorRecovery,
  OperatorNarrativePage, OperatorNarrativeStudio, OperatorCivitasStudio,
  OperatorNarrativeEcosystem, OperatorAdoptionPage, OperatorStabilityPage,
  OperatorSimulationPage, OperatorContentStudio, OperatorNotificationsPage,
  OperatorAnalyticsPage, FederationAnalyticsPage, OperatorDiscoveryInsights, OperatorLivingLibrary,
  OperatorGardenPage, MorningExamenPage, EveningExamenPage,
  GardenPulsePage, GardenerStudioPage, GardenerInboxPage,
} from '@/components/routing/LazyOperatorPages';

/**
 * Suspense fallback for lazy-loaded operator pages.
 */
function OperatorFallback() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

/**
 * Root redirect logic:
 * - Not authenticated → marketing landing
 * - Authenticated + no tenant → onboarding
 * - Authenticated + tenant → redirect to /:slug/
 */
function RootRedirect() {
  // Always show the marketing homepage — authenticated users navigate via sidebar
  return <MarketingLanding />;
}

function MarketingLanding() {
  return (
    <PublicLayout>
      <Landing />
    </PublicLayout>
  );
}

/** Wraps operator pages in OperatorLayout + Suspense */
function OperatorShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRoles={['admin']}>
      <OperatorLayout>
        <Suspense fallback={<OperatorFallback />}>
          {children}
        </Suspense>
      </OperatorLayout>
    </ProtectedRoute>
  );
}

export function AppRouter() {
  return (
    <>
      <LegacyPathRedirect />
      <Suspense fallback={<OperatorFallback />}>
      <Routes>
        {/* Root: marketing OR redirect to tenant */}
        <Route path="/" element={<RootRedirect />} />

        {/* External short-link redirect */}
        <Route
          path="/sjbg"
          element={<ExternalRedirect to="https://www.perplexity.ai/computer/a/cros-get-on-the-list-sLl3bE1vTNK3a9dw77O6ZA" />}
        />

        {/* Public marketing routes */}
        <Route element={<PublicLayout />}>
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/manifesto" element={<Manifesto />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/archetypes" element={<ArchetypesPage />} />
          <Route path="/security" element={<Security />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/nri" element={<NRI />} />
          <Route path="/cros" element={<CROSFeature />} />
          <Route path="/profunda" element={<ProfundaPage />} />
          <Route path="/impulsus" element={<ImpulsusFeature />} />
          <Route path="/testimonium-feature" element={<TestimoniumFeature />} />
          <Route path="/communio-feature" element={<CommunioFeature />} />
          <Route path="/signum" element={<SignumFeature />} />
          <Route path="/voluntarium" element={<VoluntariumFeature />} />
          <Route path="/provisio" element={<ProvisioFeature />} />
          <Route path="/relatio-campaigns" element={<RelatioCampaigns />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/features" element={<Features />} />
          <Route path="/the-model" element={<TheModel />} />
          <Route path="/case-study-humanity" element={<UniversalCaseStudy />} />
          <Route path="/proof" element={<Proof />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/see-people" element={<SeePeople />} />
          <Route path="/imagine-this" element={<ImagineThis />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/roles/shepherd" element={<RoleShepherd />} />
          <Route path="/roles/companion" element={<RoleCompanion />} />
          <Route path="/roles/visitor" element={<RoleVisitor />} />
          <Route path="/roles/steward" element={<RoleSteward />} />
          <Route path="/roles/:role/:guideSlug" element={<RoleGuidePage />} />
          <Route path="/stories/roles/:slug" element={<RoleStoryPage />} />
          <Route path="/archetypes/church-week" element={<ChurchWeek />} />
          <Route path="/archetypes/nonprofit-week" element={<NonprofitWeek />} />
          <Route path="/archetypes/social-enterprise-week" element={<SocialEnterpriseWeek />} />
          <Route path="/archetypes/community-network-week" element={<CommunityNetworkWeek />} />
          <Route path="/archetypes/ministry-outreach-week" element={<MinistryOutreachWeek />} />
          <Route path="/archetypes/caregiver-solo-week" element={<CaregiverSoloWeek />} />
          <Route path="/archetypes/caregiver-agency-week" element={<CaregiverAgencyWeek />} />
          <Route path="/archetypes/missionary-org-week" element={<MissionaryOrgWeek />} />
          <Route path="/insights" element={<InsightsIndex />} />
          <Route path="/insights/:slug" element={<InsightPage />} />
          <Route path="/archetypes/:slug/deep" element={<ArchetypeDeepPage />} />
          <Route path="/stories/:slug" element={<StoryPage />} />
          <Route path="/compare/:slug" element={<CompareSlugRouter />} />
          <Route path="/metros/:metroSlug/:archetypeSlug" element={<MetroArchetypePage />} />
          <Route path="/metros/:metroSlug" element={<MetroPublicPage />} />
          <Route path="/path/:roleSlug" element={<RolePathwayPage />} />
          <Route path="/calling/:themeSlug" element={<CallingPage />} />
          <Route path="/library" element={<LibraryIndexPage />} />
          <Route path="/library/:conceptSlug" element={<LibraryConceptPage />} />
          <Route path="/network" element={<NetworkDirectory />} />
          <Route path="/network/:themeSlug" element={<CommunioNetworkPage />} />
          <Route path="/public/:tenantSlug" element={<TenantPublicMirror />} />
          <Route path="/week/:slug" element={<WeekNarrativePage />} />
          <Route path="/mission-atlas" element={<MissionAtlas />} />
          <Route path="/mission-atlas/:id" element={<MissionAtlasDetail />} />
          <Route path="/lexicon" element={<Lexicon />} />
          <Route path="/lexicon/:slug" element={<LexiconTerm />} />
          <Route path="/field-journal" element={<FieldJournal />} />
          <Route path="/field-journal/:slug" element={<FieldJournalEntryPage />} />
          <Route path="/authority" element={<Authority />} />
          <Route path="/authority/:category" element={<AuthorityCategory />} />
          <Route path="/authority/:category/:slug" element={<AuthorityArticle />} />
          <Route path="/legal/terms" element={<LegalTerms />} />
          <Route path="/legal/privacy" element={<LegalPrivacy />} />
          <Route path="/legal/data-processing" element={<LegalDPA />} />
          <Route path="/legal/acceptable-use" element={<LegalAcceptableUse />} />
          <Route path="/legal/ai-transparency" element={<LegalAITransparency />} />
          <Route path="/fundraising-without-a-donor-crm" element={<RelationalFundraising />} />
          <Route path="/cros-donor-humanity" element={<DonorHumanity />} />
          <Route path="/why-cros" element={<WhyCros />} />
          <Route path="/essays" element={<EssaysIndex />} />
          <Route path="/essays/:slug" element={<EssayPage />} />
          <Route path="/field-notes-library" element={<FieldNotesIndex />} />
          <Route path="/reflections" element={<ReflectionsIndex />} />
          <Route path="/reflections/:year/:month" element={<ReflectionsIndex />} />
          <Route path="/for-companions" element={<ForCaregivers />} />
          <Route path="/for-caregivers" element={<ForCaregivers />} />
          <Route path="/retreat-centers" element={<RetreatCenters />} />
          <Route path="/diocese" element={<Diocese />} />
          <Route path="/help/companions" element={<CaregiverGuide />} />
          <Route path="/help/caregivers" element={<CaregiverGuide />} />
        </Route>
        <Route path="/sitemap.xml" element={<SitemapRoute />} />
        

        {/* Public event registration (no layout wrapper — standalone page) */}
        <Route path="/p/:tenantSlug" element={<PublicPresencePage />} />
        <Route path="/events/:publicSlug" element={<PublicEventPage />} />

        {/* Demo gate */}
        <Route path="/demo" element={<DemoGatePage />} />

        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/sponsored-setup" element={<ProtectedRoute><SponsoredSetup /></ProtectedRoute>} />

        {/* Operator Console (top-level, admin-only, lazy-loaded) */}
        <Route path="/operator" element={<OperatorShell><OperatorOverview /></OperatorShell>} />
        <Route path="/operator/tenants" element={<OperatorShell><OperatorTenantsPage /></OperatorShell>} />
        <Route path="/operator/apps" element={<OperatorShell><OperatorAppsPage /></OperatorShell>} />
        <Route path="/operator/console/apps" element={<OperatorShell><OperatorConsoleAppsPage /></OperatorShell>} />
        <Route path="/operator/audit" element={<OperatorShell><OperatorAuditPage /></OperatorShell>} />
        <Route path="/operator/scientia" element={<OperatorShell><OperatorScientiaPage /></OperatorShell>} />
        <Route path="/operator/scientia/templates" element={<OperatorShell><OperatorScientiaTemplatesPage /></OperatorShell>} />
        <Route path="/operator/scientia/federation-campaigns" element={<OperatorShell><GardenerFederationCampaignsPage /></OperatorShell>} />
        <Route path="/operator/tenants/:tenantId" element={<OperatorShell><OperatorTenantDetailPage /></OperatorShell>} />
        <Route path="/operator/intake" element={<OperatorShell><OperatorIntakePage /></OperatorShell>} />
        <Route path="/operator/automation" element={<OperatorShell><OperatorAutomationPage /></OperatorShell>} />
        <Route path="/operator/system" element={<OperatorShell><OperatorSystemPage /></OperatorShell>} />
        <Route path="/operator/machina/ai-observatory" element={<OperatorShell><AIObservatoryPage /></OperatorShell>} />
        <Route path="/operator/machina/orientation" element={<OperatorShell><OrientationDebugPage /></OperatorShell>} />
        <Route path="/operator/integrations" element={<OperatorShell><OperatorIntegrationsPage /></OperatorShell>} />
        <Route path="/operator/platform" element={<OperatorShell><OperatorPlatformPage /></OperatorShell>} />
        <Route path="/operator/communio" element={<OperatorShell><OperatorCommunioPage /></OperatorShell>} />
        <Route path="/operator/testimonium" element={<OperatorShell><OperatorTestimoniumPage /></OperatorShell>} />
        <Route path="/operator/scenario-lab" element={<OperatorShell><ScenarioLabPage /></OperatorShell>} />
        <Route path="/operator/sweeps" element={<Navigate to="/operator/system?tab=sweep" replace />} />
        <Route path="/operator/tour" element={<OperatorShell><TourRunnerPage /></OperatorShell>} />
        <Route path="/operator/how-to" element={<OperatorShell><OperatorHowToPage /></OperatorShell>} />
        <Route path="/operator/metros" element={<OperatorShell><OperatorMetrosPage /></OperatorShell>} />
        <Route path="/operator/partners" element={<OperatorShell><OperatorPartnersPage /></OperatorShell>} />
        <Route path="/operator/partners/:slug" element={<OperatorShell><OperatorPartnerDetailPage /></OperatorShell>} />
        <Route path="/operator/scheduling" element={<OperatorShell><OperatorSchedulingPage /></OperatorShell>} />
        <Route path="/operator/outreach" element={<OperatorShell><OperatorOutreachPage /></OperatorShell>} />
        <Route path="/operator/outreach/campaigns/:id" element={<OperatorShell><OperatorCampaignBuilder /></OperatorShell>} />
        <Route path="/operator/time-machine" element={<OperatorShell><OperatorTimeMachinePage /></OperatorShell>} />
        <Route path="/operator/overrides" element={<OperatorShell><OperatorOverridesPage /></OperatorShell>} />
        <Route path="/operator/announcements" element={<OperatorShell><OperatorAnnouncementsPage /></OperatorShell>} />
        <Route path="/operator/ecosystem" element={<OperatorShell><OperatorEcosystemPage /></OperatorShell>} />
        <Route path="/operator/activation" element={<OperatorShell><OperatorActivationPage /></OperatorShell>} />
        <Route path="/operator/error-desk" element={<OperatorShell><ErrorDeskPage /></OperatorShell>} />
        <Route path="/operator/qa" element={<OperatorShell><OperatorQAPage /></OperatorShell>} />
        <Route path="/operator/manuals" element={<OperatorShell><OperatorManualsPage /></OperatorShell>} />
        <Route path="/operator/onboarding-guide" element={<OperatorShell><OnboardingFlowGuide /></OperatorShell>} />
        <Route path="/operator/people" element={<OperatorShell><OperatorPeoplePage /></OperatorShell>} />
        <Route path="/operator/find-people" element={<OperatorShell><FindPeople /></OperatorShell>} />
        <Route path="/operator/find-events" element={<OperatorShell><FindEvents /></OperatorShell>} />
        <Route path="/operator/events" element={<OperatorShell><Events /></OperatorShell>} />
        <Route path="/operator/events/:slug" element={<OperatorShell><EventDetail /></OperatorShell>} />
        <Route path="/operator/activities" element={<OperatorShell><Activities /></OperatorShell>} />
        <Route path="/operator/settings" element={<OperatorShell><OperatorSettingsPage /></OperatorShell>} />
        <Route path="/operator/seo" element={<OperatorShell><OperatorSeoPage /></OperatorShell>} />

        {/* Operator Nexus */}
        <Route path="/operator/nexus" element={<OperatorShell><OperatorNexusHome /></OperatorShell>} />
        <Route path="/operator/nexus/playbooks" element={<OperatorShell><OperatorPlaybooks /></OperatorShell>} />
        <Route path="/operator/nexus/integrations" element={<Navigate to="/operator/integrations?tab=reference" replace />} />
        <Route path="/operator/nexus/support" element={<OperatorShell><OperatorSupportInbox /></OperatorShell>} />
        <Route path="/operator/nexus/activation" element={<Navigate to="/operator/activation" replace />} />
        <Route path="/operator/nexus/expansion" element={<OperatorShell><OperatorExpansionWatch /></OperatorShell>} />
        <Route path="/operator/nexus/knowledge" element={<OperatorShell><OperatorKnowledge /></OperatorShell>} />
        <Route path="/operator/nexus/qa" element={<Navigate to="/operator/qa?tab=health" replace />} />
        <Route path="/operator/nexus/migrations" element={<Navigate to="/operator/integrations?tab=migrations" replace />} />
        <Route path="/operator/nexus/stability" element={<Navigate to="/operator/system?tab=friction" replace />} />
        <Route path="/operator/nexus/rhythm" element={<OperatorShell><OperatorRhythmPage /></OperatorShell>} />
        <Route path="/operator/nexus/presence" element={<OperatorShell><OperatorPresencePage /></OperatorShell>} />
        <Route path="/operator/nexus/friction" element={<OperatorShell><OperatorSignumPage /></OperatorShell>} />
        <Route path="/operator/nexus/guidance" element={<OperatorShell><OperatorGuidancePage /></OperatorShell>} />
        <Route path="/operator/nexus/lumen" element={<OperatorShell><OperatorLumenPage /></OperatorShell>} />
        <Route path="/operator/nexus/arrival" element={<OperatorShell><ArrivalFlow /></OperatorShell>} />
        <Route path="/operator/nexus/recovery" element={<OperatorShell><OperatorRecovery /></OperatorShell>} />
        <Route path="/operator/nexus/narrative" element={<OperatorShell><OperatorNarrativePage /></OperatorShell>} />
        <Route path="/operator/nexus/narrative-studio" element={<OperatorShell><OperatorContentStudio /></OperatorShell>} />
        <Route path="/operator/nexus/civitas" element={<OperatorShell><OperatorCivitasStudio /></OperatorShell>} />
        <Route path="/operator/nexus/narrative-ecosystem" element={<OperatorShell><OperatorNarrativeEcosystem /></OperatorShell>} />
        <Route path="/operator/nexus/adoption" element={<OperatorShell><OperatorAdoptionPage /></OperatorShell>} />
        <Route path="/operator/nexus/stability" element={<OperatorShell><OperatorStabilityPage /></OperatorShell>} />
        <Route path="/operator/nexus/simulation" element={<OperatorShell><OperatorSimulationPage /></OperatorShell>} />
        <Route path="/operator/nexus/content" element={<OperatorShell><OperatorContentStudio /></OperatorShell>} />
        <Route path="/operator/nexus/library" element={<OperatorShell><OperatorLivingLibrary /></OperatorShell>} />
        <Route path="/operator/nexus/garden" element={<OperatorShell><OperatorGardenPage /></OperatorShell>} />
        <Route path="/operator/nexus/examen/morning" element={<OperatorShell><MorningExamenPage /></OperatorShell>} />
        <Route path="/operator/nexus/examen/evening" element={<OperatorShell><EveningExamenPage /></OperatorShell>} />
        <Route path="/operator/nexus/notifications" element={<OperatorShell><OperatorNotificationsPage /></OperatorShell>} />
        <Route path="/operator/nexus/analytics" element={<OperatorShell><OperatorAnalyticsPage /></OperatorShell>} />
        <Route path="/operator/nexus/federation-analytics" element={<OperatorShell><FederationAnalyticsPage /></OperatorShell>} />
        <Route path="/operator/nexus/discovery-insights" element={<OperatorShell><OperatorDiscoveryInsights /></OperatorShell>} />
        <Route path="/operator/nexus/garden-pulse" element={<OperatorShell><GardenPulsePage /></OperatorShell>} />
        <Route path="/operator/nexus/studio" element={<OperatorShell><GardenerStudioPage /></OperatorShell>} />
        <Route path="/operator/nexus/inbox" element={<OperatorShell><GardenerInboxPage /></OperatorShell>} />

        {/* Tenant-scoped app routes: /:tenantSlug/... */}
        <Route path="/:tenantSlug" element={<ProtectedRoute><TenantRouteGuard /></ProtectedRoute>}>
          <Route index element={<Index />} />
          <Route path="dashboard" element={<Index />} />
          <Route path="metros" element={<MetroIntelligenceGate><Metros /></MetroIntelligenceGate>} />
          <Route path="metros/:metroId" element={<MetroIntelligenceGate><MetroDetail /></MetroIntelligenceGate>} />
          <Route path="metros/narratives" element={<MetroIntelligenceGate><MetroNews /></MetroIntelligenceGate>} />
          <Route path="momentum" element={<MetroIntelligenceGate><FeatureGate featureKey="momentum_map_overlays"><MomentumMap /></FeatureGate></MetroIntelligenceGate>} />
          <Route path="radar" element={<Radar />} />
          <Route path="analytics" element={<MovementIntelligence />} />
          <Route path="intelligence" element={<MovementIntelligence />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="opportunities/:slug" element={<OpportunityDetail />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="anchors" element={<Anchors />} />
          <Route path="provisions" element={<Provisions />} />
          <Route path="provisions/:id" element={<ProvisionDetail />} />
          <Route path="people" element={<People />} />
          <Route path="people/:slug" element={<PersonDetail />} />
          <Route path="people/find" element={<FindPeople />} />
          <Route path="graph" element={<RelationshipGraph />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:slug" element={<EventDetail />} />
          <Route path="events/find" element={<FindEvents />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="calendar/event/:eventId" element={<CalendarEventPage />} />
          <Route path="activities" element={<Activities />} />
          <Route path="outreach/campaigns" element={<CampaignsGate><Campaigns /></CampaignsGate>} />
          <Route path="outreach/campaigns/:id" element={<CampaignsGate><CampaignBuilder /></CampaignsGate>} />
          <Route path="grants" element={<Grants />} />
          <Route path="grants/:id" element={<GrantDetail />} />
          <Route path="grants/find" element={<FindGrants />} />
          <Route path="volunteers" element={<Volunteers />} />
          <Route path="volunteers/:id" element={<VolunteerDetail />} />
          <Route path="volunteer-hours-inbox" element={<VolunteerHoursInbox />} />
          <Route path="impulsus" element={<FeatureGate featureKey="impulsus"><Impulsus /></FeatureGate>} />
          <Route path="field-notes" element={<FieldNotesPage />} />
          <Route path="visits" element={<Visits />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="testimonium" element={<FeatureGate featureKey="testimonium"><Testimonium /></FeatureGate>} />
          <Route path="testimonium/:id" element={<TestimoniumReport />} />
          <Route path="testimonium/export" element={<FeatureGate featureKey="testimonium"><TestimoniumExports /></FeatureGate>} />
          <Route path="story" element={<NarrativeStudio />} />
          <Route path="narrative-threads" element={<NarrativeThreads />} />
          <Route path="intel-feed" element={<IntelligenceFeed />} />
          <Route path="momentum-rankings" element={<MomentumRankings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/impact-export" element={<FeatureGate featureKey="exec_exports"><ImpactExport /></FeatureGate>} />
          <Route path="reports/those-who-gave" element={<ThoseWhoGaveReport />} />
          <Route path="import" element={<ImportCenter />} />
          <Route path="quick-add" element={<QuickAdd />} />
          <Route path="playbooks" element={<Playbooks />} />
          <Route path="workflow-downloads" element={<WorkflowDownloads />} />
          <Route path="technical-docs" element={<TechnicalDocumentation />} />
          <Route path="build-report" element={<BuildReportPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="financial-activity" element={<FinancialActivity />} />
          <Route path="settings/voice" element={<VoiceSettings />} />
          <Route path="settings/impact" element={<ImpactDimensionsPage />} />
          <Route path="settings/google-forms" element={<GoogleFormIntakePage />} />
          <Route path="my-activity" element={<MyActivity />} />
          <Route path="help" element={<Help />} />
          <Route path="help/adoption" element={<AdoptionHub />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="contacts" element={<People />} />
          <Route path="relatio" element={<RelatioMarketplace />} />
          <Route path="relatio/setup/:connectorKey" element={<ImportWizard />} />
          <Route path="relatio/companion/:connectorKey" element={<IntegrationGuidePanel />} />
          <Route path="relatio/jobs/:id" element={<ImportJobDetail />} />
          <Route path="communio" element={<Communio />} />
          <Route path="communio/caregiver-network" element={<CaregiverNetworkPage />} />
          <Route path="settings/communio-profile" element={<CommunioProfileSetupWizard />} />
          <Route path="getting-started" element={<OnboardingGuide />} />
          <Route path="assessment/enneagram" element={<EnneagramAssessmentPage />} />

          {/* Tenant admin routes — require steward or admin role */}
          <Route path="admin" element={<ProtectedRoute requiredRoles={['admin', 'leadership']}><Admin /></ProtectedRoute>} />
          <Route path="admin/activation" element={<ProtectedRoute requiredRoles={['admin', 'leadership']}><Activation /></ProtectedRoute>} />
          <Route path="admin/team" element={<ProtectedRoute requiredRoles={['admin', 'leadership']}><TeamManagement /></ProtectedRoute>} />
          <Route path="admin/how-to" element={<ProtectedRoute requiredRoles={['admin', 'leadership']}><AdminHowTo /></ProtectedRoute>} />
          <Route path="admin/flocknote" element={<ProtectedRoute requiredRoles={['admin', 'leadership']}><FlocknoteImportWizard /></ProtectedRoute>} />
          <Route path="admin/do-not-email" element={<ProtectedRoute requiredRoles={['admin', 'leadership']}><DoNotEmail /></ProtectedRoute>} />
          <Route path="admin/email-providers" element={<ProtectedRoute requiredRoles={['admin', 'leadership']}><EmailProviders /></ProtectedRoute>} />
          <Route path="admin/guided-activation" element={<ProtectedRoute requiredRoles={['admin', 'leadership']}><GuidedActivationPrep /></ProtectedRoute>} />

          {/* Catch-all: show 404 for unmatched tenant sub-paths */}
          <Route path="*" element={
            <MainLayout title="Page not found" subtitle="">
              <div className="flex items-center justify-center min-h-[400px] p-6">
                <div className="text-center max-w-md">
                  <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
                  <p className="text-muted-foreground mb-4">
                    The page you're looking for doesn't exist or has been moved.
                  </p>
                </div>
              </div>
            </MainLayout>
          } />
        </Route>

        {/* Legacy redirects */}
        <Route path="/command-center" element={<Navigate to="/" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  );
}
