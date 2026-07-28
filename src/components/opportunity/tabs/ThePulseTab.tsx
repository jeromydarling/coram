import { OpportunitySignalsPanel } from '@/components/opportunity/OpportunitySignalsPanel';
import { DiscoveryBriefingPanel } from '@/components/discovery/DiscoveryBriefingPanel';
import { WatchlistCard } from '@/components/watchlist/WatchlistCard';
import { RecentSnapshotsPanel } from '@/components/watchlist/RecentSnapshotsPanel';
import { RecentChangesPanel } from '@/components/watchlist/RecentChangesPanel';
import { CampaignIntelligenceCard } from '@/components/insights/CampaignIntelligenceCard';

interface ThePulseTabProps {
  opportunity: any;
  isAdmin: boolean;
}

export function ThePulseTab({ opportunity, isAdmin }: ThePulseTabProps) {
  return (
    <div className="space-y-4">
      {/* Opportunity Signals */}
      <OpportunitySignalsPanel opportunityId={opportunity.id} />

      {/* Discovery Briefings */}
      <DiscoveryBriefingPanel opportunityId={opportunity.id} />

      {/* Watchlist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WatchlistCard 
          orgId={opportunity.id} 
          orgName={opportunity.organization} 
          websiteUrl={opportunity.website_url} 
        />
        <RecentSnapshotsPanel orgId={opportunity.id} />
        <RecentChangesPanel orgId={opportunity.id} />
      </div>

      {/* Campaign Intelligence */}
      <CampaignIntelligenceCard orgId={opportunity.id} />
    </div>
  );
}
