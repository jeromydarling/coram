/**
 * Getting a finished thing out of Coram and onto a wall or a feed.
 *
 * Everything here runs in the browser with native APIs and no library. §10
 * forbids external JS on any route, which rules out every platform's share SDK
 * — and that turns out to be the right constraint rather than an obstacle,
 * because those SDKs are also trackers.
 *
 * ---------------------------------------------------------------------------
 * Why Coram holds no posting credentials
 * ---------------------------------------------------------------------------
 *
 * An OAuth token that can post as a tenants union is three bad things at once:
 * a subpoena target, a compromise vector, and a dependency on a platform that
 * can revoke it the week the group becomes inconvenient. §5.6 already treats
 * deplatforming as a threat worth engineering against; holding the keys to a
 * group's public voice would be the opposite of that.
 *
 * So the product makes the image and the words, and a person posts them. The
 * share sheet below is the operating system's, the intent links are ordinary
 * URLs that open a compose window already filled in, and nothing authenticates
 * to anything. It is one more tap than a scheduled post and it cannot be taken
 * away from them.
 */

export interface Rasterized {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * SVG to PNG, in the browser.
 *
 * A Worker has no canvas, and the two ways to do this server-side are a large
 * WASM renderer or a third-party image service — respectively a dependency and
 * somebody else looking at a group's unpublished material. Every browser
 * already has the decoder.
 *
 * `scale` exists because a story card at 1080 wide is fine on a phone and thin
 * on a printed sheet; 2x gives a flyer enough pixels for a copy shop.
 */
export async function svgToPng(svg: string, scale = 2): Promise<Rasterized> {
  const { width, height } = sizeOf(svg);

  // A blob URL rather than a data URI: Safari refuses to decode an <img> whose
  // src is a data:image/svg+xml over a certain length, and a flyer with an
  // embedded backdrop is comfortably over it.
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const image = new Image();
    image.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The browser could not read that image.'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser will not give us a canvas to draw on.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('The browser could not encode that as a PNG.');

    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Width and height off the SVG root, so callers do not have to track them. */
function sizeOf(svg: string) {
  const width = Number(/\bwidth="(\d+)"/.exec(svg)?.[1] ?? 1080);
  const height = Number(/\bheight="(\d+)"/.exec(svg)?.[1] ?? 1080);
  return { width, height };
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking immediately can cancel the download in Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Whether the operating system will take a file from us. */
export function canShareFiles(files: File[]): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files });
}

/**
 * Hand the image to the OS share sheet.
 *
 * This is the good path on a phone: every app the person already has, including
 * Signal and their photo library, with no account connected to Coram. Returns
 * false when the browser will not do it, so the caller can fall back rather
 * than showing an error for a thing that was never available.
 */
export async function shareFile(file: File, text?: string): Promise<boolean> {
  if (!canShareFiles([file])) return false;
  try {
    await navigator.share({ files: [file], text });
    return true;
  } catch (error) {
    // AbortError means the person closed the sheet. That is not a failure and
    // must not surface as one.
    if ((error as Error)?.name === 'AbortError') return true;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Intent links
// ---------------------------------------------------------------------------

export interface Intent {
  id: string;
  name: string;
  /** Null when this platform cannot accept a pre-filled post. */
  href: string | null;
  /** Why not, when it cannot. Shown instead of a dead button. */
  unavailable?: string;
}

/**
 * Compose URLs, which are just URLs.
 *
 * None of these authenticate, none carry a token, and none work without the
 * person being signed in to that platform in their own browser — which is
 * exactly the property we want. The image cannot travel through a URL, so the
 * flow is: download the picture, open the composer with the words already in
 * it, attach the picture.
 */
export function intents(text: string, link?: string): Intent[] {
  const t = encodeURIComponent(text);
  const u = link ? encodeURIComponent(link) : '';

  return [
    {
      id: 'x',
      name: 'X',
      href: `https://twitter.com/intent/tweet?text=${t}${link ? `&url=${u}` : ''}`,
    },
    {
      id: 'bluesky',
      name: 'Bluesky',
      href: `https://bsky.app/intent/compose?text=${t}${link ? encodeURIComponent(`\n${link}`) : ''}`,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      href: `https://wa.me/?text=${t}${link ? encodeURIComponent(`\n${link}`) : ''}`,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      // Facebook's sharer takes a URL and nothing else — it will not accept a
      // body of text. Rather than opening a composer that silently drops
      // everything the group wrote, say so.
      href: link ? `https://www.facebook.com/sharer/sharer.php?u=${u}` : null,
      unavailable: link
        ? undefined
        : 'Facebook only shares a link, not text. Add a link above and it will work.',
    },
    {
      id: 'mastodon',
      name: 'Mastodon',
      // Federated, so there is no single host to send anyone to. Copying is the
      // honest answer, and it is one paste.
      href: null,
      unavailable:
        'Mastodon has no single address to send you to — every server is its own. Copy the ' +
        'words and paste them into yours.',
    },
    {
      id: 'email',
      name: 'Email',
      href: `mailto:?body=${t}${link ? encodeURIComponent(`\n\n${link}`) : ''}`,
    },
  ];
}
