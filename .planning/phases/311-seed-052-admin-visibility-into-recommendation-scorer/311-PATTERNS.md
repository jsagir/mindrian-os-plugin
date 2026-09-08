# Phase 311: SEED-052 (admin-visibility scorer wiring) - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 4 (1 generator extension, 1 generated-output diff, 1 ranker extension, 1+ caller-site extensions)
**Analogs found:** 4 / 4 (all analogs are the SAME files being modified - this phase extends existing, working patterns in place rather than importing a pattern from elsewhere in the tree)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `scripts/build-command-registry.cjs` | config/generator (batch) | transform (frontmatter -> JSON) | itself - the `teaching`/`executable` field-mirror blocks already in the same function | exact (in-file precedent) |
| `data/command-registry.json` | config (generated artifact) | batch | itself - regenerated output, no hand-edit | exact |
| `lib/workflow/f-selector-ranker.cjs` | service (pure scorer) | transform (candidates in -> ranked list out) | itself - the `opts._applyDecayWeight` D7 injection pattern (lines 362-374, used at line 924-925 and 987-988) | exact (named in CONTEXT.md as the mirror target) |
| caller site(s) that invoke `rankForSelector(...)` | controller/orchestrator (glue) | request-response | `lib/core/navigation-engine-offer.cjs` `resolveOffer()` (lines 111-120) - the cleanest, most local single call site | role-match, and the one CONTEXT.md implies should own the `isAdmin()` compute-once-and-pass step |

Other production call sites of `rankForSelector` found (for completeness, all candidates for the same `opts.isAdmin` wiring depending on which surfaces need the fix): `lib/hmi/dial-reach-orchestrator.cjs:179`, `lib/core/unknowns/orchestrator.cjs:345`, `scripts/suggest-next-command.cjs:334`. Test-only call sites (`lib/memory/f-selector-ranker.test.cjs`, `lib/memory/selector-decisions.test.cjs`, etc.) are excluded from this list; do not treat them as production callers needing the wiring, only as places to add coverage.

## Pattern Assignments

### `scripts/build-command-registry.cjs` (generator, transform)

**Analog:** itself, the existing `teaching` field-mirror block

**Core mirror pattern to copy** (`scripts/build-command-registry.cjs` lines 333-340):
```javascript
// Phase 104.1: extract `teaching` (Larry-voice 1-2 sentence explanation of
// when to invoke this command). Reads `frontmatter.teaching` (locally
// bound as `fm.teaching` per the existing buildRegistry pattern). Null
// when absent; Plan 02 fills content.
const teaching =
  typeof fm.teaching === 'string' && fm.teaching.trim() !== ''
    ? fm.teaching.trim()
    : null;
```

**Where it gets pushed into the per-command object** (lines 365-379):
```javascript
commands.push({
  command,
  kind,
  surface,
  frameworks,
  produces,
  executable,
  inputs,
  autonomous_safe: autonomousSafe,
  body_shape: bodyShape,
  serves_jtbd: servesJtbd,
  teaching,
  jtbd_label: jtbdLabel,
  jtbd_summary: jtbdSummary,
});
```

**What to add:** a `visibility` extraction mirroring the `teaching` block exactly (string-or-null, trimmed, no derivation/taxonomy lookup needed since `visibility: admin` is either present verbatim in frontmatter or absent), and one new key `visibility,` added to the `commands.push({...})` object literal, in the same position style as the other frontmatter-mirrored fields (near `kind`/`surface`, since it is a top-level scalar like `kind`, not a derived field like `jtbd_label`).

**`--check` drift tripwire:** no new code needed here - CONTEXT.md confirms the existing generate-then-diff `--check` mode (documented at the top of the file, lines 11-13) already re-derives every field including any newly added one, so the new `visibility` field round-trips through the same check automatically once it exists in the push object.

**Frontmatter reader already in scope:** `scripts/admin-command-gate.cjs` lines 82-95 shows the line-walk regex the codebase already uses to detect `visibility: admin` in a frontmatter block (`/^\s*visibility\s*:\s*["']?admin["']?\s*(#.*)?$/`), but per CONTEXT.md's explicit decision, do NOT reuse that regex/reader inside the ranker - only inside `build-command-registry.cjs`'s own hand-rolled frontmatter parser (`parseFrontmatter`, referenced at line 304), which already parses arbitrary `key: value` scalars generically. Confirm `fm.visibility` falls out of the existing generic parser before writing any new regex; it likely does since `kind`, `body_shape`, etc. are plain scalar frontmatter keys parsed the same generic way.

