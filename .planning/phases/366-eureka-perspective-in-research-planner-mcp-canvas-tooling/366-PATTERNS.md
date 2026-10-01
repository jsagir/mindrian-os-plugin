# Phase 366: Eureka becomes a perspective of the research planner; the MCP canvas tooling; one home for Claude model routing - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 34 (new or modified)
**Analogs found:** 32 / 34 (2 have no in-repo analog: the egress policy file and the graph RS math)

All paths are relative to the repo root `/home/jsagi/dev/MindrianOS-Plugin`. Line numbers were read at HEAD in this session. Hyphens only, CJS only.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/core/research-planner/perspectives/index.cjs` (NEW registry) | config / registry | lookup | `lib/core/research-planner/question-templates.cjs` `TEMPLATES` + `PLANNER_TEMPLATE_IDS` (304-314) | role-match |
| `lib/core/research-planner/perspectives/shared.cjs` (NEW) | utility | file-I/O | `perspectives/eureka-recall.cjs` 86-120, 379-437 (helpers to lift) | exact (lift, not copy) |
| `lib/core/research-planner/perspectives/eureka-recall.cjs` (MOD) | service (recall stage) | batch, read-only DB + file-I/O | itself; swap `canonHandleOf` 183-192 for `verification-stamp.resolveEndpoint` | exact |
| `lib/core/research-planner/perspectives/eureka-judge.cjs` (MOD, perspective-agnostic) | service (judge stage) | transform + file-I/O | itself 72-118 (inject the recall module instead of `require('./eureka-recall.cjs')`) | exact |
| `lib/core/research-planner/perspectives/rs-recall.cjs` (NEW) | service (recall stage) | batch, read-only DB | `perspectives/eureka-recall.cjs` | exact shape, new math |
| `lib/core/research-planner/perspectives/hsi-recall.cjs` (NEW) | service (recall stage) | batch, read-only DB | `perspectives/eureka-recall.cjs` + `lib/core/direction-convention.cjs` | exact shape, new math |
| `lib/core/research-planner/perspectives/whitespace-recall.cjs` (NEW) | service (recall stage) | batch | `perspectives/eureka-recall.cjs` | exact |
| `lib/core/research-planner/perspectives/analogies-recall.cjs` (NEW) | service (recall stage) | transform over eureka candidates | `perspectives/eureka-recall.cjs` `recallCandidates` + `questionSetFor` | exact |
| `lib/core/research-planner/perspectives/connections-recall.cjs` (NEW) | service (recall stage) | batch, graph walk | `perspectives/eureka-recall.cjs` (entity lane 313-322 is the two-hop walk shape) | exact |
| `lib/core/research-planner/question-templates.cjs` (MOD: rs, hsi, analogies, connections templates) | config | static data | `EUREKA` 280-302, `WHITESPACE` 165-192 | exact |
| `lib/core/research-planner/families.cjs` (MOD: lenses) | config | static data | `LENS_FAMILY` 176-201 (`eu.*` rows 197-200) | exact |
| `lib/core/research-planner/pyramid.cjs` (MOD: `cross_domain_transfer` kind, leaf `pair` carry) | service | transform | `OPPORTUNITY_KINDS` 46-48, `normalizeLeaf` 357-380, `opportunityCandidates` 691-760 (`literature_gap` branch) | exact |
| `lib/core/research-planner/filing.cjs` (MOD: pair DERIVED_FROM + stamp extraProps; host `fileStampedOpportunity`) | service | CRUD (write) | `filing.cjs` 712-776 + `scripts/eureka-portfolio-report.cjs` 1808-1939 | exact |
| `lib/core/research-planner/ambient.cjs` (MOD: eureka offer branch, plan-only) | service | event-driven | `maybeQuickInner` 287-348 (whitespace branch, `recordPlanOnly`, `hasPendingPlanOnly`) | exact |
| `lib/core/ambient-run.cjs` (MOD: `_eurekaAdapter` body) | adapter | event-driven | itself 184-240 + `eureka-recall.buildSubstrate/recallCandidates` | exact |
| `lib/mcp/tools/research.cjs` (MOD: `perspective_*` ops, aliases, enum) | controller (MCP tool) | request-response, paginated | `opEurekaRecall` 472-511, `opEurekaJudge` 513-531, `opEurekaCandidates` 539-573, switch 628-647 | exact |
| `lib/mcp/tool-router.cjs` (MOD: stub redirects) | controller (router) | request-response | scout-hsi banner 2032-2038; D-G context flags 1509-1518 | exact |
| `scripts/research-planner.cjs` (MOD: `perspective-recall` / `perspective-judge`) | CLI door | request-response | `FLAGS` 73-87, `COMMANDS` 91-117, `valueOk` 135-147, `case 'eureka-recall'` 227-244 | exact |
| `commands/eureka.md` (MOD: alias + `--legacy`) | command doc | n/a | itself 100-125 (Subcommand: run) | exact |
| `lib/core/verification-stamp.cjs` (MOD: `resolveEndpoint` reads translations) | utility (resolver) | transform | itself 291-315 | exact |
| `lib/core/canon-translations.cjs` (NEW, parser for `<room>/references/canon-translations.md`) | utility | file-I/O | `verification-stamp.extractCarried` 268-283 (frontmatter regex read) + `loadFrameworkNames` 232-240 (fresh read, no cache) | role-match |
| `lib/core/navigation/framework-node.cjs` (NEW writer, or a function in `reasoning-write.cjs`) | model writer | CRUD (write) | `reasoning-write.cjs` 74-79 (`FRAMEWORK_NODE_ID`), 193-208 (edge), `views.cjs` 299-310 (mint-then-edge) | exact |
| `lib/mcp/tools/views.cjs` (MOD: canon handle at `artifact_file`) | controller | CRUD (write) | itself 271-320 (mint-then-edge anchor, bookkeeping never blocks) | exact |
| `lib/core/navigation/graph-integrity-counts.cjs` (MOD: canon coverage statement) | model (statement) | read-only SQL | itself 198-243 (fixed-literal SQL), 309-355 (`countGraphIntegrity`) | exact |
| `lib/core/doctor/room-graph-integrity-module.cjs` (MOD: two fields) | doctor module | read-only | itself `INTEGER_FIELDS` 131-141, `buildDetail` 291-302 | exact |
| `lib/core/sensors/sensor-priority.cjs` (MOD: SENS-19 `watched_by`) | config | static | itself 214-219 | exact |
| `lib/core/doctor/canon-backfill-module.cjs` (NEW, `fix_supported:true`) | doctor module | batch over registry, CRUD write | `lib/core/doctor/graph-derive-health-module.cjs` `check` 461-583, `fix` 584-706 | exact |
| `data/doctor-modules.json` (MOD: register module) | config | static | `graph-derive-health` row 188-195 | exact |
| `lib/core/part8-egress-guard.cjs` (MOD: navigator-consent allow) | middleware (guard) | request-response | `_proveKnownToolShape` 466-525 (framework handle arms) + `classify` 777-840 | exact |
| `lib/core/research-planner/canon-release.cjs` (NEW: gated per-term Theo release) | service | request-response under gate | `research.cjs mintApprovalGate` 140-200 + `audit-ledger.appendAudit` 79-94 | role-match |
| `lib/core/direction-convention.cjs` (MOD: graph-variant classifier + own phrase hash) | utility | transform | itself `classify` 112-118, `phraseHash` 126-129, `FRAMING_*` 160-200 (a second hashed table beside the first) | exact |
| `scripts/check-floor-ledger.cjs` (MOD: scan perspectives) + `data/floor-ledger.json` rows | config / gate | static scan | `SCAN_FAMILIES` 48-56 | exact |
| `scripts/refresh-framework-names.cjs` (MOD: Theo stamp field) + `scripts/release.sh` (MOD: snapshot gate) + `scripts/release-lib/<snapshot>-gate.sh` (NEW) | release gate | batch, offline check | `release.sh` 406-419 (offline ledger `--check` with `--no-ledger-check`), `release-lib/theo-stamp-gate.sh` 112-175, `refresh-framework-names.cjs buildSnapshot` 80-140 / `runCheck` 396-428 | exact |
| `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 + `.claude/includes/release-process.md` | doc | n/a | RULE 5 place 8 text (pinned by `tests/test-349-docs-lockstep.cjs`) | exact |
| `data/egress-policy.json` + reader (NEW, discretion) | config | file-I/O | none in repo (no `_config/` convention); nearest loader shape `verification-stamp.loadFrameworkNames` 232-240 | no analog |
| `scripts/spike-366-*.cjs` (NEW harness: items converter, record, `--check`) | script | batch, file-I/O | `scripts/measure-355-hit-rate.cjs` (`guardRoomPath` 71-93, `wilson95` 101-114, `buildExcerpt`/`pairId`/`directionPhraseFor` 139-167, `cliMain` 1591-1620) | exact |
| `tests/test-366-*.cjs` (about 20 files) | test | hermetic | `tests/test-seed103-eureka-perspective.cjs` | exact |
| `tests/test-366-snapshot-gate.cjs` | test | shell seam | `tests/test-343-theo-stamp-gate.cjs` | exact |
| `tests/run-all-366.sh` | test aggregator | batch | `tests/run-all-seed103.sh` (whole file) + `tests/run-all-363.sh` `run_if` 56-89 | exact |

