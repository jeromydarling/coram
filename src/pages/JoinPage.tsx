/**
 * JoinPage — Invite-only signup flow.
 *
 * WHAT: Validates an invite token and allows the user to create an account.
 * WHERE: /join?token=xxx (public route, no auth required).
 * WHY: CROS is invite-only — only stewards can grant access to their organization.
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Eye, EyeOff, Users } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { lovable } from '@/integrations/lovable';
import { brand } from '@/config/brand';
import { useTranslation } from 'react-i18next';

interface InviteInfo {
  valid: boolean;
  reason?: string;
  invite_id?: string;
  tenant_id?: string;
  tenant_name?: string;
  email?: string;
  ministry_role?: string;
}

export default function JoinPage() {
  const { t } = useTranslation('common');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, signUp } = useAuth();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteInfo({ valid: false, reason: 'no_token' });
      setLoading(false);
      return;
    }

    const validate = async () => {
      const { data, error } = await supabase.rpc('validate_invite_token', { p_token: token });
      if (error || !data) {
        setInviteInfo({ valid: false, reason: 'error' });
      } else {
        setInviteInfo(data as unknown as InviteInfo);
      }
      setLoading(false);
    };
    validate();
  }, [token]);

  // If user is already logged in and has a valid token, try to accept
  useEffect(() => {
    if (user && token && inviteInfo?.valid) {
      const accept = async () => {
        const { data } = await supabase.rpc('accept_invite', { p_token: token, p_user_id: user.id });
        if ((data as any)?.ok) {
          navigate('/', { replace: true });
        }
      };
      accept();
    }
  }, [user, token, inviteInfo, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('auth.join.passwordMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.join.passwordTooShort'));
      return;
    }

    setIsSubmitting(true);

    // Sign up with the invited email
    const { error: signUpError } = await signUp(
      inviteInfo!.email!,
      password,
      displayName,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );

    if (signUpError) {
      // Handle "already registered" gracefully
      if (signUpError.message?.toLowerCase().includes('already registered') || signUpError.message?.toLowerCase().includes('already been registered')) {
        setError(t('auth.join.alreadyRegisteredError'));
        // Still store token so login flow picks it up
        localStorage.setItem('cros_invite_token', token!);
      } else {
        setError(signUpError.message);
      }
      setIsSubmitting(false);
    } else {
      // Store token in localStorage so we can accept after email verification
      localStorage.setItem('cros_invite_token', token!);
      setSuccess(true);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No token or invalid
  if (!inviteInfo?.valid) {
    const message = {
      no_token: t('auth.join.noToken'),
      not_found: t('auth.join.notFound'),
      revoked: t('auth.join.revoked'),
      already_used: t('auth.join.alreadyUsed'),
      expired: t('auth.join.expired'),
      error: t('auth.join.error'),
    }[inviteInfo?.reason || 'error'] || t('auth.join.invalid');

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">{t('auth.join.inviteRequired')}</CardTitle>
            <CardDescription className="text-base">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('auth.join.inviteOnly', { appName: brand.appName })}
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                {t('auth.join.alreadySignedIn')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleLabel = {
    shepherd: t('auth.join.roleShepherd'),
    companion: t('auth.join.roleCompanion'),
    visitor: t('auth.join.roleVisitor'),
  }[inviteInfo.ministry_role || 'visitor'] || inviteInfo.ministry_role;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">CR</span>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{t('auth.join.title')}</CardTitle>
          <CardDescription className="text-center">
            {t('auth.join.subtitle', { tenantName: inviteInfo.tenant_name, appName: brand.appName, role: roleLabel })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success ? (
            <Alert className="border-primary/50 bg-primary/10 text-foreground">
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertDescription>
                {t('auth.join.accountCreated')}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <p>{t('auth.join.invitedEmail')} <strong className="text-foreground">{inviteInfo.email}</strong></p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t('auth.join.yourName')}</Label>
                  <Input
                    id="displayName"
                    placeholder={t('auth.join.yourNamePlaceholder')}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.join.passwordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  <PasswordStrengthIndicator password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('auth.join.confirmPasswordLabel')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('auth.join.createAccountButton')}
                </Button>
              </form>
            </>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            {t('auth.join.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline">{t('auth.join.signIn')}</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
