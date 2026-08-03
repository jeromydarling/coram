/**
 * A hand parser reading XML written by somebody else's clerk.
 *
 * The feeds this has to survive are not well-formed documents produced by a
 * library. They are exports from twenty-year-old agenda-management software,
 * WordPress installs, and municipal CMSes that emit HTML inside a description
 * and call it RSS. So the tests below are mostly malformed input, and the
 * assertion in almost every one of them is "does not throw, and does not emit a
 * row it cannot stand behind".
 */

import { describe, expect, it } from 'vitest';

import { parseFeed } from './feed';

const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel>
  <title>City of Example — Agendas</title>
  <link>https://example.gov/agendas</link>
  ${items}
</channel></rss>`;

describe('parseFeed — RSS', () => {
  it('reads title, link, date and description', () => {
    const [entry] = parseFeed(
      rss(`<item>
        <title>Rent Board — regular meeting</title>
        <link>https://example.gov/agendas/2026-08-05</link>
        <pubDate>Wed, 29 Jul 2026 17:00:00 GMT</pubDate>
        <description>Agenda for the 5 August meeting.</description>
        <guid>urn:example:agenda:551</guid>
      </item>`),
    );

    expect(entry.title).toBe('Rent Board — regular meeting');
    expect(entry.url).toBe('https://example.gov/agendas/2026-08-05');
    expect(entry.publishedAt).toBe('2026-07-29T17:00:00.000Z');
    expect(entry.summary).toBe('Agenda for the 5 August meeting.');
    expect(entry.id).toBe('urn:example:agenda:551');
  });

  it('falls back to the link when there is no guid', () => {
    const [entry] = parseFeed(
      rss('<item><title>Notice</title><link>https://example.gov/n/1</link></item>'),
    );
    expect(entry.id).toBe('https://example.gov/n/1');
  });

  /*
   * Half the municipal feeds in the country put escaped HTML in <description>,
   * and rendering it is not an option — this text goes into a database column
   * and out to a React text node. Strip it, and strip it before it can be
   * mistaken for content.
   */
  it('strips markup out of a description rather than carrying it', () => {
    const [entry] = parseFeed(
      rss(`<item><title>Notice</title><link>https://example.gov/n/1</link>
        <description>&lt;p&gt;Item 7(b) — &lt;strong&gt;eviction&lt;/strong&gt; defence&lt;/p&gt;</description>
      </item>`),
    );
    expect(entry.summary).toBe('Item 7(b) — eviction defence');
    expect(entry.summary).not.toContain('<');
  });

  it('unwraps CDATA', () => {
    const [entry] = parseFeed(
      rss(`<item><title><![CDATA[Rent & Repairs]]></title>
        <link>https://example.gov/n/2</link></item>`),
    );
    expect(entry.title).toBe('Rent & Repairs');
  });

  /* "&amp;lt;" is a literal "&lt;", not a "<". Decoding in the wrong order
   * turns escaped text into markup, which is the classic way a stripper is
   * bypassed. */
  it('decodes the ampersand last', () => {
    const [entry] = parseFeed(
      rss(`<item><title>A &amp;lt;b&amp;gt; tag</title><link>https://example.gov/n/3</link></item>`),
    );
    expect(entry.title).toBe('A &lt;b&gt; tag');
  });

  it('decodes numeric entities and survives a broken one', () => {
    const [entry] = parseFeed(
      rss(`<item><title>Caf&#233; &#xNOPE; item &#999999999;</title>
        <link>https://example.gov/n/4</link></item>`),
    );
    expect(entry.title).toContain('Café');
    expect(entry.title).not.toContain('999999999');
  });

  /*
   * A row with no address is a row nobody can act on, and "Untitled — #" in a
   * list is worse than one fewer line.
   */
  it('skips an item with no title or no usable link', () => {
    const entries = parseFeed(
      rss(`<item><link>https://example.gov/n/5</link></item>
           <item><title>No link at all</title></item>
           <item><title>Not a web address</title><link>javascript:alert(1)</link></item>
           <item><title>Good</title><link>https://example.gov/n/6</link></item>`),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Good');
  });

  it('returns nothing rather than throwing on rubbish', () => {
    for (const junk of ['', 'not xml', '<rss><channel><item>', '<<<>>>']) {
      expect(() => parseFeed(junk), junk).not.toThrow();
      expect(parseFeed(junk), junk).toEqual([]);
    }
  });

  it('gives up on an unparseable date rather than inventing one', () => {
    const [entry] = parseFeed(
      rss(`<item><title>Notice</title><link>https://example.gov/n/7</link>
        <pubDate>next Tuesday-ish</pubDate></item>`),
    );
    expect(entry.publishedAt).toBeNull();
  });

  /*
   * A feed with a broken clock is common and its documents sort to the top of
   * a date-ordered list and stay there. Better to have no date than a wrong one
   * that wins every comparison.
   */
  it('rejects a date implausibly far in the future', () => {
    const [entry] = parseFeed(
      rss(`<item><title>Notice</title><link>https://example.gov/n/8</link>
        <pubDate>Mon, 01 Jan 2087 00:00:00 GMT</pubDate></item>`),
    );
    expect(entry.publishedAt).toBeNull();
  });

  it('caps a runaway description instead of storing a whole page', () => {
    const [entry] = parseFeed(
      rss(`<item><title>Notice</title><link>https://example.gov/n/9</link>
        <description>${'word '.repeat(5_000)}</description></item>`),
    );
    expect(entry.summary.length).toBeLessThanOrEqual(1_200);
  });

  it('stops at the per-poll ceiling however many items are in the file', () => {
    const items = Array.from(
      { length: 200 },
      (_, i) => `<item><title>Item ${i}</title><link>https://example.gov/i/${i}</link></item>`,
    ).join('');
    expect(parseFeed(rss(items)).length).toBeLessThanOrEqual(40);
  });

  /*
   * Not extracted, on purpose. A clerk's name in <author> is of no use to a
   * group deciding whether to turn up, and ingesting it would put a named third
   * party into a table whose argument is that it holds no people.
   */
  it('does not carry an author anywhere into the entry', () => {
    const [entry] = parseFeed(
      rss(`<item><title>Notice</title><link>https://example.gov/n/10</link>
        <author>clerk@example.gov (Dana Whitfield)</author>
        <dc:creator>Dana Whitfield</dc:creator></item>`),
    );
    expect(JSON.stringify(entry)).not.toContain('Whitfield');
    expect(JSON.stringify(entry)).not.toContain('clerk@example.gov');
  });
});

