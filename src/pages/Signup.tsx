/**
 * Signup page — now redirects to invite-only message.
 *
 * WHAT: Shows a "contact your organization" message instead of a signup form.
 * WHERE: /signup (public route).
 * WHY: CROS is invite-only — accounts can only be created via steward invite links (/join?token=xxx).
 */
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight } from 'lucide-react';
import { brand } from '@/config/brand';
import { useTranslation } from 'react-i18next';

export default function Signup() {
  const { t } = useTranslation('common');
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('auth.signup.title')}</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            {t('auth.signup.subtitle', { appName: brand.appName })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <p className="text-sm text-foreground font-medium">{t('auth.signup.howToGetAccess')}</p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>{t('auth.signup.step1')}</li>
              <li>{t('auth.signup.step2')}</li>
              <li>{t('auth.signup.step3')}</li>
            </ol>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            {t('auth.signup.notOnPlatform', { appName: brand.appName })}{' '}
            <Link to="/contact" className="text-primary hover:underline">
              {t('auth.signup.getInTouch')}
            </Link>{' '}
            {t('auth.signup.toLearnHow')}
          </p>

          <Link to="/login" className="block">
            <Button variant="outline" className="w-full">
              {t('auth.signup.alreadyHaveAccount')}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
