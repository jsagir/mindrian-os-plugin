---
status: diagnosed
kind: rca
trigger: "statusline-active-room-leah-gap"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: local-only
canon_parts: []
created: 2026-07-22T21:25:00Z
updated: 2026-07-23T00:40:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

VERDICT (2026-07-23, diagnose-only): COMPOSITE -- **SURFACE-GAP (primary) + MISAPPLIED (confirmed co-defect on the CLI path)**. REGRESSED and pure-WORKING are ruled out with evidence (see Eliminated). The April fix did not help Leah for two independently-confirmed reasons, and the verdict does NOT depend on resolving which surface Leah's session ran on -- both branches lead to a confirmed gap:

- SURFACE-GAP (primary): the whole feature reaches ONLY Claude Code CLI. It is wired via `settings.json` `statusLine.command` (a Claude Code terminal-only setting) and deployed to `$HOME/.claude/settings.json` + `$HOME/.claude/statusline-mos` per `data/deployment-surfaces.json`. There is NO Desktop or Cowork always-visible "which room" surface -- `docs/STATUSLINE-CONTRACT.md` never once mentions Desktop or Cowork; it is a CLI-only artifact. If Leah/interns were on Desktop or Cowork, the feature literally cannot have reached them, working or not. Largest blast radius: every Desktop/Cowork user.
- MISAPPLIED (co-defect, CLI path): Phase 94-01 built a READ contract for `current_room` in STATE.md frontmatter -- but NOTHING writes that field. Zero of 22 real `~/MindrianRooms/*/STATE.md` files carry `current_room`; the dev repo's own `.planning/STATE.md` does not either (it is GSD phase-tracking frontmatter: milestone/status/progress, no `current_room`); and grep finds NO write surface anywhere in `lib/ scripts/ commands/ skills/` (the folder-memory docstring's claim that "the /mos:rooms skill emits it every time" is aspirational/unwired). So the "canonical source of truth" the April fix established is DORMANT in the field. The CLI room chip still renders a name only because `scripts/context-monitor` falls back past the empty `getCurrentRoom()` to the registry active slug, then to the directory basename. The feature "works" on CLI by accident of its fallback, not via the mechanism it claims.

