import { useState, useMemo, useEffect } from 'react';
import { savePendingCall } from '@/utils/pendingCallStorage';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useContacts } from '@/hooks/useContacts';
import { useMetros } from '@/hooks/useMetros';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useBulkUpdateContacts } from '@/hooks/useBulkUpdate';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';
import { useHouseholdCounts } from '@/hooks/useHouseholdCounts';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  User,
  Mail,
  Phone,
  Building2,
  Star,
  Loader2,
  Upload,
  Download,
  ArrowUpDown,
  Pencil,
  Trash2,
  Heart,
  Users
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import { FirstActionEmptyState } from '@/components/ui/first-action-empty-state';
import { BulkEditModal } from '@/components/modals/BulkEditModal';
import { CSVImportModal } from '@/components/import/CSVImportModal';
import { CampaignBanner } from '@/components/import/CampaignBanner';
import { useImportContacts } from '@/hooks/useCSVImport';
import { useCreateCampaignFromImport, type ImportedContactForCampaign } from '@/hooks/useCreateCampaignFromImport';
import { generateCSV, downloadCSV, contactFields, contactExportColumns } from '@/lib/csv';
import { CallModal } from '@/components/contacts/CallModal';
import { PaginationControls, usePagination } from '@/components/ui/pagination-controls';
import { useTenantNavigate } from '@/hooks/useTenantPath';

interface Person {
  id: string;
  contact_id: string;
  name: string;
  slug?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  opportunity_id?: string | null;
  is_primary?: boolean | null;
  notes?: string | null;
  updated_at?: string | null;
  opportunities?: {
    organization: string;
    slug?: string | null;
    metros?: { metro: string } | null;
  } | null;
}

type SortOrder = 'name-asc' | 'name-desc' | 'updated';

