# Phase 356: Chain-executor irreversibility ledger (Jev Noul, dev-time, shipped as data) - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A dev-time build script scores every command in `data/command-registry.json` once, with one TypeSafe Jev Noul ("is running this command irreversible?") carrying a written policy. The result ships as a data ledger. At runtime, `isIrreversibleStep` in `lib/core/chain-executor.cjs` reads that ledger locally, add-only: it can force a halt, never clear one. No runtime network call, no Theo gateway.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**8 requirements are locked.** See `356-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `356-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** written irreversibility policy text; hand-labeled 113-command answer key reviewed by the navigator; a dev-time builder with live, fixture and `--check` modes; a shipped ledger with per-entry hash, threshold and false-alarm count; an add-only, hash-checked, local-only change to `isIrreversibleStep`; tests for zero-miss, add-only, staleness, egress refusal and ledger-absent degradation; extraction of the shared Jev client if 356 executes first.

**Out of scope (from SPEC.md):** rewriting `autonomous_safe` registry tags; argument-level irreversibility; any live per-step Jev call or Theo gateway; the "material" self-critique predicate; `/mos:ignite`'s explicit `irreversible: true` steps; the 354-17 and 357 ledgers themselves.

</spec_lock>

<decisions>
## Implementation Decisions

### Policy text (SPEC R1)
- **D-01:** The policy lives at `data/jev-policies/command-irreversibility.json`: one file per dev-time Jev ledger, in a folder 357 and 354-17 can share. Fields: `policy_id`, `version`, `instructions`, `criteria[]`, `boundary_cases[]`. `policy_hash` = SHA-256 of the file bytes, recorded in the ledger. Add one row to `data/ROOM.md`. Do NOT use `data/harness-policies/` (runtime gate policies, different schema).
- **D-02:** Claude drafts from the SPEC R1 definition and lists local-file vs. upload boundary cases for every export and share command in the registry. The navigator edits and locks the wording (plain language, no em-dashes). The policy text is part of the data contract: the Jev docs name literal reading as failure mode #1, so the boundary cases carry most of the accuracy.
- **D-03:** The policy stays independent of Larry's contract. It never quotes `agents/larry-extended.md`. It carries one sentence stating that irreversible is narrower than material (every irreversible step is material, not every material step is irreversible), and a builder test asserts that sentence exists.

### Answer key (SPEC R2, R4)
- **D-04:** Hybrid labeling. The navigator labels a risk subset blind, BEFORE seeing Claude's labels and before any Jev call. The subset is picked by a script that reads only the registry: every command that matches the keyword list, OR is one of the 65 not tagged `autonomous_safe`, OR has external verbs (send/share/export/upload/publish/deploy) in `teaching`/`jtbd_summary`, OR that Claude's pre-label calls irreversible. The navigator then reviews Claude's pre-labels for the rest. Estimated 30-35 min of navigator time.
- **D-05:** Label file: plain JSON, no plugin-runtime dependencies (a future Theo re-emission must be able to read it). Header: `{schema, labels_for: "data/command-registry.json", registry_hash, reviewed_by, reviewed_at, method, rows: [...]}`. Row: `{command, irreversible, reason, label_source}`, where `label_source` is one of `navigator-blind`, `claude-prelabel/navigator-confirmed`, `navigator-corrected`. The report states the blind-vs-Claude disagreement rate as a measure of LLM bias. The shape is offered for reuse by 354-17 and 357; do not write into their phase dirs.

