---
phase: 127
slug: brain-mcp-local-stdio-shim
status: scoped + design-locked (ready for /gsd:plan-phase 127)
priority: P0 -- closes the largest cluster of Brain wiring failures (7 of 20 taxonomy rows) and unblocks zero-config Brain reachability for every new install
created: 2026-05-14
updated: 2026-05-19 (promoted back into v1.13.0 -- see version_decision)
milestone: v1.13.0
beta_target: 1.13.0-beta.19
milestone_predecessor: v1.13.0-beta.18 (the bundle of Phases 118 + 119 + 120 + 121 + 121.5 fix) -- this phase rides immediately after
version_decision: |
  - 2026-05-14: Jonathan promoted Phase 127 from v1.13.0-beta.14 to v1.13.1. Rationale at the time: the architectural shift was too big for a beta within the closing milestone.
  - 2026-05-19 (REVERSED): Jonathan promoted Phase 127 + Phase 127.1 BACK into v1.13.0. Rationale: v1.13.0 redefined from "The Closed Loop" (Hooked Fixes + Canon Part 10) to "The Closed Loop + Brain Goes Native". The bigger release narrative is worth the ~2-week ship-date slip; v1.13.0 becomes the version where MindrianOS auth ceremony disappears and Brain feels native. v1.13.1 milestone keeps Phases 128/129/130/131 but loses its architectural anchor; v1.13.1 is now "spine repair + lens engine + research workflow" not "Brain native".
