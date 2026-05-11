# Phase 122: Workflow Layer - Research

**Researched:** 2026-05-12
**Domain:** Plugin-side framework <-> command registry; deterministic command resolution; navigation-engine wiring; CI drift tripwire (CJS, node builtins, zero new deps)
**Confidence:** HIGH on local code state + Brain graph state; HIGH on the spec's five reliability rules; MEDIUM on the exact CI surface (the plugin has NO GitHub Actions; CI = pre-commit hook + Feynman test runner today); HIGH on the three personas mapped to the spec.

## Summary

Phase 122 builds the wiring that turns "the Brain says framework X is next" into "run `/mos:x`" reliably. The spec is locked and correct; this research surfaces the *implementation realities* the planner needs:

1. **There is no GitHub Actions CI in this repo.** "CI tripwire" = a `scripts/build-command-registry.cjs --check` invoked by (a) the existing `.git/hooks/pre-commit` bash guard and (b) a new test file in `lib/memory/run-feynman-tests.cjs` (the plugin's de-facto test suite, run pre-push). The "Brain-side Phase-6 CI-01 tripwire" the spec says to mirror **does not exist yet either** - brain-cleanup Phase 6 is not scaffolded (only Phases 1-5 done). Mirror its *design* (the spec is in `~/gsd-workspaces/brain-cleanup/.planning/REQUIREMENTS.md` CI-01 + `ROADMAP.md` Phase 6), not a file.

2. **The Brain's `FEEDS_INTO` graph is live and current** (163 edges, 7,882 chains, 748 `:Framework` nodes after brain-cleanup Phase 4+5, both DONE). But only **~105 frameworks are actually traversable** via `FEEDS_INTO`, and **the `:Framework` corpus is still noisy** - 748 names include junk like `"Charles Kirschbaum"`, `"Eugene Ely"`, `"Amazon"`, `"ABB"`, and quoted-string duplicates (`'Blue Ocean Strategy'` vs `"Design Thinking"` vs `2x2 Matrix`). The `framework-names` allowlist the registry CI validates against **must be the FEEDS_INTO-linked subset (or a curated whitelist), NOT all 748 names**. The clean names the spec's acceptance example uses ("Beautiful Question Framework", "Domain Selection", "Jobs to Be Done (JTBD)", "Six Thinking Hats", "PWS Value Proposition", "Cynefin Framework") all exist and are traversable. (Side note: the live Brain schema cache reports 84 labels / 32 rel types - NOT the <=30/<=28 the brain-cleanup acceptance claimed; the spec's acceptance criterion "27 labels / 28 rel types unchanged" should be softened to "no `Command` node, no new label, `IMPLEMENTED_AS`/`FEEDS_INTO` untouched, `BRAIN-SCHEMA.md` sha unchanged" - the strong label count is a brain-cleanup concern, not Phase 122's, and Phase 122 is zero-Brain-mutation anyway.)

3. **Three pre-existing things in the codebase ARE the cleanup targets**, and the plan must name them:
   - `lib/core/framework-chain-composer.cjs` has `mapFrameworkToCommandSlug()` + a frozen `FRAMEWORK_TO_COMMAND_SLUG` table + `KNOWN_FRAMEWORKS` bootstrap list (Phase 91-08). This **is** the hardcoded map the resolver replaces. The composer's *parse / propose* logic stays; its `mapFrameworkToCommandSlug` becomes a thin call into `command-resolver.cjs`.
   - `lib/hmi/jtbd-taxonomy.json` has `methodology_hooks: ["/mos:..."]` per JTBD - another hand-maintained command list (and it already has `/mos:value-proposition` while the command file is named `value-proposition.md` exposing `/mos:validate-proposition` - a live mismatch).
   - `references/methodology/index.md` is "the command routing index" loaded by `skills/pws-methodology/SKILL.md`. Its 26-row table is hand-maintained. After Phase 122 it should either be generated from the registry or deleted in favor of the registry.
   - `skills/brain-connector/SKILL.md` says "Brain has Command nodes linked to Frameworks... query `brain_proactive_command`... multi-hop: Room frameworks -> FOLLOWS_FRAMEWORK -> Command -> ..." - **this is a Canon Part 8 violation already in the skill text** (it asserts commands live in the Brain). Phase 122 Phase 5 must delete it. (The live Brain has no `Command` label - verified - so it's dead text, but it's the kind of text that breeds the breach.)

4. **The navigation engine "engine v1" the spec references is already built** (Phase 91): `lib/core/navigation-engine.cjs` `decide(turn, context) -> decision` with `fire_skill` / `suppress_skills` / `offer_next_step` in the decision struct; `lib/core/offer-presenter.cjs` renders `offer_next_step` into a one-line "Offer: Because <reason>, try <command>." string; `lib/core/skill-activation-router.cjs` composes engine output with legacy activation and emits `routing_source: 'engine' | 'mixed' | 'legacy'`. **The hook that runs this on every message is `scripts/intent-classifier.cjs`** (the `UserPromptSubmit` `intent-classifier` entry in `hooks/hooks.json`, dispatched via `hooks/run-hook.cmd intent-classifier`). The "workflow-suggestion step" plugs in **between `recommendFrameworkChain` and `offer-presenter`**: `framework-chain-composer.proposeNextFramework()` already produces an `offer_next_step` candidate with a `command` field built by `mapFrameworkToCommandSlug` - swap that internal call for `command-resolver.composeWorkflow()` and the engine surface is wired with zero new hook.

5. **Stack is exactly what CLAUDE.md mandates: node builtins, CJS, zero new deps, zero frameworks, `process.argv` switch-case.** No JSON-schema validator in the repo (`zod` is a v3.0 MCP-server dep, NOT used in `scripts/`/`lib/core/`); `gray-matter` is NOT installed - frontmatter is parsed by hand (`scripts/frontmatter-schema-validator.cjs` + `lib/core/frontmatter-schemas.cjs` do their own line-walk YAML-ish parse). Phase 122 follows that: hand-rolled frontmatter scan, hand-rolled registry shape validation, `data/command-registry.json` written with `JSON.stringify(..., 2)`.

**Primary recommendation:** Build `scripts/build-command-registry.cjs` (scan `commands/*.md` frontmatter -> `data/command-registry.json`, `--check` mode for the tripwire), validate `frameworks:` entries against the **FEEDS_INTO-linked framework subset cached at build time** (fetched once via `lib/core/brain-client.cjs`, written to `data/framework-names.json` so the build is offline-deterministic and the Brain is queried only at *build* time), and `lib/workflow/command-resolver.cjs` as the single read-only door over `data/command-registry.json`. Wire the resolver into the *already-built* navigation engine by replacing the `mapFrameworkToCommandSlug` call in `framework-chain-composer.cjs`. Retrofit the algorithmic cohort frontmatter first. Delete the Brain-`Command`-node prose from `brain-connector` SKILL.md.

## Standard Stack

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `path`, `child_process`) | Node >=18 | All file I/O, the registry generator, the resolver | CLAUDE.md "What NOT to Use": no Commander/yargs, no zod in scripts, no TypeScript, no build step. The GSD `gsd-tools.cjs` + plugin `mindrian-tools.cjs` pattern is `process.argv` switch-case CJS. |
| `lib/core/brain-client.cjs` | in-repo | The ONLY path to the Brain (`brain.query(cypher)`, `brain.isAvailable()`, `brain.schema()`) | Already the chokepoint; Canon Part 8 sanitization (`sanitizeCypherInput`) lives here; session cache (5-min TTL). The registry generator calls `brain.query()` at *build* time only. |
| `lib/core/navigation.cjs` | in-repo | The closed 13-function graph chokepoint (Phase 109) | If `recommendFrameworkChain` ever needs *room state* (which JTBD is active, which sections exist) it reads it via `navigation.cjs`, never via direct `room-db.cjs` (pre-commit hook blocks that). |
| existing in-repo modules to **reuse, not rebuild** | - | `framework-chain-composer.cjs` (parse/propose FEEDS_INTO), `offer-presenter.cjs` (render `offer_next_step`), `skill-activation-router.cjs` (`routing_source`), `navigation-engine.cjs` (`decide()`), `frontmatter-schemas.cjs` + `scripts/frontmatter-schema-validator.cjs` (the hand-rolled frontmatter-validation pattern to copy), `integration-registry.cjs` (precedent for an in-repo static catalog module) | Canon Part 7 (Reuse Before Build). | Phase 122 is ~90% wiring of things that exist. |

### NOT in the stack (verified absent / forbidden)
- **No `gray-matter` / `js-yaml`** - not in `package.json`. Frontmatter is parsed by a hand-rolled line-walk (see `scripts/frontmatter-schema-validator.cjs`). Match that.
- **No `ajv` / `zod` in scripts** - `zod` is declared for the v3.0 MCP server only (`@modelcontextprotocol/sdk` peer dep); CLAUDE.md explicitly forbids it in plugin scripts. Registry shape validation is hand-rolled assertions.
- **No GitHub Actions** (`.github/workflows/` does not exist). "CI" in this repo = `.git/hooks/pre-commit` (bash) + `lib/memory/run-feynman-tests.cjs` (the test suite, run before release). The "CI tripwire" is a new test file in that runner + an optional pre-commit guard line.
- **No `npm test` wired beyond `parity` / `mcp` / `migrate-minto-v88`** in `package.json` scripts - the test entry points are `lib/memory/run-feynman-tests.cjs`, `lib/import/run-all-tests.cjs`, etc., run by hand / by release scripts.

**Installation:** none. Zero new dependencies. (`npm view` not applicable - no packages added.)

## Architecture Patterns

