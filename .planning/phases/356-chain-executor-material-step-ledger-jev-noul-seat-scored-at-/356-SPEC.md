# Phase 356: Chain-executor irreversibility ledger (Jev Noul, scored at dev time, shipped as data) - Specification

**Created:** 2026-09-23
**Ambiguity score:** 0.185 (gate: <= 0.20)
**Requirements:** 8 locked

## Goal

`isIrreversibleStep` in `lib/core/chain-executor.cjs` changes from a 7-keyword substring match to "keyword match OR explicit flag OR a fresh dev-time ledger entry that marks the command irreversible". The ledger is scored once per registry command by a Jev Noul carrying a written policy, and it misses zero of the commands hand-labeled irreversible.

## Background

- `data/command-registry.json` holds 113 commands. Each carries a hand-authored `autonomous_safe` flag (48 true, 65 false), joined at runtime through `recipe-maps.postureForCommand` (`lib/core/recipe-maps.cjs:172-181`).
- `isIrreversibleStep` (`chain-executor.cjs:546-555`) forces a halt when `step.irreversible === true` or the step's command slug contains one of `IRREVERSIBLE_HINTS` (`:536-544`: email, deploy, publish, send, release, external-write, external_write). A forced-irreversible step halts regardless of posture (EXEC-03, D-166-05). Callers: `:792`, `:1083`, `:1411`, and via `_isMaterialStep` at `:571`.
- Measured 2026-09-23: across all 113 registry commands, the keyword list matches exactly one slug (`/mos:publish`, already `autonomous_safe: false`). The keyword check sees slugs only, never what a command does. The real exposure is a command tagged `autonomous_safe: true` whose behavior is irreversible. Nothing detects that today.
- "Material" (`_isMaterialStep`, `:570-578`, which decides whether the self-critique runs) and "irreversible" (which forces a halt) are different predicates. This phase touches only the irreversible one.
- Pattern to reuse: `scripts/build-section-command-ledger.cjs` (Phase 353). It scores at dev time with Jev and ships `data/section-command-ledger.json`. It has an egress ceiling asserted before every fetch, reads the key only from `~/.secrets/typesafe.env` or the environment, offers a `--jev-fixture` keyless mode, and has a key-free `--check`. A tripwire keeps any Jev or `api.typesafe.ai` reference out of `lib/` and `hooks/`.
- Jev facts (355-BRIEF.md, live docs): a Noul returns a probability with no separate confidence value. A Noul and a Choice on the same question are not comparable. Spike 004's 64/64 at 0.90 was a Choice (Eureka verdict) and does not transfer.

## Requirements

1. **Written policy**: A plugin-authored irreversibility policy defines the judgment in words.
   - Current: None exists. Irreversibility is implied by 7 keywords.
   - Target: One policy text defines irreversible as "running the command takes an effect outside the machine or outside the user's control that the room's own history cannot undo": send, email, publish, deploy, share or upload to a third party, external write. It lists local room writes as NOT irreversible, and it names boundary cases explicitly (for example, export to a local file = reversible; export that uploads = irreversible). The Noul's instructions and criteria carry this text verbatim.
   - Acceptance: The policy file exists. The builder's outgoing Noul payload contains the policy text byte-identical to the file (asserted in a keyless fixture-mode test).

2. **Hand-labeled answer key**: Every registry command has a human-reviewed irreversible yes/no label.
   - Current: No labels exist.
   - Target: A fixture labels all 113 commands (the full `commands` array at build time) `irreversible: true|false`, each with a one-line reason, reviewed by the navigator before thresholds are tuned.
   - Acceptance: The fixture's command set equals the registry's command set exactly (no missing, no extra), checked by a test. The review is recorded (reviewer + date in the fixture header).

3. **Dev-time builder**: A build script scores every registry command once with one Jev Noul each and writes a ledger file.
   - Current: No irreversibility ledger or builder exists.
   - Target: A `scripts/` builder writes a `data/` ledger with one entry per command: `command`, `p_irreversible`, `flag` (bool at the tuned threshold), and `text_hash` (hash of the exact text that was scored). Top-level fields: `threshold`, `false_alarm_count`, `built_at`, `policy_hash`, `build_mode`.
   - Acceptance: A live or fixture-mode build produces an entry for every one of the 113 commands. Every entry carries all four fields. `build_mode` is recorded.

