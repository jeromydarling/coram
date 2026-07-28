# Colloquium: what the server holds

§3.2: *"No message content retention in encrypted channels. Store envelope
metadata only (channel id, sender id, byte length, timestamp). Purge envelopes
after 30 days."*

This document says exactly where a message lives, for how long, and what a
subpoena served on us would actually produce. As with `ballot-secrecy.md`, the
point is to be checkable rather than reassuring.

## Where a message is

| Store | Holds | For how long |
|---|---|---|
| The sender's device | plaintext | until they delete it |
| `ChannelDO` storage | ciphertext, sealed client-side | the channel's TTL, max 30 days |
| Postgres `message_envelopes` | channel, sender, rounded size, time | 30 days |
| The recipients' devices | plaintext, once decrypted | until they delete it |

There is no message body column in Postgres. Not an encrypted one — none. Grep
`migrations/0008_colloquium.sql` for `body` and you will not find it.

## The tension, stated rather than glossed

A strict reading of §3.2 is that the server retains no content at all. Coram
retains ciphertext for the channel's TTL, in Durable Object storage.

That is a deliberate departure, and the reason is offline delivery: a volunteer
whose phone was off during a meeting has to be able to read what was said when
they turn it on. The alternatives were worse — either messages only reach people
who are online at the instant they are sent, or the sending client re-transmits
to each recipient later, which requires it to keep everything and be running.

What makes the departure defensible is that the blob is sealed under a key we
never receive, exactly like the notes vault (§3.3). We hold something we cannot
read, briefly. What it does **not** do is make us unable to be compelled to hand
that blob over — it makes handing it over useless.

## What a subpoena gets

Served on Coram, for a workspace's channels:

- **Who is in which room**, from `channel_members`, for as long as those rows
  live (two years).
- **Who spoke, where, and when**, from `message_envelopes`, for the last 30
  days.
- **Roughly how much they said** — rounded to 256-byte buckets, so a two-message
  exchange does not distinguish "yes" from "no".
- **Ciphertext**, if the request lands inside the TTL, which we cannot decrypt
  and neither can they.

That first item is the one to take seriously. Encryption hides content; it does
not hide the social graph, and for an organizing group the graph is frequently
the more valuable thing. A prosecutor who learns that four named people share a
private channel has learned something real, and no amount of message encryption
changes it. The 30-day envelope purge limits the *timeline* of that graph, not
its existence.

If that matters more to a group than convenience does, the Matrix bridge below
is the answer, and we would rather say so than pretend otherwise.

## What the steward cannot do

There is no admin override on channel membership. A steward can see that a
channel exists and can delete it — they own the workspace — but they cannot read
its envelopes and cannot add themselves to it. `coram.in_channel()` is the only
key, and no policy widens it.

This is a real product decision with a real cost: a workspace owner cannot
investigate a complaint about something said in a private channel. We think an
internal comms tool where the admin can quietly read the room is not one
organizers should trust, and that building the override "for emergencies" is
precisely how it comes to be used routinely.

## Attachments

Files go to R2 under a tenant-first key so the burn switch finds them. Links are
signed and expire.

The filename is never stored. `eviction-notice-marquez.pdf` tells you everything
the encryption was meant to hide, so the uploader supplies a label and that
label is sealed client-side like any other message.

## The Matrix bridge

§5.7 asks for *"a documented Matrix bridge for coalitions demanding self-hosted
infrastructure."* **Not built.** What follows is the contract it will implement,
so that a coalition can evaluate it before it exists.

The shape: a channel may be marked as bridged to a Matrix room. Coram then acts
as an application service against the coalition's own homeserver.

- **They hold the messages.** A bridged channel's ciphertext lives on their
  homeserver, not in `ChannelDO`. Coram keeps the envelope row for its own
  membership and moderation and nothing else.
- **Their keys.** Coram does not participate in the Matrix room's Megolm
  sessions and cannot decrypt its history.
- **One direction of trust.** The bridge does not give the homeserver access to
  anything else in the workspace — no contacts, no events, no funds.
- **Bridging is per channel and per decision**, not a workspace-wide switch. A
  coalition can run its steering committee on its own infrastructure and leave
  everything else here.

The reason to build it is the reason it is in the spec: a coalition that does
not want to trust us with its internal comms should not have to, and should not
have to leave the rest of the product to avoid it. Until it exists, a group with
that requirement should use Matrix directly and not use Colloquium.
