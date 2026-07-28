import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getStoredArchetype, clearStoredArchetype } from '@/hooks/useArchetypeCapture';
import { getStoredRole, clearStoredRole } from '@/hooks/useRoleCapture';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HelpCircle, ChevronRight, ChevronLeft, Check, Loader2, Church, Building2, GraduationCap, Users, Heart, Library, Home, Landmark, Compass, HandHeart, MapPin, Shield, BookOpen, Upload, FileText, Sparkles, X, Globe, Eye, EyeOff, Mail, CheckCircle2, Mountain } from 'lucide-react';
import OnboardingOrgEnrichmentStep from '@/components/onboarding/OnboardingOrgEnrichmentStep';
import OnboardingFamiliaStep, { type FamiliaChoice } from '@/components/onboarding/OnboardingFamiliaStep';
import TerritorySelectionStep, { initialTerritorySelection, type TerritorySelection } from '@/components/onboarding/TerritorySelectionStep';
import SectorSelectionStep from '@/components/onboarding/SectorSelectionStep';
import { useSectorCatalog } from '@/hooks/useTenantSectors';
import CaregiverBaseLocationStep, { initialCaregiverBase, type CaregiverBaseLocation } from '@/components/onboarding/CaregiverBaseLocationStep';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { type MinistryRole, MINISTRY_ROLE_PROMPTS, MINISTRY_ROLE_DESCRIPTIONS } from '@/lib/ministryRole';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

import { archetypeConfigs } from '@/config/archetypes';

const iconMap: Record<string, typeof Church> = {
  church: Church,
  workforce_development: Users,
  social_enterprise: Building2,
  community_foundation: Heart,
  public_library_or_city_program: Library,
  nonprofit_program: Building2,
  housing: Home,
  education: GraduationCap,
  government: Landmark,
  missionary_org: Globe,
  retreat_center: Mountain,
};

const ARCHETYPES = archetypeConfigs.map(a => ({
  key: a.key,
  name: a.label,
  icon: iconMap[a.key] ?? Building2,
  description: a.missionPrompt,
}));

/** Tier-based default flags — civitas is now a paid add-on, never auto-enabled by tier */
const TIER_FLAGS: Record<string, Record<string, boolean>> = {
  core: {
    voluntarium: true, provisio: true, signum: true,
    testimonium: false, impulsus: false, relatio: false,
  },
  insight: {
    voluntarium: true, provisio: true, signum: true,
    testimonium: true, impulsus: false, relatio: false,
  },
  story: {
    voluntarium: true, provisio: true, signum: true,
    testimonium: true, impulsus: true, relatio: false,
  },
  bridge: {
    voluntarium: true, provisio: true, signum: true,
    testimonium: true, impulsus: true, relatio: true,
  },
};

const STEPS = ['account_creation', 'welcome', 'steward_welcome', 'archetype', 'relational_focus', 'sectors', 'ministry_role', 'multi_city', 'territory', 'details', 'knowledge', 'org_enrichment', 'familia', 'payments', 'confirm'] as const;
type Step = typeof STEPS[number];

