import { useState } from 'react';
import { savePendingCall } from '@/utils/pendingCallStorage';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantPath } from '@/hooks/useTenantPath';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone } from 'lucide-react';
import { SuggestedContactsPanel } from '@/components/contact-suggestions/SuggestedContactsPanel';
import { CallModal } from '@/components/contacts/CallModal';

interface ThePeopleTabProps {
  opportunity: any;
  opportunityContacts: any[];
  isAdmin: boolean;
}

export function ThePeopleTab({ opportunity, opportunityContacts, isAdmin }: ThePeopleTabProps) {
  const [callTarget, setCallTarget] = useState<{ id: string; name: string } | null>(null);
  const { tenantPath } = useTenantPath();

  // Derive primary contact: prefer the FK join, fall back to is_primary flag in contacts list
  const primaryContact = opportunity.primary_contact 
    ?? opportunityContacts.find((c: any) => c.is_primary) 
    ?? null;

  return (
    <div className="space-y-4">
      {/* Primary Contact */}
      {primaryContact && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Primary Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <Link 
              to={tenantPath(`/people/${primaryContact.slug || primaryContact.id}`)}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{primaryContact.name}</p>
                {primaryContact.title && (
                  <p className="text-sm text-muted-foreground">{primaryContact.title}</p>
                )}
              </div>
              <div className="flex gap-2">
                {primaryContact.email && (
                  <a 
                    href={`mailto:${primaryContact.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:text-primary/80"
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                {primaryContact.phone && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      savePendingCall({
                        contactId: primaryContact.id,
                        contactName: primaryContact.name,
                        opportunityId: opportunity.id,
                        metroId: opportunity.metro_id,
                      });
                      const a = document.createElement('a');
                      a.href = `tel:${primaryContact.phone}`;
                      a.click();
                      setTimeout(() => setCallTarget({ id: primaryContact.id, name: primaryContact.name }), 500);
                    }}
                    className="text-primary hover:text-primary/80"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* All People */}
      {opportunityContacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All People ({opportunityContacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {opportunityContacts.map((person: any) => (
                <Link 
                  key={person.id}
                  to={tenantPath(`/people/${person.slug || person.id}`)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{person.name}</span>
                  {person.is_primary && (
                    <Badge variant="outline" className="text-xs">Primary</Badge>
                  )}
                  {person.title && (
                    <span className="text-sm text-muted-foreground">{person.title}</span>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggested People */}
      <SuggestedContactsPanel entityType="opportunity" entityId={opportunity.id} />

      {callTarget && (
        <CallModal
          open={!!callTarget}
          onOpenChange={(open) => { if (!open) setCallTarget(null); }}
          contactId={callTarget.id}
          contactName={callTarget.name}
          opportunityId={opportunity.id}
          metroId={opportunity.metro_id}
        />
      )}
    </div>
  );
}
