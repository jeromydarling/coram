/**
 * The design studio: a flyer or a social card, in the group's own colours.
 *
 * Not a twelfth module. §5 is a closed list of eleven and modules.test.ts
 * enforces it; this is a Brand surface built from Convocare data, which is the
 * same arrangement the flyer composer already had — it just had no screen.
 *
 * The reason it is worth building at all: a group with no designer either
 * produces a flyer in Word that looks like it was produced in Word, or produces
 * nothing. The difference between those two and a decent one is the difference
 * between twelve people at a meeting and forty. Everything here already existed
 * as an API; what was missing was somewhere to press it.
 *
 * Three positions the interface holds:
 *
 *   - A generated backdrop never contains a person. That is enforced in the
 *     prompt and in the negative prompt, and it is a rule rather than a
 *     default: a flyer for a real union carrying an invented photorealistic
 *     "member" is a claim somebody has to defend on a doorstep.
 *   - The scrim has a floor. The contrast gate in brand.ts checks ink against
 *     surface; putting a photograph behind the surface invalidates the ratio it
 *     verified, so at least 45% of the surface always survives.
 *   - Coram does not post. The share sheet is the operating system's and the
 *     links are ordinary compose URLs. We hold no credentials to a group's
 *     public voice and are not going to.
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, Download, Image as ImageIcon, Languages, Share2, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Guarantee, PageHeader, Section } from '@/components/coram/Page';
import { Failed, Loading } from '@/components/coram/State';
import { api, post, postWithNotice, when as fmt, type EventRow } from '@/lib/api';
import { failed, say } from '@/lib/notify';
import { canShareFiles, download, intents, shareFile, svgToPng } from '@/lib/share';
import { toneVar } from '@/lib/modules';
import { TRANSLATION_CAVEAT } from '@shared/languages';

interface StudioConfig {
  templates: { id: string; name: string; blurb: string }[];
  sizes: { id: string; name: string; width: number; height: number; blurb: string }[];
  channels: { id: string; name: string; limit: number }[];
  backdrops: { id: string; name: string; blurb: string }[];
  canGenerate: boolean;
}

interface ShareKit {
  drafts: { channel: string; name: string; limit: number; text: string | null; length: number | null; fits: boolean }[];
}

type Kind = 'flyer' | 'social';

export function Studio() {
  const [kind, setKind] = useState<Kind>('flyer');
  const [template, setTemplate] = useState('meeting');
  const [size, setSize] = useState('square');
  const [headline, setHeadline] = useState('');
  const [whenText, setWhenText] = useState('');
  const [where, setWhere] = useState('');
  const [detail, setDetail] = useState('');
  const [cta, setCta] = useState('');
  const [link, setLink] = useState('');
  const [backdrop, setBackdrop] = useState<string>();
  const [scrim, setScrim] = useState(0.72);
  const [svg, setSvg] = useState<string>();

  const config = useQuery({ queryKey: ['studio'], queryFn: () => api<StudioConfig>('/brand/studio') });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventRow[]>('/events') });

  const compose = useMutation({
    mutationFn: () =>
      post<{ svg: string }>('/brand/compose', {
        kind,
        ...(kind === 'flyer' ? { template } : { size }),
        headline: headline.trim(),
        when: whenText.trim() || (kind === 'flyer' ? '—' : undefined),
        where: where.trim() || (kind === 'flyer' ? '—' : undefined),
        ...(kind === 'flyer' && detail.trim() ? { detail: detail.trim() } : {}),
        ...(cta.trim() ? { cta: cta.trim() } : {}),
        ...(backdrop ? { backdrop, scrim } : {}),
      }),
    onSuccess: (r) => setSvg(r.svg),
    onError: (e: Error) => failed('Could not draw that', e),
  });

  const generate = useMutation({
    mutationFn: (style: string) =>
      postWithNotice<{ backdrop: string }, { remaining?: number }>('/brand/backdrop', { style }),
    onSuccess: (r) => {
      setBackdrop(r.data.backdrop);
      setSvg(undefined);
      say('Background made.', `${r.meta.remaining ?? 0} left today. We keep no copy.`);
    },
    onError: (e: Error) => failed('No background', e),
  });

  /** Prefill from a real event, which is where most flyers come from anyway. */
  function fromEvent(id: string) {
    const e = events.data?.find((row) => row.id === id);
    if (!e) return;
    setHeadline(e.title);
    setWhenText(fmt(e.starts_at));
    setWhere(e.location_name ?? '');
    setSvg(undefined);
  }

  const ready = headline.trim().length > 0;
  const current = config.data?.sizes.find((s) => s.id === size);

  return (
    <div style={toneVar('gold')}>
      <PageHeader
        title="Studio"
        description="A flyer for a pole, or a card for a feed. Your colours, your words, and a file you can take anywhere — Coram does not post on your behalf and holds no account of yours."
        actions={
          <Tabs value={kind} onValueChange={(v) => { setKind(v as Kind); setSvg(undefined); }}>
            <TabsList>
              <TabsTrigger value="flyer">Flyer</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {config.isLoading && <Loading rows={3} />}
      {config.isError && <Failed error={config.error} what="The studio would not load" />}

      {config.data && (
        <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
          <div>
            <Section title="What it says">
              <div className="space-y-4">
                {(events.data?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="from-event">Start from an event</Label>
                    <Select onValueChange={fromEvent}>
                      <SelectTrigger id="from-event">
                        <SelectValue placeholder="Pick one, or write it by hand" />
                      </SelectTrigger>
                      <SelectContent>
                        {events.data?.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Textarea
                    id="headline"
                    rows={2}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Our building is going to the rent board"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="when">When</Label>
                  <Input id="when" value={whenText} onChange={(e) => setWhenText(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="where">Where</Label>
                  <Input id="where" value={where} onChange={(e) => setWhere(e.target.value)} />
                </div>
                {kind === 'flyer' && (
                  <div className="space-y-2">
                    <Label htmlFor="detail">One more line</Label>
                    <Input id="detail" value={detail} onChange={(e) => setDetail(e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="cta">Where to go next</Label>
                  <Input
                    id="cta"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    placeholder="eastsidetenants.org · 555-0142"
                  />
                </div>
              </div>
            </Section>

            <Section title="How it looks">
              <div className="space-y-4">
                {kind === 'flyer' ? (
                  <div className="space-y-2">
                    <Label htmlFor="template">Template</Label>
                    <Select value={template} onValueChange={(v) => { setTemplate(v); setSvg(undefined); }}>
                      <SelectTrigger id="template">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {config.data.templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} — {t.blurb}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="size">Shape</Label>
                    <Select value={size} onValueChange={(v) => { setSize(v); setSvg(undefined); }}>
                      <SelectTrigger id="size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {config.data.sizes.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} · {s.width}×{s.height} — {s.blurb}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {config.data.canGenerate && (
                  <div className="rounded-lg border border-dashed p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <ImageIcon aria-hidden className="h-4 w-4 text-gold" />
                      Generate a background
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      Texture, an empty room, a street. Never a person — an invented face on a real
                      group’s flyer is something somebody has to defend at a door, and you have
                      photographs of actual members.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {config.data.backdrops.map((b) => (
                        <Button
                          key={b.id}
                          size="sm"
                          variant="outline"
                          title={b.blurb}
                          disabled={generate.isPending}
                          onClick={() => generate.mutate(b.id)}
                        >
                          {generate.isPending ? 'Drawing…' : b.name}
                        </Button>
                      ))}
                    </div>
                    {backdrop && (
                      <div className="mt-4 space-y-2">
                        <Label htmlFor="scrim">How much of it shows</Label>
                        <Slider
                          id="scrim"
                          min={45}
                          max={100}
                          step={5}
                          value={[Math.round((1 - scrim) * 100) + 45]}
                          onValueChange={([v]) => {
                            setScrim(1 - (v - 45) / 100);
                            setSvg(undefined);
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Never all the way. Your colours were checked for contrast against a plain
                          background; a photograph behind them undoes that, so some of it always
                          stays.
                        </p>
                        <Button size="sm" variant="ghost" onClick={() => { setBackdrop(undefined); setSvg(undefined); }}>
                          Remove the background
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <Button className="w-full" disabled={!ready || compose.isPending} onClick={() => compose.mutate()}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {compose.isPending ? 'Drawing…' : svg ? 'Redraw' : 'Draw it'}
                </Button>
              </div>
            </Section>
          </div>

          <div>
            <Section title="Preview">
              {svg ? (
                <div
                  /*
                   * [&>svg] scales the composed image down to the column.
                   *
                   * The SVG carries its true size — 1080 square, or 816×1056
                   * for a flyer — because that is what makes the downloaded
                   * file correct. Injected as markup it honours that width and
                   * runs off the right edge of the panel on any laptop, which
                   * is what a screenshot of this screen caught. Constraining it
                   * here keeps the file at full size and the preview in its box.
                   */
                  className="paper overflow-hidden p-3 [&>svg]:h-auto [&>svg]:w-full"
                  // Composed by our own Worker from validated input and
                  // contains no script; the backdrop is a data URI we
                  // generated. Rendering it as markup is what makes the preview
                  // live rather than a picture of one.
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <div className="rounded-lg border border-dashed px-6 py-16 text-center">
                  <p className="text-sm text-muted-foreground">
                    {ready ? 'Press “Draw it”.' : 'Write a headline and it will appear here.'}
                  </p>
                </div>
              )}

              {svg && (
                <Exports
                  svg={svg}
                  kind={kind}
                  headline={headline}
                  link={link}
                  onLink={setLink}
                  sizeLabel={kind === 'social' ? `${current?.width}×${current?.height}` : 'US Letter'}
                />
              )}
            </Section>

            {svg && <Translate text={[headline, whenText, where, detail].filter(Boolean).join('\n')} />}
          </div>
        </div>
      )}

      <Guarantee>
        Coram does not hold your social accounts and will not post as you. An access token that can
        speak for a tenants union is a subpoena target, a compromise vector, and something a
        platform can revoke the week you become inconvenient — so the studio makes the file and you
        post it.
      </Guarantee>
    </div>
  );
}

function Exports({
  svg,
  kind,
  headline,
  link,
  onLink,
  sizeLabel,
}: {
  svg: string;
  kind: Kind;
  headline: string;
  link: string;
  onLink: (v: string) => void;
  sizeLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const slug = headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

  const kit = useQuery({
    queryKey: ['share-kit', headline, link],
    queryFn: () =>
      api<ShareKit>(
        `/brand/share-kit?${new URLSearchParams({
          headline,
          when: '—',
          where: '—',
          ...(link ? { link } : {}),
        })}`,
      ),
    enabled: headline.trim().length > 0,
  });

  async function withPng(run: (file: File) => Promise<void> | void) {
    setBusy(true);
    try {
      const { blob } = await svgToPng(svg, kind === 'flyer' ? 2 : 1);
      await run(new File([blob], `${slug || 'coram'}.png`, { type: 'image/png' }));
    } catch (e) {
      failed('Could not make the image', e as Error);
    } finally {
      setBusy(false);
    }
  }

  const first = kit.data?.drafts.find((d) => d.fits && d.text)?.text ?? headline;

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={() => void withPng((f) => download(f, f.name))}>
          <Download className="mr-2 h-4 w-4" />
          {busy ? 'Rendering…' : 'PNG'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            download(new Blob([svg], { type: 'image/svg+xml' }), `${slug || 'coram'}.svg`)
          }
        >
          <Download className="mr-2 h-4 w-4" />
          SVG
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void withPng(async (file) => {
              if (!(await shareFile(file, first))) {
                download(file, file.name);
                say('Downloaded instead.', 'This browser will not open a share sheet.');
              }
            })
          }
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
        <span className="text-xs text-muted-foreground">
          {sizeLabel}
          {kind === 'flyer' ? ' · prints without scaling' : ''}
        </span>
      </div>

      {!canShareFiles([new File([], 'x.png', { type: 'image/png' })]) && (
        <p className="mt-2 text-xs text-muted-foreground">
          This browser has no share sheet, so Share will download the file instead. On a phone it
          opens everything you already have, including Signal.
        </p>
      )}

      <div className="mt-6 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="link">A link to include</Label>
          <Input
            id="link"
            value={link}
            onChange={(e) => onLink(e.target.value)}
            placeholder="https://…  (optional)"
          />
        </div>

        {kit.data && (
          <div className="paper divide-y">
            {kit.data.drafts.map((d) => (
              <div key={d.channel} className="px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {d.length ?? '—'}/{d.limit}
                  </span>
                  {!d.fits && (
                    <Badge variant="destructive" className="text-[0.65rem]">
                      too long
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7"
                    disabled={!d.text}
                    onClick={() => {
                      void navigator.clipboard.writeText(d.text ?? '');
                      say('Copied.');
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {d.text ?? 'Shorten the headline and this will fit.'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {intents(first, link || undefined).map((i) =>
            i.href ? (
              <Button key={i.id} size="sm" variant="outline" asChild>
                <a href={i.href} target="_blank" rel="noreferrer noopener">
                  {i.name}
                </a>
              </Button>
            ) : (
              <Button key={i.id} size="sm" variant="ghost" disabled title={i.unavailable}>
                {i.name}
              </Button>
            ),
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          These open a compose window with the words already in it. They do not sign you in to
          anything and Coram never sees whether you posted. Attach the image you downloaded.
        </p>
      </div>
    </>
  );
}

/**
 * Translation, at the point where a flyer is finished.
 *
 * The single highest-value thing the model does here, and the least glamorous.
 * A union whose block speaks Spanish, Cantonese and Vietnamese currently picks
 * one, or sends it in English and wonders why half the building did not come.
 */
function Translate({ text }: { text: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [out, setOut] = useState<
    { code: string; ok: boolean; name?: string; endonym?: string; rtl?: boolean; text?: string; error?: string }[]
  >();

  const languages = useQuery({
    queryKey: ['languages'],
    queryFn: async () => (await import('@shared/languages')).LANGUAGES,
  });

  const run = useMutation({
    mutationFn: () => post<{ translations: typeof out }>('/scriba/translate', { text, languages: picked }),
    onSuccess: (r) => setOut(r.translations),
    onError: (e: Error) => failed('No translation', e),
  });

  return (
    <Section
      title="Say it in the languages on the block"
      hint="Redacted before it is sent, like everything else that reaches the model."
    >
      <div className="flex flex-wrap gap-1.5">
        {languages.data?.map((l) => (
          <Button
            key={l.code}
            size="sm"
            variant={picked.includes(l.code) ? 'default' : 'outline'}
            onClick={() =>
              setPicked((p) => (p.includes(l.code) ? p.filter((c) => c !== l.code) : [...p, l.code]))
            }
          >
            {l.name}
          </Button>
        ))}
      </div>

      <Button
        className="mt-3"
        size="sm"
        disabled={!picked.length || run.isPending}
        onClick={() => run.mutate()}
      >
        <Languages className="mr-2 h-4 w-4" />
        {run.isPending ? 'Translating…' : `Translate into ${picked.length || 0}`}
      </Button>

      {out && (
        <>
          <div className="mt-4 space-y-2">
            {out.map((t) => (
              <div key={t.code} className="paper px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.name} · {t.endonym}
                </p>
                {t.ok ? (
                  <p
                    lang={t.code}
                    dir={t.rtl ? 'rtl' : undefined}
                    className="mt-1.5 whitespace-pre-wrap text-[0.95rem] leading-relaxed"
                  >
                    {t.text}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-destructive">{t.error}</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg border border-gold/40 bg-gold/[0.08] px-4 py-3 text-sm leading-relaxed">
            {TRANSLATION_CAVEAT}
          </p>
        </>
      )}
    </Section>
  );
}
