/**
 * Projects — Good work in motion.
 *
 * WHAT: Lists all Projects (activity_type = 'Project') as calm cards.
 * WHERE: /:tenantSlug/projects
 * WHY: Lightweight container for community service — not a PM tool.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MapPin, Calendar, Users, FileText, Plus, Loader2 } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { format } from 'date-fns';
import { useTenantNavigate } from '@/hooks/useTenantPath';
import { HelpTooltip } from '@/components/ui/help-tooltip';

const STATUS_COLORS: Record<string, string> = {
  Planned: 'bg-muted text-muted-foreground',
  'In Progress': 'bg-primary/10 text-primary',
  Done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

export default function Projects() {
  const { t } = useTranslation('projects');
  const { data: projects, isLoading } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useTenantNavigate();

  return (
    <MainLayout
      title={t('projects.title')}
      mobileTitle={t('projects.mobileTitle')}
      subtitle={t('projects.subtitle')}
    >
      <div className="max-w-2xl mx-auto space-y-6" data-testid="projects-root">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Projects
            </h1>
            <HelpTooltip
              what={t('projects.helpWhat')}
              where={t('projects.helpWhere')}
              why={t('projects.helpWhy')}
            />
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-1.5"
            data-testid="new-project-btn"
          >
            <Plus className="h-4 w-4" />
            {t('projects.newProject')}
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!projects || projects.length === 0) && (
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Heart className="h-7 w-7 text-primary/60" />
              </div>
              <h2 className="text-base font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                {t('projects.empty.title')}
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t('projects.empty.description')}
              </p>
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t('projects.empty.createButton')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Project cards */}
        {projects?.map(project => (
          <Card
            key={project.id}
            className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/30"
            onClick={() => navigate(`/projects/${project.id}`)}
            data-testid="project-card"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-foreground truncate text-base">
                    {project.title || t('projects.untitledProject')}
                  </h3>
                  {project.location && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{project.location}</span>
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    {format(new Date(project.activity_date_time), 'MMM d, yyyy · h:mm a')}
                  </p>
                </div>
                {project.project_status && (
                  <Badge className={STATUS_COLORS[project.project_status] || ''}>
                    {project.project_status}
                  </Badge>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {(project.helpers_count ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {project.helpers_count} helper{project.helpers_count !== 1 ? 's' : ''}
                  </span>
                )}
                {project.last_reflection_at && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {t('projects.card.lastNote')} {format(new Date(project.last_reflection_at), 'MMM d')}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </MainLayout>
  );
}