4. **Zero-miss threshold**: The shipped threshold misses no labeled-irreversible command.
   - Current: Not applicable.
   - Target: The threshold T is the highest value at which every fixture-labeled irreversible command has `p_irreversible >= T`. The false-alarm count at T (reversible-labeled commands flagged) is recorded in the ledger and reported.
   - Acceptance: Against the answer key, recall on `irreversible: true` labels = 1.0 (0 misses). `false_alarm_count` in the ledger equals the recomputed count. If no T achieves zero misses, the build fails loudly rather than shipping.

5. **Runtime integration, add-only**: The ledger can only force irreversible. It can never clear a keyword or flag signal.
   - Current: `isIrreversibleStep` = `step.irreversible === true` OR keyword substring.
   - Target: `isIrreversibleStep` = `step.irreversible === true` OR keyword substring OR (the ledger entry for `step.command` has `flag: true` AND its `text_hash` matches the current registry text for that command). The ledger is read from local disk with zero network calls. A missing or unreadable ledger degrades silently to today's behavior.
   - Acceptance: (a) A command with a fresh `flag: true` entry halts in `runChain` with reason `forced_material`, even when the registry says `autonomous_safe: true`. (b) `/mos:publish` still halts when its ledger entry says `flag: false`. (c) With the ledger file deleted, all existing chain-executor tests pass unchanged. (d) No file under `lib/` or `hooks/` references `api.typesafe.ai`, a Jev client, or `TYPESAFE_API_KEY` (existing tripwire stays green).

6. **Staleness fallback**: A changed or new registry command never runs on a stale ledger verdict.
   - Current: Not applicable.
   - Target: Runtime ignores an entry whose `text_hash` does not match, or that doesn't exist, and falls back to keyword + flag. A key-free `--check` mode lists unscored and stale commands and exits 0 with WARN (never a release blocker, never needs the key).
   - Acceptance: Editing one command's scored text in a test registry makes runtime ignore its entry and makes `--check` print it as stale. Adding a command makes `--check` print it as unscored. `--check` makes zero network calls.

7. **Egress and key discipline (Part 8)**: Only plugin-authored, generic text crosses to Jev.
   - Current: The section ledger enforces an egress ceiling for its own keys.
   - Target: Each Noul's state is limited to the command slug, its registry `teaching` and `jtbd_summary` text, and the policy text. No room content, user text, or artifact ids, asserted by an allow-list check before every fetch. The key is read only at build time from `~/.secrets/typesafe.env` or the environment, never printed, never shipped.
   - Acceptance: A fixture-mode test that injects a forbidden key (for example `room_path`) into the state makes the builder throw before any fetch. `grep` finds no key material in `data/` or the ledger.

8. **One shared Jev client**: The builder reuses the dev-time Jev client and egress guard rather than forking them.
   - Current: The client and `assertEgressCeiling` live inside `build-section-command-ledger.cjs`.
   - Target: Per the cross-session agreement with jsagi-e0 (357): whichever of 354-17, 356 or 357 executes first extracts the Jev client and egress guard into one `scripts/` module (never `lib/`). The other builders import it and add their own allowed keys to the shared allow-list. 356's builder imports that module.
   - Acceptance: 356's builder contains no copy of the fetch wrapper or the egress guard (it imports them). `build-section-command-ledger.cjs` still passes its own tests after any extraction.

## Boundaries

**In scope:**
- Written irreversibility policy text
- Hand-labeled 113-command answer key, reviewed by the navigator
- Dev-time builder script with live, fixture and `--check` modes
- Shipped ledger data file with per-entry hash, threshold and false-alarm count
- Add-only change to `isIrreversibleStep` with the hash-checked, local-only ledger read
- Tests for zero-miss, add-only, staleness, egress refusal and ledger-absent degradation
- Extracting the shared Jev client module, if 356 executes before 354-17 and 357

