import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ActivityEditModal } from './ActivityEditModal';
import { 
  Plus, 
  Phone, 
  Mail, 
  Video, 
  Calendar, 
  MapPin, 
  Users,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';

type ActivityType = Database['public']['Enums']['activity_type'];

const QUICK_ACTION_TYPES: { type: ActivityType; icon: React.ReactNode }[] = [
  { type: 'Call', icon: <Phone className="w-4 h-4" /> },
  { type: 'Email', icon: <Mail className="w-4 h-4" /> },
  { type: 'Meeting', icon: <Video className="w-4 h-4" /> },
  { type: 'Event', icon: <Calendar className="w-4 h-4" /> },
  { type: 'Site Visit', icon: <MapPin className="w-4 h-4" /> },
  { type: 'Intro', icon: <Users className="w-4 h-4" /> },
  { type: 'Other', icon: <Clock className="w-4 h-4" /> },
];

export function QuickLogFAB() {
  const { t } = useTranslation('activities');
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType>('Call');

  const handleQuickAction = (type: ActivityType) => {
    setSelectedType(type);
    setIsModalOpen(true);
    setIsOpen(false);
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className={cn(
              "fixed bottom-24 right-6 h-12 w-12 rounded-full shadow-lg",
              "bg-secondary hover:bg-secondary/90 text-secondary-foreground",
              "transition-transform hover:scale-105",
              "z-40 lg:hidden"
            )}
          >
            <Plus className={cn("h-5 w-5 transition-transform", isOpen && "rotate-45")} />
            <span className="sr-only">{t('buttons.logActivity')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          side="top" 
          align="end" 
          className="w-48 mb-2"
        >
          {QUICK_ACTION_TYPES.map((action) => (
            <DropdownMenuItem
              key={action.type}
              onClick={() => handleQuickAction(action.type)}
              className="gap-2 cursor-pointer"
            >
              {action.icon}
              {t('quickLog.logType', { type: action.type })}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ActivityEditModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        defaultType={selectedType}
      />
    </>
  );
}
