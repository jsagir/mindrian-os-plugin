# Phase 220: Navigator Live Verification (paste-ready)

**What this is:** the last human gate before Phase 220's readiness can close. Everything below
is already proven offline (all test suites green) and the pipeline itself already ran live
against a real page (see 220-VERIFICATION.md Section 2). What no script can prove is the two
INVOCATION surfaces rendering in a REAL interactive session - a human has to see the actual
card. That is you. Two checks, five minutes.

**Where to run:** a normal Claude Code session in a real room (ador-ip-test, or whatever room
you are working in today). Nothing here can damage the room - nothing is filed until you pick
a verb on a card.

---

## Check 1: paste a URL, expect a card (the SENS-15 sensor)

1. In plain conversation (NOT inside a code block or quotes), paste this on its own line:

   https://docs.tavily.com/documentation/api-reference/endpoint/search

   (Note: use THIS url - the .../extract sibling page was already ingested by the automated
   live run, so pasting that one should stay QUIET. That silence is itself a pass for the
   dedup rule, if you want to try it after.)

2. **Expect:** a card offering three choices - [Ingest] [Ingest+Explore] [Skip] - naming the
   page host and the research/ destination. A REAL card, not an ASCII-art box.
   **Expect NOTHING to be fetched or filed before you pick a verb.**

3. Pick **[Ingest]**.

4. **Expect:** a rendered result that names the filed artifact path (something like
   `research/2026-07-XX-docs-tavily-com-.../....md`) and an entity count.
   HONESTY NOTE: if the Tavily key is still dead (see Check 3), the result should say so
   plainly (provider unavailable) and OFFER the fallback rung - it must never fail silently
   or pretend it fetched.

5. Paste the SAME URL again in a new turn. **Expect: NO new card** (already-ingested dedup).

## Check 2: the explicit command (/mos:research URL mode)

1. Run:

   /mos:research https://docs.tavily.com/documentation/api-reference/endpoint/search

2. **Expect:** a readback gate FIRST (it repeats the URL and asks before fetching anything).

3. Approve it. **Expect:** an honest "already ingested, unchanged" (a no-op) - NOT a duplicate
   file, because Check 1 already filed this page.

## Check 3: the Tavily key (one decision)

The automated live run found the TAVILY_API_KEY in ~/.env is DEAD (Tavily returns 401 on both
auth styles). The pipeline handled it exactly as designed - typed refusal, zero writes - and
the live proof ran on the fallback rung (real page bytes supplied by the surface, honestly
labeled web_degraded_local_fallback). Your call, either is a pass:

- **Option A:** paste a fresh Tavily key into ~/.env (TAVILY_API_KEY=...), then re-run Check 2
  with any new URL - the result should say the primary provider (tavily-extract) produced the
  bytes. This upgrades the live row to rung 1.
- **Option B:** approve the recorded rung-2 evidence as the live row (it exercised every
  production step except the Tavily fetch leg itself, which the offline suite pins).

## Check 4 (optional, Tri-Polar): repeat Check 1 on Claude Desktop if it is handy this
session; report any difference in how the card renders.

---

## Pass/fail checklist (tick and paste back)

- [ ] Pasted URL produced a card with [Ingest] [Ingest+Explore] [Skip]; nothing filed before my verb
- [ ] The card is a real card, not an ASCII box
- [ ] [Ingest] reported an artifact path under research/ and an entity count (or an HONEST provider-unavailable + fallback offer)
- [ ] Same URL pasted again: no new card
- [ ] /mos:research <url> showed the readback gate, then an honest already-ingested no-op
- [ ] Tavily key: (A) refreshed + rung-1 re-run green, or (B) rung-2 evidence approved
- [ ] (optional) Desktop surface behaved the same

Paste the ticked checklist (plus any output snippets you want on record) back and type
"confirmed" - it lands verbatim in 220-VERIFICATION.md Section 4 and Phase 220's readiness can
close (together with 219's, which gates the joint cut). If ANYTHING misbehaves - card missing,
silent filing, duplicate artifacts, a crash - describe it: it becomes a gap-closure item
(/gsd-plan-phase 220 --gaps), never a hot-patch past the gate.