**Out of scope:**
- Rewriting `autonomous_safe` tags in `data/command-registry.json` - the ledger forces halts at runtime; correcting registry tags at the source is a separate decision
- Argument-level irreversibility (the same command being safe with some args, not others) - stays with the keyword check and `step.irreversible`, per the navigator ruling
- Any live per-step Jev call, or any plugin-to-Theo-to-Jev gateway - navigator ruling 2026-09-23 (dev-time only)
- The "material" predicate that gates self-critique (`_isMaterialStep`'s posture branch) - a different seat with different stakes
- `/mos:ignite`'s explicit `irreversible: true` birth steps - explicit flags already win and stay untouched
- The 354-17 framework-command ledger and the 357 gate-triad ledger - owned by other sessions; only the shared-client agreement couples them

## Constraints

- The GUIDED-default safe-halt contract of `runChain` is unchanged. `tests/test-larry-handoff-seam.cjs` and every `tests/test-chain-executor-*.cjs` stay green.
- Runtime path: zero network calls, no added latency beyond one cached local JSON read.
- Noul thresholds are tuned only on this phase's answer key. Nothing is borrowed from spike 004. No Noul and Choice are compared on the same question.
- Dev-research compositing (CLAUDE.md): findings are filed in the phase dir AND in the `rethinking-mindrianos` research trail.
- No em-dashes in any shipped file. CJS only, no new npm dependencies, native `fetch` (Node >= 22.16).

## Acceptance Criteria

- [ ] Policy file exists and appears byte-identical in the outgoing Noul payload (fixture-mode test)
- [ ] Answer key covers exactly the registry's command set, with a reviewer and date recorded
- [ ] Ledger has 113 entries, each with `command`, `p_irreversible`, `flag`, `text_hash`
- [ ] Recall on hand-labeled irreversible commands = 1.0 at the shipped threshold; `false_alarm_count` recorded and matching
- [ ] Build fails when no threshold reaches zero misses
- [ ] A fresh `flag: true` entry forces a `forced_material` halt on an `autonomous_safe: true` command
- [ ] `/mos:publish` still halts with a `flag: false` ledger entry (add-only)
- [ ] Deleting the ledger leaves all existing chain-executor tests green
- [ ] Stale-hash and unscored commands are ignored at runtime and listed by a key-free, zero-network `--check` that exits 0
- [ ] Builder throws before fetch on a forbidden state key
- [ ] No `lib/` or `hooks/` reference to `api.typesafe.ai`, a Jev client, or `TYPESAFE_API_KEY`
- [ ] 356 builder imports the shared Jev client and egress guard (no local copies)
- [ ] `tests/test-larry-handoff-seam.cjs` passes

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes |
|--------------------|-------|------|--------|-------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Irreversibility, all 113, runtime add-only |
| Boundary Clarity   | 0.75  | 0.70 | ✓      | Registry-tag rewrites and ignite flags placed out of scope without a dedicated round |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Dev-time only, Part 8, shared client |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | Zero-miss bar on full 113; false-alarm cap value not fixed (recorded, not gated) |
| **Ambiguity**      | 0.185 | <=0.20| ✓     | |

Open for discuss-phase (how, not what): ledger and fixture file names; the hash algorithm; whether a false-alarm cap becomes a gate; where the policy text lives (`data/` vs `references/`).

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 0 | Researcher (scout) | What exists today? | Keywords match 1 of 113 slugs; the real gap is an `autonomous_safe: true` command that is behaviorally irreversible; material and irreversible are distinct predicates |
| 1 | Researcher | What does the ledger judge? | Irreversibility, all 113 commands |
| 1 | Researcher | What happens on disagreement with the registry? | Runtime forces halt (add-only) |
| 1 | Researcher | Definition of irreversible? | External effects only; local room writes are reversible |
| 2 | Simplifier | Accuracy bar? | Zero misses on a full 113-command hand-labeled key; false alarms allowed and recorded |
| 2 | Simplifier | Staleness? | Per-entry text hash; stale or missing entries fall back to keywords; key-free `--check` WARNs |
| - | Cross-session | Shared tooling | One `scripts/` Jev client + egress allow-list across 354-17 / 356 / 357 (agreed with jsagi-e0; jsagi-25 owns 354-17 and has not yet confirmed) |

---

*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Spec created: 2026-09-23*
*Next step: /gsd-discuss-phase 356 - implementation decisions (file names, hash, policy location, shared-client extraction order)*
