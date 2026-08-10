# Hook Injection and the Prompt Cache: First-Party Doctrine

**Status:** Active
**Applies to:** Every UserPromptSubmit hook that injects `additionalContext` (the
NAVIGATION DECISION block, the AskUserQuestion contract lines, and any future
Brain-reach addition riding the same rail)
**Requirement:** CACHE-02 doctrine leg ("Design rationale filed as first-party
doctrine - the hook layer remains corpus whitespace")
**Evidence base:** `.planning/phases/251-cache-aware-trigger-redesign/251-CACHE-MEASUREMENT.md`
(a local planning artifact; `.planning/` is untracked, so the headline numbers
are restated here rather than relied on as a link)

---

## What actually happens

Claude Code's `UserPromptSubmit` hook contract places `additionalContext`
**alongside the submitted prompt**: the string is wrapped in a system
reminder and inserted into the conversation at the point where the hook
fired. It becomes conversation content inside the newest user turn. It does
NOT touch the true cacheable prefix (the `tools` array or the top-level
`system` prompt) - hooks have no write access to that prefix at all.

The prompt-caching contract keys the cache on `tools -> system -> messages`,
in that order, and extends incrementally: each new request caches everything
up to the last cacheable block, and the cache point moves forward
automatically as the conversation grows. Appending a new user turn (with its
injected block) does not invalidate the cached prefix of earlier turns - the
lookback mechanism finds the prior write and extends it.

**Net effect: per-turn hook injection in Claude Code is cache-safe by construction.**
Appending at the tail extends the cache; it does not break it. The hook layer only ever adds to the tail of the messages array, and the
tail is exactly the part of the prefix that is allowed to vary between
requests without invalidating anything before it.

## The refuted hypothesis

The ep55-derived hypothesis holds that per-turn varying injection breaks the
prompt-prefix cache. That hypothesis is FALSE for Claude Code's actual
request shape. It would be true for an architecture that re-renders a
varying block into the system prompt, or that mutates earlier messages, on
every turn - that is not what the UserPromptSubmit rail does.

Measured proof (251-CACHE-MEASUREMENT.md, six sampled sessions, the four
heaviest with the NAVIGATION DECISION block firing on ~73% of turns): cache
hit rates ran **91.3% to 97.3%**, with only **2-3 zero-cache-read requests
per session**, attributable to session start and compaction, never to
injection turns. If the hypothesis had held, those same sessions would have
paid full uncached price on nearly every request instead - one measured
session's actual cost would have been roughly 60x higher.

## The real cost: append-accumulation

The injection is not free. Its real cost is a different, roughly 100x
smaller mechanism than the refuted hypothesis: **append-accumulation**.
Every injected block is paid once as a cache write (1.25x base input) and
then re-read by every subsequent API request in the session (0.1x base
input). At the measured average block size (~1,275 B pre-hygiene, ~320-425
tokens), this comes out to roughly USD 4-7/month equivalent for a typical
single-developer working pattern. A secondary, harder-to-price effect: the
accumulated injection bloat consumes context-window budget, pulling
auto-compaction forward; compaction IS a genuine cache-invalidation event
(a full re-write of the summarized context).

## The three levers

Because the mechanism is already cache-safe, CACHE-02 does not need a
mechanism change - it needs to shrink append-accumulation. Three levers, in
order of measured payoff, all implemented by 251-01 on the existing rail:

1. **size.** Shrink what gets appended each turn. 251-01 moved the FIRE-IF-FORK
   imperative (~330 B/turn, byte-identical every turn) off the per-turn block
   and onto SessionStart `additionalContext` (`NAV_CARD_FIRE_DOCTRINE`, paid
   once per session at 1.25x, read at 0.1x thereafter).
2. **dedup.** Stop repeating information already present elsewhere in the
   same block. 251-01 dropped the `[AskUserQuestion payload: ...]` line's
   duplicated `verbs` array (already printed in the option rows above it) in
   favor of a compact `verb_count`.
3. **emission discipline.** Skip emitting anything when nothing changed.
   251-01 added a per-session, per-room sha256 hash sidecar: a byte-identical
   repeat of the prior turn's block now emits a 45 B one-line marker
   (`NAV_UNCHANGED_MARKER`) instead of the full block. One measured session
   showed 7 consecutive byte-identical blocks - 6 of 7 emissions were pure
   waste before this lever existed.

Combined, these three levers cut a full block from 1,432 B to 816 B (a 43%
reduction on every non-suppressed turn), and cut a byte-identical repeat from
1,432 B to 45 B (a 97% reduction).

## The budget

`NAV_BLOCK_BUDGET_BYTES` (`scripts/intent-classifier.cjs`) is the executable
CACHE-03 fence: an exported, positive-integer byte ceiling that the composed
per-turn block must fit inside, enforced by `tests/test-251-block-budget.cjs`.
It is set above the post-251-01 fixture block size (816 B) with headroom for
a future Brain-reach addition, and pinned below the pre-hygiene average
(1,275 B) so the fence stays meaningful - any future raise past the pinned
ceiling is a visible, deliberate diff, not a silent creep.

**The CACHE-03 rider rule:** the Brain reach, when it lands, rides this same
existing rail. It does not get a new injection mechanism. Its added bytes
must fit inside `NAV_BLOCK_BUDGET_BYTES`, or something else on the block
must shrink to make room. The budget is the binding instrument; the
injection mechanism is not up for renegotiation.

## Do NOT do

These are non-solutions to a non-problem, under the verified mechanism
above. Do not spend engineering time on any of the following in the name of
"protecting the cache":

- **Per-turn `cache_control` tricks.** There is nothing broken at the
  prefix level to fix with manual cache-breakpoint placement.
- **prefix pinning.** The tools/system prefix is already stable; hooks
  cannot touch it in the first place.
- **Moving the injected block "up" the request**, or re-rendering varying
  content into the system prompt. This is precisely the architecture the
  refuted hypothesis describes - adopting it would introduce the real
  problem the hypothesis wrongly assumed already existed.

## Honest limits

- **Token conversion is estimated** (3.5 bytes/token, symbol-heavy text
  assumed), not run through the real tokenizer.
- **Sample is CLI-surface only**: six sessions, one machine, one developer,
  dev-heavy tool-call-dense workloads. Desktop and Cowork surfaces are
  unmeasured - a stated Tri-Polar gap, not an oversight.
- **Compaction-acceleration cost is not isolated** from the base
  append-accumulation cost; isolating it would require paired sessions with
  and without injection, which is an experiment, not read-only analysis.
- **The dominant FELT per-turn cost on this rail is not caching at all.**
  It is the latency of the 7 synchronous UserPromptSubmit hooks (1.5-3s
  timeouts each, the nav engine hard-capped at 1,200ms inside
  `intent-classifier.cjs`) running before the request fires. That is out of
  scope for this doctrine and is a candidate for a future phase.