## Pattern Assignments

### `lib/core/research-planner/perspectives/<id>-recall.cjs` (service, read-only batch) - rs, hsi, whitespace, analogies, connections

**Analog:** `lib/core/research-planner/perspectives/eureka-recall.cjs` (545 lines, read in full)

**Header docblock shape** (lines 1-40): copyright line, `SEED-103`-style provenance, WHAT IT DOES, the lanes listed, THE EXCLUSION SET, EDIT SURFACES (ICM invariant 6), Part 8 statement, "Reads go through the navigation door ... writes nothing to room.db. Hyphens only." Every new recall module carries the same sections, naming its own lanes.

**Imports** (lines 42-51):
```js
const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../../navigation.cjs');
const sectionRegistry = require('../../section-registry.cjs');
const verificationStamp = require('../../verification-stamp.cjs');
const scaffoldPredicate = require('../../scaffold-predicate.cjs');
```

**Module constants** (lines 57-68), the interface Pattern 1 generalizes:
```js
const BUDGETS = Object.freeze({
  max_candidates: 200,
  lexical_top_k: 5,
  lexical_floor: 0.08,
  body_cap: 2000,
  max_leaves: 8,
});

const SCHEMA_QS = 'mos.research-question-set/1';
const TEMPLATE_ID = 'eureka';
const COMMAND = '/mos:eureka';
const RUN_ROOT = path.join('.mindrian', 'eureka-perspective');
```
New modules add `ID`, `LENSES`, `FALSIFIER` and keep `RUN_ROOT = path.join('.mindrian', 'perspectives', '<id>')`; eureka keeps its `RUN_ROOT` unchanged. Every numeric budget/floor gets a `data/floor-ledger.json` row (Pitfall 8).

**Core pattern: the exclusion-set upsert** (lines 288-308) - every lane funnels through one `upsert(a, b, lane, extra)`:
```js
function upsert(a, b, lane, extra) {
  if (a === b) return;
  const ta = byId[a]; const tb = byId[b];
  if (!ta || !tb || ta.section === tb.section) return;
  const k = pairKey(a, b);
  if (substrate.connected.has(k) || substrate.opp_pairs.has(k)) { counts.excluded_known += 1; return; }
  if (!cands[k]) {
    const first = a < b ? ta : tb; const second = a < b ? tb : ta;
    cands[k] = { a: first.id, b: second.id, section_a: first.section, section_b: second.section, title_a: first.title, title_b: second.title, lanes: [], lexical: 0, shared_entities: [] };
  }
  ...
}
```
Keep the candidate row keys `{a, b, section_a, section_b, title_a, title_b, lanes[], lexical, shared_entities[]}`; perspective scores ride extra keys (`lag_score`, `divergence`, `direction`). The shared judge, the paginated read and the spike converter depend on these keys.

**Cap and sort** (lines 365-373):
```js
list.sort(function (x, y) { return (y.lanes.length - x.lanes.length) || ... || (x.a < y.a ? -1 : 1) || (x.b < y.b ? -1 : 1); });
const total = list.length;
const truncated = Math.max(0, total - B.max_candidates);
list = list.slice(0, B.max_candidates);
counts.candidates = list.length;
return { candidates: list, counts: counts, pairs_truncated: truncated, couplings: ... };
```
Deterministic tie-break on ids is mandatory (spike `--check` recomputes byte for byte).

**Read-only DB door** (lines 510-525), the `runRecall` shape every module exports:
```js
function runRecall(roomDir, opts) {
  const o = opts || {};
  const resolved = path.resolve(roomDir);
  const db = navigation.openRoomDbReadOnlyForCaller(resolved);
  let substrate; let recall;
  try {
    substrate = buildSubstrate(db, o);
    recall = recallCandidates(substrate, resolved, o.budgets || {});
  } finally {
    try { db.close(); } catch (_e) { /* read-only handle */ }
  }
  const tag = o.tag || runTagNow(o.now);
  const dir = writeRunFiles(resolved, tag, substrate, recall);
  const qs = questionSetFor(recall, substrate, o);
  return { ok: true, tag: tag, run_dir: dir, counts: recall.counts, pairs_truncated: recall.pairs_truncated, couplings: recall.couplings, candidates: recall.candidates, question_set: qs };
}
```
New modules REUSE `eurekaRecall.buildSubstrate(db)` (one substrate read, ICM lane via `declaredCouplings` 260-279) rather than re-querying; analogies and connections start from `recallCandidates` output.

