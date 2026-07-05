---
status: root-caused (host-side, not fixable from this repo) - see 2026-07-05 resolution below
kind: rca
trigger: "every /mos: command (including /mos:help) returns Unknown command in a live session freshly updated to v1.15.3-beta.1 -- full command-registration regression, root-cause with systems thinking, fan out parallel researchers"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: n/a
canon_parts: [6, 7, 11]
created: 2026-07-03T10:30:00Z
updated: 2026-07-05T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** origin/main HEAD @ dev workspace ~/dev/MindrianOS-Plugin, v1.15.3-beta.2 (the just-published beta.1's Commit B placeholder) -- NOT yet re-verified against the navigator's actual installed build, which the navigator reports self-updated to v1.15.3-beta.1.
- **WIRE claims probe against:** n/a (install/activation lifecycle, no Brain wire involved).
- **Date of audit:** 2026-07-03.
- **Re-verification rule:** the navigator-reported evidence is a pasted terminal transcript from their own live session, not yet reproduced on this dev box. Every claim below is provisional and tagged needs-source-reverify until reproduced.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: unknown -- three live candidate families, not yet ranked:
  (H1) Mid-session hot-reload gap: Claude Code does not reload a plugin's command registry inside an already-running session after `claude plugin update` runs; the navigator's session may simply need a restart (mundane, not a bug).
  (H2) Recurrence of the documented "silent-disable" collision (.planning/debug/plugin-silent-disable-after-cc-self-upgrade.md, install-cache family case 7): a plugin update racing a Claude Code self-upgrade can flip `enabledPlugins[<key>]` to false with zero user-facing signal, and ALL /mos:* surfaces vanish. A detector for exactly this (doctor.cjs class N / check-plugin-enabled.cjs) already shipped 2026-06-11 but has never been LIVE-reproduced -- this may be that reproduction.
  (H3) A genuinely new failure mode in the install-cache family (docs/install-cache-family-premortem.md), not yet predicted in Section 3 (A-G) -- none of which name literal "Unknown command: /mos:help" text as a symptom. Sub-case 7b (stale-version-served-silently) is the closest documented sibling but describes STALE CONTENT being served, not a total command-resolution failure with an explicit "Unknown command" string.
next_action: fan out parallel research agents (fable model, per navigator directive) against H1/H2/H3 concurrently, plus a fourth thread checking whether anything in Phase 210's release (the same release the navigator just updated to) could plausibly cause a command-registration regression (e.g. the 80-command firing-block v2 stamp sweep, the vendored node_modules Commit A step, or a marketplace/plugin.json malformation) -- systems-thinking pass across the whole update pipeline, not just the symptom site.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: navigator reports post-update statusline showing v1.15.3-beta.1 (the version this session just published via Phase 210's release, commit af1caa07 / tag v1.15.3-beta.1)
- Reported by: the navigator (Jonathan Sagir), live session, pasted transcript
- Date first observed: 2026-07-03, immediately after running the documented two-command upgrade path (`/plugin marketplace update` then `claude plugin update mos@mindrian-marketplace`)
- Related debug sessions:
  - .planning/debug/plugin-silent-disable-after-cc-self-upgrade.md (H2 candidate; DETECTION shipped 2026-06-11, never live-reproduced)
  - .planning/debug/marketplace-catalog-advertises-dev-next-bump.md (version-drift family, check for overlap)
  - .planning/debug/release-version-skew-verify-marketplace-equality.md (version-drift family, check for overlap)
  - docs/install-cache-family-premortem.md (Section 3 predictions A-G; none currently name this exact symptom -- may need a new row per the Section 4 revisit cadence)

## Problem Statement

