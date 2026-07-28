import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import { MainLayout } from '@/components/layout/MainLayout';
import { useEvents, useDuplicateEvent } from '@/hooks/useEvents';
import { useEventContactsCount } from '@/hooks/useEventContactsCount';
import { useMetros } from '@/hooks/useMetros';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';

import {
  Search, 
  Plus, 
  Users,
  Filter,
  Loader2,
  Upload,
  Download,
  Calendar,
  ArrowUpDown
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfToday } from 'date-fns';
import { EventModal } from '@/components/modals/EventModal';
import { EventCard } from '@/components/events/EventCard';
import { EventImportModal, EventImportData, ImportOptions } from '@/components/import/EventImportModal';
import { useImportEvents } from '@/hooks/useCSVImport';
import { generateCSV, downloadCSV, eventFields, eventExportColumns } from '@/lib/csv';
import { DateRange } from 'react-day-picker';
import { PaginationControls, usePagination } from '@/components/ui/pagination-controls';

type GrantNarrativeValue = 'High' | 'Medium' | 'Low';

interface Event {
  id: string;
  event_id: string;
  event_name: string;
  event_date: string;
  metro_id?: string | null;
  event_type: string | null;
  staff_deployed?: number | null;
  households_served?: number | null;
  anchor_identified_yn?: boolean | null;
  grant_narrative_value?: GrantNarrativeValue | null;
  notes?: string | null;
  metros?: { metro: string } | null;
}