**Question set** (lines 452-505): leaves carry `{id, question, origin:'framework_dimension', dimension, lens, researchable, falsifier:{text}, corpus, slots:{term, term2}, candidate:{a,b,lanes}}`; slots only through `slotTerm` 443-450 (Part 8: short terms only). Each new module uses its own `dimension` ids that exist in its template, and one `<prefix>-known` local leaf like `eu-known` 476-485.

**Exports** (lines 527-545): copy the export list; `_test` carries pure helpers.

Per-perspective notes:
- `hsi-recall.cjs`: the label goes through `direction-convention.cjs` only (leg H of `test-355-direction-agreement.cjs`). Note the shipped sign: `classify(lsa, semantic)` returns `classifyDiff(semantic - lsa)` (`direction-convention.cjs:112-118`), so the graph variant is `classify(lexical, relational)` (relational - lexical > 0 reads `structural_transfer`). RESEARCH Pattern 5 states the legacy sign as `lsa - semantic`; the code is `semantic - lsa`. Add the graph variant as a new exported function with its own hashed table beside `FRAMING_*` (160-200), never by editing `DIRECTION_MEANING` (that breaks `PHRASES_CONFIRMED.phrase_hash`, 142-146).
- `connections-recall.cjs`: canon handle per thing must come from `resolveEndpoint` (see below), and the two-hop walk thing -> `framework:*` -> thing reads `USES_FRAMEWORK` edges from `buildSubstrate`'s `edges` array (line 159). The Theo lateral-path check is NOT here (D-09); it is a planner evidence lane.
- `whitespace-recall.cjs`: reuses the shipped `whitespace` template and `ws.*` lenses; no new template.

---

### `lib/core/research-planner/perspectives/shared.cjs` (utility, file-I/O)

**Analog:** `eureka-recall.cjs` helpers to lift verbatim: `parseProps` 86-89, `textOfProps` 91-97, `titleOfProps` 99-103, `tokenize` 105-111, `jaccard` 113-118, `pairKey` 120, `runTagNow` 379-382, `writeJsonl` (atomic tmp+rename) 386-391, `readJsonl` 393-397, `STAGES` 399-404, `deriveStatus` 406-420. Parameterize `runDirFor(roomDir, tag)` and the STATUS.md title (`'# Eureka perspective run'`, line 407) by the module's `RUN_ROOT` / label. `eureka-recall.cjs` re-exports them so `scripts/eureka-jev-judge.cjs` and the seed103 test keep working unchanged.

---

### `lib/core/research-planner/perspectives/index.cjs` (registry)

**Analog:** `question-templates.cjs` 304-314:
```js
const TEMPLATES = deepFreeze({
  'map-unknowns': MAP_UNKNOWNS,
  ...
  'eureka': EUREKA,
});
const PLANNER_TEMPLATE_IDS = Object.freeze(Object.keys(TEMPLATES));
```
Mirror it: a frozen `{ eureka: require('./eureka-recall.cjs'), rs: ..., hsi: ..., whitespace: ..., analogies: ..., connections: ... }` and `PERSPECTIVE_IDS = Object.freeze(Object.keys(...))`. The zod enum in `research.cjs` and the CLI value check both read `PERSPECTIVE_IDS` (one list).

---

### `lib/core/research-planner/perspectives/eureka-judge.cjs` (judge, made perspective-agnostic)

**Analog:** itself. The only perspective coupling is `const recall = require('./eureka-recall.cjs');` (line 32) used by `writeVerdicts` 99-105, `readVerdicts` 107-109, `runJudge` 112-118:
```js
async function runJudge(roomDir, tag, opts) {
  const read = recall.readCandidates(roomDir, tag);
  if (!read) return { ok: false, reason: 'candidates_missing' };
  const res = await judgeCandidates(read.candidates, opts);
  const file = writeVerdicts(roomDir, tag, res.rows);
  return { ok: true, tag: tag, file: file, summary: res.summary, rows: res.rows };
}
```
Pattern: accept `opts.module` (the perspective module), default to eureka-recall, so the current call sites stay byte-stable. `stageAGate` 46-56 counts `icm_declared` / `lexical` lanes; new lanes (`flow_boundary`, `support_gap`, ...) need a decision whether they count toward the entity floor, or Stage A fails every RS candidate. `EUREKA_ENTITY_MIN` env name stays (Runtime State Inventory).

---

### `lib/core/research-planner/question-templates.cjs` (config) - rs, hsi, analogies, connections templates

**Analog:** `EUREKA` (lines 280-302), built with `dim()` (59-76):
```js
const EUREKA = {
  id: 'eureka',
  framework: 'Cross-Domain Opportunity Discovery',
  doors: ['/mos:eureka'],
  lenses: ['eu.transfer', 'eu.known'],
  perspective_map: 'A pair whose mechanism transfer is documented outside the room becomes a cross-domain opportunity candidate.',
  opportunity_rules: [
    { kind: 'cross_domain_transfer', dimension: 'eu:mechanism_transfer', when: 'verdict supported and not already known' },
  ],
  dimensions: [
    dim('eu:mechanism_transfer', 'Mechanism transfer', '...?', {
      lens: 'eu.transfer', family: CE, falsifier: 'ce.counter', step: 'paths',
      falsifier_default: 'Published work where ...',
    }),
    dim('eu:already_known', 'Already known', '...?', {
      lens: 'eu.known', step: 'tension', local: true,
      falsifier_default: 'A room artifact that already states the connection.',
    }),
    dim('eu:worth_exploring', 'Worth exploring', '...?', {
      lens: 'eu.transfer', step: 'goal', reason: 'navigator judgment',
    }),
  ],
};
```
Register in `TEMPLATES` (304-312). `framework` must be an exact canon name (RESEARCH Pitfall 3: `Reverse Salient Analysis`, `Four Lenses of Innovation`, `Usher's Model of Cumulative Synthesis` resolve exactly). `doors` must not collide with an existing template's door (`templateForCommand` returns the first match, line 334). Same commit must update `tests/test-363-pyramid.cjs` Y1, `tests/test-363-structure.cjs` B3/B4/D6 and rerun `node scripts/build-research-shape-ledger.cjs` (commits d321d3f2d, 3ee0f6a31 are the precedent).

---

### `lib/core/research-planner/families.cjs` (config) - new lenses

**Analog:** `LENS_FAMILY` rows 197-200:
```js
// SEED-103: the Eureka perspective. ce.pair needs both terms (the two things);
// ce.counter is the falsifier round.
'eu.transfer': lens('concept-evidence/v1', ['ce.pair', 'ce.counter'], ['ce.counter']),
'eu.known': lens('concept-evidence/v1', ['ce.exact'], []),
```
RS lenses map to `causal-link/v1` (`cl.link`, `cl.break`; slots `cause`, `effect` per `FAMILY_SLOTS` line 63), so the RS leaf `slots` must be `{cause, effect}`, not `{term, term2}`. Do not add a new family unless a lens cannot be composed from the five frozen ones (157-163).

---

