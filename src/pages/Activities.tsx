/**
 * Activities — Unified timeline of all relational engagement.
 *
 * WHAT: Shows Calls, Meetings, Visits, Projects, and all activity types in one calm feed.
 * WHERE: /:tenantSlug/activities
 * WHY: Single source of truth for what happened — no scattered modules.
 */

import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUnifiedActivities, UnifiedActivity } from '@/hooks/useUnifiedActivities';
import { cn } from '@/lib/utils';
import { 
  Search, Plus, Phone, Mail, Video, Calendar, MapPin, Users,
  ChevronRight, CheckCircle, Filter, Clock, Loader2,
  ClipboardCheck, Heart, Hammer, Eye
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePersistentFilter } from '@/hooks/usePersistentFilter';
import { ActivityEditModal } from '@/components/activities/ActivityEditModal';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { Database } from '@/integrations/supabase/types';
import { useTenantNavigate } from '@/hooks/useTenantPath';
import { HelpTooltip } from '@/components/ui/help-tooltip';

type ActivityType = Database['public']['Enums']['activity_type'];
type ActivityOutcome = Database['public']['Enums']['activity_outcome'];

const VIEW_FILTER_VALUES = ['all', 'meetings', 'calls', 'visits', 'projects', 'tasks'] as const;

