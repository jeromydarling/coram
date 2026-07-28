import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  FolderOpen, 
  BookOpen, 
  Shield, 
  Keyboard,
  ChevronDown,
  Layers,
  RotateCcw
} from 'lucide-react';

interface HelpSection {
  id: string;
  label: string;
  icon: React.ElementType;
}

const helpSectionsMeta: Omit<HelpSection, 'label'>[] = [
  { id: 'documents', icon: FolderOpen },
  { id: 'overview', icon: Layers },
  { id: 'app-sections', icon: BookOpen },
  { id: 'roles', icon: Shield },
  { id: 'restoration', icon: RotateCcw },
  { id: 'shortcuts', icon: Keyboard },
  { id: 'adoption', icon: BookOpen },
];

interface HelpNavDropdownProps {
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}

export function HelpNavDropdown({ activeSection, onSectionClick }: HelpNavDropdownProps) {
  const { t } = useTranslation('help');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { tenant } = useTenant();

  const helpSections: HelpSection[] = helpSectionsMeta.map(s => ({
    ...s,
    label: t(`helpNav.sections.${s.id}`),
  }));

  const activeItem = helpSections.find(s => s.id === activeSection);
  const ActiveIcon = activeItem?.icon || FolderOpen;

  const handleSectionClick = (sectionId: string) => {
    setOpen(false);
    if (sectionId === 'adoption') {
      navigate(`/${tenant?.slug ?? ''}/help/adoption`);
      return;
    }
    setTimeout(() => {
      onSectionClick(sectionId);
    }, 100);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ActiveIcon className="h-4 w-4" />
          <span className="text-sm">{activeItem?.label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-48 bg-popover border shadow-lg z-50"
      >
        {helpSections.map((section) => {
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Exported for consumers that only need section ids (labels are resolved via t() inside the component)
const helpSections: HelpSection[] = helpSectionsMeta.map(s => ({ ...s, label: s.id }));
export { helpSections };
