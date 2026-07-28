/**
 * CommunioRequestsTab — Async help requests between Communio tenants.
 *
 * WHAT: Tenants post requests for help; others reply asynchronously.
 * WHERE: Communio → Requests tab.
 * WHY: Human network support without live chat complexity.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Plus, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'events', label: 'Events & Gatherings' },
  { value: 'volunteers', label: 'Volunteers' },
  { value: 'resources', label: 'Resources & Tools' },
  { value: 'partnerships', label: 'Partnerships' },
  { value: 'advice', label: 'Advice & Experience' },
];

export default function CommunioRequestsTab() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['communio-requests', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: replies } = useQuery({
    queryKey: ['communio-replies', tenantId, expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data, error } = await supabase
        .from('communio_replies')
        .select('*')
        .eq('request_id', expandedId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!tenantId && !!expandedId,
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { error } = await supabase.from('communio_requests').insert({
        tenant_id: tenantId,
        title: title.trim().slice(0, 200),
        body: body.trim().slice(0, 2000),
        category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Request shared with the network');
      setTitle('');
      setBody('');
      setCategory('general');
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['communio-requests', tenantId] });
    },
    onError: () => toast.error('Could not post request'),
  });

  const createReply = useMutation({
    mutationFn: async (requestId: string) => {
      if (!tenantId) throw new Error('No tenant');
      const { error } = await supabase.from('communio_replies').insert({
        request_id: requestId,
        tenant_id: tenantId,
        body: replyText.trim().slice(0, 2000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Reply shared');
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['communio-replies', tenantId, expandedId] });
    },
    onError: () => toast.error('Could not post reply'),
  });

  return (
    <div className="space-y-4">
      {/* New Request */}
      {!showForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Share a Request
        </Button>
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">What are you looking for help with?</p>
            <Input
              placeholder="A short title for your request"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
            />
            <Textarea
              placeholder="Share more detail — what would be most helpful?"
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={2000}
              rows={3}
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createRequest.mutate()}
                disabled={!title.trim() || createRequest.isPending}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Share
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading requests…</p>
      ) : requests && requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((r: any) => {
            const isExpanded = expandedId === r.id;
            return (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-3">
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {CATEGORIES.find(c => c.value === r.category)?.label || r.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), 'MMM d')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{r.title}</p>
                      {r.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.body}</p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    )}
                  </div>

                  {/* Expanded: replies */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t space-y-3">
                      {replies && replies.length > 0 ? (
                        replies.map((rep: any) => (
                          <div key={rep.id} className="pl-3 border-l-2 border-muted">
                            <p className="text-sm text-foreground">{rep.body}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(rep.created_at), 'MMM d · h:mm a')}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No replies yet — be the first to offer support.
                        </p>
                      )}

                      {/* Reply form */}
                      {tenantId && r.tenant_id !== tenantId && (
                        <div className="flex gap-2 pt-2">
                          <Textarea
                            placeholder="Share a thought or offer help…"
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            maxLength={2000}
                            rows={2}
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => createReply.mutate(r.id)}
                            disabled={!replyText.trim() || createReply.isPending}
                            className="self-end"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-serif">
              No requests yet. When someone in the network needs help, their request will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