export default function Events() {
  const { t } = useTranslation('events');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isOperatorRoute = pathname.startsWith('/operator');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [metroFilter, setMetroFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [hasContactsOnly, setHasContactsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>('upcoming');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  const { data: events, isLoading } = useEvents({ mineOnly: isOperatorRoute, allTenants: isOperatorRoute });
  const { data: contactsCounts } = useEventContactsCount();
  const { data: metros } = useMetros();
  const { enabled: metroEnabled } = useMetroIntelligence();

  const defaultMetroId = 'all';
  if (metroFilter === null) {
    setMetroFilter('all');
  }
  const importEvents = useImportEvents();

  useEffect(() => {
    const detailId = searchParams.get('detail');
    if (detailId) {
      navigate(tenantPath(`/events/${detailId}`), { replace: true });
    }
  }, [searchParams, navigate]);

  const eventsWithContacts = useMemo(() => {
    if (!events) return [];
    return events.map(event => {
      const stats = contactsCounts?.[event.id];
      return {
        ...event,
        contacts_made: stats?.count || 0,
        contacts_converted: stats?.withOpportunity || 0,
        conversion_rate: stats?.conversionRate || 0
      };
    });
  }, [events, contactsCounts]);

  const filteredEvents = useMemo(() => {
    let result = eventsWithContacts.filter(event => {
      const matchesSearch = event.event_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || event.event_type === typeFilter;
      const matchesMetro = !metroFilter || metroFilter === 'all' || event.metro_id === metroFilter;
      const matchesHasContacts = !hasContactsOnly || event.contacts_made > 0;
      
      let matchesDate = true;
      if (dateRange?.from && event.event_date) {
        const eventDate = parseISO(event.event_date);
        if (dateRange.to) {
          matchesDate = isWithinInterval(eventDate, { start: dateRange.from, end: dateRange.to });
        } else {
          matchesDate = eventDate >= dateRange.from;
        }
      }
      
      return matchesSearch && matchesType && matchesMetro && matchesDate && matchesHasContacts;
    });

    if (sortBy === 'contacts') {
      result = [...result].sort((a, b) => b.contacts_made - a.contacts_made);
    } else if (sortBy === 'upcoming') {
      const today = startOfToday();
      result = [...result].sort((a, b) => {
        const dateA = a.event_date ? parseISO(a.event_date) : new Date(0);
        const dateB = b.event_date ? parseISO(b.event_date) : new Date(0);
        const aIsFuture = dateA >= today;
        const bIsFuture = dateB >= today;
        
        if (aIsFuture && bIsFuture) {
          return dateA.getTime() - dateB.getTime();
        } else if (!aIsFuture && !bIsFuture) {
          return dateB.getTime() - dateA.getTime();
        } else {
          return aIsFuture ? -1 : 1;
        }
      });
    } else if (sortBy === 'date') {
      result = [...result].sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    }

    return result;
  }, [eventsWithContacts, searchQuery, typeFilter, metroFilter, dateRange, hasContactsOnly, sortBy]);

  const pagination = usePagination(filteredEvents.length, 24);
  const paginatedEvents = useMemo(() => {
    return filteredEvents.slice(pagination.startIndex, pagination.endIndex);
  }, [filteredEvents, pagination.startIndex, pagination.endIndex]);

  useEffect(() => {
    pagination.handlePageChange(1);
  }, [searchQuery, typeFilter, metroFilter, dateRange, hasContactsOnly, sortBy]);

  // Summary stats
  const totalAttended = filteredEvents.reduce((sum, e) => sum + (e.households_served || 0), 0);
  const totalStaff = filteredEvents.reduce((sum, e) => sum + (e.staff_deployed || 0), 0);

  const { tenantPath } = useTenantPath();

  const handleRowClick = (event: Event) => {
    navigate(isOperatorRoute ? `/operator/events/${event.id}` : tenantPath(`/events/${event.id}`));
  };

  const handleAdd = () => {
    setSelectedEvent(null);
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = (open: boolean) => {
    setIsEditModalOpen(open);
    if (!open) setSelectedEvent(null);
  };

  const handleExport = () => {
    if (!events || events.length === 0) return;
    const csv = generateCSV(events, eventExportColumns);
    downloadCSV(csv, `events-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleImport = async (data: EventImportData[], options: ImportOptions) => {
    await importEvents.mutateAsync({ events: data, options: { upsertMode: options.upsertMode } });
  };

  const innerContent = (
      <div className="space-y-6">
        {/* Search Bar + Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={t('page.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-lg"
            />
          </div>
          <div className="flex gap-2 justify-end" data-tour="events-create">
            <Button variant="outline" className="gap-2" onClick={() => setIsImportModalOpen(true)}>
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{t('page.import')}</span>
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('page.export')}</span>
            </Button>
            <Button className="gap-2" onClick={handleAdd}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('page.addEvent')}</span>
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex gap-3 flex-wrap" data-tour="events-filters">
          {metroEnabled && (
            <Select value={metroFilter || 'all'} onValueChange={setMetroFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t('page.allMetros')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('page.allMetros')}</SelectItem>
                {metros?.map((metro) => (
                  <SelectItem key={metro.id} value={metro.id}>
                    {metro.metro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t('page.filterByType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('page.allTypes')}</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 min-w-[200px] justify-start">
                <Calendar className="w-4 h-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <span>{format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}</span>
                  ) : (
                    <span>From {format(dateRange.from, 'MMM d, yyyy')}</span>
                  )
                ) : (
                  <span>{t('page.filterByDate')}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateRange(undefined)}
                >
                  {t('page.clearDates')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    const now = new Date();
                    setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
                  }}
                >
                  {t('page.thisMonth')}
                </Button>
              </div>
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t('page.sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">{t('page.upcomingFirst')}</SelectItem>
              <SelectItem value="date">{t('page.dateNewest')}</SelectItem>
              <SelectItem value="contacts">{t('page.contactsMade')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={hasContactsOnly ? "default" : "outline"}
            className="gap-2"
            onClick={() => setHasContactsOnly(!hasContactsOnly)}
          >
            <Users className="w-4 h-4" />
            {t('page.hasContacts')}
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">{t('page.totalEvents')}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{filteredEvents.length}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">{t('page.totalAttended')}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalAttended.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-warning" />
              <p className="text-sm text-muted-foreground">{t('page.totalStaff')}</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalStaff.toLocaleString()}</p>
          </div>
        </div>

        {/* Events Grid */}
        {!isLoading && filteredEvents.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {t('page.noEventsFound')}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-tour="events-list">
          {paginatedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => handleRowClick(event)}
              contactStats={contactsCounts?.[event.id]}
            />
          ))}
        </div>

        {/* Pagination Controls */}
        {!isLoading && filteredEvents.length > 0 && (
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={filteredEvents.length}
            onPageChange={pagination.handlePageChange}
            onPageSizeChange={pagination.handlePageSizeChange}
          />
        )}

        <EventModal 
          open={isEditModalOpen} 
          onOpenChange={handleEditModalClose}
          event={selectedEvent}
        />

        <EventImportModal
          open={isImportModalOpen}
          onOpenChange={setIsImportModalOpen}
          onImport={handleImport}
        />
      </div>
  );

  if (isOperatorRoute) {
    return <div data-testid="events-root">{innerContent}</div>;
  }

  return (
    <MainLayout
      title={t('page.title')}
      subtitle={t('page.subtitle')}
      helpKey="page.events"
      data-testid="events-root"
    >
      {innerContent}
    </MainLayout>
  );
}
