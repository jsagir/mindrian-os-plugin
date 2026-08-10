# CACHE-01: Prompt-Cache Cost of the Per-Turn NAVIGATION DECISION Injection

**Measured:** 2026-08-10
**Requirement:** CACHE-01 (v2.0.0 "Build the Loop", Phase 251 / Phase E)
**Method:** Read-only. Official docs (hooks contract + prompt-caching contract) for mechanics, real session transcripts under `~/.claude/projects/-home-jsagi/` for data. No speculation carried forward without a tag.
**Confidence:** HIGH on mechanism and measured sizes; MEDIUM on token conversion and monthly extrapolation (assumptions stated inline).

---

## Verdict

**The ep55-derived hypothesis ("per-turn varying injection breaks the prompt-prefix cache") is FALSE for Claude Code's actual request shape.** UserPromptSubmit `additionalContext` is appended into the conversation at the point where the hook fired (inside the newest user turn as a system-reminder), NOT into the system/tools prefix. Appending at the tail extends the cache; it does not invalidate it. Measured proof: the four heaviest sampled sessions, all with the NAVIGATION DECISION block firing on most turns, ran at **91.3% to 97.3% cache hit rates**, with only 2-3 zero-cache-read requests per session (session start and compaction events, not injection turns).

The injection still costs real money, but through a different, roughly 100x smaller mechanism: **append-accumulation**. Every injected block is paid once as a cache write (1.25x) and then re-read (0.1x) by every subsequent API request in the session, and the bloat pulls auto-compaction forward (compaction IS a genuine cache-invalidation event).

---

## 1. Mechanism (the crux)

### Where the injection lands

From the Claude Code hooks documentation [CITED: code.claude.com/docs/en/hooks]:

> For `UserPromptSubmit` ... stdout is added as context that Claude can see and act on.
> `additionalContext` placement for UserPromptSubmit: **"alongside the submitted prompt"**.
> "Claude Code **wraps the string in a system reminder and inserts it into the conversation at the point where the hook fired**. Claude reads the reminder on the next model request, but it doesn't appear as a chat message in the interface."

So the block is conversation content in the newest user turn. Hooks have NO write access to the true cacheable prefix (tools array, top-level system prompt). This is confirmed empirically: in the transcript JSONL, each injection is recorded as an `attachment` entry (`hookEvent: "UserPromptSubmit"`, `attachment.content` = the block) parented to that turn's user message [VERIFIED: transcript inspection, session 4167dfe2].

### What the cache actually keys on

From the prompt-caching contract [CITED: platform.claude.com/docs/en/docs/build-with-claude/prompt-caching]:

- Cacheable prefix order: `tools` -> `system` -> `messages`. "Changes at each level invalidate that level and all subsequent levels."
- Multi-turn conversations extend the cache incrementally: "the cache point moves forward automatically as conversations grow. Each new request caches everything up to the last cacheable block, and previous content is read from cache." Appending a new user message does NOT invalidate the cached prefix of earlier messages (lookback mechanism finds the prior write and extends it).
- Pricing: 5-minute cache write = **1.25x** base input; 1-hour write = 2x; cache read = **0.1x** base input.

### Why the hypothesis fails

The injected block varies turn to turn, but each turn's block is appended at the TAIL of the messages array and then becomes frozen history. On the next request, the previous turn (including its injected block) is replayed verbatim, so the prefix hash matches and the cache extends. Variance only matters if content BEFORE the cache point changes. Per-turn hook injection never rewrites earlier content.

The hypothesis would be TRUE for an architecture that re-renders a varying block into the system prompt (or mutates earlier messages) each turn. That is the pattern ep55 warns about. Claude Code's hook rail is not that architecture. langtalks is explicitly not the authority for host request-shape mechanics (navigator scoping 2026-08-10); the hooks + caching docs above are.

### What DOES invalidate the cache in these sessions

- **Session start** (empty cache, full write).
- **Compaction** (history is rewritten, messages-level cache invalidated, full re-write of the summarized context).
- Cache TTL expiry (5 min idle) [CITED: prompt-caching doc].

Measured: 2-3 zero-cache-read requests per session across 49-167 requests, consistent with exactly these events and nothing per-turn [VERIFIED: transcript usage records].

---

## 2. Measured Data

### Sample

6 recent sessions (2026-08-03 to 2026-08-07) from `~/.claude/projects/-home-jsagi/*.jsonl`, parsed line by line for (a) UserPromptSubmit `attachment` entries, (b) real user turns (excluding tool_result turns and sidechains), (c) per-request API `usage` records deduplicated by `requestId` [VERIFIED: measurement script, this session].

### Injection frequency and size

