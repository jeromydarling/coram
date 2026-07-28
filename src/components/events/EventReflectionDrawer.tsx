import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Feather, Loader2, Send, Trash2, X, Pencil, Eye, EyeOff, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useEventReflections,
  useAddEventReflection,
  useUpdateEventReflection,
  useDeleteEventReflection,
} from '@/hooks/useEventReflections';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface EventReflectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  opportunities?: Array<{ id: string; organization: string }>;
}

const CHAR_HARD_LIMIT = 6000;

export function EventReflectionDrawer({
  open,
  onOpenChange,
  eventId,
  eventName,
  opportunities = [],
}: EventReflectionDrawerProps) {
  const { t } = useTranslation('events');
  const { user } = useAuth();
  const { data: reflections, isLoading } = useEventReflections(open ? eventId : null);
  const addReflection = useAddEventReflection();
  const updateReflection = useUpdateEventReflection();
  const deleteReflection = useDeleteEventReflection();

  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'team' | 'private'>('team');
  const [linkedOppId, setLinkedOppId] = useState<string>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const submittingRef = useRef(false);

  const trimmed = body.trim();
  const overHard = trimmed.length > CHAR_HARD_LIMIT;

  const handleSubmit = async () => {
    if (!trimmed || overHard || submittingRef.current) return;
    submittingRef.current = true;
    try {
      await addReflection.mutateAsync({
        eventId,
        body: trimmed,
        visibility,
        opportunityId: linkedOppId !== 'none' ? linkedOppId : null,
      });
      setBody('');
      setLinkedOppId('none');
    } finally {
      submittingRef.current = false;
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editBody.trim()) return;
    await updateReflection.mutateAsync({
      id,
      body: editBody.trim(),
      eventId,
    });
    setEditingId(null);
    setEditBody('');
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-sm flex items-center gap-2">
              <Feather className="w-4 h-4 text-primary" />
              {t('reflection.title')}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <X className="h-3 w-3" />
              </Button>
            </DrawerClose>
          </div>
          <p className="text-xs text-muted-foreground truncate">{eventName}</p>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Existing reflections */}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : reflections && reflections.length > 0 ? (
            <div className="space-y-3">
              {reflections.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{r.author_name}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {r.visibility === 'private' ? (
                          <><EyeOff className="w-2.5 h-2.5 mr-0.5" /> {t('reflection.visibility.private')}</>
                        ) : (
                          <><Eye className="w-2.5 h-2.5 mr-0.5" /> {t('reflection.visibility.team')}</>
                        )}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {editingId === r.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editBody}
                        onChange={e => setEditBody(e.target.value)}
                        className="min-h-[60px] text-xs"
                        maxLength={CHAR_HARD_LIMIT}
                      />
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>
                          {t('reflection.cancel')}
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 text-[10px]"
                          disabled={!editBody.trim() || updateReflection.isPending}
                          onClick={() => handleUpdate(r.id)}
                        >
                          {t('reflection.save')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {r.body}
                    </p>
                  )}

                  {r.author_id === user?.id && editingId !== r.id && (
                    <div className="flex gap-1 pt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => { setEditingId(r.id); setEditBody(r.body); }}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive"
                        onClick={() => deleteReflection.mutate({ id: r.id, eventId })}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t('reflection.noReflections')}
            </p>
          )}

          {/* Add new reflection */}
          <div className="space-y-2 pt-2 border-t border-border/30">
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={t('reflection.placeholder')}
              className="min-h-[70px] text-xs"
              maxLength={CHAR_HARD_LIMIT + 100}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={visibility} onValueChange={v => setVisibility(v as 'team' | 'private')}>
                <SelectTrigger className="w-28 h-6 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">{t('reflection.visibility.team')}</SelectItem>
                  <SelectItem value="private">{t('reflection.visibility.private')}</SelectItem>
                </SelectContent>
              </Select>

              {opportunities.length > 0 && (
                <Select value={linkedOppId} onValueChange={setLinkedOppId}>
                  <SelectTrigger className="w-36 h-6 text-[10px]">
                    <Link2 className="w-2.5 h-2.5 mr-1" />
                    <SelectValue placeholder={t('reflection.linkToPartner')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('reflection.noLink')}</SelectItem>
                    {opportunities.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.organization}</SelectItem>
                    ))
                  }
                  </SelectContent>
                </Select>
              )}

              {trimmed.length > 0 && (
                <span className={cn(
                  'text-[10px]',
                  overHard ? 'text-destructive font-medium' : 'text-muted-foreground/60',
                )}>
                  {trimmed.length.toLocaleString()}/{CHAR_HARD_LIMIT.toLocaleString()}
                </span>
              )}
            </div>
            <Button
              size="sm"
              className="w-full gap-1.5 h-7 text-xs"
              disabled={!trimmed || overHard || addReflection.isPending}
              onClick={handleSubmit}
            >
              {addReflection.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {t('reflection.addReflection')}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
