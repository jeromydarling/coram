# Export format

`GET /api/exports/contacts.json`

Coram's pitch is that a group can leave. This document is the part of that
pitch you can hold us to: a complete, documented, non-proprietary description
of everything the product will hand back.

There is no paid tier for export, no rate limit on it, and no support ticket
required. If a field exists in Membra it appears here.

## Guarantees

- **JSON, UTF-8, one object.** No custom container, no archive, no tooling of
  ours required to read it.
- **Timestamps are RFC 3339 with a UTC offset.**
- **`formatVersion` is an integer.** It increases only on a breaking change.
  Adding a field is not breaking; renaming or removing one is.
- **Version 1 will keep parsing.** If we reach a version 3, a version 1 export
  will still be readable by whatever we publish then.

## Shape

```json
{
  "format": "coram.export.contacts",
  "formatVersion": 1,
  "exportedAt": "2026-07-28T14:22:03.000Z",

  "workspace": { "name": "Riverside Tenants Union", "slug": "riverside-…", "tier": "parish" },

  "customFields": [
    { "key": "building", "label": "Building", "type": "text", "options": [] }
  ],

  "contacts": [
    {
      "id": "8f1c…",
      "displayName": "A. Okonkwo",
      "email": "a.okonkwo@example.org",
      "phone": "+1 555 0134",
      "postalCode": "60625",
      "turf": "North Side",
      "tags": ["steering committee", "spanish speaker"],
      "customFields": { "building": "4411 N Ashland" },
      "consent": [
        {
          "channel": "email",
          "granted": true,
          "acquisition": "signup_form",
          "occurredAt": "2026-03-02T18:04:00.000Z"
        }
      ],
      "lastInteractionAt": "2026-07-01T00:00:00.000Z",
      "createdAt": "2026-03-02T18:04:00.000Z",
      "updatedAt": "2026-07-01T12:11:00.000Z"
    }
  ],

  "encryptedNotes": [
    {
      "contactId": "8f1c…",
      "ciphertext": "base64…",
      "nonce": "base64…",
      "keyId": "b2d0…",
      "createdAt": "2026-04-11T09:30:00.000Z"
    }
  ],

  "vaultKeys": [
    {
      "id": "b2d0…",
      "wrappedDek": "base64…",
      "wrapNonce": "base64…",
      "kdfSalt": "base64…",
      "kdfIterations": 600000,
      "createdAt": "2026-03-02T18:00:00.000Z",
      "retiredAt": null
    }
  ]
}
```

## The encrypted notes

Organizer notes are encrypted in the browser and the server cannot read them
(§3.3), so the export contains ciphertext. That is not us holding something
back — it is the guarantee working. The notes are yours, and the key is yours,
so they are useful to you and to nobody else.

To read them outside Coram you need the workspace passphrase and the
`vaultKeys` entry matching each note's `keyId`. Both are in this file except
the passphrase, which was never ours to include.

```
KEK  = PBKDF2-HMAC-SHA256(passphrase, kdfSalt, kdfIterations, 256 bits)
DEK  = AES-256-GCM-decrypt(key = KEK, iv = wrapNonce, data = wrappedDek)
note = AES-256-GCM-decrypt(key = DEK, iv = nonce,     data = ciphertext)
```

All four base64 values are standard base64 with padding. The GCM
authentication tag is appended to the ciphertext, which is what WebCrypto's
`encrypt` returns and what its `decrypt` expects — most other libraries want it
passed separately, as the trailing 16 bytes.

Working example, Node 18+ or any browser:

```js
const b = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const material = await crypto.subtle.importKey(
  'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'],
);
const kek = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt: b(key.kdfSalt), iterations: key.kdfIterations },
  material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
);
const dekBytes = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv: b(key.wrapNonce) }, kek, b(key.wrappedDek),
);
const dek = await crypto.subtle.importKey('raw', dekBytes, 'AES-GCM', false, ['decrypt']);

const plaintext = new TextDecoder().decode(
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(note.nonce) }, dek, b(note.ciphertext)),
);
```

If the passphrase is lost the notes cannot be recovered, by you or by us. That
is the design, not a gap in it.

## What an export contains depends on who asks

An export is a normal read, so it returns what the requester could see anyway
(§4.1):

| Role | Gets |
|---|---|
| `steward` | Every contact in the workspace |
| `organizer` | Contacts in their assigned turf, and no others |
| `member` | Their own record |
| `observer` | Nothing here — counts only, via `/api/exports/aggregates` |
| `legal` | Nothing. Custos only. |

This is enforced by row-level security rather than by the export code, which is
why "organizer cannot export globally" needs no special case: their turf bound
already applies.

## CSV

`GET /api/exports/contacts.csv` is offered for spreadsheets and is **lossy**.
It carries name, email, phone, postal code, turf, tags, and creation date. It
cannot carry consent history, custom field definitions, or encrypted notes.

Use JSON to leave. Use CSV to make a phone list.

Cells beginning `=`, `+`, `-`, or `@` are prefixed with a single quote so
spreadsheets treat them as text. Without that, a contact named
`=HYPERLINK(...)` becomes a live formula when the file is opened.

## Importing this elsewhere

The JSON maps onto every mainstream CRM's import without a converter: one
object per contact, tags as a string array, custom fields as a flat object.
Nothing is nested more than two deep, and no field encodes meaning in a
delimiter.

If you are migrating to a tool that cannot take it, that is worth telling us —
not so we can keep you, but because an export nobody can use is not an export.
