# Ballot secrecy

§5.8: *"secret ballots use a blinded token so the server cannot link voter to
vote."*

This document says exactly what Coram's implementation does and does not
guarantee, because a product that overstates ballot secrecy is worse than one
that admits its limits. A union local deciding whether to strike needs to know
which claim it is relying on.

## What the scheme is

Three tables, and the separation between them is the whole design:

| Table | Holds | Does not hold |
|---|---|---|
| `ballot_enrollments` | that a member is eligible and has been issued a token | any token |
| `ballot_tokens` | the SHA-256 of every issued token | any voter |
| `votes` | a token hash and a choice | any voter |

Casting a vote presents the token. The server checks the hash is in
`ballot_tokens`, marks it spent, and records the choice against the *token*.
Nothing in the database joins a voter to a choice, and there is no column that
could.

`ballot_tokens` rows are inserted in shuffled order at ballot open, all in one
transaction, with no per-row timestamp. Insertion order and timing therefore
carry no information about who received which token — which is the leak the
obvious implementation has, where issuing a token on request correlates it with
the requesting session.

## What this guarantees

- **A database disclosure cannot link voter to vote.** Not by join, not by
  ordering, not by timestamp. Someone who steals the whole database learns the
  tally and who voted, never who voted which way.
- **One vote each.** Tokens are issued one per eligible member and each is
  spendable once, enforced by `spent_at` under a row lock.
- **Eligibility without identification.** The roll is checked at issuance; the
  ballot box does not need to know who is standing at it.
- **A steward cannot look.** There is no query that returns it, no admin view,
  and no support tool. The information is not withheld — it is absent.

## What this does not guarantee, stated plainly

**The moment of issuance is a trusted moment.** Coram's Worker generates the
tokens and delivers each to its member. During that operation, in memory, the
code necessarily knows which token is going to whom. It does not write that
down — but "does not" is a property of the code we run, not of mathematics. A
modified deployment could record it.

This is the same class of trust as the encrypted notes vault (§3.3), where we
serve the JavaScript that holds the passphrase, and it is stated in the same
terms rather than glossed. Subresource integrity, reproducible builds, and
published deployment hashes are what would narrow it, and they belong on the
roadmap.

**What would remove it: real blind signatures.** Under a Chaum-style scheme the
voter blinds a token locally, the server signs a value it cannot read, and the
voter unblinds. The server never sees an issued token at all, so there is no
trusted moment to rely on.

That is not implemented, for a reason worth recording. WebCrypto exposes no raw
RSA operation, so blind signatures here mean hand-writing modular arithmetic
over `BigInt` — with the blinding factor, the padding scheme, and the
constant-time discipline all our own. This codebase already declined to
hand-roll a password hash for the same reason and uses PBKDF2 instead. Shipping
homemade cryptography *underneath a claim of ballot secrecy* would be the worse
of the two mistakes, because a subtle flaw there is invisible and the stakes are
somebody's union election.

**The right resolution is an audited implementation, not a clever one.** This is
a live decision, not a settled one — see the open question at the end.

## Secret versus recorded

Not every vote should be secret, and Consilium does not assume it. A ballot
carries `is_secret`:

- **Secret** — the scheme above. Used for officer elections, strike votes, and
  anything where a member could be pressured.
- **Recorded** — votes are attributed, by design. Used where a body wants
  accountability: a delegate voting on behalf of members who are entitled to
  know how their delegate voted.

Choosing "recorded" is not a weaker version of secret; it is a different
governance decision, and the interface names it that way rather than presenting
secrecy as a security setting to be toggled up and down.

## Proxies

A proxy is recorded against the *grantor*, not folded into the ballot. When a
proxy holder votes on someone's behalf in a secret ballot they spend that
person's token, so the ballot box still sees only tokens. The proxy record says
that A may act for B; it never says what A did with it.

Revocation is immediate and takes effect for any token not yet spent. A proxy
revoked after the vote was cast does not retract the vote — the interface says
so before you delegate, because discovering it afterwards would be worse.

## Open question

Whether to fund an audited blind-signature implementation before Consilium ships
to a group that runs binding elections.

The scheme above is honest and strong against the threat most groups actually
face — seizure, subpoena, a curious admin. It is not strong against us. For a
tenants' union voting on a rent strike that distinction is probably academic;
for a labour union whose election is legally binding, it may not be, and the
answer may be that Coram should decline to be the ballot box for that until the
stronger scheme exists.

That is a product decision, and it should be made deliberately rather than
inherited from whatever this file happened to implement first.
