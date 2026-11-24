# Phase 400: Job sentences, Cynefin layer, problem-axes fixes, hosted Gemini relay - Research

**Researched:** 2026-11-24
**Domain:** plugin data contracts (job sentences, capability labels), the Phase 399 decision advisor, a small hosted Node relay on Render
**Confidence:** HIGH for the code facts (read and run in this tree); MEDIUM for Render behaviour (official docs, not deployed); LOW for relay caller auth (no existing per-user check reaches a live server; owner ruling needed)

## Summary

The plugin holds no per-user credential at query time. Theo is keyless by design and the plugin sends it only an opaque random bucket id (`x-theo-install-id`). The one per-user key check that exists in code (`mcp-server-brain/lib/auth.cjs`, Supabase `brain_api_keys`, `Authorization: Bearer mbr_...`) runs only on the old `mindrian-brain` service, which answers HTTP 503 today, and the plugin stopped sending that key on 2026-10-05 (SEED-119). The install/update entitlement of decisions 1 and 5 was decided (option B, the existing key) but never built (269-05 halted). So O-07's "reuse the existing user credential check" has nothing live to reuse. This is the one item that needs the owner (see Open Question 1 and NEEDS_HUMAN).

Everything else is well supported by the existing tree. `data/framework-jobs.json` exists: 184 ruled main framework sentences, all 184 parse into three slots. The 73 run-step commands are a full subset of the 113 commands in the recorded Cynefin and move-type runs. The labels-only validator loads with zero npm dependencies (`node:fs`, `node:path`, `problem-axes.cjs`, `adapter.cjs`, `providers/gemini.cjs`, two data files), so the relay can `require()` it unchanged, IF the Render service has no `rootDir` (Render makes files outside `rootDir` unavailable at build and run time).

Several 399 tests pin exact shapes (`CYNEFIN_LEVELS` 4 values, `readRoomAxes` deep-equal, job `summary` equal to the taxonomy one_line, recorded render wording). The additive path that keeps `tests/run-all-399.sh` green is: new constants and new fields beside the old ones, never edits of the old ones.

**Primary recommendation:** Put the relay in this repo at `services/decision-relay/` (plain `node:http`, zero dependencies, not in package.json `files`), deploy it from the repo root with a custom Blueprint path, accept only the neutral labels request, build the Gemini body server-side with the same `labels-only.cjs` and `adapter.cjs`, and gate callers with an operator token in v1 until the owner rules on the user credential.

## Project Constraints (from CLAUDE.md)

- Canon Part 8: only labels leave the machine; user data never egresses. The relay is a labels-only boundary.
- Canon Part 7: reuse before build. Reuse `labels-only.cjs`, `adapter.cjs`, `providers/gemini.cjs`, the 399 transport, the Theo rate-limit pattern, the strategy-card ratify pattern.
- Canon Part 9: SQL only through `lib/core/navigation.cjs` or an allow-listed `lib/core/navigation/*` submodule (`scripts/check-substrate.cjs:69-70`); new tables or columns registered in `.planning/phases/108-graph-memory-schema-reconciliation/aliases.yml` before DDL.
- Canon Part 11: every new invocable surface (a new gate card kind, any new command) is born WIRED or EXCLUDED and declares a HITL shape (`scripts/check-shape-declaration.cjs`).
- Canon Part 12: no grades or raw numbers to the navigator (`present.cjs` strips numbers).
- Three surfaces: CLI, Desktop, Cowork. A gate card must render on all three rungs of `lib/mcp/gate-render.cjs`.
- Hooks and the MCP server stay `.cjs`. No new dependency in the root package.json (`tests/test-341-shrinkwrap-no-dev.cjs`).
- CLI parsing: switch-case router, no Commander or yargs.
- No em dashes. Hyphens only. PwS with a lowercase w.
- Run `bash tests/run-all-<phase>.sh` after edits. Do not push. Do not use `--no-verify`.
- Grounding: state the Theo-side analog for Brain-adjacent findings (given in the Architecture section).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- O-01 Job formula: "When <situation>, I want <progress>, so I can <outcome>." Store all three slots.
  The book glossary's choice among its three wordings was NOT ruled; do not edit the book.
- O-02 A stated, measurable target makes a problem Well-defined AND wicked when it is disputed and fixes
  shift it. D-06 holds in code (wicked can sit on any level). The book's "sharp edge of Ill-Defined"
  wording was not ruled; do not change the book.
- O-03 Disorder: "Let the host model decide." Pass the disorder label plus the book's slicing note to the
  host model. The advisor does not force an abstain on disorder. Confirm the wording at plan time.
- O-04 One Cynefin domain per room in v1 (no per-part domains).
- O-05 The navigating-complexity draft chapter (PwS-Book) is the Cynefin label source for v1; labels provisional.
- O-06 Labels-only Gemini runs are approved.
- O-07 ACCESS: a hosted relay in THIS phase. All users reach Gemini Decision through a relay that holds
  the owner's key. The key never ships in the plugin (public repo and npm).
- O-08 RELAY HOST: Render, beside the existing Brain/Theo services. Build the relay host-neutral
  (plain Node, no platform lock), with a Render blueprint for deploy.

Research findings to honour (F-01..F-09) and scope S1..S5 are in 400-CONTEXT.md and bind the planner as written there. Constraints carried from 399 also bind (no second resolver, Part 8, Part 9, run-all-399 green, no GEMINI_API_KEY on this machine, no em dashes).

### Claude's Discretion
CONTEXT.md has no "Claude's Discretion" section. Discretion is implied where CONTEXT says "planner may refine" (the relay path) and "if the planner keeps one at all" (the opt-in live ask).

### Deferred Ideas (OUT OF SCOPE)
- Chaining (F-08). Next research step: formula sentences for the commands in the plugin's 23 curated
  chains, then test the slot rule against them.
- Per-part Cynefin domains (O-04).
- Turning the advisor on by default; turning the egress line on by default.
- A second human labeller; fresh cases for the reworded Well definition; blind Cynefin labels.
- Any change to PwS-Book or Theo.
- Release cut and push (push gate: owner reviews every commit ahead).
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs were given. The planner maps plans to scope items S1..S5 of 400-CONTEXT.md.

| Scope | Description | Research support |
|-------|-------------|------------------|
| S1 | Three-slot job sentences | Q4 findings, Pattern 1, Pitfalls 1-3 |
| S2 | Cynefin layer | Q5 findings, Patterns 2-4, Pitfalls 4-8 |
| S3 | Problem axes wording and wicked cut-off | Q6 findings, Pitfall 9 |
| S4 | Hosted Gemini relay | Q1-Q3 findings, Pattern 5, Pitfalls 10-14, Security Domain |
| S5 | Label review lists | Q5 tallies, Open Question 5 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|------------|-------------|----------------|-----------|
| Job sentence slots (store, validate) | Plugin data + generators (`data/`, frontmatter, `scripts/build-*`) | Tests (drift) | Static labels; generated registries already carry per-capability text |
| Cynefin domain vocabulary | Plugin data (`data/cynefin-domains.json`) | Book drift test (read-only, skip if absent) | Closed label set, one source |
| Room domain (navigator answer) | Room store (room.db via a `lib/core/navigation/` submodule) | MCP gate tools (`gate_render` / `gate_answer`) | Part 9; the answer is room state, never inferred |
| Advisor reorder by domain | Plugin core (`lib/core/decision-advisor/shortlist.cjs`, `present.cjs`) | Selectors that already consume it | No second selector; per-turn path stays local |
| Labels-only check | Plugin core (`labels-only.cjs`) | Relay (same module, server-side) | One source of truth, run on both sides |
| Gemini key, rate limits, caps | Relay (Render web service) | - | Key never ships; cost control is server-side |
| Relay client | Plugin dev script (`scripts/decision-advisor-transport.cjs`) | Egress policy (`decision_advisor` line) | 399 fence: no lib/ or hooks/ file may name the transport |