---

### `data/command-registry.json` (generated artifact, batch)

**Analog:** itself - do not hand-edit

**Pattern:** run `node scripts/build-command-registry.cjs` (no flags = regenerate) after the generator change lands, then run `node scripts/build-command-registry.cjs --check` to confirm zero drift. The diff should show exactly two commands (`admin`, `dogfood-flush`) gaining `"visibility": "admin"` (or similar null-safe value for the other 111 commands, matching the `teaching`/`jtbd_label` null-on-absence convention already used for every other optional field).

---

### `lib/workflow/f-selector-ranker.cjs` (pure scorer, transform)

**Analog:** itself - the D7 `opts._applyDecayWeight` injection pattern

**Header comment for the existing precedent** (lines 362-368):
```javascript
// ---------------------------------------------------------------------------
// D7 decay-weight integration. When opts._applyDecayWeight is provided
// (typically by the F-selector renderer that wires Plan 05 + Plan 06), apply
// it. When absent, default no-op (returns base score untouched). Plan 06
// ships the actual decay function; Plan 05 stays callable in its absence.
// ---------------------------------------------------------------------------
```

**Read-and-default-off pattern at the top of `rankForSelector`** (lines 924-925, inside the `args` destructure block that starts at line 905):
```javascript
const applyDecayWeight = (typeof o._applyDecayWeight === 'function')
  ? o._applyDecayWeight : null;
```

**What to mirror for `opts.isAdmin`:** add a parallel read right next to it, e.g. `const isAdmin = (o.isAdmin === true);` (boolean coercion, default `false` - falsy/absent means "treat as non-admin," which is the fail-closed direction CONTEXT.md requires: a caller that forgets to pass the flag gets the SAFE behavior of admin commands being filtered out, never accidentally surfaced).

**Where the filter belongs (the candidate-build loop, lines 964-1011):** the loop already has an early-continue fail-closed pattern for missing `jtbd_summary` (D6) and missing `teaching` (D11):
```javascript
for (const cmd of commands) {
  if (!cmd || typeof cmd.command !== 'string') continue;

  // D6 fail-closed: jtbd_summary required.
  const jtbd_summary = (typeof cmd.jtbd_summary === 'string' && cmd.jtbd_summary.length > 0)
    ? cmd.jtbd_summary : null;
  if (jtbd_summary === null) continue;

  // D11 fail-closed: teaching required.
  const teaching = (typeof cmd.teaching === 'string' && cmd.teaching.length > 0)
    ? cmd.teaching : null;
  if (teaching === null) continue;
  ...
```
Add a third early-continue in the exact same style directly after the existing two: `if (cmd.visibility === 'admin' && !isAdmin) continue;` - this is the FILTER (not deprioritize) CONTEXT.md locks: the candidate never reaches `scored.push(...)`, so it can never appear in the ranked output regardless of score.

**Purity boundary:** do NOT call `require('./check-admin-identity.cjs')` or read `process.env`/fs anywhere inside this file. The scorer only ever reads the already-resolved `opts.isAdmin` boolean, exactly as it only ever reads the already-resolved `opts._applyDecayWeight` function - it never summons either capability itself. This preserves the file's own stated "Pure synchronous function" contract (referenced in CONTEXT.md).

---

### Caller site(s) — where `isAdmin()` gets computed and passed in

**Primary analog:** `lib/core/navigation-engine-offer.cjs` `resolveOffer()`, lines 108-120:
```javascript
function resolveOffer(context) {
  try {
    const ctx = (context && typeof context === 'object') ? context : {};

    // ----- 1. HARD SILENCE: operator gate (cheapest abstention) -----
    if (ctx.operator === 'JUST_TALK') return null;

    // ----- 2. RANK FIRST: compute the SINGLE margin before any gate reads it ---
    const ranker = require('../workflow/f-selector-ranker.cjs');
    const focusNodeId = resolveFocusNodeId(ctx);
    const items = ranker.rankForSelector({
      jtbd: (typeof ctx.jtbd === 'string') ? ctx.jtbd : null,
      problemType: (typeof ctx.problemType === 'string') ? ctx.problemType : null,
      focusNodeId: focusNodeId,
      roomState: (ctx.roomState && typeof ctx.roomState === 'object') ? ctx.roomState : {},
      packetOptional: (ctx.packet && typeof ctx.packet === 'object') ? ctx.packet : null,
      k: 3,
    });
```

