---
status: gathering            # gathering | investigating | fixing | resolved
kind: qa-sweep               # rca | debug-session | qa-sweep
trigger: "windows-install-and-field-qa-sweep-2026-08-10"
issue_id: ""
severity: medium             # blocker | high | medium | low (roll-up; per-finding severity below)
surfaces: [cli]              # cli | desktop | cowork
brain_mode: full-loop        # full-loop | local-only | tier-0
canon_parts: [6, 7, 12]      # 6 dog-fooding, 7 reuse-before-build, 12 pedagogy (statusline trust)
created: 2026-08-10T16:00:00Z
updated: 2026-08-10T20:30:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Two real-world Windows sessions (a live group install call and a JHU-TA field-use session) surface a cluster of install and first-run UX defects. Most are already-tracked Windows-shell-assumption bugs; two are freshly grounded code gaps (doctor statusline self-test spawn, update-checker no-retry); several are non-code ENV/DOC gaps.
test: Classify every symptom WORKING / KNOWN-tracked / FIXED-already / ENV-GAP / NEW / HYPOTHESIS against the repo and the existing .planning/debug corpus.
expecting: A per-finding table where only NEW/HYPOTHESIS items warrant a fresh /gsd:debug session; KNOWN items link to their existing session; ENV/DOC items route to the install minisite, not code.
next_action: Human review of this sweep before any fix is opened (user directive: full RCA report only, no code changes yet).

## Source-of-Truth Preamble

- **CODE claims read against:** branch `claude/mindry-installation-xt5x2d` @ `aad6ba380fff2ec6acb05dc50bc347c7639f846b` (working tree; package.json version 1.16.0-beta.12).
- **WIRE / FIELD claims read against:** two primary-source transcripts - (T1) a group install video call (Jonathan + Ameet/Joe/Young/Wen/Reuben), Windows boxes, plugin era v1.16.0-beta.x; (T2) a Claude Code field-use session pasted 2026-08-10 (tester "David", `davidsamuel@karunya.edu.in`, Windows, install cache v1.16.0-beta.7, room `mindrian-consultant` then `msem-innovation-ta`). T2 carries a Larry-authored "what worked / what did not work" briefing used here as evidence.
- **Date of audit:** 2026-08-10
- **Re-verification rule:** the two grounded code findings (F-A, F-I) were read against the branch working tree, NOT `origin/main` HEAD, and NOT against the testers' beta.7 install cache. Both are tagged `needs-source-reverify`: re-confirm against `origin/main` HEAD before either lands as a fix. The testers ran beta.7; the branch is beta.12; an unbounded fix-delta may already cover part of any finding (the 2026-05-23 stale-cache false-positive pattern).

Checklist:
- [x] Source-of-Truth Preamble filled before any finding filed

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

- timestamp: 2026-08-10T20:30:00Z
  checked: LIVE Brain from an egress-open machine (cross-session handoff from the brain repo; pws-brain-mcp.onrender.com; read-tier holder key), minutes before this sweep's own sandbox test.
  found: Brain is UP and answering. AVAIL-01 probe PASS end-to-end: initialize 200 -> brain_query 200 returning frameworkCount 181 -> search 200 (e5 sidecar warm) -> brain_write correctly 403 (write gate holds). ~26s incl cold e5 load. CALL pagerank.get() YIELD returned real ranked rows through the new bounded read tier (bounded by the outer LIMIT). b2 live suite 5/5 green.
  implication: RESOLVES this sweep's earlier open question ("what it does NOT tell us: whether the live Brain is up"). It IS up. Therefore this sandbox's own 403 is CONFIRMED to be the agent-proxy CONNECT refusal alone - nothing plugin-side, nothing Brain-side. The client's honest-refusal shape (wired, fails safe, degrades per Canon) is correct QA signal, not a Brain outage.

- timestamp: 2026-08-10T20:30:00Z
  checked: Brain /register production status (cross-session handoff).
  found: POST /register was 503-broken in production (missing NOT-NULL email column) until commit ecf3a3b, deployed the evening of 2026-08-10. Today is register's first working day.
  implication: this sweep's auto-register leg (brain-client ensureAvailable -> _tryAutoRegister) would have failed even WITH open egress before today. When re-run on an egress-open machine, that run tests register's first working day; a failure THERE is a fresh finding, NOT the sandbox block (F-P). Do not retro-attribute a future register failure to the proxy.

## Findings Table