describe('parseFeed — Atom', () => {
  const atom = (entries: string) =>
    `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <title>Court calendar</title>${entries}</feed>`;

  it('reads an entry with the link in an attribute', () => {
    const [entry] = parseFeed(
      atom(`<entry>
        <id>tag:example.gov,2026:cal/88</id>
        <title>Docket for 5 August</title>
        <link rel="alternate" href="https://example.gov/cal/88"/>
        <updated>2026-07-30T09:00:00Z</updated>
        <summary>Unlawful detainer calendar.</summary>
      </entry>`),
    );

    expect(entry.url).toBe('https://example.gov/cal/88');
    expect(entry.id).toBe('tag:example.gov,2026:cal/88');
    expect(entry.publishedAt).toBe('2026-07-30T09:00:00.000Z');
  });

  /* rel="self" points at the feed, not the document. Following it would give
   * every entry the same URL. */
  it('prefers the alternate link over the feed’s own', () => {
    const [entry] = parseFeed(
      atom(`<entry><title>Docket</title>
        <link rel="self" href="https://example.gov/cal.atom"/>
        <link rel="alternate" href="https://example.gov/cal/89"/></entry>`),
    );
    expect(entry.url).toBe('https://example.gov/cal/89');
  });

  it('takes a bare link when no rel is given', () => {
    const [entry] = parseFeed(
      atom('<entry><title>Docket</title><link href="https://example.gov/cal/90"/></entry>'),
    );
    expect(entry.url).toBe('https://example.gov/cal/90');
  });

  it('reads content when there is no summary', () => {
    const [entry] = parseFeed(
      atom(`<entry><title>Docket</title><link href="https://example.gov/cal/91"/>
        <content type="html">&lt;p&gt;Eviction matters&lt;/p&gt;</content></entry>`),
    );
    expect(entry.summary).toBe('Eviction matters');
  });
});
