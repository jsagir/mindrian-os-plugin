---
quick_id: 260819-bql
phase: quick/260819-bql
plan: 01
type: execute
wave: 1
status: planned
depends_on: []
autonomous: true
requirements: [RCA-mcp-write-path-disabled-on-cli-host]
canon_parts: [9, 6]
files_modified:
  - lib/mcp/mcp-first-flag.cjs
  - lib/mcp/tools/graph.cjs
  - lib/mcp/tools/views.cjs
  - lib/mcp/tools/chain.cjs
  - docs/ENV-TUNING.md
  - tests/test-234-host-tier.cjs
  - tests/test-198-contract-schema.test.cjs
  - .planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md
  - .planning/debug/knowledge-base.md

must_haves:
  truths:
    - "On a Claude Code host with MINDRIAN_MCP_FIRST unset, graph_write / memory_event / artifact_file execute instead of returning write_path_disabled."
    - "An unidentified or pre-initialize client still gets a loud, actionable refusal on the wire, never a silent skip and never a fabricated success."
    - "Grok Build and OpenCode (the other tier1 hosts) keep the legacy refusal; an explicit MINDRIAN_MCP_FIRST still wins on every host."
    - "No doctrine comment, hint string, or test in the tree still claims Claude Code is refused."
    - "The three write tools remain in tools/list for every host identity (discovery stays separate from permission)."
  artifacts:
    - path: "lib/mcp/mcp-first-flag.cjs"
      provides: "isWritePathEnabled with claude-code -> true"
      contains: "tier.host === 'claude-code'"
    - path: "tests/test-234-host-tier.cjs"
      provides: "unit + live proof of the new gate and the surviving refusal path"
      contains: "write path ON"
    - path: ".planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md"
      provides: "the closed RCA, per the repo QA/RCA convention"
  key_links:
    - from: "lib/mcp/tools/graph.cjs"
      to: "lib/mcp/mcp-first-flag.cjs"
      via: "isWritePathEnabled inside writePathRefusal"
      pattern: "isWritePathEnabled\\(\\{ surface"
    - from: "lib/mcp/tools/views.cjs"
      to: "lib/mcp/mcp-first-flag.cjs"
      via: "isWritePathEnabled inside writePathRefusal"
      pattern: "isWritePathEnabled\\(\\{ surface"
    - from: "tests/test-234-host-tier.cjs"
      to: "bin/mindrian-mcp-server.cjs"
      via: "live stdio JSON-RPC drive varying clientInfo.name"
      pattern: "driveServer\\("
---

<objective>
Enable the MCP write path on a Claude Code host (RCA option A) so the three governed write
tools stop refusing on the home surface.

Purpose: the refusal is what provokes the bypass. graph_write, memory_event and artifact_file
all route through lib/core/navigation.cjs, the Canon Part 9 chokepoint. Refusing them on
Claude Code protects nothing, and the model's natural fallback is an ungoverned direct disk
write with no artifact_id injection and no memory_event journal row. That fallback is proven
live in this repo's own history (the run of "rethinking-mindrianos: file ..." commits).
Option A closes the loop by making the governed door usable where the traffic actually is.

Output: a one-line behavior flip in isWritePathEnabled, the doctrine prose and refusal hints
that depended on the old premise corrected, the Phase 234-05 suite re-pinned to the new truth
with the honest-refusal proof relocated to an unidentified client, and the RCA closed.

Source: .planning/debug/mcp-write-path-disabled-on-cli-host.md ("Required Code Changes",
option A, recommended). Option B is NOT taken.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/debug/mcp-write-path-disabled-on-cli-host.md
@lib/mcp/mcp-first-flag.cjs
@lib/mcp/surface-detect.cjs
@lib/mcp/tools/graph.cjs
@lib/mcp/tools/views.cjs
@tests/test-234-host-tier.cjs
</context>

<interfaces>
The contracts this plan touches, so no exploration is needed:

- `detectHostTier(clientVersion) -> { host: string, hostTier: 'tier0'|'tier1' }`
  (lib/mcp/surface-detect.cjs). Pure, total, argument-only. `claude-code` resolves to
  `{ host: 'claude-code', hostTier: 'tier1' }`; anything unrecognized, malformed, or
  `undefined` (the pre-initialize case) floors to `{ host: 'unknown', hostTier: 'tier0' }`.
  UNCHANGED by this plan.
- `isWritePathEnabled({ surface, clientVersion }) -> boolean`
  (lib/mcp/mcp-first-flag.cjs). The ONLY function whose behavior changes.
