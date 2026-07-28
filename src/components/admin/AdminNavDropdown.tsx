import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Users, 
  Globe, 
  Tag, 
  FileText, 
  FileStack,
  Newspaper, 
  Target, 
  Handshake, 
  MessageSquarePlus, 
  Clock,
  Heart,
  ChevronDown,
  Activity,
  Brain,
  Radar,
  Workflow,
  CreditCard,
} from 'lucide-react';

interface AdminSection {
  id: string;
  label: string;
  icon: React.ElementType;
}

const adminSections: AdminSection[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'regions-metros', label: 'Regions & Metros', icon: Globe },
  { id: 'sectors', label: 'Sectors', icon: Tag },
  { id: 'grant-alignments', label: 'Grant Alignments', icon: FileText },
  { id: 'grant-types', label: 'Grant Types', icon: FileStack },
  { id: 'mission-snapshots', label: 'Mission Snapshots', icon: Target },
  { id: 'partnership-angles', label: 'Partnership Angles', icon: Handshake },
  { id: 'ai-knowledge-base', label: 'Knowledge Base', icon: Brain },
  { id: 'feedback', label: 'Feedback', icon: MessageSquarePlus },
  { id: 'activity', label: 'Activity History', icon: Clock },
  { id: 'community-health', label: 'Community Health', icon: Heart },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
];

const adminLinks: { id: string; label: string; icon: React.ElementType; path: string }[] = [];

interface AdminNavDropdownProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

export function AdminNavDropdown({ activeSection, onSectionChange }: AdminNavDropdownProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const activeItem = adminSections.find(s => s.id === activeSection);
  const ActiveIcon = activeItem?.icon || Users;

  const handleSectionClick = (sectionId: string) => {
    setOpen(false);
    setTimeout(() => {
      onSectionChange(sectionId);
    }, 100);
  };

  const handleLinkClick = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ActiveIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{activeItem?.label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-56 bg-popover border shadow-lg z-50"
      >
        {adminSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <DropdownMenuItem
              key={section.id}
              onClick={() => handleSectionClick(section.id)}
              className={isActive ? 'bg-primary/10 text-primary' : ''}
            >
              <Icon className="h-4 w-4 mr-2" />
              {section.label}
            </DropdownMenuItem>
          );
        })}
        
        {adminLinks.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {adminLinks.map((link) => {
              const Icon = link.icon;
              return (
                <DropdownMenuItem
                  key={link.id}
                  onClick={() => handleLinkClick(link.path)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {link.label}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { adminSections };