canon_parts:
  - Part 6 (dog-fooding mandate -- the Brain wiring failures were caught by real tester transcripts, not synthetic tests; the plugin's own install path must honor its canon)
  - Part 7 (reuse-before-build -- ~85% reuse of lib/core/brain-client.cjs HTTPS path; the new shim is a thin stdio wrapper around the existing HTTPS code)
  - Part 8 (graph boundary -- the local shim does NOT change the LOCAL-to-BRAIN boundary; the shim still proxies via the typed-packet contract; user-data egress remains forbidden)
depends_on:
  - Phase 110 brain-context-packet-contract (the typed-packet wire contract this shim's tool calls travel through)
  - Phase 123 install-lifecycle-harness (the resolver chain + key resolver this shim consumes)
  - Phase 126 install-lifecycle-harness-gaps (the parallel hotfix track for the residual install + doctor gaps)
dependents:
  - Phase 121.5 terminal-coherence capstone (cannot ship final v1.13.0 until Brain MCP path is no-config-reliable across surfaces)
  - v1.14.0 Phase TBD -- local-first SQLite snapshot extension to this shim (Tier 0.5 offline mode; not in this phase's scope)
family_predecessors:
  - Phase 94-03 (Plan-94-03 canonical MCP server name `mindrian-brain` -- this shim INHERITS that name; v1.11.2 alignment)
  - Phase 126 case #6 (residual install-lifecycle gaps; this phase fixes a SUBSET of them but is a separate architectural surface)
brain_impact: NONE-NEW (the shim's tool surface is identical to what the remote MCP server already exposes; no new Brain reads, no new Brain writes)
hotfix_discipline: NO (this is a new bin/ file shipped in the plugin; not a hotfix to existing code paths; ships as beta.14 alongside Phase 126 hotfixes)
---

# Phase 127: Brain MCP Local Stdio Shim + Auto-Migration

## Goal

Ship `bin/mindrian-brain-mcp-client.cjs` -- a local stdio MCP server bundled with the plugin -- and add it to the plugin's `.mcp.json` so every new install gets `mindrian-brain` auto-loaded with ZERO user wiring beyond providing `MINDRIAN_BRAIN_KEY` in env / `~/.mindrian.env`. The shim proxies tool calls to the cloud Brain (the methodology director) and consumes the new `DirectiveEnvelope` typed packet (default mode: GUIDED). Include an auto-migration path that detects existing testers' user-scope HTTP-transport registrations and replaces them with the bundled stdio version on next plugin update.

Ships in v1.13.1 (point release after v1.13.0 closes). Beta cycle starts at v1.13.1-beta.1.

## Architectural model (post-2026-05-14 reframing)

The Brain is the **director** (methodology orchestration). The local SQLite spine (Phase 109) is the **context** (room state). Claude is the **driver** (executes the directive against context). Larry is the **pedagogical voice** on top.

The cloud Brain is NOT subset-mirrored locally. There is no bundled snapshot. The local SQLite spine carries room context only -- artifacts, decisions, cross-relationship scan results -- never methodology data. Methodology lives in the cloud.

### Two tiers, not three

| Tier | What user gets | Requires |
|---|---|---|
| **LOCAL (no key)** | Claude + Larry's voice + room context (Phase 109 spine). A thinking partner that walks beside the user without methodology orchestration. | nothing |
| **CONNECTED (key in `~/.mindrian.env`)** | All of LOCAL plus the curated method directing every move. Brain returns DirectiveEnvelope; Larry/Claude executes per mode. | `MINDRIAN_BRAIN_KEY` |

There is no Tier 0.5 with bundled methodology data. Without Brain access, methodology orchestration commands return a structured "DIRECTOR_NOT_AVAILABLE" message, Larry surfaces a one-line upgrade hint per the canon: *"this command needs Brain access -- request a key at https://mindrianos.vercel.app/brain-access"*.

### Library decisions (locked, not open)

- **Local store: SQLite** (canonical per `feedback_local_graph_sqlite.md`; NOT Kuzu, which was deprecated and migrated away from). The Phase 109 SQL spine already ships this layer.
- **Vector store: not needed locally** -- semantic search lives in cloud Pinecone. The local layer doesn't run vector queries.
- **No bundled Brain snapshot** -- the methodology lives in the cloud, the local layer is room context only.

### What the stdio shim returns when key is absent (LOCAL tier)

For every Brain MCP tool call (`mcp__mindrian-brain__brain_ask` etc.) the shim returns a structured response:

```
{
  status: "DIRECTOR_NOT_AVAILABLE",
  reason: "MINDRIAN_BRAIN_KEY not set",
  command_context: "<command name that called brain_ask>",
  upgrade_hint: "Request a Brain key at https://mindrianos.vercel.app/brain-access",
  fallback_advice: "Larry can still talk with you and reflect on your room context. Methodology orchestration requires Brain."
}
```

Claude reads this, surfaces the Larry-voiced version to the user, never crashes, never falls into opaque error.

## Bottom line (Larry-voiced)

Today a user must (1) install the plugin, (2) drop their API key in a file, (3) run `claude mcp add` with the right transport, scope, and Bearer header, (4) restart Claude Code, (5) hope nothing fell through. The success rate on this chain across 4 documented tester transcripts is 1/4 (Lawrence got there after a full diagnostic session). Phase 127 collapses it to (1) install the plugin, (2) drop the key. Two steps. Plugin owns the rest.

## The architectural move

| Before (today) | After (Phase 127) |
|---|---|
| User runs `claude mcp add -t http -s user -H "Authorization: Bearer $KEY" -- mindrian-brain https://mindrian-brain.onrender.com/mcp` | User does nothing |
| MCP entry lives in user's Claude Code internal registry (populated by `claude mcp add` -- NOT readable from `~/.claude/.mcp.json` directly per the failure mode Lawrence empirically proved on 2026-05-13) | MCP entry lives in plugin's bundled `.mcp.json` next to mindrian-os; Claude Code auto-loads it on every session |
| Restart required after wiring | No wiring step; first plugin load is the wiring |
| Tier 0 (no key) = `claude mcp list` shows server FAIL or absent; commands silently fall through | Tier 0 (no key) = shim boots, returns graceful "Brain unavailable -- run /mos:setup brain" on every tool call; plugin continues working |
| Render cold start surfaces as opaque timeout | Shim owns the retry / backoff / cold-start messaging |

## Concrete deliverables

### Deliverable 1: `bin/mindrian-brain-mcp-client.cjs` (the local stdio shim)

New file. Pattern mirrors `bin/mindrian-mcp-server.cjs` (which is the canonical local stdio MCP server for `mindrian-os`).

Responsibilities:
- Boot as a stdio MCP server when the plugin loads
- Resolve `MINDRIAN_BRAIN_KEY` via existing `lib/core/resolve-brain-key.cjs` chain (env -> ~/.mindrian.env -> cwd .env)
- Register the 6 canonical Brain tools: `brain_ask`, `brain_query`, `brain_schema`, `brain_search`, `brain_stats`, `brain_write`
- For each tool call: proxy to remote Render Brain via existing `lib/core/brain-client.cjs` HTTPS client
- Handle three tiers explicitly:
  - **Tier 0 (no key):** return a structured "Brain unavailable" response with action hint, do not crash
  - **Tier 1 (key + Brain reachable):** proxy result from Render
  - **Cold-start tier:** retry with exponential backoff (3 attempts, 30s ceiling), surface human-readable "Brain warming up" message instead of opaque timeout
- Stdio framing per `@modelcontextprotocol/sdk` (the SDK is already a dependency)
- Preserve Canon Part 8 boundary: all tool-call payloads must conform to the typed Brain Context Packet contract (Phase 110); no user-content egress; the shim is a transport layer, not a data-shaping layer

### Deliverable 2: plugin `.mcp.json` update

Add the new server entry alongside the existing `mindrian-os`:

```json
{
  "mcpServers": {
    "mindrian-os":    { "command": "node", "args": ["bin/mindrian-mcp-server.cjs"], "alwaysLoad": true },
    "mindrian-brain": { "command": "node", "args": ["bin/mindrian-brain-mcp-client.cjs"], "alwaysLoad": true }
  }
}
```

This makes the shim auto-loaded by Claude Code on every session for every surface (CLI / Desktop / Cowork) that honors plugin `.mcp.json`. Verified pattern -- this is exactly how `mindrian-os` already loads.

### Deliverable 3: Auto-migration from old HTTP-transport user-scope registration

For existing testers (Lawrence, Gary, and anyone who followed the corrected `claude mcp add` path), their user-scope Claude Code registry contains an HTTP-transport `mindrian-brain` entry pointing at the Render URL with a Bearer header. After beta.14 ships, two `mindrian-brain` servers would exist: the legacy user-scope HTTP one, and the new plugin-bundled stdio one. Claude Code's MCP resolver behavior with duplicate names is unpredictable.

Migration script: `scripts/migrate-brain-mcp-from-http-to-stdio.cjs`. Runs as part of session-start hook (or sessionstart-npm-reconcile cascade) on beta.14 first-launch. Logic:

1. Run `claude mcp get mindrian-brain` (or read the user-scope MCP registry directly if Claude Code exposes a file path).
2. If a user-scope HTTP-transport entry exists AND its URL is the canonical Render endpoint AND the API key matches `MINDRIAN_BRAIN_KEY`: remove it via `claude mcp remove mindrian-brain --scope user`.
3. Plugin-bundled stdio entry then resolves cleanly on next tool call.
4. Log the migration to `~/.mindrian/migrations.jsonl` so a re-run is a no-op.
5. If the user-scope entry has a DIFFERENT key from `~/.mindrian.env` (Lawrence's case has two keys -- 4131ed5b and 107a31b4), DO NOT auto-migrate; surface a one-line warning telling the user to rotate keys.

### Deliverable 4: Doctor Class K (Brain end-to-end smoke)

Per the gsd-debugger's unified diagnosis ("the bug is the absence of one wire-test that runs every resolver in order"), add Class K to `scripts/doctor.cjs`. One check that runs:
1. Plugin root resolver -> active root
2. Key resolver -> key bytes
3. HTTPS path probe via brain-client.schema()
4. MCP path probe via stdio handshake to the bundled shim
5. End-to-end probe: a single `brain_schema` call through the MCP path with the resolved key

Returns ONE boolean. Reports each layer's PASS/FAIL with the reason field from the resolver if applicable. Detects: failure mode #1, #2, #3, #4, #5, #8, #9, #13, #14, #15, #19, #21 from the Phase 126 taxonomy. Replaces ~60% of the doctor's existing Brain-adjacent checks with one composable test.

## Scope EXPLICITLY OUT of Phase 127

- The bundled SQLite snapshot for Tier 0.5 offline mode. **Deferred to v1.14.0**. Phase 127 ships the SHIM; the offline snapshot rides on top later. Out-of-scope here to keep beta.14 ship-able in days, not weeks.
- Collapsing the 6-tool user-facing surface down to `brain_ask` only with admin-tier behind `/mos:admin`. **Deferred to v1.14.0**. Phase 127 keeps all 6 tools live (the shim proxies all six identically); the user-facing collapse is a separate UX decision.
- Migration of project-scope `.mcp.json` `mindrian-brain` entries (vs user-scope). The patch prompt I sent some testers wrote to `~/.claude/.mcp.json` -- this is project-scope, and per Lawrence's empirical evidence Claude Code CLI does not consult it for user-scope MCP servers anyway. So the project-scope file edits are no-ops, not conflicts. Document but do not migrate.

## Acceptance gates

1. On a synthetic clean install (no `~/.mindrian.env`, no `claude mcp add` history): plugin install + first `claude` session = `mindrian-brain` appears in `claude mcp list` as "✓ Connected" with stdio transport, returns Tier-0 graceful messaging on tool calls. PASS.
2. On a synthetic install with valid `~/.mindrian.env` key: same as #1 plus `brain_schema` tool call returns real labels from Render. PASS.
3. On a synthetic install simulating Lawrence's state (user-scope HTTP-transport `mindrian-brain` already registered): beta.14 first-launch removes the legacy entry, stdio bundled entry resolves, brain_schema call succeeds. PASS.
4. On a synthetic install simulating Tier 0 (no key): plugin loads, statusline renders, brain_schema call returns graceful "Brain unavailable" message, no crash, no opaque error. PASS.
5. Doctor Class K returns PASS on a healthy install and identifies the exact failing layer when any one of the 5 layers breaks. PASS.

## Three-track release plan

The architectural shift ships across THREE tracks running in parallel:

| Track | Audience | Path | Timing |
|---|---|---|---|
| A | Existing testers (Lawrence, Gary, Rea, Natan) | Manual `claude mcp add` wiring per the corrected v2 prompt; nothing more required after v1.13.1 lands (auto-migration removes their legacy entry, plugin's bundled stdio takes over). | Hold path through v1.13.0; auto-migration runs on v1.13.1 first-launch. |
| B | New installs starting v1.13.1 | Two steps: install plugin, drop API key. No wiring. | v1.13.1 ship target: ~3 weeks from phase greenlight (1.13.1-beta.1 around day 14, final around day 21). |
| C | Existing users on v1.13.0 who never wired MCP path (the 14 zero-request keys + the 12 with under-10 requests) | Same as Track B effectively -- v1.13.1 lights up the MCP path automatically the moment their `~/.mindrian.env` has a key. The silent-failure cohort gets unblocked without any individual outreach. | v1.13.1 ship + 1 session restart. |

The 14-zero-request cohort is the silent value. Phase 127 reaches them with zero ceremony because the wiring problem dissolves rather than gets-fixed-tester-by-tester.

## Why v1.13.1, not v1.13.0-beta.14

Phase 127 was originally scoped for beta.14. Promoted to v1.13.1 on 2026-05-14 because:

1. **Architectural shift is too big for a beta within the closing milestone.** Phase 126 (install-cache hotfixes) and Phase 127 (Brain shim architecture) have different shapes. Mixing them in one beta muddies the release narrative.
2. **v1.13.0 closes sooner with hotfixes only.** Testers stop waiting on the Brain shift to get their install-cache fixes.
3. **v1.13.1 gets its own release event.** "1.13.1: the Brain bakes itself in" reads cleanly as a release headline. Buried-in-beta is the opposite.
4. **The release-process canon mandates beta cycles for new infrastructure.** v1.13.1 starts at 1.13.1-beta.1; the canon mandate is preserved.

## DirectiveEnvelope -- the new typed packet (default mode: GUIDED)

Phase 127's stdio shim is the FIRST plugin consumer of a new typed packet: `DirectiveEnvelope`, returned by `brain_ask`. The envelope carries a mode (GUIDED / AUTONOMOUS / HYBRID), the directive content for that mode, an escape-hatch override map, and the next decision-gate sub-shape (F.1-F.5).

**Default mode: GUIDED.** Per `feedback_larry_pedagogical_guided_first.md` -- Larry is the pedagogical guide for the human-in-the-loop. AUTONOMOUS is allowed in exactly two cases: (1) explicit user invitation ("just tell me", "bottom line"), (2) non-judgment prep work (e.g., 30-sec MVA prep step in Phase 118). HYBRID is the most common shape for non-trivial methodology runs.

Full DirectiveEnvelope shape: see `docs/CAPABILITY-MAP.md` § DirectiveEnvelope. The capability map IS the contract source; this phase implements it.

## Capability map registration

Per `docs/CAPABILITY-MAP.md` "Update protocol", this phase's PR cites:

- Capability row #1: `brain_ask` consumed via DirectiveEnvelope wire format. Phase 127 is the first plugin consumer.
- Capability row #3: `brain_schema` consumed by doctor Class K end-to-end smoke test.
- Capability rows #2, #4, #5, #6 stay as-is (already shipped consumers).

## Additive scope expansion (2026-05-16 dual-graph review verdict)

The 2026-05-16 architectural review (verdict at `.planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md` top section + three reviews at `.planning/research/2026-05-16-dual-graph-review-{A,B,C}-*.md`) approved ONE additive primitive that rides Phase 127's scope:

- **`bin/local-chain-recommender.cjs`** (~80 lines, sibling to `lib/brain/chain-recommender.cjs`). Plain Tier-LOCAL helper. Closes the Tier-LOCAL predictive-surface gap that Phase 127 itself opens (when `MINDRIAN_BRAIN_KEY` is absent, `chain-recommender.cjs` degrades to `[seed]` with no local fallback). The new helper walks local `memory_event` aggregates via `navigation.cjs` chokepoint only; no Brain calls; enum-only projections from memory_event payloads (Canon Part 8 constraint per review A). Surface: `predictNextLocal(seed, roomDb) -> next_move[]`. Integration: `chain-recommender.cjs` falls through to `predictNextLocal()` when Brain is unreachable instead of returning `[seed]`. No lens-class taxonomy; no DGEKT vocabulary; pure additive helper.

This scope expansion is small (~80 lines + 1 integration touch) and orthogonal to the stdio shim work; it can ship in the same beta cut or one cut later if it adds risk.

## Cross-references

- **`.planning/v1.13.1-EXECUTION-PLAN.md` -- THE canonical wave-by-wave execution plan that places Phase 127 as the Wave 2 architectural anchor**
- `docs/CAPABILITY-MAP.md` -- THE Brain ↔ Plugin contract; this phase implements row #1's DirectiveEnvelope
- Author's Claude memory store (`feedback_larry_pedagogical_guided_first.md`) -- the GUIDED-default canon rule. The memory file lives outside the repo at the Claude harness's `~/.claude/projects/.../memory/` path; the rule applies even though the artifact is not in-repo.
- `bin/mindrian-mcp-server.cjs` -- the canonical local stdio MCP server to mirror
- `lib/core/brain-client.cjs` -- the HTTPS client the shim wraps
- `lib/core/resolve-brain-key.cjs` -- the key resolver the shim consumes
- `lib/brain/chain-recommender.cjs` -- the Brain-side chain recommender that `local-chain-recommender.cjs` falls through to on Tier-LOCAL
- `.mcp.json` -- the plugin .mcp.json to extend
- `.planning/phases/126-install-lifecycle-harness-gaps/126-FEEDBACK-2026-05-13-mac-lawrence-brain-test.md` -- the empirical evidence base
- `docs/install/BRAIN-SETUP.md` -- the doc that gets rewritten when Phase 127 ships (the section about manual `claude mcp add` becomes "this happens automatically now")
- `mcp-server-brain/server.cjs` -- the REMOTE Brain MCP server (Render-hosted); unchanged by Phase 127, still the canonical source of truth
- `.planning/research/2026-05-16-dual-graph-architectural-proposal.md` + the three review files (A canon / B execution-plan / C adversarial) -- the audit trail for the additive scope expansion above
