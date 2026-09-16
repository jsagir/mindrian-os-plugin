# Phase 352 - Context (navigator rulings, locked 2026-09-16)

**Phase:** 352 - The self-healing install
**Source:** live `/mos:doctor` session 2026-09-16 (five hand-run invocations on installed beta.37) plus the navigator's three rulings in that session. This file is what `/gsd-discuss-phase` would have produced; the discussion already happened in the doctor session, so it is recorded here rather than re-asked.
**Evidence:** `.planning/debug/doctor-auto-heal-qa-sweep-2026-09-16.md` (kind: qa-sweep, 14 findings with lines), `352-EVIDENCE-doctor-all-json-2026-09-16.json`, `352-EVIDENCE-ui-compliance-json-2026-09-16.json`, `352-RESEARCH-GROUNDING.md`.

## Navigator rulings (verbatim intent, locked)

- R1. "Create a phase that fixes the doctor." -> every finding F1-F14 in the qa-sweep is in scope; none is deferred to prose.
- R2. "Make a harness that runs a full doctor --all and fixes all without the user ever asking, after any new install or update, by default." -> the auto-heal is ON by default, fires once per new version, zero navigator action. An opt-out may exist (env var), never an opt-in.
- R3. "Make sure UI works perfectly." -> `doctor --ui-compliance` must reach 0 on a scanner that counts only real violations; the 44 Zone-1/Zone-4 renderers are swept, not waived.
- R4. "Review the full JSON, then do the necessary research, then make the updated and installed version automate its own fix (statusline and all the rest) for any user." -> the JSON is filed as evidence; research (claude-code-guide, langtalks) is done and recorded; the acceptance is a fresh-user number, not a dev-machine number.
- R5. "Fix it phase way e2e and cut a beta." -> plan -> execute -> verify -> `scripts/release.sh` prerelease. Note: beta.41 was cut by a peer session on 2026-09-16 while this phase was being registered; this phase ships in the next beta after it.

## Decisions (D = locked, WD = working decision the planner may refine, OQ = open question the planner must answer first)

- D-352-1. Trigger is `SessionStart`. Grounded: no Claude Code hook fires on plugin install/update/enable/path-swap (claude-code-guide 2026-09-16, hooks.md). Matchers `startup|clear|compact` as the existing hooks use; `resume` and `fork` are excluded so a resumed session never re-fires.
- D-352-2. "New version" is decided by the accumulative engine's existing watermark `~/.mindrian/doctor-applied.json` (`applied_through`), compared to the running plugin.json version at the root `resolveActivePluginRoot()` returns. No second touch-file. The existing `~/.mindrian/post-update-restart-pending` path stays for `/mos:update` Step 7.
- D-352-3. Zero navigator action, by default. The heal runs, the watermark advances, one reward line is shown on the next turn via `additionalContext` (hook stdout is never shown to the user; exit 1-254 stderr is). Env opt-out `MINDRIAN_DOCTOR_AUTO_HEAL=0`, documented, never the default.
- D-352-4. Only `auto_heal: true` modules run unattended. New boolean in `data/doctor-modules.json`, mandatory for every `fix_supported: true` row, enforced by a new D-03 parity rule. Destructive or judgment fixes are `auto_heal: false` and surface as "needs your call" behind an F.1 gate. Initial classification: install-cache swap TRUE; cascade-rooms sentinel create (dir exists) TRUE; install-state record write TRUE; deployment-surfaces restamp TRUE; statusline restamp (class G/H) TRUE; graph-derive re-enqueue TRUE; room-md generate TRUE; legacy-clone remove FALSE; registry-ghost prune FALSE; marketplace cache prune FALSE.
- D-352-5. The LOCAL heal runs synchronously inside the hook budget (target under 6 s on this machine; measured `--all` minus brain-smoke is about 4 s). brain-smoke and eureka-smoke are detached (`spawn` + `unref`) and write `~/.mindrian/doctor-auto-heal-last.json`, which the next turn's echo reads. `async: true` hook semantics are undocumented upstream, so the design does not depend on them.
- D-352-6. Every `--all` render is truthful: no `undefined` ever printed; every non-skip `report.checks` row rendered; every `fix()` record carries `detail`; `--json` carries `summary` and `exit_code`. Tested by a hermetic test that greps the full output for the literal `undefined`.
- D-352-7. The post-fix re-check re-resolves from disk (F4) and a queued-not-derived room reads "queued" (F5). The harness acceptance for graph-derive is measured after the derive sweep runs, not after enqueue.
- D-352-8. UI scanner rules: `//` and `/* */` comment lines are never violations; a file whose declared `body_shape` is B may use `├─ └─ │ ─` as tree glyphs; `scripts/test-*.cjs` is a declared exclusion class (dev-only, never a user renderer). Everything else that prints to a terminal gets the 4-zone anatomy through the shared renderer.
- D-352-9. Tri-Polar: on Desktop and Cowork the MCP server boot (`lib/mcp`) runs the same LOCAL heal on first boot of a new version, and the reward line is the state echo. Stated call, not an oversight.
- D-352-10. Canon Part 8: the auto-heal opens no Brain write. brain-smoke stays diagnostic-only.
- WD-352-1. Reward line copy: `<glyph> doctor auto-heal on <version>: <n> fixed, <m> need your call (<ids>)`. Glyph is the white square when 0 need a call (getting out of the way), the black square when a gate follows.
- WD-352-2. F14 `mcp-surface`: demote to `info` (never counted as drift) OR re-base the budget from measured reality; planner decides, with the 265-RESEARCH R-7/R-8 note as input.
- WD-352-3. F14 `deprecated-usage`: retired names forward silently to the new command with a one-line note, OR the hint stays; planner decides against the 756-in-7-days number.
- WD-352-4. F13 registry ghosts: surface as "needs your call" with the two room slugs; never auto-prune.
- OQ-352-1. Does `resolveActivePluginRoot()` succeed inside a SessionStart hook on Windows Git Bash and on Cowork? Verify before D-352-1 is planned as universal.
- OQ-352-2. Which of the 44 Zone-1/Zone-4 renderers are genuinely user-facing terminal renderers versus build/dev scripts that print for a developer? The exclusion class in D-352-8 must be declared from an audit, not guessed.

## Out of scope (named so nobody re-litigates)

- Rewriting the accumulative engine to async (Phase 217 Pitfall 2 stands; class M/S stay carve-outs, they just report truthfully).
- Any Brain-side change. Theo is untouched.
- The `active=idem-room` active-room mismatch content itself (it is a room-state fact, surfaced as "needs your call", not fixed here).

## Consults (mandatory, per CLAUDE.md grounding rule)

- claude-code-guide: DONE 2026-09-16 (see 352-RESEARCH-GROUNDING.md).
- langtalks-graph-expert: DONE 2026-09-16 (relationship_path, get_entity; see grounding file).
- icm-architect: at plan time, for WD-352-4 and the sentinel rule.
- Context7: at plan time, for F12 (Node 22 warning suppression form).