### Shared Jev client (SPEC R8)
- **D-06:** Extract if missing. 356's first executable task checks for `scripts/jev-devtime-client.cjs`. If present, import it. If absent, 356 extracts it, and `build-section-command-ledger.cjs` imports it and re-exports the same names (`assertEgressCeiling`, `jev`, `pool`, `loadKey`), so `scripts/eval-icm-writers.cjs` and the test-353 tests stay byte-compatible. Before touching any file with uncommitted diffs from another session (test-353 files, `eval-icm-writers.cjs` at discuss time), check `git status` and message the owner first.
- **D-07:** Module interface (pure, no `lib/` requires, no plugin-path assumptions, so Theo could vendor or port it): `loadKey({env, secretsPath})`, `makeEgressGuard(profile)`, `jev(body, {key, guard, endpoint?, fetchImpl?, sleepImpl?})`, `pool(items, n, fn)`, `EGRESS_PROFILES` (frozen, keyed by builder).
- **D-08:** One guard file, one profile per builder, never a merged union. A union would widen 353's limits. `section_command_ledger` keeps 353's exact key sets and caps. `material_step_ledger` (356) allows state keys `{slug, teaching, jtbd_summary, policy}`, no candidates, its own length cap for `policy`, and requires the `policy` value to be byte-identical to the policy file. Any other key throws before fetch. 357 adds its own profile. Add the new module name to the tripwire leg that bans ledger builders from `hooks/`.
- **D-09 (Theo consult, 2026-09-23):** Theo has no Jev client or gateway code. It already pins the plugin's spike sources (`/home/jsagi/Theo/.planning/quick/260917-co6-*/260917-co6-PIN-LEDGER.md`). Theo's own egress design (Theo Phase 3, `03-MOS-LEARNING.md`) refuses a call carrying any field the tool did not ask for (refuse outright, never silently strip) and keeps its tool sets separate by construction. D-08 follows the same philosophy: per-profile, refuse-don't-strip, separated by construction. Keep the module's error shape compatible, a thrown error naming the disallowed key, so a future Theo-side port maps one-to-one.

### What Jev reads (SPEC R3, R7)
- **D-10:** Registry blurb only: `teaching` + `jtbd_summary`, about 70 tokens per command. Measured 2026-09-23: across all 48 `autonomous_safe: true` commands, the `commands/*.md` bodies added zero true positives. The export/snapshot/vault bodies contain advice lines ("deploy to Vercel") that would cause false alarms. `/mos:publish`'s blurb already names its external effect. `text_hash` covers slug + teaching + jtbd_summary only, so body edits never stale an entry, and Theo can re-emit from the registry JSON alone. The zero-miss threshold on the hand-labeled key is the safety net if a blurb ever hides an effect.

### Cross-cutting (navigator directive, 2026-09-23)
- **D-11 Parallel sessions:** Phase 354 (jsagi-25: 354-17 framework ledger, 354-18 THEO-04), 355 (jsagi-d9: Jev-through-Theo engines), 357 (jsagi-e0: gate-triad ledger plus larry-extended prose shrink). Commit only by explicit path, never `git add -A`, never stash or revert other sessions' diffs, re-read ROADMAP.md/STATE.md from disk before editing, and message owners before touching shared files (the test-353 family, the 353 builder).
- **D-12 Larry contract calibration:** The contract in `agents/larry-extended.md` lines 72-80 (validated by `tests/test-larry-handoff-seam.cjs`) holds unchanged: runChain halts at the first material step. 356 only makes more steps count as irreversible, and therefore as material. The plan must include a check that re-reads larry-extended at execute time. If 357 has landed its gate-prose shrink, confirm the halt semantics and the `forced_material` reason code are still described consistently, and that nothing in 356 or 357 redefines "material" as "irreversible". Flag this to jsagi-e0.
- **D-13 Optimized for Theo:** Every 356 artifact (policy JSON, label file, ledger JSON, client module) is plain data or pure functions readable without the plugin working tree, so a future Theo-side re-emission (the dependency-shape ruling: "scored once at dev time or in Theo's re-emission and SHIPPED AS DATA"; `docs/THEO-NOTIFY-CONTRACT.md`) can rebuild the ledger from pinned `data/` sources with Theo holding the one key.

