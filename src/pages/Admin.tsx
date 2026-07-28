import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUsers, useAssignRole, useRemoveRole, useAssignRegion, useRemoveRegionAssignment, useApproveUser, useRevokeUserApproval, useAssignUserMetro, useRemoveUserMetro, UserWithDetails } from '@/hooks/useUsers';
import { useRegions } from '@/hooks/useRegions';
import { useMetros } from '@/hooks/useMetros';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Shield, Users, MapPin, Plus, X, UserPlus, Clock, Globe, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { AuditLogPanel } from '@/components/admin/AuditLogPanel';
import { SectorsPanel } from '@/components/admin/SectorsPanel';
import { GrantAlignmentsPanel } from '@/components/admin/GrantAlignmentsPanel';
import { MissionSnapshotsPanel } from '@/components/admin/MissionSnapshotsPanel';
import { PartnershipAnglesPanel } from '@/components/admin/PartnershipAnglesPanel';
import { RegionsMetrosPanel } from '@/components/admin/RegionsMetrosPanel';
import { GrantTypesPanel } from '@/components/admin/GrantTypesPanel';
import { FeedbackPanel } from '@/components/admin/FeedbackPanel';
import { AiKnowledgeBasePanel } from '@/components/admin/AiKnowledgeBasePanel';
import { AdminNavDropdown } from '@/components/admin/AdminNavDropdown';
import { VolunteerIngestionStats } from '@/components/admin/VolunteerIngestionStats';
import { ImportCenterStats } from '@/components/admin/ImportCenterStats';
import { TenantSubscriptionCard } from '@/components/admin/TenantSubscriptionCard';
type AppRole = 'admin' | 'regional_lead' | 'staff' | 'leadership';

const ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full system access, manage users and settings' },
  { value: 'leadership', label: 'Leadership', description: 'View all data, strategic oversight' },
  { value: 'regional_lead', label: 'Regional Lead', description: 'Manage assigned region and its metros' },
  { value: 'staff', label: 'Staff', description: 'Access assigned region only' },
];

function RoleBadge({ role }: { role: AppRole }) {
  const colors: Record<AppRole, string> = {
    admin: 'bg-red-100 text-red-800 border-red-200',
    leadership: 'bg-purple-100 text-purple-800 border-purple-200',
    regional_lead: 'bg-blue-100 text-blue-800 border-blue-200',
    staff: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <Badge variant="outline" className={colors[role]}>
      {role.replace('_', ' ')}
    </Badge>
  );
}

