import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface Requirement {
  label: string;
  met: boolean;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation('common');

  const { strength, requirements, label, color } = useMemo(() => {
    const reqs: Requirement[] = [
      { label: t('password.reqMinChars'), met: password.length >= 8 },
      { label: t('password.reqUppercase'), met: /[A-Z]/.test(password) },
      { label: t('password.reqLowercase'), met: /[a-z]/.test(password) },
      { label: t('password.reqNumber'), met: /\d/.test(password) },
      { label: t('password.reqSpecial'), met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];

    const metCount = reqs.filter(r => r.met).length;
    const strengthPercent = (metCount / reqs.length) * 100;

    let strengthLabel: string;
    let strengthColor: string;

    if (metCount === 0) {
      strengthLabel = '';
      strengthColor = 'bg-muted';
    } else if (metCount <= 2) {
      strengthLabel = t('password.weak');
      strengthColor = 'bg-destructive';
    } else if (metCount <= 3) {
      strengthLabel = t('password.fair');
      strengthColor = 'bg-orange-500';
    } else if (metCount <= 4) {
      strengthLabel = t('password.good');
      strengthColor = 'bg-yellow-500';
    } else {
      strengthLabel = t('password.strong');
      strengthColor = 'bg-green-500';
    }

    return {
      strength: strengthPercent,
      requirements: reqs,
      label: strengthLabel,
      color: strengthColor,
    };
  }, [password, t]);

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('password.strength')}</span>
          <span className={cn(
            "font-medium",
            label === t('password.weak') && "text-destructive",
            label === t('password.fair') && "text-orange-500",
            label === t('password.good') && "text-yellow-600",
            label === t('password.strong') && "text-green-600"
          )}>
            {label}
          </span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", color)}
            style={{ width: `${strength}%` }}
          />
        </div>
      </div>

      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li
            key={index}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              req.met ? "text-green-600" : "text-muted-foreground"
            )}
          >
            {req.met ? (
              <Check className="h-3 w-3" />
            ) : (
              <X className="h-3 w-3" />
            )}
            {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
