import { useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { Button } from '@/components/ui/button';
import type { WeeklyPlanItem, CTAAction } from '@/types/weekly-plan';
import { 
  ExternalLink, 
  ClipboardList, 
  FileText, 
  Building2, 
  Calendar, 
  GitBranch,
  Inbox
} from 'lucide-react';

interface FocusPlanItemCTAProps {
  item: WeeklyPlanItem;
  planId: string;
}

const CTA_CONFIG: Record<CTAAction, { icon: typeof ExternalLink; label?: string }> = {
  open_bundle_panel: { icon: Inbox, label: 'Review' },
  log_activity: { icon: ClipboardList, label: 'Log Activity' },
  update_opportunity: { icon: Building2, label: 'Open' },
  review_grant: { icon: FileText, label: 'Review' },
  open_anchor: { icon: Building2, label: 'View Anchor' },
  open_pipeline: { icon: GitBranch, label: 'View Pipeline' },
  open_event: { icon: Calendar, label: 'View Event' },
  schedule_followup: { icon: Calendar, label: 'Schedule' },
};

export function FocusPlanItemCTA({ item }: FocusPlanItemCTAProps) {
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();
  
  const handleCTA = () => {
    const { action, filter } = item.primary_cta;
    const entityId = filter?.id || item.linked_entity.id;
    
    switch (action) {
      case 'update_opportunity':
        navigate(tenantPath(`/opportunities?selected=${entityId}`));
        break;
      case 'review_grant':
        navigate(tenantPath(`/grants?selected=${entityId}`));
        break;
      case 'open_anchor':
        navigate(tenantPath(`/anchors?selected=${entityId}`));
        break;
      case 'open_pipeline':
        navigate(tenantPath(`/pipeline?selected=${entityId}`));
        break;
      case 'open_event':
        navigate(tenantPath(`/events?selected=${entityId}`));
        break;
      case 'open_bundle_panel':
        navigate(tenantPath('/settings?tab=ai'));
        break;
      case 'log_activity':
        // Navigate to activities page with entity preselected
        navigate(`/activities?opportunity=${entityId}`);
        break;
      case 'schedule_followup':
        // Navigate to calendar
        navigate('/calendar');
        break;
      default:
        // Fallback to entity type routing
        navigate(`/${item.linked_entity.type}s?selected=${entityId}`);
    }
  };
  
  const config = CTA_CONFIG[item.primary_cta.action] || { icon: ExternalLink };
  const Icon = config.icon;
  const label = item.primary_cta.label || config.label || 'Open';
  
  return (
    <Button
      size="sm"
      onClick={handleCTA}
      className="gap-1"
    >
      <Icon className="w-3 h-3" />
      {label}
    </Button>
  );
}