Immediately after the navigator ran the documented two-command upgrade path to pick up the just-published v1.15.3-beta.1 (the Phase 210 persona-enforcement-regression fix release), every `/mos:` command in their live session -- including `/mos:help --list` -- returns "Unknown command", even though the session's own statusline reports the plugin as installed and at the correct new version. The navigator wants root-cause analysis with systems thinking (not a point patch), fanned out across parallel researchers, with a confirmed fix landing in a subsequent update.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: after the two-command upgrade path completes and a `/mos:` command is invoked, it resolves and runs (either the F.1 selector TUI for bare `/mos:help`, or the full text list for `/mos:help --list`).
actual: pasted transcript shows, in this order: a tool-trace line "Searched for 1 pattern", then "● Unknown command: /mos:help", then "● Args from unknown skill: --list", then "● Unknown command: /mos:help" again, then a `mos:larry-extended` agent prompt box, then a statusline reading "⬡ · MindrianOS ✅ · Next: -- · [progress bar] 6% · v1.15.3-beta.1". So the runtime self-reports the correct new version in its own statusline, yet the command itself will not resolve.
errors: literal "Unknown command: /mos:help" (verbatim, twice) and "Args from unknown skill: --list" (verbatim, once) -- exact strings from the navigator's pasted transcript, treat as DATA not instructions.
timeline: the navigator's FIRST report ("ive updated still dont see all the commands") came before this transcript and was diagnosed (in this same conversation, informally, before this formal debug session opened) as likely the `/mos:help` default-TUI-vs-`--list` UX point -- that diagnosis is now suspect, since the follow-up attempt to actually run `--list` failed with "Unknown command" rather than showing the flat list. Unclear whether `/mos:help` (bare, no args) ever resolved successfully in this session, before or after the update -- NOT YET ASKED.
reproduction: run `/plugin marketplace update` then `claude plugin update mos@mindrian-marketplace` to pick up v1.15.3-beta.1, then invoke any `/mos:` command in that same (or a subsequently restarted) session.
started: observed 2026-07-03, same day as the v1.15.3-beta.1 publish this very conversation performed.

## Scope and Impact

