import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Globe, Pencil, History, ShieldCheck, ChevronDown, RefreshCw, MapPin } from 'lucide-react';
import { useOrgKnowledge, useRefreshOrgKnowledge, useUpdateOrgKnowledge, useFindOrgAddress } from '@/hooks/useOrgKnowledge';
import { format } from 'date-fns';

interface OrgKnowledgePanelProps {
  orgId: string;
  orgName: string;
  websiteUrl?: string;
}

export function OrgKnowledgePanel({ orgId, orgName, websiteUrl }: OrgKnowledgePanelProps) {
  const { data, isLoading } = useOrgKnowledge(orgId);
  const refreshMutation = useRefreshOrgKnowledge();
  const updateMutation = useUpdateOrgKnowledge();
  const findAddressMutation = useFindOrgAddress();

  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [refreshUrl, setRefreshUrl] = useState(websiteUrl || '');

  const snapshot = data?.snapshot;
  const history = data?.history || [];
  const profile = snapshot?.structured_json;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Organization Knowledge
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshUrl(websiteUrl || snapshot?.source_url || '');
                setShowRefreshDialog(true);
              }}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Globe className="w-3 h-3 mr-1" />
              )}
              Bootstrap
            </Button>
            {snapshot && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditDialog(true)}
              >
                <Pencil className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!snapshot ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No authoritative profile yet.</p>
            <p className="text-xs mt-1">Bootstrap from the organization's website to get started.</p>
          </div>
        ) : (
          <>
            {/* Meta */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">v{snapshot.version}</Badge>
              <Badge variant="secondary" className="text-xs">
                {snapshot.source_type === 'firecrawl_bootstrap' ? 'Web Bootstrap' : 'Admin Curated'}
              </Badge>
              <span>Updated {format(new Date(snapshot.updated_at), 'MMM d, yyyy')}</span>
            </div>

            {/* Profile display */}
            {profile && (
              <div className="space-y-3">
                {profile.org_name && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Organization</p>
                    <p className="text-sm">{profile.org_name}</p>
                  </div>
                )}
                {profile.mission && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Mission</p>
                    <p className="text-sm">{profile.mission}</p>
                  </div>
                )}
                {profile.positioning && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Positioning</p>
                    <p className="text-sm">{profile.positioning}</p>
                  </div>
                )}
                {(profile.who_we_serve || profile.who_they_serve)?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Who We Serve</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(profile.who_we_serve || profile.who_they_serve)?.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile.programs?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Programs</p>
                    <div className="space-y-1 mt-1">
                      {profile.programs.map((p, i) => (
                        <p key={i} className="text-xs"><span className="font-medium">{p.name}:</span> {p.summary}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile.key_stats?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Key Stats</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {profile.key_stats.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{s.label}: {s.value}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile.approved_claims?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Approved Claims</p>
                    <ul className="text-xs mt-1 space-y-0.5">
                      {profile.approved_claims.map((c, i) => (
                        <li key={i} className="text-success">✓ {c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {profile.tone_keywords?.length ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Tone</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profile.tone_keywords.map((t, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile.headquarters && (profile.headquarters.city || profile.headquarters.state || profile.headquarters.zip) ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Headquarters</p>
                    {(() => {
                      const parts = [profile.headquarters!.address_line1, profile.headquarters!.city, profile.headquarters!.state, profile.headquarters!.zip].filter(Boolean).join(', ');
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
                      return (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                          {parts}
                          <Globe className="w-3 h-3" />
                        </a>
                      );
                    })()}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Headquarters</p>
                    {findAddressMutation.data?.found && findAddressMutation.data?.headquarters ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const hq = findAddressMutation.data.headquarters;
                            const parts = [hq.address_line1, hq.city, hq.state, hq.zip].filter(Boolean).join(', ');
                            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
                            return (
                              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                                {parts}
                                <Globe className="w-3 h-3" />
                              </a>
                            );
                          })()}
                          <Badge variant="outline" className="text-xs">{findAddressMutation.data.confidence}</Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const hq = findAddressMutation.data!.headquarters!;
                            updateMutation.mutate({
                              orgId,
                              patch: { headquarters: hq },
                              notes: `AI address lookup (confidence: ${findAddressMutation.data!.confidence})`,
                            });
                          }}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Save Address
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={() => findAddressMutation.mutate({ orgId, orgName, websiteUrl: websiteUrl || snapshot?.source_url })}
                        disabled={findAddressMutation.isPending}
                      >
                        {findAddressMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <MapPin className="w-3 h-3 mr-1" />
                        )}
                        {findAddressMutation.isPending ? 'Searching...' : 'Find Address'}
                      </Button>
                    )}
                    {findAddressMutation.data && !findAddressMutation.data.found && (
                      <p className="text-xs text-muted-foreground mt-1">Could not find address. You can add it manually via Edit.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Version History */}
            {history.length > 1 && (
              <Collapsible open={showHistory} onOpenChange={setShowHistory}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <History className="w-3 h-3" />
                      Version History ({history.length})
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 mt-2">
                    {history.map((v) => (
                      <div key={v.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">v{v.version}</Badge>
                          <span className="text-muted-foreground">
                            {v.source_type === 'firecrawl_bootstrap' ? 'Web' : 'Manual'}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {format(new Date(v.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>

      {/* Refresh Dialog */}
      <RefreshDialog
        open={showRefreshDialog}
        onOpenChange={setShowRefreshDialog}
        url={refreshUrl}
        onUrlChange={setRefreshUrl}
        onConfirm={() => {
          refreshMutation.mutate({ orgId, sourceUrl: refreshUrl });
          setShowRefreshDialog(false);
        }}
        isPending={refreshMutation.isPending}
      />

      {/* Edit Dialog */}
      {snapshot && profile && (
        <EditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          profile={profile as unknown as Record<string, unknown>}
          orgId={orgId}
          onSave={(patch, notes) => {
            updateMutation.mutate({ orgId, patch, notes });
            setShowEditDialog(false);
          }}
          isPending={updateMutation.isPending}
        />
      )}
    </Card>
  );
}

function RefreshDialog({
  open,
  onOpenChange,
  url,
  onUrlChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  onUrlChange: (v: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bootstrap from Website</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This will scrape the website and extract organizational information using AI. Previous versions remain in history.
          </p>
          <Input
            placeholder="https://example.org"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={!url.trim() || isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Bootstrap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  open,
  onOpenChange,
  profile,
  orgId,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: Record<string, unknown>;
  orgId: string;
  onSave: (patch: Record<string, unknown>, notes: string) => void;
  isPending: boolean;
}) {
  const [mission, setMission] = useState((profile.mission as string) || '');
  const [positioning, setPositioning] = useState((profile.positioning as string) || '');
  const [approvedClaims, setApprovedClaims] = useState(
    ((profile.approved_claims as string[]) || []).join('\n')
  );
  const [toneKeywords, setToneKeywords] = useState(
    ((profile.tone_keywords as string[]) || []).join(', ')
  );
  const hq = (profile.headquarters as Record<string, string>) || {};
  const [hqAddress, setHqAddress] = useState(hq.address_line1 || '');
  const [hqCity, setHqCity] = useState(hq.city || '');
  const [hqState, setHqState] = useState(hq.state || '');
  const [hqZip, setHqZip] = useState(hq.zip || '');
  const [notes, setNotes] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Organization Knowledge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Mission</label>
            <Textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={3} />
          </div>
          <div>
            <label className="text-sm font-medium">Positioning</label>
            <Textarea value={positioning} onChange={(e) => setPositioning(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="text-sm font-medium">Approved Claims (one per line)</label>
            <Textarea value={approvedClaims} onChange={(e) => setApprovedClaims(e.target.value)} rows={4} placeholder="One claim per line" />
          </div>
          <div>
            <label className="text-sm font-medium">Tone Keywords (comma-separated)</label>
            <Input value={toneKeywords} onChange={(e) => setToneKeywords(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Headquarters</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input value={hqAddress} onChange={(e) => setHqAddress(e.target.value)} placeholder="Street address" className="col-span-2" />
              <Input value={hqCity} onChange={(e) => setHqCity(e.target.value)} placeholder="City" />
              <div className="flex gap-2">
                <Input value={hqState} onChange={(e) => setHqState(e.target.value)} placeholder="State" className="w-20" />
                <Input value={hqZip} onChange={(e) => setHqZip(e.target.value)} placeholder="ZIP" className="flex-1" />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Change Notes (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this change?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const patch: Record<string, unknown> = {};
              if (mission !== (profile.mission || '')) patch.mission = mission;
              if (positioning !== (profile.positioning || '')) patch.positioning = positioning;
              const claimsArr = approvedClaims.split('\n').map(s => s.trim()).filter(Boolean);
              patch.approved_claims = claimsArr;
              const toneArr = toneKeywords.split(',').map(s => s.trim()).filter(Boolean);
              patch.tone_keywords = toneArr;
              const headquarters = { address_line1: hqAddress, city: hqCity, state: hqState, zip: hqZip };
              if (hqCity || hqState || hqZip || hqAddress) patch.headquarters = headquarters;
              onSave(patch, notes);
            }}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
