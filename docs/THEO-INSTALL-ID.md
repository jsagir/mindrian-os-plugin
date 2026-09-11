# Theo Install Id: The Opaque Per-Install Header

Quick task 260911-iko. This is the ONE plugin-side record of the `x-theo-install-id`
contract (D-06). Any change to the name or the pattern is announced to Theo first --
see section 9.

## 1. What it is and what it is for

Theo needs to tell "one install calling twice" apart from "two installs calling
once", and today it cannot. `x-theo-install-id` is the smallest thing that answers
that question: a 128-bit coin flip minted once per install and sent as a header on
every Brain call, with nothing else about the install attached to it.

## 2. The wire contract

- Header name: `x-theo-install-id`, lowercase on the wire.
- Value: 32 lowercase hex characters from `crypto.randomBytes(16)`.
- Theo accepts the wider pattern `^[A-Za-z0-9_-]{16,64}$`; the plugin sends the
  stricter subset `^[a-f0-9]{32}$`, so a future loosening on our side still has to
  clear Theo's own acceptance pattern.

## 3. Where it lives

`MINDRIAN_HOME` else `~/.mindrian/theo-install-id.json`, beside the pre-warm marker
(`lib/core/brain-prewarm.cjs`). The file holds only `{id, minted_at}`, mode 0600
where the platform supports it, written atomically (temp file, then rename). It is
minted exactly once, on the plugin's first Brain call after install
(`lib/core/install-id.cjs`).

## 4. Where it rides

Every request `lib/core/brain-client.cjs::callTool` makes to the Brain origin: both
the session `initialize` fetch and the `tools/call` fetch. Nothing else about either
request changes.

It does NOT ride the `/register` fetch. Registration is a different endpoint with its
own contract, and it runs before there is an established Brain session to bucket.
Adding it there would be a change to Theo's registration surface, which section 9's
announce-first rule covers -- a deliberate exclusion, not a miss.

## 5. Rotation

Only two paths rotate the id, both explicit user actions:

- Reinstall (the state dir is removed and a fresh id mints on the next Brain call).
- `node scripts/doctor.cjs --reset-install-id`, which mints a fresh id, replaces the
  file, prints exactly `install id rotated`, and prints nothing else about the value.

## 6. Canon Part 8: why this is not user data

Canon Part 8 forbids USER DATA crossing LOCAL -> BRAIN. It does not forbid generic
content-free handles: framework names and problem-type enums already cross that wire
by design. The install id belongs to the second class.

The value is a coin flip, not a projection. It is 16 bytes straight out of the
platform CSPRNG with no input at all. There is no function from the user, the
machine, the account, the room, the path, the hostname, or the Brain key to this
value, so there is nothing to invert. A hash of an identifier would still BE that
identifier wearing a hat: the same user on two installs would hash to the same
bucket, and anyone holding the identifier could confirm a match. A random 128-bit
value cannot do either. It carries exactly one bit of meaning: "the caller that sent
this header before is the caller sending it now."

It is the user's own to read and the user's own to destroy. It sits in plaintext in
their own state dir at mode 0600. They can open it, they can delete it, and
`doctor --reset-install-id` replaces it on demand. Nothing about the plugin's
behaviour changes when they do.

The forbidden move, written down so a later edit cannot drift into it: never derive
the id from `os.hostname()`, `os.userInfo()`, `process.env.USER` / `USERNAME` /
`LOGNAME`, the home directory path, `process.cwd()`, a MAC address, a machine id, an
account id, a room name, the Brain key, or a hash of any of those.
`tests/test-339-install-id-header.cjs` arm 9 enforces this with a comment-stripped
source scan of `lib/core/install-id.cjs` that fails the suite if any of those tokens
appears outside the module's own explanatory comment.

## 7. Bucket key, never entitlement

The header is a bucket key and never an entitlement. The plugin never reads the
header back, never branches on it, and never refuses anything because of it. The
commercial gate stays at install and update time, per `.claude/includes/moat.md`;
this header does not move that gate one inch. A forged or absent value changes
nothing on the plugin side.

## 8. Tri-Polar

`lib/core/brain-client.cjs` is the single transport every surface reaches the Brain
through: the CLI scripts require it directly, the Desktop and Cowork stdio shim
(`bin/mindrian-brain-mcp-client.cjs`) requires it, and the MCP server routes through
it. One edit inside `callTool` puts the header on all three surfaces with zero
surface-specific code -- the Tri-Polar rule satisfied by construction rather than by
three parallel patches.

The state dir is the same `MINDRIAN_HOME` else `~/.mindrian` on all three, so one
install has one id no matter which surface makes the first call. On Cowork
specifically: the id is per INSTALL of the plugin, keyed to the machine's state dir.
It is not per room and not per user, and nothing in this document makes it either.

## 9. Changing this

Any change to the header name or the value pattern is announced to Theo FIRST. The
current contract was agreed with the Theo session on 2026-09-11 and recorded on
Theo's side as `20-INPUT-per-install-header-decision.md`. Do not vary it without a
matching update on that side.
