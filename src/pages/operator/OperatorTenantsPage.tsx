/**
 * OperatorTenantsPage — List and manage all tenant accounts.
 *
 * WHAT: Global tenant directory for the operator.
 * WHERE: /operator/tenants
 * WHY: Operator needs visibility into all orgs, statuses, and archetypes.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Gift } from 'lucide-react';
import CreateFreeTenantModal from '@/components/operator/CreateFreeTenantModal';

type FilterMode = 'all' | 'paid' | 'operator_sponsored';

export default function OperatorTenantsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['operator-all-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, tier, archetype, status, created_at, is_operator_granted, billing_mode, operator_grant_reason, operator_granted_at, civitas_enabled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = tenants?.filter((t) => {
    if (filter === 'paid') return !t.is_operator_granted;
    if (filter === 'operator_sponsored') return t.is_operator_granted;
    return true;
  });

  const sponsoredCount = tenants?.filter((t) => t.is_operator_granted).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            All organizations on the platform.{' '}
            {sponsoredCount > 0 && (
              <span className="text-amber-600">{sponsoredCount} gardener sponsored</span>
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Free Account
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(['all', 'paid', 'operator_sponsored'] as FilterMode[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className="capitalize text-xs"
          >
            {f === 'operator_sponsored' ? 'Gardener Sponsored' : f}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="hidden sm:table-cell">Archetype</TableHead>
                  <TableHead className="hidden sm:table-cell">Tier</TableHead>
                  <TableHead className="hidden sm:table-cell">Civitas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Billing</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/operator/tenants/${t.id}`)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {t.name}
                        {t.is_operator_granted && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Gift className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Gardener Sponsored</p>
                                {t.operator_grant_reason && (
                                  <p className="text-xs text-muted-foreground max-w-[200px]">
                                    {t.operator_grant_reason}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.slug}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="capitalize">{(t.archetype || 'none').replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{t.tier}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {(t as any).civitas_enabled ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Multi Region</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Single Region</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {t.is_operator_granted ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                          Sponsored
                        </Badge>
                      ) : (
                        <Badge variant="outline">Stripe</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered?.length === 0 && (
                  <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No tenants match this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateFreeTenantModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
