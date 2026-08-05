/**
 * CSV import: pick a file, map the columns, see exactly what will happen, then
 * decide (§5.1).
 *
 * The dry run is the whole point. Importing someone else's spreadsheet into a
 * list of real people is the operation most likely to quietly wreck a database,
 * and every import tool that says "312 rows imported" after the fact is telling
 * you too late. So the preview is a full per-row account — create, update, skip
 * and why — and nothing is written until the second button.
 *
 * The rows are sent twice, once to preview and once to commit, and are never
 * stored in between. Parking an uploaded list of people in R2 between two
 * requests would make a second copy of exactly the data §3 is most careful
 * about, with its own retention story to get wrong.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ArrowLeft, Undo2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Figure, PageHeader, Section } from '@/components/coram/Page';
import { Failed, Loading } from '@/components/coram/State';
import { api, day, post, words } from '@/lib/api';
import { failed, say } from '@/lib/notify';
import { MODULES } from '@/lib/modules';
import { parseCSV } from '@/lib/csv';
import {
  IMPORTABLE_FIELDS,
  type ImportableField,
  type ImportPreview,
} from '@shared/schemas/contacts';

const MODULE = MODULES.find((m) => m.path === '/people')!;

const FIELD_LABEL: Record<ImportableField, string> = {
  displayName: 'Name',
  email: 'Email',
  phone: 'Phone',
  postalCode: 'Postal code',
};

/** Header text a person actually writes, mapped to the field they meant. */
function guess(header: string): ImportableField | undefined {
  const h = header.toLowerCase().replace(/[^a-z]/g, '');
  if (/^(name|fullname|displayname|firstname|contact)/.test(h)) return 'displayName';
  if (h.includes('email') || h === 'mail') return 'email';
  if (h.includes('phone') || h.includes('mobile') || h.includes('cell')) return 'phone';
  if (h.includes('zip') || h.includes('postal') || h === 'postcode') return 'postalCode';
  return undefined;
}

interface Batch {
  id: string;
  label: string;
  status: string;
  row_count: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  created_at: string;
}

