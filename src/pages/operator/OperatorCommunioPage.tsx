/**
 * OperatorCommunioPage — Communio governance view.
 *
 * WHAT: Communio network health + governance flags + caregiver network moderation.
 * WHERE: /operator/communio
 * WHY: Operators review sharing governance without accessing private data.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommunioHealthTab } from '@/components/operator/CommunioHealthTab';
import { GovernancePanel } from '@/components/operator/GovernancePanel';
import CaregiverNetworkModerationTab from '@/components/operator/CaregiverNetworkModerationTab';
import { Shield, ShieldCheck, Heart } from 'lucide-react';

export default function OperatorCommunioPage() {
  return (
    <div className="space-y-4" data-testid="communio-root">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Communio</h1>
        <p className="text-sm text-muted-foreground">Cross-tenant sharing governance, network health, and caregiver network moderation.</p>
      </div>
      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health" className="gap-1.5">
            <Shield className="h-4 w-4" /> Network Health
          </TabsTrigger>
          <TabsTrigger value="governance" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Governance
          </TabsTrigger>
          <TabsTrigger value="caregiver" className="gap-1.5">
            <Heart className="h-4 w-4" /> Caregiver Network
          </TabsTrigger>
        </TabsList>
        <TabsContent value="health" className="mt-4">
          <CommunioHealthTab />
        </TabsContent>
        <TabsContent value="governance" className="mt-4">
          <GovernancePanel />
        </TabsContent>
        <TabsContent value="caregiver" className="mt-4">
          <CaregiverNetworkModerationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
