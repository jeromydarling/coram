import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Users, Calendar, GitBranch, FileText, Loader2, FileIcon, ClipboardList } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useGlobalSearch, SearchResult } from '@/hooks/useGlobalSearch';
import { Button } from '@/components/ui/button';

const typeIcons: Record<SearchResult['type'], typeof Building2> = {
  opportunity: Building2,
  contact: Users,
  event: Calendar,
  pipeline: GitBranch,
  grant: FileText,
  document: FileIcon,
  activity: ClipboardList,
};

const typeLabels: Record<SearchResult['type'], string> = {
  opportunity: 'Opportunities',
  contact: 'People',
  event: 'Events',
  pipeline: 'Pipeline',
  grant: 'Grants',
  document: 'Documents',
  activity: 'Activities',
};

export function GlobalSearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  
  const { data: results = [], isLoading } = useGlobalSearch(query);

  // Keyboard shortcut to open search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    navigate(result.route);
  };

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = [];
    acc[result.type].push(result);
    return acc;
  }, {} as Record<SearchResult['type'], SearchResult[]>);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-48 justify-start text-sm text-muted-foreground hidden lg:flex"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        Search...
        <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search opportunities, people, events, documents..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!isLoading && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!isLoading && query.length < 2 && (
            <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
          )}

          {Object.entries(groupedResults).map(([type, items]) => {
            const Icon = typeIcons[type as SearchResult['type']];
            return (
              <CommandGroup key={type} heading={typeLabels[type as SearchResult['type']]}>
                {items.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    value={`${result.title} ${result.subtitle}`}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