### Post-research rulings (2026-09-23, after 356-RESEARCH.md)
- **D-01 amended:** `criteria` is the Noul-native object `{"true": "...", "false": "..."}`, not an array (live Jev docs, primitives/noul.md). Policy fields: `policy_id`, `version`, `instructions`, `criteria {true,false}`, `boundary_cases[]`. jsagi-e0 applied the same to 357 (357-CONTEXT D-11/D-12).
- **D-14 (navigator, final 2026-09-23): Jev judges, the navigator audits.** Every entry's `flag` = `p_irreversible >= T` (Jev's call), for every command. The navigator's answer key audits Jev: it sets T (zero misses on labeled-true rows, per D-15), and every disagreement is computed and recorded in the ledger (`false_alarms[]`: labeled-false commands with p >= T). **Appeal gate:** the build fails and writes nothing if any false alarm lands on a *chain-run command*, meaning a command that appears in `data/command-registry.json` `curated_chains` or is exercised as autonomous_safe by the chain suites (`tests/test-larry-handoff-seam.cjs`, `tests/test-chain-executor-*.cjs`). The builder computes that set from the registry plus a declared list in the builder, not by parsing tests at build time. On failure it prints each chain-run false alarm with its p and label for a navigator ruling: relabel it, or accept the flag and update the affected chain-test expectations in a follow-up. False alarms on commands that aren't chain-run ship as flagged (an extra halt costs one gate) and are reported. Note: no Jev call has been made yet, so false-alarm counts are unknown until the live build. An earlier draft of D-14 ("label wins") was superseded by this ruling in the same session.
- **D-15 threshold failure rule:** T = the highest value at which every labeled-true row has p >= T. The build fails loudly (writes nothing) if T <= 0, if there are zero labeled-true rows, if a labeled-true row has a missing p, or if T would flag every command. Ties at T count as flagged.
- **D-16 labeling order:** the navigator labels the blind subset BEFORE seeing Claude's policy draft or pre-labels (the draft's boundary cases are effectively Claude's labels for the riskiest commands). Claude's pre-labels are written sealed and revealed only after the blind sheet is committed. The blind sheet's commit time must precede the ledger's `built_at`.
- **D-17 frozen-test re-pin:** editing `isIrreversibleStep` necessarily changes its pinned hash in `tests/test-264-b3-frozen.cjs:108`. Change only its final `return false;` into a lazily loaded ledger call, and re-pin that one hash with a written reason. `makeGateFn` and `_isMaterialStep` stay byte-identical.
- **D-18 353 baselines:** the uncommitted diffs in `scripts/eval-icm-writers.cjs` and `tests/test-353-{grader-agreement,ledger-shape}.cjs` are unowned (jsagi-25, jsagi-d9 and jsagi-e0 each disclaim them). 356 never edits, stashes or reverts them. The builder extraction keeps the old export names and `jev(key, body)` argument order so those files need no edit. Record the `test-353-ledger-shape` baseline (13 pass / 6 fail) before any change.
- **D-19 shared client:** jsagi-25 amended 354-17 to extract-if-missing and import, with a `framework_command_ledger` profile. All three ledger phases now follow D-06. Whoever reaches the `test-353-tripwires.cjs` leg-2 ban first converts its regex to a named list constant, and the others append.

### Claude's Discretion
- Ledger file name under `data/` (proposed: `data/command-irreversibility-ledger.json`), the answer-key file location, and the hash encoding (SHA-256 hex).
- The builder's CLI flag names, beyond mirroring the 353 builder (`--check`, `--jev-fixture <path>`, default live build).
- How the runtime caches the ledger read (once per process is fine).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract
- `.planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-SPEC.md` - Locked requirements. MUST read before planning.
- `.planning/ROADMAP.md` (Phase 356 entry) - goal, locked constraints, dependencies