## Findings by question

### Q1. Relay auth: what credential reaches a server today

| Fact | Evidence | Tag |
|------|----------|-----|
| The plugin calls Theo with no credential. "Theo needs no credential ... So this client sends none, resolves none, registers nothing and writes no token file." | `lib/core/brain-client.cjs:18-24`; default origin `:41` | VERIFIED: codebase |
| The only header the plugin adds is an opaque per-install bucket id: `x-theo-install-id`, a CSPRNG value with no input, stored at `~/.mindrian/theo-install-id.json` (or `$MINDRIAN_HOME`). | `lib/core/install-id.cjs:7-27,63-65,90-92`; spread in `brain-client.cjs:224-236,295,597,1232` | VERIFIED: codebase |
| The old Brain key resolver is gone; the file keeps only a 0600 permission helper. | `lib/core/resolve-brain-key.cjs:5-10` | VERIFIED: codebase |
| SEED-119 ruling 2026-10-05: "the key concept is removed from the Theo path entirely. No env var, ... no Bearer header ... The install and update entitlement of decisions 1 and 5 is a different matter". Ruling 1 of the same seed: "No key in user interaction, at all." | `.planning/seeds/SEED-119-finish-the-brain-to-theo-cutover-in-the-product.md:59,95-99` | VERIFIED: codebase |
| Theo server side builds zero auth (D-06). `/register` mints a random string and forgets it; "THIS IS NOT AN AUTHENTICATION SYSTEM". Rate limits key on `x-theo-install-id` (hashed, bounded map) with an address fallback behind `THEO_HTTP_PROXY_HOPS=1`. | `~/Theo/src/http/register-route.ts:1-27`; `~/Theo/src/http/rate-limit.ts:53-81,93-134`; `~/Theo/render.yaml` (THEO_HTTP_PROXY_HOPS block, "Theo builds zero auth, so there is nothing to key") | VERIFIED: codebase |
| The only per-user key check in code: `validateApiKey` reads `Authorization: Bearer <key>`, looks the key up in Supabase table `brain_api_keys` (columns `api_key` or `api_key_text`, `mbr_` prefix), checks `status` revoked/expired/grace/active and `plan`, caches 5 min, falls back to `BRAIN_API_KEYS` env. | `mcp-server-brain/lib/auth.cjs:1-17,48-89,133-246,294-374`; blueprint `mcp-server-brain/render.yaml` (`BRAIN_API_KEYS`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) | VERIFIED: codebase |
| Keys are minted on the website: Google sign-in, Supabase `auth.getUser(jwt)`, then `mbr_<uuid>` trial key, 30 days, plan `trial`. | `~/dev/mindrian-website/supabase/functions/provision-trial-key/index.ts:37,47,75-89` | VERIFIED: codebase (read only) |
| Live probe 2026-11-24: `mindrian-brain.onrender.com/health` 503, `pws-brain-mcp.onrender.com/health` 503, `theo-mcp.onrender.com/health` 200. | curl from this machine | VERIFIED: probe |
| Entitlement: option B decided 2026-08-27 ("The existing Brain API key becomes the install/update entitlement credential too"), "Phase 269 writes zero entitlement-check code", 269-05 is the gated home. No `entitle` symbol exists in `lib/`, `scripts/`, `bin/`, `hooks/`. Claude Code has no plugin install/update hook; the only seam is the next SessionStart, CLI only. | `docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md` (Credential option space; Enforcement reality 1-4); grep over the tree | VERIFIED: codebase |
| No user-held token exists on this machine: no `~/.mindrian-install.json`; `~/.mindrian/install-state.json` holds version and topology keys only. | filesystem check | VERIFIED: probe |

**Conclusion (plain).** No per-user credential reaches any live server at query time. The relay can reuse: (a) the Bearer-header shape and the Supabase `brain_api_keys` lookup logic from `mcp-server-brain/lib/auth.cjs` (port, do not import: that package needs express and its own deps); (b) the Theo rate-limit pattern (install-id bucket, address fallback, proxy hops, bounded maps); (c) the health-route posture (`{"status":"ok"}` only). What is missing: a credential that a plugin install holds and sends. Building one means either the 269-05 entitlement engineering or reversing SEED-119's "no key in user interaction".

**Smallest option consistent with the entitlement model:** v1 relay accepts an operator token only (`RELAY_OPERATOR_TOKENS`, Bearer, constant-time compare), and serves the release-time table build. CONTEXT already says the per-turn path makes no live call and the live ask is optional. Build the caller check as one pluggable function (`verifyCaller(req) -> {ok, bucket, reason}`) so a later Supabase verifier (option B, once 269-05 provisions the key at install) is a drop-in, not a rewrite. Owner ruling required: NEEDS_HUMAN (see Open Question 1).

### Q2. Where relay code lives

| Option | Evidence | Verdict |
|--------|----------|---------|
| Plugin repo `services/decision-relay/` | Precedent: `mcp-server-brain/` is a served (not shipped) service in this repo with its own `render.yaml` and `package.json` (`mcp-server-brain/CLAUDE.md`: "It is NOT shipped to users; it is served"). package.json `files` is an allowlist with no `services` entry; `npm pack --dry-run` lists 2,221 files, 0 under `mcp-server-brain/`, 0 under `services/`, 0 under `tests/`. The marketplace installs from the npm source (`~/mindrian-marketplace/.claude-plugin/marketplace.json:11-12`). | RECOMMENDED. One source of truth for the validator. |
| Theo repo | CONTEXT Deferred: "Any change to PwS-Book or Theo." Theo D-06 is keyless by design; `register-route.ts:22-26` says the entitlement engineering "must not become a Theo requirement". Theo is TypeScript with `npm ci && tsc`. | Rejected (out of scope). |
| New repo | The validator and catalog would be vendored and need a drift check against this repo. | Rejected (two sources of truth). |

Render facts that shape the layout:
- "Files outside your service's root directory are not available to the service at build time or at runtime." Build filter paths are relative to the repo root even with a root directory. [CITED: render.com/docs/monorepo-support]
- "you can define your Blueprint file anywhere" via the Blueprint Path field. [CITED: render.com/docs/infrastructure-as-code]
- Node version precedence: `NODE_VERSION` env, then `.node-version`, `.nvmrc`, then root package.json `engines`; an open range like `>=22.18.0` resolves to the latest release; current default 24.22.1. [CITED: render.com/docs/node-version]

