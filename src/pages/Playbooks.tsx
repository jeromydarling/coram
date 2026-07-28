import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor, RichTextDisplay } from '@/components/ui/rich-text-editor';
import { UnsavedChangesDialog } from '@/components/modals/UnsavedChangesDialog';
import { usePlaybooks, usePlaybook, useCreatePlaybook, useUpdatePlaybook, useDeletePlaybook, PlaybookInput } from '@/hooks/usePlaybooks';
import { useMetros } from '@/hooks/useMetros';
import { useFormDirty } from '@/hooks/useUnsavedChanges';
import DOMPurify from 'dompurify';

// Make DOMPurify available globally for the RichTextDisplay component
if (typeof window !== 'undefined') {
  (window as any).DOMPurify = DOMPurify;
}
import { useAuth } from '@/contexts/AuthContext';
import { 
  Book, 
  Plus, 
  Search, 
  MapPin, 
  Target, 
  FileText, 
  Folder,
  Edit,
  Trash2,
  Eye,
  X,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'general', label: 'General', icon: Folder, description: 'Best practices and guides' },
  { value: 'metro', label: 'Metro', icon: MapPin, description: 'Region-specific playbooks' },
  { value: 'anchor_type', label: 'Anchor Type', icon: Target, description: 'By partner tier' },
  { value: 'grant_type', label: 'Grant Type', icon: FileText, description: 'Grant-specific guides' }
];

const ANCHOR_TIERS = ['Strategic', 'Standard', 'Pilot'];

