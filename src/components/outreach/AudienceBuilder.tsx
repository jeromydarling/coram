import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Filter, Users, Building2, Mail } from 'lucide-react';
import { OpportunityFilters } from './OpportunityFilters';
import { ManualEmailEntry } from './ManualEmailEntry';
import { useEmailSegments, useCreateEmailSegment, type SegmentDefinition } from '@/hooks/useEmailSegments';
import { useBuildAudience } from '@/hooks/useGmailCampaignSend';
import { useOpportunities } from '@/hooks/useOpportunities';
import { MultiSelect } from '@/components/ui/multi-select';
import { toast } from '@/components/ui/sonner';

interface AudienceBuilderProps {
  campaignId: string;
  onAudienceBuilt?: (count: number) => void;
}

export function AudienceBuilder({ campaignId, onAudienceBuilt }: AudienceBuilderProps) {
  const [definition, setDefinition] = useState<SegmentDefinition>({ has_email_only: true });
  const [manualEmails, setManualEmails] = useState('');
  const [segmentName, setSegmentName] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const { data: segments = [] } = useEmailSegments();
  const { data: opportunities = [] } = useOpportunities();
  const createSegment = useCreateEmailSegment();
  const buildAudience = useBuildAudience();

  const opportunityOptions = opportunities.map((o) => ({
    label: o.organization,
    value: o.id,
  }));

  const handleLoadSegment = (segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (segment) {
      setDefinition(segment.definition);
      setSelectedSegmentId(segmentId);
    }
  };

  const handleSaveSegment = async () => {
    if (!segmentName.trim()) {
      toast.error('Enter a segment name');
      return;
    }
    await createSegment.mutateAsync({
      name: segmentName.trim(),
      definition,
    });
    setSegmentName('');
  };

  const handleBuildAudience = async () => {
    const result = await buildAudience.mutateAsync({
      campaignId,
      definition,
      manualEmails: manualEmails || undefined,
    });
    onAudienceBuilt?.(result.audience_count);
  };

  const hasFilters = 
    (definition.partner_tiers?.length ?? 0) > 0 ||
    (definition.metro_ids?.length ?? 0) > 0 ||
    (definition.opportunity_ids?.length ?? 0) > 0 ||
    manualEmails.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Audience Builder
        </CardTitle>
        <CardDescription>
          Define who should receive this campaign
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="filters" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="filters" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </TabsTrigger>
            <TabsTrigger value="segments" className="flex items-center gap-1">
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Segments</span>
            </TabsTrigger>
            <TabsTrigger value="orgs" className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Orgs</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Manual</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="filters" className="space-y-4">
            <OpportunityFilters value={definition} onChange={setDefinition} />
          </TabsContent>

          <TabsContent value="segments" className="space-y-4">
            {segments.length > 0 ? (
              <ScrollArea className="h-48 rounded border p-2">
                <div className="space-y-2">
                  {segments.map((segment) => (
                    <div
                      key={segment.id}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-accent ${
                        selectedSegmentId === segment.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => handleLoadSegment(segment.id)}
                    >
                      <div>
                        <p className="font-medium">{segment.name}</p>
                        {segment.description && (
                          <p className="text-xs text-muted-foreground">{segment.description}</p>
                        )}
                      </div>
                      {selectedSegmentId === segment.id && (
                        <Badge variant="secondary">Loaded</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">No saved segments yet.</p>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Segment name..."
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleSaveSegment}
                disabled={!segmentName.trim() || !hasFilters || createSegment.isPending}
              >
                {createSegment.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="orgs" className="space-y-4">
            <div className="space-y-2">
              <Label>Select Organizations</Label>
              <MultiSelect
                options={opportunityOptions}
                selected={definition.opportunity_ids || []}
                onChange={(ids) => setDefinition({ ...definition, opportunity_ids: ids })}
                placeholder="Search organizations..."
              />
              <p className="text-xs text-muted-foreground">
                All contacts from selected organizations will be included.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <ManualEmailEntry value={manualEmails} onChange={setManualEmails} />
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-4 border-t">
          <Button
            onClick={handleBuildAudience}
            disabled={!hasFilters || buildAudience.isPending}
            className="w-full"
          >
            {buildAudience.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Building Audience...
              </>
            ) : (
              'Build Audience'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