So: no `rootDir` (service root = repo root, so `lib/core/decision-advisor/` and `data/` are readable), Blueprint at `services/decision-relay/render.yaml`, `startCommand: node services/decision-relay/server.cjs`, a no-install `buildCommand` (the relay has zero deps; `npm ci` would install next/react from the root package.json for nothing), `NODE_VERSION: "22"` pinned, and `buildFilter.paths` limited to the relay dir plus the shared modules and the two data files.

### Q3. Can `labels-only.cjs` run unchanged server-side

Yes. Measured in this tree: requiring `labels-only.cjs` and `adapter.cjs`, validating the 399 sample request and the Gemini body, loads exactly `lib/core/decision-advisor/labels-only.cjs`, `lib/core/problem-axes.cjs`, `lib/core/decision-advisor/adapter.cjs`, `lib/core/decision-advisor/providers/gemini.cjs` (lazy), and the request file. Both validations return `{ ok: true }`. [VERIFIED: node run]

Dependencies: `node:fs`, `node:path` (`labels-only.cjs:8-10`); `problem-axes.cjs` (`DEFINITION_LEVELS` only; its `ambient-framing.cjs` require is lazy inside `readRoomAxes`, `problem-axes.cjs:103-105`); data files `data/job-vocabulary.json` and `data/command-registry.json` read at `labels-only.cjs:43-46`, relative to `__dirname/../../..`. No network, no env read (fence `tests/test-399-advisor-fence.cjs` FN1).

Consequences: (1) the relay catalog equals the deployed commit's registry and vocabulary, so a client on another release can be refused `unknown_command` (version skew, Pitfall 12); (2) the relay must not live under `lib/core/decision-advisor/` because FN1 forbids network code there; (3) server-side, accept the NEUTRAL request and build the body with `adapter.renderRequest` plus `PROVIDERS.gemini.buildBody`, then `validateProviderBody` again before the POST (same order as `scripts/decision-advisor-transport.cjs:94-115,151-162`).

### Q4. S1 job sentences: inventory and storage

| Surface | Count (from disk) | Store the three slots in | Regeneration and drift check |
|---------|-------------------|---------------------------|------------------------------|
| Commands | 113 `commands/*.md` (all have `serves_jtbd` and `teaching`) | Frontmatter, three flat keys: `job_when:`, `job_want:`, `job_so:` (quoted strings) | `scripts/build-command-registry.cjs` reads frontmatter (`:304-395`) and `--check` byte-compares (`:525-564`); add a `job_sentence: {when,want,so}` object (or null) per registry entry |
| Mirrored skills | 113 of 125 `skills/*/SKILL.md` mirror commands | Nothing by hand: `scripts/build-skill-mirrors.cjs` copies command frontmatter byte for byte except listed classes | `node scripts/build-skill-mirrors.cjs --check` (already in `run-all-399.sh`) |
| Standalone skills | 12: brain-connector, client-discovery-interview, context-engine, conversation-mode, intelligence-orchestrator, larry-personality, mos-deck-engine, mullins-scaffold, pws-methodology, room-passive, room-proactive, ui-system | SKILL.md frontmatter, same three keys | new test reads them |
| Agents | 17 `agents/*.md` (2 carry `serves_jtbd`) | Frontmatter, same three keys (399 precedent: agent labels live in agent frontmatter, `data/capability-job-labels.json` `_note`) | new test |
| MCP tools | 63 connector surfaces in `data/mcp-tool-connectors.json` (generated) | A new data file keyed by tool name (399 precedent: MCP tools have no frontmatter, so labels live in `data/capability-job-labels.json`) | new test cross-checks names against `mcp-tool-connectors.json` |
| Job vocabulary | 20 ids in `data/job-vocabulary.json` | New fields beside `summary`: `sentence`, `slots {when,want,so}`, `sentence_status: "provisional"` | `tests/test-399-job-vocabulary.cjs` V3 pins `summary` == taxonomy `one_line` (`:67-75`) |
| Frameworks | `data/framework-jobs.json` EXISTS (Phase 395-10): 376 entries, 184 with a ruled main statement | Reuse as is; slots derived by a parser at read time, or a generated slot file | 184 of 184 ruled main statements match `^When (.+?), I want (?:to )?(.+?), so (?:I\|we) can (.+?)\.?$` (measured) |

Why flat keys: the hand-rolled parser handles `key: value`, JSON arrays, and one nested block (`executable:`) only (`scripts/build-command-registry.cjs:123-139,200-217`). A nested `job:` map would be silently dropped. Flat quoted strings need no parser change and survive the skill mirror byte copy.

Research draft to vocabulary id map (`jobs-in-formula-v0.json`, private): 17 draft ids, all 17 exist in `data/job-vocabulary.json`; no draft id is unknown. Three vocabulary ids have no draft: `build`, `navigate`, `temporal-correction`. All 17 drafts parse with the slot regex. The draft for `decide-pursue` has commas inside its When slot, so a "split on the first comma" parser fails (Pitfall 2).

### Q5. S2 Cynefin layer

**Overlap.** The 113 commands in `cynefin-fit-commands-gemini.json` (565 pairs = 113 x 5 domains, fields `domain, command, p, jobs`) and in `move-type-gemini.json` (`commands` map with `move` and `probs`) equal the 113 registry commands; all 73 run-step commands are inside; none is missing. [VERIFIED: computed]

**Tallies at p >= 0.70 (derived counts only):**

| Set | clear | complicated | complex | chaotic | disorder | no domain |
|-----|-------|-------------|---------|---------|----------|-----------|
| 113 commands | 22 | 57 | 38 | 0 | 18 | 23 |
| 73 run-step | 3 | 50 | 33 | 0 | 15 | 9 |
| 51 run-step with `kind: methodology` | 1 | 37 | 23 | 0 | 11 | 6 |

Move type (argmax), 73 run-step: analyze 28, probe 25, categorize 13, slice 7, act 0. For the 51 methodology commands: analyze 24, probe 17, slice 6, categorize 4. 15 of the 73 have a top move probability under 0.5. [VERIFIED: computed]

**Housekeeping rule (proposed, objective):** a capability enters move matching only when its registry `kind` is `methodology`. Run-step kinds: methodology 51, utility 18, meta 4 (registry `kind` field; whole registry: utility 56, methodology 51, meta 4, mechanical 2). Excluded commands keep their 399 behaviour (never demoted, never boosted). Caution: `scripts/build-command-registry.cjs:87-98` says `kind` is the wrong fence for "navigator vs plumbing" (that fence is `surface`). The use here is different (is this a methodology move with a Cynefin verb order?), but the 22 excluded run-step commands must go to the owner review list, because some read as methodology: `/mos:eureka`, `/mos:explore-opportunity`, `/mos:qualify-opportunity`, `/mos:scout`, `/mos:radar` are `utility`. 9 of the 22 have move `categorize`, which supports F-05 (categorize is mostly housekeeping).

