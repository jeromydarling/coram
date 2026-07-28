import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  useHouseholdMembers,
  useCreateHouseholdMember,
  useDeleteHouseholdMember,
} from '@/hooks/useHouseholdMembers';
import { ContactSearchSelect } from '@/components/contacts/ContactSearchSelect';
import { Users, Plus, Trash2, Link2, X, HelpCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';

interface HouseholdCardProps {
  contactId: string;
  contactName: string;
}

export function HouseholdCard({ contactId, contactName }: HouseholdCardProps) {
  const { t } = useTranslation(['relationships', 'common']);
  const { data: members = [], isLoading } = useHouseholdMembers(contactId);
  const createMember = useCreateHouseholdMember();
  const deleteMember = useDeleteHouseholdMember();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelationship, setNewRelationship] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [linkToExisting, setLinkToExisting] = useState(false);
  const [linkedContactId, setLinkedContactId] = useState<string | null>(null);

  const resetForm = () => {
    setNewName('');
    setNewRelationship('');
    setNewNotes('');
    setLinkToExisting(false);
    setLinkedContactId(null);
    setIsAdding(false);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createMember.mutateAsync({
      contact_id: contactId,
      name: newName.trim(),
      relationship: newRelationship.trim() || null,
      notes: newNotes.trim() || null,
      linked_contact_id: linkToExisting ? linkedContactId : null,
    });
    resetForm();
  };

  const handleDelete = (memberId: string) => {
    deleteMember.mutate({ id: memberId, contactId });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-serif">{t('relationships:contacts.household.title')}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px]">
                  <p className="text-xs">
                    <strong>{t('relationships:contacts.household.tooltipWhat')}</strong> {t('relationships:contacts.household.tooltipWhatText')}<br />
                    <strong>{t('relationships:contacts.household.tooltipWhere')}</strong> {t('relationships:contacts.household.tooltipWhereText')}<br />
                    <strong>{t('relationships:contacts.household.tooltipWhy')}</strong> {t('relationships:contacts.household.tooltipWhyText')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {!isAdding && (
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)} className="gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" />
              {t('relationships:contacts.household.add')}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Members list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('relationships:contacts.household.loading')}</p>
        ) : members.length === 0 && !isAdding ? (
          <p className="text-sm text-muted-foreground italic">
            {t('relationships:contacts.household.noMembers')}
          </p>
        ) : (
          members.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{m.name}</span>
                  {m.relationship && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {m.relationship}
                    </Badge>
                  )}
                  {m.linked_contact_id && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Link2 className="w-3 h-3" />
                      {t('relationships:contacts.household.linked')}
                    </Badge>
                  )}
                </div>
                {m.notes && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.notes}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(m.id)}
                disabled={deleteMember.isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}

        {/* Add form */}
        {isAdding && (
          <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="space-y-2">
              <Label className="text-xs">{t('relationships:contacts.household.fields.nameLabel')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('relationships:contacts.household.fields.namePlaceholder')}
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t('relationships:contacts.household.fields.relationshipLabel')}</Label>
              <Input
                value={newRelationship}
                onChange={(e) => setNewRelationship(e.target.value)}
                placeholder={t('relationships:contacts.household.fields.relationshipPlaceholder')}
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t('relationships:contacts.household.fields.notesLabel')}</Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder={t('relationships:contacts.household.fields.notesPlaceholder')}
                maxLength={300}
                rows={2}
              />
              <p className="text-xs text-muted-foreground text-right">{newNotes.length}/300</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="linkExisting"
                checked={linkToExisting}
                onCheckedChange={setLinkToExisting}
              />
              <Label htmlFor="linkExisting" className="text-xs cursor-pointer">
                {t('relationships:contacts.household.fields.linkToExisting')}
              </Label>
            </div>
            {linkToExisting && (
              <ContactSearchSelect
                value={linkedContactId}
                onChange={setLinkedContactId}
                placeholder={t('relationships:contacts.household.fields.searchExisting')}
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="w-3.5 h-3.5 mr-1" />
                {t('common:buttons.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newName.trim() || createMember.isPending}
              >
                {createMember.isPending
                  ? t('relationships:contacts.household.adding')
                  : t('relationships:contacts.household.addMember')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