**What to add here (and at every other production call site listed below):** require `check-admin-identity.cjs` alongside the existing lazy `require('../workflow/f-selector-ranker.cjs')` line, compute once, pass as a new key on the `rankForSelector({...})` args object:
```javascript
const { checkAdminIdentity } = require('../../scripts/check-admin-identity.cjs'); // path relative per call site
const isAdmin = checkAdminIdentity().admin === true;
const items = ranker.rankForSelector({
  ...
  isAdmin,
});
```
`checkAdminIdentity(opts)` (`scripts/check-admin-identity.cjs` line 126) returns `{ admin: true/false, reason: '...' }` (verified at lines 144-146) - read `.admin`, not a bare boolean return.

**Other production call sites needing the identical wiring** (grep-verified, all call `ranker.rankForSelector({...})` directly, none through a wrapper):
- `lib/hmi/dial-reach-orchestrator.cjs:179`
- `lib/core/unknowns/orchestrator.cjs:345`
- `scripts/suggest-next-command.cjs:334`

Each is a separate call site with its own `require`/args-object construction; CONTEXT.md's decision ("the ranker's CALLER computes `isAdmin()`") applies to every one of these, not just `navigation-engine-offer.cjs`. Confirm during planning whether all four need the change in this phase's smallest-slice scope, or whether the phase intentionally wires only the highest-traffic path first (LarryReacts / F.7 dial per the phase's own Domain section, which points at `navigation-engine-offer.cjs` and/or `dial-reach-orchestrator.cjs` as the two dial-facing surfaces).

---

## Shared Patterns

### Fail-closed early-continue in a scan loop
**Source:** `lib/workflow/f-selector-ranker.cjs` lines 970-980 (D6/D11 pattern)
**Apply to:** the new visibility filter inside the same loop - same style, same position (after the existing two guards, before any scoring work happens on that candidate).

### Optional-capability-injected-by-caller, pure-by-default
**Source:** `lib/workflow/f-selector-ranker.cjs` lines 362-374, 924-925 (`opts._applyDecayWeight`)
**Apply to:** `opts.isAdmin` - same "read off args, default to the safe/no-op value when absent" shape. The safe default for decay-weight is "no adjustment"; the safe default for isAdmin is "false" (filter out admin commands), which is the CORRECT default per CONTEXT.md's fail-closed intent (a caller that never wires this at all gets the secure behavior automatically, not the leaky one).

### Frontmatter-scalar-to-registry mirror
**Source:** `scripts/build-command-registry.cjs` lines 333-340 (`teaching`) and 365-379 (push object)
**Apply to:** `visibility` field extraction and inclusion in `data/command-registry.json`.

### `--check` drift tripwire, no new code
**Source:** `scripts/build-command-registry.cjs` file header (lines 11-13)
**Apply to:** confirms no additional test/script is needed for drift detection on the new field - existing generate-then-diff logic covers it once the field exists in the push object.

## No Analog Found

None. All four surfaces being touched already have a directly-applicable existing pattern in the same file (registry generator mirrors its own `teaching` field; ranker mirrors its own `_applyDecayWeight` injection; callers mirror the existing `resolveOffer` lazy-require-and-call shape). No RESEARCH.md pattern substitution is needed for this phase.

## Metadata

**Analog search scope:** `lib/workflow/f-selector-ranker.cjs`, `scripts/build-command-registry.cjs`, `scripts/check-admin-identity.cjs`, `scripts/admin-command-gate.cjs`, `lib/core/navigation-engine-offer.cjs`, `lib/hmi/dial-reach-orchestrator.cjs`, `lib/core/unknowns/orchestrator.cjs`, `scripts/suggest-next-command.cjs`, `commands/admin.md`, `commands/dogfood-flush.md`, `commands/help.md`
**Files scanned:** 10 (read/grepped directly), ~15 additional test-only call sites of `f-selector-ranker.cjs` identified via grep but not read (out of scope - production wiring only)
**Pattern extraction date:** 2026-09-08