**Table key and fallback.** Today: key `<job>|<definition_level>|<last_command>`, fallback exact, `job|level|*`, `job|*|last`, `job|*|*` (`shortlist.cjs:16-17,113-128`). The shipped table has 13 rows, all `job|*|*`, `key_order` `[job, definition_level, last_command]`, thresholds strong 0.7, possible 0.5, `shortlist_k` 3. Recommended extension (Pattern 2): read `table.key_order`; when it holds `cause_effect`, build 4-part keys; for each 399 key in its 399 order, try "with domain" then "without domain". With domain null the key list is exactly the 399 list, so output is identical. The v0 table needs no rebuild: no recorded run conditions on the domain, so the domain acts through the in-band reorder (Pattern 3) until a domain-conditioned run exists.

**Top ties matter.** Measured on the shipped table: decide-pursue 7 tied at the top, validate-idea 7, explore 8, connect-domains 3, compare-options 3, find-bottleneck 2, prepare-pitch 2. `present.cjs:59-98` turns a top tie into `no_strong_pick` with an unordered set, and `command-resolver.cjs:209` abstains on `top_tie > 1`. A domain reorder must not silently turn a tie into a pick (Pitfall 6).

**Gate card for the navigator's domain answer.** Existing card kinds: `general` (default), `binding`, `material_step`, `strategy_goal` (`lib/mcp/tools/gate.cjs:209-212,399,582,1067`; `lib/core/strategy/strategy-card.cjs:82`). The precedent for a card whose approve writes room-level state is the strategy card: `goalGate.isStrategyCard(card)` and a `_softStep` that calls `ratifyGoalProposal` inside the gate_answer transaction (`gate.cjs:886-905`). Use the same shape: a new kind `cause_effect_domain`, a builder module, `isCauseEffectCard`, and a ratify step that writes through a new navigation submodule. Option count: AskUserQuestion takes 2 to 4 options per question and appends "Other" [CITED: code.claude.com/docs/en/agent-sdk/user-input]; 5 domains plus "not sure" do not fit one AskUserQuestion question (Pitfall 7).

**Room storage.** room.db has a key/value `identity (key, value, updated_at)` table (`lib/core/memory-ops.cjs:247-250`). `room.*` keys are owned by `lib/core/navigation/room-identity.cjs` ("only this module writes room.* keys"). Recommend a new allow-listed submodule `lib/core/navigation/cause-effect.cjs` that writes key `problem.cause_effect` (JSON `{domain, source:"navigator", gate_id, decision_node_id}`) inside `withRoomTx` (`lib/core/navigation/room-change-log.cjs`), plus a read function. Register the key and the new nullable `selection_observations.cause_effect_domain` column in `aliases.yml` (precedent: `calibration_observations` EXISTS entry with a new column, `aliases.yml:324-340`). Today `readRoomAxes` reads only `STATE.md` (`problem-axes.cjs:99-110`); the domain read must be a separate function so the 399 shape stays (Pitfall 4).

**Advisor consumers to touch (no new selector):** `lib/workflow/command-resolver.cjs:196-213,251-258` (`_advisorContext`, `advisorOptsForRoom`), `lib/core/feyminto/next-move.cjs:265-290,690`, `lib/core/navigation/selection-log.cjs:103-128,204,220` (reads `wickedness.cynefin_rating` today, writes column `cynefin_rating`, `memory-ops.cjs:200-225`).

### Q6. S3: where the level question and the wicked threshold live today

- The plugin has NO level question or wicked yes/no question in code. The wording that the host model reads for the definition level is the Axis 1 table in `references/methodology/problem-types.md:11-18` (Well-defined: "Clear parameters, specific constraints"). The same file puts Wicked on the Cynefin complexity axis (`:20-27`), the X1 mixing defect in prose. `commands/diagnose.md:73` loads it; `lib/mcp/brain-router.cjs:238-245` parses that matrix for Tier 2 routing.
- The research level and wicked questions exist only in the private research scripts (not in the repo). F-07 in CONTEXT carries the reworded Well definition.
- Existing wicked thresholds: `WICKED_ESCALATION_THRESHOLD = 8` (score from BRAIN.md `wicked_indicators`) and `LOW_CONFIDENCE_FLOOR = 0.5` in `lib/core/problem-type-router.cjs:109-110`; `axesFromSections` sets `wicked: true` at score >= 8 (`:311-327`). These are a different scale from a Gemini wicked probability. No code reads a wicked probability today.
- Part 8 consequence: a problem statement is room content, so a live level or wicked question can never go to the relay. S3 therefore lands as (a) versioned wording data plus a pure accessor behind a flag, used by the host-facing reference and by dev-time evaluation on research cases only, and (b) a stored cut-off or isotonic map for any wicked probability, fitted at dev time, only derived breakpoints in the repo.

## Standard Stack

### Core
| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`node:http`, `node:crypto`, `node:fs`, `node:path`, global `fetch`, `AbortSignal.timeout`) | Node 22.x (local v22.23.1; repo floor >=22.18.0) | Relay server, upstream call, timeouts, constant-time token compare | Zero dependencies; host-neutral (O-08); same as the 399 transport |
| Existing `lib/core/decision-advisor/*` | in tree | Validator, render, Gemini body and parser | One source of truth (S4) |
| Existing `scripts/decision-advisor-transport.cjs` | in tree | Client send path behind the egress line | 399 fence FN2 keeps it out of lib/ and hooks/ |

### Supporting
| Library | Version | Purpose | When to use |
|---------|---------|---------|-------------|
| Render web service (Blueprint) | n/a | Host | Owner-gated deploy (S4) |
| Supabase REST (`/rest/v1/brain_api_keys`) | n/a | Per-user key lookup | Only if the owner picks the Supabase verifier (Open Question 1) |

### Alternatives considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `node:http` | express (already a root dependency) | Needs `npm ci` on Render for the whole root package (next, react, sqlite-vec); more to patch; no gain for two routes |
| Neutral request in, body built server-side | Client sends the Gemini body, server runs `validateProviderBody` | Equal safety, but the server would accept a client-chosen `model`; server-built body pins model and path |
| Operator token (v1) | Install-id bucket only (Theo pattern) | Install id is not authentication; anyone can mint one; only caps would limit cost |

**Installation:** none. The phase adds no package. Package Legitimacy Audit: not applicable (no external package installed; slopcheck not run).

## Architecture Patterns

### System Architecture Diagram

