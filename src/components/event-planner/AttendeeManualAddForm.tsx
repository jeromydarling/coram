import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import type { AttendeeImportRow } from '@/types/event-planner';

interface AttendeeManualAddFormProps {
  onAdd: (attendee: AttendeeImportRow) => void;
  isLoading?: boolean;
}

export function AttendeeManualAddForm({ onAdd, isLoading }: AttendeeManualAddFormProps) {
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onAdd({
      raw_full_name: name.trim(),
      raw_org: org.trim() || undefined,
      raw_title: title.trim() || undefined,
      raw_email: email.trim() || undefined,
      raw_phone: phone.trim() || undefined,
    });
    
    // Reset form
    setName('');
    setOrg('');
    setTitle('');
    setEmail('');
    setPhone('');
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org">Organization</Label>
          <Input
            id="org"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder="Organization"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Job title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
          />
        </div>
      </div>
      
      <Button type="submit" disabled={!name.trim() || isLoading} className="w-full gap-2">
        <Plus className="w-4 h-4" />
        Add Attendee
      </Button>
    </form>
  );
}