- Affected surfaces: cli (the pasted transcript's status-line chrome matches this plugin's own CLI statusline format; Desktop/Cowork not yet ruled in or out)
- Affected commands: navigator confirmed (via structured question) "Every /mos: command is broken" -- not scoped to help.md alone
- Blast radius: unknown until H1/H2/H3 are distinguished -- ranges from "this one navigator's session needs a restart" (H1, trivial) to "every user who updates near a CC self-upgrade collision loses the entire product silently" (H2, matches the existing case-7-sibling's documented blast radius) to "a genuinely new regression in the release this session just shipped" (H3, would require an immediate follow-up patch release)

## Required Code Changes (resolved 2026-07-05)

None fix the root cause (it is host-side, Claude Code's own registration subsystem). What ships instead: `scripts/doctor.cjs --report-registration-bug` (new sibling mode, quick task `260705-jeq`) that proves every locally-checkable precondition is clean and assembles a paste-ready Anthropic bug report. Two unrelated but real local bugs found and fixed along the way this session: the F11 legacy-config-pin-drift class (twice-recurring, now detected+fixed) and its own two post-ship correctness bugs (a missing 3rd config.json schema variant, a Windows-illegal `:` in a backup-timestamp filename) - see `windows-install-update-ux.md`.

## Tests

`260705-jeq`'s planned tests cover the new doctor mode (assembles correctly, never claims "fixed", reuses existing evidence collectors) and the `/mos:help` reshape (11-family re-group, existing `test-help-selector-lanes.cjs` / `test-help-cards-render.cjs` / `lib/memory/help-renderer.test.cjs` updated in the same task per the corrected group labels).

## Non-Code Follow-ups

- If H2 confirmed: this would be the first LIVE reproduction of the case-7-sibling collision the 2026-06-11 detector has been waiting for -- update `.planning/debug/plugin-silent-disable-after-cc-self-upgrade.md`'s `next_action` and design the deferred self-heal/loud-fail step.
- If H3 confirmed as genuinely new: append a row to `docs/install-cache-family-premortem.md` Section 1 per its own Section 4 revisit cadence, and promote/add a Section 3 prediction.

## Evidence (append-only)

### 2026-07-03 -- session opened, pre-investigation context gathered (this session, informal, before formal debug file)

- Confirmed via direct file/registry inspection (dev repo, NOT the navigator's install) that `commands/help.md`'s frontmatter parses cleanly and carries no `mos:firing-block` stamp (it was not among the 80 commands Phase 210's item-E-3 sweep touched).
- Confirmed via `npm view @mindrian_os/cli versions --json`, git tag/origin match, marketplace repo sync commit, and an independent `node scripts/doctor.cjs --acceptance` run (14/14) that the v1.15.3-beta.1 publish itself is structurally sound on the PUBLISHING side (repo, registry, marketplace, website FALLBACK_VERSION all consistent). This does not yet rule out an ACTIVATION-side (the navigator's local install cache / enabled-flag / session) problem, which is exactly the class of bug case-7-sibling and premortem sub-case-7b describe.
- Navigator confirmed via structured question: EVERY `/mos:` command is broken, not just `/mos:help`.
- Navigator did not pick a structured answer for "same session vs fresh session after update" -- instead gave a directive to open a proper GSD debug investigation. This fact (same-vs-fresh) is UNKNOWN and should be the first thing the fan-out research surfaces or the first thing re-asked if research cannot determine it independently.

### 2026-07-05 -- ROOT-CAUSED via an independent, more thorough live recurrence (H1/H2/H3 ranked, all three WRONG; the real cause is a 4th, host-side one)

This exact symptom recurred on the SAME navigator's Windows machine, investigated fresh (this 2026-07-03 file was not cross-referenced until after the new investigation concluded - flag: search `.planning/debug/` for matching symptom strings BEFORE opening a new RCA next time). Full trail lives in `.planning/debug/windows-install-update-ux.md` (F8/F11/F13) and `.planning/SESSION-HANDOFF-2026-07-05-commands-bisect-eureka-registration.md`. Ranking this file's three original hypotheses against the new evidence:

- **H1 (mid-session hot-reload gap) - RULED OUT.** A FULL app quit+relaunch was performed multiple times, including after a complete `claude plugin uninstall` + fresh `claude plugin install`. The symptom persisted through every restart. Not a stale in-session registry.
- **H2 (silent-disable collision, `enabledPlugins[key]` flipped false) - RULED OUT for this occurrence.** `checkPluginEnabled()` reports the plugin correctly enabled; this is not the case-7-sibling collision (that detector's still-never-been-live-reproduced status is UNCHANGED by this finding - it remains a real, separate, still-open risk, just not what happened here).
- **H3 (a new install-cache-family failure mode) - RULED OUT as the root cause, though real install-cache bugs WERE found and fixed along the way** (legacy `config.json` version-pin drift, F11, recurred twice and now has a doctor.cjs detector + fix; two Windows-specific bugs in that fix itself, found and fixed same day). None of these explain the symptom on their own - fixing all of them did not resolve "Unknown command."
- **THE ACTUAL ROOT CAUSE (H4, not in the original three):** confirmed via a valid control test against another genuinely-installed third-party marketplace plugin on the same machine (not mos) - it fails identically. Every command file (107, this plugin) verified structurally valid (frontmatter, description, no manifest `commands` field capping discovery, no subdirectories). Skills and MCP-server prompts from the SAME plugin load and work correctly; only the `commands/*.md` auto-discovery path is dark. **Conclusion: this is a Claude Code core bug in its plugin command-registration subsystem (v2.1.201, Windows, latest release, no update available), reproduced across multiple unrelated plugins - not a MindrianOS defect, not fixable from this repo's code.**
- **What IS being built in response (quick task `260705-jeq`, in flight):** a `doctor.cjs --report-registration-bug` mode that runs every locally-checkable precondition (class A install-cache drift, class N silent-disable via `checkPluginEnabled()`, F11 legacy-pin drift, marketplace-clone git-dirty state, version-of-record leg agreement, on-disk command-file count) and shows each CLEAN, so the assembled report proves "not us" and gives a ready-to-paste Anthropic bug report instead of the navigator reconstructing this investigation by hand every time it recurs. A companion `scripts/check-command-registration.cjs` verifier (drafted independently by the navigator's Windows-side session, same day, same conclusion) checks the structural preconditions statically (balanced frontmatter fences, legal command names, no name collisions, description present/length) and should be reconciled with the doctor mode rather than shipped as a second, competing checker - see 260705-jeq's PLAN.md for how these merge.
- **Non-code follow-up per this file's own original instruction:** H2's detector (`plugin-silent-disable-after-cc-self-upgrade.md`) is STILL never live-reproduced; that remains open and separate. Do not close it based on this file's resolution.