```
 navigator answers gate card "who can see cause and effect here?"
        |
        v
 gate_render (kind cause_effect_domain) --> gate_answer approve
        |                                        |
        |                         ratify step (soft step, same tx)
        v                                        v
 card rungs: elicitation / AskUserQuestion / text   lib/core/navigation/cause-effect.cjs
                                                  writes identity key problem.cause_effect (room.db)
                                                         |
 per turn (no network) ------------------------------------+
        |
        v
 resolveSelectionJob + readRoomAxes (STATE.md) + readCauseEffect (room.db)
        |
        v
 shortlist.lookupShortlist {job, level, domain, last}
   key list: 399 order, each key tried with domain then without
        |
        v
 in-band reorder: inside the strong band only, methodology capabilities whose
 move_type fits the domain first; ties stay ties; chaotic -> no_strong_pick
        |
        v
 present.publicShortlist (no numbers) + one domain line (verb order; disorder slicing note)
        |
        v
 host model judges (D-02)

 release time (owner machine, outside the turn path)
 build script --> transport (provider relay) --egress line decision_advisor--> HTTPS
        --> relay /v1/decide: verifyCaller -> size cap -> validateNeutralRequest
            -> render + buildBody (model pinned) -> validateProviderBody -> rate/daily cap
            -> POST generativelanguage.googleapis.com/v1beta/decisions (key from env, redirect error, timeout)
            -> parse answers -> reply {answers, usage}; log counts only
        --> recorded run fixture --> build-decision-advisor-table.cjs --> data/decision-advisor-table.json
```

### Recommended Project Structure
```
services/decision-relay/
  server.cjs          # node:http, two routes, never throws to the socket
  relay.cjs           # pure handler: verify, validate, render, cap, forward (testable without a socket)
  verify-caller.cjs   # one pluggable caller check (operator token in v1)
  limits.cjs          # per-bucket and global windows, daily cap (bounded Maps)
  render.yaml         # Blueprint (custom Blueprint Path), no rootDir, no secret values
  README.md           # operator steps, owner-gated actions listed
  ROOM.md             # ICM Layer 0 identity
data/cynefin-domains.json            # 5 ids, verb order, posture, move type, book path + quote hash
data/capability-cynefin-labels.json  # fits_domains, move_type per run-step command, provisional
data/capability-job-sentences.json   # MCP tool slots (tools have no frontmatter)
lib/core/navigation/cause-effect.cjs # room-level domain write and read (Part 9)
lib/core/cause-effect-card.cjs       # card builder + isCauseEffectCard (strategy-card precedent)
tests/test-400-*.cjs, tests/run-all-400.sh
```

### Pattern 1: Store slots, render the sentence (S1)
**What:** The three slots are the stored truth; the sentence is a pure render. Never parse free prose to get the slots, except for the 184 already-ruled framework statements, where a parser is a read-time view and a test proves 184 of 184 parse.
```javascript
// Validator idea for every surface. Exactly three non-empty slots; render must round-trip.
function renderJob(s) { return 'When ' + s.when + ', I want ' + s.want + ', so I can ' + s.so + '.'; }
function slotErrors(s) {
  const e = [];
  for (const k of ['when', 'want', 'so']) {
    if (typeof s[k] !== 'string' || !s[k].trim()) e.push(k + ' empty');
    else if (/[\u2013\u2014]/.test(s[k])) e.push(k + ' has a dash');
    else if (/[.]$/.test(s[k].trim())) e.push(k + ' ends with a period');
  }
  return e;
}
```

### Pattern 2: Domain in the key, dropped first, 399 order kept (S2)
```javascript
// shortlist.cjs findRow extension. With domain null this yields exactly the 399 key list.
function keysFor(job, level, domain, last, fourPart) {
  const base = [];
  if (level && last) base.push([level, last]);
  if (level) base.push([level, '*']);
  if (last) base.push(['*', last]);
  base.push(['*', '*']);
  if (!fourPart) return base.map(([l, c]) => job + '|' + l + '|' + c);
  const out = [];
  for (const [l, c] of base) {
    if (domain) out.push(job + '|' + l + '|' + domain + '|' + c);
    out.push(job + '|' + l + '|*|' + c);
  }
  return out;
}
// fourPart = Array.isArray(table.key_order) && table.key_order.indexOf('cause_effect') !== -1
```

### Pattern 3: In-band reorder only
**What:** Only options with band `strong` move, and only among themselves; a `possible` option never rises; band words never change; when `isTopTie` is true the state stays `no_strong_pick` and the list stays unordered (at most split into "fits the domain" and "other", both unordered). Unknown domain: return the 399 object unchanged (deep-equal test over all 20 jobs and all fixture keys). Chaotic: `no_strong_pick` with an honest line (no command fits act-first, F-04). Disorder: unchanged 399 shortlist plus the label and the slicing note for the host model (O-03).

### Pattern 4: Room-level write through a card ratify step (Part 9)
Copy the strategy-card shape: card builder module, `isCauseEffectCard(card)`, and in `gate_answer` an additive `_softStep(db, 'gate_ratify_cause_effect', ...)` guarded on the kind, so every other kind is byte-unchanged (`gate.cjs:883-905`). The write goes through `lib/core/navigation/cause-effect.cjs` in the same transaction. The domain is never inferred from room text and never leaves the machine except as the closed label.

### Pattern 5: Relay request pipeline (S4)
```javascript
// services/decision-relay/relay.cjs (sketch). Order fixed; every step refuses, never strips.
const labels = require('../../lib/core/decision-advisor/labels-only.cjs');
const adapter = require('../../lib/core/decision-advisor/adapter.cjs');
const UPSTREAM_PATH = '/v1beta/decisions'; // providers/gemini.cjs PATH; host comes from config, https only
async function handle(req, deps) {
  const who = deps.verifyCaller(req.headers);            // 401/403, no body read before this
  if (!who.ok) return { status: who.status, body: { ok: false, reason: who.reason } };
  if (req.bytes > deps.maxBodyBytes) return { status: 413, body: { ok: false, reason: 'too_large' } };
  const neutral = req.json;                              // JSON.parse failure -> 400 not_json
  const v = labels.validateNeutralRequest(neutral);
  if (!v.ok) return { status: 422, body: { ok: false, reason: 'labels_only_refused', detail: v.reason } };
  const cap = deps.limits.take(who.bucket, Object.keys(neutral.questions).length);
  if (!cap.ok) return { status: 429, body: { ok: false, reason: cap.reason }, retryAfter: cap.retryAfterS };
  // per chunk: render, buildBody({model pinned}), validateProviderBody, POST with redirect:'error' and a timeout,
  // parse with PROVIDERS.gemini.parseResponse, merge answers and usage; reply only {ok, answers, usage, model}.
}
```

### Anti-Patterns to Avoid
- **`rootDir: services/decision-relay` on Render:** the shared validator becomes unreadable at runtime.
- **Vendoring `labels-only.cjs` into the relay dir:** two sources of truth; drift.
- **Relay code under `lib/core/decision-advisor/`:** breaks fence FN1 (no network there).
- **A lib/ or hooks/ module requiring the transport or a relay client:** breaks fence FN2; the per-turn path must stay offline.
- **Inferring the domain from room text or from `CYNEFIN_BY_COMPLEXITY`:** F-02; at most a labelled weak source, never the shown domain.
- **Editing `summary` in `data/job-vocabulary.json` in place:** breaks V3 and changes the provider render.

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---------|--------------|-------------|-----|
| Labels-only check on the relay | A second validator | `lib/core/decision-advisor/labels-only.cjs` unchanged | One closed catalog; refuse-never-strip already proven |
| Gemini body and parse | New body code | `adapter.renderRequest` + `providers/gemini.cjs` `buildBody` / `parseResponse` | Same render the recorded run used |
| Upstream POST | New fetch wrapper | Copy `postWithBackoff` semantics from `scripts/decision-advisor-transport.cjs:62-90` (redirect error, timeout, 429 backoff) | WR-03 redirect fix already reviewed |
| Rate limiting | A new scheme | Theo `src/http/rate-limit.ts` pattern (bounded Maps, proxy hops, address fallback) | Its failure modes are documented in `~/Theo/render.yaml` |
| Per-user key lookup (if chosen) | A new account system | Port `validateViaSupabase` from `mcp-server-brain/lib/auth.cjs:133-246` | O-07 says reuse; same table and lifecycle |
| Room write | Raw SQL | `withRoomTx` + an allow-listed navigation submodule | Part 9; substrate check |
| Isotonic rescaling for the wicked cut-off | New fit code | `fitIsotonic` in `scripts/build-decision-advisor-table.cjs:55+` | Same pool-adjacent-violators method as the table |

