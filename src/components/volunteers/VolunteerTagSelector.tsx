/**
 * VolunteerTagSelector — Tag management for a single volunteer.
 *
 * WHAT: Displays assigned tags and allows toggling/creating tags.
 * WHERE: Used in VolunteerDetail page.
 * WHY: Lightweight workflow adaptation without custom field bloat.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Tag, X, Check } from 'lucide-react';
import {
  useVolunteerTags,
  useVolunteerTagLinks,
  useCreateVolunteerTag,
  useToggleVolunteerTag,
  TAG_COLORS,
  type VolunteerTag,
} from '@/hooks/useVolunteerTags';

interface VolunteerTagSelectorProps {
  volunteerId: string;
}

export default function VolunteerTagSelector({ volunteerId }: VolunteerTagSelectorProps) {
  const { t } = useTranslation('volunteers');
  const { data: allTags = [] } = useVolunteerTags();
  const { data: linkedTagIds = [] } = useVolunteerTagLinks(volunteerId);
  const createTag = useCreateVolunteerTag();
  const toggleTag = useToggleVolunteerTag();

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);

  const linkedTags = allTags.filter((t) => linkedTagIds.includes(t.id));

  const handleToggle = (tag: VolunteerTag) => {
    const linked = linkedTagIds.includes(tag.id);
    toggleTag.mutate({ volunteerId, tagId: tag.id, linked });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (allTags.length >= 25) {
      return;
    }
    const created = await createTag.mutateAsync({ name: newName.trim(), color: newColor });
    if (created) {
      toggleTag.mutate({ volunteerId, tagId: created.id, linked: false });
    }
    setNewName('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {linkedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="gap-1 text-xs cursor-pointer hover:opacity-80"
          style={{ borderColor: tag.color, color: tag.color }}
          onClick={() => handleToggle(tag)}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
          {tag.name}
          <X className="h-3 w-3 ml-0.5" />
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
            <Tag className="h-3 w-3 mr-1" />
            {linkedTags.length === 0 ? t('tagSelector.addTags') : '+'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {t('tagSelector.tagsCount', { count: allTags.length })}
          </p>

          {/* Existing tags */}
          <div className="space-y-1 max-h-48 overflow-y-auto mb-3">
            {allTags.map((tag) => {
              const isLinked = linkedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => handleToggle(tag)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-left"
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 truncate">{tag.name}</span>
                  {isLinked && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                </button>
              );
            })}
            {allTags.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">{t('tagSelector.noTagsYet')}</p>
            )}
          </div>

          {/* Create new tag */}
          {allTags.length < 25 && (
            <div className="border-t pt-2 space-y-2">
              <div className="flex gap-1.5">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('tagSelector.placeholder')}
                  className="h-7 text-xs"
                  maxLength={30}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={handleCreate}
                  disabled={!newName.trim() || createTag.isPending}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {TAG_COLORS.map((c) => (
                  <Tooltip key={c}>
                    <TooltipTrigger asChild>
                      <button
                        className="w-4 h-4 rounded-full border transition-transform"
                        style={{
                          backgroundColor: c,
                          borderColor: newColor === c ? 'var(--foreground)' : 'transparent',
                          transform: newColor === c ? 'scale(1.3)' : 'scale(1)',
                        }}
                        onClick={() => setNewColor(c)}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">{c}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
