import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { lovable } from '@/integrations/lovable';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { t } = useTranslation('common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const { signIn, user, isLoading: authLoading, isAdmin } = useAuth();
  const { tenant, isLoading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const checkoutSuccess = searchParams.get('checkout') === 'success';
  const hasStripeSessionId = !!searchParams.get('session_id');
  const removedReason = searchParams.get('reason') === 'removed';

  /**
   * Resolve the post-login destination.
   * - If there's an explicit `from` path that isn't bare `/` or `/dashboard`, honour it.
   * - Admins/gardeners default to `/operator`.
   * - Everyone else goes to their tenant workspace.
   */
  const resolveDestination = () => {
    // If the user was trying to reach a specific page, honour it
    if (from && from !== '/' && from !== '/dashboard') return from;
    // Admins go to the operator console
    if (isAdmin) return '/operator';
    // Everyone else goes to tenant workspace
    if (tenant?.slug) return `/${tenant.slug}/`;
    // Fallback while tenant loads (LegacyPathRedirect will catch this)
    return '/dashboard';
  };

  // Checkout returns (and free companion signups) should never park on login — continue directly into onboarding.
  const isCompanionFree = searchParams.get('tier') === 'companion_free';
  useEffect(() => {
    if (authLoading) return;
    if (!user && (checkoutSuccess || hasStripeSessionId)) {
      navigate('/onboarding?checkout=success', { replace: true });
    }
    if (!user && isCompanionFree) {
      navigate('/onboarding?tier=companion_free', { replace: true });
    }
  }, [authLoading, user, checkoutSuccess, hasStripeSessionId, isCompanionFree, navigate]);

  // Accept pending invite token after login; then redirect
  useEffect(() => {
    if (authLoading || tenantLoading) return;
    if (!user) return;

    const dest = resolveDestination();

    const pendingToken = localStorage.getItem('cros_invite_token');
    if (pendingToken) {
      localStorage.removeItem('cros_invite_token');
      supabase.rpc('accept_invite', { p_token: pendingToken, p_user_id: user.id }).then(() => {
        navigate(dest, { replace: true });
      });
    } else {
      navigate(dest, { replace: true });
    }
  }, [authLoading, tenantLoading, user, isAdmin, tenant, from, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: signInError } = await signIn(email, password);
    
    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
    } else {
      // The useEffect will handle redirect once auth + tenant load
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/login`,
      });

      if (result.error) {
        // Check for domain restriction error
        const errorMessage = result.error.message || t('auth.login.googleFailed');
        setError(errorMessage);
        setIsGoogleLoading(false);
      }
      // If redirected or successful, page will reload with new session
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login.googleFailed'));
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">CR</span>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{t('auth.login.title')}</CardTitle>
          <CardDescription className="text-center">
            {t('auth.login.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {removedReason && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                {t('auth.login.removedAlert')}
              </AlertDescription>
            </Alert>
          )}

          {checkoutSuccess && (
            <Alert className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                {t('auth.login.checkoutSuccess')}
              </AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive" data-testid="login-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {t('auth.login.signInWithGoogle')}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">{t('auth.login.orDivider')}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.login.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.login.passwordLabel')}</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading} data-testid="login-submit">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.login.signInButton')}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground text-center w-full">
            {t('auth.login.noAccount')}{' '}
            <span className="text-foreground">
              {t('auth.login.contactSteward')}
            </span>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
