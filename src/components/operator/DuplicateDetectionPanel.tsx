/**
 * DuplicateDetectionPanel — Shows potential duplicate contacts.
 *
 * WHAT: Displays email and name duplicates for a tenant.
 * WHERE: Used in Operator Nexus and contacts page.
 * WHY: Duplicate records degrade relationship intelligence and reporting accuracy.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDuplicateDetection } from '@/hooks/useDuplicateDetection';
import { useTenant } from '@/contexts/TenantContext';
import { Users, CheckCircle2, AlertTriangle, Loader2, Mail, User } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';

export function DuplicateDetectionPanel() {
  const { tenantId } = useTenant();
  const { data: duplicates, isLoading } = useDuplicateDetection(tenantId ?? undefined);

  const emailDupes = duplicates?.filter((d) => d.match_type === 'email') ?? [];
  const nameDupes = duplicates?.filter((d) => d.match_type === 'name') ?? [];
  const totalDupes = (duplicates?.length ?? 0);
  const isClean = totalDupes === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Duplicate Detection
          <HelpTooltip
            what="Identifies people records that may be duplicates based on email or name."
            where="Data integrity panel"
            why="Duplicate records fragment relationship history and reduce insight accuracy."
          />
          {!isLoading && (
            isClean ? (
              <Badge variant="outline" className="ml-auto text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Clean
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-auto text-xs text-amber-600 border-amber-200">
                <AlertTriangle className="h-3 w-3 mr-1" /> {totalDupes} potential duplicate{totalDupes !== 1 ? 's' : ''}
              </Badge>
            )
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Scanning for duplicates…
          </div>
        ) : isClean ? (
          <p className="text-sm text-muted-foreground">No duplicate records detected.</p>
        ) : (
          <>
            {emailDupes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Email matches ({emailDupes.length})
                </div>
                {emailDupes.slice(0, 5).map((d, i) => (
                  <div key={i} className="text-xs text-muted-foreground pl-5">
                    <code className="text-xs">{d.match_value}</code> — {d.count} records
                    {d.names && <span className="ml-1">({d.names.filter(Boolean).join(', ')})</span>}
                  </div>
                ))}
                {emailDupes.length > 5 && (
                  <p className="text-xs text-muted-foreground pl-5">+{emailDupes.length - 5} more…</p>
                )}
              </div>
            )}
            {nameDupes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Name matches ({nameDupes.length})
                </div>
                {nameDupes.slice(0, 5).map((d, i) => (
                  <div key={i} className="text-xs text-muted-foreground pl-5">
                    <span className="capitalize">{d.match_value}</span> — {d.count} records
                    {d.emails && <span className="ml-1">({d.emails.filter(Boolean).join(', ')})</span>}
                  </div>
                ))}
                {nameDupes.length > 5 && (
                  <p className="text-xs text-muted-foreground pl-5">+{nameDupes.length - 5} more…</p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
