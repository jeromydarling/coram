import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Target, Handshake, DollarSign, AlertTriangle, MessageSquare, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';

interface ProspectPackCardProps {
  opportunityId: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

interface ProspectPack {
  org_summary?: string;
  mission_snapshot?: string;
  partnership_angles?: string[];
  grant_alignments?: string[];
  suggested_outreach_angle?: string;
  risks_notes?: string[];
}

export function ProspectPackCard({ opportunityId, onRegenerate, isRegenerating }: ProspectPackCardProps) {
  const { data: packRow, isLoading } = useQuery({
    queryKey: ['prospect-pack', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospect_packs')
        .select('pack_json, created_at')
        .eq('entity_id', opportunityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;

  if (!packRow) {
    if (!onRegenerate) return null;
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 flex flex-col items-center gap-3 text-center">
          <FileText className="w-8 h-8 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium">No Prospect Pack yet</p>
            <p className="text-xs text-muted-foreground mt-1">Generate a strategic briefing for this organization</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Generating…' : 'Generate Prospect Pack'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pack = packRow.pack_json as unknown as ProspectPack;
  if (!pack) return null;

  // Determine if array items are long-form (paragraphs) vs short tags
  const isLongForm = (items: string[]) => items.some(i => i.length > 60);

  const sections = [
    {
      icon: FileText,
      title: 'Summary',
      content: pack.org_summary,
      type: 'text' as const,
    },
    {
      icon: Target,
      title: 'Mission Alignment',
      content: pack.mission_snapshot,
      type: 'text' as const,
    },
    {
      icon: Handshake,
      title: 'Partnership Angles',
      content: pack.partnership_angles,
      type: (pack.partnership_angles && isLongForm(pack.partnership_angles) ? 'prose-list' : 'list') as 'prose-list' | 'list',
    },
    {
      icon: DollarSign,
      title: 'Grant Alignments',
      content: pack.grant_alignments,
      type: (pack.grant_alignments && isLongForm(pack.grant_alignments) ? 'prose-list' : 'list') as 'prose-list' | 'list',
    },
    {
      icon: MessageSquare,
      title: 'Suggested Outreach',
      content: pack.suggested_outreach_angle,
      type: 'text' as const,
    },
    {
      icon: AlertTriangle,
      title: 'Risks & Notes',
      content: pack.risks_notes,
      type: (pack.risks_notes && isLongForm(pack.risks_notes) ? 'prose-list' : 'list') as 'prose-list' | 'list',
    },
  ].filter(s => {
    if (Array.isArray(s.content)) return s.content.length > 0;
    return !!s.content;
  });

  if (sections.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-primary" />
            </div>
            Prospect Pack
          </CardTitle>
          <div className="flex items-center gap-2">
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground">
              {format(parseISO(packRow.created_at), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <section.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">{section.title}</p>
            </div>
            {section.type === 'text' ? (
              <p className="text-sm leading-relaxed">{section.content as string}</p>
            ) : section.type === 'prose-list' ? (
              <ul className="space-y-2 ml-1">
                {(section.content as string[]).map((item, idx) => {
                  // Split on first colon to get a bolded label
                  const colonIdx = item.indexOf(':');
                  const hasLabel = colonIdx > 0 && colonIdx < 60;
                  return (
                    <li key={idx} className="text-sm leading-relaxed pl-3 border-l-2 border-primary/20">
                      {hasLabel ? (
                        <>
                          <span className="font-medium">{item.slice(0, colonIdx)}</span>
                          <span className="text-muted-foreground">: {item.slice(colonIdx + 1).trim()}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{item}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(section.content as string[]).map((item, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-xs font-normal whitespace-normal text-left h-auto py-1"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
