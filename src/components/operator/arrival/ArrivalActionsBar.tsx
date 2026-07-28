/**
 * ArrivalActionsBar — Quick operator actions for a new tenant arrival.
 *
 * WHAT: Action buttons for impersonation, activation, QA, migration, and welcome.
 * WHERE: /operator/nexus/arrival
 * WHY: Reduces friction between seeing a signal and taking stewardship action.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Eye, Sparkles, ShieldCheck, Plug, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ArrivalActionsBarProps {
  tenantId: string;
  tenantSlug: string;
}

export function ArrivalActionsBar({ tenantId, tenantSlug }: ArrivalActionsBarProps) {
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-serif">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/operator/tenants/${tenantId}`}>
                <Eye className="w-4 h-4 mr-1" /> View Tenant
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/operator/nexus/activation">
                <Sparkles className="w-4 h-4 mr-1" /> Open Activation
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/operator/nexus/qa">
                <ShieldCheck className="w-4 h-4 mr-1" /> QA Monitoring
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/operator/nexus/migrations">
                <Plug className="w-4 h-4 mr-1" /> Migration Harness
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWelcomeOpen(true)}>
              <MessageCircle className="w-4 h-4 mr-1" /> Send Welcome
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={welcomeOpen} onOpenChange={setWelcomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Send Welcome Message</DialogTitle>
            <DialogDescription>
              This feature will allow you to send a warm welcome to the new organization. 
              Coming soon — for now, reach out personally.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