export default function People() {
  const { t } = useTranslation('relationships');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetro, setSelectedMetro] = useState<string>('all');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('updated');
  const { openContactModal } = useGlobalModal();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [callModalContact, setCallModalContact] = useState<Person | null>(null);
  const [pendingCampaignData, setPendingCampaignData] = useState<{ contacts: ImportedContactForCampaign[]; count: number } | null>(null);
  const navigate = useTenantNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const { data: people, isLoading } = useContacts();
  const { data: metros } = useMetros();

  // Batch-fetch household counts for visible contacts
  const allContactIds = useMemo(() => (people || []).map(p => p.id), [people]);
  const { data: householdCounts } = useHouseholdCounts(allContactIds);

  const importPeople = useImportContacts();
  const draftCampaign = useCreateCampaignFromImport();
  const bulkUpdatePeople = useBulkUpdateContacts();
  const bulkSelection = useBulkSelection<Person>();
  const { deleteRecords, isDeleting } = useDeleteWithUndo();

  // Sync URL params to filter state and handle deep-linking
  useEffect(() => {
    const orgParam = searchParams.get('org');
    const personSlug = searchParams.get('person');

    if (orgParam) {
      setOrganizationFilter(orgParam);
    }

    // Deep-link redirect to detail page
    if (personSlug) {
      navigate(`/people/${personSlug}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // Get unique organizations for filter
  const organizations = useMemo(() => {
    const orgs = new Set<string>();
    (people || []).forEach(p => {
      if (p.opportunities?.organization) {
        orgs.add(p.opportunities.organization);
      }
    });
    return Array.from(orgs).sort();
  }, [people]);

  // Helper to extract last name for sorting
  const getLastName = (name: string) => {
    const parts = name.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  };

  const filteredAndSortedPeople = useMemo(() => {
    let result = (people || []).filter(person =>
      person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (person.opportunities?.organization || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (person.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter by metro
    if (selectedMetro && selectedMetro !== 'all') {
      result = result.filter(p =>
        p.opportunities?.metros?.metro === selectedMetro
      );
    }

    // Filter by organization
    if (organizationFilter.trim()) {
      const orgSearch = organizationFilter.toLowerCase().trim();
      result = result.filter(p =>
        (p.opportunities?.organization || '').toLowerCase().includes(orgSearch)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortOrder) {
        case 'name-asc':
          return getLastName(a.name).localeCompare(getLastName(b.name));
        case 'name-desc':
          return getLastName(b.name).localeCompare(getLastName(a.name));
        case 'updated':
          const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bDate - aDate;
        default:
          return 0;
      }
    });

    return result;
  }, [people, searchQuery, selectedMetro, organizationFilter, sortOrder]);

  // Pagination
  const pagination = usePagination(filteredAndSortedPeople.length, 24);
  const paginatedPeople = useMemo(() => {
    return filteredAndSortedPeople.slice(pagination.startIndex, pagination.endIndex);
  }, [filteredAndSortedPeople, pagination.startIndex, pagination.endIndex]);

  // Reset pagination when filters change
  useEffect(() => {
    pagination.handlePageChange(1);
  }, [searchQuery, selectedMetro, organizationFilter, sortOrder]);

  const handleCardClick = (person: Person) => {
    navigate(`/people/${person.slug || person.id}`);
  };

  const handleAdd = () => {
    openContactModal(null);
  };


  const handleExport = () => {
    if (!people || people.length === 0) return;
    const exportData = people.map(p => ({
      name: p.name,
      organization: p.opportunities?.organization || '',
      stage: (p.opportunities as { stage?: string } | null)?.stage || '',
      metro: p.opportunities?.metros?.metro || '',
      partner_tiers: (p.opportunities as { partner_tiers?: string[] } | null)?.partner_tiers?.join(' | ') || '',
      mission_snapshot: (p.opportunities as { mission_snapshot?: string[] } | null)?.mission_snapshot?.join(' | ') || '',
      best_partnership_angle: (p.opportunities as { best_partnership_angle?: string[] } | null)?.best_partnership_angle?.join(' | ') || '',
      grant_alignment: (p.opportunities as { grant_alignment?: string[] } | null)?.grant_alignment?.join(' | ') || '',
      title: p.title || '',
      email: p.email || '',
      phone: p.phone || '',
      is_primary: p.is_primary,
      notes: p.notes || '',
    }));
    const csv = generateCSV(exportData, contactExportColumns as { key: keyof typeof exportData[number]; label: string }[]);
    downloadCSV(csv, `people-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleImport = async (data: Record<string, unknown>[]) => {
    await importPeople.mutateAsync(data);
    // Collect contacts with emails for campaign drafting
    const withEmails: ImportedContactForCampaign[] = data
      .filter(d => d.email && String(d.email).trim())
      .map(d => ({
        email: String(d.email).trim(),
        name: d.name ? String(d.name) : undefined,
        organization: d.organization ? String(d.organization) : undefined,
      }));
    if (withEmails.length > 0) {
      setPendingCampaignData({ contacts: withEmails, count: withEmails.length });
    }
  };

  const handleDraftCampaign = () => {
    if (!pendingCampaignData) return;
    draftCampaign.mutate(pendingCampaignData.contacts, {
      onSuccess: (campaign) => {
        setPendingCampaignData(null);
        navigate(`/outreach/campaigns/${(campaign as any).id}`);
      },
    });
  };

  return (
    <MainLayout
      title={t('people.title')}
      subtitle={t('people.subtitle')}
    >
      <div className="space-y-6">
        {/* Campaign Banner after import */}
        {pendingCampaignData && (
          <CampaignBanner
            emailCount={pendingCampaignData.count}
            onDraftCampaign={handleDraftCampaign}
            onDismiss={() => setPendingCampaignData(null)}
            isPending={draftCampaign.isPending}
          />
        )}
        {/* Header Actions */}
        <div className="flex flex-col gap-4">
          {/* Search and Add */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md" data-tour="people-search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('people.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="w-4 h-4" />
                {t('people.import')}
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" />
                {t('people.export')}
              </Button>
              <Button className="gap-2" onClick={handleAdd}>
                <Plus className="w-4 h-4" />
                {t('people.addPerson')}
              </Button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 items-center" data-tour="people-filters">
            {/* Select All Checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                checked={bulkSelection.isAllSelected(filteredAndSortedPeople)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    bulkSelection.selectAll(filteredAndSortedPeople);
                  } else {
                    bulkSelection.clearSelection();
                  }
                }}
              />
              <span className="text-sm text-muted-foreground">{t('people.selectAll')}</span>
            </div>

            {bulkSelection.selectedCount > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsBulkEditModalOpen(true)}
                >
                  <Pencil className="w-4 h-4" />
                  {t('people.edit', { count: bulkSelection.selectedCount })}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setIsBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('people.delete', { count: bulkSelection.selectedCount })}
                </Button>
              </>
            )}

            <div className="h-6 w-px bg-border mx-1" />

            <Select value={sortOrder} onValueChange={(val) => setSortOrder(val as SortOrder)}>
              <SelectTrigger className="w-[180px]">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('people.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">{t('people.sortNameAsc')}</SelectItem>
                <SelectItem value="name-desc">{t('people.sortNameDesc')}</SelectItem>
                <SelectItem value="updated">{t('people.sortRecentlyUpdated')}</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('people.filterByOrganization')}
                value={organizationFilter}
                onChange={(e) => setOrganizationFilter(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>

            <Select value={selectedMetro} onValueChange={setSelectedMetro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('people.allMetros')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('people.allMetros')}</SelectItem>
                {(metros || []).map(metro => (
                  <SelectItem key={metro.id} value={metro.metro}>
                    {metro.metro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(selectedMetro !== 'all' || sortOrder !== 'updated' || organizationFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedMetro('all');
                  setSortOrder('updated');
                  setOrganizationFilter('');
                  setSearchParams(new URLSearchParams());
                }}
                className="text-muted-foreground"
              >
                {t('people.resetFilters')}
              </Button>
            )}

            <span className="text-sm text-muted-foreground ml-auto">
              {filteredAndSortedPeople.length !== 1
                ? t('people.countPeople', { count: filteredAndSortedPeople.length })
                : t('people.countPerson', { count: filteredAndSortedPeople.length })}
            </span>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Pre-mortem #5: never leave a list page empty without a clear next action. */}
        {!isLoading && paginatedPeople.length === 0 && (
          <FirstActionEmptyState
            icon={User}
            title={t('people.emptyTitle', 'No people yet')}
            context={t('people.emptyContext', 'Add your first person to start tracking relationships and reflections.')}
            actionLabel={t('people.addPerson')}
            onAction={handleAdd}
          />
        )}

        {/* People Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-tour="people-list">
          {paginatedPeople.map((person, index) => (
            <div
              key={person.id}
              onClick={() => handleCardClick(person)}
              className={cn(
                'bg-card rounded-xl border border-border p-5 hover:shadow-card-hover transition-all duration-200 animate-fade-in group cursor-pointer relative',
                bulkSelection.isSelected(person.id) && 'ring-2 ring-primary',
                `stagger-${(index % 6) + 1}`
              )}
            >
              {/* Selection Checkbox */}
              <div
                className="absolute top-3 right-3 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={bulkSelection.isSelected(person.id)}
                  onCheckedChange={() => bulkSelection.toggle(person.id)}
                />
              </div>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {person.name}
                      </h3>
                      {person.is_primary && (
                        <Star className="w-4 h-4 fill-warning text-warning" />
                      )}
                      {(person as any).is_person_in_need && (
                        <Heart className="w-4 h-4 text-primary fill-primary/20" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{person.title}</p>
                  </div>
                </div>
              </div>

              {/* Organization */}
              {person.opportunities && (
              <div className="flex items-center gap-2 mb-4 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{person.opportunities.organization}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{person.opportunities.metros?.metro}</span>
              </div>
              )}

              {/* Household count */}
              {(householdCounts?.get(person.id) || 0) > 0 && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('people.household', { count: householdCounts?.get(person.id) })}</span>
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-2 pt-3 border-t border-border">
                {person.email && (
                  <a
                    href={`mailto:${person.email}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Mail className="w-4 h-4" />
                    <span>{person.email}</span>
                  </a>
                )}
                {person.phone && (
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      savePendingCall({
                        contactId: person.id,
                        contactName: person.name,
                        opportunityId: person.opportunity_id,
                      });
                      const a = document.createElement('a');
                      a.href = `tel:${person.phone}`;
                      a.click();
                      setTimeout(() => {
                        setCallModalContact(person);
                      }, 500);
                    }}
                  >
                    <Phone className="w-4 h-4" />
                    <span>{person.phone}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Controls */}
        {!isLoading && filteredAndSortedPeople.length > 0 && (
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={filteredAndSortedPeople.length}
            onPageChange={pagination.handlePageChange}
            onPageSizeChange={pagination.handlePageSizeChange}
          />
        )}

        {/* ContactModal is now rendered globally in App.tsx */}

        <CSVImportModal
          open={isImportModalOpen}
          onOpenChange={setIsImportModalOpen}
          title={t('people.importTitle')}
          fields={contactFields}
          onImport={handleImport}
          historyType="contacts"
        />

        <BulkEditModal
          open={isBulkEditModalOpen}
          onOpenChange={(open) => {
            setIsBulkEditModalOpen(open);
            if (!open) bulkSelection.clearSelection();
          }}
          selectedItems={bulkSelection.getSelectedItems(filteredAndSortedPeople)}
          entityType="contact"
          onBulkUpdate={async (ids, updates) => {
            await bulkUpdatePeople.mutateAsync({ ids, updates });
          }}
        />

        <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkSelection.selectedCount !== 1
                  ? t('people.deleteDialogTitle_other', { count: bulkSelection.selectedCount })
                  : t('people.deleteDialogTitle_one', { count: bulkSelection.selectedCount })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('people.deleteDialogDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('people.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const ids = Array.from(bulkSelection.selectedIds);
                  await deleteRecords(ids, 'contact');
                  bulkSelection.clearSelection();
                  setIsBulkDeleteDialogOpen(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting ? t('people.deleting') : t('people.deletePeople')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {callModalContact && (
          <CallModal
            open={!!callModalContact}
            onOpenChange={(open) => { if (!open) setCallModalContact(null); }}
            contactId={callModalContact.id}
            contactName={callModalContact.name}
            opportunityId={callModalContact.opportunity_id}
          />
        )}
      </div>
    </MainLayout>
  );
}
