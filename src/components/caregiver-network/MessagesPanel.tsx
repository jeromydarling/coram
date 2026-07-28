/**
 * MessagesPanel — Mediated messaging for accepted caregiver connections.
 *
 * WHAT: Thread-based messaging between connected caregivers.
 * WHERE: CaregiverNetworkPage "Messages" tab.
 * WHY: Safe, mediated communication — no direct contact exchange required.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Flag, ArrowLeft, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useMyRequests, useNetworkMessages, useSendMessage, useSubmitReport } from '@/hooks/useCaregiverNetwork';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export default function MessagesPanel() {
  const { data: requests } = useMyRequests();
  const { user } = useAuth();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const { data: messages = [] } = useNetworkMessages(activeRequestId);
  const sendMessage = useSendMessage();
  const submitReport = useSubmitReport();
  const [msgText, setMsgText] = useState('');
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');

  // FIX #3: Deduplicate threads — merge incoming+outgoing by request ID
  const accepted = useMemo(() => {
    const seen = new Set<string>();
    const threads: any[] = [];
    const all = [
      ...(requests?.incoming?.filter((r: any) => r.status === 'accepted') ?? []),
      ...(requests?.outgoing?.filter((r: any) => r.status === 'accepted') ?? []),
    ];
    for (const req of all) {
      if (!seen.has(req.id)) {
        seen.add(req.id);
        // Determine the OTHER person's name
        const otherName = req.sender_display_name
          || req.caregiver_profiles?.display_name
          || 'A caregiver';
        threads.push({ ...req, thread_name: otherName });
      }
    }
    return threads;
  }, [requests]);

  const handleSend = async () => {
    if (!activeRequestId || !msgText.trim()) return;
    try {
      await sendMessage.mutateAsync({ request_id: activeRequestId, body: msgText.trim() });
      setMsgText('');
    } catch {
      toast.error('Could not send message.');
    }
  };

  const handleReport = async () => {
    if (!reportMsg || !reportReason.trim()) return;
    try {
      await submitReport.mutateAsync({ reported_message_id: reportMsg, reason: reportReason.trim() });
      toast.success('Message reported. We will review it.');
      setReportMsg(null);
      setReportReason('');
    } catch {
      toast.error('Could not submit report.');
    }
  };

  // Thread list view
  if (!activeRequestId) {
    return (
      <div className="space-y-3">
        {accepted.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No conversations yet.</p>
            <p className="text-xs mt-1">Once a connection request is accepted, you can message here.</p>
          </div>
        ) : (
          accepted.map((req: any) => (
            <Card
              key={req.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveRequestId(req.id)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <MessageCircle className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {req.thread_name}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">Connected</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  // Thread detail view
  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setActiveRequestId(null)}>
        <ArrowLeft className="h-3 w-3" /> Back to conversations
      </Button>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {messages.map((m: any) => {
          const isMe = m.sender_user_id === user?.id;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-2.5 rounded-lg text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p>{m.body}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] opacity-60">
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </span>
                  {!isMe && (
                    <button
                      className="text-[10px] opacity-40 hover:opacity-100 transition-opacity"
                      onClick={() => setReportMsg(m.id)}
                    >
                      <Flag className="h-2.5 w-2.5 inline" /> report
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div className="flex gap-2">
        <Input
          value={msgText}
          onChange={e => setMsgText(e.target.value)}
          placeholder="Type a message…"
          maxLength={1000}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <Button size="sm" onClick={handleSend} disabled={sendMessage.isPending || !msgText.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Report dialog */}
      <Dialog open={!!reportMsg} onOpenChange={() => { setReportMsg(null); setReportReason(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report this message</DialogTitle>
            <DialogDescription>
              By reporting, this message will be shared with our moderation team for review.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            placeholder="What concerns you about this message?"
            maxLength={500}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReportMsg(null); setReportReason(''); }}>Cancel</Button>
            <Button onClick={handleReport} disabled={submitReport.isPending || !reportReason.trim()}>
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