- `writePathRefusal(server, ctx) -> object|null` -- an independent copy in BOTH
  lib/mcp/tools/graph.cjs (line ~93) and lib/mcp/tools/views.cjs (line ~86). The disjoint-file
  tool-module contract means these two copies stay independent: edit both, do not factor them
  into a shared helper.
- `lib/mcp/tools/status.cjs` reads `isWritePathEnabled` for the `capability_floor` status
  segment. It needs NO edit; its reported value follows the gate automatically.
- `lib/mcp/tools/chain.cjs` does NOT call the gate. Only its explanatory comment is touched.
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Flip the gate and repair every comment and hint that encoded the old premise</name>
  <files>lib/mcp/mcp-first-flag.cjs, lib/mcp/tools/graph.cjs, lib/mcp/tools/views.cjs, lib/mcp/tools/chain.cjs, docs/ENV-TUNING.md</files>
  <action>
1. lib/mcp/mcp-first-flag.cjs, `isWritePathEnabled` (around line 114). Keep the shape and the
   ordering; change exactly one returned value. The final body reads: explicit flag check
   (`if (isMcpFirst(o.surface)) return true;`) unchanged; `const tier = detectHostTier(o.clientVersion);`
   unchanged; `if (!tier || tier.host === 'unknown') return false;` unchanged;
   `if (tier.host === 'claude-code') return true;` (was `return false`);
   `return tier.hostTier === 'tier0';` unchanged; the catch still floors to `false`.
   The unknown check MUST stay ahead of the claude-code check so an unidentified caller never
   reaches the new true branch.

2. Same file, the two doctrine comment blocks that now lie. Match the existing doctrine-comment
   voice (state the premise, state why it was wrong, state what holds now) and use double
   hyphens, never em-dashes.
   - The Phase 234-05 header block (lines ~54-77): the sentence "On Claude Code that is
     harmless: slash commands and hooks do the writing" was the load-bearing false premise.
     Correct it in place with a dated amendment: hooks log events, they do NOT file artifacts
     on the model's behalf, so a visible-but-always-refusing door produced a NEW failure mode
     the old registration-time gate never had, with "write to disk yourself" as the model's
     natural fallback (observed live, RCA
     .planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md).
   - The `isWritePathEnabled` JSDoc precedence list (lines ~84-100): rewrite to four cases.
     (1) an explicit MINDRIAN_MCP_FIRST naming this surface or 'all' -> true, on every host.
     (2) Claude Code -> true: these three tools ARE the governed Part 9 door, everything they
     do routes through navigation.cjs, so refusing them protected nothing and provoked an
     ungoverned bypass. (3) any other confidently-recognized Tier-0 host -> true (the original
     Gap D flip: Cursor, VS Code/Copilot, Goose, Zed, Cline, Continue, Windsurf, Devin).
     (4) everything else -> false, which is now exactly two populations: an UNKNOWN or
     pre-initialize client (an unidentified caller does not silently gain write access) and
     the other Tier-1 hosts (Grok Build, OpenCode: they have their own hook channel).
     Keep the existing "case N is NOT a silent skip", D-04 server-side governance, D-12
     host-capability-only, and never-throws paragraphs intact.

3. lib/mcp/tools/graph.cjs line 99 AND lib/mcp/tools/views.cjs line 92: the hint string
   'Set MINDRIAN_MCP_FIRST or connect from a recognized non-Claude-Code host once initialize
   completes.' now misdescribes the remaining false cases. Replace BOTH with the SAME new
   string, byte-identical across the two files:
   'Write path is off for this caller: the client is unidentified or has not completed
   initialize, or it is a tier1 host with its own hook channel (Grok Build, OpenCode). Set
   MINDRIAN_MCP_FIRST for this surface to override.'
   (single line in source, no em-dashes). Leave `reason: 'write_path_disabled'` and the
   isError flag untouched: only the hint text changes.

4. lib/mcp/tools/graph.cjs (header block ~lines 25-31) and lib/mcp/tools/views.cjs (header
   block ~lines 24-35): these describe the registration-vs-permission split, which still holds.
   Do not rewrite them; only add a one-line dated amendment noting that as of this fix
   Claude Code is on the permitted side of that gate, so the refusal path now serves
   unidentified clients and the other tier1 hosts.

5. lib/mcp/tools/chain.cjs (~lines 39-42): the sentence "isWritePathEnabled is false for Claude
   Code by design (its slash commands and hooks already do the writing), so gating chain_run on
   it would newly break the shipped chain executor for every Claude Code user" is now factually
   wrong in its premise. The CONCLUSION still stands (chain_run's gate ladder plus the ONE
   autonomy authority is a stronger, more specific control than a blanket write-path flag), so
   keep the conclusion and replace the reason: isWritePathEnabled answers "may this call write
   through navigation.cjs", which is a different question from "may this chain auto-run a
   material step", and conflating them would swap a specific control for a blanket one.