### Recommended file layout (new files)
```
commands/*.md                       # +frontmatter: kind, frameworks[], produces, inputs[], autonomous_safe
data/command-registry.json          # GENERATED by scripts/build-command-registry.cjs - committed
data/framework-names.json           # GENERATED snapshot of FEEDS_INTO-linked Brain framework names - committed
docs/COMMAND-FRONTMATTER.md         # the frontmatter contract (next to docs/ui-system docs)
docs/WORKFLOWS.md                   # Brain<->registry<->Larry join + Canon Part 8 boundary
scripts/build-command-registry.cjs  # scan frontmatter -> registry; --check fails on stale/unresolvable
lib/workflow/command-resolver.cjs   # THE SOLE framework->command door; reads only data/command-registry.json
lib/workflow/ROOM.md                # ICM Layer 0 identity for the new dir (decision #15)
lib/brain/chain-recommender.cjs     # recommendFrameworkChain() via FEEDS_INTO traversal (Phase 3, hard-dep on brain-cleanup Phase 5)
lib/memory/command-registry.test.cjs        # registered in run-feynman-tests.cjs
lib/memory/command-resolver.test.cjs        # ditto
```

### Pattern 1: Generated artifact + CI drift tripwire (the load-bearing pattern)
**What:** Truth lives in `commands/*.md` frontmatter (`frameworks: [...]`). `data/command-registry.json` is *derived*. A `--check` run regenerates in memory and `process.exit(1)` if the on-disk JSON differs OR if any `frameworks:` entry is not in `data/framework-names.json`. This is the npm-`ci`/`--frozen-lockfile` pattern and the VS Code `contributes.commands` manifest pattern: a thing is registered in *one* declarative place; everything else is generated; CI fails on drift. The brain-cleanup CI-01 spec is the same shape (5 assertions, fails -> recovery command).
**When to use:** always - this is the whole point of Phase 122 Phase 2.
**Wire-in:** add a guard line to `.git/hooks/pre-commit` (after the ROOM.md/MINTO.md check) that, when any `commands/*.md` or `data/command-registry.json` is staged, runs `node scripts/build-command-registry.cjs --check` and rejects the commit on non-zero; AND register `lib/memory/command-registry.test.cjs` in `lib/memory/run-feynman-tests.cjs` so the pre-release suite catches it. The bash hook is the fast local gate; the test file is the durable gate.
**Example:**
```js
// scripts/build-command-registry.cjs (sketch) - CJS, node builtins only
'use strict';
const fs = require('node:fs'), path = require('node:path');
const COMMANDS_DIR = path.join(__dirname, '..', 'commands');
const REGISTRY = path.join(__dirname, '..', 'data', 'command-registry.json');
const FW_NAMES = path.join(__dirname, '..', 'data', 'framework-names.json');

function parseFrontmatter(md) {              // hand-rolled, mirrors frontmatter-schema-validator.cjs
  const m = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!m) return {};
  const out = {}; let key = null;
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) { key = kv[1]; const v = kv[2].trim();
      out[key] = v === '' ? [] : v.startsWith('[') ? JSON.parse(v) : v.replace(/^["']|["']$/g,'');
    } else if (key && /^\s*-\s+/.test(line)) {
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push(line.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g,''));
    }
  }
  return out;
}

function buildRegistry() {
  const fwNames = new Set(JSON.parse(fs.readFileSync(FW_NAMES, 'utf8')).framework_names);
  const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
  const commands = [], frameworkIndex = {}, unresolved = [];
  for (const f of files.sort()) {
    const fm = parseFrontmatter(fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8'));
    const name = fm.name || f.replace(/\.md$/, '');
    const kind = fm.kind || 'utility';                          // methodology | utility | meta
    const frameworks = Array.isArray(fm.frameworks) ? fm.frameworks : [];
    for (const fw of frameworks) {
      if (!fwNames.has(fw)) unresolved.push({ command: '/mos:' + name, framework: fw });
      (frameworkIndex[fw] = frameworkIndex[fw] || []).push('/mos:' + name);
    }
    commands.push({ command: '/mos:' + name, kind, frameworks,
      produces: fm.produces || null, inputs: Array.isArray(fm.inputs) ? fm.inputs : [],
      autonomous_safe: fm.autonomous_safe === true || fm.autonomous_safe === 'true',
      body_shape: fm.body_shape || null });                     // carry body_shape for consistent rendering
  }
  return { ontology_ref: 'data/framework-names.json', generated_at_note: 'GENERATED by scripts/build-command-registry.cjs - do not edit',
    commands, framework_index: frameworkIndex, curated_chains: [], _unresolved: unresolved };
}

function main() {
  const reg = buildRegistry();
  const errs = [];
  if (reg._unresolved.length) errs.push('Unresolvable frameworks: ' + JSON.stringify(reg._unresolved));
  const onDisk = fs.existsSync(REGISTRY) ? fs.readFileSync(REGISTRY, 'utf8') : '';
  delete reg._unresolved;
  const next = JSON.stringify(reg, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (onDisk !== next) errs.push('data/command-registry.json is STALE. Run: node scripts/build-command-registry.cjs');
    if (errs.length) { console.error(errs.join('\n') + '\nRecovery: fix frontmatter then regenerate.'); process.exit(1); }
    console.log('command-registry: OK'); return;
  }
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  fs.writeFileSync(REGISTRY, next);
  console.log('Wrote ' + REGISTRY + ' (' + reg.commands.length + ' commands)');
}
main();
```

### Pattern 2: The resolver is the only door (deterministic, read-only, never the model)
**What:** `lib/workflow/command-resolver.cjs` is the *sole* function any caller uses to go framework->command. It reads `data/command-registry.json` once (cached per process). It exposes exactly: `commandsForFramework(name)`, `frameworksForCommand(cmd)`, `composeWorkflow(frameworkChain) -> [{step, framework, command|null, optional}]`, `validateChainAutonomy(workflow) -> {runnable, blockers}`. **Larry never emits a `/mos:` command string he recalled** - every command in any orchestrator output (`/mos:suggest-next`, `/mos:pipeline`, `/mos:act`, the pws-methodology skill, the brain-connector skill, the navigation hook) came back from `composeWorkflow`. Null command for a framework with no `/mos:` -> the consumer prints "run [framework] manually - there's no `/mos:` for it." This is the VS-Code "you cannot invoke an unregistered command" pattern and the LLM-tool-grounding pattern (constrain the model to a *returned* allowlist, never let it name from memory).
**Example:**
```js
// lib/workflow/command-resolver.cjs (sketch)
'use strict';
const fs = require('node:fs'), path = require('node:path');
const REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'command-registry.json');
let _cache = null;
function _load() {
  if (_cache) return _cache;
  try { _cache = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
  catch (_e) { _cache = { commands: [], framework_index: {}, curated_chains: [] }; } // degrade: empty registry
  return _cache;
}
function commandsForFramework(name) { return (_load().framework_index || {})[name] || []; }
function frameworksForCommand(cmd) {
  const c = _load().commands.find(x => x.command === cmd); return c ? c.frameworks : [];
}
function composeWorkflow(frameworkChain) {
  return (Array.isArray(frameworkChain) ? frameworkChain : []).map((fw, i) => {
    const cmds = commandsForFramework(fw);
    return { step: i + 1, framework: fw, command: cmds[0] || null, optional: cmds.length === 0 };
  });
}
function validateChainAutonomy(workflow) {
  const reg = _load(); const byCmd = new Map(reg.commands.map(c => [c.command, c]));
  const blockers = [];
  for (const s of (workflow || [])) {
    if (!s.command) continue;
    const c = byCmd.get(s.command);
    if (!c || c.autonomous_safe !== true) blockers.push({ step: s.step, command: s.command, reason: 'not autonomous_safe' });
  }
  return { runnable: blockers.length === 0, blockers };
}
module.exports = { commandsForFramework, frameworksForCommand, composeWorkflow, validateChainAutonomy };
```

