/**
 * AuthorityShareCard — Quiet sharing prompt for authority pages.
 *
 * WHAT: A gentle card encouraging relational sharing of authority content.
 * WHERE: Bottom of /authority pages.
 * WHY: Human-centered growth — no popups, no urgency, just an invitation.
 */
import { useState } from 'react';
import { Link2, Mail, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface AuthorityShareCardProps {
  /** The URL path to share, e.g. /authority/weeks */
  path: string;
  /** Optional custom title for the share email subject */
  title?: string;
}

export default function AuthorityShareCard({ path, title }: AuthorityShareCardProps) {
  const { t } = useTranslation('marketing');
  const [copied, setCopied] = useState(false);

  const fullUrl = `${window.location.origin}${path}`;
  const subject = encodeURIComponent(title || t('authorityShareCard.defaultEmailSubject'));
  const body = encodeURIComponent(`I thought you might appreciate this:\n\n${fullUrl}\n\nIt's a quiet reflection on how teams walk together.`);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success(t('authorityShareCard.toastCopied'));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(t('authorityShareCard.toastError'));
    }
  };

  return (
    <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl p-6 sm:p-8 text-center">
      <h3
        className="text-base sm:text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-2"
        style={serif}
      >
        {t('authorityShareCard.heading')}
      </h3>
      <p
        className="text-sm text-[hsl(var(--marketing-navy)/0.55)] mb-5 max-w-md mx-auto leading-relaxed"
        style={serif}
      >
        {t('authorityShareCard.body')}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5 text-xs rounded-full border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-navy)/0.7)] hover:text-[hsl(var(--marketing-navy))]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          {copied ? t('authorityShareCard.copied') : t('authorityShareCard.copyLink')}
        </Button>
        <a href={`mailto:?subject=${subject}&body=${body}`}>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs rounded-full border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-navy)/0.7)] hover:text-[hsl(var(--marketing-navy))]"
          >
            <Mail className="h-3.5 w-3.5" /> {t('authorityShareCard.shareByEmail')}
          </Button>
        </a>
      </div>
    </div>
  );
}
