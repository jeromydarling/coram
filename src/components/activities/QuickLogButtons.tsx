import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActivityEditModal } from './ActivityEditModal';
import {
  Phone,
  MapPin,
  Mail,
  Video,
  Zap
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { useTranslation } from 'react-i18next';

type ActivityType = Database['public']['Enums']['activity_type'];

interface ActivityTemplate {
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  activityType: ActivityType;
  suggestedOutcome?: string;
  suggestedNextAction?: string;
}

const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  {
    id: 'discovery-call',
    labelKey: 'activities.discoveryCall',
    descriptionKey: 'activities.discoveryCallDesc',
    icon: <Phone className="w-4 h-4" />,
    activityType: 'Call',
    suggestedNextAction: 'Schedule follow-up meeting'
  },
  {
    id: 'site-visit',
    labelKey: 'activities.siteVisit',
    descriptionKey: 'activities.siteVisitDesc',
    icon: <MapPin className="w-4 h-4" />,
    activityType: 'Site Visit',
    suggestedNextAction: 'Send visit summary'
  },
  {
    id: 'follow-up-email',
    labelKey: 'activities.followUpEmail',
    descriptionKey: 'activities.followUpEmailDesc',
    icon: <Mail className="w-4 h-4" />,
    activityType: 'Email',
    suggestedNextAction: 'Schedule next touchpoint'
  },
  {
    id: 'partner-meeting',
    labelKey: 'activities.partnerMeeting',
    descriptionKey: 'activities.partnerMeetingDesc',
    icon: <Video className="w-4 h-4" />,
    activityType: 'Meeting',
    suggestedNextAction: 'Send meeting notes'
  }
];

interface QuickLogButtonsProps {
  onActivityLogged?: () => void;
}

export function QuickLogButtons({ onActivityLogged }: QuickLogButtonsProps) {
  const { t } = useTranslation('common');
  const [selectedTemplate, setSelectedTemplate] = useState<ActivityTemplate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTemplateClick = (template: ActivityTemplate) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedTemplate(null);
      onActivityLogged?.();
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-primary" />
            {t('activities.quickLogTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ACTIVITY_TEMPLATES.map((template) => (
            <Button
              key={template.id}
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 h-auto py-2"
              onClick={() => handleTemplateClick(template)}
            >
              <span className="text-primary">{template.icon}</span>
              <div className="flex flex-col items-start text-left">
                <span className="font-medium">{t(template.labelKey)}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {t(template.descriptionKey)}
                </span>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>

      <ActivityEditModal
        open={isModalOpen}
        onOpenChange={handleModalClose}
        defaultType={selectedTemplate?.activityType}
      />
    </>
  );
}