function UserManageDialog({ user, onClose }: { user: UserWithDetails; onClose: () => void }) {
  const { t } = useTranslation('common');
  const { data: regions } = useRegions();
  const { data: metros } = useMetros();
  const { enabled: metroIntelligenceEnabled } = useMetroIntelligence();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const assignRegion = useAssignRegion();
  const removeRegion = useRemoveRegionAssignment();
  const assignUserMetro = useAssignUserMetro();
  const removeUserMetro = useRemoveUserMetro();
  const approveUser = useApproveUser();
  const revokeApproval = useRevokeUserApproval();
  
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [selectedRegion, setSelectedRegion] = useState<string>(user.region_assignment?.region_id || '');
  const [selectedMetro, setSelectedMetro] = useState<string>('');

  const availableRoles = ROLES.filter(r => !user.roles.includes(r.value));
  const hasNoGeoAssignment = !user.region_assignment && user.metro_assignments.length === 0;
  const isExecutiveLevel = user.roles.includes('admin') || user.roles.includes('leadership') || hasNoGeoAssignment;

  // Metros available for individual assignment (not already assigned)
  const availableMetros = metros?.filter(m => 
    !user.metro_assignments.some(ma => ma.metro_id === m.id)
  ) || [];

  // Metros in the selected region
  const assignedRegionMetros = selectedRegion
    ? metros?.filter(m => m.region_id === selectedRegion) || []
    : [];

  const handleAssignRole = () => {
    if (selectedRole) {
      assignRole.mutate({ userId: user.user_id, role: selectedRole });
      setSelectedRole('');
    }
  };

  const handleAssignRegion = (regionId: string) => {
    if (regionId === 'none') {
      removeRegion.mutate({ userId: user.user_id });
      setSelectedRegion('');
    } else {
      assignRegion.mutate({ userId: user.user_id, regionId });
      setSelectedRegion(regionId);
    }
  };

  const handleAssignMetro = () => {
    if (selectedMetro) {
      assignUserMetro.mutate({ userId: user.user_id, metroId: selectedMetro });
      setSelectedMetro('');
    }
  };

  const handleToggleApproval = () => {
    if (user.is_approved) {
      revokeApproval.mutate({ userId: user.user_id });
    } else {
      approveUser.mutate({ userId: user.user_id });
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{user.display_name || 'Unnamed User'}</DialogTitle>
        <DialogDescription>
          {t('admin.userDialog.descriptionNote')}
        </DialogDescription>
      </DialogHeader>

      {/* Approval Status Card */}
      <div className={`p-4 rounded-lg border ${user.is_approved ? 'bg-primary/5 border-primary/20' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.is_approved ? (
              <CheckCircle className="w-5 h-5 text-primary" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <h4 className="font-medium text-sm">
                {user.is_approved ? t('admin.userDialog.welcomedTitle') : t('admin.userDialog.waitingTitle')}
              </h4>
              <p className="text-xs text-muted-foreground">
                {user.is_approved
                  ? t('admin.userDialog.welcomedAt', { date: user.approved_at ? format(new Date(user.approved_at), 'MMM d, yyyy') : '' })
                  : t('admin.userDialog.waitingDesc')
                }
              </p>
            </div>
          </div>
          <Button
            variant={user.is_approved ? 'outline' : 'default'}
            size="sm"
            onClick={handleToggleApproval}
            disabled={approveUser.isPending || revokeApproval.isPending}
          >
            {(approveUser.isPending || revokeApproval.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : user.is_approved ? (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                {t('admin.userDialog.revoke')}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                {t('admin.userDialog.welcome')}
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="roles" className="mt-4">
        <TabsList className={`grid w-full ${metroIntelligenceEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="roles">
            <Shield className="w-4 h-4 mr-2" />
            {t('admin.userDialog.rolesTab')}
          </TabsTrigger>
          <TabsTrigger value="region">
            <Globe className="w-4 h-4 mr-2" />
            {t('admin.userDialog.regionTab')}
          </TabsTrigger>
          {metroIntelligenceEnabled && (
            <TabsTrigger value="metros">
              <MapPin className="w-4 h-4 mr-2" />
              {t('admin.userDialog.metroAccessTab')}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ROLES TAB */}
        <TabsContent value="roles" className="space-y-4 mt-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{t('admin.userDialog.currentRoles')}</h4>
            <p className="text-xs text-muted-foreground">
              {t('admin.userDialog.currentRolesDesc')}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {user.roles.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">{t('admin.userDialog.noRolesYet')}</p>
              ) : (
                user.roles.map(role => (
                  <div key={role} className="flex items-center gap-1">
                    <RoleBadge role={role} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => removeRole.mutate({ userId: user.user_id, role })}
                      disabled={removeRole.isPending}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {availableRoles.length > 0 && (
            <div className="flex gap-2">
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('admin.userDialog.chooseRole')} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{t(`admin.roles.${role.value}.label`)}</div>
                        <div className="text-xs text-muted-foreground">{t(`admin.roles.${role.value}.description`)}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAssignRole} 
                disabled={!selectedRole || assignRole.isPending}
              >
                {assignRole.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* REGION TAB */}
        <TabsContent value="region" className="space-y-4 mt-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{t('admin.userDialog.regionalHome')}</h4>
            <p className="text-xs text-muted-foreground">
              {t('admin.userDialog.regionalHomeDesc')}
            </p>
          </div>

          <Select
            value={user.region_assignment?.region_id || 'none'}
            onValueChange={handleAssignRegion}
            disabled={assignRegion.isPending || removeRegion.isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('admin.userDialog.regionalHome')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">{t('admin.userDialog.noRegion')}</span>
              </SelectItem>
              {regions?.map(region => (
                <SelectItem key={region.id} value={region.id}>
                  <div className="flex items-center gap-2">
                    {region.color && (
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: region.color }}
                      />
                    )}
                    {region.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {user.region_assignment && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">{t('admin.userDialog.metrosWithin', { regionName: user.region_assignment.region_name })}</h4>
              <div className="flex flex-wrap gap-2">
                {assignedRegionMetros.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">{t('admin.userDialog.noMetrosInRegion')}</p>
                ) : (
                  assignedRegionMetros.map(metro => (
                    <Badge key={metro.id} variant="outline">
                      <MapPin className="w-3 h-3 mr-1" />
                      {metro.metro}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t pt-4 italic">
            {t('admin.userDialog.adminLeadershipNote')}
          </p>
        </TabsContent>

        {/* METRO ACCESS TAB (only when Metro Intelligence enabled) */}
        {metroIntelligenceEnabled && (
          <TabsContent value="metros" className="space-y-4 mt-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">{t('admin.userDialog.individualMetroAccess')}</h4>
              <p className="text-xs text-muted-foreground">
                {t('admin.userDialog.individualMetroAccessDesc')}
              </p>
            </div>

            {/* Current access summary */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-start gap-2">
                {isExecutiveLevel ? (
                  <>
                    <Globe className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t('admin.userDialog.fullLandscapeAccess')}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.roles.includes('admin') || user.roles.includes('leadership')
                          ? t('admin.userDialog.fullLandscapeAdminNote')
                          : t('admin.userDialog.fullLandscapeNoGeoNote')}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t('admin.userDialog.focusedAccess')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('admin.userDialog.focusedAccessDesc', {
                          plusMetros: user.metro_assignments.length > 0
                            ? t(user.metro_assignments.length === 1 ? 'admin.userDialog.plusMetros_one' : 'admin.userDialog.plusMetros_other', { count: user.metro_assignments.length })
                            : ''
                        })}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Direct metro assignments */}
            {user.metro_assignments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">{t('admin.userDialog.individualMetros')}</h4>
                <div className="flex flex-wrap gap-2">
                  {user.metro_assignments.map(ma => (
                    <div key={ma.metro_id} className="flex items-center gap-1">
                      <Badge variant="outline">
                        <MapPin className="w-3 h-3 mr-1" />
                        {ma.metro_name}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => removeUserMetro.mutate({ userId: user.user_id, metroId: ma.metro_id })}
                        disabled={removeUserMetro.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add metro */}
            {availableMetros.length > 0 && (
              <div className="flex gap-2">
                <Select value={selectedMetro} onValueChange={setSelectedMetro}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t('admin.userDialog.extendMetro')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMetros.map(metro => (
                      <SelectItem key={metro.id} value={metro.id}>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          {metro.metro}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssignMetro}
                  disabled={!selectedMetro || assignUserMetro.isPending}
                >
                  {assignUserMetro.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground border-t pt-4 italic">
              {t('admin.userDialog.execWideLandscapeNote')}
            </p>
          </TabsContent>
        )}
      </Tabs>
    </DialogContent>
  );
}

function PendingApprovalsList({ users }: { users: UserWithDetails[] }) {
  const { t } = useTranslation('common');
  const approveUser = useApproveUser();

  return (
    <div className="flex flex-wrap gap-2">
      {users.map(user => (
        <div key={user.id} className="flex items-center gap-2 bg-white dark:bg-background rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
          <span className="font-medium text-sm">{user.display_name || 'Unnamed User'}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => approveUser.mutate({ userId: user.user_id })}
            disabled={approveUser.isPending}
          >
            {approveUser.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                {t('admin.approve')}
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const { t } = useTranslation('common');
  const { data: users, isLoading, error } = useUsers();
  const { user: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const { activeTab: activeSection, setActiveTab: setActiveSection } = useTabPersistence('users', 'section');

  if (isLoading) {
    return (
      <MainLayout title={t('admin.title')} subtitle={t('admin.subtitle')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title={t('admin.title')} subtitle={t('admin.subtitle')}>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading users: {error.message}</p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={t('admin.title')} subtitle={t('admin.subtitle')}>
      <div className="space-y-6">
        {/* Section Navigation Dropdown */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('admin.section')}:</span>
          <AdminNavDropdown 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
          />
        </div>

        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-6">

        <TabsContent value="users" className="space-y-6">
          {/* Pending Approvals Alert */}
          {users?.filter(u => !u.is_approved).length > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-amber-800 dark:text-amber-200">
                  {t('admin.pendingApprovals', { count: users?.filter(u => !u.is_approved).length })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  {t('admin.pendingApprovalsDesc')}
                </p>
                <PendingApprovalsList users={users?.filter(u => !u.is_approved) || []} />
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('admin.stats.totalUsers')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('admin.stats.approved')}</CardTitle>
                <CheckCircle className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {users?.filter(u => u.is_approved).length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('admin.stats.admins')}</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users?.filter(u => u.roles.includes('admin')).length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('admin.stats.regionalLeads')}</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users?.filter(u => u.roles.includes('regional_lead')).length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.communityMembers')}</CardTitle>
              <CardDescription>
                {t('admin.communityMembersDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.table.user')}</TableHead>
                    <TableHead>{t('admin.table.status')}</TableHead>
                    <TableHead>{t('admin.table.roles')}</TableHead>
                    <TableHead>{t('admin.table.geoScope')}</TableHead>
                    <TableHead>{t('admin.table.joined')}</TableHead>
                    <TableHead className="text-right">{t('admin.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map(user => (
                    <TableRow key={user.id} className={!user.is_approved ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.display_name || 'Unnamed User'}
                            {user.user_id === currentUser?.id && (
                              <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.is_approved ? (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {t('admin.approved')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                            <Clock className="w-3 h-3 mr-1" />
                            {t('admin.pending')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length === 0 ? (
                            <span className="text-muted-foreground text-sm">{t('admin.noRoles')}</span>
                          ) : (
                            user.roles.map(role => (
                              <RoleBadge key={role} role={role} />
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.roles.includes('admin') || user.roles.includes('leadership') ? (
                          <Badge variant="secondary">{t('admin.allCommunities')}</Badge>
                        ) : user.region_assignment && user.metro_assignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">
                              <Globe className="w-3 h-3 mr-1" />
                              {user.region_assignment.region_name}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {t(user.metro_assignments.length === 1 ? 'admin.metroCount' : 'admin.metrosCount', { count: user.metro_assignments.length })}
                            </Badge>
                          </div>
                        ) : user.region_assignment ? (
                          <Badge variant="outline">
                            <Globe className="w-3 h-3 mr-1" />
                            {user.region_assignment.region_name}
                          </Badge>
                        ) : user.metro_assignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.metro_assignments.slice(0, 2).map(ma => (
                              <Badge key={ma.metro_id} variant="outline">
                                <MapPin className="w-3 h-3 mr-1" />
                                {ma.metro_name}
                              </Badge>
                            ))}
                            {user.metro_assignments.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                {t(user.metro_assignments.length - 2 === 1 ? 'admin.metroCount' : 'admin.metrosCount', { count: user.metro_assignments.length - 2 })}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-xs">{t('admin.fullLandscape')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : 'Unknown'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog open={selectedUser?.id === user.id} onOpenChange={(open) => !open && setSelectedUser(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedUser(user)}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              {t('admin.manage')}
                            </Button>
                          </DialogTrigger>
                          {selectedUser?.id === user.id && (
                            <UserManageDialog user={user} onClose={() => setSelectedUser(null)} />
                          )}
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regions-metros">
          <RegionsMetrosPanel />
        </TabsContent>

        <TabsContent value="sectors">
          <SectorsPanel />
        </TabsContent>

        <TabsContent value="grant-alignments">
          <GrantAlignmentsPanel />
        </TabsContent>

        <TabsContent value="grant-types">
          <GrantTypesPanel />
        </TabsContent>

        <TabsContent value="mission-snapshots">
          <MissionSnapshotsPanel />
        </TabsContent>

        <TabsContent value="partnership-angles">
          <PartnershipAnglesPanel />
        </TabsContent>


        <TabsContent value="feedback">
          <FeedbackPanel />
        </TabsContent>

        <TabsContent value="ai-knowledge-base" forceMount className={activeSection !== 'ai-knowledge-base' ? 'hidden' : ''}>
          <AiKnowledgeBasePanel />
        </TabsContent>

        <TabsContent value="activity">
          <AuditLogPanel />
        </TabsContent>

        <TabsContent value="community-health">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('admin.communityHealth')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <VolunteerIngestionStats />
              <ImportCenterStats />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subscription">
          <div className="max-w-lg">
            <TenantSubscriptionCard />
          </div>
        </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
