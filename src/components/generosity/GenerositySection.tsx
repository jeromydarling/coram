/**
 * GenerositySection — Person-level generosity memory panel.
 *
 * WHAT: Toggle + chronological list of generosity records with lifetime total.
 * WHERE: PersonDetail, below contact info.
 * WHY: Relational memory of financial generosity. Not donor management.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import {
  useGenerosityRecords,
  useCreateGenerosityRecord,
  useDeleteGenerosityRecord,
  useToggleGenerosity,
} from '@/hooks/useGenerosity';

interface Props {
  contactId: string;
  contactName: string;
  hasGivenFinancially: boolean;
}

export function GenerositySection({ contactId, contactName, hasGivenFinancially }: Props) {
  const toggle = useToggleGenerosity();
  const { data: records, isLoading } = useGenerosityRecords(hasGivenFinancially ? contactId : undefined);
  const createRecord = useCreateGenerosityRecord();
  const deleteRecord = useDeleteGenerosityRecord();

  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formRecurring, setFormRecurring] = useState(false);
  const [formFrequency, setFormFrequency] = useState<string>('');
  const [formNote, setFormNote] = useState('');

  const lifetimeTotal = records?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;
  const mostRecent = records?.[0];
  const hasRecurring = records?.some(r => r.is_recurring);

  const resetForm = () => {
    setFormDate('');
    setFormAmount('');
    setFormRecurring(false);
    setFormFrequency('');
    setFormNote('');
    setShowForm(false);
  };

  const handleSubmit = () => {
    const amount = parseFloat(formAmount);
    if (!formDate || isNaN(amount) || amount <= 0) return;
    createRecord.mutate({
      contact_id: contactId,
      gift_date: formDate,
      amount,
      is_recurring: formRecurring,
      recurring_frequency: formRecurring && formFrequency ? formFrequency : null,
      note: formNote || undefined,
    }, { onSuccess: resetForm });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Generosity
            <HelpTooltip
              what="Relational memory of financial generosity for this person."
              where="Person profile, below contact information."
              why="Remembering generosity honors the relationship. This is memory, not fundraising."
            />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="generosity-toggle" className="text-xs text-muted-foreground">
              This person has given financially
            </Label>
            <Switch
              id="generosity-toggle"
              checked={hasGivenFinancially}
              onCheckedChange={(checked) => toggle.mutate({ contactId, value: checked })}
            />
          </div>
        </div>
      </CardHeader>

      {hasGivenFinancially && (
        <CardContent className="space-y-4">
          {/* Summary line */}
          {records && records.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>
                Lifetime total: <span className="text-foreground font-medium">${lifetimeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </span>
              {mostRecent && (
                <span>
                  Most recent: <span className="text-foreground">{format(new Date(mostRecent.gift_date), 'MMM d, yyyy')}</span>
                </span>
              )}
              {hasRecurring && (
                <span className="text-foreground">Recurring</span>
              )}
            </div>
          )}

          {/* Records list */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : records && records.length > 0 ? (
            <div className="space-y-1">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30 text-sm group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-muted-foreground shrink-0">{format(new Date(r.gift_date), 'MMM d, yyyy')}</span>
                    <span className="font-medium">${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {r.is_recurring && (
                      <span className="text-xs text-muted-foreground">
                        {r.recurring_frequency === 'monthly' ? 'Monthly' : r.recurring_frequency === 'annual' ? 'Annual' : 'Recurring'}
                      </span>
                    )}
                    {r.note && (
                      <span className="text-muted-foreground truncate">{r.note}</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteRecord.mutate({ id: r.id, contactId })}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No records yet.</p>
          )}

          {/* Add form */}
          {showForm ? (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/10">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formRecurring}
                  onCheckedChange={setFormRecurring}
                  id="recurring-toggle"
                />
                <Label htmlFor="recurring-toggle" className="text-xs">Recurring</Label>
                {formRecurring && (
                  <Select value={formFrequency} onValueChange={setFormFrequency}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue placeholder="Frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                  className="text-sm"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!formDate || !formAmount || createRecord.isPending}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add record
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
