/**
 * LazyOperatorPages — React.lazy wrappers for all operator pages.
 *
 * WHAT: Splits the operator console into separate code chunks.
 * WHERE: Used by AppRouter to lazy-load operator pages.
 * WHY: Reduces initial bundle size — operator pages are admin-only.
 */
import { lazy } from 'react';

// ── Operator top-level ──
export const OperatorOverview = lazy(() => import('@/pages/operator/OperatorOverview'));
export const OperatorTenantsPage = lazy(() => import('@/pages/operator/OperatorTenantsPage'));
export const OperatorAppsPage = lazy(() => import('@/pages/operator/OperatorAppsPage'));
export const OperatorConsoleAppsPage = lazy(() => import('@/pages/operator/OperatorConsoleAppsPage'));
export const OperatorAuditPage = lazy(() => import('@/pages/operator/OperatorAuditPage'));
export const OperatorScientiaPage = lazy(() => import('@/pages/operator/scientia/OperatorScientiaPage'));
export const OperatorScientiaTemplatesPage = lazy(() => import('@/pages/operator/scientia/OperatorScientiaTemplatesPage'));
export const GardenerFederationCampaignsPage = lazy(() => import('@/pages/operator/scientia/GardenerFederationCampaignsPage'));
export const OperatorTenantDetailPage = lazy(() => import('@/pages/operator/OperatorTenantDetailPage'));
export const OperatorIntakePage = lazy(() => import('@/pages/operator/OperatorIntakePage'));
export const OperatorAutomationPage = lazy(() => import('@/pages/operator/OperatorAutomationPage'));
export const OperatorSystemPage = lazy(() => import('@/pages/operator/OperatorSystemPage'));
export const OperatorIntegrationsPage = lazy(() => import('@/pages/operator/OperatorIntegrationsPage'));
export const OperatorPlatformPage = lazy(() => import('@/pages/operator/OperatorPlatformPage'));
export const OperatorCommunioPage = lazy(() => import('@/pages/operator/OperatorCommunioPage'));
export const OperatorTestimoniumPage = lazy(() => import('@/pages/operator/OperatorTestimoniumPage'));
export const ScenarioLabPage = lazy(() => import('@/pages/operator/ScenarioLabPage'));
export const TourRunnerPage = lazy(() => import('@/pages/operator/TourRunnerPage'));
export const OperatorHowToPage = lazy(() => import('@/pages/operator/OperatorHowToPage'));
export const OperatorMetrosPage = lazy(() => import('@/pages/operator/OperatorMetrosPage'));
export const OperatorPartnersPage = lazy(() => import('@/pages/operator/OperatorPartnersPage'));
export const OperatorPartnerDetailPage = lazy(() => import('@/pages/operator/OperatorPartnerDetailPage'));
export const OperatorSchedulingPage = lazy(() => import('@/pages/operator/OperatorSchedulingPage'));
export const OperatorOutreachPage = lazy(() => import('@/pages/operator/OperatorOutreachPage'));
export const OperatorCampaignBuilder = lazy(() => import('@/pages/operator/OperatorCampaignBuilder'));
export const OperatorTimeMachinePage = lazy(() => import('@/pages/operator/OperatorTimeMachinePage'));
export const OperatorOverridesPage = lazy(() => import('@/pages/operator/OperatorOverridesPage'));
export const OperatorAnnouncementsPage = lazy(() => import('@/pages/operator/OperatorAnnouncementsPage'));
export const OperatorEcosystemPage = lazy(() => import('@/pages/operator/OperatorEcosystemPage'));
export const OperatorActivationPage = lazy(() => import('@/pages/operator/OperatorActivationPage'));
export const ErrorDeskPage = lazy(() => import('@/pages/operator/ErrorDeskPage'));
export const OperatorQAPage = lazy(() => import('@/pages/operator/OperatorQAPage'));
export const OperatorManualsPage = lazy(() => import('@/pages/operator/OperatorManualsPage'));
export const OnboardingFlowGuide = lazy(() => import('@/pages/operator/OnboardingFlowGuide'));
export const OperatorSettingsPage = lazy(() => import('@/pages/operator/OperatorSettingsPage'));
export const OperatorSeoPage = lazy(() => import('@/pages/operator/OperatorSeoPage'));
export const OperatorPeoplePage = lazy(() => import('@/pages/operator/OperatorPeoplePage'));