**Key insight:** every hard part of the relay (closed-set validation, body render, redirect safety, rate buckets) already exists and was reviewed in 399 or Theo. The new code is glue plus the caller check.

## Runtime State Inventory

The axis change (new `cause_effect`, `cynefin_rating` kept as a deprecated alias) is a partial migration.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | `selection_observations.cynefin_rating INTEGER` in every room.db that ran 399 with the advisor on (`memory-ops.cjs:212`); STATE.md `complexity:` fields read by `ambient-framing.cjs:171-178` | Code edit: add nullable `cause_effect_domain TEXT` by migration (register first); keep `cynefin_rating` written for one release. No data migration: old rows keep null. |
| Live service config | No relay service exists yet. Supabase `brain_api_keys` rows exist on the website project (state not verified from here) | Owner creates the Render service and sets env (owner-gated) |
| OS-registered state | None. Verified: the relay is not a local process; no task scheduler or pm2 entry is involved | None |
| Secrets and env vars | `GEMINI_API_KEY` (relay env only, never in the repo); `RELAY_OPERATOR_TOKENS` (relay env); the plugin client reads its relay token from env only | Owner sets on Render; `sync: false` in the Blueprint |
| Build artifacts | `data/command-registry.json` (new field), `skills/*/SKILL.md` mirrors, `data/mcp-tool-connectors.json` (if descriptors change), `data/decision-advisor-table.json` (only if the schema bumps) | Regenerate with each generator, then `--check` |

## Common Pitfalls

### Pitfall 1: Rewriting job summaries in place breaks three pins
**What goes wrong:** `test-399-job-vocabulary.cjs` V3 fails; the provider render changes; recorded-wording tests in `test-399-adapter.cjs:195-207` fail.
**Why:** `summary` is copied from `lib/hmi/jtbd-taxonomy.json` `one_line` and also feeds the registry `jtbd_summary` and the labels catalog (`labels-only.cjs:47-51`).
**How to avoid:** add `sentence`, `slots`, `sentence_status` beside `summary`. Switch the render text only by an explicit later decision.

### Pitfall 2: Slot parsing on commas
**What goes wrong:** "When I have a venture, opportunity or approach in front of me, I want ..." splits wrong.
**How to avoid:** store slots; parse only with the anchored ", I want " and ", so I can " markers; test every stored sentence round-trips.

### Pitfall 3: Nested frontmatter is dropped silently
**What goes wrong:** a `job:` block with indented keys parses to `[]` in `build-command-registry.cjs` (only `executable:` descends).
**How to avoid:** three flat quoted keys.

### Pitfall 4: Shape pins in the 399 axes tests
**What goes wrong:** adding `disorder` to `CYNEFIN_LEVELS` fails `test-399-problem-axes.cjs:60`; adding a `cause_effect` key to `makeAxes` fails the deep-equals at `:73,95,133-134`.
**How to avoid:** new constant `CAUSE_EFFECT_DOMAINS` (5 values) and a separate reader; leave `makeAxes` and `readRoomAxes` byte-identical. `problem-type-router.cjs:311-327` also emits the old shape.

### Pitfall 5: The deprecated alias has a real consumer
`selection-log.cjs:117-125` reads `wickedness.cynefin_rating`. Keep it working for one release and add the domain beside it.

### Pitfall 6: A domain reorder that breaks a top tie becomes a pick
Seven jobs have top ties in the shipped table. Keep `isTopTie` computed on calibrated values; never rank inside a tie.

### Pitfall 7: Five domains do not fit one AskUserQuestion question
AskUserQuestion allows 2 to 4 options plus an automatic "Other". The elicitation and text rungs do not share that cap. Design the card for the smallest rung (for example 4 options plus a second question, or "cannot tell" mapped to disorder) and test all three rungs.

### Pitfall 8: Chaotic and disorder are not "no data"
Chaotic must say "no strong pick" honestly even when the job row has a strong pick (F-04: no command fits). Disorder must not abstain (O-03). Unknown (null) must give the exact 399 output. Never default to disorder.

### Pitfall 9: Editing `problem-types.md` breaks a parser
`brain-router.cjs:238-245` parses that matrix. Put the reworded Well wording in a versioned data file and a flagged reference block; change no table cell under the default flag.

### Pitfall 10: Render rootDir hides the shared module
See Q2. No `rootDir`; use `buildFilter.paths`.

### Pitfall 11: Unpinned Node on Render
`engines: ">=22.18.0"` resolves to the latest Node. Set `NODE_VERSION`.

### Pitfall 12: Catalog version skew between relay and client
The relay validates against the deployed commit's registry, so a client on another release can get `unknown_command`. Return the refusal reason, and send a catalog hash (sha256 of the two data files) in a `/v1/decide` reply header. Do not put the hash on `/health` (liveness only, Theo posture). Deploy the relay from the release commit.

### Pitfall 13: The egress line cannot be widened
`decision_advisor` is `default: false` and a room file can only turn lines off (`egress-policy.cjs:97-128`); `send()` refuses `egress_line_off` except through the test-only `opts.policy` seam ("no CLI flag or env sets it", `decision-advisor-transport.cjs:118-119`). A release-time relay run therefore needs an explicit, owner-approved mechanism (Open Question 2).

### Pitfall 14: Free-tier key and region rules
F-09: free-tier content is used by Google; only Paid Services may serve EEA, Switzerland or UK users. The relay must not serve users before the owner confirms the paid tier.

## Code Examples

### Relay Blueprint sketch (no secret values)
```yaml
# services/decision-relay/render.yaml (Blueprint Path set to this file in the dashboard; owner-gated)
services:
  - type: web
    name: decision-relay
    runtime: node
    plan: starter            # paid tier, no spin-down (Theo render.yaml reasoning); confirm price at deploy
    region: oregon           # same workspace and region as theo-mcp
    # no rootDir: the relay requires ../../lib/core/decision-advisor/*.cjs and ../../data/*.json
    buildCommand: node --version
    startCommand: node services/decision-relay/server.cjs
    healthCheckPath: /health
    buildFilter:
      paths:
        - services/decision-relay/**
        - lib/core/decision-advisor/**
        - lib/core/problem-axes.cjs
        - data/job-vocabulary.json
        - data/command-registry.json
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: RELAY_PROXY_HOPS
        value: "1"
      - key: GEMINI_API_KEY
        sync: false
      - key: RELAY_OPERATOR_TOKENS
        sync: false
```
Render fields `buildFilter.paths`, `healthCheckPath`, `sync: false` follow the existing `~/Theo/render.yaml` and the Render docs cited above; the exact plan name must be re-verified at deploy (Theo assumption A8).

