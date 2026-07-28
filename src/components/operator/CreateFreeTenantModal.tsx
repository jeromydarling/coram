/**
 * CreateFreeTenantModal — Operator-only modal to create a free (operator-granted) tenant.
 *
 * WHAT: Form dialog for creating sponsored research/QA tenant accounts.
 * WHERE: /operator/tenants
 * WHY: Operator needs to provision free accounts without Stripe billing.
 */
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  organization_name: z.string().min(2, 'Name required'),
  slug: z
    .string()
    .min(2, 'Slug required')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Lowercase alphanumeric + hyphens only'),
  archetype: z.string().optional(),
  metro_id: z.string().optional(),
  admin_email: z.string().email('Valid email required'),
  admin_name: z.string().optional(),
  grant_reason: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function CreateFreeTenantModal({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const orgName = watch('organization_name');

  // Auto-suggest slug from organization name
  useEffect(() => {
    if (orgName) {
      setValue('slug', slugify(orgName), { shouldValidate: true });
    }
  }, [orgName, setValue]);

  // Reset form on close
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const { data: archetypes } = useQuery({
    queryKey: ['archetypes-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('archetypes')
        .select('key, name')
        .order('name');
      return data ?? [];
    },
  });

  const { data: metros } = useQuery({
    queryKey: ['metros-list-operator'],
    queryFn: async () => {
      const { data } = await supabase
        .from('metros')
        .select('id, metro')
        .order('metro');
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data, error } = await supabase.functions.invoke(
        'operator-create-free-tenant',
        { body: values },
      );
      if (error) throw new Error(error.message ?? 'Failed to create tenant');
      if (!data?.ok) throw new Error(data?.message ?? 'Unknown error');
      return data;
    },
    onSuccess: () => {
      toast.success('Free account created. Invitation sent.');
      queryClient.invalidateQueries({ queryKey: ['operator-all-tenants'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const [selectedArchetype, setSelectedArchetype] = useState<string>('');
  const [selectedMetro, setSelectedMetro] = useState<string>('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Gardener Sponsored Account</DialogTitle>
          <DialogDescription>
            Provision a free tenant for research, QA, or early collaboration. No Stripe billing will be created.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => {
            mutation.mutate({
              ...values,
              archetype: selectedArchetype || undefined,
              metro_id: selectedMetro || undefined,
            });
          })}
          className="space-y-4 mt-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="organization_name">Organization Name *</Label>
            <Input id="organization_name" {...register('organization_name')} placeholder="e.g. Hope Community Church" />
            {errors.organization_name && (
              <p className="text-sm text-destructive">{errors.organization_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" {...register('slug')} placeholder="e.g. hope-community" className="font-mono text-sm" />
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Archetype</Label>
              <Select value={selectedArchetype} onValueChange={setSelectedArchetype}>
                <SelectTrigger>
                  <SelectValue placeholder="Select archetype" />
                </SelectTrigger>
                <SelectContent>
                  {archetypes?.map((a) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Home Metro</Label>
              <Select value={selectedMetro} onValueChange={setSelectedMetro}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {metros?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.metro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin_email">Admin Email *</Label>
              <Input id="admin_email" type="email" {...register('admin_email')} placeholder="admin@org.com" />
              {errors.admin_email && (
                <p className="text-sm text-destructive">{errors.admin_email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin_name">Admin Name</Label>
              <Input id="admin_name" {...register('admin_name')} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant_reason">Reason for Grant</Label>
            <Textarea
              id="grant_reason"
              {...register('grant_reason')}
              placeholder="e.g. Research partner, early access program, QA testing..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Free Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