### Pattern 3: The trigger is the hook, not the model (plug into engine v1, do not re-implement intent detection)
**What:** the navigation engine (`navigation-engine.cjs decide()`, run per message by `scripts/intent-classifier.cjs` via the `intent-classifier` `UserPromptSubmit` hook) already produces `offer_next_step` and `framework-chain-composer.cjs` already turns a completed framework + FEEDS_INTO edges into an `offer_next_step` candidate with a `command` field. The Phase 122 change is **surgical**: replace the `mapFrameworkToCommandSlug()` call inside `framework-chain-composer.proposeNextFramework()` with `require('../workflow/command-resolver.cjs').commandsForFramework(top.to)[0]` (with the degrade-to-`null` -> "no command yet" path), and add a `composeWorkflow` path so a *multi-step* chain can surface as "run this chain? `/mos:a` -> `/mos:b` -> `/mos:c`". The presenter (`offer-presenter.cjs`) and the operator-awareness (the engine already gates `offer_next_step` by the conversation operator - JUST_TALK stays quiet) are untouched. No new hook, no new intent classifier.
**Operator-aware filtering:** `navigation-engine.cjs` already consumes the operator state; the workflow suggestion inherits "surface under METHODOLOGY / BUILD_ROOM / DECISION_GATE, quiet under JUST_TALK" for free. The plan must NOT add a second operator check in `command-resolver.cjs` (the resolver is pure; filtering is the engine's job).

### Anti-Patterns to Avoid
- **Putting a `Command` node in the Brain.** Forbidden by the spec, Canon Part 8, and the brain-cleanup project's whole reason for being. The registry is plugin-local, validated *against* Brain framework names, never written back. (The `brain-connector` SKILL.md text that says "Brain has Command nodes" is dead - delete it.)
- **A second hand-maintained framework->command map.** `framework-chain-composer.FRAMEWORK_TO_COMMAND_SLUG`, `jtbd-taxonomy.json:methodology_hooks`, `references/methodology/index.md` table - all of these are the drift class. Each must either go through the resolver or be generated from the registry. Do not add a third.
- **Validating `frameworks:` against all 748 `:Framework` names.** That set is noisy. Validate against the FEEDS_INTO-linked subset (~105) or a curated whitelist snapshot. A `frameworks: ["Amazon"]` should fail the tripwire.
- **Re-implementing intent classification in the workflow step.** The engine already classifies. Consume `decide()` output; do not parse the user message a second time.
- **Letting the model write the offer copy.** The `offer-presenter.cjs` format ("Offer[ (RECOMMENDED)]: Because <reason>, try <command>.") is the contract; the command in it came from `composeWorkflow`. Larry is the voice, not the source of truth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parse `commands/*.md` frontmatter | A new YAML parser, or add `gray-matter` | Copy the hand-rolled line-walk in `scripts/frontmatter-schema-validator.cjs` / `lib/core/frontmatter-schemas.cjs` | CLAUDE.md forbids new deps; the existing pattern handles the YAML-ish subset commands use. |
| Validate the registry JSON shape | Add `ajv`/`zod` | Hand-rolled assertions in `build-command-registry.cjs` (and `frontmatter-schemas.cjs`-style violation objects if you want structured output) | `zod` is forbidden in plugin scripts; the shape is small and fixed. |
| FEEDS_INTO graph traversal | A new Cypher client, a new graph lib | `lib/core/brain-client.cjs` `brain.query(cypher)` (build-time only) for the *names snapshot*; `lib/core/framework-chain-composer.cjs` already parses the FEEDS_INTO edges that Phase 90-01 wrote into `BRAIN.md` (runtime, offline) | Brain client is the Canon-Part-8-sanitized chokepoint. The composer already does the runtime traversal-over-BRAIN.md work. `recommendFrameworkChain` (Phase 3) extends `framework-chain-composer` / `brain-client`, it does not start fresh. |
| Render `offer_next_step` as a one-liner / F-selector | A new renderer | `lib/core/offer-presenter.cjs` (one-liner) + `lib/hmi/shape-f1-renderer.cjs` (F.1 accept/reject/defer) | Canon Part 3: every workflow render is a `body_shape`; no command invents its own format. The registry carries each command's `body_shape` so the orchestrator renders consistently. |
| A static in-repo catalog module | A bespoke loader | `lib/core/integration-registry.cjs` is the precedent (`INTEGRATION_CATALOG` const + `detect*` functions, zero deps) | Same shape: a frozen catalog + accessor functions. |
| A CI runner | GitHub Actions, a new test framework | `.git/hooks/pre-commit` (bash, exists) + `lib/memory/run-feynman-tests.cjs` (the de-facto suite) | This repo has no Actions; the pre-commit + Feynman-runner pair IS the CI surface. |

**Key insight:** Phase 122 is a *consolidation* phase (Canon Part 7). The hard part is not new code - it is finding the 3-4 existing hand-maintained command maps and routing them all through one resolver, then making drift uncommittable.

## Common Pitfalls

### Pitfall 1: The hallucinated-command failure mode (the thing this phase exists to kill)
**What goes wrong:** Larry says "run `/mos:jtbd`" when the real command is `/mos:analyze-needs`; or "`/mos:six-hats`" when it is `/mos:think-hats`; or "`/mos:mullins-7-domains`" when it is `/mos:mullins`. The model recalls a *plausible* name, not the *real* one. (Confirmed live mismatches below.)
**Why it happens:** the framework->command mapping is not 1:1 and not name-predictable, and the model has no grounded source - it's the classic LLM tool-selection hallucination (arxiv 2412.04141).
**How to avoid:** the resolver is the only door. Every `/mos:` string in any orchestrator output came back from `composeWorkflow`. If a framework has no command, the consumer says so - it never invents one. The pre-commit/test tripwire guarantees the registry matches reality.
**Warning signs:** any code path (skill text, agent prompt, command body) that writes a literal `/mos:xxx` for a *methodology* (not a self-reference). Grep for `/mos:` in `skills/`, `agents/`, and `references/methodology/index.md` - those literals are the candidates for "should this be a resolver lookup?".

### Pitfall 2: Registry drift (the JSON goes stale vs frontmatter)
**What goes wrong:** someone edits `commands/whitespace.md` `frameworks:` and forgets to regenerate; the registry now lies; the resolver returns the wrong command.
**Why it happens:** generated artifacts always drift unless CI forbids the drift (npm `ci` / `--frozen-lockfile` exists for exactly this).
**How to avoid:** `build-command-registry.cjs --check` in pre-commit + the Feynman test file. The check regenerates in memory and exits 1 if the on-disk JSON differs. Same as the brain-cleanup CI-01 tripwire shape.
**Warning signs:** the registry's `commands[].command` set != the `commands/*.md` `name:` set, or any `commands/*.md` mtime newer than `data/command-registry.json`.

### Pitfall 3: Brain-name mismatch (a `frameworks:` entry that is not a real Brain framework name)
**What goes wrong:** `frameworks: ["Jobs to be Done"]` (no JTBD) when the Brain name is `"Jobs to Be Done (JTBD)"` or `"Jobs-to-be-Done"` - the recommender returns `"Jobs to Be Done (JTBD)"` from a FEEDS_INTO traversal, `commandsForFramework("Jobs to Be Done (JTBD)")` finds nothing because the frontmatter said something slightly different, and the chain breaks silently.
**Why it happens:** the Brain corpus has near-duplicate names (`"JTBD"`, `"Jobs to Be Done (JTBD)"`, `"Jobs-to-be-Done"`, `"Jobs-to-be-Done for Business Models"` all exist as separate `:Framework` nodes), and frontmatter authors will guess.
**How to avoid:** (1) the tripwire validates every `frameworks:` entry against `data/framework-names.json` (the FEEDS_INTO-linked snapshot) - a non-matching string fails the build with the list of close matches; (2) when retrofitting, copy the exact string from the snapshot; (3) the recommender's vector-similarity fallback (Phase 3, needs brain-cleanup Phase 5's re-embed) maps a near-name to the canonical one - but that's a fallback, not the primary path.
**Warning signs:** `frameworks:` entries with no `FEEDS_INTO` edge in the Brain (they'll still validate if they're in the 748 but they'll never be *recommended*); near-duplicate strings across commands.

### Pitfall 4: A command string reaches the Brain (Canon Part 8 breach)
**What goes wrong:** a future "smart" version sends `{ framework: "X", current_command: "/mos:y" }` to a Brain query, or logs a Brain payload that includes a `/mos:` string, or - worst - the recommender's Cypher interpolates a command name.
**Why it happens:** "it's just a generic handle" rationalization. It isn't - commands are *plugin-local product surface*, not methodology; the brain-boundary-scan PR gate exists for this.
**How to avoid:** the resolver never touches `brain-client.cjs`. `recommendFrameworkChain` queries the Brain with **framework names and problem-type enums only** (the existing `brain-client.sanitizeCypherInput` whitelist plus a no-command-strings assertion in the test). The registry generator calls `brain.query()` only to *read* framework names (no command strings in the query). Add a test that greps the recommender + resolver source for `/mos:` adjacent to any `brain`/`query`/`fetch` token.
**Warning signs:** any `require('./brain-client.cjs')` in `lib/workflow/command-resolver.cjs`; any `/mos:` literal in a string that is later JSON.stringify'd into a network body.

### Pitfall 5: Over-prompting - the Peddler line (the navigation hook becomes nagging)
**What goes wrong:** the workflow-suggestion step fires `offer_next_step` too often, or under JUST_TALK, or after the user already ignored it twice; it stops being "here's the next move" and becomes "Larry won't shut up about `/mos:`".
**Why it happens:** the engine *can* always find a next framework; the discipline is *not* surfacing it every turn.
**How to avoid:** lean entirely on the machinery that already exists - the engine gates `offer_next_step` by operator (quiet under JUST_TALK), the presenter has a consecutive-ignore window (suppress after 2 ignores) and a one-per-turn flag. Phase 122 must NOT loosen any of those; if anything it should respect them harder (a *chain* offer is heavier than a single-step offer, so the noise budget is the same or tighter). The F.1 render (accept / reject / defer) is the friction-reducer on the Ability axis, not a license to fire more.
**Warning signs:** `offer-presenter` outputs increasing per session; user "stop suggesting commands" feedback; any new code path that emits a command suggestion outside the engine's `offer_next_step` pipeline.

### Pitfall 6: The "CI-01 to mirror" does not exist yet
**What goes wrong:** the plan says "mirror `scripts/brain-ci-01.cjs`" - there is no such file. brain-cleanup Phase 6 is unscaffolded.
**How to avoid:** mirror the *design* (5 assertions, `--check` mode, exit code + summary, fails -> recovery command) from `~/gsd-workspaces/brain-cleanup/.planning/ROADMAP.md` Phase 6 + `REQUIREMENTS.md` CI-01. The plugin's version is `build-command-registry.cjs --check` with two assertions (stale registry; unresolvable framework) plus the Canon-Part-8 grep test. Don't block on the brain-side file.

## Code Examples

### The frontmatter contract (what each `commands/*.md` declares - Phase 1)
```yaml
---
name: analyze-needs
description: Score customer jobs with importance and satisfaction
# --- existing fields stay: serves_jtbd, allowed-tools, body_shape, argument-hint, ui_reference ---
serves_jtbd: ["find-problem"]
# --- NEW Phase 122 fields ---
kind: methodology                              # methodology | utility | meta
frameworks: ["Jobs to Be Done (JTBD)"]         # EXACT Brain :Framework name(s); [] for utility/meta
produces: "room/market-analysis/jtbd-analysis/*"
inputs: ["a customer segment defined", "at least one job-to-be-done hypothesis"]
autonomous_safe: true                          # may /mos:act run it unattended?
allowed-tools: [Read, Write, Bash, Glob]
---
```
Utility/meta example:
```yaml
---
name: pipeline
kind: meta
frameworks: []
produces: null
inputs: []
autonomous_safe: false
---
```

### The registry JSON shape (`data/command-registry.json` - GENERATED, committed)
```json
{
  "ontology_ref": "data/framework-names.json",
  "generated_note": "GENERATED by scripts/build-command-registry.cjs - do not edit by hand",
  "commands": [
    { "command": "/mos:analyze-needs", "kind": "methodology",
      "frameworks": ["Jobs to Be Done (JTBD)"],
      "produces": "room/market-analysis/jtbd-analysis/*",
      "inputs": ["a customer segment defined"], "autonomous_safe": true, "body_shape": null },
    { "command": "/mos:beautiful-question", "kind": "methodology",
      "frameworks": ["Beautiful Question Framework"], "produces": "room/problem-definition/beautiful-question/*",
      "inputs": [], "autonomous_safe": true, "body_shape": null },
    { "command": "/mos:explore-domains", "kind": "methodology",
      "frameworks": ["Domain Selection"], "produces": "...", "inputs": [], "autonomous_safe": true, "body_shape": "varies" },
    { "command": "/mos:pipeline", "kind": "meta", "frameworks": [], "produces": null, "inputs": [], "autonomous_safe": false, "body_shape": null }
  ],
  "framework_index": {
    "Jobs to Be Done (JTBD)": ["/mos:analyze-needs"],
    "Beautiful Question Framework": ["/mos:beautiful-question"],
    "Domain Selection": ["/mos:explore-domains"],
    "Six Thinking Hats": ["/mos:think-hats"]
  },
  "curated_chains": [
    { "name": "act-1-discovery", "frameworks": ["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"] }
  ]
}
```

### The acceptance-criterion behavior
```js
const r = require('./lib/workflow/command-resolver.cjs');
r.composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"])
// => [
//   { step:1, framework:"Beautiful Question Framework", command:"/mos:beautiful-question", optional:false },
//   { step:2, framework:"Domain Selection",            command:"/mos:explore-domains",      optional:false },
//   { step:3, framework:"Jobs to Be Done (JTBD)",      command:"/mos:analyze-needs",         optional:false }
// ]
r.composeWorkflow(["Red Teaming"])           // a framework with no /mos: command
// => [ { step:1, framework:"Red Teaming", command:null, optional:true } ]   // consumer prints "run Red Teaming manually"
```

### The navigation-hook plug-in point (the ONE surgical edit)
```js
// lib/core/framework-chain-composer.cjs -- proposeNextFramework(), the existing slug call:
//   const slug = mapFrameworkToCommandSlug(top.to);
//   const command = '/mos:' + slug;
// becomes:
const resolver = require('../workflow/command-resolver.cjs');
const cmds = resolver.commandsForFramework(top.to);
const command = cmds.length ? cmds[0] : null;          // null -> "no /mos: for [framework] yet" (degrade, not fabricate)
// ... and proposeNextFramework gains an optional composeWorkflow path so a multi-hop FEEDS_INTO
//     chain surfaces as offer_next_step.workflow = resolver.composeWorkflow([completed, top.to, ...])
// The decision struct's offer_next_step then flows unchanged into offer-presenter.cjs / shape-f1-renderer.cjs.
```

### The CI tripwire wiring
```bash
# .git/hooks/pre-commit (add after the ROOM.md/MINTO.md guard):
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|data/command-registry\.json|data/framework-names\.json)$'; then
  node scripts/build-command-registry.cjs --check || { echo "command-registry drift -- run: node scripts/build-command-registry.cjs"; exit 2; }
fi
```
```js
// lib/memory/command-registry.test.cjs -- registered in lib/memory/run-feynman-tests.cjs TEST_FILES[]
const { spawnSync } = require('node:child_process');
const r = spawnSync('node', ['scripts/build-command-registry.cjs', '--check'], { cwd: require('path').resolve(__dirname,'..','..') });
assert.strictEqual(r.status, 0, 'command-registry must not be stale and must have no unresolvable framework');
// + a Canon Part 8 grep test: assert no '/mos:' literal adjacent to a brain/query/fetch token in lib/workflow/ or lib/brain/chain-recommender.cjs
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Framework->command mapping recalled by the model from memory | Deterministic registry lookup; model constrained to a returned allowlist (LLM tool-grounding best practice 2024-2026, arxiv 2412.04141) | Phase 122 | hallucinated-command mode eliminated |
| Three hand-maintained command maps (`FRAMEWORK_TO_COMMAND_SLUG`, `jtbd-taxonomy.json:methodology_hooks`, `references/methodology/index.md`) | One generated registry; all consumers route through `command-resolver.cjs` | Phase 122 | drift class removed (Canon Part 7) |
| Commands implied to live in the Brain (`brain-connector` SKILL.md "Brain has Command nodes... `brain_proactive_command`...") | Commands are plugin-local; Brain is methodology-pure; registry validated *against* Brain names, never written back | Phase 122 Phase 5 | Canon Part 8 boundary restored in the skill text (the live Brain already has no `Command` label) |
| `CO_OCCURS` mesh as the "what's next" signal (`enrichCausalEdges`) | `FEEDS_INTO` traversal over the cleaned Brain (163 edges, 7,882 chains) | brain-cleanup Phase 5 (DONE 2026-05-11) | the recommender's chain source is now real methodology sequencing, not statistical lint |

**Deprecated/outdated by this phase:**
- `lib/core/framework-chain-composer.cjs:FRAMEWORK_TO_COMMAND_SLUG` (frozen table) - becomes a pass-through to the resolver.
- `references/methodology/index.md` 26-row table - regenerate from the registry or delete.
- `skills/brain-connector/SKILL.md` "Brain-Powered Command Suggestions" section (`brain_proactive_command`, `Command` node, `FOLLOWS_FRAMEWORK -> Command -> TRIGGERED_BY_SIGNAL`) - delete; replace with "the command for that framework is `<resolver lookup>`".
- `lib/hmi/jtbd-taxonomy.json:entries[].methodology_hooks` - either keep but mark "informational only; the resolver is authoritative" or regenerate the hooks from `framework_index`.

## Open Questions

1. **Where do "curated chains" come from?**
   - What we know: the registry schema has `curated_chains[]`; the brain-cleanup 04-02 context (which the spec cites) was supposed to carry the schema but the PLAN file doesn't mention `command-registry` (searched - empty). The Brain's BONO orchestration patterns (Canon Part 2 Engine 2: Innovation / Strategic / Crisis / Product hat sequences) and Appendix E rules R1-R6 are obvious candidates.
   - What's unclear: whether curated chains are hand-authored in the registry generator, derived from the Brain's orchestration-path nodes, or just the canonical BONO sequences.
   - Recommendation: Phase 2 ships `curated_chains: []` (empty, valid); a follow-up populates it from the BONO sequences + Appendix E. Don't block Phase 122 on it.

2. **`recommendFrameworkChain` room-state input - how much?**
   - What we know: the spec says it reads room state (which sections exist, active JTBD, problem type) from the SQL navigation spine to pick *which* framework to start from. `navigation.cjs` exposes `getActiveFocus`, `getNeighborhood`, etc.; `lib/hmi/jtbd-state.cjs` reads the active JTBD; `lib/core/problem-type-router.cjs` already maps problem-type -> skill family.
   - What's unclear: whether Phase 3 builds a rich room-state reader or starts with "problem-type + active-JTBD -> seed framework" (the minimum that satisfies the acceptance criterion "`/mos:suggest-next` in a room with a known `ProblemType` returns a command sequence").
   - Recommendation: Phase 3 starts minimal (problem-type + JTBD seed via `problem-type-router` + `jtbd-state`), reads it through `navigation.cjs`. Richer state is a v1.14 follow-up.

3. **Does brain-cleanup Phase 5 actually unblock Phase 3, given the Brain corpus is still noisy?**
   - What we know: Phase 5 is DONE (`enrichCausalEdges` rewritten to `FEEDS_INTO`, framework corpus re-embed claimed 748/748). FEEDS_INTO has 163 edges / 7,882 chains - real and traversable. But the 748 `:Framework` names include obvious junk.
   - What's unclear: whether the re-embed actually covered the junk names (which would pollute vector-similarity fallback) or just the genuine frameworks; and whether the live Brain endpoint `mindrian-brain.onrender.com` reflects the post-cleanup state (its schema cache reports 84 labels, not <=30).
   - Recommendation: Phase 3 uses the **FEEDS_INTO-linked subset (~105) as the working framework universe**, not the full 748. The vector-similarity fallback is opt-in and best-effort (the spec already frames it as "frameworks like this one", a fallback). If the live endpoint turns out to be pre-cleanup, that's a brain-cleanup deploy issue surfaced here, not a Phase 122 blocker - Phase 122 just needs the FEEDS_INTO edges, which are present.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >=18 | everything | ✓ | the plugin runtime | — |
| `lib/core/brain-client.cjs` + a `MINDRIAN_BRAIN_KEY` | the registry generator's framework-names snapshot (build time only) | ✓ live (`isAvailable()` true; 163 FEEDS_INTO edges returned) | `mindrian-brain.onrender.com` | If no key at build time: ship `data/framework-names.json` as a committed snapshot (it's committed anyway); the generator only re-fetches when `--refresh-names` is passed. The resolver never needs the Brain. |
| `.git/hooks/pre-commit` | the CI drift tripwire (local gate) | ✓ exists (bash + .cmd) | - | the Feynman test file is the durable gate even if a contributor skips hooks |
| `lib/memory/run-feynman-tests.cjs` | the CI drift tripwire (durable gate) | ✓ exists | - | — |
| GitHub Actions | (NOT used by this repo) | ✗ | — | pre-commit + Feynman runner cover it; no Actions needed |
| brain-cleanup Phase 5 (`FEEDS_INTO` rewrite, re-embed) | Phase 122 build sub-phase 3 only | ✓ DONE 2026-05-11 | - | Phases 1, 2, 4-partial, 5-docs do not need it; only the chain recommender does |

**Missing dependencies with no fallback:** none. **Missing dependencies with fallback:** GitHub Actions (covered by pre-commit + test runner); Brain key at build time (covered by the committed `framework-names.json` snapshot).

## Validation Architecture

> `.planning/config.json` does not set `workflow.nyquist_validation` to false (key absent) -> section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `assert` + child-process test runner (no jest/mocha/vitest); the de-facto suite is `lib/memory/run-feynman-tests.cjs` (spawns each `*.test.cjs` in a child process; exit 0 = all pass) |
| Config file | none - `TEST_FILES[]` array inside `lib/memory/run-feynman-tests.cjs` |
| Quick run command | `node lib/workflow/command-resolver.test.cjs && node lib/memory/command-registry.test.cjs` (per-task) |
| Full suite command | `node lib/memory/run-feynman-tests.cjs` (after registering the two new files in `TEST_FILES[]`) |

### Phase Requirements -> Test Map
(Phase 122 has no `REQUIREMENTS.md` IDs - the acceptance criteria in `WORKFLOW-LAYER-SPEC.md` are the requirements. Mapping those:)
| Spec acceptance criterion | Test type | Automated command | File status |
|---|---|---|---|
| `build-command-registry.cjs` runs clean; CI fails on unresolvable framework or stale registry | integration | `node scripts/build-command-registry.cjs --check` | ❌ Wave 0: `lib/memory/command-registry.test.cjs` |
| `composeWorkflow([...3 frameworks...])` -> `[/mos:beautiful-question, /mos:explore-domains, /mos:analyze-needs]` with explicit `null` for command-less frameworks | unit | `node lib/workflow/command-resolver.test.cjs` | ❌ Wave 0: `lib/workflow/command-resolver.test.cjs` |
| `/mos:suggest-next` in a room with a known `ProblemType` returns a command *sequence* | integration | `node lib/memory/suggest-next-workflow.test.cjs` (fixture room) | ❌ Wave 0 |
| `/mos:pipeline --from-problem-type ill-defined` runs a Brain-derived command chain | integration | `node lib/memory/pipeline-from-problem-type.test.cjs` | ❌ Wave 0 (Phase 3/4) |
| `/mos:act --chain` stops at the first non-`autonomous_safe` step | unit | `command-resolver.test.cjs` `validateChainAutonomy` cases | ❌ Wave 0 |
| algorithmic cohort registered + chain-composable before utility commands | integration | `command-registry.test.cjs` asserts the cohort commands all have `kind: methodology` + non-empty `frameworks` | ❌ Wave 0 |
| zero Brain mutation: `BRAIN-SCHEMA.md` sha unchanged; no `Command` node; `IMPLEMENTED_AS`/`FEEDS_INTO` untouched | guard | grep test in `command-registry.test.cjs` (no `/mos:` adjacent to brain/query/fetch in `lib/workflow/`, `lib/brain/chain-recommender.cjs`) + a note that the brain-side sha check belongs to brain-cleanup CI-01 | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node lib/workflow/command-resolver.test.cjs` (+ `command-registry.test.cjs` once it exists)
- **Per wave merge:** `node lib/memory/run-feynman-tests.cjs` (full suite, with the new files registered)
- **Phase gate:** full suite green + `node scripts/build-command-registry.cjs --check` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `lib/workflow/command-resolver.test.cjs` - covers `commandsForFramework`, `frameworksForCommand`, `composeWorkflow` (incl. null/optional), `validateChainAutonomy`, empty-registry degrade path
- [ ] `lib/memory/command-registry.test.cjs` - `--check` exit-code, stale detection, unresolvable-framework detection, Canon-Part-8 grep guard, algorithmic-cohort assertion
- [ ] `lib/memory/suggest-next-workflow.test.cjs` - fixture room with a `ProblemType` -> command sequence (Phase 4)
- [ ] register both/three in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]`
- [ ] no new framework install needed (node `assert` + child_process is the framework)

## Lens 1: Online Research Findings

**(a) Generated-artifact + CI staleness tripwire** is a settled 2024-2026 pattern: a derived file (lockfile, generated GraphQL schema, OpenAPI spec) is committed; CI runs a *strict / frozen* regenerate-and-compare and fails on drift (`npm ci`, `yarn install --frozen-lockfile`, `pnpm install --frozen-lockfile`, `gradlew dependencies --write-locks` in a dedicated PR). Lockfile drift = "lock file out of sync with the manifest -> non-reproducible builds, silent regressions, SBOMs that lie." The fix is "strict install in CI + pre-commit hook that regenerates and fails if it changes + a PR-review checklist item." **Direct mapping to Phase 122:** `commands/*.md` frontmatter is the manifest; `data/command-registry.json` is the lockfile; `build-command-registry.cjs --check` is `npm ci`; the pre-commit guard + Feynman test file are the pre-commit hook + CI. Confidence: HIGH (this is the established practice; the only repo-specific wrinkle is "no GitHub Actions" -> the test runner is the CI).

**(b) Command/action-registry architectures.** VS Code's `contributes.commands` in `package.json` is the canonical example: a command must be *declared* in the manifest before it can be invoked/surfaced; runtime `registerCommand` binds the ID to a handler; `menus.commandPalette` `when`-clauses gate *when* a declared command shows. Since VS Code 1.74 a declared command auto-activates the extension on invocation. The architecture guarantees "unregistered commands cannot be discovered or executed through normal flows." LSP code actions, shell-completion specs (Fig), and Raycast/Alfred action manifests follow the same shape: a static descriptor (name, title, conditions, args) + a runtime binding, validated at packaging time. **Mapping:** `data/command-registry.json` = the `contributes.commands` manifest (declared truth); `command-resolver.cjs` = the lookup that means "Larry can only emit a *registered* command"; the `kind`/`autonomous_safe`/operator-filter = the `when`-clause analogue. Confidence: HIGH.

**(c) LLM naming a tool from memory vs constraining it to a returned allowlist.** Tool hallucination is a recognized failure class (arxiv 2412.04141 "Reducing Tool Hallucination via Reliability Alignment" splits it into *tool-selection* and *tool-usage* hallucination; 2025 surveys on agentic RAG cover mitigation). The production pattern: never let the model produce the tool/parameter from memory - intercept and validate against the *available* tools before execution ("a critical security and reliability checkpoint where you can catch hallucinated arguments before they hit your backend"). **Mapping:** the resolver is that checkpoint. Larry proposes a *framework* (methodology, which the Brain grounds via FEEDS_INTO); the command is *computed* by the resolver from the registry; Larry never types a `/mos:` he recalled. Confidence: HIGH (the spec's design IS the recommended pattern).

**(d) Frontmatter-as-single-source-of-truth, validated at build time.** Astro content collections + zod schemas, Hugo archetypes, and similar SSG patterns: frontmatter is the typed source; a build-time validator (zod `defineCollection`, etc.) fails the build on a malformed/extra field. **Mapping:** Phase 122 does the same minus zod (forbidden) - a hand-rolled validator in `build-command-registry.cjs` plus the existing `lib/core/frontmatter-schemas.cjs` pattern. The discipline ("the frontmatter is the truth; the build fails if it's wrong") transfers; the library does not. Confidence: HIGH on the pattern, HIGH that zod is off the table here (CLAUDE.md).

## Lens 2: ICM Local + Remote Graph

**Remote (Brain / Neo4j) - QUERIED LIVE 2026-05-12 via `lib/core/brain-client.cjs`:**
- `MATCH (a:Framework)-[r:FEEDS_INTO]->(b:Framework) RETURN count(r)` -> **163** (matches the spec's "163 edges").
- `MATCH (f:Framework) RETURN count(f)` -> **748** (matches brain-cleanup Phase 4's post-restore count).
- `MATCH p=(a:Framework)-[:FEEDS_INTO*1..3]->(b:Framework) ... LIMIT 25` -> real chains, e.g. `PWS Value Proposition -> Red Teaming -> PWS Triple Validation Compass -> IP Due Diligence Framework`; `PWS Value Proposition -> Scenario Planning -> Knowns and Unknowns Matrix Framework -> Cynefin Framework`. The graph is genuinely traversable. (The spec's "7,882 chains" depth 1-4 is from `BRAIN-SCHEMA.md`; not re-counted here but consistent.)
- `MATCH (f:Framework) WHERE (f)-[:FEEDS_INTO]-() RETURN f.name` -> **~105 frameworks** are FEEDS_INTO-connected. This is the *working framework universe* for the resolver/recommender. It includes all the names the spec's acceptance example uses: `Beautiful Question Framework`, `Domain Selection`, `Jobs to Be Done (JTBD)`, `Six Thinking Hats`, `PWS Value Proposition`, `Cynefin Framework`, `Systems Thinking`, `Root Cause Analysis`, `S-Curve Analysis`, `Lean Canvas`, `Reverse Salient Analysis`, `Wicked Problem Detection Framework`, etc. Top out-degree: `PWS Value Proposition` (17), `Six Thinking Hats` (10), `PWS Triple Validation Compass` (5), `Systems Thinking` (5), `Cynefin Framework` (4), `Wicked Problem Detection Framework` (4).
- **Caveat:** the full 748 `:Framework` set is still noisy - `"Charles Kirschbaum"`, `"Eugene Ely"`, `"Alexander Graham Bell"`, `"Amazon"`, `"ABB"`, `"Apple iPad"`, plus quoted-string near-duplicates (`'Blue Ocean Strategy'`, `"Design Thinking"`, `2x2 Matrix`, `5 W's`). The brain-cleanup Phase-4 normalization (130->Person, 93->Concept) clearly didn't catch everything. **The `framework-names` allowlist the registry CI validates against MUST be the FEEDS_INTO-linked subset (or a curated whitelist), not all 748.** Snapshot it to `data/framework-names.json` at build time.
- **Schema caveat:** `brain.schema()` reports **84 labels / 32 rel types** on the live endpoint - NOT the `<=30 labels / <=28 rel types` brain-cleanup's acceptance claimed. Either the schema cache is stale, the normalization wasn't fully deployed to `mindrian-brain.onrender.com`, or this is a different endpoint. **Implication for Phase 122:** soften the "27 labels / 28 rel types unchanged" acceptance criterion - the strong label count is brain-cleanup's responsibility, not Phase 122's. Phase 122's Brain-impact assertions that matter: no `Command` label (verified absent), `FEEDS_INTO` count not decreased, `IMPLEMENTED_AS` untouched, `BRAIN-SCHEMA.md` sha unchanged, zero user-content in any Brain query. (`mcp__my-neo4j__read_neo4j_cypher` was not in the available MCP toolset this run; `brain-client.cjs` is the correct path anyway and is what production uses.)

**Local (room graph + navigation engine):**
- The local room graph is **SQLite** at `room/.room-graph/` per memory `feedback_local_graph_sqlite.md` (Kuzu references are stale). The plugin repo has **no `room/` dir** (it's the user's workspace, not the plugin's) - so Phase 122's local-graph reads happen at *runtime in a user's room*, via `lib/core/navigation.cjs` (the closed 13-function chokepoint, Phase 109) and `lib/core/room-db.cjs` *only through* `navigation.cjs` (the Plan 109-06 pre-commit hook blocks direct `room-db.cjs` requires outside the allow-list - `lib/workflow/command-resolver.cjs` and `lib/brain/chain-recommender.cjs` must NOT be on that allow-list; if the recommender needs room state it goes through `navigation.cjs`).
- **The navigation engine "engine v1" is already built (Phase 91):**
  - `lib/core/navigation-engine.cjs` - `decide(turn, context) -> decision`; the decision struct carries `fire_skill`, `suppress_skills`, `offer_next_step`, a full `decision_trace`. Pure local reader; never queries Brain (the two permitted touches are `brain-client.isAvailable()` and `brain-client.schema()`, both optional).
  - `lib/core/skill-activation-router.cjs` - composes `decide()` output with legacy file-state activation; emits `source: 'engine' | 'mixed' | 'legacy'` (the spec's `routing_source: legacy`). Precedence: engine `fire_skill` validates as a canonical verb -> `engine`; else suppress+legacy -> `mixed`; else byte-equivalent to pre-91 -> `legacy`.
  - `lib/core/offer-presenter.cjs` - `presentOffer(decision, offerHistory, sessionCtx) -> { offerLine, recommendedMarker, suppressReason }`; format `"Offer[ (RECOMMENDED)]: Because <reason>, try <command>."`; one-per-turn flag; consecutive-ignore suppression (2 ignores); `.mindrian/offer-history.json` ledger.
  - `lib/core/framework-chain-composer.cjs` - parses `BRAIN.md` `framework_chain_predictions` (written by Phase 90-01 `deriveSection`), `proposeNextFramework(completedFramework, edges) -> { next, confidence, source:'FEEDS_INTO', command, reason, recommended_eligible }`. **`mapFrameworkToCommandSlug()` + `FRAMEWORK_TO_COMMAND_SLUG` + `KNOWN_FRAMEWORKS` here is the hardcoded map Phase 122 replaces.**
  - `lib/core/problem-type-router.cjs` - UDP/IDP/WDP -> skill family; wicked-score >=8 -> soft-systems override (Canon Appendix E R4). Already references existing `/mos:` commands by literal - candidates for resolver lookup.
  - The hook: `hooks/hooks.json` `UserPromptSubmit[0]` = `run-hook.cmd intent-classifier` -> `scripts/intent-classifier` (bash polyglot) / `scripts/intent-classifier.cjs`. (Also on `UserPromptSubmit`: `brain-derivation-drain.cjs`, `operator-update.cjs`, `jtbd-update.cjs userprompt`, `auto-explore-drain.cjs`.) The "workflow-suggestion step" does NOT need a new hook - it's a code change inside the engine's `offer_next_step` production path (`framework-chain-composer.proposeNextFramework` -> swap the slug call for the resolver -> add a `composeWorkflow` multi-step path).
- **ICM mapping:** the Workflow Layer sits across **ICM Layer 1 (Routing - "which command responds to this framework recommendation")** and **ICM Layer 3 (Reference - the registry is a stable building block, frontmatter-sourced, Canon Part 7)**. It does NOT touch Layer 4 (artifacts) except that `produces:` describes what each command files. Canon mapping (from `122-CONTEXT.md` frontmatter): Part 7 (frontmatter as single source of truth - the resolver is "reuse before build", routing all existing maps through one door), Part 8 (commands never enter the Brain - the registry is plugin-local, validated against Brain names, never written back; the `brain-connector` SKILL.md "Command node" text is a pre-existing breach in *prose* to delete), Part 3 (the resolver feeds `offer_next_step` -> the Decision Gate's `F.0`/`F.1` accept-reject-defer surface), Part 4 (the navigation hook's command suggestion is deterministic graph+registry lookup, not model recall - "every choice is graph data" includes "every command Larry names is traceable to a registry entry").
- **HARD CONSTRAINT, restated:** commands NEVER enter the Brain (Canon Part 8). The registry is plugin-local. It is *validated against* Brain framework names at build time (read-only `brain.query`). Nothing about commands is ever written to Neo4j. The recommender's Cypher carries framework names + problem-type enums only - `brain-client.sanitizeCypherInput` whitelist + a no-`/mos:`-strings test.

## Lens 3: Product / Hooked Model

(Audit per the `hooked-model` skill - `~/.claude/skills/hooked-model/SKILL.md` - applied to the Workflow Layer as a feature *within* the MindrianOS B2B/prosumer product. Prior Hooked context: the v1.13.0 milestone targets a Hooked re-score of 27/70 -> 58/70; Phase 117's Variable-Reward rescore harness exists at `scripts/hooked-rescore-117.cjs`; the empathy-audit dir is `docs/empathy-audit/`.)

**Step 1 - Intake.** Product: MindrianOS Plugin (B2B/prosumer, Claude Code/Desktop/Cowork). User: the wicked navigator (Founder/Researcher/Investor). Intended habit: "when I'm working a venture problem, I open Larry and he moves me to the next validated decision." Workflow-Layer's job in that habit: make "Larry -> the right command -> a filed artifact -> here's the next link" *reliable*.

**Step 2 - Trigger.** The navigation hook surfacing a command sequence as `offer_next_step` is an **external trigger** today (Larry shows it at end-of-turn). Over time it's an **internal-trigger builder**: the navigator learns "when I'm stuck / circling, Larry shows me the next move" - the emotion *stuck/uncertain* gets paired with *open Larry, accept the offer*. That's exactly the "own a specific internal emotion" goal (boredom->TikTok; **stuck-on-a-venture-decision -> Larry's next move**). **Score this axis: external 6/10 -> internal-trigger pathway now exists (the offer is the bridge); was ~3/10 (no reliable next-move surface, and the next-move that did surface sometimes pointed at a non-existent command, which *breaks* trust rather than building a trigger).** Phase 122 is the prerequisite for the internal-trigger formation Phase 116 (tension hook) and Phase 117 (auto-explore) are trying to get credit for - a trigger that fires `/mos:jtbd` (404) doesn't build a habit, it builds distrust.

**Step 3 - Action (B = M x A x P).** This is where Phase 122's biggest contribution lands - **Ability**. Fogg's six ability factors for "act on Larry's suggestion":
- *Brain cycles* (the big one): before Phase 122 the navigator has to second-guess every command Larry names ("did he make that up? does `/mos:jtbd` exist?") - that's a brain-cycle tax on every suggestion. After: every command came from the resolver, so it *exists* and *does what the label says*. Friction removed. **This is the single largest B=MAP improvement in the feature.**
- *Non-routine*: a one-tap `F.1` "run this chain? `/mos:a` -> `/mos:b` -> `/mos:c` - [accept]" makes the action routine (the AskUserQuestion primitive, Phase 88.2). Was: type a command you half-remember.
- *Time / physical effort*: accept = one keypress; `/mos:act --chain` runs the composed workflow. Low.
- *Money / social deviance*: n/a.
The MVA (Minimum Viable Action) here = **press accept on the offer**. Phase 122 makes the MVA *trustworthy* (the command is real) and *low-friction* (one tap, computed not recalled). **Score this axis: ~7/10 post-Phase-122, up from ~4/10** (the friction was never "too many keystrokes" - it was "I don't trust the command name", a brain-cycle/uncertainty cost; Phase 122 zeroes it).

**Step 4 - Variable Reward (Tribe / Hunt / Self).** The reward = "the right algorithmic command at the right time produces a filed artifact + surfaces the next link." Type: mostly **Hunt** (information/resource - the artifact, the next chain link) with a **Self** component (mastery/progress - "I'm advancing the venture"). Variability: the *which framework comes next* is genuinely uncertain to the navigator (the Brain's FEEDS_INTO traversal can surprise them - "huh, Red Teaming feeds into Triple Validation Compass?"), which is real variable-reward variability, not linear. Phase 122 doesn't *create* the reward (the methodology commands already file artifacts) but it makes the reward **predictably available** (the command exists) while keeping the *content* variable (the chain surprises). That's the right shape. **Score: ~6/10** - good Hunt+Self mix, real variability in the chain, but capped because the artifact-quality reward depends on Phases 118/120 (30-second MVA reward, breakthrough scan) for the *wow* moment; Phase 122 is the reliable plumbing under it.

**Step 5 - Investment.** The navigator's investments: accepting/rejecting offers (rejection-with-reason becomes graph data per Canon Part 4 - "why not" loads the next scan), the artifacts the commands file, the room state. Phase 122's contribution: every accepted offer -> a `memory_event` row -> the loop is observable -> the next nudge is better-informed (sequencing: trigger -> action -> reward -> *then* investment, correctly ordered - the navigator invests *after* the artifact is filed). **Score: ~6/10** - the investment->trigger loop closes (offer-history.json + memory_event feed future offers), but the cross-session "this chain is half-done, pick it up" investment is Phase 116's job.

**Step 6 - Loop integrity.** beta.10 IS the loop-closure phase per the spec's last line: navigation engine routes -> operator sets mode -> SQL graph says where you are -> cleaned Brain says what's next -> **registry says which command does it** (the Phase 122 link) -> Larry proposes as F-selector -> you confirm -> `/mos:act` runs -> artifact files -> cascade fires -> next nudge. Phase 122 is the *missing link* in that sentence - without it the chain is "Brain says framework X -> ??? -> hope Larry names the right command". **Loop-closure score: this phase moves it from broken to closed.**

**Step 7 - Ethics (Manipulation Matrix).** Maker uses it (dog-fooding mandate, Canon Part 6) + improves lives (it's a venture-decision tool) -> **Facilitator** is the target and Phase 122 keeps it there *if* the over-prompting discipline holds. The Peddler risk: if the navigation hook surfaces command chains too aggressively (every turn, under JUST_TALK, after ignores), it tips toward "renting attention" / nagging. The design choices that keep it Facilitator: (1) the engine already gates `offer_next_step` by operator (quiet under JUST_TALK) - Phase 122 must not loosen this; (2) the presenter's consecutive-ignore suppression (2 ignores -> stop) - keep it; (3) one-offer-per-turn flag - keep it; (4) a *chain* offer is heavier than a single-step offer, so if anything tighten the budget when proposing a multi-step workflow; (5) "degrade, don't fabricate" - never surface a made-up command, which would be a dark pattern (fake affordance). The Peddler line is crossed the moment a command suggestion appears outside the engine's gated `offer_next_step` pipeline - the plan must forbid that.

**Projected effect on the v1.13.0 Hooked target (27 -> 58):** Phase 122 itself doesn't add a flashy reward; it makes the *Action* axis (B=MAP, the Ability sub-score) jump (~4 -> ~7) by removing the "did Larry make that up?" friction, and it makes the *Trigger->internal* pathway *possible* (a trigger that fires a real command can build a habit; one that 404s can't). Net: Phase 122 is the *enabler* that lets Phases 116/117/118/120 score their Trigger/Reward gains - without it those phases are building on a hook whose action sometimes dead-ends. Estimate: directly worth ~+4-6 points on the milestone score (Action +3, Loop-closure +2, Trigger-enablement spillover), and *unblocks* the ~+10-15 the rest of the cluster claims. Re-score harness pattern to mirror: `scripts/hooked-rescore-117.cjs` (read LOCAL telemetry JSONL -> compute axis score -> markdown to `docs/empathy-audit/`); Phase 122's would read `offer_*` / `memory_event` rows tagged with `routing_source: engine` and a resolver-sourced command, and score the Action axis (fraction of suggested commands that resolved cleanly = 100% by construction post-122; the metric is "offers accepted / offers shown" and "median latency to accept").

## Lens 4: The Three Personas

(Per Canon's 9-role taxonomy + Part 8 protections + Appendix E rules + the spec's "what it leverages" section. For each: the framework cohort that matters, the chain the Workflow Layer gives them, what "Larry suggests X -> Y -> Z" does, the failure mode if the resolver gets it wrong, and which v1.13.0 surface their experience depends on.)

### P2 Researcher (pre-publication priority; possibly P2.IND with HIPAA / FDA 21 CFR Part 11 / IRB)
- **Cohort that matters:** the diagnostics / whitespace / reverse-salient evidence-chain commands - `/mos:diagnostics` (Wave-1 algorithmic fingerprint), `/mos:whitespace` (coverage-gap), `/mos:find-bottlenecks` (Reverse Salient), `/mos:rs-fetch` -> `/mos:rs-experts` -> `/mos:rs-thesis` -> `/mos:rs-explain` (the full reverse-salient pipeline), `/mos:find-connections`, `/mos:find-analogies`, `/mos:research` (web + Brain cross-ref), `/mos:causal` (causal-edge trace), `/mos:map-unknowns` (Rumsfeld), `/mos:root-cause`, `/mos:build-knowledge` (DIKW). FEEDS_INTO names in the Brain that anchor these: `Reverse Salient Analysis`, `Reverse Salients identification`, `Algorithmic Generation of Reverse Salient Solutions`, `HSI Semantic Surprise Analysis Assistant`, `Root Cause Analysis`, `Knowns and Unknowns Matrix Framework`, `Falsifiability`, `Hypothesis-Driven Problem Solving`.
- **What the chain does mid-investigation:** a researcher exploring a domain hits "where's the gap nobody's working?". Larry suggests `/mos:whitespace` -> `/mos:find-bottlenecks` -> `/mos:rs-thesis` (the spec's example). With the Workflow Layer: that's a *composed, validated* chain - each command exists, runs over the room corpus + Pinecone embeddings, and files an artifact with an evidence tier (Canon Part 5). The researcher gets a *reproducible* pipeline - "I ran the reverse-salient chain on my corpus, here are the artifacts, here's the provenance" - which is exactly what pre-publication priority needs (a defensible record of *how* the gap was found). The Brain's FEEDS_INTO traversal seeds *which* framework starts the chain from the room's `ProblemType`.
- **Failure mode if the resolver gets it wrong:** Larry suggests `/mos:rs-thesis` but the real reverse-salient-thesis command is named differently, OR `/mos:whitespace` returns silent zeros because the baseline wasn't auto-fired (a known pre-122 bug class, fixed in Phase 88.6). For a researcher this is *worse than annoying* - a broken evidence chain mid-investigation means re-running, lost time near a publication deadline, and (if it silently produces a wrong artifact) a polluted record. The resolver's "degrade, don't fabricate" is the protection: a framework with no command -> "run [framework] manually" -> the researcher knows the chain has a gap, rather than getting a confident wrong command.
- **v1.13.0 surface dependency:** **Part 2 Engine 1 (Act 1 code-driven intelligence - whitespace + reverse salient + cross-domain, the algorithmic cohort the spec puts on the critical path)** + **Phase 89 reverse-salient-engine** (the `rs-*` commands the chain composes) + **the SQL navigation spine (Phase 108/109)** for "which framework to seed from the corpus state" + **persona/role_blend (Phase 115)** so the framing is "run the diagnostics fingerprint first" (researcher voice) not "let's score this with Mullins" (founder voice). Part 8 is non-negotiable for P2.IND: zero patient/clinical content to the Brain - the recommender carries framework names + problem-type enums only.

### P3 Entrepreneur / Founder (trade secrets, strategic IP)
- **Cohort that matters:** the JTBD / validate / canvas / scenario / thesis commands - `/mos:analyze-needs` (JTBD importance-satisfaction), `/mos:user-needs`, `/mos:validate` (importance-satisfaction), `/mos:value-proposition` (exposed as `/mos:validate-proposition` - a live name mismatch), `/mos:lean-canvas`, `/mos:scenario-plan` (2x2), `/mos:build-thesis` (Ten-Questions), `/mos:beautiful-question` (reframe), `/mos:structure-argument` (Minto+SCQA+MECE), `/mos:explore-domains` -> `/mos:explore-trends` / `/mos:macro-trends` -> `/mos:find-bottlenecks` (the Act-1 explore->trends->reverse-salient chain). FEEDS_INTO anchors: `Beautiful Question Framework` (out-degree 3), `Domain Selection` (out-degree 2), `Jobs to Be Done (JTBD)`, `Jobs-to-be-Done for Business Models`, `Lean Canvas`, `Scenario Planning`, `PWS Value Proposition` (out-degree 17 - the hub), `Problem Definition Transformation Framework`, `Well-Defined Problem Framework`.
- **What "reduce time between insight and validated decision" looks like with chaining:** a founder has a raw idea. The Workflow Layer's chain (seeded from `ProblemType: ill-defined`): `/mos:beautiful-question` -> `/mos:explore-domains` -> `/mos:analyze-needs` (the spec's exact acceptance example - `composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"])`). Each step files an artifact; `/mos:act --chain` runs them in sequence and *stops at the first non-`autonomous_safe` step* with a "needs you here" gate (the founder confirms the JTBD before the chain proceeds). That's the JTBD core job ("reduce the time between insight and validated decision") made literal - the founder doesn't have to *know* the methodology sequence, the cleaned Brain knows it (FEEDS_INTO) and the registry knows which command does each step.
- **Where the current pain is sharpest:** "Larry named a command that doesn't exist" - the spec's own example is `/mos:jtbd` (the founder's mental model says "jobs to be done = jtbd command") when the real command is `/mos:analyze-needs`. A founder mid-pitch-prep who types `/mos:jtbd` and gets nothing loses momentum at exactly the wrong moment. (Note: `/mos:jtbd` *does* now exist as a command - but it's the *JTBD state inspector* (Phase 100), not the JTBD *methodology* - so it's *worse* than a 404: it runs the wrong thing. The resolver fixes this: `commandsForFramework("Jobs to Be Done (JTBD)")` -> `/mos:analyze-needs`, deterministically.)
- **Failure mode if the resolver gets it wrong:** the founder runs a chain that includes the wrong scoring/validation command -> a validated-decision artifact that's actually invalid -> a strategic decision made on bad analysis. For a founder protecting trade secrets, there's also the Part 8 angle: the recommender must never send the founder's actual business model / proprietary numbers to the Brain - only "framework=Lean Canvas, problem-type=ill-defined". The resolver never touches the Brain at all, so it's structurally safe; the recommender's Cypher is name+enum only.
- **v1.13.0 surface dependency:** **conversation-operator state machine (Phase 99)** - the chain surfaces under `BUILD_ROOM` / `METHODOLOGY` / `DECISION_GATE`, stays quiet under `JUST_TALK` (a founder venting about a co-founder doesn't want a `/mos:lean-canvas` nudge); **larry-default-activation (Phase 114)** - Larry is the default surface, "commands are internals", so the founder never has to know `/mos:` names exist; **`/mos:act --chain` + `validateChainAutonomy`** (Phase 122 Phase 4) - the "human confirms" gate; **F-shape selectors (Phase 88.2)** - the chain renders as `F.1` accept/reject/defer; **persona/role_blend (Phase 115)** - "let's score this with Mullins" framing.

### P1 Portfolio Evaluator / Investor (LPA deal-flow confidentiality)
- **Cohort that matters:** the comparison / grading / domain-scoring commands - `/mos:compare-ventures`, `/mos:deep-grade` (against 100+ calibrated projects), `/mos:grade` (6-component problem-discovery), `/mos:mullins` (7-Domains), `/mos:structure-argument` (Minto+SCQA+MECE - for writing the IC memo), `/mos:score-innovation` (HSI cross-domain), `/mos:diagnose` (PWS matrix problem-type + framework recommendation), `/mos:build-thesis` (the inverse - what the founder *should* have). FEEDS_INTO anchors that exist: `PWS Triple Validation Compass` (out-degree 5: ESG / Financial / IP / Legal Due Diligence Frameworks), `ESG Due Diligence Framework`, `Financial Due Diligence Framework`, `IP Due Diligence Framework`, `Legal Due Diligence Framework`, `Red Teaming` (the spec's `PWS Value Proposition -> Red Teaming -> PWS Triple Validation Compass -> {ESG/Financial/IP/Legal} Due Diligence` chain is a *real FEEDS_INTO path in the live Brain* - perfect for an investor's repeatable DD pipeline), `MECE`, `The Pyramid Principle` (for the memo).
- **The repeatable pipeline the Workflow Layer gives:** an investor with a deck runs the same chain on every deal: `/mos:diagnose` (classify) -> `/mos:mullins` (7-Domains screen) -> `/mos:deep-grade` (calibrated grade) -> `/mos:compare-ventures` (against the portfolio) -> `/mos:structure-argument` (the IC memo). Or, seeded from the Brain's FEEDS_INTO path: `Red Teaming -> PWS Triple Validation Compass -> {ESG, Financial, IP, Legal} Due Diligence` composed into `/mos:challenge-assumptions` -> ... (whichever commands map). The point: it's *the same pipeline every time*, which is the entire value to an investor - comparability across deals, a defensible "we evaluate every company the same way" process for LPs.
- **The trust requirement (the sharpest of the three):** an investor will *not tolerate* "sometimes Larry suggests the wrong scoring command." If the DD pipeline runs `/mos:grade` on one deal and silently a different command on the next because Larry recalled differently, the comparability is destroyed and the LP-facing process is a fiction. The resolver's determinism is the whole product here: `composeWorkflow(["Mullins 7-Domains", "PWS Triple Validation Compass", ...])` returns the *same* command sequence every time, machine-verified by the registry. The `curated_chains[]` slot in the registry is where a "standard DD pipeline" would live as a named, frozen chain.
- **Failure mode if the resolver gets it wrong:** wrong scoring command -> a grade that isn't comparable to the rest of the portfolio -> a mis-ranked deal -> a bad allocation decision. Plus the Part 8 angle is *most acute* for P1: deal-flow is LPA-confidential - the recommender must never send a portfolio company's deck content / financials to the Brain (only "framework=Mullins 7-Domains, problem-type=well-defined"). Structurally safe because the resolver is Brain-free and the recommender is name+enum only - but a future "smart" version that tried to "let the Brain rank these ventures" would be the canonical breach, and the brain-boundary-scan PR gate exists exactly to catch it.
- **v1.13.0 surface dependency:** **the SQL navigation spine (Phase 108/109)** - "which deal, which sections filed, what's the problem type" seeds the pipeline; **`/mos:act --chain` + `validateChainAutonomy`** - an investor wants the DD pipeline to *run* (most DD steps are `autonomous_safe: true` - they read the deck and score) and stop only where judgment is required (the final IC-memo synthesis is `autonomous_safe: false`); **persona/role_blend (Phase 115)** - "deep-grade this against the portfolio" framing; **cascade hooks (Phase 116/117)** - a `CONTRADICTS` finding between the deck's claims and the DD artifacts carries a suggested command to resolve it; **the registry's `curated_chains[]`** (Phase 122 Phase 2, populated later) - the named "standard DD pipeline".

## Sources

### Primary (HIGH confidence)
- Local code (read directly, 2026-05-12): `lib/core/navigation-engine.cjs`, `lib/core/navigation.cjs`, `lib/core/skill-activation-router.cjs`, `lib/core/offer-presenter.cjs`, `lib/core/framework-chain-composer.cjs` (incl. `mapFrameworkToCommandSlug`), `lib/core/problem-type-router.cjs`, `lib/core/frontmatter-schemas.cjs`, `lib/core/brain-client.cjs`, `lib/core/integration-registry.cjs`, `hooks/hooks.json`, `hooks/run-hook.cmd`, `scripts/intent-classifier.cjs` (head), `scripts/build-*` listing, `.git/hooks/pre-commit`, `lib/memory/run-feynman-tests.cjs`, `lib/hmi/jtbd-taxonomy.json`, `references/methodology/index.md`, `skills/pws-methodology/SKILL.md`, `skills/brain-connector/SKILL.md`, `commands/*.md` frontmatter (sampled ~15 + full name list), `package.json`.
- Brain (Neo4j) queried live via `lib/core/brain-client.cjs` 2026-05-12: `FEEDS_INTO` count = 163; `:Framework` count = 748; FEEDS_INTO-linked subset ~105; sample depth-1..3 chains; out-degree ranking; `brain.schema()` = 84 labels / 32 rel types.
- `.planning/WORKFLOW-LAYER-SPEC.md` (read in full), `.planning/phases/122-workflow-layer/122-CONTEXT.md`, `.planning/STATE.md`, `CLAUDE.md` + `.claude/includes/*`, `docs/MINDRIAN-CANON.md`, `docs/CANON-PHASE-MAP.md`.
- `~/gsd-workspaces/brain-cleanup/.planning/STATE.md` + `ROADMAP.md` (Phase 6 CI-01 design) + `REQUIREMENTS.md` (CI-01) + `phases/04-*` listing; `~/gsd-workspaces/brain-cleanup/mindrian-deploy/docs/BRAIN-SCHEMA.md` (framework names, FEEDS_INTO, uniqueness, Canon Part 8 boundary).
- `~/.claude/skills/hooked-model/SKILL.md` (the Hooked audit protocol applied in Lens 3); `docs/empathy-audit/auto-explore-117-rescore.md` + `scripts/hooked-rescore-117.cjs` (the re-score harness pattern).

### Secondary (MEDIUM confidence)
- VS Code Extension API: [Contribution Points](https://code.visualstudio.com/api/references/contribution-points), [Commands guide](https://code.visualstudio.com/api/extension-guides/command), [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest) - the `contributes.commands` declared-truth + runtime-bind + `when`-clause pattern.
- Lockfile / generated-artifact drift: [What Is Lock File Drift? (Sbomify)](https://sbomify.com/2024/07/30/what-is-lock-file-drift/), [Monorepo Lockfiles (DEV)](https://dev.to/alex_aslam/monorepo-lockfiles-the-secret-weapon-to-crush-dependency-drift-forever-4ac), [pnpm install --frozen-lockfile](https://pnpm.io/cli/install), [package-lock.json (oneuptime)](https://oneuptime.com/blog/post/2026-01-22-nodejs-package-lock-json/view) - the strict-regenerate-and-fail-on-drift CI pattern.
- LLM tool hallucination: [Reducing Tool Hallucination via Reliability Alignment (arxiv 2412.04141)](https://arxiv.org/html/2412.04141v1), [Mitigating Hallucination in LLMs survey (arxiv 2510.24476)](https://arxiv.org/html/2510.24476v1), [3 Patterns That Fix LLM API Calling (DEV)](https://dev.to/docat0209/3-patterns-that-fix-llm-api-calling-stop-getting-hallucinated-parameters-4n3b) - constrain the model to a returned/validated allowlist; intercept before execution.

### Tertiary (LOW confidence / not load-bearing)
- Astro content collections + zod / Hugo archetypes as the "frontmatter-as-source-of-truth, validated at build" precedent (general knowledge; the *library* (zod) is explicitly off the table per CLAUDE.md, only the *discipline* transfers).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - CLAUDE.md "What NOT to Use" is explicit; verified no `zod`/`gray-matter`/`ajv` in plugin scripts; the `gsd-tools.cjs` / `integration-registry.cjs` precedents are concrete.
- Architecture (resolver-is-the-only-door; generated registry + tripwire; navigation-hook plug-in point): HIGH - the navigation engine, offer presenter, skill-activation-router, and framework-chain-composer are all already built and read directly; the single surgical edit point (`mapFrameworkToCommandSlug` -> resolver) is identified.
- CI surface: MEDIUM - the repo has NO GitHub Actions; "CI" = pre-commit hook + Feynman test runner; the "Brain-side Phase-6 CI-01 tripwire" the spec says to mirror is unscaffolded (mirror its design, not a file).
- Brain graph state: HIGH on FEEDS_INTO (163 edges, queried live) and the ~105-framework traversable subset; MEDIUM on whether the live `mindrian-brain.onrender.com` endpoint fully reflects post-cleanup normalization (schema cache says 84 labels, not <=30 - flagged as a brain-cleanup deploy question, not a Phase 122 blocker).
- Pitfalls: HIGH - the hallucinated-command examples (`/mos:jtbd` is a worse case than the spec realized: it now runs the *wrong* command, not 404), the three hand-maintained maps, and the `brain-connector` SKILL.md Part-8-violating prose are all verified in the codebase.
- Personas: HIGH - mapped to real command cohorts, real FEEDS_INTO anchors in the live Brain (the investor's `Red Teaming -> PWS Triple Validation Compass -> {ESG/Financial/IP/Legal} Due Diligence` chain is an actual graph path), and the spec's "what it leverages" surfaces.

**Research date:** 2026-05-12
**Valid until:** ~2026-06-12 (30 days; the Brain graph is stable post-cleanup; the plugin codebase moves fast - re-verify the navigation-engine / framework-chain-composer file contracts before planning if more than 2 weeks elapse, and re-check whether brain-cleanup Phase 6 got scaffolded).