### Client side: relay as a third transport mode
Add provider id `relay_decision` to the `decision_advisor` line `providers` and `paths` in `data/egress-policy.json` (still `default: false`). In `scripts/decision-advisor-transport.cjs`, a `--provider relay` branch sends the NEUTRAL request (already validated by `buildChunks`) to `<base>/v1/decide` with `Authorization: Bearer <env MINDRIAN_DECISION_RELAY_TOKEN>`, `redirect: 'error'`, the same timeout, and parses `{answers, usage}`. No relay host constant in code (399 rule: the base comes from `--base`).

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Per-query Brain key (Bearer `mbr_`) | Theo keyless; entitlement at install/update (not built) | 2026-08-27 (269), 2026-10-05 (SEED-119) | No user credential exists to reuse |
| `wickedness.cynefin_rating` 0-3 | separate `cause_effect` 5-value axis | this phase | alias kept one release |
| Recorded research runs only | relay-backed recorded runs at release time | this phase | owner-gated deploy and key |

**Deprecated/outdated:** `mindrian-brain` and `pws-brain-mcp` services (503); `mcp-server-brain/` is a record only (`mcp-server-brain/CLAUDE.md` header).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Supabase `brain_api_keys` rows are still readable with a service key | Q1, Don't Hand-Roll | The Supabase verifier option would not work |
| A2 | `buildCommand: node --version` is accepted by Render for a node runtime with no install | Code Examples | Deploy fails at build; fallback `npm ci --omit=dev --ignore-scripts` costs time only |
| A3 | Render runs one instance for the relay, so in-memory caps hold | Pattern 5 | Two instances double the effective cap; set instance count 1 or move caps to a store |
| A4 | `kind: methodology` is an acceptable housekeeping rule | Q5 | Wrong commands excluded from move matching; owner review list covers it |
| A5 | The navigator domain fits the `identity` key/value table rather than a new table | Q5 | A new table needs a registration and migration instead |
| A6 | AskUserQuestion 2-4 option cap applies to the Claude Code CLI rung of `gate-render.cjs` | Pitfall 7 | A 6-option card is cut or refused on CLI |

## Open Questions

1. **Relay caller credential (blocks S4 auth).**
   - What we know: no per-user credential reaches any live server; the only per-user check is the Supabase lookup on a 503 service; SEED-119 forbids any key in user interaction; 269-05 is not built.
   - What is unclear: which caller check the owner accepts for v1.
   - Recommendation: operator token only in v1 (release-time build), a pluggable verifier, and the Supabase verifier deferred until the entitlement credential is provisioned at install. Ask the owner.
2. **How a release-time relay run passes the egress line.** The line is off and cannot be widened by a room file or env. Recommendation: an owner-run dev command that loads a one-run policy object only when an explicit `--owner-approved-egress decision_advisor` flag AND a TTY confirmation are present, with the run recorded; or the owner flips `default` for the build commit only. Planner proposes, owner picks.
3. **Keep the opt-in live ask at all?** CONTEXT allows dropping it. Recommendation: drop it in v1 (no user credential exists; per-turn path stays offline).
4. **Card option layout for five domains** (Pitfall 7). Planner proposes; owner confirms wording with O-03.
5. **Owner review lists (S5):** the 22 non-methodology run-step commands, the 15 run-step commands with top move probability under 0.5, the 9 run-step commands with no domain at 0.70, the empty chaotic list, plus the 399 carry-over items in `399-LABEL-REVIEW.md` sections 1, 2 and 7. Write them to `400-LABEL-REVIEW.md` (counts and ids only; no raw research text).

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | all | yes | v22.23.1 | - |
| PwS-Book checkout | S2 drift test | yes (`~/PWS-Book`) | - | test skips when absent |
| Theo checkout | reference only | yes (`~/Theo`) | 017a4383 | - |
| GEMINI_API_KEY | live relay calls | no (by design) | - | fixtures and a loopback capture server |
| Render CLI / account | deploy | CLI absent | - | owner deploys in the dashboard (owner-gated) |
| npm | pack check | yes | - | - |

**Missing dependencies with no fallback:** none for build and test. Deploy is owner-gated by CONTEXT.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain Node assert scripts (`tests/test-*.cjs`), phase runners `tests/run-all-<phase>.sh` |
| Config file | none |
| Quick run command | `node tests/test-400-<area>.cjs` |
| Full suite command | `bash tests/run-all-400.sh && bash tests/run-all-399.sh` |

Baseline 2026-11-24 in this worktree: `bash tests/run-all-399.sh` exit 0, all 15 tests and 5 drift checks PASSED. Pre-existing failures to keep unchanged (from 399 SUMMARYs): `lib/memory/problem-type-router.test.cjs` tests 22-24; `lib/workflow/command-resolver.test.cjs` "Red Teaming must remain command-less"; `test-395-job-shown` B2, D2, E1-E5; `test-395-job-orders` C3; `test-36925-next-move` X5; `run-all-36925` 3 FAILED; `run-all-3696` FAILED=6 KNOWN=17.

