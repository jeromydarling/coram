import { useMemo } from 'react';
import { useEmailCommunications, useSyncGmail } from '@/hooks/useEmailCommunications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Clock,
  ExternalLink,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// Decode HTML entities in email text
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Determine if email is sent or received based on gmail_message_id format
function getEmailDirection(gmailMessageId: string): 'sent' | 'received' {
  if (gmailMessageId.includes('-from-')) return 'received';
  return 'sent'; // Default to sent (includes -to- format and legacy)
}

interface ContactEmailsPanelProps {
  contactId: string;
  contactEmail?: string | null;
  className?: string;
}

export function ContactEmailsPanel({
  contactId,
  contactEmail,
  className
}: ContactEmailsPanelProps) {
  const { t } = useTranslation('relationships');
  const { data: emails, isLoading } = useEmailCommunications(contactId);
  const syncGmail = useSyncGmail();

  // Also get unmatched emails that might belong to this contact by email
  const { data: allEmails } = useEmailCommunications();

  const relevantEmails = useMemo(() => {
    if (!emails && !allEmails) return [];

    // Get matched emails for this contact
    const matched = emails || [];

    // Find unmatched emails that match this contact's email
    const unmatchedForContact = contactEmail && allEmails
      ? allEmails.filter(e =>
          !e.contact_id &&
          e.recipient_email.toLowerCase() === contactEmail.toLowerCase()
        )
      : [];

    // Combine and sort by date
    return [...matched, ...unmatchedForContact].sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
  }, [emails, allEmails, contactEmail]);

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Mail className="w-4 h-4" />
          {t('interactions.emails.title')}
        </h4>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 min-w-0 overflow-hidden", className)}>
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Mail className="w-4 h-4" />
          {t('interactions.emails.title')}
        </h4>

        <div className="ml-auto flex items-center gap-2">
          {relevantEmails.length > 0 && (
            <Badge variant="secondary">{relevantEmails.length}</Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => syncGmail.mutate()}
            disabled={syncGmail.isPending}
            title="Sync sent email history from Gmail"
          >
            {syncGmail.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {t('interactions.emails.syncGmail')}
          </Button>
        </div>
      </div>

      {relevantEmails.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t('interactions.emails.noEmails')}
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {relevantEmails.map((email) => {
            const direction = getEmailDirection(email.gmail_message_id);
            const isSent = direction === 'sent';

            // Extract the raw message ID for Gmail link (remove direction suffix)
            const rawMessageId = email.gmail_message_id.replace(/-(?:to|from)-.*$/, '');
            const gmailFolder = isSent ? 'sent' : 'inbox';

            return (
              <div
                key={email.id}
                className={cn(
                  "group flex items-start gap-3 p-3 rounded-lg transition-colors min-w-0",
                  isSent
                    ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-primary/30"
                    : "bg-accent/30 hover:bg-accent/50 border-l-2 border-accent"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  isSent ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                )}>
                  {isSent ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <Badge
                        variant={isSent ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0 shrink-0"
                      >
                        {isSent ? t('interactions.emails.sent') : t('interactions.emails.received')}
                      </Badge>
                      <p className="text-sm font-medium text-foreground truncate min-w-0" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {email.subject || t('interactions.emails.noSubject')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      asChild
                    >
                      <a
                        href={`https://mail.google.com/mail/u/0/#${gmailFolder}/${rawMessageId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  </div>

                  {email.snippet && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 break-words">
                      {decodeHtmlEntities(email.snippet)}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span title={format(new Date(email.sent_at), 'PPP p')}>
                      {formatDistanceToNow(new Date(email.sent_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
