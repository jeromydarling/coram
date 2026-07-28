import { useState } from 'react';
import { Anchor, Plus, Trash2, Link2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  useGrantAnchorLinks, 
  useCreateGrantAnchorLink, 
  useDeleteGrantAnchorLink 
} from '@/hooks/useGrantAnchorLinks';
import { useAnchors } from '@/hooks/useAnchors';
import { cn } from '@/lib/utils';

interface LinkedAnchorsPanelProps {
  grantId: string;
  grantName: string;
}

type LinkType = 'funded' | 'supported' | 'influenced';

export function LinkedAnchorsPanel({ grantId, grantName }: LinkedAnchorsPanelProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>('');
  const [linkType, setLinkType] = useState<LinkType>('supported');
  const [notes, setNotes] = useState('');
  
  const { data: links, isLoading } = useGrantAnchorLinks(grantId);
  const { data: allAnchors } = useAnchors();
  const createLink = useCreateGrantAnchorLink();
  const deleteLink = useDeleteGrantAnchorLink();
  
  // Filter out already linked anchors
  const linkedAnchorIds = new Set(links?.map(l => l.anchor_id) || []);
  const availableAnchors = allAnchors?.filter(a => !linkedAnchorIds.has(a.id)) || [];
  
  const handleAddLink = async () => {
    if (!selectedAnchorId) return;
    
    await createLink.mutateAsync({
      grant_id: grantId,
      anchor_id: selectedAnchorId,
      link_type: linkType,
      notes: notes || undefined
    });
    
    setIsAddModalOpen(false);
    setSelectedAnchorId('');
    setLinkType('supported');
    setNotes('');
  };
  
  const handleDeleteLink = async (linkId: string, anchorName: string) => {
    await deleteLink.mutateAsync({
      id: linkId,
      entityName: `${grantName} ↔ ${anchorName}`
    });
  };
  
  const getLinkTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      'funded': 'bg-success/15 text-success',
      'supported': 'bg-primary/15 text-primary',
      'influenced': 'bg-info/15 text-info'
    };
    return styles[type] || 'bg-muted text-muted-foreground';
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Anchor className="w-4 h-4" />
          Linked Anchors
        </h4>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsAddModalOpen(true)}
          disabled={availableAnchors.length === 0}
        >
          <Plus className="w-4 h-4 mr-1" />
          Link Anchor
        </Button>
      </div>
      
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : links && links.length > 0 ? (
        <div className="space-y-3">
          {links.map((link) => {
            const anchorName = link.anchors?.opportunities?.organization || link.anchors?.anchor_id || 'Unknown';
            const metro = link.anchors?.metros?.metro;
            const tier = link.anchors?.anchor_tier;
            const avgVolume = link.anchors?.avg_monthly_volume;
            
            return (
              <div 
                key={link.id} 
                className="flex items-start justify-between p-3 bg-muted/50 rounded-lg group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{anchorName}</span>
                    <Badge className={cn('text-xs', getLinkTypeBadge(link.link_type))}>
                      {link.link_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {metro && <span>{metro}</span>}
                    {tier && <span>{tier}</span>}
                    {avgVolume !== null && avgVolume !== undefined && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {avgVolume}/mo avg
                      </span>
                    )}
                  </div>
                  {link.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{link.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => handleDeleteLink(link.id, anchorName)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No anchors linked to this grant yet.</p>
          <p className="text-xs mt-1">Link anchors to track grant impact on production.</p>
        </div>
      )}
      
      {/* Add Link Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Anchor to Grant</DialogTitle>
            <DialogDescription>
              Connect an anchor to track how this grant impacts their production.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Anchor</Label>
              <Select value={selectedAnchorId} onValueChange={setSelectedAnchorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an anchor..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAnchors.map((anchor) => (
                    <SelectItem key={anchor.id} value={anchor.id}>
                      {anchor.organization || anchor.anchor_id} ({anchor.metro})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Link Type</Label>
              <Select value={linkType} onValueChange={(v) => setLinkType(v as LinkType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="funded">Funded — Direct funding provided</SelectItem>
                  <SelectItem value="supported">Supported — Grant supports operations</SelectItem>
                  <SelectItem value="influenced">Influenced — Grant accelerated partnership</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How does this grant relate to the anchor?"
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddLink} 
              disabled={!selectedAnchorId || createLink.isPending}
            >
              Link Anchor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
