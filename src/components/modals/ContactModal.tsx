import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateContact, useUpdateContact } from '@/hooks/useContacts';
import { useCreateOpportunity } from '@/hooks/useOpportunities';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useEvents } from '@/hooks/useEvents';
import { contactSchema, formatValidationErrors } from '@/lib/validations';
import { OCRScanButton } from '@/components/ai/OCRScanButton';
import { toast } from '@/components/ui/sonner';
import { z } from 'zod';
import { useContactDuplicateCheck } from '@/hooks/useContactDuplicateCheck';
import { useDirtyClose } from '@/hooks/useDirtyClose';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface Contact {
  id: string;
  contact_id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  opportunity_id?: string | null;
  is_primary?: boolean | null;
  notes?: string | null;
  met_at_event_id?: string | null;
}

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
}

interface FieldErrors {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export function ContactModal({ open, onOpenChange, contact }: ContactModalProps) {
  const dirtyGuard = useDirtyClose(onOpenChange);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [opportunityId, setOpportunityId] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');
  const [metAtEventId, setMetAtEventId] = useState<string>('');
  const [eventSearch, setEventSearch] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPersonInNeed, setIsPersonInNeed] = useState(false);
  const [hasFamily, setHasFamily] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<string[]>([]);
  const [newFamilyMember, setNewFamilyMember] = useState('');
  
  const { data: opportunities } = useOpportunities();
  const { data: events } = useEvents();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const createOpportunity = useCreateOpportunity();
  const { similarContacts, checkForDuplicates, clearDuplicates } = useContactDuplicateCheck();

  useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setTitle(contact.title || '');
      setEmail(contact.email || '');
      setPhone(contact.phone || '');
      setOpportunityId(contact.opportunity_id || '');
      setIsPrimary(contact.is_primary || false);
      setNotes(contact.notes || '');
      setMetAtEventId(contact.met_at_event_id || '');
      setIsPersonInNeed((contact as any).is_person_in_need || false);
      setHasFamily((contact as any).has_family || false);
      setFamilyMembers((contact as any).family_members ?? []);
    } else {
      resetForm();
    }
    setFieldErrors({});
  }, [contact, open]);

  const resetForm = () => {
    setName('');
    setTitle('');
    setEmail('');
    setPhone('');
    setOpportunityId('');
    setIsPrimary(false);
    setNotes('');
    setMetAtEventId('');
    setEventSearch('');
    setFieldErrors({});
    setIsPersonInNeed(false);
    setHasFamily(false);
    setFamilyMembers([]);
    setNewFamilyMember('');
    clearDuplicates();
  };

  const isEditMode = !!contact;

  // Check for duplicates on name blur (only for new contacts)
  const handleNameBlur = async () => {
    validateField('name', name);
    if (!isEditMode && name.trim().length >= 3) {
      await checkForDuplicates(name, email, contact?.id);
    }
  };

  const validateField = (fieldName: keyof FieldErrors, value: string) => {
    try {
      const fieldSchema = contactSchema.shape[fieldName as keyof typeof contactSchema.shape];
      if (fieldSchema) {
        fieldSchema.parse(value);
        setFieldErrors(prev => ({ ...prev, [fieldName]: undefined }));
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setFieldErrors(prev => ({ ...prev, [fieldName]: error.errors[0]?.message }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const formData = {
        name,
        title: title || undefined,
        email: email || undefined,
        phone: phone || undefined,
        opportunity_id: isPersonInNeed ? null : (opportunityId || null),
        is_primary: isPrimary,
        notes: notes || undefined,
        met_at_event_id: metAtEventId || null,
        person_type: isPersonInNeed ? 'community_member' : 'partner_contact',
        is_person_in_need: isPersonInNeed,
        has_family: hasFamily,
        family_members: hasFamily && familyMembers.length > 0 ? familyMembers : null,
      };

      // Validate all fields
      const validated = contactSchema.parse(formData);

      const familyPayload = {
        has_family: hasFamily,
        family_members: hasFamily && familyMembers.length > 0 ? familyMembers : null,
      };

      if (isEditMode && contact) {
        await updateContact.mutateAsync({
          id: contact.id,
          ...validated,
          opportunity_id: isPersonInNeed ? null : (validated.opportunity_id ?? null),
          met_at_event_id: metAtEventId || null,
          person_type: isPersonInNeed ? 'community_member' as any : 'partner_contact' as any,
          is_person_in_need: isPersonInNeed,
          ...familyPayload as any,
        });
      } else {
        const contactId = `CONT-${Date.now()}`;
        await createContact.mutateAsync({
          contact_id: contactId,
          name: validated.name,
          title: validated.title || undefined,
          email: validated.email || undefined,
          phone: validated.phone || undefined,
          opportunity_id: isPersonInNeed ? undefined : (validated.opportunity_id || undefined),
          is_primary: validated.is_primary,
          notes: validated.notes || undefined,
          met_at_event_id: metAtEventId || undefined,
          person_type: isPersonInNeed ? 'community_member' as any : 'partner_contact' as any,
          is_person_in_need: isPersonInNeed,
          ...familyPayload as any,
        });
      }
      
      resetForm();
      dirtyGuard.reset();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatValidationErrors(error);
        errors.forEach(err => toast.error(err));
        
        // Set field-level errors
        const newFieldErrors: FieldErrors = {};
        error.errors.forEach(err => {
          const field = err.path[0] as keyof FieldErrors;
          if (field && !newFieldErrors[field]) {
            newFieldErrors[field] = err.message;
          }
        });
        setFieldErrors(newFieldErrors);
      }
    }
  };

  const isPending = createContact.isPending || updateContact.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={dirtyGuard.handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]" onChange={dirtyGuard.markDirty}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEditMode ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
            <OCRScanButton
              onExtracted={async (data) => {
                if (data.suggested_name) setName(data.suggested_name);
                if (data.suggested_email) setEmail(data.suggested_email);
                if (data.suggested_phone) setPhone(data.suggested_phone);
                if (data.suggested_title) setTitle(data.suggested_title);
                
                // Auto-match or create organization (only if not already linked)
                if (data.suggested_organization && !opportunityId) {
                  const orgName = data.suggested_organization.trim();
                  const match = opportunities?.find(
                    (o) => o.organization.toLowerCase() === orgName.toLowerCase()
                  );
                  if (match) {
                    setOpportunityId(match.id);
                    toast.success(`Linked to existing org: ${match.organization}`);
                  } else if (!isEditMode) {
                    try {
                      const newOpp = await createOpportunity.mutateAsync({
                        opportunity_id: `OPP-${Date.now()}`,
                        organization: orgName,
                      });
                      setOpportunityId(newOpp.id);
                      toast.success(`Created new org: ${orgName}`);
                    } catch {
                      toast.error(`Could not create org: ${orgName}`);
                    }
                  }
                }
                
                toast.success(`Extracted contact (${Math.round((data.confidence_score || 0) * 100)}% confidence)`);
              }}
            />
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                maxLength={100}
                required
                placeholder="Full name"
                className={fieldErrors.name ? 'border-destructive' : ''}
                data-tour="contact-form-name"
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => validateField('title', title)}
                maxLength={100}
                placeholder="Job title"
                className={fieldErrors.title ? 'border-destructive' : ''}
              />
              {fieldErrors.title && (
                <p className="text-xs text-destructive">{fieldErrors.title}</p>
              )}
            </div>
          </div>

          {/* Duplicate Warning */}
          {similarContacts.length > 0 && !isEditMode && (
            <Alert variant="destructive" className="bg-warning/10 border-warning text-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription>
                <p className="font-medium text-sm mb-1">Possible duplicates found:</p>
                <ul className="text-xs space-y-1">
                  {similarContacts.slice(0, 3).map(c => (
                    <li key={c.id}>
                      <span className="font-medium">{c.name}</span>
                      {c.email && <span className="text-muted-foreground"> · {c.email}</span>}
                      {c.opportunities && <span className="text-muted-foreground"> · {(c.opportunities as any).organization}</span>}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => validateField('email', email)}
                maxLength={255}
                placeholder="email@example.com"
                className={fieldErrors.email ? 'border-destructive' : ''}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => validateField('phone', phone)}
                maxLength={30}
                placeholder="(555) 123-4567"
                className={fieldErrors.phone ? 'border-destructive' : ''}
              />
              {fieldErrors.phone && (
                <p className="text-xs text-destructive">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          {/* Person in Need toggle */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <Switch
              id="isPersonInNeed"
              checked={isPersonInNeed}
              onCheckedChange={setIsPersonInNeed}
            />
            <Label htmlFor="isPersonInNeed" className="text-sm cursor-pointer">
              This is a person in need
            </Label>
          </div>

          {/* Family toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border">
              <Switch
                id="hasFamily"
                checked={hasFamily}
                onCheckedChange={setHasFamily}
              />
              <Label htmlFor="hasFamily" className="text-sm cursor-pointer">
                This person represents a family
              </Label>
            </div>
            {hasFamily && (
              <div className="pl-4 space-y-2">
                <p className="text-xs text-muted-foreground">Family member names (optional)</p>
                {familyMembers.map((member, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{member}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => setFamilyMembers(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    value={newFamilyMember}
                    onChange={(e) => setNewFamilyMember(e.target.value)}
                    placeholder="Name"
                    className="text-sm h-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFamilyMember.trim()) {
                        e.preventDefault();
                        setFamilyMembers(prev => [...prev, newFamilyMember.trim()]);
                        setNewFamilyMember('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!newFamilyMember.trim()}
                    onClick={() => {
                      if (newFamilyMember.trim()) {
                        setFamilyMembers(prev => [...prev, newFamilyMember.trim()]);
                        setNewFamilyMember('');
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!isPersonInNeed && (
          <div className="space-y-2">
            <Label htmlFor="opportunity">Organization</Label>
            <Select value={opportunityId} onValueChange={setOpportunityId}>
              <SelectTrigger>
                <SelectValue placeholder="Link to opportunity (optional)" />
              </SelectTrigger>
              <SelectContent>
                {opportunities?.map((opp) => (
                  <SelectItem key={opp.id} value={opp.id}>
                    {opp.organization}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Met at Event */}
          <div className="space-y-2">
            <Label htmlFor="metAtEvent">Met at Event</Label>
            <Select value={metAtEventId} onValueChange={setMetAtEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Where did you meet this contact?" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Search events..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="mb-2"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {events
                  ?.filter(e => 
                    eventSearch === '' || 
                    e.event_name.toLowerCase().includes(eventSearch.toLowerCase())
                  )
                  .slice(0, 20)
                  .map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.event_name} ({new Date(event.event_date).toLocaleDateString()})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {metAtEventId && (
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="text-xs text-muted-foreground"
                onClick={() => setMetAtEventId('')}
              >
                Clear selection
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="isPrimary"
              checked={isPrimary}
              onCheckedChange={setIsPrimary}
            />
            <Label htmlFor="isPrimary">Primary Contact</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => validateField('notes', notes)}
              maxLength={2000}
              placeholder="Additional notes..."
              rows={3}
              className={fieldErrors.notes ? 'border-destructive' : ''}
            />
            {fieldErrors.notes && (
              <p className="text-xs text-destructive">{fieldErrors.notes}</p>
            )}
            <p className="text-xs text-muted-foreground">{notes.length}/2000</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => dirtyGuard.handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-tour="contact-form-submit">
              {isPending ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Contact')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog
      open={dirtyGuard.showPrompt}
      onDiscard={dirtyGuard.discard}
      onCancel={dirtyGuard.cancelPrompt}
    />
    </>
  );
}