export default function Activities() {
  const { t } = useTranslation('activities');
  const [searchQuery, setSearchQuery] = usePersistentFilter('activities-search', '');
  const [viewFilter, setViewFilter] = usePersistentFilter('activities-view-filter', 'all');
  const [sourceFilter, setSourceFilter] = usePersistentFilter('activities-source-filter', 'all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<ActivityType>('Call');
  const [editingActivity, setEditingActivity] = useState<UnifiedActivity | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isOperatorRoute = pathname.startsWith('/operator');
  const tenantNavigate = useTenantNavigate();
  
  const { data: activities, isLoading } = useUnifiedActivities();

  const VIEW_FILTERS = VIEW_FILTER_VALUES.map(value => ({
    value,
    label: t(`filters.${value === 'all' ? 'allActivities' : value}`),
  }));

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    
    return activities.filter(activity => {
      const matchesSearch = 
        (activity.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (activity.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (activity.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (activity.organization || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesView = true;
      if (viewFilter === 'meetings') {
        matchesView = activity.activity_type === 'Meeting' || activity.source === 'google';
      } else if (viewFilter === 'calls') {
        matchesView = activity.activity_type === 'Call';
      } else if (viewFilter === 'visits') {
        matchesView = activity.activity_type === 'Visit';
      } else if (viewFilter === 'projects') {
        matchesView = activity.activity_type === 'Project';
      } else if (viewFilter === 'tasks') {
        matchesView = activity.activity_type === 'Other' && activity.source !== 'google';
      }
      
      const matchesSource = sourceFilter === 'all' || activity.source === sourceFilter;
      return matchesSearch && matchesView && matchesSource;
    });
  }, [activities, searchQuery, viewFilter, sourceFilter]);

  const getTypeIcon = (type: string, notes?: string | null) => {
    if (type === 'Other' && notes?.startsWith('Task completed:')) {
      return <ClipboardCheck className="w-4 h-4" />;
    }
    switch (type) {
      case 'Call': return <Phone className="w-4 h-4" />;
      case 'Email': return <Mail className="w-4 h-4" />;
      case 'Meeting': return <Video className="w-4 h-4" />;
      case 'Event': return <Calendar className="w-4 h-4" />;
      case 'Site Visit': return <MapPin className="w-4 h-4" />;
      case 'Intro': return <Users className="w-4 h-4" />;
      case 'Visit': return <Eye className="w-4 h-4" />;
      case 'Project': return <Heart className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const isTaskActivity = (type: string, notes?: string | null) =>
    type === 'Other' && !!notes?.startsWith('Task completed:');

  const getTypeBadge = (type: string, notes?: string | null) => {
    if (isTaskActivity(type, notes)) return 'bg-chart-4/15 text-[hsl(var(--chart-4))]';
    const styles: Record<string, string> = {
      Call: 'bg-success/15 text-success',
      Email: 'bg-primary/15 text-primary',
      Meeting: 'bg-info/15 text-info',
      Event: 'bg-warning/15 text-warning',
      'Site Visit': 'bg-accent/15 text-accent',
      Intro: 'bg-chart-5/15 text-[hsl(var(--chart-5))]',
      Visit: 'bg-primary/15 text-primary',
      Project: 'bg-warning/10 text-warning',
      Other: 'bg-muted text-muted-foreground'
    };
    return styles[type] || 'bg-muted text-muted-foreground';
  };

  const getTypeIconWrapClass = (type: string, notes?: string | null) => {
    if (isTaskActivity(type, notes)) return 'bg-muted/50 text-[hsl(var(--chart-4))]';
    const map: Record<string, string> = {
      Call: 'bg-success/10 text-success',
      Email: 'bg-primary/10 text-primary',
      Meeting: 'bg-info/10 text-info',
      Event: 'bg-warning/10 text-warning',
      'Site Visit': 'bg-accent/10 text-accent',
      Intro: 'bg-chart-5/10 text-[hsl(var(--chart-5))]',
      Visit: 'bg-primary/10 text-primary',
      Project: 'bg-warning/10 text-warning',
      Other: 'bg-muted/50 text-muted-foreground'
    };
    return map[type] || 'bg-muted/50 text-muted-foreground';
  };

  const getDisplayType = (type: string, notes: string | null) => {
    if (isTaskActivity(type, notes)) return 'Task';
    return type;
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return 'bg-muted text-muted-foreground';
    const styles: Record<string, string> = {
      'Connected': 'bg-success/15 text-success',
      'Moved Stage': 'bg-primary/15 text-primary',
      'Follow-up Needed': 'bg-warning/15 text-warning',
      'No Response': 'bg-muted text-muted-foreground',
      'Not a Fit': 'bg-destructive/15 text-destructive'
    };
    return styles[outcome] || 'bg-muted text-muted-foreground';
  };

  const handleActivityClick = (activity: UnifiedActivity) => {
    if (activity.activity_type === 'Project') {
      tenantNavigate(`/projects/${activity.id}`);
    } else if (activity.source === 'crm') {
      setEditingActivity(activity);
    } else if (activity.source === 'google') {
      navigate(`/calendar/event/${activity.id}`);
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4" data-tour="activity-filters">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('filters.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={viewFilter} onValueChange={setViewFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                {VIEW_FILTERS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t('filters.sourcePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.allSources')}</SelectItem>
                <SelectItem value="crm">{t('filters.crmOnly')}</SelectItem>
                <SelectItem value="google">{t('filters.googleCalendar')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {t('counts.activity', { count: filteredActivities.length })}
            </p>
            <HelpTooltip
              what={t('tooltips.what')}
              where={t('tooltips.where')}
              why={t('tooltips.why')}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setIsProjectDialogOpen(true)}
              data-testid="new-project-btn"
            >
              <Heart className="w-4 h-4" />
              {t('buttons.newProject')}
            </Button>
            <Button className="gap-2" onClick={() => setIsCreateModalOpen(true)} data-tour="log-activity-btn">
              <Plus className="w-4 h-4" />
              {t('buttons.logActivity')}
            </Button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('states.noActivitiesFound')}</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || viewFilter !== 'all' || sourceFilter !== 'all'
              ? t('states.adjustFilters')
              : t('states.getStarted')}
          </p>
        </div>
      ) : (
        /* Activity Timeline */
        <div className="space-y-4" data-tour="activity-list">
          {filteredActivities.map((activity, index) => (
            <div 
              key={`${activity.source}-${activity.id}`}
              className={cn(
                'bg-card rounded-xl border border-border p-5 hover:shadow-card-hover transition-all duration-200 cursor-pointer animate-fade-in group',
                `stagger-${(index % 6) + 1}`,
                activity.source === 'google' && 'opacity-80',
                activity.activity_type === 'Project' && 'border-l-4 border-l-warning/40'
              )}
              data-tour={index === 0 ? 'activity-item' : undefined}
              data-testid={activity.activity_type === 'Project' ? 'project-card' : undefined}
              onClick={() => handleActivityClick(activity)}
              title={
                activity.activity_type === 'Project' ? t('card.clickToViewProject')
                : activity.source === 'google' ? t('card.clickToViewCalendar')
                : t('card.clickToEdit')
              }
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'p-3 rounded-lg flex-shrink-0 grid place-items-center',
                    getTypeIconWrapClass(activity.activity_type, activity.notes)
                  )}
                >
                  {getTypeIcon(activity.activity_type, activity.notes)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('status-badge', getTypeBadge(activity.activity_type, activity.notes))}>
                          {getDisplayType(activity.activity_type, activity.notes)}
                        </span>
                        {activity.activity_type === 'Project' && activity.project_status && (
                          <Badge variant="outline" className="text-xs">
                            {activity.project_status}
                          </Badge>
                        )}
                        {activity.source === 'google' && (
                          <Badge variant="outline" className="text-xs">Google</Badge>
                        )}
                        {activity.activity_type !== 'Call' && activity.activity_type !== 'Project' && activity.activity_type !== 'Visit' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-success/15 text-success">
                            <CheckCircle className="w-3 h-3" />
                            {t('card.attended')}
                          </span>
                        )}
                        {activity.outcome && (
                          <span className={cn('status-badge', getOutcomeBadge(activity.outcome))}>
                            {activity.outcome}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-foreground mb-1 line-clamp-1">
                        {activity.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(activity.date_time).toLocaleString()}
                        {activity.contact_name && (
                          <span className="ml-2">• {activity.contact_name}</span>
                        )}
                        {activity.organization && (
                          <span className="ml-2">• {activity.organization}</span>
                        )}
                        {activity.location && (
                          <span className="ml-2">• {activity.location}</span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>

                  {activity.notes && (
                    <p className="text-foreground mb-3 line-clamp-2">{activity.notes}</p>
                  )}

                  {activity.next_action && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{t('card.next')}</span>
                        <span className="font-medium">{activity.next_action}</span>
                        {activity.next_action_due && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-warning font-medium">
                              {new Date(activity.next_action_due).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const modals = (
    <>
      <ActivityEditModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        defaultType={createType}
      />
      <CreateProjectDialog
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
      />
      {editingActivity && editingActivity.source === 'crm' && (
        <ActivityEditModal
          open={!!editingActivity}
          onOpenChange={(open) => !open && setEditingActivity(null)}
          existingActivity={{
            id: editingActivity.id,
            activity_type: editingActivity.activity_type as ActivityType,
            activity_date_time: editingActivity.date_time,
            contact_id: editingActivity.contact_id,
            metro_id: editingActivity.metro_id,
            opportunity_id: editingActivity.opportunity_id,
            notes: editingActivity.notes,
            outcome: editingActivity.outcome as ActivityOutcome | null,
            next_action: editingActivity.next_action,
            next_action_due: editingActivity.next_action_due,
            attended: editingActivity.attended
          }}
        />
      )}
    </>
  );

  if (isOperatorRoute) {
    return (
      <div data-testid="activities-root">
        {content}
        {modals}
      </div>
    );
  }

  return (
    <MainLayout
      title={t('page.title')}
      subtitle={t('page.subtitle')}
      data-testid="activities-root"
    >
      {content}
      {modals}
    </MainLayout>
  );
}