### Scope -> Test Map
| Scope | Behavior | Type | Automated command | File exists? |
|-------|----------|------|-------------------|--------------|
| S1 | every command, standalone skill, agent, MCP tool has 3 non-empty slots; render round-trips; no dashes | unit + drift | `node tests/test-400-job-sentences.cjs` | Wave 0 |
| S1 | 20 vocabulary jobs carry `sentence`/`slots`/`sentence_status`; `summary` unchanged (V3 still green) | unit | same file + `node tests/test-399-job-vocabulary.cjs` | partial |
| S1 | 184 of 184 ruled framework statements parse | unit | same file | Wave 0 |
| S1 | registry and mirrors regenerate clean | drift | `node scripts/build-command-registry.cjs --check && node scripts/build-skill-mirrors.cjs --check` | yes |
| S2 | `data/cynefin-domains.json` 5 ids; book drift (clear/complicated/complex/chaotic/confused-domain-questions.md) skip if absent | drift | `node tests/test-400-cynefin-domains.cjs` | Wave 0 |
| S2 | `cause_effect` reader; alias unchanged; never defaults to disorder; weak source labelled | unit | `node tests/test-400-cause-effect-axis.cjs` + `node tests/test-399-problem-axes.cjs` | Wave 0 |
| S2 | fits_domains and move_type for exactly the 73 run-step commands; non-methodology excluded; provisional mark | unit | `node tests/test-400-capability-cynefin-labels.cjs` | Wave 0 |
| S2 | unknown domain deep-equals 399 output for every job and fixture key; in-band reorder only; ties stay; chaotic no_strong_pick; disorder note | unit | `node tests/test-400-advisor-domain.cjs` | Wave 0 |
| S2 | validator refuses domain or move_type outside the closed sets and any free text; old requests still pass | unit | `node tests/test-400-labels-only-domain.cjs` + `node tests/test-399-adapter.cjs` | Wave 0 |
| S2 | card kind renders on 3 rungs; approve writes `problem.cause_effect` through navigation; other kinds byte-unchanged | integration | `node tests/test-400-domain-gate.cjs` | Wave 0 |
| S2 | substrate, shape declaration, single selector | gate | `node scripts/check-substrate.cjs`, `node scripts/check-shape-declaration.cjs`, `node tests/test-399-one-selector-fence.cjs` | yes |
| S3 | wording flag default v1; v2 text = F-07; wicked cut-off from stored breakpoints, never 0.5 raw | unit | `node tests/test-400-problem-axes-wording.cjs` | Wave 0 |
| S4 | relay: no caller -> 401; bad label -> 422 refuse, upstream never called; body = server render; path pinned; redirect not followed; timeout; per-bucket and daily cap 429; logs hold no body or token; /health is liveness only | integration (loopback fake upstream) | `node tests/test-400-relay.cjs` | Wave 0 |
| S4 | client relay mode: line off -> zero fetch; token from env only, never printed | integration | `node tests/test-400-relay-transport.cjs` + `node tests/test-399-transport-capture.cjs` | Wave 0 |
| S4 | `npm pack --dry-run` lists 0 files under `services/`; Blueprint has no rootDir, pins NODE_VERSION, has no literal secret | static | `node tests/test-400-relay-packaging.cjs` | Wave 0 |
| S4 | fences: no lib/ or hooks/ file names the relay client; FN1 holds | static | `node tests/test-399-advisor-fence.cjs` (extend scan list) | yes |
| S5 | review list file exists and its id lists match the data files | drift | `node tests/test-400-review-lists.cjs` | Wave 0 |

### Sampling Rate
- Per task commit: the touched area's `node tests/test-400-*.cjs` plus `node tests/test-399-<neighbour>.cjs`.
- Per wave merge: `bash tests/run-all-400.sh && bash tests/run-all-399.sh`.
- Phase gate: both runners green, generators `--check` clean, `node scripts/doctor.cjs --acceptance` no new blocker.

### Wave 0 Gaps
- [ ] `tests/run-all-400.sh` (call each test-400 file, then `bash tests/run-all-399.sh`)
- [ ] the 12 `tests/test-400-*.cjs` files above
- [ ] `tests/fixtures/400/` derived fixtures only (domain-conditioned shortlist fixture table, relay request samples, fake upstream responses); never research case text

## Security Domain

### Applicable ASVS Categories
| ASVS category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | yes (relay callers) | Bearer token, `crypto.timingSafeEqual`, tokens from env; pluggable verifier |
| V3 Session Management | no | stateless relay |
| V4 Access Control | yes | one route, one upstream path, server-pinned model; operator-only in v1 |
| V5 Input Validation | yes | `labels-only.cjs` (closed sets, refuse never strip), body byte cap, JSON parse guard |
| V6 Cryptography | partial | no custom crypto; TLS at Render edge; key in env only |
| V7 Error handling and logging | yes | counts, durations, refusal reasons only; never bodies, tokens, keys |
| V13 API | yes | 429 with Retry-After, per-bucket and global limits, daily cap |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Cost amplification with the owner's key | Denial of service / Elevation | caller check, per-bucket and global limits, daily request and token caps, instance count 1 |
| Room content smuggled through label fields | Information disclosure | exact-membership validator on the server; refuse, never strip |
| SSRF or redirect to another host carrying the key | Tampering / Disclosure | fixed upstream host and path in config, https only, `redirect: 'error'` |
| Forged X-Forwarded-For to mint buckets | Spoofing | fixed proxy hop count (Theo `THEO_HTTP_PROXY_HOPS` reasoning) |
| Key or token in logs | Disclosure | structured log of counts only; test greps captured stdout and stderr |
| Census via health endpoint | Disclosure | `/health` returns `{"status":"ok"}` only |
| Free-tier data use, EEA rule | Compliance | owner confirms paid tier before any user traffic (F-09) |

## Sources

### Primary (HIGH confidence)
- This worktree, read and run 2026-11-24: `lib/core/brain-client.cjs`, `lib/core/install-id.cjs`, `lib/core/resolve-brain-key.cjs`, `mcp-server-brain/` (auth.cjs, server.cjs, render.yaml, CLAUDE.md), `lib/core/decision-advisor/*`, `lib/core/problem-axes.cjs`, `lib/core/problem-type-router.cjs`, `lib/core/ambient-framing.cjs`, `lib/core/research-planner/egress-policy.cjs`, `scripts/decision-advisor-transport.cjs`, `scripts/build-decision-advisor-table.cjs`, `scripts/build-command-registry.cjs`, `scripts/build-skill-mirrors.cjs`, `lib/mcp/tools/gate.cjs`, `lib/core/strategy/*`, `lib/core/navigation/*`, `lib/core/memory-ops.cjs`, `lib/workflow/command-resolver.cjs`, `lib/core/feyminto/next-move.cjs`, data files, `tests/test-399-*`, `.planning/seeds/SEED-119-*`, `docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md`, `references/methodology/problem-types.md`.
- `~/Theo/render.yaml`, `~/Theo/src/http/register-route.ts`, `~/Theo/src/http/rate-limit.ts` (read only).
- `~/PWS-Book/chapters/navigating-complexity.md:63-131`, `bundle/glossary/canonical/{cynefin-framework,clear,complicated,complex,chaotic,confused}-domain-questions.md` (read only).
- Private research inputs (read only, counts derived, nothing copied): `return-2026-11-24d/zip/` files named in the task; `HANDOFF-cynefin-layer-2026-11-24.md`; `gemini-decisions-rest-contract-confirmed-2026-11-24.md` (host and path).

### Secondary (MEDIUM confidence)
- [Render monorepo support](https://render.com/docs/monorepo-support) - rootDir and build filters
- [Render Blueprints](https://render.com/docs/infrastructure-as-code) - Blueprint path, sync false
- [Render Node version](https://render.com/docs/node-version) - version precedence
- [Agent SDK user input](https://code.claude.com/docs/en/agent-sdk/user-input) - AskUserQuestion 2 to 4 options

### Tertiary (LOW confidence)
- [AskUserQuestion 4-option limit issue](https://claudeissues.com/issue/12420-bug-askuserquestion-tool-limited-to-4-options-is-too-restrictive) - community report agreeing with the SDK docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new packages; all modules exist and were run.
- Architecture: HIGH for plugin side; MEDIUM for Render layout (docs, not deployed).
- Pitfalls: HIGH - each pin was found in a test file by line.
- Relay auth: LOW - no live per-user check exists; owner ruling needed.

**Research date:** 2026-11-24
**Valid until:** 2026-12-08 (Render and Gemini Decisions are fast-moving; re-check the plan name, the key tier and the AskUserQuestion cap at plan time)
