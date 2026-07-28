/**
 * ProjectDetail — Detail page for a Good Work project.
 *
 * WHAT: Shows overview, people served, helpers, reflections timeline with voice note support.
 * WHERE: /:tenantSlug/projects/:projectId
 * WHY: Central place to see and add reflections/notes — builds NRI narrative.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Heart, MapPin, Calendar, Users, FileText, Plus,
  Mic, ArrowLeft, Loader2, CheckCircle2, Clock, Hammer,
} from 'lucide-react';
import { useProject, useProjectNotes, useAddProjectNote, useUpdateProjectStatus } from '@/hooks/useProjects';
import { ProjectImpactCard } from '@/components/projects/ProjectImpactCard';
import { useActivityParticipants } from '@/hooks/useActivityParticipants';
import { useVoiceNotes } from '@/hooks/useVoiceNotes';
import { VoiceRecorder } from '@/components/voice/VoiceRecorder';
import { OnBehalfOfRecorder } from '@/components/voice/OnBehalfOfRecorder';
import { format } from 'date-fns';
import { useTenantNavigate } from '@/hooks/useTenantPath';
import { useQueryClient } from '@tanstack/react-query';
import { HelpTooltip } from '@/components/ui/help-tooltip';

const STATUS_OPTIONS = [
  { value: 'Planned', label: 'Planned', icon: Clock },
  { value: 'In Progress', label: 'In Progress', icon: Hammer },
  { value: 'Done', label: 'Done', icon: CheckCircle2 },
];

export default function ProjectDetail() {
  const { t } = useTranslation('projects');
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useTenantNavigate();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useProject(projectId);
  const { data: notes = [] } = useProjectNotes(projectId);
  const { data: participants = [] } = useActivityParticipants(projectId);
  const { data: voiceNotes = [] } = useVoiceNotes({
    subjectType: 'event',
    subjectId: projectId,
    limit: 50,
  });
  const addNote = useAddProjectNote();
  const updateStatus = useUpdateProjectStatus();

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [onBehalfOpen, setOnBehalfOpen] = useState(false);

  const isQaMode = new URLSearchParams(window.location.search).has('qa');

  if (isLoading) {
    return (
      <MainLayout title={t('projectDetail.title')}>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout title={t('projectDetail.title')}>
        <div className="text-center py-12 text-muted-foreground">
          {t('projectDetail.projectNotFound')}
        </div>
      </MainLayout>
    );
  }

  const handleAddNote = async () => {
    if (!noteText.trim() || !projectId) return;
    await addNote.mutateAsync({ projectId, notes: noteText.trim() });
    setNoteText('');
    setNoteOpen(false);
  };

  // Merge typed notes + voice transcripts into one timeline
  const timeline = [
    ...notes.map(n => ({
      id: n.id,
      type: 'note' as const,
      text: n.notes,
      date: n.activity_date_time,
      contactName: n.contacts?.name,
    })),
    ...voiceNotes.map((vn: any) => ({
      id: vn.id,
      type: 'voice' as const,
      text: vn.transcript || 'Transcribing…',
      date: vn.recorded_at,
      contactName: null,
      authorName: vn.author_volunteer_id ? 'Volunteer' : null,
      status: vn.transcript_status,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <MainLayout title={project.title || t('projectDetail.title')} mobileTitle={project.title || t('projectDetail.title')}>
      <div className="max-w-2xl mx-auto space-y-6" data-testid="project-detail-root">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> {t('projectDetail.allProjects')}
        </Button>

        {/* Overview */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {project.title || t('projectDetail.untitledProject')}
                </h1>
                {project.location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" /> {project.location}
                  </p>
                )}
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(project.activity_date_time), 'EEEE, MMMM d, yyyy · h:mm a')}
                </p>
              </div>
              <Select
                value={project.project_status || 'Planned'}
                onValueChange={(val) => updateStatus.mutate({ projectId: project.id, status: val })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {project.notes && (
              <p className="text-sm text-muted-foreground border-t pt-3">{project.notes}</p>
            )}
          </CardContent>
        </Card>

        {/* Helpers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              {t('projectDetail.helpers.title')}
              <HelpTooltip
                what={t('projectDetail.helpers.helpWhat')}
                where={t('projectDetail.helpers.helpWhere')}
                why={t('projectDetail.helpers.helpWhy')}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{t('projectDetail.helpers.noHelpers')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {participants.map((p: any) => (
                  <Badge key={p.id} variant="secondary" className="text-sm py-1 px-2.5">
                    {p.display_name}
                    <span className="text-xs text-muted-foreground ml-1">({p.role})</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Impact Snapshot */}
        <ProjectImpactCard activityId={project.id} />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => setNoteOpen(true)} data-testid="add-note-btn">
            <Plus className="h-4 w-4" /> {t('projectDetail.actions.addNote')}
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => setVoiceOpen(true)} data-testid="record-voice-btn">
            <Mic className="h-4 w-4" /> {t('projectDetail.actions.recordVoice')}
          </Button>
          <Button
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setOnBehalfOpen(true)}
            data-testid="on-behalf-project-btn"
          >
            <Users className="h-4 w-4" /> {t('projectDetail.actions.recordForHelper')}
          </Button>
        </div>

        {/* Reflections Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              {t('projectDetail.reflections.title')}
              <HelpTooltip
                what={t('projectDetail.reflections.helpWhat')}
                where={t('projectDetail.reflections.helpWhere')}
                why={t('projectDetail.reflections.helpWhy')}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                {t('projectDetail.reflections.empty')}
              </p>
            ) : (
              timeline.map(item => (
                <div key={item.id} className="border-l-2 border-primary/20 pl-3 py-1 space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {item.type === 'voice' ? (
                      <Mic className="h-3 w-3" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    <span>{format(new Date(item.date), 'MMM d, h:mm a')}</span>
                    {item.type === 'voice' && (item as any).status === 'processing' && (
                      <Badge variant="outline" className="text-xs">{t('projectDetail.reflections.processing')}</Badge>
                    )}
                    {item.contactName && (
                      <Badge variant="secondary" className="text-xs">About: {item.contactName}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{item.text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add note dialog */}
      <Dialog open={noteOpen} onOpenChange={o => { if (!o) { setNoteOpen(false); setNoteText(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>{t('projectDetail.noteDialog.title')}</DialogTitle>
            <DialogDescription>{t('projectDetail.noteDialog.description')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder={t('projectDetail.noteDialog.placeholder')}
            rows={4}
            data-testid="project-note-textarea"
          />
          <Button
            onClick={handleAddNote}
            disabled={addNote.isPending || !noteText.trim()}
            data-testid="submit-project-note"
          >
            {addNote.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('projectDetail.noteDialog.saveButton')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Voice recorder dialog */}
      <Dialog open={voiceOpen} onOpenChange={o => { if (!o) setVoiceOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>{t('projectDetail.voiceDialog.title')}</DialogTitle>
            <DialogDescription>{t('projectDetail.voiceDialog.description')}</DialogDescription>
          </DialogHeader>
          {projectId && (
            <VoiceRecorder
              subjectType="event"
              subjectId={projectId}
              qaMode={isQaMode}
              onTranscriptSaved={() => {
                queryClient.invalidateQueries({ queryKey: ['voice-notes'] });
                queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
                setVoiceOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* On-behalf-of dialog */}
      <Dialog open={onBehalfOpen} onOpenChange={o => { if (!o) setOnBehalfOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>{t('projectDetail.onBehalfDialog.title')}</DialogTitle>
            <DialogDescription>{t('projectDetail.onBehalfDialog.description')}</DialogDescription>
          </DialogHeader>
          {projectId && (
            <OnBehalfOfRecorder
              activityId={projectId}
              participants={participants.map((p: any) => ({
                id: p.id,
                display_name: p.display_name,
                volunteer_id: p.volunteer_id,
              }))}
              onDone={() => {
                queryClient.invalidateQueries({ queryKey: ['voice-notes'] });
                setOnBehalfOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