export default function Playbooks() {
  const { t } = useTranslation('projects');
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const { isDirty, markDirty, reset: resetDirty } = useFormDirty();

  const { data: playbooks, isLoading } = usePlaybooks({
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    search: searchQuery || undefined
  });
  const { data: metros } = useMetros();
  const { data: selectedPlaybook } = usePlaybook(selectedPlaybookId);
  const createPlaybook = useCreatePlaybook();
  const updatePlaybook = useUpdatePlaybook();
  const deletePlaybook = useDeletePlaybook();

  const [formData, setFormData] = useState<PlaybookInput>({
    title: '',
    description: '',
    content: '',
    category: 'general',
    tags: [],
    metro_id: null,
    anchor_tier: null,
    grant_type: null,
    is_published: true
  });

  // Handle modal close with unsaved changes check
  const handleModalClose = (forceClose = false) => {
    if (isDirty && !forceClose) {
      setShowUnsavedDialog(true);
      return;
    }
    setIsCreateOpen(false);
    setIsEditOpen(false);
    resetDirty();
  };

  const handleDiscardChanges = () => {
    setShowUnsavedDialog(false);
    setIsCreateOpen(false);
    setIsEditOpen(false);
    resetDirty();
  };

  const handleCreate = () => {
    setFormData({
      title: '',
      description: '',
      content: '',
      category: 'general',
      tags: [],
      metro_id: null,
      anchor_tier: null,
      grant_type: null,
      is_published: true
    });
    setIsCreateOpen(true);
  };

  const handleEdit = (playbook: typeof selectedPlaybook) => {
    if (!playbook) return;
    setFormData({
      title: playbook.title,
      description: playbook.description || '',
      content: playbook.content,
      category: playbook.category,
      tags: playbook.tags || [],
      metro_id: playbook.metro_id,
      anchor_tier: playbook.anchor_tier,
      grant_type: playbook.grant_type,
      is_published: playbook.is_published
    });
    setSelectedPlaybookId(playbook.id);
    setIsEditOpen(true);
  };

  const handleView = (id: string) => {
    setSelectedPlaybookId(id);
    setIsViewOpen(true);
  };

  const handleSubmitCreate = async () => {
    await createPlaybook.mutateAsync(formData);
    setIsCreateOpen(false);
    resetDirty();
  };

  const handleSubmitEdit = async () => {
    if (!selectedPlaybookId) return;
    await updatePlaybook.mutateAsync({ id: selectedPlaybookId, ...formData });
    setIsEditOpen(false);
    resetDirty();
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('playbooks.deleteConfirm'))) {
      await deletePlaybook.mutateAsync(id);
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? <cat.icon className="w-4 h-4" /> : <Folder className="w-4 h-4" />;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'metro': return 'bg-blue-500/10 text-blue-600';
      case 'anchor_type': return 'bg-green-500/10 text-green-600';
      case 'grant_type': return 'bg-purple-500/10 text-purple-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const filteredPlaybooks = playbooks?.filter(p => 
    searchQuery === '' || 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout
      title={t('playbooks.title')}
      subtitle={t('playbooks.subtitle')}
      headerActions={
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('playbooks.newPlaybook')}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('playbooks.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all" className="gap-2">
              <Book className="w-4 h-4" />
              {t('playbooks.categoryTabs.all')}
            </TabsTrigger>
            {CATEGORIES.map(cat => (
              <TabsTrigger key={cat.value} value={cat.value} className="gap-2">
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : filteredPlaybooks?.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Book className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">{t('playbooks.empty.title')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? t('playbooks.empty.noResults') : t('playbooks.empty.noPlaybooks')}
                  </p>
                  <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('playbooks.empty.createButton')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlaybooks?.map(playbook => (
                  <Card 
                    key={playbook.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => handleView(playbook.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <Badge className={cn("gap-1", getCategoryColor(playbook.category))}>
                          {getCategoryIcon(playbook.category)}
                          {CATEGORIES.find(c => c.value === playbook.category)?.label || playbook.category}
                        </Badge>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); handleEdit(playbook); }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(playbook.id); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <CardTitle className="text-lg mt-2">{playbook.title}</CardTitle>
                      {playbook.description && (
                        <CardDescription className="line-clamp-2">{playbook.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {playbook.metros?.metro && (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="w-3 h-3 mr-1" />
                              {playbook.metros.metro}
                            </Badge>
                          )}
                          {playbook.anchor_tier && (
                            <Badge variant="outline" className="text-xs">
                              {playbook.anchor_tier}
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => { if (!open) handleModalClose(); }}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleModalClose();
          }}
        >
          <DialogHeader>
            <DialogTitle>{isEditOpen ? t('playbooks.dialog.editTitle') : t('playbooks.dialog.createTitle')}</DialogTitle>
            <DialogDescription>
              {isEditOpen ? t('playbooks.dialog.editDescription') : t('playbooks.dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t('playbooks.dialog.titleLabel')}</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => {
                    setFormData(f => ({ ...f, title: e.target.value }));
                    markDirty();
                  }}
                  placeholder={t('playbooks.dialog.titlePlaceholder')}
                />
              </div>

              <div className="col-span-2">
                <Label>{t('playbooks.dialog.descriptionLabel')}</Label>
                <Input
                  value={formData.description || ''}
                  onChange={(e) => {
                    setFormData(f => ({ ...f, description: e.target.value }));
                    markDirty();
                  }}
                  placeholder={t('playbooks.dialog.descriptionPlaceholder')}
                />
              </div>

              <div>
                <Label>{t('playbooks.dialog.categoryLabel')}</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => {
                    setFormData(f => ({ ...f, category: v as any }));
                    markDirty();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.category === 'metro' && (
                <div>
                  <Label>{t('playbooks.dialog.metroLabel')}</Label>
                  <Select
                    value={formData.metro_id || 'none'}
                    onValueChange={(v) => {
                      setFormData(f => ({ ...f, metro_id: v === 'none' ? null : v }));
                      markDirty();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('playbooks.dialog.metroPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('playbooks.dialog.noSpecificMetro')}</SelectItem>
                      {metros?.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.metro}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.category === 'anchor_type' && (
                <div>
                  <Label>{t('playbooks.dialog.anchorTierLabel')}</Label>
                  <Select
                    value={formData.anchor_tier || 'none'}
                    onValueChange={(v) => {
                      setFormData(f => ({ ...f, anchor_tier: v === 'none' ? null : v }));
                      markDirty();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('playbooks.dialog.tierPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('playbooks.dialog.allTiers')}</SelectItem>
                      {ANCHOR_TIERS.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="col-span-2">
                <Label>{t('playbooks.dialog.contentLabel')}</Label>
                <RichTextEditor
                  content={formData.content}
                  onChange={(content) => {
                    setFormData(f => ({ ...f, content }));
                    markDirty();
                  }}
                  placeholder={t('playbooks.dialog.contentPlaceholder')}
                  editorClassName="min-h-[200px]"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleModalClose()}>
              {t('playbooks.dialog.cancelButton')}
            </Button>
            <Button
              onClick={isEditOpen ? handleSubmitEdit : handleSubmitCreate}
              disabled={!formData.title || !formData.content || createPlaybook.isPending || updatePlaybook.isPending}
            >
              {isEditOpen ? t('playbooks.dialog.saveChanges') : t('playbooks.dialog.createButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onDiscard={handleDiscardChanges}
        onCancel={() => setShowUnsavedDialog(false)}
      />

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPlaybook ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={cn("gap-1", getCategoryColor(selectedPlaybook.category))}>
                    {getCategoryIcon(selectedPlaybook.category)}
                    {CATEGORIES.find(c => c.value === selectedPlaybook.category)?.label}
                  </Badge>
                  {selectedPlaybook.metros?.metro && (
                    <Badge variant="outline">
                      <MapPin className="w-3 h-3 mr-1" />
                      {selectedPlaybook.metros.metro}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-2xl">{selectedPlaybook.title}</DialogTitle>
                {selectedPlaybook.description && (
                  <DialogDescription className="text-base">{selectedPlaybook.description}</DialogDescription>
                )}
              </DialogHeader>
              
              <div className="py-4">
                <RichTextDisplay content={selectedPlaybook.content} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => handleEdit(selectedPlaybook)}>
                  <Edit className="w-4 h-4 mr-2" />
                  {t('playbooks.viewDialog.editButton')}
                </Button>
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>
                  {t('playbooks.viewDialog.closeButton')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-8 text-center">
              <Skeleton className="h-8 w-48 mx-auto mb-4" />
              <Skeleton className="h-4 w-64 mx-auto" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
