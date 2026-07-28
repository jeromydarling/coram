import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useContacts } from '@/hooks/useContacts';
import { useTranslation } from 'react-i18next';

interface Contact {
  id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  opportunities?: { organization: string } | null;
}

interface ContactSearchSelectProps {
  value: string | null;
  onChange: (contactId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ContactSearchSelect({
  value,
  onChange,
  placeholder,
  disabled = false,
}: ContactSearchSelectProps) {
  const { t } = useTranslation('relationships');
  const [open, setOpen] = useState(false);
  const { data: contacts, isLoading } = useContacts();

  const resolvedPlaceholder = placeholder ?? t('contacts.search.placeholder');

  const selectedContact = useMemo(() => {
    if (!value || !contacts) return null;
    return contacts.find((c) => c.id === value) || null;
  }, [value, contacts]);

  const handleSelect = (contactId: string) => {
    onChange(contactId === value ? null : contactId);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedContact ? (
            <div className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedContact.name}</span>
              {selectedContact.title && (
                <span className="text-muted-foreground text-xs truncate">
                  — {selectedContact.title}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{resolvedPlaceholder}</span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {selectedContact && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('contacts.search.searchInputPlaceholder')} />
          <CommandList>
            <CommandEmpty>
              {isLoading
                ? t('contacts.search.loading')
                : t('contacts.search.noContactsFound')}
            </CommandEmpty>
            <CommandGroup>
              {contacts?.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={`${contact.name} ${contact.email || ''} ${contact.opportunities?.organization || ''}`}
                  onSelect={() => handleSelect(contact.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === contact.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{contact.name}</span>
                      {contact.title && (
                        <span className="text-xs text-muted-foreground truncate">
                          {contact.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {contact.email && <span className="truncate">{contact.email}</span>}
                      {contact.opportunities?.organization && (
                        <>
                          {contact.email && <span>·</span>}
                          <span className="truncate">{contact.opportunities.organization}</span>
                        </>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