| ID | Finding | Source | Class | Severity | Route |
|----|---------|--------|-------|----------|-------|
| F-A | doctor statusline self-test spawns the bash script directly, not via `bash` -> Windows false "spawn error" | T1 | NEW-site of KNOWN family (windows-posix-shell-assumption-installer-statusline) | low | code (needs-source-reverify) |
| F-B | Node MSI "Tools for Native Modules" installs Python + VS Build Tools (the blue PowerShell hang); MindrianOS needs none | T1 | ENV-GAP | high (time-sink) | DOC (install minisite) |
| F-C | "Failed to add marketplace" needs a full terminal restart to clear | T1 | KNOWN (resolved/doctor-marketplace-cache-drift-deadlock) | medium | verify / DOC |
| F-D | Manual Brain-API-key step | T1 | WORKING as-designed (maintainer: next update bakes it in) | low | roadmap |
| F-E | Corporate/Okta-managed Claude plan blocks the required subscription upgrade | T1 | ENV-GAP (Anthropic-side) | medium | DOC (prereqs) |
| F-F | Command proliferation; users cannot tell MOS commands from native, or which to run | T1 | KNOWN (every-mos-command-unknown) + roadmap (NL dispatch) | medium | roadmap |
| F-G | First room creation slow (installs Python mid-session) | T1 | KNOWN by-design (Phase 130 CJS-port planned) | low | roadmap |
| F-H | Terminal focus/paste quirks (Enter ignored until mouse click) | T1 | ENV-GAP (Claude Code Windows terminal) | low | none |
| F-I | `/mos:update` aborts on a single ECONNRESET with no retry / no auto-degrade | T2 | NEW (grounded) | medium | code (needs-source-reverify) |
| F-J | PPTX not natively readable; python-pptx shell-out, silent break if absent | T2 | NEW / ENH | medium | code/DOC |
| F-K | Recurring guardian error every Stop: "trace_missing_field, glyph low; 32 violations across 1 section" | T2 | HYPOTHESIS (needs repro) | medium | investigate |
| F-L | `USER.md` "Error writing file" during room birth | T2 | HYPOTHESIS (needs repro) | medium | investigate |
| F-M | Room-health inconsistency ("0 sections scanned / health --" then "3 sections / health low") | T2 | HYPOTHESIS (family: intern-w1-state-not-recomputed) | low | investigate |
| F-N | Session-start "1 setup issue: MCP - /doctor" | T2 | HYPOTHESIS (family: mcp-servers-cache-missing-node-modules, doctor-brain-smoke-win-crash) | low | investigate |
| F-O | `/ignite` hit a bug and self-healed mid-session | T1 | HYPOTHESIS (insufficient error text) | low | investigate |
| F-P | Cloud/CI sandbox proxy denies CONNECT to the Brain host (403 at tunnel); the client's honest-refusal shape must not be read as a dead Brain in CI reports | this session (Brain verified UP from egress-open machine) | ENV-GAP + REPORTING-CAVEAT (NOT a defect; Brain healthy) | medium | DOC / mandatory caveat |

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
- F-P (MANDATORY QA-reporting caveat; verified against a live healthy Brain): "Cloud/CI sandbox proxies deny CONNECT to pws-brain-mcp.onrender.com (403 at the tunnel). The client's 'registration failed (HTTP 403, offline or unreachable)' is the CORRECT honest-refusal shape for this case - but any sandbox-run QA that reports Brain legs as degraded MUST carry this caveat, or a healthy Brain reads as a dead one in CI reports." The point: the failure mode this milestone kept finding is TRUE STATES MISLABELED. A CI report saying "Brain degraded" when the Brain is fine is that same bug wearing a different hat. Add this caveat line to any audit template that runs Brain probes in a sandbox (RCA-TEMPLATE Source-of-Truth Preamble is the natural home).
- Probe policy (do NOT build a new probe): two probes already exist, one per side of the wire. Brain-side: scripts/probe-live-tool-call.mjs (brain repo; four legs; distinct exit codes; exit 5 = write gate open). Plugin-side: scripts/probe-brain-contract.cjs through the SHIPPED client - the AVAIL-01 doctrine reference probe precisely because the beta.13 outage was visible only through the shipped client. A third probe would be a third thing to drift. For the one-command sandbox PASS/BLOCKED readout: wrap the shipped-client probe (scripts/probe-brain-contract.cjs) with the proxy-CONNECT pre-check demonstrated in this session (curl the Brain host through $HTTPS_PROXY; a 403 CONNECT means BLOCKED-BY-SANDBOX, print that verdict and skip the degraded-Brain interpretation). That pre-check is the ONLY genuinely new piece; everything else reuses the shipped probe.
- CHANGELOG.md: no entry yet (report-only; entries added when/if F-A and F-I ship).
- knowledge-base.md: add a summary block only on resolve.

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

root_cause: (pending human review; report-only per user directive)
fix: none applied - this is a gathering-stage sweep. Two grounded code findings (F-A, F-I) and two high-leverage DOC findings (F-B, F-E) are the actionable head of the list; the rest are KNOWN/roadmap/HYPOTHESIS. F-P is a reporting caveat, not a defect.
brain_status: LIVE BRAIN CONFIRMED HEALTHY (2026-08-10, cross-session handoff from the brain repo) - frameworkCount 181, AVAIL-01 PASS end-to-end, pagerank bounded-read-tier live, b2 5/5 green, brain_write correctly 403. This sweep's own 403 was the sandbox proxy CONNECT refusal ALONE (F-P). Register (/register) fixed at ecf3a3b and deployed the evening of 2026-08-10 - re-runs on an egress-open machine test register's first working day.
verification: sandbox side - proxy CONNECT to pws-brain-mcp.onrender.com returns 403 (curl through $HTTPS_PROXY). Egress-open side - AVAIL-01 PASS (see Evidence, 2026-08-10T20:30:00Z). Recommended sandbox one-command readout: wrap scripts/probe-brain-contract.cjs with the proxy-CONNECT pre-check (F-P follow-up); do not build a new probe.
files_changed: none
commits: this sweep file only
