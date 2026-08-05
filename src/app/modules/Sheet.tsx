/**
 * A turf, on paper.
 *
 * Reached from People. Its whole job is to look right coming out of a printer,
 * so it is its own route rather than a dialog — a dialog printed from inside
 * the shell brings the navigation rail with it, and a rail rendered in ink is
 * the reason most web apps' print output goes in the bin.
 *
 * ---------------------------------------------------------------------------
 * There is no walk list here, and it is worth saying why on the screen
 * ---------------------------------------------------------------------------
 *
 * A walk list in the canvassing sense is addresses in door order, and Coram
 * does not store a street address — see the note in the API route, and §3.7,
 * which forbids one permanently. Rather than let somebody hunt for a feature
 * that cannot exist, the screen says so and says where the addresses do come
 * from. A tool that quietly lacks the thing you came for is worse than one that
 * tells you.
 *
 * ---------------------------------------------------------------------------
 * The phone column is off unless you ask
 * ---------------------------------------------------------------------------
 *
 * A sheet left in a car is the most ordinary way an organizing group loses a
 * list, and a sheet without numbers on it loses much less. Turning the column
 * on is one checkbox and it is logged separately in the audit trail, which is
 * the honest arrangement: not forbidden, not free.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Failed, Loading } from '@/components/coram/State';
import { apiWithNotice, api, day } from '@/lib/api';

interface Turf {
  id: string;
  name: string;
  contacts: number;
  mine: boolean;
}

interface SheetRow {
  display_name: string;
  postal_code: string | null;
  phone: string | null;
  last_interaction_at: string | null;
  due_at: string | null;
  owed: string | null;
}

/** The route puts the turf's name and the phone flag beside the rows. */
interface SheetMeta {
  turf: string;
  withPhones: boolean;
}

export function Sheet() {
  const [params, setParams] = useSearchParams();
  const turfId = params.get('turf') ?? '';
  const [phones, setPhones] = useState(false);

  const turfs = useQuery({ queryKey: ['turfs'], queryFn: () => api<Turf[]>('/workspace/turfs') });

  const sheet = useQuery({
    queryKey: ['sheet', turfId, phones],
    enabled: Boolean(turfId),
    // apiWithNotice rather than api: the turf's name comes back beside the
    // rows rather than inside them, and `api` drops everything but `data`.
    queryFn: () =>
      apiWithNotice<SheetRow[], SheetMeta>(
        `/organizing/sheet?turf=${turfId}&phones=${phones ? 1 : 0}`,
      ),
  });

  const rows = sheet.data?.data ?? [];
  // The server's name for the turf, not the picker's — they are the same today
  // and the server's is the one that describes the rows actually returned.
  const turfName = sheet.data?.meta.turf ?? turfs.data?.find((t) => t.id === turfId)?.name ?? '';

  return (
    <>
      {/*
        Everything in this block is screen-only. The printed page starts at the
        sheet itself — no controls, no navigation, no button that says Print.
      */}
      <div className="print:hidden">
        <Link
          to="/people"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to people
        </Link>

        <h1 className="font-display text-3xl">A turf, on paper</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Who is on the list, what was last said to them, and what somebody still owes them — with
          a column to write in.
        </p>

        <div className="tone-rule mt-6 h-px w-full" />

        <div className="mt-6 flex flex-wrap items-end gap-6">
          <div className="space-y-2">
            <Label htmlFor="sheet-turf">Turf</Label>
            <Select
              value={turfId}
              onValueChange={(v) => setParams(v ? { turf: v } : {})}
            >
              <SelectTrigger id="sheet-turf" className="w-72">
                <SelectValue placeholder={turfs.isLoading ? 'Loading turfs…' : 'Pick a turf'} />
              </SelectTrigger>
              <SelectContent>
                {turfs.data?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.contacts} {t.contacts === 1 ? 'person' : 'people'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="sheet-phones"
              checked={phones}
              onCheckedChange={(v) => setPhones(v === true)}
            />
            <Label htmlFor="sheet-phones" className="font-normal">
              Include phone numbers
            </Label>
          </div>

          <Button
            className="ml-auto"
            disabled={!turfId || sheet.isLoading}
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        {phones && (
          <p className="mt-4 max-w-prose text-sm text-flame">
            Phone numbers on paper leave the building and cannot be recalled. This is recorded in
            the audit log as a separate kind of read, so the workspace can see it happened.
          </p>
        )}

        {/*
          The absent feature, named. See the file header — a tool that quietly
          lacks the thing you came for is worse than one that tells you.
        */}
        <div className="paper mt-8 max-w-prose px-5 py-4 text-sm">
          <p className="font-medium">This is not a door-knocking list.</p>
          <p className="mt-1 text-muted-foreground">
            Coram holds no street addresses — the finest location on any record is a postal code,
            and that is a permanent commitment rather than a gap we mean to fill. The addresses a
            canvasser walks come from your voter file or from the building itself, and they stay
            with you. This sheet is our half: who is on your list and what is owed to them.
          </p>
        </div>
      </div>

      {!turfId ? null : sheet.isLoading ? (
        <div className="mt-8 print:hidden">
          <Loading rows={4} label="Building the sheet" />
        </div>
      ) : sheet.isError ? (
        <div className="mt-8 print:hidden">
          <Failed error={sheet.error} what="We could not build that sheet" />
        </div>
      ) : (
        <div className="mt-10">
          {/*
            The printed sheet. `print:` variants do the work: the container
            loses its card, the type drops to something that survives a laser
            printer, and the write-in column is a real column rather than a
            border somebody has to imagine.
          */}
          <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-foreground/20 pb-3">
            <h2 className="font-display text-2xl print:text-xl">{turfName}</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? 'person' : 'people'} · printed{' '}
              {new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </header>

          {/*
            The line that matters if this ends up somewhere it should not.
            Printed, deliberately — it is useless on a screen and it is the
            first thing a person who finds the sheet should read.
          */}
          <p className="mb-5 hidden text-[10pt] leading-snug print:block">
            This sheet lists members of an organization. If you have found it and it is not yours,
            please destroy it. If it is yours, do not leave it in a vehicle, and shred it when the
            shift is over.
          </p>

          {rows.length === 0 ? (
            <p className="text-muted-foreground print:hidden">
              Nobody is assigned to this turf yet, or it is not one of yours.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm print:text-[10pt]">
              <thead>
                <tr className="border-b border-foreground/20 text-left">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  {phones && <th className="py-2 pr-3 font-medium">Phone</th>}
                  <th className="py-2 pr-3 font-medium">Area</th>
                  <th className="py-2 pr-3 font-medium">Last spoke</th>
                  <th className="py-2 pr-3 font-medium">Owed</th>
                  <th className="w-1/4 py-2 font-medium">What happened</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={`${row.display_name}-${i}`}
                    className="border-b border-foreground/10 print:break-inside-avoid"
                  >
                    <td className="py-2.5 pr-3">{row.display_name}</td>
                    {phones && <td className="py-2.5 pr-3">{row.phone ?? '—'}</td>}
                    <td className="py-2.5 pr-3 text-muted-foreground">{row.postal_code ?? '—'}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {row.last_interaction_at ? day(row.last_interaction_at) : 'never'}
                    </td>
                    <td className="py-2.5 pr-3">
                      {row.owed ? (
                        <>
                          {row.owed}
                          {row.due_at && (
                            <span className="text-muted-foreground"> · due {day(row.due_at)}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* An empty cell with a rule under it, which is what a pen needs. */}
                    <td className="py-2.5" />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