next_action: none in this session (diagnose-only; HARD RULE = statusline changes co-designed with the navigator, never solo-picked). Bring the Non-Code Follow-ups options menu below to a follow-up conversation with Jonathan.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.37 (current session)
- Reported by: Jonathan Sagir (live session), spawned via /gsd-debug per the navigator's explicit "Investigate why it didn't help Leah" choice
- Date first observed: 2026-07-22 (Leah's email); the underlying feature dates to Phase 94-01, 2026-04-28
- Related debug sessions: none yet directly; the Phase 94-01 fix itself was for a Lawrence Aronhime reproducer ("look at the bottom. It still says core power"), same complaint class, different person, three months earlier

## Problem Statement

Leah Aronhime asked for a statusline room indicator ("show what room you're in at the bottom, where it currently shows the version") that appears to already exist (Phase 94-01, shipped April 2026, built for her father Lawrence's identical complaint) -- need to determine why it did not answer her need before any new design work happens, per this repo's hard rule that statusline changes are co-designed with the navigator, never solo-picked.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: a navigator opening a session against an existing Data Room sees which room is active without asking or being told wrong information; per Phase 94-01, the CLI statusline should render the current room's slug at all times, read fresh from STATE.md's current_room field every render cycle (no caching), per the shipped fix's own test suite.
actual: unclear -- this is an investigation task, not a reproduced crash. Leah's session (quoted in her 2026-07-22T14:37:54Z email) concluded the room "teaching-fall-2026" was orphaned/never built based on a room-registry entry lacking a `path` field (a SEPARATE, already-filed root cause -- see .planning/debug/harden-room-registry... sibling quick task), and separately asked in a follow-up email for a visible room indicator "where it currently shows the version" -- implying she did not see, or did not recognize, any existing room indicator during that session.
errors: none reported directly related to the statusline itself; Leah's email names only the room-registry orphan misdiagnosis and the room-bind card mis-firing (both filed as separate, already-actioned findings this session).
reproduction:
  1. Confirm which surface (CLI / Desktop / Cowork) Leah's 2026-07-22 session ran on (her transcript quotes "Called plugin:mos:mindrian-brain" and Stop-hook block messages, both CLI-shaped output -- but confirm, do not assume).
  2. If CLI: reproduce a fresh CLI session against a real room and observe whether scripts/statusline-mos-dispatch actually renders current_room today.
  3. If Desktop/Cowork: confirm definitively there is no equivalent "which room" surface on those two, independent of whether the CLI mechanism itself works.
started: the underlying feature is 3 months old (April 2026); Leah's report is 2026-07-22. Unknown yet whether this is a fresh regression or a pre-existing gap in what the April fix actually covers.

## Scope and Impact

- Affected surfaces: cli (primary Phase 94-01 target), desktop, cowork (need to confirm zero equivalent exists)
- Affected commands: n/a (ambient statusline render, not a command)
- Affected users: anyone unsure which room/venture they are currently working in -- named twice independently this week (Leah, and via Lawrence "I heard from the interns that figuring out which room you were in was a problem as well")
- Version range: unknown yet whether regressed since Phase 94-01 (beta-era unspecified) through current 1.15.3-beta.37
- Severity: medium -- a UX/trust gap (matches a real recurring multi-person complaint), not a crash or data-loss risk
- Blast radius: if MISAPPLIED or SURFACE-GAP, this affects every Desktop/Cowork user and every real MindrianRooms Data Room session, a much larger blast radius than a single dev-repo bug

## Eliminated

- **REGRESSED -- RULED OUT.** The Phase 94-01 regression suite (`lib/memory/statusline-active-room.test.cjs`, 8 cases incl. the Lawrence "no stale cache" reproducer) runs GREEN today: `8/8 tests passed`, exit 0. The `getCurrentRoom()` read contract (STATE.md `current_room` -> `parseCurrentRoomField` -> `{slug, path, source:'state_md'}`, quote/whitespace-stripped, null on every failure mode) behaves exactly as shipped in April. Nothing about the read path has broken since. Leah's gap is NOT a regression.
- **WORKING (pure "feature fine, just attention") -- RULED OUT as the sole cause, retained only as a CLI sub-case.** On CLI a room chip DOES render, so a CLI navigator is not shown nothing. But it renders from the FALLBACK (registry active slug / dir basename), not from the April "canonical" `current_room` source, and it is a low-prominence Tier-2 orientation chip (`📂 <room>`, "Trigger ONLY when degraded" per `docs/STATUSLINE-CONTRACT.md`). So "working" cannot by itself explain Leah asking for a room indicator "where it shows the version" -- either she was off-CLI (SURFACE-GAP) or the chip was too legibly quiet to register (a real but lightweight UX-legibility sub-issue, still a navigator decision, not a solo fix). Pure-WORKING is insufficient; it survives only as the CLI-attention footnote.
- **MISAPPLIED -- CONFIRMED (see Verdict + Technical Root Cause), not eliminated.** Note the refinement vs the original framing: it is NOT that `current_room` is a "dev-repo-only GSD convention." The dev repo does not use it either. It is a read contract with NO producer anywhere. Broader and worse than the hypothesis.
- **SURFACE-GAP -- CONFIRMED (primary), not eliminated.** statusLine is Claude-Code-CLI-only by construction; no Desktop/Cowork analog exists or is documented.

## Evidence

- timestamp: 2026-07-22T21:24:00Z
  checked: `hooks/hooks.json` for the statusline hook wiring.
  found: `scripts/statusline-mos-dispatch` is registered as the live statusline hook script. Claude Code's `statusLine` hook type is a CLI-terminal-only mechanism.
  implication: whatever this hook renders can, by construction, only ever reach a CLI session. If Leah/interns were on Desktop or Cowork, this feature literally cannot have reached them, regardless of whether it works correctly.
- timestamp: 2026-07-22T21:23:00Z
  checked: `lib/memory/statusline-active-room.test.cjs` header comment (Phase 94-01).
  found: the canonical read path is documented as STATE.md frontmatter `current_room` -> `lib/core/folder-memory.cjs getCurrentRoom()` -> `scripts/context-monitor`, built for a Lawrence Aronhime reproducer dated 2026-04-28 ("look at the bottom. It still says core power"), with 8 regression test cases already in place.
  implication: this is a real, tested, previously-shipped feature answering the exact same user need Leah is now describing -- worth confirming it is not the SAME unfixed gap resurfacing, and worth confirming what "STATE.md" means in a real user Data Room vs this dev repo.

- timestamp: 2026-07-23T00:30:00Z
  checked: ran the Phase 94-01 regression suite `node lib/memory/statusline-active-room.test.cjs`.
  found: `statusline-active-room: 8/8 tests passed`, exit 0. All 8 cases (missing STATE.md, no frontmatter, absent key, happy triple, malformed YAML, Lawrence no-cache reproducer, quote/whitespace stripping, end-to-end context-monitor render) pass.
  implication: the read contract is not regressed. Rules out REGRESSED.
- timestamp: 2026-07-23T00:32:00Z
  checked: `grep -rl current_room ~/MindrianRooms/*/STATE.md` across all real Data Rooms, and `grep -c current_room .planning/STATE.md` in the dev repo.
  found: 22 real rooms have a root `STATE.md`; ZERO carry a `current_room` field. The dev repo's own `.planning/STATE.md` also has ZERO `current_room` (its frontmatter is GSD phase-tracking: `milestone`, `status`, `stopped_at`, `progress` -- no room pointer).
  implication: the field Phase 94-01 reads as "canonical source of truth" is populated NOWHERE in the field. Not even a dev-repo GSD convention -- it is simply unwritten. This is the MISAPPLIED core.
- timestamp: 2026-07-23T00:34:00Z
  checked: write-side grep for `current_room:` across `lib/ scripts/ commands/ skills/` (excluding tests/reads/comments); and `scripts/context-monitor` room-name resolution (lines ~656-731).
  found: NO write surface for `current_room` exists anywhere (the folder-memory docstring's "the /mos:rooms skill emits it every time" is unwired). context-monitor sources `roomName` as: (1) `getCurrentRoom(dir).slug` [always empty in real rooms], else (2) registry `reg.rooms[reg.active].name || reg.active`, else (3) `path.basename(dir)`. The rendered `📂 <room>` chip therefore comes from the registry/basename fallback in practice, never from the April canonical source.
  implication: on CLI the feature "works" only by accident of its fallback chain; its designated mechanism is dead. Confirms MISAPPLIED and explains why nobody noticed (a name still shows).
- timestamp: 2026-07-23T00:36:00Z
  checked: `settings.json` statusLine wiring, `data/deployment-surfaces.json`, and `docs/STATUSLINE-CONTRACT.md` for any Desktop/Cowork surface.
  found: statusLine is `{"type":"command","command":"bash ${CLAUDE_PLUGIN_ROOT}/scripts/statusline-mos"}` -- a Claude Code CLI terminal setting, deployed to `$HOME/.claude/settings.json` + `$HOME/.claude/statusline-mos` per deployment-surfaces.json. `docs/STATUSLINE-CONTRACT.md` (the navigator-LOCKED co-design) never mentions Desktop or Cowork at all -- it is a CLI-only artifact. No Desktop/Cowork always-visible "which room" surface exists.
  implication: the feature reaches ONLY CLI by construction. Confirms SURFACE-GAP (primary). If Leah/interns were on Desktop or Cowork, Phase 94-01 could not have reached them regardless of correctness.
- timestamp: 2026-07-23T00:38:00Z
  checked: sibling prior-resolved session `.planning/debug/resolved/intern-w1-statusline-room-mismatch.md` (interns week-1, same complaint class, 2026-07-11/12).
  found: independently reached the same "content is a faithful mechanical read of STATE.md `current_room`, falls back to `path.basename(dir)` when absent" conclusion, and separately documented a Class-H self-heal defect that could blank the CLI statusline entirely on marketplace-cache installs (since fixed). Confirms the room-name path and shows a second, orthogonal way the CLI line can go blank.
  implication: corroborates the render source from a different investigation and flags that "the interns couldn't tell which room" (Lawrence's second-hand report) has a prior confirmed root cause of its own -- reinforcing that this is a recurring multi-person surface/legibility gap, not a one-off.

## Technical Root Cause

**Composite -- two independently-confirmed defects, either of which alone explains "the April fix did not answer Leah."**

**(1) SURFACE-GAP (primary).** The active-room indicator is a Claude Code CLI statusLine feature and nothing else. It is wired via `settings.json` `statusLine.command` (a terminal-only Claude Code setting) and deployed only to `$HOME/.claude/settings.json` + `$HOME/.claude/statusline-mos`. Claude Desktop and Cowork have no `statusLine` mechanism and no equivalent always-visible "which room" surface, and the navigator-LOCKED `docs/STATUSLINE-CONTRACT.md` never contemplates them. So for any Desktop or Cowork session -- the most likely case for Leah, a conversational non-CLI user like her father -- the feature cannot reach her at all. Blast radius: every Desktop and Cowork user.

**(2) MISAPPLIED (confirmed co-defect, CLI path).** Phase 94-01 anchored a READ contract -- STATE.md frontmatter `current_room` -> `getCurrentRoom()` -> `context-monitor` -- and proved it with 8 green tests. But NOTHING writes `current_room`: not the `/mos:rooms` skill (no write surface exists in `lib/ scripts/ commands/ skills/`), not any of the 22 real `~/MindrianRooms/*/STATE.md`, not even the dev repo's own `.planning/STATE.md`. The "canonical source of truth" is therefore dormant everywhere in the field. The CLI room chip renders a name only because `scripts/context-monitor` falls back past the always-empty `getCurrentRoom()` to the `.rooms/registry.json` active slug, then to the directory basename. The April fix shipped and tested the read half of a contract whose write half was never built, so on CLI the feature is alive only through its fallback, and the mechanism Lawrence's reproducer was told fixed his complaint is effectively dead.

**Residual unknown (does not change the verdict):** Leah's exact surface (CLI vs Desktop/Cowork) is not confirmable from this repo -- her transcript is not here. It does not matter: if Desktop/Cowork, defect (1) is the cause; if CLI, defect (2) plus the low-prominence Tier-2 chip legibility is the cause. Both branches are confirmed gaps.

## Required Code Changes

None applied (diagnose-only, `find_root_cause_only`). HARD RULE: statusline changes are co-designed with the navigator (Jonathan), never solo-picked (`feedback_121_5_statusline_co_design`; `docs/STATUSLINE-CONTRACT.md` is navigator-LOCKED). The options below are for a follow-up co-design conversation, not a solo fix.

## Tests to Add or Update

None yet -- deferred until a direction is chosen with the navigator. The existing Phase 94-01 suite stays green and stays as the read-contract fence. If a `current_room` write surface is built (Option B below), it needs its own write-side test proving `/mos:rooms` switch updates the field in a real room STATE.md (the currently-missing half of the contract).

## Non-Code Follow-ups

Verdict is COMPOSITE (SURFACE-GAP primary + MISAPPLIED co-defect). Bring these FOUR options to the navigator co-design conversation -- they are not mutually exclusive; A+D together are the smallest honest step, B is the real fix for the CLI mechanism, C is the largest-blast-radius item:

- **Option A -- Confirm Leah's surface first (cheapest, do this first).** Ask which surface her 2026-07-22 session ran on. If Desktop/Cowork, the answer to her request is "there is no room indicator there yet" (Option C), not "it exists, look harder." This one fact routes the whole conversation and costs one question.
- **Option B -- Wire the missing `current_room` WRITE half (fixes MISAPPLIED on CLI).** Make `/mos:rooms` (create/switch) write `current_room` into the active room's STATE.md frontmatter, so the CLI chip renders from the tracked active room instead of accidentally-correct folder/registry fallback. Small, contained, testable; makes the April "canonical source" actually canonical. Decision needed: is the registry-active-slug fallback "good enough" (then close MISAPPLIED as WONTFIX and just document the fallback as the real contract), or do we want the STATE.md field to be the truth?
- **Option C -- The Desktop/Cowork "which room" surface (the real SURFACE-GAP, largest blast radius).** statusLine has no Desktop/Cowork analog. A genuine new design conversation: what is the always-visible room-orientation surface on the two conversational surfaces (e.g. a pinned room header line Larry emits, a `00_Context/` room banner in Cowork, a first-turn "you are in <room>" affordance)? This is the item that would actually answer Leah and the interns, and it MUST be co-designed -- do not solo-pick.
- **Option D -- CLI legibility of the existing Tier-2 chip (lightweight UX).** Even on CLI the `📂 <room>` chip is a low-prominence, "trigger-only-when-degraded" orientation cue. If a CLI navigator still asks "which room am I in," the chip may be too quiet. Possible: promote room prominence, or echo the active room on session-start / room-switch as a one-line confirmation. Navigator decision; honors `docs/STATUSLINE-CONTRACT.md` tiers, does not re-open the locked hierarchy.

Cross-refs: sibling prior-resolved `intern-w1-statusline-room-mismatch.md` (same complaint class, interns, CLI blank-statusline Class-H self-heal defect already fixed) and its `intern-w1-rooms-new-silent-fail.md` sibling (the registry `path`-field orphan, separately filed this session). The recurring multi-person pattern (Lawrence Apr, interns Jul, Leah Jul) is itself the strongest argument for Option C.