### `lib/core/research-planner/pyramid.cjs` (service, transform) - fix the dead eureka filing wire

**Analog:** the `literature_gap` branch of `opportunityCandidates` (lines 707-714):
```js
if (kinds.literature_gap && o.verdict === 'gap-confirmed') {
  allLeaves.filter(function (l) { return l.dimension === 'ws:gap_claim' && l.researchable; }).forEach(function (l) {
    out.push({
      kind: 'literature_gap', leaf_ids: [l.id], row_ids: rowIds(l.id, ['context']),
      reason: 'The gap claim held up against the search: nothing found that addresses the zone directly.',
    });
  });
}
```
Add `'cross_domain_transfer'` to `OPPORTUNITY_KINDS` (46-48; the final sort at 758 orders by this array) and a sibling branch keyed on `l.dimension === 'eu:mechanism_transfer'` with supporting rows, carrying `pair: l.pair`. In `normalizeLeaf` (357-380) add the closed copy next to the existing optional field:
```js
if (nonEmpty(l.limiter_id)) out.limiter_id = l.limiter_id;
// add: if (isObj(l.pair)) out.pair = { a, b, perspective, run_tag } (closed keys only)
```
and rename the recall leaf field `candidate` (eureka-recall.cjs:473) to that closed `pair` shape, included in the plan hash.

---

### `lib/core/research-planner/filing.cjs` (service, CRUD write) - one filer

**Analog A (in file):** the opportunity block, lines 712-776:
```js
const node = navigation.writeOpportunityNode(db, {
  name: name,
  sessionId: sid,
  lifecycle: 'candidate',
  lens: ORIGIN,
  section: section || undefined,
  extraProps: {
    run_id: run.run_id,
    candidate_kind: cand.kind,
    run_home: homeRel,
    leaf_ids: list(cand.leaf_ids).join(','),
    row_ids: list(cand.row_ids).join(','),
  },
  actor: ORIGIN,
  reason: oneLine(cand.reason || 'research candidate'),
  evidence_ids: evIds,
});
if (!node || node.ok !== true) { miss('opportunity ' + i.id, node && node.reason); return; }
...
edge(node.node_id, homeNode, 'DERIVED_FROM', { relation: 'derived_from', run_id: run.run_id });
evIds.forEach(function (ev) {
  const res = navigation.linkOpportunityEvidence(db, { opportunity_id: node.node_id, target_id: ev, edge_type: 'SUPPORTS' });
  ...
});
```
For `cand.kind === 'cross_domain_transfer'`: add `edge(node.node_id, cand.pair.a, 'DERIVED_FROM', ...)` and the same for `pair.b`, and merge the stamp props.

**Analog B (to relocate):** `scripts/eureka-portfolio-report.cjs` 1879-1939 `fileStampedOpportunity`, with `_sourcedFromTarget` 1808-1817 and `_readPwsStage` 1825-1844. The stamp merge to copy exactly:
```js
const extraProps = Object.assign({}, (params.extraProps && typeof params.extraProps === 'object') ? params.extraProps : {});
Object.assign(extraProps, verificationStamp.toNodeProps(stamp));
if (pwsStage) extraProps.pws_stage = pwsStage;
extraProps.engine_mode = runModeResolved;
```
Never-throw contract (returns node id or null; caller owns the transaction). Move the three functions into `filing.cjs` (or a sibling `filing-stamped.cjs`) and leave a re-export in the runner so `lib/core/ambient-run.cjs:573` keeps resolving until the runner is deleted.

House rules visible in the file: header 1-33 (Part 8 / Part 9 statements), `noDash` on every written card, no network.

---

### `lib/core/research-planner/ambient.cjs` (service, event-driven) - eureka offer