export function PeopleImport() {
  const client = useQueryClient();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportableField>>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [label, setLabel] = useState('');
  const [onDuplicate, setOnDuplicate] = useState<'skip' | 'update'>('skip');

  const batches = useQuery({ queryKey: ['imports'], queryFn: () => api<Batch[]>('/imports') });

  const runPreview = useMutation({
    mutationFn: () => post<ImportPreview>('/imports/preview', { mapping, rows }),
    onSuccess: setPreview,
    onError: (e: Error) => failed('Could not check that file', e),
  });

  const commit = useMutation({
    mutationFn: () =>
      post<{ created: number; updated: number; skipped: number }>('/imports/commit', {
        label,
        mapping,
        rows,
        onDuplicate,
      }),
    onSuccess: (r) => {
      say(
        `${r.created} added, ${r.updated} updated`,
        r.skipped ? `${r.skipped} rows skipped.` : undefined,
      );
      setRows([]);
      setHeaders([]);
      setPreview(null);
      setLabel('');
      void client.invalidateQueries({ queryKey: ['imports'] });
      void client.invalidateQueries({ queryKey: ['contacts'] });
      void client.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (e: Error) => failed('Nothing was imported', e),
  });

  const rollback = useMutation({
    mutationFn: (id: string) => post(`/imports/${id}/rollback`),
    onSuccess: () => {
      say('Rolled back', 'Everything that import created has been removed.');
      void client.invalidateQueries({ queryKey: ['imports'] });
      void client.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (e: Error) => failed('Could not roll that back', e),
  });

  async function onFile(file: File) {
    setPreview(null);
    const parsed = await parseCSV(file);
    setHeaders(parsed.headers);
    setRows(parsed.rows as Record<string, string>[]);
    setMapping(
      Object.fromEntries(
        parsed.headers.map((h) => [h, guess(h)]).filter((pair): pair is [string, ImportableField] =>
          Boolean(pair[1]),
        ),
      ),
    );
    setLabel(file.name.replace(/\.csv$/i, ''));
  }

  const mapped = Object.values(mapping).length;

  return (
    <>
      <PageHeader
        module={MODULE}
        title="Import a CSV"
        description="You will see exactly what this does to the list before it does any of it."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/people">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to people
            </Link>
          </Button>
        }
      />

      <Section title="1. The file">
        <Input
          type="file"
          accept=".csv,text/csv"
          aria-label="Choose a CSV file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
          className="max-w-sm"
        />
        {rows.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {rows.length} rows, {headers.length} columns. The file stays in this tab until you
            commit.
          </p>
        )}
      </Section>

      {headers.length > 0 && (
        <Section
          title="2. The columns"
          hint="Anything left unmapped is dropped rather than guessed at."
        >
          <div className="paper divide-y">
            {headers.map((h) => (
              <div key={h} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{h}</span>
                <span className="text-muted-foreground">→</span>
                <Select
                  value={mapping[h] ?? 'ignore'}
                  onValueChange={(v) =>
                    setMapping((m) => {
                      const next = { ...m };
                      if (v === 'ignore') delete next[h];
                      else next[h] = v as ImportableField;
                      setPreview(null);
                      return next;
                    })
                  }
                >
                  <SelectTrigger className="w-44" aria-label={`Map column ${h}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ignore">Ignore this column</SelectItem>
                    {IMPORTABLE_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FIELD_LABEL[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Four fields, and that is the whole list. Coram has nowhere to put a date of birth, an
            employer, an income band or a street address, so a column holding one cannot be
            imported by accident.
          </p>
          <Button
            className="mt-4"
            disabled={!mapped || runPreview.isPending}
            onClick={() => runPreview.mutate()}
          >
            {runPreview.isPending ? 'Checking…' : 'Check what this would do'}
          </Button>
        </Section>
      )}

      {preview && (
        <Section title="3. What would happen" hint="Nothing has been written yet.">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Figure value={preview.creates} label="New people" />
            <Figure value={preview.updates} label="Updated" />
            <Figure value={preview.skips} label="Skipped" />
          </div>

          {preview.overContactLimit && (
            <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm">
              This would take the workspace to {preview.overContactLimit.current +
                preview.overContactLimit.wouldAdd}{' '}
              contacts, past the {preview.overContactLimit.limit} the free tier carries. The commit
              will refuse and nothing will be imported.
            </p>
          )}

          <div className="paper max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>What happens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.slice(0, 200).map((r) => (
                  <TableRow key={r.row}>
                    <TableCell className="tabular-nums text-muted-foreground">{r.row}</TableCell>
                    <TableCell>{r.displayName ?? '—'}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {r.email ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.action === 'skip' ? 'secondary' : 'outline'}
                        className="font-normal"
                      >
                        {r.action === 'create' ? 'Add' : r.action === 'update' ? 'Update' : 'Skip'}
                      </Badge>
                      {r.reason && (
                        <span className="ml-2 text-sm text-muted-foreground">{r.reason}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {preview.rows.length > 200 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the first 200 of {preview.rows.length} rows. The commit covers all of them.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="label">Call this import</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-64"
                placeholder="Clipboard from the March meeting"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dupe">When the email already exists</Label>
              <Select value={onDuplicate} onValueChange={(v) => setOnDuplicate(v as 'skip' | 'update')}>
                <SelectTrigger id="dupe" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Leave the existing record</SelectItem>
                  <SelectItem value="update">Update it from the file</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button disabled={!label.trim() || commit.isPending} onClick={() => commit.mutate()}>
              {commit.isPending ? 'Importing…' : 'Import for real'}
            </Button>
          </div>
        </Section>
      )}

      <Section title="Past imports" hint="Every one can be undone.">
        {batches.isLoading ? (
          <Loading rows={2} />
        ) : batches.isError ? (
          <Failed error={batches.error} />
        ) : batches.data?.length ? (
          <div className="paper divide-y">
            {batches.data.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="font-medium">{b.label}</span>
                <span className="text-sm text-muted-foreground">
                  {b.created_count} added · {b.updated_count} updated · {b.skipped_count} skipped ·{' '}
                  {day(b.created_at)}
                </span>
                <Badge variant="secondary" className="font-normal">
                  {words(b.status)}
                </Badge>
                {b.status === 'committed' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    disabled={rollback.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Roll back "${b.label}"? The ${b.created_count} people it created are deleted. Records it updated stay as they are.`,
                        )
                      ) {
                        rollback.mutate(b.id);
                      }
                    }}
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Roll back
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        )}
      </Section>
    </>
  );
}
