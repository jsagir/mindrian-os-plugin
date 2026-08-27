---
status: fixing                # gathering | investigating | fixing | resolved
kind: qa-sweep               # rca | debug-session | qa-sweep
trigger: "windows-install-and-field-qa-sweep-2026-08-10"
issue_id: ""
severity: medium             # blocker | high | medium | low (roll-up; per-finding severity below)
surfaces: [cli]              # cli | desktop | cowork
brain_mode: full-loop        # full-loop | local-only | tier-0
canon_parts: [6, 7, 12]      # 6 dog-fooding, 7 reuse-before-build, 12 pedagogy (statusline trust)
created: 2026-08-10T16:00:00Z
updated: 2026-08-27T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Original T1/T2 hypothesis holds unchanged. Three additional primary-source tester
records now fold into this sweep, spanning a 3.5-month window both before and after the original
2026-08-10 audit: (T3) Gaurav Thorat's 2026-08-24/25 trial install (postdates this sweep by ~2
weeks), (T4) Gary Laben's 2026-05-08/09 Windows git-clone install plus follow-up sessions
(predates this sweep by ~3 months), (T5) the Mindrian Summer Internship 2026 cohort's Session 1
install QA, 2026-06-02 (predates this sweep by ~2 months). All three confirm the SAME recurring
pattern classes this sweep already tracks (windows-posix-shell-assumption family, Brain-key-step
friction) rather than introducing a new failure class. One genuinely new dev-side finding
(Gaurav's Brain-access double sign-in, root-caused as a cross-origin session-cookie seam) and one
genuinely unresolved tension (the Interns' Vercel-checkbox finding directly contradicts this
sweep's own F-B) are the two items in this append worth a human decision.
test: Classify every symptom WORKING / KNOWN-tracked / FIXED-already / ENV-GAP / NEW / HYPOTHESIS
against the repo and the existing .planning/debug corpus (unchanged discipline). For this append,
additionally: (a) confirm whether Gary Laben's two 2026-05-09 bugs (filed in his own record as
"Phase 95.3") are fixed or dangling -- CONFIRMED FIXED, absorbed into Phase 95.6 D-01/D-03,
shipped v1.13.0-beta.9 (2026-05-11), and still live/unreverted on current HEAD (install.sh:35-53,
245-272; skills/mullins-scaffold/SKILL.md exists) as of 2026-08-27; (b) verify Gaurav's EBADENGINE
doc-gap claim against the live mindrian-website install docs -- CONFIRMED still absent
(page.tsx + install-stack.tsx, zero matches); (c) verify the 2026-08-26 research trail's claim
that the Windows Claude-Code-CLI prereq step is undocumented -- CONFIRMED INCORRECT, the step has
been live in install-stack.tsx:43-48 since commit 141928d6 (2026-06-04), ~11 weeks before
Gaurav's test.
expecting: A per-finding table where only NEW/HYPOTHESIS items warrant a fresh /gsd:debug session
or a live repro; KNOWN/FIXED items link to their existing session or shipping phase; ENV/DOC items
route to install docs, not code. This append adds F-P through F-X (see Findings Table); only F-X
(Vercel-checkbox contradiction) is a genuine open question needing a real repro. F-P and F-W both
cross-reference Phase 269 (Moat Shift -- Install/Update Entitlement Gate, `.planning/ROADMAP.md`
lines 555-570) by name, since Phase 269 repurposes the exact same mindrian-website auth-flow
files (`components/brain/AuthButton.tsx`, `src/app/auth/callback/route.ts`, `next.config.ts`)
that F-P's root cause lives in.
next_action: F-A and F-I remain shipped 2026-08-11 (see Resolution, unchanged). F-B/F-E DOC items
remain open (install minisite). NEW from this append (2026-08-27): (1) file F-Q (EBADENGINE FAQ
line) and F-U (Claude-Code third-party-plugin-warning FAQ line) as doc-only additions to the
mindrian-website install docs -- no code, independent of Theo/Phase 269; (2) whoever next touches
either F-P (Gaurav's double-sign-in seam) or Phase 269's entitlement-gate build should read the
other first -- same auth-flow files, same seam, two different reasons to touch them, avoid
duplicating or clobbering the other's fix; (3) F-X needs a real Windows repro (fresh Node install
with "Tools for Native Modules" UNCHECKED, then attempt a Vercel CLI install) before F-B's
blanket "uncheck it" advice can be trusted as complete -- do NOT amend F-B on the strength of the
Interns' single report alone; (4) F-K/F-L/F-M/F-N/F-O remain HYPOTHESIS, unchanged, still
candidates for a fresh /gsd:debug session each.

## Source-of-Truth Preamble

- **CODE claims read against:** branch `claude/mindry-installation-xt5x2d` @ `aad6ba380fff2ec6acb05dc50bc347c7639f846b` (working tree; package.json version 1.16.0-beta.12).
- **WIRE / FIELD claims read against:** two primary-source transcripts - (T1) a group install video call (Jonathan + Ameet/Joe/Young/Wen/Reuben), Windows boxes, plugin era v1.16.0-beta.x; (T2) a Claude Code field-use session pasted 2026-08-10 (tester "David", `davidsamuel@karunya.edu.in`, Windows, install cache v1.16.0-beta.7, room `mindrian-consultant` then `msem-innovation-ta`). T2 carries a Larry-authored "what worked / what did not work" briefing used here as evidence.
- **Date of audit:** 2026-08-10
- **Re-verification rule:** the two grounded code findings (F-A, F-I) were read against the branch working tree, NOT `origin/main` HEAD, and NOT against the testers' beta.7 install cache. Both are tagged `needs-source-reverify`: re-confirm against `origin/main` HEAD before either lands as a fix. The testers ran beta.7; the branch is beta.12; an unbounded fix-delta may already cover part of any finding (the 2026-05-23 stale-cache false-positive pattern).

Checklist:
- [x] Source-of-Truth Preamble filled before any finding filed

### Additional Primary Sources (appended 2026-08-27)

Three more primary-source tester records, predating and postdating the original T1/T2 audit,
folded in per navigator instruction. None replace T1/T2; all are read as independent corroborating
or contrasting evidence.

- **(T3)** Gaurav Thorat trial install testimonial, 2026-08-24/25 (Windows + macOS), mos@2.0.0-beta.11.
  Primary: `docs/testers/gaurav-thorat/FEEDBACK.md` (Gmail thread `1a038520179cae6b`). Root-cause
  trail: `~/MindrianRooms/rethinking-mindrianos/research/2026-08-26-trial-install-testimonial/2026-08-26-trial-install-testimonial.md`.
  POSTDATES this sweep by ~2 weeks -- the most recent tester record folded in here.
- **(T4)** Gary Laben Windows git-clone install, 2026-05-08/09, plus later 2026-05-14 and
  2026-05-30 sessions, v1.13.0-beta.6..beta.34. Primary: `docs/testers/gary-laben/FEEDBACK.md`.
  PREDATES this sweep by ~3 months; his two 2026-05-09 bugs are the direct, named trigger
  evidence for Phase 95.6 (see F-S/F-T below).
- **(T5)** Mindrian Summer Internship 2026 cohort, Session 1 install QA, 2026-06-02
  (Windows-heavy: 3 of 4 interns on Windows, 1 on Mac). Primary:
  `docs/testers/interns/sessions/2026-06-02-session-01-install-qa.md` (LOCAL-ONLY, gitignored,
  real names -- read but not altered here per that file's own locality rule). PREDATES this sweep
  by ~2 months.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin (dev workspace; this sweep authored on branch claude/mindry-installation-xt5x2d)
- Plugin version (source): 1.16.0-beta.12 (branch HEAD). Testers observed on: 1.16.0-beta.7 (T2), beta.x (T1).
- Reported by: two Windows field sessions (T1 group install call; T2 JHU-TA field use)
- Date first observed: 2026-08-10
- Related debug sessions: windows-posix-shell-assumption-installer-statusline, windows-installer-spawn-shell-false, windows-install-update-ux, doctor-brain-smoke-win-crash, marketplace-catalog-advertises-dev-next-bump, every-mos-command-unknown, ignite-frontdoor-bypassed-methodology-overfire, resolved/windows-os-rename-registry-wedge, resolved/windows-tester-find-bottlenecks-silent-failure-qa-sweep, resolved/doctor-marketplace-cache-drift-deadlock

## Problem Statement

On Windows, first-time install and first-run of MindrianOS is slow and fragile (T1: an hour-plus multi-user call, most users not finishing cleanly), and steady-state field use hits transient-network and room-health friction (T2). No single blocker; a cluster of small defects and env gaps compounds into a bad first impression.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `npx` install path completes in ~5 min; the branded statusline renders; `/mos:doctor` reports the statusline healthy; `/mos:update` reports the latest version; first room creation and steady-state Stop hooks run clean.
actual: install ran 20-90 min per user; multiple users stalled on a blue PowerShell "installing Visual Studio / VCREDS" screen; marketplace add failed and needed a full terminal restart; a corporate/Okta-managed Claude plan blocked the required subscription upgrade; `/mos:doctor` statusline self-test reported a "synthetic spawn error" on Windows even after the statusline itself rendered; `/mos:update` looped on `read ECONNRESET`; room Stop hooks emitted a recurring guardian error ("trace_missing_field, glyph low; 32 violations across 1 section") and one `USER.md` "Error writing file".
errors:
  - (T1, Joe's Claude, verbatim paraphrase) "Status line self-test still reports synthetic spawn error. It's calling the script directly instead of through Bash which doesn't work on Windows regardless of whether the status line itself is healthy. That's a diagnostic bug, not a problem."
  - (T2, /mos:update) "STATUS = NETWORK_ERROR / VERSION = 1.16.0-beta.7 / REASON = read ECONNRESET" (repeated on retry)
  - (T2, room creation) "Write(MindrianRooms\\msem-innovation-ta\\USER.md) Error writing file"
  - (T2, every Stop) "guardian: error in room (trace_missing_field, glyph low); 32 violations across 1 section"
  - (T2, session start) "1 setup issue: MCP - /doctor" and "loaded room: mindrian-consultant, 0 active sections, MINTO health --"
reproduction:
  1. Fresh Windows box, no Claude Code. Follow the mindrian-os.com install page steps (Node MSI, npx install, marketplace add, brain key).
  2. Observe the Node MSI "Tools for Native Modules" optional step spawn a long chocolatey/VS-Build-Tools install (the blue PowerShell screen).
  3. After install, run `/mos:doctor`; on Windows observe the statusline self-test spawn error even when the statusline renders.
  4. Run `/mos:update` on a network where raw.githubusercontent.com is reset/proxied; observe STATUS=NETWORK_ERROR with no retry.
started: install-shell-assumption family present since the installer/statusline were written for POSIX (see windows-posix-shell-assumption-installer-statusline, 2026-06-01). Update-checker no-retry present since the checker was written.

## Scope and Impact

- Affected surfaces: cli (Windows). Desktop/Cowork not exercised by either transcript.
- Affected commands / scripts: install flow (Node MSI + npx + marketplace add), `/mos:doctor` (statusline self-test), `/mos:update` (version checker), `/mos:new-project` room birth (USER.md write), Stop-hook guardian.
- Affected users: Windows installers and Windows field users. Heaviest on enterprise/edu networks (T2: karunya.edu.in) where raw.githubusercontent.com is proxied/reset, and on corporate-managed Claude plans (T1: Okta) where the subscription upgrade is blocked.
- Version range: observed beta.7 (T2) and beta.x (T1); source checked at beta.12.
- Severity (roll-up): medium. No single blocker, but the compounding install friction is a first-impression risk that the maintainer (T1) explicitly names as the top product gap.
- Blast radius: the shell-assumption root cause (POSIX bash/spawn) is shared across installer PATH check, statusline runtime, and the doctor statusline self-test.

## Eliminated
<!-- APPEND only -->

- hypothesis: the branded statusline is broken on Windows at runtime.
  evidence: T1 - after `/mos:doctor`, Joe reports "the status line appeared, it fixed that"; the runtime statusLine command in settings.json is `bash "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-mos"` and renders once Git Bash is present. The residual is ONLY the doctor self-test probe, which spawns the script without `bash`. Runtime statusline is WORKING; the self-test is the defect.
  timestamp: 2026-08-10T16:00:00Z

- hypothesis: MindrianOS install compiles native modules, so VS Build Tools is required.
  evidence: package.json declares zero node-gyp/native deps (sqlite-vec ships prebuilt binaries; @huggingface/transformers is JS/WASM). install.sh has no visual/build-tools/gyp/choco references. The blue PowerShell screen is the Node.js MSI's OPTIONAL "Tools for Native Modules" (chocolatey -> Python + VS Build Tools), not a MindrianOS requirement.
  timestamp: 2026-08-10T16:00:00Z

## Evidence
<!-- APPEND only -->

- timestamp: 2026-08-10T16:00:00Z
  checked: lib/core/doctor/statusline-visibility-module.cjs:186-200
  found: `spawnSync(statuslineMos, [], {...})` invokes the resolved statusline target DIRECTLY. When the target is the plugin's `scripts/statusline-mos` (a shebang bash script, no .cmd/.exe), Windows cannot direct-exec it, so spawnSync errors (ENOENT-class) and the probe returns status 'error'. No `bash` wrapper, no win32 branch.
  implication: doctor statusline self-test is a Windows false-negative. Confirms T1's "calling the script directly instead of through Bash". This is the residual site of the windows-posix-shell-assumption family; the settings.json runtime already wraps in bash.

- timestamp: 2026-08-10T16:00:00Z
  checked: scripts/check-version-and-sha.cjs:150-168, 200-222
  found: fetchLatestVersion() tries CATALOG_URL then MAIN_PLUGIN_JSON_URL (both on raw.githubusercontent.com). No retry/backoff. Any throw -> main() prints STATUS=NETWORK_ERROR and exit 1. Both URLs share one host, so a host-level ECONNRESET fails both in one shot.
  implication: T2's `/mos:update` loop is a code gap - a single transient reset aborts the whole check with no retry and no auto-degrade to the native `/plugin update` path. The skill's manual fallback (Option B) is correct but the checker never self-recovers.

- timestamp: 2026-08-10T16:00:00Z
  checked: settings.json
  found: statusLine.command = `bash "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-mos"` (correctly bash-wrapped).
  implication: the runtime/self-test asymmetry is the whole story of finding F-A.

- timestamp: 2026-08-10T16:00:00Z
  checked: package.json dependencies + install.sh
  found: no native/gyp deps; no build-tools invocation in install.sh.
  implication: the VS Build Tools time-sink is external (Node MSI optional step), fixable by a DOC change on the install page, not code.

- timestamp: 2026-08-27T00:00:00Z
  checked: docs/testers/gaurav-thorat/FEEDBACK.md:24,32; mindrian-website (repo /home/jsagi/dev/mindrian-website) `website/src/components/brain/AuthButton.tsx:23-26`, `website/src/app/auth/callback/route.ts:6-10`, `website/next.config.ts:1-13` (all three last touched by commit `cebf7e66` 2026-06-04, per `git log`).
  found: `AuthButton.tsx` calls `supabase.auth.signInWithOAuth({provider:"google", redirectTo: window.location.origin + "/auth/callback"})` -- relative to whatever origin the browser happens to be on. `route.ts` is the ONLY `?code=` consumer anywhere in the site (`exchangeCodeForSession(code)`). `next.config.ts`'s `redirects()` array has exactly one rule (`/how-it-works` -> `/docs`); no canonical-domain redirect between `mindrian-os.com` and the raw `mindrianos-jsagirs-projects.vercel.app` deployment alias exists, and no `NEXT_PUBLIC_SITE_URL` pin appears anywhere in the auth code.
  implication: confirms, at the code level (not just from the rethinking-mindrianos research trail's own read), that whichever origin the OAuth redirect actually lands on, the session cookie set there does not carry back to the origin the user started the flow on -- so `/brain-access` falls back to the unauthenticated `BrainPublicPage` and forces a second Google sign-in. A genuine cross-origin session-cookie seam, not a copy issue. See F-P.

- timestamp: 2026-08-27T00:00:00Z
  checked: .planning/ROADMAP.md:555-570 (Phase 269: Moat Shift -- Install/Update Entitlement Gate)
  found: Phase 269 (navigator-locked 2026-08-27) repurposes the SAME mindrian-website Google-auth gate (`/brain-access`, `AuthButton.tsx`, `auth/callback/route.ts`, `next.config.ts`) to issue an install/update entitlement credential instead of, or alongside, a per-query Brain key. ROADMAP.md:559 states explicitly: "This directly touches the SAME auth-flow code this session already root-caused for Gaurav Thorat's double-sign-in finding... fixing that seam and building this gate are the same body of work, not two separate auth flows." ROADMAP.md:563 also names `docs/testers/gaurav-thorat/FEEDBACK.md` directly.
  implication: F-P (Gaurav's double sign-in) and Phase 269 are the same auth-flow files. Whoever picks up either should read the other first. Recorded as a cross-reference in F-P and F-W, not a resolution of either -- this sweep does not implement anything here.

- timestamp: 2026-08-27T00:00:00Z
  checked: mindrian-website `website/src/app/docs/install/page.tsx` and `website/src/components/install/install-stack.tsx`, grepped for `EBADENGINE|npm-engine|engine.*warning`.
  found: zero matches in either file.
  implication: Gaurav's EBADENGINE self-update noise (npm suggesting `npm install -g npm@12.0.2` on a node-engine-version mismatch, unrelated to MindrianOS) is still undocumented on the live install docs as of 2026-08-27. Genuine DOC gap, one-line FAQ-callout scope. See F-Q.

- timestamp: 2026-08-27T00:00:00Z
  checked: mindrian-website `website/src/components/install/install-stack.tsx:43-48` (the `windows` OS_DATA block); `git blame` on the same lines -> commit `141928d6` (Jonathan Sagir, 2026-06-04 13:42:47 +0300).
  found: `windows: { ..., claudeCmd: "npm install -g @anthropic-ai/claude-code", claudeNote: "On Windows the npm method avoids the most common PATH error." }`. This block has been live since 2026-06-04, roughly 11 weeks before Gaurav's 2026-08-24 test.
  implication: the 2026-08-26 rethinking-mindrianos research trail's claim ("Windows path requires npm install -g @anthropic-ai/claude-code first... not currently called out anywhere found") is INCORRECT -- the docs already cover this, and have for months. Corrected here, not reopened as F-B/F-E. The ~10-minute cost Gaurav experienced is the inherent time cost of npm-installing a real CLI package on Windows, not a doc gap. See F-R.

- timestamp: 2026-08-27T00:00:00Z
  checked: .planning/phases/95.6-install-cache-windows-hardening-and-skill-loop-resilience/95.6-CONTEXT.md:75-105 (D-01, D-03 decision text, "Trigger evidence" citing "[private tester archive], 2026-05-09 entry"); 95.6-04-SUMMARY.md:44 (`requirements-completed: [D-01]`); 95.6-02-SUMMARY.md:56,77 + 95.6-03-SUMMARY.md:40,61,223 (`requirements-completed: [D-03]`); 95.6-10-SUMMARY.md:11-31 (release ship + Windows-gate waiver); `ls .planning/phases/ | grep '^95'` -> only `95, 95.1, 95.2, 95.5, 95.6, 95.7` exist, no `95.3` directory.
  found: Gary Laben's two 2026-05-09 bugs (Windows MAX_PATH git-clone failure; `install.sh` `set -euo pipefail` hard-exit on missing `skills/mullins-scaffold/SKILL.md`) are the direct, named trigger evidence for Phase 95.6 -- the symptom text in 95.6-CONTEXT.md is a verbatim match to `docs/testers/gary-laben/FEEDBACK.md`'s 2026-05-09 entry. "Phase 95.3" as cited in Gary's own FEEDBACK.md was never created as a directory; the bugs were instead absorbed into Phase 95.6 as D-01 (Windows long-path preflight) and D-03 (install.sh skill-loop hardening), both marked `requirements-completed` and shipped as part of v1.13.0-beta.9 (2026-05-11, `git push origin main --tags` -> `60fe434`/tag `9ed8280`). The Windows cold-install empirical acceptance gate (`tests/manual/95.6-windows-cold-install-acceptance.md`) was explicitly WAIVED by the maintainer 2026-05-11 ("I will not reach out to the Wave-2 tester to try; we will do it anyway") and never run by a real Windows tester after the fix landed.
  implication: Gary's bugs are NOT dangling -- they were fixed, under a renumbered phase, not the phase number his FEEDBACK.md cites. "Phase 95.3" is a stale/incorrect label in his own record, not evidence of a false-success skip (the standing personal-memory WATCH item for that failure pattern does not apply here). The one residual gap: the code fix was never empirically re-verified on a live Windows machine after shipping -- waived explicitly and dated, not silently skipped. See F-S/F-T.

- timestamp: 2026-08-27T00:00:00Z
  checked: install.sh:35-53 (`enable_longpaths_on_windows`), install.sh:245-272 (skill-loop WARN-and-continue guard), `skills/mullins-scaffold/SKILL.md` (existence check) -- all on current `origin/main` HEAD, 2026-08-27.
  found: both D-01 and D-03 fixes are present and unchanged on current HEAD, ~3.5 months after they shipped. `enable_longpaths_on_windows()` runs before clone and sets `git config --global core.longpaths true` on Windows. The skill loop increments `SKILL_SKIPPED` and prints `WARN: skipping skill $skill_name: no SKILL.md` to stderr instead of hard-exiting under `set -euo pipefail`. `skills/mullins-scaffold/SKILL.md` exists.
  implication: Gary's two bugs are fixed AND the fix has not regressed or been reverted since 2026-05-11. The Phase 95.6 absorption is durable, not a since-reverted quick patch.

- timestamp: 2026-08-27T00:00:00Z
  checked: docs/testers/gary-laben/FEEDBACK.md:18-30 (2026-05-07 entry, verbatim Claude Code plugin-security-warning quote).
  found: Gary hit Claude Code's own third-party-plugin security warning (settings.json modification + SessionStart hook, "unknown provenance," recommended against running) on both the Claude application and the PowerShell install method, and asked directly whether MindrianOS would run for every Claude Code project or only Mindrian-associated ones -- a scope question the tester onboarding docs did not answer at the time.
  implication: same ENV-GAP bucket as this sweep's F-B/F-E -- an Anthropic/Claude-Code-side surface MindrianOS docs must address head-on, not route around. No code fix possible; DOC-only. See F-U.

- timestamp: 2026-08-27T00:00:00Z
  checked: docs/testers/interns/sessions/2026-06-02-session-01-install-qa.md, Findings F1/F2/F3/F4/F8.
  found: F1/F4/F8 (Windows "claude not recognized" PATH failures, 3 separate reporters: Devoushka, Gaurav Thorat, David) predate this sweep by ~2 months and cross-reference quick task `260602-0pb` -- the same `windows-posix-shell-assumption-installer-statusline` family this sweep already tracks. F2 (a SEPARATE hand-authored install page from Lawrence had NO Brain-API-key request step at all, vs this sweep's F-D "manual step, working as designed" against the canonical mindrian-website flow) is a worse historical variant of F-D, resolved in-session 2026-06-02 by retiring the hand-authored page in favor of the canonical site. F3 (David's Windows Vercel CLI install would not proceed until he re-ran the Node installer WITH the "install necessary tools" / native-build-tools checkbox CHECKED, plus a terminal reopen) directly CONTRADICTS this sweep's own F-B, which instructs users to UNCHECK that exact checkbox because "MindrianOS ships no native modules and needs none of it."
  implication: F1/F4/F8 -> cross-reference only, an earlier independent occurrence that strengthens the existing tracked family; not a new finding in its own right (F-V). F2 -> cross-reference to F-D as a worse historical variant, and to Phase 269, which removes the query-time Brain-key step from the picture entirely once shipped, obsoleting this whole finding class (F-W). F3 -> a genuine open contradiction with F-B that this sweep does NOT resolve -- either Vercel CLI itself needs the native-build-tools checkbox (making F-B's blanket advice incomplete for users who will also install Vercel) or David's fix was coincidental (the terminal reopen alone would have done it); telling users to uncheck a box Vercel actually needs would make things worse, not better, so this stays an open question pending a real repro (F-X).

## Findings Table

| ID | Finding | Source | Class | Severity | Route |
|----|---------|--------|-------|----------|-------|
| F-A | doctor statusline self-test spawns the bash script directly, not via `bash` -> Windows false "spawn error" | T1 | NEW-site of KNOWN family (windows-posix-shell-assumption-installer-statusline) | low | FIXED 2026-08-11 (see Resolution) |
| F-B | Node MSI "Tools for Native Modules" installs Python + VS Build Tools (the blue PowerShell hang); MindrianOS needs none | T1 | ENV-GAP | high (time-sink) | DOC (install minisite) |
| F-C | "Failed to add marketplace" needs a full terminal restart to clear | T1 | KNOWN (resolved/doctor-marketplace-cache-drift-deadlock) | medium | verify / DOC |
| F-D | Manual Brain-API-key step | T1 | WORKING as-designed (maintainer: next update bakes it in) | low | roadmap |
| F-E | Corporate/Okta-managed Claude plan blocks the required subscription upgrade | T1 | ENV-GAP (Anthropic-side) | medium | DOC (prereqs) |
| F-F | Command proliferation; users cannot tell MOS commands from native, or which to run | T1 | KNOWN (every-mos-command-unknown) + roadmap (NL dispatch) | medium | roadmap |
| F-G | First room creation slow (installs Python mid-session) | T1 | KNOWN by-design (Phase 130 CJS-port planned) | low | roadmap |
| F-H | Terminal focus/paste quirks (Enter ignored until mouse click) | T1 | ENV-GAP (Claude Code Windows terminal) | low | none |
| F-I | `/mos:update` aborts on a single ECONNRESET with no retry / no auto-degrade | T2 | NEW (grounded) | medium | FIXED 2026-08-11 (retry shipped; auto-degrade noted as follow-up, see Resolution) |
| F-J | PPTX not natively readable; python-pptx shell-out, silent break if absent | T2 | NEW / ENH | medium | code/DOC |
| F-K | Recurring guardian error every Stop: "trace_missing_field, glyph low; 32 violations across 1 section" | T2 | HYPOTHESIS (needs repro) | medium | investigate |
| F-L | `USER.md` "Error writing file" during room birth | T2 | HYPOTHESIS (needs repro) | medium | investigate |
| F-M | Room-health inconsistency ("0 sections scanned / health --" then "3 sections / health low") | T2 | HYPOTHESIS (family: intern-w1-state-not-recomputed) | low | investigate |
| F-N | Session-start "1 setup issue: MCP - /doctor" | T2 | HYPOTHESIS (family: mcp-servers-cache-missing-node-modules, doctor-brain-smoke-win-crash) | low | investigate |
| F-O | `/ignite` hit a bug and self-healed mid-session | T1 | HYPOTHESIS (insufficient error text) | low | investigate |
| F-P | Brain-access double sign-in (mindrian-os.com -> mindrianos-jsagirs-projects.vercel.app), root-caused as a cross-origin session-cookie seam (no canonical-domain redirect, no `NEXT_PUBLIC_SITE_URL` pin) | T3 (Gaurav Thorat, 2026-08-24/25) | KNOWN-TRACKED, root-caused, deliberately DEFERRED pending Theo Brain-hookup swap | medium | Phase 269 (Moat Shift -- Install/Update Entitlement Gate) touches the SAME auth-flow files for a different reason -- see Evidence above; not resolved here |
| F-Q | Windows npm self-update `EBADENGINE` noise (npm's own engine-mismatch suggestion, unrelated to MindrianOS) still absent from live install docs | T3 (Gaurav Thorat) | ENV-GAP | low | DOC (mindrian-website install docs, one-line FAQ callout) |
| F-R | "Windows CLI wasn't preinstalled, adds ~10 min" -- CORRECTION of the 2026-08-26 research trail's own claim, not a doc gap | T3 (Gaurav Thorat) | WORKING-as-documented (correction) | n/a | none -- do NOT reopen F-B/F-E on this claim |
| F-S | Windows git-clone MAX_PATH (260-char) failure on the old `92-...trust-layer...` phase directory | T4 (Gary Laben, 2026-05-08/09) | KNOWN-TRACKED / FIXED (Phase 95.6 D-01, shipped v1.13.0-beta.9 2026-05-11; confirmed live+unreverted on HEAD 2026-08-27) | was high, now fixed | none -- residual: Windows cold-install empirical gate WAIVED, never re-confirmed live post-fix |
| F-T | `install.sh` `set -euo pipefail` hard-exits the ENTIRE script on missing `skills/mullins-scaffold/SKILL.md`, leaving agent/hook/settings.json registration unfinished | T4 (Gary Laben) | KNOWN-TRACKED / FIXED (Phase 95.6 D-03, shipped v1.13.0-beta.9 2026-05-11; confirmed live+unreverted on HEAD 2026-08-27) | was high (install-breaking), now fixed | none -- same residual as F-S |
| F-U | Claude Code's own third-party-plugin security warning + unanswered "does this run on every project?" scope question caused install hesitation | T4 (Gary Laben) | ENV-GAP | low-medium | DOC (same bucket as F-B/F-E -- prereqs/FAQ, address the warning + scope head-on) |
| F-V | Windows PATH "claude not recognized" family (3 reporters: Devoushka, Gaurav Thorat, David) | T5 (Interns Session 1, 2026-06-02; findings F1/F4/F8) | KNOWN-TRACKED, independent earlier occurrence of the SAME windows-posix-shell-assumption-installer-statusline family this sweep already tracks | n/a | none -- corroborating evidence only, strengthens the existing tracked pattern |
| F-W | Brain-API-key request step missing ENTIRELY from a separate hand-authored install page (worse historical variant of this sweep's F-D) | T5 (Interns Session 1; finding F2) | KNOWN-TRACKED, worse historical variant of F-D; resolved in-session 2026-06-02 by retiring the hand-authored page | n/a (historical, closed) | Phase 269 obsoletes this whole finding class once shipped (removes the query-time Brain-key step entirely) |
| F-X | CONTRADICTS this sweep's F-B: Vercel CLI on Windows apparently needed the Node "install necessary tools" (native-build-tools) checkbox CHECKED, while F-B says uncheck it | T5 (Interns Session 1; finding F3) | HYPOTHESIS / OPEN QUESTION, unresolved tension, needs a real repro | medium (wrong advice here makes things worse, not better) | investigate -- do NOT amend F-B until repro'd |

## Technical Root Cause (grounded findings only)

- F-A
  - Site: lib/core/doctor/statusline-visibility-module.cjs:186-200, the isolated-execution step of the class-G statusline visibility check.
  - Cause: `spawnSync(statuslineMos, [], {...})` execs the resolved bash script directly. Windows has no direct-exec association for an extensionless shebang bash script, so the child fails to launch and the probe reports status 'error' - even though the real runtime (settings.json) invokes the same script via `bash` and renders correctly.
  - Why it surfaces now: only visible on Windows; CI has no Windows runner (Canon Part 6 dog-fooding gap that let it slip). The self-test is newer than the runtime bash-wrap, so the asymmetry was never caught on POSIX.

- F-I
  - Site: scripts/check-version-and-sha.cjs:150-168 (fetchLatestVersion) and 219-222 (main catch).
  - Cause: no retry/backoff around the two raw.githubusercontent.com fetches; both share one host, so one ECONNRESET fails both and aborts with STATUS=NETWORK_ERROR.
  - Why it surfaces now: enterprise/edu networks (T2) reset or proxy raw.githubusercontent.com more often; a transient blip that a single retry would ride out instead ends the whole check.

## Required Code Changes (PROPOSED - do NOT implement; user directive is report-only)
<!-- Explicit so a follow-up /gsd:debug can act; each tagged needs-source-reverify -->

- Change 1 (F-A):
  - Location: lib/core/doctor/statusline-visibility-module.cjs:186-200, function `checkStatuslineVisibility` (step 3).
  - Current behavior: spawns the resolved statusline target directly.
  - Required behavior: invoke the target the way the real session does. When the effective target is the plugin bash script (no user-override, or an override whose command starts with `bash`), spawn `bash [statuslineMos]` (mirroring settings.json). Keep the direct spawn only if a future user override is a native executable. Guard on process.platform is optional; routing through `bash` is correct cross-platform because that is what settings.json already does.
  - Short-term patch: `spawnSync('bash', [statuslineMos], {...})`.
  - Long-term fix: resolve and execute the EXACT effective statusLine.command string (bash-wrap and all) so the self-test can never diverge from runtime again.
  - Reverify: confirm the same site on origin/main HEAD (branch is beta.12; testers on beta.7) before landing.

- Change 2 (F-I):
  - Location: scripts/check-version-and-sha.cjs, fetchLatestVersion() + fj() helper.
  - Current behavior: single-shot fetch of each URL; first throw aborts.
  - Required behavior: wrap each fetch in a small bounded retry (e.g. 2-3 attempts, 250/500/1000ms backoff) on transient net errors (ECONNRESET, ETIMEDOUT, EAI_AGAIN); only after retries exhaust emit STATUS=NETWORK_ERROR. Consider an auto-degrade note that points the /mos:update skill straight to the native `/plugin` path rather than re-prompting.
  - Short-term patch: retry-with-backoff around fj() calls.
  - Long-term fix: have /mos:update, on NETWORK_ERROR, run the native `/plugin marketplace update` + `/plugin update` path itself instead of handing the user two commands to paste.
  - Reverify: re-read against origin/main HEAD before landing.

## Non-Code Follow-ups (route OFF code)

- F-B (install minisite): add a prominent step to the Node.js install instructions: UNCHECK "Automatically install the necessary tools (Tools for Native Modules)" in the Node MSI. MindrianOS ships no native modules; that checkbox triggers the multi-GB chocolatey/VS-Build-Tools install that was the single biggest time-sink in T1. This is the highest-leverage non-code fix in the sweep.
- F-E (install minisite prereqs): state plainly that MindrianOS requires a Claude Pro or Max subscription on a PERSONAL or non-managed account; corporate SSO/Okta-managed Claude plans block the in-CLI upgrade (T1: Ameet, Young, Joe all hit this). Give the "create a personal account, reimburse" path as the documented workaround.
- F-C: verify the marketplace-add transient is covered by resolved/doctor-marketplace-cache-drift-deadlock on beta.12; if the residual is "cannot add marketplace from inside a running Claude session", document the fresh-terminal recovery on the install page.
- F-D / F-F / F-G: roadmap items already owned by the maintainer (brain-key bake-in; natural-language dispatch replacing command sprawl; Phase 130 Python-to-CJS port). No new action beyond linking this sweep as field evidence.
- CHANGELOG.md: no entry yet (report-only; entries added when/if F-A and F-I ship).
- knowledge-base.md: add a summary block only on resolve.
- F-Q (install docs): add a one-line FAQ callout near the Windows npm step: an `EBADENGINE`
  warning during `npm install -g npm@...` is npm's own upgrade suggestion, unrelated to
  MindrianOS, safe to ignore. Doc-only, independent of Theo/Phase 269.
- F-U (install docs prereqs/FAQ): address Claude Code's third-party-plugin security warning head
  on -- what it means, why it appears, and that MindrianOS activates per-project (answer Gary's
  scope question in plain words), rather than routing around the warning. Same bucket as F-B/F-E.
- F-P + F-W cross-reference (explicit, by name): **Phase 269: Moat Shift -- Install/Update
  Entitlement Gate** (`.planning/ROADMAP.md` lines 555-570) repurposes the EXACT SAME
  mindrian-website auth-flow files this sweep's F-P root-caused (`components/brain/AuthButton.tsx`,
  `src/app/auth/callback/route.ts`, `next.config.ts`). Whoever picks up F-P's cross-origin
  session-cookie fix, or Phase 269's entitlement-gate build, should read the other first -- same
  files, same seam, two different reasons to touch them; building one without checking the other
  risks duplicating or clobbering that work. Phase 269 also obsoletes F-W's whole finding class
  (the query-time Brain-key request step) once shipped.
- F-X (open question, NOT resolved here): needs a real repro on a clean Windows box -- attempt a
  Vercel CLI install with the Node "Tools for Native Modules" checkbox UNCHECKED first; only if
  that repro genuinely fails should F-B's "uncheck it" advice be amended to carve out a Vercel
  exception. Do not amend F-B on the strength of the Interns' single report alone.

## Tests to Add or Update (when fixes land)

- Test 1 (F-A):
  - Type: unit
  - Location: tests/ (new) test-doctor-statusline-selftest-bash-invocation.cjs
  - Given: the effective statusline target is the plugin bash script.
  - When: the class-G isolated-execution step runs.
  - Then: the child is spawned via `bash` (not direct), and on a POSIX runner the probe returns 'ok'. Assert the argv[0] is bash. This is the Windows-repro-by-proxy (POSIX suites cannot exec-fail a bash script, so assert the INVOCATION SHAPE, not the platform).
- Test 2 (F-I):
  - Type: unit
  - Location: tests/ (new) test-check-version-network-retry.cjs
  - Given: fj() throws ECONNRESET on the first N-1 attempts then succeeds.
  - When: fetchLatestVersion() runs.
  - Then: it retries and returns the version; STATUS=NETWORK_ERROR only after retries exhaust.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: F-A and F-I confirmed and shipped 2026-08-11 as a quick-task fix pair. Both sites were
re-verified against origin/main HEAD first (the sweep's original reads were against branch
`claude/mindry-installation-xt5x2d` @ `aad6ba380f`, beta.12-era; main had moved ~40 commits). Both
findings' TECHNICAL ROOT CAUSE held unchanged at re-verify time:
  - F-A: lib/core/doctor/statusline-visibility-module.cjs moved (Phase 217 Plan 05 extracted the
    class-G check out of the doctor CLI's inline main() into this registry-driven module), but the
    defect itself was intact -- Step 3 still spawnSync()'d the resolved statusline-mos file path
    directly, never through `bash`, even though settings.json ships bash-wrapped.
  - F-I: scripts/check-version-and-sha.cjs's fetchLatestVersion() site was unchanged (same file,
    line numbers close to the original citation); still a single-shot fetch per URL, no retry.
fix:
  - F-A: Step 3's spawn now branches on the EFFECTIVE statusLine.command (user-level override,
    else plugin-level settings.json, else the shipped bash-wrapped default) -- if that command
    starts with `bash`, spawn `bash [statuslineMos]`; otherwise (a hypothetical native-executable
    override) direct-spawn as before. Matches the sweep's short-term patch exactly.
  - F-I: fetchJsonRetrying() wraps each of the two raw.githubusercontent.com fetches (catalog
    primary + plugin.json degraded fallback) in a bounded retry: 3 attempts, 250/500/1000ms
    backoff, firing ONLY on ECONNRESET/ETIMEDOUT/EAI_AGAIN. Non-transient failures (HTTP 4xx/5xx,
    malformed JSON) still throw on the first attempt, unretried -- STATUS=NETWORK_ERROR still
    surfaces immediately for those. The auto-degrade-to-`/plugin update` follow-up from the
    sweep's Required Code Changes section is NOTED, not implemented.
verification: TDD RED/GREEN for both. F-A: tests/test-doctor-statusline-selftest-bash-invocation.cjs
(2/2, PATH-shimmed fake `bash` proxies the Windows direct-exec failure on this POSIX runner by
recording the invocation shape and using a non-executable stand-in script). F-I:
tests/test-check-version-network-retry.cjs (5/5, hermetic fetchJson + sleep stubs -- transient
retry-then-success, bounded exhaustion, increasing backoff shape, non-transient no-retry
regression guard, and retry applied independently to both fetch legs). Pre-existing suites
(test-check-version-latest-resolution.cjs, test-check-version-semver-prerelease.cjs,
test-doctor-statusline-prefix-validator.cjs, test-statusline-visibility-self-heal.cjs,
test-doctor-class-h-topology-blind.cjs) all still pass unmodified. One unrelated pre-existing
failure was found during the regression sweep (test-doctor-legacy-config-pin-drift.cjs, Test 5
repositories-nested schema) -- confirmed out of scope (file untouched by this fix, fails
identically on HEAD before these commits); left for a separate session.
files_changed:
  - lib/core/doctor/statusline-visibility-module.cjs (F-A implementation)
  - scripts/check-version-and-sha.cjs (F-I implementation)
  - tests/test-doctor-statusline-selftest-bash-invocation.cjs (F-A test, new)
  - tests/test-check-version-network-retry.cjs (F-I test, new)
  - CHANGELOG.md ([Unreleased] Fixed entries)
commits: test(qa-sweep) RED x2, fix(qa-sweep) GREEN x2, plus two test-harness-bug-fix commits
(the bash shim's own shebang recursed via PATH; the backoff-shape test concatenated two
independent retry loops) -- see git log for exact SHAs.
