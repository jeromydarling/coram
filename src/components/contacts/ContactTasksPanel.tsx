import { useState } from 'react';
import {
  useContactTasks,
  useCreateContactTask,
  useToggleContactTask,
  useUpdateContactTask,
  useDeleteContactTask
} from '@/hooks/useContactTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Calendar,
  Trash2,
  Loader2,
  CheckCircle2,
  Pencil,
  ChevronDown,
  ChevronRight,
  Mic,
  Video
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, parseISO } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

interface ContactTasksPanelProps {
  contactId: string;
  className?: string;
}

interface UnifiedTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  source: string | null;
  // For activity-sourced tasks
  isActivityNextAction?: boolean;
}

export function ContactTasksPanel({ contactId, className }: ContactTasksPanelProps) {
  const { t } = useTranslation(['relationships', 'common']);
  const { data: tasks, isLoading } = useContactTasks(contactId);
  const createTask = useCreateContactTask();
  const toggleTask = useToggleContactTask();
  const updateTask = useUpdateContactTask();
  const deleteTask = useDeleteContactTask();

  // Fetch activity next_actions for this contact
  const { data: activityNextActions } = useQuery({
    queryKey: ['contact-activity-next-actions', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, next_action, next_action_due, activity_type, activity_date_time')
        .eq('contact_id', contactId)
        .not('next_action', 'is', null)
        .order('next_action_due', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  // Convert activity next_actions to unified task format
  const activityTasks: UnifiedTask[] = (activityNextActions || []).map(a => ({
    id: `activity-${a.id}`,
    title: a.next_action!,
    description: t('relationships:contacts.tasks.fromActivity', {
      type: a.activity_type,
      date: format(new Date(a.activity_date_time), 'MMM d, yyyy')
    }),
    due_date: a.next_action_due,
    is_completed: false,
    completed_at: null,
    source: 'activity',
    isActivityNextAction: true,
  }));

  const [isAdding, setIsAdding] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const contactPendingTasks = tasks?.filter(t => !t.is_completed) || [];
  const allPendingTasks: UnifiedTask[] = [
    ...contactPendingTasks.map(t => ({ ...t, source: (t as any).source || 'manual', isActivityNextAction: false }) as UnifiedTask),
    ...activityTasks,
  ];
  const pendingTasks = allPendingTasks;
  const completedTasks = tasks?.filter(t => t.is_completed) || [];

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;

    await createTask.mutateAsync({
      contact_id: contactId,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      due_date: newDueDate || null
    });

    setNewTitle('');
    setNewDescription('');
    setNewDueDate('');
    setIsAdding(false);
  };

  const handleStartEdit = (task: { id: string; title: string; description: string | null; due_date: string | null }) => {
    setEditingTaskId(task.id);
    setNewTitle(task.title);
    setNewDescription(task.description || '');
    setNewDueDate(task.due_date || '');
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setNewTitle('');
    setNewDescription('');
    setNewDueDate('');
  };

  const handleSaveEdit = async (taskId: string) => {
    if (!newTitle.trim()) return;

    await updateTask.mutateAsync({
      id: taskId,
      contact_id: contactId,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      due_date: newDueDate || null
    });

    handleCancelEdit();
  };

  const handleToggle = (taskId: string, currentState: boolean, taskTitle: string) => {
    toggleTask.mutate({
      id: taskId,
      contact_id: contactId,
      is_completed: !currentState,
      task_title: taskTitle
    });
  };

  const handleDelete = (taskId: string) => {
    deleteTask.mutate({ id: taskId, contact_id: contactId });
  };

  const getDueDateStatus = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = parseISO(dueDate);
    if (isToday(date)) return 'today';
    if (isPast(date)) return 'overdue';
    return 'upcoming';
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          {t('relationships:contacts.tasks.title')}
          {pendingTasks.length > 0 && (
            <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
              {pendingTasks.length}
            </span>
          )}
        </h3>
        {!isAdding && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-3 h-3" />
            {t('relationships:contacts.tasks.addTask')}
          </Button>
        )}
      </div>

      {/* Add Task Form */}
      {isAdding && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-3">
          <Input
            placeholder={t('relationships:contacts.tasks.taskTitlePlaceholder')}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <Textarea
            placeholder={t('relationships:contacts.tasks.descriptionPlaceholder')}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
          />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="h-8 text-sm w-auto"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setIsAdding(false);
                setNewTitle('');
                setNewDescription('');
                setNewDueDate('');
              }}
            >
              {t('common:buttons.cancel')}
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={handleAddTask}
              disabled={!newTitle.trim() || createTask.isPending}
            >
              {createTask.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('relationships:contacts.tasks.add')
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      {pendingTasks.length === 0 && !isAdding && (
        <p className="text-sm text-muted-foreground text-center py-4">
          {t('relationships:contacts.tasks.noTasks')}
        </p>
      )}

      <div className="space-y-2">
        {pendingTasks.map((task) => {
          const dueDateStatus = getDueDateStatus(task.due_date);
          const isEditing = editingTaskId === task.id;

          if (isEditing) {
            return (
              <div key={task.id} className="bg-muted/50 rounded-lg p-3 space-y-3">
                <Input
                  placeholder={t('relationships:contacts.tasks.taskTitlePlaceholder')}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Textarea
                  placeholder={t('relationships:contacts.tasks.descriptionPlaceholder')}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="min-h-[60px] text-sm resize-none"
                />
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="h-8 text-sm w-auto"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={handleCancelEdit}
                  >
                    {t('common:buttons.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => handleSaveEdit(task.id)}
                    disabled={!newTitle.trim() || updateTask.isPending}
                  >
                    {updateTask.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t('relationships:contacts.tasks.save')
                    )}
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={task.id}
              className="group p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={task.is_completed}
                  onCheckedChange={() => !task.isActivityNextAction && handleToggle(task.id, task.is_completed, task.title)}
                  className="mt-0.5"
                  disabled={task.isActivityNextAction}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{task.title}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {task.isActivityNextAction && (
                      <Badge variant="outline" className="text-xs gap-1 shrink-0">
                        <Video className="h-3 w-3" />
                        {t('relationships:contacts.tasks.meeting')}
                      </Badge>
                    )}
                    {!task.isActivityNextAction && (task as any).source === 'read_ai' && (
                      <Badge variant="outline" className="text-xs gap-1 shrink-0">
                        <Mic className="h-3 w-3" />
                        Read.ai
                      </Badge>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {task.description}
                    </p>
                  )}
                  {task.due_date && (
                    <span className={cn(
                      "text-xs mt-1 inline-flex items-center gap-1",
                      dueDateStatus === 'overdue' && "text-destructive",
                      dueDateStatus === 'today' && "text-warning",
                      dueDateStatus === 'upcoming' && "text-muted-foreground"
                    )}>
                      <Calendar className="w-3 h-3" />
                      {dueDateStatus === 'overdue' && t('relationships:contacts.tasks.overdue')}
                      {dueDateStatus === 'today' && t('relationships:contacts.tasks.dueToday')}
                      {dueDateStatus === 'upcoming' && format(parseISO(task.due_date), 'MMM d')}
                      {dueDateStatus === 'overdue' && format(parseISO(task.due_date), 'MMM d')}
                    </span>
                  )}
                </div>
              </div>
              {!task.isActivityNextAction && (
                <div className="flex items-center gap-1 mt-1 ml-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => handleStartEdit(task)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-muted-foreground">
              {showCompleted ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              {t('relationships:contacts.tasks.completedCount', { count: completedTasks.length })}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors opacity-60"
              >
                <Checkbox
                  checked={task.is_completed}
                  onCheckedChange={() => handleToggle(task.id, task.is_completed, task.title)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-through">{task.title}</p>
                  {task.completed_at && (
                    <span className="text-xs text-muted-foreground">
                      {t('relationships:contacts.tasks.completed')} {format(parseISO(task.completed_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(task.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
