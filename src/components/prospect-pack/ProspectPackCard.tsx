import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Target, Handshake, Award, Lightbulb, AlertTriangle, Loader2 } from 'lucide-react';
import { GrantAlignmentPanel } from '@/components/opportunity/GrantAlignmentPanel';

interface ProspectPack {
  org_summary?: string;
  mission_snapshot?: string;
  partnership_angles?: string[];
  grant_alignments?: string[];
  suggested_outreach_angle?: string;
  risks_notes?: string[];
}

interface ProspectPackCardProps {
  entityId: string;
  entityType?: string;
}

export function ProspectPackCard({ entityId, entityType = 'opportunity' }: ProspectPackCardProps) {
  const { data: pack, isLoading } = useQuery({
    queryKey: ['prospect-pack', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospect_packs')
        .select('*')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!pack) return null;

  const packData = pack.pack_json as unknown as ProspectPack;
  if (!packData || (!packData.org_summary && !packData.mission_snapshot)) return null;

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" />
          Prospect Pack
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Org Summary */}
        {packData.org_summary && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Target className="w-3 h-3" /> Organization Summary
            </p>
            <p className="text-sm">{packData.org_summary}</p>
          </div>
        )}

        {/* Mission Snapshot */}
        {packData.mission_snapshot && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Mission Snapshot</p>
            <p className="text-sm">{packData.mission_snapshot}</p>
          </div>
        )}

        {/* Partnership Angles */}
        {packData.partnership_angles && packData.partnership_angles.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Handshake className="w-3 h-3" /> Partnership Angles
            </p>
            <div className="flex flex-wrap gap-1">
              {packData.partnership_angles.map((angle, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {angle}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Grant Alignments */}
        {packData.grant_alignments && packData.grant_alignments.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Award className="w-3 h-3" /> Grant Alignments
            </p>
            <div className="flex flex-wrap gap-1">
              {packData.grant_alignments.map((grant, i) => (
                <Badge key={i} className="text-xs bg-success/15 text-success">
                  {grant}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Outreach */}
        {packData.suggested_outreach_angle && (
          <div className="bg-primary/5 rounded-lg p-3">
            <p className="text-sm font-medium text-primary mb-1 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Suggested Outreach Angle
            </p>
            <p className="text-sm">{packData.suggested_outreach_angle}</p>
          </div>
        )}

        {/* Risks / Notes */}
        {packData.risks_notes && packData.risks_notes.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Risks & Notes
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {packData.risks_notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Generated {new Date(pack.created_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>

    {/* F9: Grant Fit Scores from grant_alignment table */}
    {entityType === 'opportunity' && (
      <GrantAlignmentPanel orgId={entityId} />
    )}
    </>
  );
}