**Analog:** `maybeQuickInner` lines 287-348. The whitespace branch picks its producer from `compResult.producers.whitespace` (296-298), then for the no-grant case:
```js
const name = cover.reason === 'no_grant' ? 'plan_card_no_grant' : 'plan_card_reask';
const pending = hasPendingPlanOnly(roomDir);
if (pending) {
  // one unsurfaced plan-only card at a time: a room delta must not stack cards
  dropRunDir(roomDir, plan.run_id);
  return outcome(name, { reason: cover.reason, run_id: pending, deduped: true });
}
if (!recordPlanOnly(roomDir, planner, plan, cover, nowMs)) { ... }
return outcome(name, { reason: cover.reason, run_id: plan.run_id });
```
The eureka branch reads `compResult.producers.eureka`, builds the plan from `eurekaRecall.questionSetFor`, and ALWAYS ends at `recordPlanOnly` (never step 5's `runQuick`, lines 351-371, even with a standing grant: D-03). `hasPendingPlanOnly` (268-279) dedupes across all templates today; Open Question 5 decides precedence or a per-template filter. Add any new outcome name to `AMBIENT_OUTCOMES`.

---

### `lib/core/ambient-run.cjs` `_eurekaAdapter` (adapter, event-driven)

**Analog:** itself, lines 184-240. Keep the outer shape (try/catch returning `{ outcome: 'error', findings: [] }`, open via `navigation.openRoomDbReadOnlyForCaller`, close via `navigation.closeRoomDbForCaller` in `finally`, lines 186-195). Replace the body between the substrate read and `findings` (lines 191-237: `room-native-substrate`, `rs-differential-scorer`, `stampRankedPairs`, `eurekaEndpoints`) with `eurekaRecall.buildSubstrate(db)` + `recallCandidates(substrate, roomDir, { max_candidates: AMBIENT_TOP_N })`. Findings keep `{producer:'eureka', a:{handle,text}, b:{handle,text}, rank}` with NO `stamp` and a skip flag so `selectCardFinding` never files it. `EXEC_ORDER` (line 75) is unchanged.

---

### `lib/mcp/tools/research.cjs` (MCP controller, request-response, paginated)

**Analog:** itself. Ops enum (line 55), schema (590-603), dispatch (628-647), description (605).

**Op handler with refusal + hint** (`opEurekaRecall` 472-511):
```js
async function opEurekaRecall(env) {
  const i = env.input;
  const budgets = {};
  if (typeof i.max_candidates === 'number') budgets.max_candidates = i.max_candidates;
  let rec;
  try {
    rec = eurekaRecall.runRecall(env.dir, { budgets: budgets, tag: i.run_tag });
  } catch (_e) {
    return refuse('recall_failed', { hint: 'The room graph could not be read. ...' });
  }
  const out = { ok: true, op: 'eureka_recall', run_tag: rec.tag, counts: rec.counts, ... top: rec.candidates.slice(0, 10).map(...), plan: null, next_step: null };
  ...
  const built = planner.buildPlan(env.dir, rec.question_set, i.mode ? { mode: i.mode } : {});
  ...
}
```
**Pagination** (`opEurekaCandidates` 539-573):
```js
const limit = (typeof i.limit === 'number') ? i.limit : CANDIDATES_DEFAULT_LIMIT;
const offset = (typeof i.offset === 'number') ? i.offset : 0;
const total = read.candidates.length;
const items = read.candidates.slice(offset, offset + limit).map(function (c, k) { ... rank: offset + k + 1, ... });
return {
  ok: true, op: 'eureka_candidates', run_tag: i.run_tag,
  total: total, count: items.length, offset: offset,
  has_more: offset + items.length < total,
  next_offset: offset + items.length < total ? offset + items.length : null,
  header: read.header, judged: verdicts.length > 0, items: items, next_step: ...
};
```
**Generalization:** rename to `opPerspectiveRecall(env, perspectiveId)` etc., look the module up in `perspectives/index.cjs`, refuse `{reason:'perspective_required', hint}` when absent. Aliases per RESEARCH Code Examples:
```js
case 'eureka_recall': out = deprecate(await opPerspectiveRecall(env, 'eureka'), 'eureka_recall', 'perspective_recall'); break;
// deprecate(out, legacyOp, newOp) -> Object.assign(out, { op: legacyOp, deprecated: true, use_instead: newOp })
```
Schema line to add beside `run_tag` (600): `perspective: z.enum(PERSPECTIVE_IDS).optional()`. Description (605) must still contain the tokens `eureka_recall` and `eureka_candidates` (asserted at `tests/test-seed103-eureka-perspective.cjs:167`), stay under 2048 bytes (test-234), and keep total bytes inside test-270's 10% drift. `connectors` (676-686) stays one entry; regenerate with `node scripts/build-connector-registry.cjs`.

---

### `lib/mcp/tool-router.cjs` (router stubs and eureka-run legacy flag)

**Stub redirect analog** (lines 2032-2038):
```js
if (command === 'scout-hsi') {
  parts.push('\n> scout-hsi: reference only, no compute; run `/mos:scout hsi` in Claude Code.');
}
```
Same pattern for `find-bottlenecks` / `whitespace` / `scout-hsi`: a one-line pointer `research_run op perspective_recall with perspective "rs"`. Keep the names in the command arrays (354, 363, 408, 450, 479) so `ALL_TOOL_COMMANDS` stays 65 (`tests/test-205-surface-fence.cjs`).

**Legacy flag analog** (D-G, lines 1509-1518):
```js
let flags = {};
try { flags = context ? JSON.parse(context) : {}; } catch (_e) { flags = {}; }
if (!flags || typeof flags !== 'object') flags = {};
```
Gate the `EUREKA_COMPUTE_COMMANDS` branch (1499) on `flags.legacy === true`; otherwise answer with the pointer to `research_run perspective_recall`.

---

### `scripts/research-planner.cjs` (CLI door, request-response)

**Analog:** tables at 73-117, validators 135-147, handlers 227-244.
```js
'eureka-recall': { pos: [], flags: ['--room', '--max', '--tag', '--mode'], need: ['--room'] },
'eureka-judge': { pos: [], flags: ['--room', '--tag', '--judge'], need: ['--room', '--tag'] },
...
case 'judge': return v === 'none';
```
Add `'--perspective': 'perspective'` to `FLAGS`, `case 'perspective': return typeof v === 'string' && PERSPECTIVE_IDS.indexOf(v) !== -1;` to `valueOk`, and `'perspective-recall'` / `'perspective-judge'` rows with `need: ['--room', '--perspective']`. Note `parseArgv` (192-196) maps every missing required flag other than `--approved-via` to `room_required`; add a `perspective_required` branch. Handlers copy 227-244 with the module from the registry; the `eureka-*` cases call the same handler with `'eureka'`. Update the usage block in the header (20-44).

---

### `lib/core/verification-stamp.cjs` `resolveEndpoint` (resolver) + `lib/core/canon-translations.cjs` (NEW parser)

**Analog:** `resolveEndpoint` 291-315:
```js
function resolveEndpoint(carried, ctx) {
  const names = (ctx && ctx.names) || loadFrameworkNames();
  const registry = (ctx && ctx.registry) || loadCommandFrameworks();
  if (carried && typeof carried.framework === 'string' && carried.framework.length > 0) {
    if (names.has(carried.framework)) return { name: carried.framework, via: 'framework' };
  }
  if (carried && typeof carried.methodology === 'string' && carried.methodology.length > 0) {
    const raw = carried.methodology;
    const slug = raw.indexOf('/mos:') === 0 ? raw : '/mos:' + raw.replace(/^\/+/, '');
    const frameworks = registry.get(slug);
    if (Array.isArray(frameworks) && frameworks.length > 0 && names.has(frameworks[0])) {
      return { name: frameworks[0], via: 'methodology' };
    }
  }
  if (carried && typeof carried.title === 'string' && carried.title.length > 0) {
    if (names.has(carried.title)) return { name: carried.title, via: 'title' };
  }
  return { name: null, via: null };
}
```
Add a fourth check before the miss: `ctx.translations` (Map term -> canon_name, ratified rows only), returning `via: 'translation'` and guarded by `names.has(canon_name)`. Parser analog: `extractCarried` 268-283 (`^---\r?\n([\s\S]*?)\r?\n---` frontmatter regex, `_stripQuotes`), fresh read per call with no module cache (the `loadFrameworkNames` comment at 228-231). Path containment for `<room>/references/canon-translations.md` per the Security Domain table (`resolveAndContain`).

**Replace the second resolver** in `eureka-recall.cjs` 183-192 (`canonHandleOf`) with `verificationStamp.resolveEndpoint({framework: p.framework, methodology: p.methodology, title}, ctx)` built once per substrate; update the seed103 test expectations in the same plan (Pitfall 5).

---

### Framework node then `USES_FRAMEWORK` edge (writer; used by `views.cjs`, the indexer, the backfill)

**Analog 1:** `lib/core/navigation/reasoning-write.cjs` 74-79 and 193-208:
```js
function FRAMEWORK_NODE_ID(name) {
  if (typeof name !== 'string' || name.length === 0) return null;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  if (slug.length === 0) return null;
  return 'framework:' + slug;
}
...
const result = edges.writeEdge(db, {
  source_id: nodeId,
  target_id: frameworkHandle,
  edge_type: 'USES_FRAMEWORK',
  properties: { relation: 'uses_framework', framework: frameworkHandle.slice('framework:'.length), origin: (typeof origin === 'string' ? origin : '') },
});
```
**Analog 2 (mint-then-edge, bookkeeping never blocks):** `lib/mcp/tools/views.cjs` 299-320:
```js
if (reasoningNode && reasoningNode.ok === true && gateResult.section_job) {
  try {
    const mintResult = navigation.mintJtbdAnchor(db, gateResult.section_job);
    if (mintResult && mintResult.ok === true) {
      anchorEdge = navigation.writeEdge(db, { source_id: nodeId, target_id: navigation.JTBD_ANCHOR_ID(gateResult.section_job), edge_type: 'SOURCED_FROM', properties: { relation: 'sourced_from', origin: 'artifact_file' } });
    } else {
      anchorEdge = { ok: false, reason: 'anchor_mint_failed' };
    }
  } catch (e) {
    anchorEdge = { ok: false, reason: 'anchor_edge_threw', detail: String((e && e.message) || e).slice(0, 80) };
  }
}
```
Write a `mintFrameworkNode(db, canonName)` next to `mintJtbdAnchor` with `insertNode(db, fid, 'framework', JSON.stringify({ name: canonName }), { epistemic_type: 'observation', source_path: 'system:canon-framework', on_conflict: 'nothing' })` (insertNode signature `node-insert.cjs:202`, `epistemic_type` required and validated first, 207-212). Node before edge, always (Pitfall 7). In `views.cjs` the call goes right after the jtbd anchor block (the `framework: null` comment at 283-286 explains why no framework is guessed today; the new path resolves it from frontmatter by the exact rule, so update that comment). `USES_FRAMEWORK` is already allowlisted (`edges.cjs:900`).

---

### `lib/core/navigation/graph-integrity-counts.cjs` (statement, read-only SQL)

**Analog:** itself. Fixed-literal SQL constant shape (198-200):
```js
const SQL_EDGE_ROWS_MISSING_ENDPOINT = 'SELECT count(*) AS c FROM edges e '
  + 'WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.source) '
  + 'OR NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.target)';
```
Null-on-unanswerable pattern (319-339): declare `let x = null;` and only fill inside a schema guard. For canon coverage the guard is `variant !== 'unreadable'` (the `type` column exists on every live variant per the comment at 202-206). Add two constants, e.g. things `WHERE n.type IN ('Artifact','claim') AND EXISTS (SELECT 1 FROM edges e JOIN nodes f ON f.id = e.target WHERE e.source = n.id AND e.type = 'USES_FRAMEWORK' AND f.type = 'framework')` and the NOT EXISTS twin, then add the two keys to the returned bag (341-354). Field names must avoid the banned adjectives (52-62): `things_with_canon_handle`, `things_without_canon_handle`. Rule 2: no fix here. Pitfall 11: Phase 367 also edits this file; add the statement as a disjoint block.

### `lib/core/doctor/room-graph-integrity-module.cjs`

**Analog:** itself. Add the two fields to `INTEGER_FIELDS` (131-141, "deliberately a fixed literal list") and one clause to `buildDetail` (291-302) in the same counts-only prose ("N thing(s) with a canon handle, M without"). Stays `fix_supported:false` and check-only.

### `lib/core/sensors/sensor-priority.cjs` SENS-19

**Analog:** itself 214-219:
```js
Object.freeze({
  id: 'SENS-19',
  optimizes: 'the count of room-graph-integrity contradiction offers surfaced to the navigator',
  watched_by: 'the count of surfaced integrity offers the navigator declines, plus the count of surfaced defects still present a week later',
  why: '...',
}),
```
Amend `watched_by` to also name the canon coverage count; do not add it to SENS-19's firing sum (`sensor-graph-integrity.cjs:76,101-103`). Run `node scripts/build-connector-registry.cjs --check`.

---

### `lib/core/doctor/canon-backfill-module.cjs` (NEW doctor module, fleet batch + fix) and `data/doctor-modules.json`

**Analog:** `lib/core/doctor/graph-derive-health-module.cjs` (715 lines; read `check` 461-583 and `fix` 584-706). Do NOT use `graph-derive-heal-retrofit-module.cjs` (it is `cadence:'once'`, `fix_supported:false`, heals inside `check`).

**Registry walk with per-room soft fail** (461-512):
```js
function check(ctx) {
  const c = ctx || {};
  const allRooms = !!(c.flags && c.flags.cascadeRooms);
  const reg = readRegistry();
  if (!reg) {
    return { status: 'skip', detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME)', scope: allRooms ? 'all' : 'active', rooms: [] };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};
  ...
  for (const name of names) {
    try {
      // Inside the try on purpose (T-233-01): a malformed registry entry must
      // soft-fail this room, not throw out of the sweep.
      const roomPath = resolveRoomPath(roomsHome, rooms[name]);
      if (!roomPath) continue;
      ...
    } catch (e) {
      out.push({ room: name, roomPath: null, unreadable: true, status: 'skip', ... });
    }
  }
```
**fix(ctx) reading `ctx.check_result.rooms`, honoring `ctx.dryRun`, returning per-room recoveries** (584-706):
```js
function fix(ctx) {
  const c = ctx || {};
  const dryRun = !!c.dryRun;
  const checkResult = c.check_result || {};
  const rooms = Array.isArray(checkResult.rooms) ? checkResult.rooms : [];
  const recoveries = []; const errors = [];
  ...
  return {
    status: errors.length > 0 ? 'warn' : 'ok',
    healed, projected, recoveries, errors,
    detail: '... ' + projected + ' room(s) ' + (dryRun ? 'would be ...' : '...') + '; ' + errors.length + ' error(s)' + (dryRun ? ' (dry-run)' : ''),
  };
}
module.exports = { check, fix, resolveRoomPath, ... };
```
Imports: `const { readRegistry } = require('./shared.cjs');` and `resolveRoomPath` (130-141, `abs_path` before `path`). Writes open the room through the navigation chokepoint (not the read-only door) and wrap node+edge in one transaction per thing. Idempotence is native (`on_conflict:'nothing'`, `writeEdge` upsert); `fix` run twice must report the same counts.

**Registry row** (copy `graph-derive-health`, `data/doctor-modules.json` 188-195):
```json
{
  "id": "canon-backfill",
  "introduced_version": "<node lib/core/repo-version.cjs>",
  "cadence": "always",
  "flag": null,
  "fix_supported": true,
  "runner": "lib/core/doctor/canon-backfill-module.cjs",
  "description": "..."
}
```
Contract parity: `fix_supported` explicit boolean (rule 5), runner exports `check` (rule 7) and `fix` because `fix_supported:true` (rule 8) - `tests/test-doctor-module-contract-parity.cjs` 72-107.

---

### `lib/core/part8-egress-guard.cjs` (guard) - navigator-consent allow (D-13)

**Analog:** the framework-handle arms of `_proveKnownToolShape` (511-524):
```js
if (toolName.indexOf('framework_techniques') !== -1) {
  if (!_hasExactKeys(payload, ['framework'], [])) return null;
  if (!_isKnownFrameworkHandle(payload.framework)) return null;
  return { class: 'known_tool_shape', reason: 'framework_techniques canonical framework handle' };
}
```
and the ordering contract in `classify` (777-840): the CONTENT-SET scan runs FIRST on every call (785-789) and no branch may precede it; new allow arms only narrow `ambiguous`, never widen what may carry content. Pattern: an arm for `normalize_framework_name` that requires `_hasExactKeys(payload, ['raw'], [])` plus a release receipt passed in `opts` (gate id + audit row id), not in the payload, and returns `{ verdict: 'allow', class: 'navigator_released', reason: 'navigator_released' }`. The JTBD intent handle and section slug ride as separate short labels validated with `_isSafeShortLabel` (373). Export any new helper in the export block (845-865) so the adversarial suite can spy it.

### `lib/core/research-planner/canon-release.cjs` (NEW service: gated per-term Theo release)

**Gate analog:** `research.cjs mintApprovalGate` 140-200 (render through `gateRender.renderGate`, `gateLedger.mintGate(gateId, { card, sessionId, kind: 'material_step', resumeFn })`, inline elicitation answer consumed once). The resumeFn performs the Theo call (`brain-client.cjs:2062 normalizeFrameworkName(raw)`, injectable `callTool` seam for tests) and writes the proposed translation row.

**Audit analog:** `audit-ledger.cjs` 21-26 (closed `AUDIT_KEYS`), `validateRecord` 51-73, `appendAudit` 79-94. The record must carry all 23 keys and nothing else; note `part8_verdict` accepts only `'pass' | 'tripped'` (line 27) and `outcome` only `ok | empty_valid | failed | blocked | cache_hit` (line 28), so `navigator_released` lives in the guard verdict, not in a new audit key. Use `provider: 'theo'`, `family: 'canon-term/v1'`, `template_id: 'canon-translation'`, `q: <released term>`, `grant_id` = the release gate decision id.

**JTBD intent:** `lib/hmi/jtbd-state.cjs getCurrent(roomDir)` (107-110) returns the current object; carry only its generic handle field, never prose.

---

### `scripts/check-floor-ledger.cjs` + `data/floor-ledger.json`

**Analog:** `SCAN_FAMILIES` 48-56:
```js
const SCAN_FAMILIES = Object.freeze([
  'lib/core/rs-*.cjs',
  'lib/core/hsi-*.cjs',
  'lib/core/eureka/*.cjs',
  'lib/core/eureka-critic.cjs',
  'scripts/*whitespace*.cjs',
  'scripts/hsi-*.cjs',
  'scripts/compute-whitespace-gaps.py',
]);
```
Add `'lib/core/research-planner/perspectives/*.cjs'` and ledger rows (status `disclosed`) for every floor, including wave 1's `lexical_floor`, `lexical_top_k`, `max_candidates`.

---

### Snapshot lockstep: `scripts/refresh-framework-names.cjs`, `scripts/release.sh`, new gate lib

**Snapshot writer analog:** `buildSnapshot` 80-140 returns `{snapshot_note, snapshot_date, source, source_sha256, framework_names, curated_extras_note, curated_extras, stale_review}`; add the Theo stamp field here (written only on `--live`) and teach `validateSnapshot` (146+) about it so `runCheck` (396-428) stays offline.

**Release gate analog (offline):** `release.sh` 406-419:
```bash
if [ "$NO_LEDGER_CHECK" = "1" ]; then
  echo "  note: section-command-ledger staleness check skipped (--no-ledger-check): a deliberately stale ledger ships this release."
elif ! node "$PLUGIN_DIR/scripts/build-section-command-ledger.cjs" --check; then
  echo -e "${RED}ABORT: section-command-ledger staleness check failed -- the shipped ledger is stale or malformed.${NC}"
  echo "  Recovery: ..."
  exit 1
fi
```
plus the flag plumbing (`NO_LEDGER_CHECK=0` line 149, usage block 150, `--no-ledger-check)` case 168). If the check needs a live Theo read, copy `release-lib/theo-stamp-gate.sh` instead: `mos_theo_stamp_gate plugin_dir dry_run no_check` (112-175), the `MINDRIAN_THEO_STAMP_CMD` reader seam with an 8s `timeout` that fails closed (84-108), READ FAILURE distinct from MISMATCH, `DRY_RUN=1` reports without aborting, audited opt-out line naming the flag. Sourced at `release.sh` 117-121, invoked at 196.

**Docs:** RULE 5 of `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` and `.claude/includes/release-process.md` (pinned by `tests/test-349-docs-lockstep.cjs`); not `VERSION-BUMP-CHECKLIST.md` (WD-14).

---

### `commands/eureka.md` (door)

**Analog:** itself. Frontmatter 1-20 (`argument-hint: "[run|status|report|html|enable]"` gains `--legacy`), "Subcommand: run (default)" 100-125 calls `scripts/eureka-command.cjs ROOM_DIR start`; the new default calls `node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" perspective-recall --room ROOM_DIR --perspective eureka` and the legacy subcommands move under `--legacy` with one deprecation line. Remove the "ZERO writes / ZERO network" wording. Never edit `skills/eureka/SKILL.md`; run `node scripts/build-skill-mirrors.cjs`.

---

### Spike harness `scripts/spike-366-*.cjs` and `tests/fixtures/366-spike/`

**Analog:** `scripts/measure-355-hit-rate.cjs` (1663 lines; targeted reads). Require, never re-derive:
```js
const { wilson95, guardRoomPath, buildExcerpt, pairId, directionPhraseFor } = require('./measure-355-hit-rate.cjs');
// wilson95(k, n) -> [lo, hi], z = 1.959963985 (lines 100-114)
// pairId(room, pathA, pathB): first 12 hex of sha256(room NUL sorted paths) (152-156)
// directionPhraseFor(null) -> NONE_MEANING 'no wording signal measured' (162-167)
```
`guardRoomPath` (71-93) is bound to `tests/fixtures/355-rooms` via `FIXTURE_ROOT`; the spike runs on mkdtemp COPIES, so write a sibling guard with the same realpath + `path.sep` prefix logic bound to the temp root and to the fixture source (Pitfall 13: Jev arm only on fixture copies). CLI shape `cliMain` 1591-1620 (`--check`, `export`, `stamp`, `record` subcommands; `process.exitCode` not `process.exit`). Labeling reuses `scripts/label-355-gold.cjs` unchanged.

---

### `tests/test-366-*.cjs` (hermetic tests)

**Analog:** `tests/test-seed103-eureka-perspective.cjs` (198 lines).

**Isolation before any repo require** (lines 19-25):
```js
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-seed103-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-seed103-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
```
**Hygiene** (37-40): `hygiene.scrubVendorKey()`, `delete process.env.ANTHROPIC_API_KEY`, `const net = hygiene.installNetGuard()`, `const C = hygiene.makeChecker('<name>')`.

**Fixture room.db** (45-88): `roomDb.openRoomDb(roomDir)`, `insertNode(db, id, type, JSON.stringify(props), { source_path: 'test:...', epistemic_type: 'observation' })`, raw `INSERT INTO edges` only inside the test fixture, per-section `CONTEXT.md` with `## Inputs` for the ICM lane, planted known pair (existing edge) and planted opportunity (evidence pair) to prove exclusion, `roomDb.closeRoomDb(db)`.

**MCP through the real registration seam** (153-164):
```js
const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib/mcp/register-core-tools.cjs'));
const captured = new Map();
const stub = {
  tool: function (name, _d, _s, fn) { captured.set(name, fn); },
  registerTool: function (name, cfg, fn) { captured.set(name, fn); captured.set(name + ':cfg', cfg); },
};
registerCoreTools(stub, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
const call = async function (input) {
  const raw = await captured.get('research_run')(input, { sessionId: 'sess-seed103' });
  return JSON.parse(raw.content[0].text);
};
```
**Zero-network assertion last, then exit with the checker** (188-197):
```js
const attemptCount = (net && typeof net.attempts === 'function') ? net.attempts() : ((net && Array.isArray(net.attempts)) ? net.attempts.length : 0);
C.check('zero network attempts', attemptCount === 0, String(attemptCount));
net.restore();
try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
process.exit(C.summary());
```
Exit 77 for an env gap (Node < 22.16 / no `node:sqlite`). Shell-gate tests (`test-366-snapshot-gate.cjs`) copy `tests/test-343-theo-stamp-gate.cjs` `runGate` (lines 47-56: source the lib in `bash -c`, drive the seam env var, `spawnSync` with timeout) and its five arms (pass, mismatch, read failure, dry-run, opt-out).

---

### `tests/run-all-366.sh` (aggregator)

**Analog:** `tests/run-all-seed103.sh` (whole file, 64 lines):
```bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PASS=0; FAIL=0; SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then run "$label" "$@"
  else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""; fi
}
...
run "no em-dash in seed103 files" bash -c '! grep -rlP "\xE2\x80\x94" lib/core/claude-routing.cjs lib/core/research-planner/perspectives scripts/eureka-jev-judge.cjs tests/test-seed103-*.cjs'
echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP"
[ "$FAIL" -eq 0 ]
```
Written once in Wave 0: every seed103 leg (lines 36-58) carried verbatim (EPV366-01), then one `run_if` per planned `tests/test-366-*.cjs` in wave order (the `run-all-363.sh` 86-89 idiom), the generator `--check` legs, and the em-dash leg widened to the phase's files.

## Shared Patterns

### Read-only room access and the write chokepoint
**Source:** `eureka-recall.cjs` 513-520 (read), `reasoning-write.cjs` 193-208 + `node-insert.cjs:202` (write)
**Apply to:** every recall module, the backfill, `views.cjs`, `filing.cjs`
Reads through `navigation.openRoomDbReadOnlyForCaller` closed in `finally`; nodes through `insertNode` with `epistemic_type`; edges through `navigation.writeEdge`. No raw graph SQL outside tests (`scripts/check-substrate.cjs --diff` refuses it at commit).

### MCP refusal shape
**Source:** `research.cjs` 75-83 (`textResponse`, `refuse`)
**Apply to:** all `perspective_*` ops
```js
function refuse(reason, extra) { return Object.assign({ ok: false, reason: reason }, extra || {}); }
// payload.ok === false sets result.isError = true
```
Every refusal on a perspective op carries a `hint` naming the next op (asserted by the seed103 test at 181-183).

### No free text on argv
**Source:** `scripts/research-planner.cjs` 11-18 (header), 160-198 (`parseArgv`)
**Apply to:** every CLI subcommand added, the spike scripts if they take room input. Tokens never echoed; refusal is `free_text_argv_refused` with exit 2.

### Counts only, null never zero
**Source:** `graph-integrity-counts.cjs` 17-62 (nine rules + banned adjectives)
**Apply to:** the canon coverage statement, backfill per-room counts, recall `counts` objects, spike record. No thresholds, no adjectives.

### Approval through the one gate path
**Source:** `research.cjs mintApprovalGate` 140-200
**Apply to:** the gated per-term release, any new F.8 card. A bare flag is never authority; gate ids are single-use and session-scoped (`_approvedBaskets` 66, `opFile` 459-470).

### Generated files
**Apply to:** every plan touching `commands/*.md`, `lib/mcp/tools/*.cjs`, templates. Regenerate with `node scripts/build-connector-registry.cjs`, `node scripts/build-skill-mirrors.cjs`, `node scripts/build-research-shape-ledger.cjs`, `node scripts/build-orchestration-projection.cjs`; never hand-edit the outputs.

### Model ids
**Source:** `lib/core/claude-routing.cjs` (`resolveModelId(role)`, role `pair_judge`)
**Apply to:** any Claude API arm in the spike. No literal `claude-*` id (tripwire test).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `data/egress-policy.json` + its reader (discretion, EPV366-22) | config | file-I/O | No `_config/` or per-egress policy file exists in the repo. Nearest loader shape is `verification-stamp.loadFrameworkNames` (232-240, fresh read, no cache). Planner uses RESEARCH Pattern 12 and marks the path for navigator confirmation. |
| Graph RS lag math inside `rs-recall.cjs` (EPV366-05) | algorithm | transform | The module shape has an exact analog (eureka-recall), but no section-level lagging-component computation exists; `rs-engine.cjs` / `rs-math.cjs` are embedding-based and stay as the comparison arm. Use RESEARCH Pattern 4 (proposal, MEDIUM). |

## Discrepancies Found While Mapping (for the planner)

1. Direction sign: RESEARCH Pattern 5 states the legacy convention as `signed_diff = lsa - semantic`; the code is `semantic - lsa` (`direction-convention.cjs` header lines 24-30, `classify` 112-118). The graph variant should be expressed as `classify(lexical, relational)` so `relational - lexical > 0` reads `structural_transfer`, which is what Pattern 5 intends.
2. Audit ledger enums: `part8_verdict` is `pass | tripped` only (`audit-ledger.cjs:27`). A navigator-released Theo row records `part8_verdict: 'pass'`; the `navigator_released` reason lives in the guard verdict, not in a new key (the key set is closed).
3. `parseArgv` maps every missing required flag except `--approved-via` to `room_required` (`research-planner.cjs:192-196`); a required `--perspective` needs its own reason.
4. `stageAGate` (eureka-judge.cjs:52-54) only credits the `icm_declared` and `lexical` lanes and shared entities; RS/HSI lanes need a ruling or every graph-RS candidate fails Stage A.
5. The description token check: `tests/test-seed103-eureka-perspective.cjs:167` requires `eureka_recall` and `eureka_candidates` in the `research_run` description.

## Metadata

**Analog search scope:** `lib/core/research-planner/`, `lib/core/navigation/`, `lib/core/doctor/`, `lib/core/sensors/`, `lib/core/` (verification-stamp, part8-egress-guard, ambient-run, direction-convention), `lib/mcp/tools/`, `lib/mcp/tool-router.cjs`, `lib/hmi/jtbd-state.cjs`, `scripts/` (research-planner, eureka-portfolio-report, measure-355-hit-rate, refresh-framework-names, check-floor-ledger, release.sh, release-lib/), `tests/` (seed103, run-all-seed103/363, test-343-theo-stamp-gate, contract parity), `data/doctor-modules.json`, `commands/eureka.md`
**Files scanned:** 31
**Pattern extraction date:** 2026-10-01

## PATTERN MAPPING COMPLETE