| Session | User turns | NAV blocks | Avg bytes | Min | Max | Stable bytes* | Varying bytes* |
|---|---|---|---|---|---|---|---|
| 4167dfe2 | 13 | 9 | 1,533 | 1,485 | 1,539 | 873 (57%) | 660 |
| 3379ec87 | 19 | 17 | 633 | 325 | 1,708 | 144 (23%) | 489 |
| dc2e4356 | 2 | 1 | 349 | - | - | n/a | n/a |
| e786546f | 15 | 11 | 1,945 | 1,501 | 2,744 | 616 (32%) | 1,329 |
| a396e801 | 13 | 7 | 1,543 | 1,543 | 1,543 | 1,543 (100%) | **0** |
| 2bc2872b | 1 | 1 | 1,557 | - | - | n/a | n/a |
| **Total/avg** | **63** | **46 (73% of turns)** | **1,275** | 325 | 2,744 | ~25-60% typical | ~40-75% typical |

\* "Stable" = lines byte-identical across every block in that session (the skeleton: header, field labels, the FIRE-IF-FORK instruction, AskUserQuestion contract line). "Varying" = reach verbs with percentages, `Why:` rationale, room/topic names, tier_mode.

Headline numbers:

- **Average injected block: ~1,275 bytes (~320-425 tokens; ~365 at an assumed 3.5 bytes/token for this symbol-heavy text [ASSUMED: no tokenizer run])**
- **Fires on ~73% of user turns** (46 of 63)
- **Per-session injection total: ~10-21 KB (~3-6K tokens) in a normal working session**
- **Variance:** the skeleton is stable as hypothesized; the reach list varies. But note session a396e801: **7 consecutive byte-identical blocks** (idle room state), meaning 6 of 7 emissions that session carried zero new information.
- **Room-bind blocks:** 0 full binding-gate blocks in the sample; 4 tiny "session unbound: choose which room(s)..." one-liners (~60 bytes each). The bind block is rare, not a per-turn cost in practice [VERIFIED: sample of 6 sessions].
- **Intra-block duplication:** the `[AskUserQuestion payload: ...]` JSON repeats the 3 verb lines already printed above it verbatim (~300 bytes of pure duplication per Mode A block) [VERIFIED: block inspection].

### Cache behavior in the same sessions (the smoking gun)

| Session | API requests | Cache-read tokens | Cache-write tokens | Uncached input | Hit rate | Zero-cache-read requests |
|---|---|---|---|---|---|---|
| 4167dfe2 | 49 | 6.84M | 367K | 6.6K | **94.8%** | 2 |
| 3379ec87 | 140 | 68.27M | 1.91M | 1.0K | **97.3%** | 2 |
| e786546f | 167 | 67.47M | 2.94M | 0.3K | **95.8%** | 3 |
| a396e801 | 81 | 26.56M | 2.51M | 0.2K | **91.3%** | 3 |

If per-turn injection broke the prefix, cache-read would collapse toward zero on every post-injection request and uncached/write input would dominate. It does not. Roughly 7.3 API requests per user turn (437 requests / 60 turns) each re-read the full prior context at 0.1x, exactly as the incremental-extension contract predicts.

---

## 3. Cost Model

Base-input-token-equivalents ("equiv") normalize the 1.25x write and 0.1x read multipliers onto the base input price. Sonnet-class base input assumed $3/MTok, Opus-class $5/MTok [CITED: prompt-caching doc pricing section; exact model mix per session not extracted].

### Scenario A: actual mechanism (append-only, what really happens)

