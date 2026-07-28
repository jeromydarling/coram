import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mail, X, Clock, Sparkles, Search } from 'lucide-react';
import { useCampaignSuggestions, useSuggestionAction } from '@/hooks/useCampaignSuggestions';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';

export function SuggestedOutreachFeed() {
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const { data: suggestions, isLoading } = useCampaignSuggestions({ status: statusFilter });
  const action = useSuggestionAction();
  const { hasAnyRole } = useAuth();
  const navigate = useNavigate();

  const canAct = hasAnyRole(['admin', 'leadership', 'regional_lead', 'staff']);

  const filtered = (suggestions ?? []).filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return s.title.toLowerCase().includes(term) ||
      s.reason.toLowerCase().includes(term) ||
      s.org_id.toLowerCase().includes(term);
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Suggested Outreach
          <Badge variant="secondary" className="ml-1 text-xs">{filtered.length}</Badge>
        </CardTitle>
        <div className="flex gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="h-8 pl-8 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
              <SelectItem value="snoozed">Snoozed</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No suggestions found
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filtered.map((s) => (
              <div key={s.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.reason}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {Math.round(s.confidence * 100)}%
                    </Badge>
                    <Badge
                      variant={s.status === 'open' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {s.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(parseISO(s.created_at), 'MMM d, yyyy')}
                  {s.converted_campaign_id && (
                    <span className="ml-2 text-primary cursor-pointer" onClick={() => navigate(`/outreach/campaigns/${s.converted_campaign_id}`)}>
                      → View campaign
                    </span>
                  )}
                </div>
                {canAct && s.status === 'open' && (
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs gap-1"
                      disabled={action.isPending}
                      onClick={async () => {
                        const result = await action.mutateAsync({
                          suggestion_id: s.id,
                          action: 'convert',
                        });
                        if (result?.campaign_id) {
                          navigate(`/outreach/campaigns/${result.campaign_id}`);
                        }
                      }}
                    >
                      <Mail className="w-3 h-3" />
                      Create Draft
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ suggestion_id: s.id, action: 'snooze', days: 7 })}
                    >
                      <Clock className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ suggestion_id: s.id, action: 'dismiss' })}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
