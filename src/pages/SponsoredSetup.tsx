/**
 * SponsoredSetup — Lightweight first-login wizard for Gardener-sponsored tenants.
 *
 * WHAT: 4-step setup: Welcome → Ministry Role → Migration Info → Display Name + Launch.
 * WHERE: Shown once after first login for operator-granted tenants.
 * WHY: Sponsored tenants skip the full onboarding wizard, but users still
 *       need to choose their ministry role, share CRM context, and personalize.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Compass, Users, Eye, ChevronRight, ChevronLeft, Check, Loader2, Sparkles, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { type MinistryRole, MINISTRY_ROLE_DESCRIPTIONS } from '@/lib/ministryRole';

const STEPS = ['welcome', 'role', 'migration', 'profile'] as const;
type Step = typeof STEPS[number];

const ROLES: { key: MinistryRole; label: string; icon: typeof Shield; description: string }[] = [
  {
    key: 'shepherd',
    label: 'Shepherd',
    icon: Compass,
    description: MINISTRY_ROLE_DESCRIPTIONS?.shepherd ?? 'Leadership & strategy — you guide the organization\'s direction and relationships.',
  },
  {
    key: 'companion',
    label: 'Companion',
    icon: Users,
    description: MINISTRY_ROLE_DESCRIPTIONS?.companion ?? 'Staff & collaboration — you work alongside people and manage day-to-day relationships.',
  },
  {
    key: 'visitor',
    label: 'Visitor',
    icon: Eye,
    description: MINISTRY_ROLE_DESCRIPTIONS?.visitor ?? 'Volunteer & field work — you visit, serve, and record what you see.',
  },
];

const CRM_OPTIONS = [
  'Salesforce',
  'HubSpot',
  'Bloomerang',
  'Little Green Light',
  'DonorPerfect',
  'Blackbaud / Raiser\'s Edge',
  'Planning Center',
  'Breeze ChMS',
  'Church Community Builder',
  'Other',
  'No CRM — starting fresh',
] as const;

export default function SponsoredSetup() {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { tenant, refreshFlags } = useTenant();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('welcome');
  const [selectedRole, setSelectedRole] = useState<MinistryRole>('companion');
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name ?? '');
  const [selectedCrm, setSelectedCrm] = useState<string>('');
  const [migrationNotes, setMigrationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const canGoBack = stepIndex > 0;
  const canGoForward = step === 'welcome' ? true
    : step === 'role' ? !!selectedRole
    : step === 'migration' ? !!selectedCrm
    : displayName.trim().length >= 2;

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  };
  const goBack = () => {
    if (canGoBack) setStep(STEPS[stepIndex - 1]);
  };

  const handleFinish = async () => {
    if (!user || !tenant) return;
    setIsSubmitting(true);
    try {
      // 1. Save ministry role + display name
      await supabase
        .from('profiles')
        .update({
          ministry_role: selectedRole,
          display_name: displayName.trim(),
        } as any)
        .eq('user_id', user.id);

      // 2. Save migration context to tenant onboarding data
      await supabase
        .from('tenant_onboarding_state' as any)
        .update({
          completed: true,
          step: 'complete',
          data: {
            source_crm: selectedCrm,
            migration_notes: migrationNotes.trim() || null,
            setup_completed_at: new Date().toISOString(),
          },
        })
        .eq('tenant_id', tenant.id);

      await refreshFlags();
      toast.success(t('sponsoredSetup.toasts.welcome'));

      // Navigate based on role
      if (selectedRole === 'visitor') {
        navigate(`/${tenant.slug}/visits`, { replace: true });
      } else {
        navigate(`/${tenant.slug}/`, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sponsoredSetup.toasts.failed');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="sponsored-setup-root">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground font-serif">{t('sponsoredSetup.welcomeHeading')}</h1>
          <p className="text-muted-foreground">
            {t('sponsoredSetup.workspacePreparedFor')}{' '}
            <span className="text-foreground font-medium">{tenant?.name ?? t('sponsoredSetup.yourOrganization')}</span>.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                ${i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step: Welcome */}
        {step === 'welcome' && (
          <Card>
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="font-serif text-2xl">{t('sponsoredSetup.welcome.cardTitle')}</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                {t('sponsoredSetup.welcome.cardDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto text-sm text-muted-foreground">
                <div className="space-y-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <span className="text-primary font-semibold">1</span>
                  </div>
                  <p>{t('sponsoredSetup.steps.chooseRole')}</p>
                </div>
                <div className="space-y-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <span className="text-primary font-semibold">2</span>
                  </div>
                  <p>{t('sponsoredSetup.steps.currentTools')}</p>
                </div>
                <div className="space-y-1">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <span className="text-primary font-semibold">3</span>
                  </div>
                  <p>{t('sponsoredSetup.steps.setYourName')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Ministry Role */}
        {step === 'role' && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">{t('sponsoredSetup.role.cardTitle')}</CardTitle>
              <CardDescription>
                {t('sponsoredSetup.role.cardDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ROLES.map(({ key, label, icon: Icon, description }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedRole(key)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all
                      ${selectedRole === key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${selectedRole === key ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="font-medium text-sm text-foreground">{label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Migration Context */}
        {step === 'migration' && (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <ArrowRightLeft className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="font-serif">{t('sponsoredSetup.migration.cardTitle')}</CardTitle>
              <CardDescription>
                {t('sponsoredSetup.migration.cardDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('sponsoredSetup.migration.crmLabel')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CRM_OPTIONS.map((crm) => (
                    <button
                      key={crm}
                      onClick={() => setSelectedCrm(crm)}
                      className={`text-left px-3 py-2 rounded-md border text-sm transition-all
                        ${selectedCrm === crm
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/40'}`}
                    >
                      {crm}
                    </button>
                  ))}
                </div>
              </div>

              {selectedCrm && selectedCrm !== 'No CRM — starting fresh' && (
                <div className="space-y-2">
                  <Label htmlFor="migration-notes">
                    {t('sponsoredSetup.migration.notesLabel')}
                  </Label>
                  <Textarea
                    id="migration-notes"
                    value={migrationNotes}
                    onChange={(e) => setMigrationNotes(e.target.value)}
                    placeholder={t('sponsoredSetup.migration.notesPlaceholder')}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('sponsoredSetup.migration.notesHint')}
                  </p>
                </div>
              )}

              {selectedCrm === 'No CRM — starting fresh' && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <p>
                    {t('sponsoredSetup.migration.noCrmMessage')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Display Name */}
        {step === 'profile' && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">{t('sponsoredSetup.profile.cardTitle')}</CardTitle>
              <CardDescription>
                {t('sponsoredSetup.profile.cardDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">{t('sponsoredSetup.profile.displayNameLabel')}</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('sponsoredSetup.profile.displayNamePlaceholder')}
                  autoFocus
                />
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <p>
                  {t('sponsoredSetup.profile.summaryRole')} <span className="text-foreground font-medium">{tenant?.name}</span> {t('sponsoredSetup.profile.summaryAs')}{' '}
                  <span className="text-foreground font-medium capitalize">{selectedRole}</span>.
                  {selectedCrm && selectedCrm !== 'No CRM — starting fresh' && (
                    <> {t('sponsoredSetup.profile.bridgeTools')} <span className="text-foreground font-medium">{selectedCrm}</span> {t('sponsoredSetup.profile.bridgeToolsIncluded')}</>
                  )}
                  {' '}{t('sponsoredSetup.profile.changeAnytime')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={!canGoBack}
            className={!canGoBack ? 'invisible' : ''}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> {t('sponsoredSetup.nav.back')}
          </Button>

          {step === 'profile' ? (
            <Button onClick={handleFinish} disabled={!canGoForward || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('sponsoredSetup.nav.settingUp')}
                </>
              ) : (
                <>
                  {t('sponsoredSetup.nav.enterWorkspace')} <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canGoForward}>
              {t('sponsoredSetup.nav.continue')} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
