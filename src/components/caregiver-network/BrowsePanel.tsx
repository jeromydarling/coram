/**
 * BrowsePanel — Browse opted-in caregiver profiles.
 *
 * WHAT: Card-based directory of nearby caregivers with filters + pagination.
 * WHERE: CaregiverNetworkPage "Browse" tab.
 * WHY: Safe discovery — approximate region only, no exact locations.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Send, Flag, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useBrowseCaregivers, useSendRequest, useSubmitReport, useCaregiverProfile } from '@/hooks/useCaregiverNetwork';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export default function BrowsePanel() {
  const [stateFilter, setStateFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const { data: profiles = [], isLoading } = useBrowseCaregivers({
    state: stateFilter && stateFilter !== 'all' ? stateFilter : undefined,
    page,
  });
  const { data: myProfile } = useCaregiverProfile();
  const sendRequest = useSendRequest();
  const submitReport = useSubmitReport();

  const [sendTo, setSendTo] = useState<{ id: string; name: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');

  const handleSend = async () => {
    if (!sendTo || !noteText.trim()) return;
    try {
      await sendRequest.mutateAsync({ to_profile_id: sendTo.id, message: noteText.trim() });
      toast.success('Your note has been sent gently.');
      setSendTo(null);
      setNoteText('');
    } catch (err: any) {
      toast.error(err?.message || 'Could not send right now. Please try again.');
    }
  };

  const handleReport = async () => {
    if (!reportTarget || !reportReason.trim()) return;
    try {
      await submitReport.mutateAsync({ reported_profile_id: reportTarget, reason: reportReason.trim() });
      toast.success('Thank you. We will review this.');
      setReportTarget(null);
      setReportReason('');
    } catch {
      toast.error('Could not submit report.');
    }
  };

  // Reset page when filter changes
  const handleStateChange = (val: string) => {
    setStateFilter(val);
    setPage(0);
  };

  // Filter out own profile
  const visible = profiles.filter(p => p.id !== myProfile?.id);
  const PAGE_SIZE = 20;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Filter by state</label>
          <Select value={stateFilter} onValueChange={handleStateChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {US_STATES.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Looking for caregivers…</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No caregivers found in this area yet.</p>
          <p className="text-xs mt-1">That's perfectly fine — the network is still growing.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.display_name || 'A caregiver'}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {p.base_city ? `${p.base_city}, ${p.base_state_code}` : p.base_state_code || 'Region not shared'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-7"
                    onClick={() => setReportTarget(p.id)}
                  >
                    <Flag className="h-3 w-3" />
                  </Button>
                </div>

                {p.bio_short && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.bio_short}</p>
                )}

                <div className="flex flex-wrap gap-1">
                  {(p.availability_tags || []).slice(0, 3).map(t => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                  {(p.support_needs || []).slice(0, 2).map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5 mt-1"
                  onClick={() => setSendTo({ id: p.id, name: p.display_name || 'this caregiver' })}
                >
                  <Send className="h-3 w-3" />
                  Send a gentle note
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && (visible.length > 0 || page > 0) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-3 w-3" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1"
            disabled={profiles.length < PAGE_SIZE}
            onClick={() => setPage(p => p + 1)}
          >
            Next <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Send Note Dialog */}
      <Dialog open={!!sendTo} onOpenChange={() => { setSendTo(null); setNoteText(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send a note to {sendTo?.name}</DialogTitle>
            <DialogDescription>
              This is a mediated message — your contact information stays private unless you choose to share it later.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Introduce yourself briefly…"
            maxLength={500}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSendTo(null); setNoteText(''); }}>Cancel</Button>
            <Button onClick={handleSend} disabled={sendRequest.isPending || !noteText.trim()}>
              {sendRequest.isPending ? 'Sending…' : 'Send Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={!!reportTarget} onOpenChange={() => { setReportTarget(null); setReportReason(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report this profile</DialogTitle>
            <DialogDescription>
              If something seems inappropriate or unsafe, let us know. We take every report seriously.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            placeholder="Describe the concern…"
            maxLength={500}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReportTarget(null); setReportReason(''); }}>Cancel</Button>
            <Button onClick={handleReport} disabled={submitReport.isPending || !reportReason.trim()}>
              {submitReport.isPending ? 'Submitting…' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