6. docs/ENV-TUNING.md, the `MINDRIAN_MCP_FIRST` table row at line 594: it currently frames the
   gate as being "for foreign MCP hosts". Add one sentence stating that since this fix the
   default-on population includes Claude Code itself, and the flag's remaining override value
   is for unidentified clients and the tier1 hosts that keep their own hook channel.

Constraints: CJS only. NO em-dashes anywhere in any edit; use hyphens or double hyphens.
Do not touch lib/mcp/tools/status.cjs (it reads the gate and follows it automatically) and do
not factor the two writePathRefusal copies together (the disjoint-file tool-module contract).
  </action>
  <verify>
    <automated>node -e "const {isWritePathEnabled}=require('./lib/mcp/mcp-first-flag.cjs'); delete process.env.MINDRIAN_MCP_FIRST; const cc=isWritePathEnabled({surface:'cli',clientVersion:{name:'claude-code'}}); const unk=isWritePathEnabled({surface:'cli',clientVersion:undefined}); const novel=isWritePathEnabled({surface:'cli',clientVersion:{name:'NeverSeenBefore'}}); const grok=isWritePathEnabled({surface:'cli',clientVersion:{name:'Grok Build'}}); const cur=isWritePathEnabled({surface:'cli',clientVersion:{name:'Cursor'}}); if(!(cc===true&&unk===false&&novel===false&&grok===false&&cur===true)) {console.error('gate wrong',{cc,unk,novel,grok,cur}); process.exit(1);} console.log('gate ok');"</automated>
    <automated>bash -c "test \$(grep -c 'non-Claude-Code host once initialize' lib/mcp/tools/graph.cjs lib/mcp/tools/views.cjs | grep -v ':0$' | wc -l) -eq 0 && test \$(grep -rn '—' lib/mcp/mcp-first-flag.cjs lib/mcp/tools/graph.cjs lib/mcp/tools/views.cjs lib/mcp/tools/chain.cjs docs/ENV-TUNING.md | wc -l) -eq 0 && echo 'prose ok'"</automated>
  </verify>
  <done>isWritePathEnabled returns true for claude-code and for tier0 hosts, false for unknown, novel, and the other tier1 hosts; the stale hint string appears nowhere; no em-dashes in any edited file.</done>
</task>

<task type="auto">
  <name>Task 2: Re-pin the tests to the new truth and relocate the honest-refusal proof</name>
  <files>tests/test-234-host-tier.cjs, tests/test-198-contract-schema.test.cjs</files>
  <action>
tests/test-234-host-tier.cjs is the suite that pins the old behavior, in two layers.

PART A5 (unit, lines ~185-240):
- Replace the "flag unset + claude-code -> write path OFF (legacy default preserved)" check
  (lines ~190-194) with its inverse: "flag unset + claude-code -> write path ON (the three
  write tools ARE the governed navigation.cjs door; refusing them provoked an ungoverned
  direct-disk bypass)" asserting `=== true`. Carry the reason in the preceding comment, in the
  file's existing voice.
- Leave every other A5 check as-is. The Cursor / VS Code / goose / Zed / Cline ON checks, the
  unknown -> OFF check (line ~210), the novel-unrecognized -> OFF check (line ~212), the
  Grok Build and OpenCode -> OFF checks (lines ~218-221), the explicit-flag-wins checks, and
  the malformed-input checks all remain correct under the new gate and must keep passing
  unedited. Note in a comment that the unknown and novel checks are now the LOAD-BEARING
  conservative floor, since claude-code no longer sits in the false population.
- The check at line ~231 ("MINDRIAN_MCP_FIRST=cli + claude-code on DESKTOP -> OFF") is now
  WRONG: with the flag naming only 'cli', a desktop call falls through to host detection,
  which now returns true for claude-code. Rewrite it to assert the surviving per-surface fact
  using a host that is still in the false population, for example
  `withFlag('cli', () => isWritePathEnabled({ surface: 'desktop', clientVersion: { name: 'Grok Build' } })) === false`,
  labelled "the flag is still per-surface (a flag naming only cli does not enable desktop)".