### Jev and prior evidence
- `.claude/skills/spike-findings-MindrianOS-Plugin/SKILL.md` and `references/` - Jev contract, latency and cost, dependency-shape ruling, IP egress ruling, stated-policy parity
- `.claude/skills/spike-findings-MindrianOS-Plugin/sources/002-jev-section-framework-ranker/fixture.json` - precedent: labels written before any Jev call
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-BRIEF.md` - Jev docs digest (Noul has no confidence; Noul and Choice not comparable; state size vs. accuracy). Read-only; owned by jsagi-d9.

### Code to reuse or change
- `scripts/build-section-command-ledger.cjs` - the dev-time builder pattern (loadKey ~l.70, EGRESS_ALLOWED_* ~l.85-87, assertEgressCeiling ~l.90, jev ~l.136, pool ~l.161, `--check` ~l.611, exports ~l.708)
- `lib/core/chain-executor.cjs` - `IRREVERSIBLE_HINTS` l.536, `isIrreversibleStep` l.546, `_isMaterialStep` l.570, callers l.792 / l.1083 / l.1411
- `lib/core/recipe-maps.cjs` l.172-181 - `postureForCommand`
- `data/command-registry.json` - the 113 commands (`teaching`, `jtbd_summary`, `autonomous_safe`)
- `scripts/eval-icm-writers.cjs`, `tests/test-353-*.cjs` - consumers of the 353 builder's exports (must stay compatible)

### Larry contract
- `agents/larry-extended.md` l.72-80 - the post-gate handoff contract
- `tests/test-larry-handoff-seam.cjs`, `tests/test-chain-executor-*.cjs` - must stay green

### Theo
- `docs/THEO-NOTIFY-CONTRACT.md` - Theo re-emission trigger
- `/home/jsagi/Theo/.planning/phases/03-egress-guard-catalog-separation/03-MOS-LEARNING.md` - Theo's refuse-don't-strip egress design (D-09)

### Project rules
- `CLAUDE.md` - Part 8, GSD enforcement, dev-research compositing (file findings in the phase dir AND the rethinking-mindrianos research trail)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/build-section-command-ledger.cjs`: key loading, egress ceiling, Jev fetch wrapper, concurrency pool, fixture mode, key-free `--check`. Extract, don't copy (D-06).
- `data/section-command-ledger.json`: the precedent shipped-ledger shape (build_mode, calibrated floor).

### Established Patterns
- Dev-time only: no file under `lib/` or `hooks/` may reference `api.typesafe.ai`, a Jev client, or `TYPESAFE_API_KEY` (test-353 tripwires).
- `--check` never rebuilds and never needs the key; it asserts shape and freshness and WARNs.
- The egress guard throws on any key outside the allow-list, before fetch.

### Integration Points
- `isIrreversibleStep(step)` is the single seam. It is add-only, reading the ledger by `step.command` with a hash check. Every caller (the gate, the fable-mode critique via `_isMaterialStep`, and the halt reasons) inherits the change without edits.

</code_context>

<specifics>
## Specific Ideas

- Measured baseline to report in the phase record: the keyword list matches 1 of 113 slugs (`/mos:publish`); blurbs average ~67 tokens and bodies ~2,450 tokens (max ~15,500).
- Boundary cases the policy must name: `/mos:export`, `/mos:snapshot`, `/mos:vault`, `/mos:present` write locally (reversible) even though their bodies advise the user to deploy or send. `/mos:publish` deploys (irreversible).

</specifics>

<deferred>
## Deferred Ideas

- Blurb plus filtered body lines as Jev input: revisit only if a hand label disagrees with its blurb verdict.
- Correcting `autonomous_safe` registry tags at the source, using ledger disagreements as evidence: a separate decision.
- The navigator's algorithm R&D briefing (https://mindrian-algorithm-rd.vercel.app/: five tier-1 discovery algorithms, three-signal convergence) belongs to Phase 355 and was forwarded to jsagi-d9 on 2026-09-23. It is not a 356 input.

</deferred>

---

*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Context gathered: 2026-09-23*