// ── Nexus pages ──
export const OperatorNexusHome = lazy(() => import('@/pages/operator/nexus/OperatorNexusHome'));
export const OperatorPlaybooks = lazy(() => import('@/pages/operator/nexus/OperatorPlaybooks'));
export const OperatorSupportInbox = lazy(() => import('@/pages/operator/nexus/OperatorSupportInbox'));
export const OperatorExpansionWatch = lazy(() => import('@/pages/operator/nexus/OperatorExpansionWatch'));
export const OperatorKnowledge = lazy(() => import('@/pages/operator/nexus/OperatorKnowledge'));
export const OperatorRhythmPage = lazy(() => import('@/pages/operator/nexus/OperatorRhythmPage'));
export const OperatorPresencePage = lazy(() => import('@/pages/operator/nexus/OperatorPresencePage'));
export const OperatorSignumPage = lazy(() => import('@/pages/operator/nexus/OperatorSignumPage'));
export const OperatorGuidancePage = lazy(() => import('@/pages/operator/nexus/OperatorGuidancePage'));
export const OperatorLumenPage = lazy(() => import('@/pages/operator/nexus/OperatorLumenPage'));
export const ArrivalFlow = lazy(() => import('@/pages/operator/nexus/ArrivalFlow'));
export const OperatorRecovery = lazy(() => import('@/pages/operator/nexus/OperatorRecovery'));
export const OperatorNarrativePage = lazy(() => import('@/pages/operator/nexus/OperatorNarrativePage'));
export const OperatorNarrativeStudio = lazy(() => import('@/pages/operator/nexus/OperatorNarrativeStudio'));
export const OperatorCivitasStudio = lazy(() => import('@/pages/operator/nexus/OperatorCivitasStudio'));
export const OperatorNarrativeEcosystem = lazy(() => import('@/pages/operator/nexus/OperatorNarrativeEcosystem'));
export const OperatorAdoptionPage = lazy(() => import('@/pages/operator/nexus/OperatorAdoptionPage'));
export const OperatorStabilityPage = lazy(() => import('@/pages/operator/nexus/OperatorStabilityPage'));
export const OperatorSimulationPage = lazy(() => import('@/pages/operator/nexus/OperatorSimulationPage'));
export const OperatorContentStudio = lazy(() => import('@/pages/operator/nexus/OperatorContentStudio'));
export const OperatorNotificationsPage = lazy(() => import('@/pages/operator/nexus/OperatorNotificationsPage'));
export const OperatorAnalyticsPage = lazy(() => import('@/pages/operator/nexus/OperatorAnalyticsPage'));
export const FederationAnalyticsPage = lazy(() => import('@/pages/operator/nexus/FederationAnalyticsPage'));
export const OperatorDiscoveryInsights = lazy(() => import('@/pages/operator/nexus/OperatorDiscoveryInsights'));
export const OperatorLivingLibrary = lazy(() => import('@/pages/operator/nexus/OperatorLivingLibrary'));
export const OperatorGardenPage = lazy(() => import('@/pages/operator/nexus/OperatorGardenPage'));
export const MorningExamenPage = lazy(() => import('@/pages/operator/nexus/MorningExamenPage'));
export const EveningExamenPage = lazy(() => import('@/pages/operator/nexus/EveningExamenPage'));
export const GardenPulsePage = lazy(() => import('@/pages/operator/nexus/GardenPulsePage'));
export const GardenerStudioPage = lazy(() => import('@/pages/operator/nexus/GardenerStudioPage'));
export const GardenerInboxPage = lazy(() => import('@/pages/operator/nexus/GardenerInboxPage'));
export const AIObservatoryPage = lazy(() => import('@/pages/operator/AIObservatoryPage'));
export const OrientationDebugPage = lazy(() => import('@/pages/operator/OrientationDebugPage'));