PART B (live JSON-RPC drive, lines ~411-506):
- The `claude` drive (line ~417) stays, but its assertions invert. Block B3 (lines ~454-464)
  currently proves claude-code is refused; change it to prove claude-code is PERMITTED:
  parseable payload, `reason !== 'write_path_disabled'`, `ok === true` (it reaches the real
  navigation.cjs write path against the hermetic room.db the harness already creates), and no
  `isError` on the wire.
- Block B4 (lines ~466-484): change
  "capability_floor on claude-code reports write_path_enabled false" to assert `=== true`, and
  relabel it "matches what graph_write did". Keep the tier1 identification check
  (`cf.host_tier.hostTier === 'tier1'`) as-is: the host axis is unchanged, only the permission
  derived from it moved.
- NEW third drive, so the refusal proof is not lost when its old subject changes sides. Add
  `const unidentified = await driveServer('SomeNewClientNeverSeenBefore');` beside the existing
  two, include it in the drive-completed loop at line ~419, and assert against it exactly what
  block B3 used to assert of claude-code: tools/list still contains graph_write, memory_event
  and artifact_file (discovery stays unconditional even where permission is refused);
  graph_write returns a parseable payload with `ok === false`,
  `reason === 'write_path_disabled'`, a non-empty string hint, and `result.isError === true`;
  and `capability_floor.write_path_enabled === false` with
  `host_tier.host === 'unknown'`. Add one stale-prose guard:
  `unidentifiedWrite.hint.indexOf('non-Claude-Code') === -1`, labelled so a future reader knows
  it exists to catch a hint that drifts back to describing the retired rule.
- Block B5 (lines ~486-506, explicit MINDRIAN_MCP_FIRST=all + claude-code) stays unchanged and
  must still pass. It now proves the flag path is redundant-but-intact on this host rather than
  the only way in.
- The file header comment (lines ~4-57): add a dated amendment block in the existing voice
  recording that Phase 234-05's claude-code default was reversed by this fix, why (the RCA:
  the visible-but-refusing door provoked ungoverned direct-disk writes; the three tools are the
  governed Part 9 door), and that the honest-refusal proof moved to the unidentified-client
  drive. Do not delete the original Gap D narrative; it is still the reason the tools are
  registered unconditionally.

tests/test-198-contract-schema.test.cjs: no assertion here pins host behavior (it locks
catalog equality, which is unaffected). Touch only the comment at lines ~122-123 if it reads as
though claude-code is the refusing case; a one-clause correction is enough.

Then run the suites. All three must exit 0.
  </action>
  <verify>
    <automated>node tests/test-234-host-tier.cjs</automated>
    <automated>node tests/test-198-contract-schema.test.cjs</automated>
    <automated>node tests/test-248-resolver-census.cjs</automated>
    <automated>bash -c "test \$(grep -rn '—' tests/test-234-host-tier.cjs tests/test-198-contract-schema.test.cjs | wc -l) -eq 0 && echo 'no em-dashes'"</automated>
  </verify>
  <done>test-234-host-tier.cjs passes with claude-code asserted true at both the unit and the live-wire layer, an unidentified-client drive proving the refusal still refuses out loud with the new hint, and the resolver-census plus contract-schema suites still green.</done>
</task>

<task type="auto">
  <name>Task 3: Close the RCA per the repo QA convention</name>
  <files>.planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md, .planning/debug/knowledge-base.md</files>
  <action>
Follow CLAUDE.md's "On resolve" rule.

1. `git mv` (or plain move, the path is gitignored so use `git add -f` where tracking is
   wanted) .planning/debug/mcp-write-path-disabled-on-cli-host.md to
   .planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md. Create the resolved/
   directory if it does not exist.
2. In the moved file: set `status: resolved` in the frontmatter, and replace the
   "DECISION REQUIRED" block under Required Code Changes with the decision actually taken -
   option A, dated 2026-08-19 - naming the one-line change in isWritePathEnabled, the two hint
   strings, the four comment blocks, and the test file re-pinned. Record which of the RCA's
   "Tests to Add or Update" landed: the unit and live claude-code -> true legs landed here; the
   seam test asserting a filed artifact carries BOTH an artifact_id and a memory_event row is
   NOT in this quick task, so leave it listed as an open follow-up rather than claiming it.
3. Append a summary block to .planning/debug/knowledge-base.md in that file's existing entry
   format: the symptom (write_path_disabled on the home host, model falls back to direct disk
   writes), the root cause (Phase 234-05 split discovery from permission but left the false
   premise "slash commands and hooks do the writing" encoded in the claude-code branch), the
   fix, and the durable lesson: a visible door that always says no is worse than a hidden one,
   because the model routes around it.