export default function Onboarding() {
  const { t } = useTranslation('common');
  const { user, signUp, isLoading: authLoading } = useAuth();
  const { refreshFlags } = useTenant();
  const { data: sectorCatalog = [] } = useSectorCatalog();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkoutToken = searchParams.get('checkout');
  const hasStripeSessionId = !!searchParams.get('session_id');
  const isCompanionFree = searchParams.get('tier') === 'companion_free';
  const isCheckoutReturn = checkoutToken === 'success' || hasStripeSessionId || isCompanionFree;
  const [hasCheckoutAccess, setHasCheckoutAccess] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('cros_checkout_onboarding') === '1';
  });

  // Account creation state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupName, setSignupName] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [showVerifyEmail, setShowVerifyEmail] = useState(false);

  // Persist a short-lived "checkout passed" flag so callback/query differences don't eject buyers.
  useEffect(() => {
    if (!isCheckoutReturn) return;
    window.sessionStorage.setItem('cros_checkout_onboarding', '1');
    setHasCheckoutAccess(true);
  }, [isCheckoutReturn]);

  useEffect(() => {
    if (!user) return;
    window.sessionStorage.removeItem('cros_checkout_onboarding');
    setHasCheckoutAccess(false);
  }, [user]);

  // Guard: unauthenticated visitors may only reach onboarding after a successful checkout.
  // Without checkout proof they are redirected to /login (no free account creation).
  useEffect(() => {
    if (authLoading) return;
    const canAccessGuestOnboarding = isCheckoutReturn || hasCheckoutAccess;
    if (!user && !canAccessGuestOnboarding) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, isCheckoutReturn, hasCheckoutAccess, navigate]);

  // Start at the right step based on auth state
  const [step, setStep] = useState<Step>(() => {
    // If user is already authenticated, skip account creation
    return 'account_creation';
  });

  // Skip account_creation step when user is already authenticated
  useEffect(() => {
    if (user && step === 'account_creation') {
      setStep('welcome');
    }
  }, [user, step]);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(() => {
    // Pre-select caregiver_solo for free companion signups
    if (isCompanionFree) return 'caregiver_solo';
    const stored = getStoredArchetype();
    if (stored) clearStoredArchetype();
    return stored;
  });
  const [territorySelection, setTerritorySelection] = useState<TerritorySelection>(initialTerritorySelection);
  const [caregiverBase, setCaregiverBase] = useState<CaregiverBaseLocation>(initialCaregiverBase);
  const [multiCity, setMultiCity] = useState<boolean | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgUrl, setOrgUrl] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMinistryRole, setSelectedMinistryRole] = useState<MinistryRole>(() => {
    const stored = getStoredRole();
    if (stored) clearStoredRole();
    if (stored === 'shepherd' || stored === 'companion' || stored === 'visitor') return stored;
    return 'companion';
  });
  const [kbFile, setKbFile] = useState<File | null>(null);
  const [kbTitle, setKbTitle] = useState('');
  const [kbKey, setKbKey] = useState('');
  const [kbUploading, setKbUploading] = useState(false);
  const [kbUploaded, setKbUploaded] = useState(false);
  const [hipaaSensitive, setHipaaSensitive] = useState(false);
  const [communioOptIn, setCommunioOptIn] = useState(false);
  const [orgPdf, setOrgPdf] = useState<File | null>(null);
  const [familiaChoice, setFamiliaChoice] = useState<FamiliaChoice>('skip');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedOrientation, setSelectedOrientation] = useState<'human_focused' | 'institution_focused' | 'hybrid'>('hybrid');
  const [wantsPayments, setWantsPayments] = useState(false);
  // Detect pending tier from user metadata
  const pendingTier = user?.user_metadata?.pending_primary_tier as string | undefined;
  const resolvedTier = pendingTier ?? 'core';

  // Set flags from tier
  const [flags, setFlags] = useState<Record<string, boolean>>(TIER_FLAGS.core);

  useEffect(() => {
    setFlags(TIER_FLAGS[resolvedTier] ?? TIER_FLAGS.core);
  }, [resolvedTier]);

  // Show success toast on checkout return
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      toast.success(t('onboarding.toasts.paymentConfirmed'));
    }
  }, [searchParams]);

  // Territory selection validity
  const isSoloCare = selectedArchetype === 'caregiver_solo';
  const hasTerritorySelection = isSoloCare
    ? !!caregiverBase.state_code
    : territorySelection.mode === 'metro' ? !!territorySelection.territory_id
    : territorySelection.mode === 'county' ? territorySelection.territory_ids.length > 0
    : territorySelection.mode === 'state' ? !!territorySelection.territory_id
    : territorySelection.mode === 'country' ? !!territorySelection.country_code
    : false;

  const stepIndex = STEPS.indexOf(step);
  const canGoBack = stepIndex > 0 && step !== 'account_creation';
  const canGoForward = step === 'account_creation' ? false // handled by signup form submit
    : step === 'welcome' ? true
    : step === 'steward_welcome' ? true
    : step === 'archetype' ? !!selectedArchetype
    : step === 'relational_focus' ? true
    : step === 'sectors' ? selectedSectors.length >= 1
    : step === 'ministry_role' ? !!selectedMinistryRole
    : step === 'multi_city' ? multiCity !== null
    : step === 'territory' ? hasTerritorySelection
    : step === 'details' ? orgName.trim().length >= 2 && orgSlug.trim().length >= 2 && slugStatus !== 'taken' && slugStatus !== 'checking'
    : true;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    if (signupPassword !== signupConfirm) {
      setSignupError(t('onboarding.accountCreation.passwordMismatch'));
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError(t('onboarding.accountCreation.passwordTooShort'));
      return;
    }
    setSignupLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    if (error) {
      setSignupError(error.message);
      setSignupLoading(false);
    } else {
      // Account created — Supabase returns a session even before email verification.
      // Advance to onboarding steps; verification is deferred to the end.
      setSignupLoading(false);
      // The useEffect watching `user` will auto-advance to 'welcome'
    }
  };

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  };
  const goBack = () => {
    if (canGoBack) setStep(STEPS[stepIndex - 1]);
  };

  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (slug.length < 2) { setSlugStatus('idle'); return; }
    setSlugStatus('checking');
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    // If tenant exists, check if current user owns it (resume case)
    if (data && user) {
      const { data: membership } = await supabase
        .from('tenant_users' as any)
        .select('tenant_id')
        .eq('tenant_id', data.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setSlugStatus(membership ? 'available' : 'taken');
    } else {
      setSlugStatus(data ? 'taken' : 'available');
    }
  }, [user]);

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    setOrgSlug(cleaned);
    setSlugStatus('idle');
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    if (cleaned.length >= 2) {
      slugCheckTimer.current = setTimeout(() => checkSlugAvailability(cleaned), 400);
    }
  };

  // Auto-generate slug from org name
  useEffect(() => {
    if (orgName && !orgSlug) {
      handleSlugChange(orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [orgName]);

  const tierLabel = useMemo(() => {
    const labels: Record<string, string> = { core: 'Core', insight: 'Insight', story: 'Story', bridge: 'Bridge' };
    return labels[resolvedTier] ?? 'Core';
  }, [resolvedTier]);

  const [setupMessage, setSetupMessage] = useState('');

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Step 1: Bootstrap tenant
      setSetupMessage(t('onboarding.confirm.organization') + '…');
      const { data, error } = await supabase.functions.invoke('tenant-bootstrap', {
        body: {
          slug: orgSlug,
          name: orgName,
          archetype: selectedArchetype,
          tier: resolvedTier,
          home_metro_id: territorySelection.mode === 'metro' ? territorySelection.territory_id : null,
          territory_selection: isSoloCare ? null : territorySelection,
          caregiver_base: isSoloCare ? caregiverBase : null,
          civitas_enabled: multiCity === true,
          compliance_posture: hipaaSensitive ? 'hipaa_sensitive' : 'standard',
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Bootstrap failed');

      // Step 2: Apply archetype defaults
      setSetupMessage(t('onboarding.welcome.title') + '…');
      const { data: applyData, error: applyErr } = await supabase.functions.invoke('tenant-archetype-apply', {
        body: {
          tenant_id: data.tenant.id,
          archetype: selectedArchetype,
        },
      });
      if (applyErr) {
        console.warn('Archetype apply warning:', applyErr);
      }

      // Step 3: Save relational orientation
      await supabase.rpc('set_relational_orientation', {
        p_tenant_id: data.tenant.id,
        p_orientation: selectedOrientation,
        p_auto_manage: true,
      }).then(({ error: oriErr }) => {
        if (oriErr) console.warn('Orientation save warning:', oriErr);
      });

      // Step 4: Start guided onboarding
      await supabase.functions.invoke('onboarding-start', {
        body: { tenant_id: data.tenant.id, archetype: selectedArchetype },
      }).catch((e) => console.warn('Onboarding start warning:', e));

      // Step 4: Save ministry role to user's profile
      await supabase
        .from('profiles')
        .update({ ministry_role: selectedMinistryRole } as any)
        .eq('user_id', user.id);

      // Step 5: Enrich org identity if URL or PDF provided
      if (orgUrl.trim() || orgPdf) {
        setSetupMessage(t('onboarding.knowledge.title') + '…');
        if (orgPdf) {
          // Upload PDF to storage then call enrichment with storage path
          const storagePath = `onboarding/${data.tenant.id}/${crypto.randomUUID()}.pdf`;
          const { error: uploadErr } = await supabase.storage
            .from('kb-uploads')
            .upload(storagePath, orgPdf, { contentType: 'application/pdf' });
          if (uploadErr) {
            console.warn('Org PDF upload warning:', uploadErr);
          } else {
            await supabase.functions.invoke('tenant-enrich-org', {
              body: { tenant_id: data.tenant.id, pdf_storage_path: storagePath },
            }).catch((e) => console.warn('Org enrichment warning:', e));
          }
        } else {
          await supabase.functions.invoke('tenant-enrich-org', {
            body: { tenant_id: data.tenant.id, url: orgUrl.trim() },
          }).catch((e) => console.warn('Org enrichment warning:', e));
        }
      }

      // Step 6: Save Communio opt-in
      if (communioOptIn) {
        await supabase
          .from('tenant_public_profiles' as any)
          .update({
            communio_opt_in: true,
            visibility_level: 'communio',
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', data.tenant.id)
          .then(({ error: commErr }) => {
            if (commErr) console.warn('Communio opt-in update warning:', commErr);
          });
      }

      // Step 7: Create caregiver network profile (for solo caregivers)
      if (isSoloCare && caregiverBase.state_code) {
        await supabase
          .from('caregiver_profiles')
          .upsert({
            user_id: user.id,
            tenant_id: data.tenant.id,
            display_name: orgName || 'A caregiver',
            base_city: caregiverBase.city || null,
            base_state_code: caregiverBase.state_code,
            base_country_code: caregiverBase.country_code || 'US',
            network_opt_in: caregiverBase.network_opt_in,
          }, { onConflict: 'tenant_id,user_id' })
          .then(({ error: cgErr }) => {
            if (cgErr) console.warn('Caregiver profile creation warning:', cgErr);
          });
      }

      // Step 8: Save sector tags
      if (selectedSectors.length > 0) {
        const sectorRows = selectedSectors.map((sid, i) => ({
          tenant_id: data.tenant.id,
          sector_id: sid,
          is_primary: i === 0,
        }));
        await supabase.from('tenant_sectors').insert(sectorRows)
          .then(({ error: secErr }) => {
            if (secErr) console.warn('Sector save warning:', secErr);
          });
      }

      setSetupMessage(t('onboarding.confirm.creatingMessage'));

      // Auto-trigger Local Pulse crawl for the new home territory (non-blocking)
      const homeMetro = territorySelection.mode === 'metro' ? territorySelection.territory_id : null;
      if (homeMetro) {
        supabase.functions.invoke('local-pulse-worker', {
          body: { metro_id: homeMetro, run_kind: 'manual', force: true, tenant_id: data.tenant.id },
        }).catch(e => console.warn('Initial Local Pulse crawl warning:', e));
      }

      toast.success(t('onboarding.toasts.orgCreated'));
      await refreshFlags();

      // Check if email is verified — if not, show verification prompt
      const emailConfirmed = user?.email_confirmed_at;
      if (!emailConfirmed) {
        setShowVerifyEmail(true);
        return;
      }

      // Visitors go directly to visits page
      if (selectedMinistryRole === 'visitor') {
        navigate(`/${orgSlug}/visits`, { replace: true });
      } else {
        navigate(`/${orgSlug}/`, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create organization';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
      setSetupMessage('');
    }
  };

  const enabledFeatures = Object.entries(flags).filter(([, v]) => v).map(([k]) => k);

  // Filter out account_creation from visible progress steps
  const visibleSteps = STEPS.filter(s => s !== 'account_creation');
  const visibleStepIndex = step === 'account_creation' ? -1 : visibleSteps.indexOf(step);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-x-hidden" data-testid="onboarding-root">
      <div className="w-full max-w-2xl space-y-6 overflow-hidden">

        {/* Account Creation Step — shown before anything else for unauthenticated users */}
        {step === 'account_creation' && (
          <>
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{t('onboarding.welcomeTitle')}</h1>
              <p className="text-muted-foreground">{t('onboarding.welcomeSubtitle')}</p>
            </div>

            <Card>
                <CardHeader className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{isCheckoutReturn ? t('onboarding.accountCreation.paymentConfirmed') : t('onboarding.accountCreation.createYourAccount')}</CardTitle>
                  <CardDescription className="max-w-sm mx-auto">
                    {isCheckoutReturn
                      ? t('onboarding.accountCreation.paymentConfirmedDesc')
                      : t('onboarding.accountCreation.startSetupDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {signupError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>{signupError}</AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">{t('onboarding.accountCreation.yourName')}</Label>
                      <Input
                        id="signup-name"
                        placeholder={t('onboarding.accountCreation.namePlaceholder')}
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        data-testid="onboarding-signup-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">{t('onboarding.accountCreation.emailAddress')}</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder={t('onboarding.accountCreation.emailPlaceholder')}
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        data-testid="onboarding-signup-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">{t('onboarding.accountCreation.password')}</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showSignupPassword ? 'text' : 'password'}
                          placeholder={t('onboarding.accountCreation.passwordPlaceholder')}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                          data-testid="onboarding-signup-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                        >
                          {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <PasswordStrengthIndicator password={signupPassword} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm">{t('onboarding.accountCreation.confirmPassword')}</Label>
                      <Input
                        id="signup-confirm"
                        type="password"
                        placeholder={t('onboarding.accountCreation.confirmPasswordPlaceholder')}
                        value={signupConfirm}
                        onChange={(e) => setSignupConfirm(e.target.value)}
                        required
                        data-testid="onboarding-signup-confirm"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={signupLoading || !signupEmail || !signupPassword}
                      data-testid="onboarding-signup-submit"
                    >
                      {signupLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {t('onboarding.accountCreation.createAccountButton')}
                    </Button>
                  </form>
                </CardContent>
              </Card>
          </>
        )}

        {/* Standard onboarding content — only shown when authenticated */}
        {step !== 'account_creation' && (
          <>
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{t('onboarding.welcomeTitle')}</h1>
          <p className="text-muted-foreground">{t('onboarding.setupSubtitle')}</p>
          {pendingTier && (
            <Badge variant="secondary" className="text-xs">
              {t('onboarding.planBadge', { tier: tierLabel })}
            </Badge>
          )}
        </div>

        {/* Progress — compact on mobile, full on desktop */}
        <div className="w-full overflow-hidden px-2">
          {/* Mobile: simple text + progress bar */}
          <div className="sm:hidden space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('onboarding.stepOf', { current: visibleStepIndex + 1, total: visibleSteps.length })}</span>
              <span>{Math.round(((visibleStepIndex + 1) / visibleSteps.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((visibleStepIndex + 1) / visibleSteps.length) * 100}%` }}
              />
            </div>
          </div>
          {/* Desktop: numbered circles */}
          <div className="hidden sm:flex items-center justify-center gap-1.5">
            {visibleSteps.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0
                  ${i <= visibleStepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {i < visibleStepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i < visibleSteps.length - 1 && (
                  <div className={`w-4 h-0.5 ${i < visibleStepIndex ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
          </>
        )}

        {/* Step Content */}
        {step === 'welcome' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{t('onboarding.welcome.title')}</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                {t('onboarding.welcome.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto text-sm text-muted-foreground">
                <div className="space-y-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <span className="text-primary font-semibold">1</span>
                  </div>
                  <p>{t('onboarding.welcome.step1')}</p>
                </div>
                <div className="space-y-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <span className="text-primary font-semibold">2</span>
                  </div>
                  <p>{t('onboarding.welcome.step2')}</p>
                </div>
                <div className="space-y-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <span className="text-primary font-semibold">3</span>
                  </div>
                  <p>{t('onboarding.welcome.step3')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'steward_welcome' && (
          <Card>
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>
                {t('onboarding.stewardWelcome.title')}
              </CardTitle>
              <CardDescription className="max-w-md mx-auto">
                {t('onboarding.stewardWelcome.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground max-w-lg mx-auto">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="font-medium text-foreground mb-1">{t('onboarding.stewardWelcome.inviteTeamTitle')}</div>
                  <div className="text-xs">{t('onboarding.stewardWelcome.inviteTeamDesc')}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="font-medium text-foreground mb-1">{t('onboarding.stewardWelcome.manageBillingTitle')}</div>
                  <div className="text-xs">{t('onboarding.stewardWelcome.manageBillingDesc')}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="font-medium text-foreground mb-1">{t('onboarding.stewardWelcome.shapeExperienceTitle')}</div>
                  <div className="text-xs">{t('onboarding.stewardWelcome.shapeExperienceDesc')}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/70 pt-2">
                {t('onboarding.stewardWelcome.roleNote')}
              </p>
            </CardContent>
          </Card>
        )}

        {step === 'archetype' && (
          <Card data-testid="onboarding-step-archetype">
            <CardHeader>
              <CardTitle>{t('onboarding.archetype.title')}</CardTitle>
              <CardDescription>
                {t('onboarding.archetype.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ARCHETYPES.map(({ key, name, icon: Icon, description }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedArchetype(key)}
                    className={`text-left p-4 rounded-lg border-2 transition-all
                      ${selectedArchetype === key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${selectedArchetype === key ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="font-medium text-sm">{name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                      </div>
                    </div>
                  </button>
                ))}
               </div>

              {/* HIPAA-Sensitive Mode toggle */}
              <div className="mt-6 p-4 rounded-lg border border-border bg-muted/30 space-y-2">
                <div className="flex items-center gap-3">
                  <Switch
                    id="hipaa-sensitive"
                    checked={hipaaSensitive}
                    onCheckedChange={setHipaaSensitive}
                  />
                  <Label htmlFor="hipaa-sensitive" className="text-sm font-medium cursor-pointer">
                    {t('onboarding.archetype.privacyModeLabel')}
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                      <p><strong>What:</strong> Anonymizes names in reflections and narratives.</p>
                      <p><strong>Where:</strong> Testimonium, NRI summaries, and public presence pages.</p>
                      <p><strong>Why:</strong> For healthcare-adjacent or confidential outreach environments.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground pl-[2.75rem]">
                  {t('onboarding.archetype.privacyModeDesc')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'relational_focus' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>
                {t('onboarding.relationalFocus.title')}
              </CardTitle>
              <CardDescription className="max-w-md mx-auto">
                {t('onboarding.relationalFocus.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {([
                  { value: 'human_focused' as const, label: t('onboarding.relationalFocus.humanFocused'), icon: Users, description: t('onboarding.relationalFocus.humanFocusedDesc') },
                  { value: 'institution_focused' as const, label: t('onboarding.relationalFocus.institutionFocused'), icon: Building2, description: t('onboarding.relationalFocus.institutionFocusedDesc') },
                  { value: 'hybrid' as const, label: t('onboarding.relationalFocus.hybrid'), icon: Heart, description: t('onboarding.relationalFocus.hybridDesc') },
                ]).map(opt => {
                  const Icon = opt.icon;
                  const isSelected = selectedOrientation === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedOrientation(opt.value)}
                      className={`text-left p-4 rounded-lg border-2 transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'sectors' && (
          <SectorSelectionStep selected={selectedSectors} onChange={setSelectedSectors} />
        )}

        {step === 'ministry_role' && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>
                {t('onboarding.ministryRole.title')}
              </CardTitle>
              <CardDescription className="max-w-md mx-auto">
                {t('onboarding.ministryRole.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                {([
                  { role: 'shepherd' as MinistryRole, icon: Compass, prompt: MINISTRY_ROLE_PROMPTS.shepherd, desc: MINISTRY_ROLE_DESCRIPTIONS.shepherd },
                  { role: 'companion' as MinistryRole, icon: HandHeart, prompt: MINISTRY_ROLE_PROMPTS.companion, desc: MINISTRY_ROLE_DESCRIPTIONS.companion },
                  { role: 'visitor' as MinistryRole, icon: MapPin, prompt: MINISTRY_ROLE_PROMPTS.visitor, desc: MINISTRY_ROLE_DESCRIPTIONS.visitor },
                ]).map(({ role, icon: Icon, prompt, desc }) => (
                  <button
                    key={role}
                    onClick={() => setSelectedMinistryRole(role)}
                    className={`text-left p-5 rounded-lg border-2 transition-all
                      ${selectedMinistryRole === role
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        selectedMinistryRole === role ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        <Icon className={`h-5 w-5 ${selectedMinistryRole === role ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="font-medium">{prompt}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">{desc}</div>
                        {selectedMinistryRole === role && (
                          <div className="mt-3 text-xs text-muted-foreground/80 leading-relaxed border-t pt-3">
                            {role === 'shepherd' && "You\u2019ll see metro narratives, expansion planning, and guidance tools first."}
                            {role === 'companion' && "You\u2019ll start with reflections, email follow-ups, and Impulsus \u2014 the daily heartbeat of relationships."}
                            {role === 'visitor' && "You\u2019ll see events, Volunt\u0101rium, and simple mobile-first actions \u2014 designed to feel like a paper list."}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'multi_city' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('onboarding.multiCity.title')}</CardTitle>
              <CardDescription>
                {t('onboarding.multiCity.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setMultiCity(false)}
                  className={`text-left p-4 rounded-lg border-2 transition-all
                    ${multiCity === false
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'}`}
                >
                  <div className="font-medium text-sm">{t('onboarding.multiCity.oneCommunity')}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('onboarding.multiCity.oneCommunityDesc')}
                  </div>
                </button>
                <button
                  onClick={() => setMultiCity(true)}
                  className={`text-left p-4 rounded-lg border-2 transition-all
                    ${multiCity === true
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'}`}
                >
                  <div className="font-medium text-sm">{t('onboarding.multiCity.multipleCities')}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('onboarding.multiCity.multipleCitiesDesc')}
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'territory' && (
          isSoloCare ? (
            <CaregiverBaseLocationStep value={caregiverBase} onChange={setCaregiverBase} />
          ) : (
            <TerritorySelectionStep
              archetype={selectedArchetype}
              value={territorySelection}
              onChange={setTerritorySelection}
            />
          )
        )}

        {step === 'details' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('onboarding.details.title')}</CardTitle>
              <CardDescription>{t('onboarding.details.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">{t('onboarding.details.orgNameLabel')}</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder={t('onboarding.details.orgNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">{t('onboarding.details.urlSlugLabel')}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">thecros.app/</span>
                  <div className="relative flex-1">
                    <Input
                      id="org-slug"
                      value={orgSlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="pcsforpeople"
                      className={slugStatus === 'taken' ? 'border-destructive focus-visible:ring-destructive' : slugStatus === 'available' ? 'border-green-500 focus-visible:ring-green-500' : ''}
                    />
                    {slugStatus === 'checking' && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {slugStatus === 'available' && (
                      <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {slugStatus === 'taken' && (
                      <X className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
                {slugStatus === 'taken' && (
                  <p className="text-xs text-destructive">{t('onboarding.details.slugTaken')}</p>
                )}
                {slugStatus === 'available' && (
                  <p className="text-xs text-green-600 dark:text-green-400">{t('onboarding.details.slugAvailable')}</p>
                )}
              </div>

              {/* Feature preview — tier-determined */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">{t('onboarding.details.featuresIncluded', { tier: tierLabel })}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-xs">
                      Features are determined by your plan tier. You can upgrade anytime from settings.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {enabledFeatures.map((k) => (
                    <Badge key={k} variant="outline" className="text-xs capitalize">{k}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'knowledge' && (
          <Card>
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>
                {t('onboarding.knowledge.title')}
              </CardTitle>
              <CardDescription className="max-w-md mx-auto">
                {t('onboarding.knowledge.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* How it works */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <Upload className="h-5 w-5 mx-auto text-primary mb-1.5" />
                  <div className="font-medium text-foreground">{t('onboarding.knowledge.uploadPdfTitle')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t('onboarding.knowledge.uploadPdfDesc')}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <Sparkles className="h-5 w-5 mx-auto text-primary mb-1.5" />
                  <div className="font-medium text-foreground">{t('onboarding.knowledge.nriLearnsTitle')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t('onboarding.knowledge.nriLearnsDesc')}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <FileText className="h-5 w-5 mx-auto text-primary mb-1.5" />
                  <div className="font-medium text-foreground">{t('onboarding.knowledge.smarterGuidanceTitle')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t('onboarding.knowledge.smarterGuidanceDesc')}</div>
                </div>
              </div>

              {/* Upload area */}
              {kbUploaded ? (
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 text-center space-y-1">
                  <Check className="h-6 w-6 text-primary mx-auto" />
                  <div className="font-medium text-sm">{t('onboarding.knowledge.uploadedSuccess', { title: kbTitle })}</div>
                  <div className="text-xs text-muted-foreground">{t('onboarding.knowledge.uploadedNote')}</div>
                </div>
              ) : kbFile ? (
                <div className="p-4 rounded-lg border border-dashed space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{kbFile.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">({(kbFile.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setKbFile(null); setKbTitle(''); setKbKey(''); }} disabled={kbUploading}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="kb-title" className="text-xs">{t('onboarding.knowledge.documentTitle')}</Label>
                      <Input id="kb-title" value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} placeholder={t('onboarding.knowledge.documentTitlePlaceholder')} className="text-sm" />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={kbUploading || !kbTitle}
                    onClick={async () => {
                      if (!kbFile || !kbTitle) return;
                      setKbUploading(true);
                      try {
                        const storagePath = `${crypto.randomUUID()}.pdf`;
                        const { error: uploadErr } = await supabase.storage
                          .from('kb-uploads')
                          .upload(storagePath, kbFile, { contentType: 'application/pdf' });
                        if (uploadErr) throw uploadErr;
                        const finalKey = kbKey || kbTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
                        const { error } = await supabase.functions.invoke('parse-pdf-to-kb', {
                          body: { storage_path: storagePath, title: kbTitle, key: finalKey },
                        });
                        if (error) throw error;
                        setKbUploaded(true);
                        toast.success(`"${kbTitle}" imported to your knowledge base!`);
                      } catch (err) {
                        console.error('[onboarding-kb-upload]', err);
                        toast.error('Upload may still be processing. You can check later in Settings.');
                        setKbUploaded(true); // allow them to proceed
                      } finally {
                        setKbUploading(false);
                      }
                    }}
                  >
                    {kbUploading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {t('onboarding.knowledge.uploading')}</> : t('onboarding.knowledge.uploadButton')}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors text-center"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf';
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error('File too large — maximum 5 MB.');
                          return;
                        }
                        setKbFile(file);
                        setKbTitle(file.name.replace(/\.pdf$/i, '').replace(/[_\-\.]+/g, ' ').trim());
                        setKbKey(file.name.replace(/\.pdf$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50));
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <div className="text-sm font-medium text-foreground">{t('onboarding.knowledge.uploadDropzone')}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t('onboarding.knowledge.uploadDropzoneDesc')}</div>
                </button>
              )}

              <p className="text-xs text-muted-foreground/70 text-center">
                {t('onboarding.knowledge.optionalNote')}
              </p>
            </CardContent>
          </Card>
        )}

        {step === 'org_enrichment' && (
          <OnboardingOrgEnrichmentStep
            orgUrl={orgUrl}
            onOrgUrlChange={setOrgUrl}
            onCommunioOptIn={setCommunioOptIn}
            communioOptIn={communioOptIn}
            orgPdf={orgPdf}
            onOrgPdfChange={setOrgPdf}
          />
        )}

        {step === 'familia' && (
          <OnboardingFamiliaStep choice={familiaChoice} onChoiceChange={setFamiliaChoice} />
        )}

        {step === 'payments' && (
          <Card data-testid="onboarding-step-payments">
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <HandHeart className="h-7 w-7 text-primary" />
              </div>
              <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>
                Financial Moments
              </CardTitle>
              <CardDescription className="max-w-md mx-auto">
                Will your organization accept payments, send invoices, or receive generosity through CROS?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Yes, we'll accept payments or invoicing</Label>
                  <p className="text-xs text-muted-foreground">
                    You can connect your Stripe account later in Settings → Payments. CROS never holds funds.
                  </p>
                </div>
                <Switch checked={wantsPayments} onCheckedChange={setWantsPayments} />
              </div>

              {wantsPayments && (
                <div className="p-3 rounded-md bg-muted/50 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    After setup, you'll find a calm <span className="font-medium text-foreground">Payments</span> section in Settings.
                    From there you can:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                    <li>Connect your Stripe account to receive payments directly</li>
                    <li>Send invoices tied to people you know</li>
                    <li>Create shareable payment links for events, generosity, or support</li>
                    <li>Mark events as paid — attendees complete checkout through Stripe</li>
                  </ul>
                  <p className="text-xs text-muted-foreground italic mt-2">
                    Funds always go directly to your organization. A small 1% platform fee supports CROS infrastructure.
                  </p>
                </div>
              )}

              {!wantsPayments && (
                <p className="text-xs text-muted-foreground text-center italic">
                  No problem — you can always enable this later. The thread is always open.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'confirm' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('onboarding.confirm.title')}</CardTitle>
              <CardDescription>{t('onboarding.confirm.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('onboarding.confirm.organization')}</span>
                  <div className="font-medium">{orgName}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('onboarding.confirm.url')}</span>
                  <div className="font-medium">thecros.app/{orgSlug}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('onboarding.confirm.archetype')}</span>
                  <div className="font-medium capitalize">{selectedArchetype?.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('onboarding.confirm.plan')}</span>
                  <div className="font-medium">{t('onboarding.planBadge', { tier: tierLabel })}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('onboarding.confirm.serviceArea')}</span>
                  <div className="font-medium">
                    {isSoloCare
                      ? `${caregiverBase.city ? caregiverBase.city + ', ' : ''}${caregiverBase.state_code || 'US'} (private)`
                      : territorySelection.mode === 'metro' ? 'Metro'
                      : territorySelection.mode === 'county' ? `${territorySelection.territory_ids.length} counties`
                      : territorySelection.mode === 'state' ? 'State'
                      : territorySelection.country_code ?? '—'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('onboarding.confirm.civitas')}</span>
                  <div className="font-medium">{multiCity ? t('onboarding.confirm.civitasEnabled') : t('onboarding.confirm.civitasDisabled')}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('onboarding.confirm.privacyMode')}</span>
                  <div className="font-medium">{hipaaSensitive ? t('onboarding.confirm.privacySensitive') : t('onboarding.confirm.privacyStandard')}</div>
                </div>
                {orgUrl && (
                  <div>
                    <span className="text-muted-foreground">{t('onboarding.confirm.organizationUrl')}</span>
                    <div className="font-medium truncate text-xs">{orgUrl}</div>
                  </div>
                )}
                {selectedSectors.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t('onboarding.confirm.sectors')}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedSectors.map((id) => {
                        const sec = sectorCatalog.find(s => s.id === id);
                        return <Badge key={id} variant="outline" className="text-xs">{sec?.name ?? id.slice(0, 8)}</Badge>;
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">{t('onboarding.confirm.communio')}</span>
                  <div className="font-medium">{communioOptIn ? t('onboarding.confirm.communioOptedIn') : t('onboarding.confirm.communioNotJoined')}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Payments</span>
                  <div className="font-medium">{wantsPayments ? 'Will connect Stripe' : 'Not needed yet'}</div>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">{t('onboarding.confirm.enabledFeatures')}</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {enabledFeatures.map((k) => (
                    <Badge key={k} variant="outline" className="text-xs capitalize">{k}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email Verification — shown after org creation if email is unverified */}
        {showVerifyEmail && (
          <Card data-testid="onboarding-verify-email">
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                {t('onboarding.verifyEmail.title')}
              </CardTitle>
              <CardDescription className="max-w-sm mx-auto">
                {t('onboarding.verifyEmail.description', { email: user?.email })}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Alert className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                  {t('onboarding.verifyEmail.orgCreated')}
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                {t('onboarding.verifyEmail.checkInbox')}
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/login', { replace: true })}
              >
                {t('onboarding.verifyEmail.goToSignIn')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Navigation — hidden during account creation and verify email */}
        {step !== 'account_creation' && !showVerifyEmail && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={goBack} disabled={!canGoBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {t('onboarding.nav.back')}
          </Button>
          {step === 'confirm' ? (
            <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="onboarding-finish">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {setupMessage || t('onboarding.confirm.creatingMessage')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t('onboarding.confirm.createButton')}
                </>
              )}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canGoForward}>
              {t('onboarding.nav.next')} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
