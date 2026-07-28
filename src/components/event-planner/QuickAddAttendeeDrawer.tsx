/**
 * Quick Add Attendee Drawer
 * 
 * Mobile-friendly drawer for fast attendee capture at conferences.
 * Opens from bottom on mobile, creates unmatched attendee records.
 */

import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Loader2 } from 'lucide-react';
import { useQuickAddAttendee } from '@/hooks/useEventAttendees';

interface QuickAddAttendeeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
}

export function QuickAddAttendeeDrawer({ 
  open, 
  onOpenChange, 
  eventId 
}: QuickAddAttendeeDrawerProps) {
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');

  const quickAdd = useQuickAddAttendee(eventId);

  // Reset form when drawer closes
  useEffect(() => {
    if (!open) {
      setFullName('');
      setOrganization('');
      setTitle('');
      setEmail('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) return;

    await quickAdd.mutateAsync({
      raw_full_name: fullName.trim(),
      raw_org: organization.trim() || null,
      raw_title: title.trim() || null,
      raw_email: email.trim() || null,
    });

    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit}>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Add Attendee
            </DrawerTitle>
            <DrawerDescription>
              Quickly capture someone you just met
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="px-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="e.g. Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
                autoComplete="off"
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                placeholder="e.g. City Housing Authority"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                autoComplete="off"
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Program Director"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoComplete="off"
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g. jane@example.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="text-base"
              />
            </div>
          </div>

          <DrawerFooter>
            <Button 
              type="submit" 
              disabled={!fullName.trim() || quickAdd.isPending}
              className="gap-2"
            >
              {quickAdd.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Add Attendee
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
