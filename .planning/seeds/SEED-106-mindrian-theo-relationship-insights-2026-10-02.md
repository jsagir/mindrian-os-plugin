---
id: SEED-106
status: folded
folded_into: "Phase 366.1 (item 2, closing evidence), Phase 364 inputs (items 3-5), Phase 366 notes (items 1, 6, 8), Phase 369 (items 7, 9); Theo-side items 2-5 go to the Theo handoff (2026-10-02)"
priority: high
planted: 2026-10-02
planted_during: Phase 366 (executing)
trigger_when: at the next Theo sync or Theo phase planning (Theo 20.2.1 / 20.2.2 / 25), at the next release cut (release.sh Step 5.6 notify), or before any phase that sends science-shaped questions to Theo
scope: a bundle of small items; several are Theo-side (cross-repo, /home/jsagi/Theo)
related: SEED-019 (Part 8 guard as runtime guardrail), SEED-090 (stage taxonomy), SEED-096 (Theo content backfill), SEED-098 (Scientific Roadmapping through Theo, promoted), SEED-104, SEED-105, Phase 366 deliverable 5 (canon handles)
---

# SEED-106: What the Mindrian-Theo relationship should learn from a live science session (2026-10-02)

Source: one CLI session on beta.53 that took a navigator from "is Mindrian updated" through a
materials-science hypothesis (an EGaIn-in-DES programmable liquid conductor) to a room, prior art,
analogies and two plugin fixes. Every Theo observation below was measured live, not inferred.

## Insights

1. **The plugin's own privacy guard locks the navigator out of Theo's book.** `part8-egress-guard-hook`
   blocked every `mcp__theo__brain_ask`: plain generic words ("hypothesis test validate assumption",
   reason `freeform_unmatched`) and op-mode `framework_chain_slice` with only framework names and
   `/mos:` slugs (reason `unknown`). `feeds_into_chains`, `recommend_chain`, `framework_neighborhood`
   and `find_chapter_for_need` passed. Theo's lexical book search is unreachable from the CLI. The guard
   must learn the difference between generic methodology vocabulary and room content (SEED-019).
2. **Theo's view of the plugin is two releases behind and doesn't know it.** `theo_health.sync_drift`
   reported canon stamp `command-registry@2.0.0-beta.51`, `releases_cut_since: 0`, `finding:
   within-threshold`, measured 2026-09-30, while beta.52 and beta.53 had shipped. Either the Step 5.6
   `theo-resync` dispatch didn't land, or the drift probe doesn't count it. The served build stamp was
   2026-09-17 and dirty. Drift should be measured against the plugin's live version at call time, not a
   cached probe.
3. **Theo answers science questions with business chains.** For a discovery question, nearly every
   FEEDS_INTO chain walked from Beautiful Question, Trending to the Absurd or Dominant Design ended at PWS
   Value Proposition, Lean Canvas or JTBD. Only a few edges point at discovery (Beautiful Question to
   Bias Detection 0.85, Red Teaming to Problem Definition Transformation 0.85, Scenario Planning to
   Knowns and Unknowns 0.7, Cross-Disciplinary Thinking to Opportunity Recognition). A researcher
   persona needs a discovery-terminated lane, which is the job SEED-098 promoted.
4. **The graph has no scientific-method content.** No falsifiability, controls, priors or
   mechanism-vs-property guidance; the session had to supply it. Candidate for Theo ingest under the
   PWS-sources-supreme rule (navigator course text outranks Theo canon), never invented.
5. **Problem-type coverage is thin.** Only 109 of 460 frameworks link to a problem type, and 5 of 460
   carry a watcher (live `brain_stats` / `recommend_chain` evidence). A thin `recommend_chain` answer
   reads like a fit verdict when it is a coverage gap; the tools should say "uncovered" out loud.
6. **Room nodes still carry no canon handles.** The fresh room's Eureka recall reported
   `canon_resolved: 0`, so `find_connections` could not be asked across the room/Theo boundary. That
   is Phase 366 deliverable 5; this session is one more measured zero.
7. **One description, many surfaces (Cloudflare Forge pattern).** Theo holds 113 MindrianCommand nodes,
   re-emitted from the plugin's command registry by `repository_dispatch`. If
   `data/command-registry.json` became the single description every surface is generated from (command
   frontmatter, MCP tool definitions with a description budget, the website list, SEED-036), Theo's
   command layer would be one more generated target instead of a resync, and drift (insight 2) becomes
   a build error. This also covers the 2,048-character MCP description/instructions cap (Claude Code
   2.1.280). CORRECTED 2026-10-02 (radar plan 261002-30x, measured): mindrian-os server instructions
   are 1984 bytes, under the cap, and `lib/mcp/no-instructions.test.cjs` enforces it. The truncation seen
   in sessions is the user-level `pws-brain-mcp` entry in `~/.claude.json`, which this repo does not ship.
   Open question for Theo: a user-level Brain server also bypasses the plugin's guarded shim (THEO-04),
   the same shape as the known mindrian-brain shadow rule.
8. **The research planner and Theo's grant loop share a failure shape.** SEED-104's family mismatch
   (a plan family the grant could not cover) is the same class as Theo's D-10 exact-match canon handles:
   a scope minted in one place and checked in another. Any future Theo lane under a grant (366-15)
   should derive its scope from the plan, as quick 261002-0n4 now does for families.
9. **A UI would change what Theo sees.** If the MindrianOS UI (SEED-105) exposes actions over A2A, Theo
   could be addressed as an agent peer rather than an MCP server. Speculative; recorded so the A2A option
   is weighed against the guarded-shim rule before anyone builds it.

## What to do with it

- Theo-side (cross-repo): items 2, 3, 4, 5. Carry into the Theo handoff (`/home/jsagi/Theo/.planning/`).
- Plugin-side: items 1 (SEED-019), 6 (Phase 366), 7 (a registry-as-source seed or SEED-036 expansion), 8 (366-15 review).
- Item 9 waits on SEED-105's spike.

## Evidence

- Room: `~/MindrianRooms/egain-des-liquid-conductor/` (prior-art scan, analogies, eureka run `20261001T211803Z`)
- `theo_health` and `brain_stats` outputs captured in-session 2026-10-02
- Quick task `261002-0n4` (SEED-104 fix), `261002-30x` (radar gap fill)

## Disposition (2026-10-02)

Re-measured live 2026-10-02 (generic handles only): `theo_health.sync_drift` still reports baseline
`command-registry@2.0.0-beta.51`, `releases_cut_since: 0`, measured 2026-09-30, build stamp 2026-09-17 dirty, while
`v2.0.0-beta.53` and `v2.0.0-beta.55` are tagged and `package.json` reads `2.0.0-beta.56`; `watcher_coverage`
5 of 460 with a watcher, 109 of 460 with a problem type; `brain_stats` 28,137 nodes, 53,311 relationships.
Fold: item 1 to Phase 366 as a note (with SEED-019); item 2 named in Phase 366.1 as its closing evidence (scope
not widened); items 3-5 to `364-INPUT.md` section "SEED-106 inputs"; items 6 and 8 already in Phase 366
(deliverable 5, plan 15); item 7 weighed in Phase 369 section 10 and SEED-036; item 9 waits on Phase 369.
Theo-side items (2-5) are cross-repo and go to the Theo handoff. Fold map: `rethinking-mindrianos/research/2026-10-02-seeds-101-107-fold-map.md`.