4. Record the release-lockstep reality in the resolved RCA, since it is easy to misread this as
   already live: a commit on main is NOT live for any running session. This ships only through
   scripts/release.sh, and even after release a session in flight keeps its cached plugin. Do
   not claim the live Larry flow is fixed until a release ships and is picked up.
5. Leave the RCA's "Non-Code Follow-ups" (sweeping rethinking-mindrianos for past direct-disk
   filings that are missing artifact_id) OPEN and explicitly listed. It is real work this task
   does not do.
  </action>
  <verify>
    <automated>bash -c "test -f .planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md && test ! -f .planning/debug/mcp-write-path-disabled-on-cli-host.md && grep -q 'status: resolved' .planning/debug/resolved/mcp-write-path-disabled-on-cli-host.md && grep -q 'mcp-write-path-disabled' .planning/debug/knowledge-base.md && echo 'rca closed'"</automated>
  </verify>
  <done>The RCA sits in resolved/ with status resolved, the decision and the still-open follow-ups recorded honestly, and a knowledge-base entry exists.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| MCP client -> server handler | `clientInfo.name` is client-supplied and unauthenticated; it crosses here and now selects a write permission |
| MCP write handler -> navigation.cjs | every write still passes the Part 9 chokepoint's own validation and CAS guard |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-BQL-01 | Elevation of privilege | `isWritePathEnabled` claude-code branch | accept | A client spoofing `clientInfo.name: 'claude-code'` gains the write path. This grants NOTHING new: T-234-08 already accepted the identical spoof against the tier0 list, so claiming 'Cursor' has granted write since Phase 234-05. The name is a UX/routing signal selecting a default convenience gate, never an authentication boundary, and the transport is a local stdio child process. |
| T-BQL-02 | Tampering | writes now reaching navigation.cjs from the home host | mitigate | Room resolution is untouched (lib/mcp/session-room.cjs stays the ONE resolver) and navigation.cjs keeps its validation plus the Phase 194 CAS reconcile guard. The live test drive writes into a hermetic tmp HOME and asserts the write lands, so "permitted" is distinguished from "permitted but nowhere to write" (no_room_db). |
| T-BQL-03 | Repudiation | untracked artifacts written directly to disk | mitigate | This is the threat the fix EXISTS to close: the ungoverned fallback produced artifacts with no artifact_id and no memory_event row. Routing through the governed door restores both. Residual: filings already made before this ships stay unreconciled, tracked as an open non-code follow-up in the resolved RCA. |
| T-BQL-04 | Information disclosure | Canon Part 8 Brain boundary | accept | No change: mcp-first-flag.cjs reads process.env only, detectHostTier is argument-only, and no edited path acquires a network or Brain token. Zero egress surface added. |

No package-manager installs occur in this plan, so the supply-chain legitimacy gate does not apply.
</threat_model>

<verification>
- `node tests/test-234-host-tier.cjs` exits 0 (unit + live wire, both layers re-pinned).
- `node tests/test-198-contract-schema.test.cjs` exits 0 (catalog equality unaffected).
- `node tests/test-248-resolver-census.cjs` exits 0 (census.2 still holds: the only executable
  `isMcpFirst(` call outside its own definition remains the internal one inside
  isWritePathEnabled).
- No em-dashes in any edited file.
- Canon Part 8: no edited path gains network or Brain reach.
- Canon Part 9: the fix strengthens the chokepoint rather than adding a second write road.
- Tri-Polar: CLI, Desktop and Cowork now behave identically for the write path on a recognized
  host, which is the RCA's stated Tri-Polar gate.
</verification>

<success_criteria>
- A Claude Code session with MINDRIAN_MCP_FIRST unset can call graph_write, memory_event and
  artifact_file and have them execute through navigation.cjs.
- An unidentified or pre-initialize client is still refused, out loud, with an accurate hint.
- Grok Build and OpenCode are unchanged; the explicit flag still wins on every host.
- No comment, hint, doc line, or test in the tree still asserts the retired claude-code refusal.
- The RCA is closed with its remaining follow-ups (the artifact_id + memory_event seam test,
  the rethinking-mindrianos reconciliation sweep) left honestly open.
</success_criteria>

<notes>
NOT LIVE UNTIL RELEASED. A commit on main does not reach any running session: this ships only
via `scripts/release.sh <version>` (the five-gate lockstep), and a session already in flight
keeps its cached plugin even after a release lands. Fold this into the next release rather than
reporting the live Larry flow as fixed at merge time.
</notes>

<output>
Create `.planning/quick/260819-bql-fix-mcp-write-path-disabled-on-claude-co/260819-bql-SUMMARY.md` when done.
</output>