Per average session (11 NAV blocks x ~365 tokens, ~109 API requests, block sees on average half the session's requests after it):

- Writes: 11 x 365 x 1.25 = **~5.0K equiv**
- Re-reads: 365 x 0.1 x 11 x ~55 = **~22.1K equiv**
- **Total: ~27K equiv per session = ~$0.08 (Sonnet) / ~$0.14 (Opus-class)**
- As a share of the session's real input spend (e.g. 3379ec87: ~9.2M equiv total): **~0.3%**

Secondary, harder-to-price effect: ~3-6K tokens of injection bloat per session consumes 2-3% of the usable context window, pulling auto-compaction forward. Each compaction invalidates the messages cache and triggers a full re-write of the summarized context plus the summarization call itself. The injection's compaction-acceleration cost is real but second-order at current block sizes [ASSUMED: not isolated in this measurement].

### Scenario B: if the hypothesis had been true (counterfactual, for the record)

If each turn's varying block invalidated the prefix, every request would pay full context at 1.0x instead of 0.1x. Session 3379ec87's 68.3M cache-read tokens would have been ~68.3M uncached equiv instead of 6.8M: **~+$185 on that single session** (Sonnet base), roughly **60x the session's entire actual input bill** and ~2,300x the actual injection cost. This is the catastrophe ep55's framing implies. It is not occurring. The measurement exists precisely so CACHE-02 does not solve this non-problem.

### Monthly bill impact (assumptions stated)

[ASSUMED: 2 working sessions/day, 26 dev days/month = ~50 sessions/month, single developer, Sonnet-class pricing; subscription users pay in rate-limit headroom rather than dollars, same token math.]

- **Actual injection cost: ~$4-7/month equivalent.**
- Latency: cache reads are fast; the injected ~365 tokens add milliseconds of prefill. The dominant per-turn latency on this rail is NOT caching at all: it is the 7 synchronous UserPromptSubmit hooks (timeouts 1.5-3s each, nav engine hard-capped at 1,200ms inside intent-classifier.cjs) running before the request fires [VERIFIED: hooks/hooks.json + intent-classifier.cjs NAV_HARD_TIMEOUT_MS].

---

## 4. What This Means for CACHE-02 (and CACHE-03)

**The "stable-prefix/append-only" property already holds at the transport level.** Claude Code appends system-reminders; hooks cannot touch the true prefix. CACHE-02 should therefore NOT re-architect the rail for prefix stability (there is nothing to stabilize and no hook-writable prefix to move into). The doctrine to write down as first-party (per the corpus-whitespace note in the requirement) is: *per-turn hook injection in Claude Code is cache-safe by construction; its cost is append-accumulation, so the levers are size, dedup, and emission discipline.*

Recommended CACHE-02 shape, in order of measured payoff:

1. **Suppress-when-unchanged (biggest single win).** Emit nothing (or a 1-line marker) when the decision is byte-identical to the previous turn's. Session a396e801 proves the case: 7/7 identical blocks, 6 pure-waste emissions. Cheap to implement: hash the rendered block into the session decision-trace file (already per-session, already atomic) and compare.
2. **Move the invariant skeleton to SessionStart.** The FIRE-IF-FORK instruction (~400 B), the AskUserQuestion contract line, and the legend are identical every turn. SessionStart context is injected once, cached once at 1.25x, then read at 0.1x forever. Per-turn payload shrinks to the varying lines only (fire_skill / Why / reach verbs): a 40-60% cut on the measured blocks. Caveat to verify at plan time: the Section-6 no-always-on-skill finding (tier0-removal handoff) and whether SessionStart context survives compaction; if it does not, re-seed via the existing post-compact hook.
3. **Kill intra-block duplication.** The `[AskUserQuestion payload: ...]` JSON repeats the verb lines verbatim (~300 B/block). Reference them ("the 3 verbs above") or carry indexes.
4. **Do NOT invest in per-turn cache_control tricks, prefix pinning, or moving the block "up" the request.** Non-problems under the verified mechanism.

**CACHE-03:** the Brain reach can ride the existing rail as-is from a caching standpoint. "Without breaking the prefix each turn" is satisfied by construction; the binding budget for CACHE-03 is the BLOCK SIZE the reach adds per turn (hold it inside the post-CACHE-02 envelope, ~300-600 B varying payload), not the injection mechanism.

---

## 5. Honest Limits of This Measurement

- **Token conversion is estimated** (3.5 bytes/token for symbol-heavy text), not run through the real tokenizer. Bounds given (320-425 tok/block) [ASSUMED].
- **Sample = 6 sessions, one machine, one developer, CLI surface, dev-heavy workloads** (high tool-call counts inflate the re-read multiplier vs a chat-style Desktop session, where the injection's relative share would be HIGHER per token but absolute requests fewer). Desktop and Cowork surfaces unmeasured (Tri-Polar gap, stated deliberately).
- **Model mix per request not extracted**; dollar figures use class prices, not per-request attribution.
- **Compaction-acceleration cost not isolated** (would need paired sessions with/without injection; that is an experiment, not read-only analysis).
- The hooks doc wording was fetched 2026-08-10; the `attachment` transcript shape is host-version dependent and was verified against sessions from the currently installed Claude Code.

## Sources

- Claude Code hooks reference (UserPromptSubmit additionalContext placement, system-reminder insertion) [CITED: code.claude.com/docs/en/hooks, fetched 2026-08-10] - HIGH
- Prompt caching contract (prefix hierarchy, incremental multi-turn extension, invalidation, 1.25x/0.1x pricing) [CITED: platform.claude.com/docs/en/docs/build-with-claude/prompt-caching, fetched 2026-08-10] - HIGH
- `hooks/hooks.json`, `scripts/intent-classifier` (bash wrapper), `scripts/intent-classifier.cjs` (formatEngineDecisionBlock ~L1050-1109, emitBindingGate ~L2603-2691, NAV_HARD_TIMEOUT_MS=1200) [VERIFIED: repo read] - HIGH
- Session transcripts `~/.claude/projects/-home-jsagi/{4167dfe2,3379ec87,dc2e4356,e786546f,a396e801,2bc2872b}.jsonl`, parsed read-only [VERIFIED: measurement scripts in session scratchpad] - HIGH for sizes/hit-rates on this machine; MEDIUM for generalization
