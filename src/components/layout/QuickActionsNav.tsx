import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ActivityEditModal } from '@/components/activities/ActivityEditModal';
import { 
  Zap, 
  Phone, 
  Mail, 
  Video, 
  Calendar, 
  MapPin, 
  Users,
  Clock,
  Building2,
  UserPlus,
  CalendarPlus,
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';

type ActivityType = Database['public']['Enums']['activity_type'];

const ACTIVITY_ACTIONS: { type: ActivityType; label: string; icon: React.ReactNode }[] = [
  { type: 'Call', label: 'Log Call', icon: <Phone className="w-4 h-4" /> },
  { type: 'Email', label: 'Log Email', icon: <Mail className="w-4 h-4" /> },
  { type: 'Meeting', label: 'Log Meeting', icon: <Video className="w-4 h-4" /> },
  { type: 'Event', label: 'Log Event', icon: <Calendar className="w-4 h-4" /> },
  { type: 'Site Visit', label: 'Log Site Visit', icon: <MapPin className="w-4 h-4" /> },
  { type: 'Intro', label: 'Log Intro', icon: <Users className="w-4 h-4" /> },
  { type: 'Other', label: 'Log Other', icon: <Clock className="w-4 h-4" /> },
];

const QUICK_NAV_ITEMS = [
  { label: 'New Opportunity', icon: <Building2 className="w-4 h-4" />, path: '/opportunities', action: 'new-opportunity' },
  { label: 'New Contact', icon: <UserPlus className="w-4 h-4" />, path: '/contacts', action: 'new-contact' },
  { label: 'New Event', icon: <CalendarPlus className="w-4 h-4" />, path: '/events', action: 'new-event' },
];

export function QuickActionsNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType>('Call');
  const navigate = useNavigate();

  const handleActivityAction = (type: ActivityType) => {
    setSelectedType(type);
    setIsModalOpen(true);
    setIsOpen(false);
  };

  const handleQuickNav = (item: typeof QUICK_NAV_ITEMS[0]) => {
    // Navigate to the page with a query param to trigger the modal
    navigate(`${item.path}?action=${item.action}`);
    setIsOpen(false);
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            data-tour="quick-actions-button"
          >
            <Zap className="h-4 w-4" />
            <span className="sr-only">Quick Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-48"
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">Log Activity</DropdownMenuLabel>
          {ACTIVITY_ACTIONS.map((action) => (
            <DropdownMenuItem
              key={action.type}
              onClick={() => handleActivityAction(action.type)}
              className="gap-2 cursor-pointer"
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Quick Create</DropdownMenuLabel>
          {QUICK_NAV_ITEMS.map((item) => (
            <DropdownMenuItem
              key={item.action}
              onClick={() => handleQuickNav(item)}
              className="gap-2 cursor-pointer"
              data-tour={item.action === 'new-contact' ? 'quick-add-contact' : undefined}
            >
              {item.icon}
              {item.label}
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
