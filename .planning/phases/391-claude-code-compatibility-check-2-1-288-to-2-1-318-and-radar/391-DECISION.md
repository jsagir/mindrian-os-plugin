# Phase 391 - Owner decision cards for Claude Code 2.1.288 to 2.1.318 (plan 391-04)

Date: 2026-11-08. Status: AWAITING OWNER ANSWERS. Nothing is applied. No agent, skill, hook or command file was edited by plan 391-04.
Facts and marks (PROVEN, CITED, UNVERIFIED) come from 391-CHECKS.md, 391-agent-table.tsv, 391-probe-plugin-names.json and 391-probe-guard-timing.json.

## 1. Summary

- The checks found nothing that breaks the plugin outright. The radar fetch bug is fixed by plans 391-01, 391-03, 391-05 and 391-06.
- Six changes would alter behavior. Each is a card below (Canon Part 3: a material choice needs an owner answer first).
- Recommended tokens, each chosen by the rule written in its card: C1 APPLY-ALL, C2 APPLY, C3 APPLY-NARROW-BASH, C4 FILE-SEED, C5 REMOVE, C6 LAG-20.
- Plans 391-07 (cards C1 and C5) and 391-08 (cards C2, C3, C4, C6) apply an edit only after the answers are recorded and the gate passes.

## 2. How to answer

Tokens by card (one token each):
- C1 agent tools lists: APPLY-ALL | APPLY-NO-WRITE-GROUP | FIX-COMMENTS-ONLY | DEFER | NO
- C2 onFailure on the web credential hook: APPLY | DEFER | NO
- C3 Bash grant for the radar command: APPLY-NARROW-BASH | APPLY-BARE-BASH | DEFER | NO
- C4 /ultrareview facts: NO-ACTION | FILE-SEED | DEFER
- C5 mcp__brain_* token: LEAVE | REMOVE | DEFER
- C6 doctor ledger default lag: LAG-10 | LAG-20 | KEEP-40

The main session writes the tokens into the C{N}-OWNER-ANSWER lines and commits that one edit. Every answer line says PENDING now. The checker `node 391-card-check.cjs gate 391-DECISION.md N` returns READY, NOEDIT, PENDING, BLOCKED-TOKEN, BLOCKED-HASH or BLOCKED-HEAD for each card. The apply plans stop with no change on any state except READY or NOEDIT.

## 3. Cards

### C1 - tools lists on 13 agents (plugin-scoped MCP names)

What changes: 13 agent files get a `tools:` list, so the host enforces the tool set that `allowed-tools:` only suggests today.

Facts:
- The host reads `tools:` and ignores `allowed-tools:` for these 13 agents; each runs with every tool today. PROVEN (host debug log on 2.1.319: "does not recognize or apply"; 391-RESEARCH.md check a).
- Comment lines in 5 files say the agent cannot write or has no Write or Brain tool: analogy-query-fetcher, chain-step-reviewer, competitor-watch-fetcher, meeting-perspective-extractor, vault-section-reviewer (391-agent-table.tsv, column claim_lines). At the host level those claims are not true today. PROVEN.
- A plugin agent with `tools: Read, mcp__plugin_mos391probe_mindrian-brain__*` kept Read plus the 6 Brain tools. An agent with `tools: Read, mcp__mindrian-brain__*` kept only Read. PROVEN (391-probe-plugin-names.json, 4 claude -p calls).
- Plugin-scoped names follow mcp__plugin_PLUGIN_SERVER__TOOL; for plugin name mos: mcp__plugin_mos_mindrian-brain__brain_ask. PROVEN by substitution of the plugin name; not probed with the real plugin.
- Entries for user-level servers (tavily, tavily-mcp, pinecone-brain) stay as written. They are user scope and outside the plugin. The plugin does not control whether those servers exist on a user machine.
- The body of each of the 13 files names no tool outside its list (391-agent-table.tsv, column body_tools_outside_list, empty for all 13 rows after hand review). PROVEN for named tools; a tool a body uses without naming it is UNVERIFIED.
- UNVERIFIED: the Desktop copy is published as marketplace entry mos-desktop. If the host builds the name prefix from the entry name, a list written for mos strips Brain tools on that copy.

Options:
- APPLY-ALL: a `tools:` list on all 13 agents (rewritten MCP names). Each agent then uses only the listed tools.
- APPLY-NO-WRITE-GROUP: a `tools:` list on the 9 NW rows (no Write, Edit, MultiEdit, Bash). On the 4 W rows (framework-runner, opportunity-scanner, persona-analyst, research) add one comment line `391-NOTE-allowed-tools-not-enforced` with a short plain sentence above `allowed-tools`, so no agent is left unacknowledged.
- FIX-COMMENTS-ONLY: add the same note line to all 13 files; no `tools:` list. The false "structurally cannot" claims are then marked, no behavior changes.
- DEFER: no change now; the card stays open.
- NO: keep today's state and accept it.

Risk: an agent loses a tool it uses today if its body relies on a tool that is not in its list (checked by name only), or if the plugin name prefix differs on a surface (see UNVERIFIED above). Agents that lose their Brain tools return an honest refusal to the caller, not a wrong answer.

Recommendation: APPLY-ALL. Rule: APPLY-ALL when the probe PROVED the naming and the body-outside-list column is empty for every row; APPLY-NO-WRITE-GROUP when it is empty only for the NW rows; otherwise FIX-COMMENTS-ONLY. Both conditions hold. Caveat for the owner: the Desktop copy name is UNVERIFIED; choose APPLY-NO-WRITE-GROUP or DEFER if that matters more than closing the gap.

Edit list (one row per agent: path | group | allowed-tools now | tools to write | body tools outside the list):

<!-- C1-EDIT-LIST-BEGIN -->
agents/analogy-query-fetcher.md | NW | now: mcp__tavily__tavily-search, WebSearch, Read | write: tools: mcp__tavily__tavily-search, WebSearch, Read | body-outside-list: none
agents/brain-query.md | NW | now: mcp__mindrian-brain__brain_ask, mcp__mindrian-brain__brain_search, mcp__pinecone-brain__search-records, Read | write: tools: mcp__plugin_mos_mindrian-brain__brain_ask, mcp__plugin_mos_mindrian-brain__brain_search, mcp__pinecone-brain__search-records, Read | body-outside-list: none
agents/chain-step-reviewer.md | NW | now: Read | write: tools: Read | body-outside-list: none
agents/competitor-watch-fetcher.md | NW | now: mcp__tavily__tavily-search, WebSearch, Read | write: tools: mcp__tavily__tavily-search, WebSearch, Read | body-outside-list: none
agents/framework-runner.md | W | now: Read, Write, Bash, Glob | write: tools: Read, Write, Bash, Glob | body-outside-list: none
agents/grading.md | NW | now: mcp__mindrian-brain__brain_ask, mcp__mindrian-brain__brain_search, Read | write: tools: mcp__plugin_mos_mindrian-brain__brain_ask, mcp__plugin_mos_mindrian-brain__brain_search, Read | body-outside-list: none
agents/grant-reviewer.md | NW | now: Read, Glob | write: tools: Read, Glob | body-outside-list: none
agents/investor.md | NW | now: mcp__mindrian-brain__brain_ask, mcp__mindrian-brain__brain_search, mcp__pinecone-brain__search-records, Read | write: tools: mcp__plugin_mos_mindrian-brain__brain_ask, mcp__plugin_mos_mindrian-brain__brain_search, mcp__pinecone-brain__search-records, Read | body-outside-list: none
agents/meeting-perspective-extractor.md | NW | now: Read | write: tools: Read | body-outside-list: none
agents/opportunity-scanner.md | W | now: Read, Write, Glob, Bash, WebSearch, mcp__tavily-mcp__tavily-search, mcp__tavily-mcp__tavily-extract | write: tools: Read, Write, Glob, Bash, WebSearch, mcp__tavily-mcp__tavily-search, mcp__tavily-mcp__tavily-extract | body-outside-list: none
agents/persona-analyst.md | W | now: Read, Write, Glob, WebSearch, WebFetch, mcp__mindrian-brain__brain_search, mcp__mindrian-brain__brain_query | write: tools: Read, Write, Glob, WebSearch, WebFetch, mcp__plugin_mos_mindrian-brain__brain_search, mcp__plugin_mos_mindrian-brain__brain_query | body-outside-list: none
agents/research.md | W | now: mcp__tavily-mcp__tavily-search, mcp__tavily-mcp__tavily-extract, mcp__mindrian-brain__brain_ask, mcp__mindrian-brain__brain_search, mcp__pinecone-brain__search-records, Read, Write | write: tools: mcp__tavily-mcp__tavily-search, mcp__tavily-mcp__tavily-extract, mcp__plugin_mos_mindrian-brain__brain_ask, mcp__plugin_mos_mindrian-brain__brain_search, mcp__pinecone-brain__search-records, Read, Write | body-outside-list: none
agents/vault-section-reviewer.md | NW | now: Read | write: tools: Read | body-outside-list: none
<!-- C1-EDIT-LIST-END -->

C1-ALLOWED: APPLY-ALL | APPLY-NO-WRITE-GROUP | FIX-COMMENTS-ONLY | DEFER | NO
C1-NOEDIT: DEFER | NO
C1-RECOMMENDED: APPLY-ALL
C1-LIST-SHA256: 6a86cb6c3c0d4a132b3e99fba46fe31f0455addc5fe3ae9c2147fef8e1101789
C1-HEAD-AT-DECISION: 7dce93392b39d754490c2617414f6e83c73dcca5
C1-OWNER-ANSWER: APPLY-ALL

### C2 - onFailure block on the web credential hook

What changes: `hooks/hooks.json` gets `"onFailure": "block"` on the PreToolUse hook that runs `scripts/web-credential-guard-hook.cjs`. A timeout or a start failure of that hook then blocks the web call instead of letting it go.

Facts:
- The host honors onFailure: with "block", a hook that exits 1, times out or has a missing script blocks the call; without it the call goes ahead. PROVEN on 2.1.319 (7 arms, n=1 each, haiku, `claude -p`; 391-RESEARCH.md check b).
- The script already fails closed after it reads its input (plan 386-29, option a). It cannot cover a timeout or a start failure; onFailure covers those two. PROVEN by reading the script header.
- Owner ruling 2026-10-05 (plan 386-36): web lines get a credential check only, no content scan. The card does not change that.
- Measured time of the web guard: first run 25.5 ms, warm p50 24.8 ms, p95 26.8 ms, max 27.3 ms, against a 5000 ms limit. PROVEN (391-probe-guard-timing.json; synthetic payload, scratch HOME). Reboot-cold time and host spawn cost are UNVERIFIED.
- Phase 384 has 20 PLAN and 20 SUMMARY files on disk. 384-20 closed PARTIAL-REVERTED (NO-GAIN). No 384 VERIFICATION file exists. Neither 384-20-SUMMARY.md nor 384-OWNER-DECISIONS.md speaks about the guard hooks. PROVEN by reading.
- The egress guard already has onFailure block (hooks.json line 214) and the same 5000 ms limit.

Options:
- APPLY: add onFailure block to the web credential hook; update the three tests listed.
- DEFER: no change; revisit after more timing data.
- NO: keep fail open on timeout and start failure for web calls.

Risk: after APPLY, a slow machine (the 5000 ms limit is passed) or a broken install blocks every WebSearch, WebFetch and Tavily call until fixed. Observers are never touched.

Recommendation: APPLY. Rule: APPLY when the warm p95 of the web guard is at most 1000 ms and its first run is at most 2500 ms (half of the 5000 ms limit) and Phase 384 is closed on disk; otherwise DEFER. Measured p95 26.8 ms, first run 25.5 ms, 20 of 20 plans with summaries: the rule gives APPLY.

Edit list:

<!-- C2-EDIT-LIST-BEGIN -->
hooks/hooks.json | add "onFailure": "block" to the PreToolUse hook whose command runs scripts/web-credential-guard-hook.cjs (timeout stays 5)
tests/test-386-web-credential-hook.cjs | arm WH5 | require onFailure equal to block (today it requires no onFailure)
tests/test-261029-qef-hook-timeouts.cjs | arm A5 | pin both guard hooks (egress guard and web credential guard) as the only hooks with onFailure, value block
tests/test-391-hooks-contract.cjs | arm H5 | the set of hooks with onFailure becomes both guard hooks, value block
<!-- C2-EDIT-LIST-END -->

C2-ALLOWED: APPLY | DEFER | NO
C2-NOEDIT: DEFER | NO
C2-RECOMMENDED: APPLY
C2-LIST-SHA256: 76bc1c13d83b3da2ba9774d02cb17d0e7eb3dabe584d0fe51f5ac65fc68c9321
C2-HEAD-AT-DECISION: 7dce93392b39d754490c2617414f6e83c73dcca5
C2-OWNER-ANSWER: APPLY

### C3 - Bash in the allowed-tools of the radar command

What changes: `commands/radar.md` gets a Bash grant so the new local slicer script (`scripts/radar-changelog-slice.cjs`, plan 391-03) can run without a permission prompt. The generated mirror `skills/radar/SKILL.md` changes with it.

Facts:
- allowed-tools in a skill or command is a pre-approval for the turn. It does not restrict the tool set; every tool stays callable behind the normal permission flow. CITED (https://code.claude.com/docs/en/skills.md, read 2026-11-08). Commands are merged into skills with the same frontmatter. CITED.
- A Bash pattern is accepted there, and `${CLAUDE_PLUGIN_ROOT}` is substituted in the Bash rules of a plugin skill (docs example: `Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)`). CITED for plugin skills. For a file under commands/ it is inferred from the merge note: UNVERIFIED.
- The trailing `:*` is an equivalent way to write the trailing wildcard (https://code.claude.com/docs/en/permissions.md). CITED. The entry below uses the space-star form shown on the skills page.
- The script now exists (plan 391-03, commit 7dce93392). It is always called with arguments (`--list`, then `--approve TOKEN`), so the trailing wildcard form matches its calls. PROVEN by reading the script header.
- The script is ask-first with a token in the command body and it has a typed exit when coverage is incomplete (plans 391-03 and 391-06). Without the grant the script still runs: the host asks permission once per run.
- Whether a rule with quotes around the path matches the command text the body tells Claude to run is UNVERIFIED. The body text and the rule must read the same after variable substitution; plan 391-08 checks this against the final radar.md.
- tests/test-391-radar-command-contract.cjs does not exist yet (plan 391-06 creates it); its arm P8 expected set is part of the edit list.

Options:
- APPLY-NARROW-BASH: add the single entry `Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/radar-changelog-slice.cjs" *)`. Only this script is pre-approved.
- APPLY-BARE-BASH: add the bare entry `Bash`. Every shell command is pre-approved while the command runs. Wider than needed.
- DEFER: no change. Cost: one host permission prompt per run of the radar fetch. No code change.
- NO: same effect as DEFER, recorded as a final choice.

Risk: a bare Bash grant lets the command run any shell command without a prompt for that turn. The narrow entry carries a small risk that the rule text does not match the command text; then the host asks as without the grant.

Recommendation: APPLY-NARROW-BASH. Rule: APPLY-NARROW-BASH when the docs check verified the pattern form; otherwise DEFER. The docs verified the pattern form and the plugin root variable for plugin skills.

Edit list:

<!-- C3-EDIT-LIST-BEGIN -->
commands/radar.md | allowed-tools | APPLY-NARROW-BASH adds the list item 'Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/radar-changelog-slice.cjs" *)' | APPLY-BARE-BASH adds the list item Bash
tests/test-265-radar-writes-ledger.cjs | arm 6 | the expected allowed-tools set gains the same entry
tests/test-391-radar-command-contract.cjs | arm P8 | the expected allowed-tools set gains the same entry
skills/radar/SKILL.md | generated by node scripts/build-skill-mirrors.cjs from commands/radar.md; dist/ is not regenerated (stale since beta.52)
<!-- C3-EDIT-LIST-END -->

C3-ALLOWED: APPLY-NARROW-BASH | APPLY-BARE-BASH | DEFER | NO
C3-NOEDIT: DEFER | NO
C3-RECOMMENDED: APPLY-NARROW-BASH
C3-LIST-SHA256: fa41d6e60c7e05903f2d1da52a4109158a2de759ddb02036773024885a6997b1
C3-HEAD-AT-DECISION: 7dce93392b39d754490c2617414f6e83c73dcca5
C3-OWNER-ANSWER: APPLY-NARROW-BASH

### C4 - /ultrareview (facts only; this phase decides nothing)

What changes: nothing in the plugin. The card puts the facts in front of the owner. The only possible edit is a seed file.

Facts (https://code.claude.com/docs/en/ultrareview.md, read 2026-11-08, CITED unless marked):
- The command is `/code-review ultra`; `/ultrareview` is an alias when it is available to the account. It runs as a cloud session on Anthropic infrastructure.
- A branch review "bundles the repository state and uploads it to a cloud sandbox", with uncommitted and staged changes. PR mode clones the pull request from github.com and uploads nothing from the working tree.
- Files named like credentials (such as `.env` and `*.tfvars`) follow the rules of the upload page for cloud sessions; the exact rule is on that page.
- Not available on Bedrock, Vertex, Foundry, Zero Data Retention organizations or the HIPAA configuration; a local review runs instead.
- It needs a claude.ai login. Pro, Max and Ultra plans get 3 free runs per account (one time), then usage credits, "typically $5 to $25" per review.
- A disable switch (managed setting, environment variable, permission rule): none found in the ultrareview, permissions, skills and hooks pages. UNVERIFIED.
- Changelog trail (untrusted text, for the owner to verify): 2.1.290 uncommitted-change handling; 2.1.292 and 2.1.295 files under ~/.claude/seed-admin; 2.1.299 no longer suggests `git add .`; 2.1.309 workspace-trust requirement for `claude ultrareview`; 2.1.314 trust check before git, refusal at once when CI is set.
- Repo facts: the plugin ships no ultrareview wiring. Mentions exist only in references/capability-radar/capabilities-index.md and lib/memory/render-v2-disposition.test.cjs. PROVEN by grep.
- Part 8 question in one sentence: a branch review uploads the working tree of whatever repo it runs in, so a Data Room folder that is a git repository would leave the machine.

This phase makes no decision about /ultrareview.

Options:
- NO-ACTION: record that the owner has read the facts; nothing is filed.
- FILE-SEED: create one seed file with the Part 8 question and the facts, so a later phase can decide.
- DEFER: leave the card open.

Risk: none in the plugin. A user who runs `/ultrareview` inside a git-tracked Data Room uploads the folder; only the owner can decide whether the plugin should warn about it.

Recommendation: FILE-SEED (a suggestion only; the phase decides nothing). Rule: file a seed when a Part 8 question has no home yet; the repo has no ultrareview seed.

Edit list:

<!-- C4-EDIT-LIST-BEGIN -->
.planning/seeds/SEED-<next free number>-ultrareview-uploads-the-working-tree-part-8-question.md | create
<!-- C4-EDIT-LIST-END -->

C4-ALLOWED: NO-ACTION | FILE-SEED | DEFER
C4-NOEDIT: NO-ACTION | DEFER
C4-RECOMMENDED: FILE-SEED
C4-LIST-SHA256: 34fc0449be1b1a4979a6a825afc347e1953f7a2bf7afb3f20e0a5c0348fea70a
C4-HEAD-AT-DECISION: 7dce93392b39d754490c2617414f6e83c73dcca5
C4-OWNER-ANSWER: FILE-SEED

### C5 - the token mcp__brain_* in skills/intelligence-orchestrator/SKILL.md

What changes: line 20 of the skill reads `allowed-tools: Read Bash Agent WebSearch WebFetch mcp__pinecone__search-docs mcp__brain_*`. The card is about the last token.

Facts:
- The token matches no tool of the plugin servers. The plugin servers are mindrian-os and mindrian-brain (.mcp.json); their tools are named mcp__plugin_mos_mindrian-brain__* and mcp__plugin_mos_mindrian-os__*. PROVEN.
- It would match a tool of a server named brain or starting with brain_. Server names were read (names only, no values): .mcp.json has mindrian-os and mindrian-brain. ~/.claude.json has 24 top-level server entries and 16 project-level entries on this machine. No name is brain or begins with brain_. PROVEN on this machine; other machines are UNVERIFIED.
- The docs say an allow glob is valid only after a literal `mcp__<server>__` prefix with a glob-free server segment; an unanchored allow glob "is skipped and doesn't auto-approve anything". CITED (permissions.md, read 2026-11-08). So `mcp__brain_*` grants nothing as a settings allow rule. Whether skill frontmatter uses the same parser is UNVERIFIED.
- The Part 8 egress hook matcher covers Brain tools of any server name (pattern [a-z0-9_-]+__brain_[a-z0-9_]+) before they run. PROVEN by reading hooks/hooks.json.
- The skill body names no specific Brain tool (line 108 names the pattern `mcp__brain_*` in prose), so a narrow replacement is not offered.
- tests/test-391-agent-tools-naming.cjs holds this token as a PENDING_OWNER entry (card C5).

Options:
- LEAVE: keep the token. The test entry becomes an accepted entry with the answer date. No behavior change.
- REMOVE: delete the token from line 20. The test entry is deleted. No behavior change if the host skips the token as the docs say.
- DEFER: no change; the test keeps the pending entry.

Risk: if the host does match this glob on some setup, REMOVE would take a pre-approval away and the host would ask a permission prompt for Brain tools in that skill. No data leaves because of this change; the Part 8 hook still guards every Brain call.

Recommendation: REMOVE. Rule: REMOVE when no server named brain or brain_* exists in either list; otherwise LEAVE. No such server exists on this machine.

Edit list:

<!-- C5-EDIT-LIST-BEGIN -->
skills/intelligence-orchestrator/SKILL.md | line 20 | REMOVE deletes the token mcp__brain_* so the line reads: allowed-tools: Read Bash Agent WebSearch WebFetch mcp__pinecone__search-docs | LEAVE changes nothing
tests/test-391-agent-tools-naming.cjs | PENDING_OWNER entry for mcp__brain_* | REMOVE deletes the entry | LEAVE converts it to an ACCEPTED_OWNER entry with the answer date
<!-- C5-EDIT-LIST-END -->

C5-ALLOWED: LEAVE | REMOVE | DEFER
C5-NOEDIT: LEAVE | DEFER
C5-RECOMMENDED: REMOVE
C5-LIST-SHA256: aaa5deca1d392821fb5340dea4b44b5af62e5bb4d5ff53301d3f28a5d53b3149
C5-HEAD-AT-DECISION: 7dce93392b39d754490c2617414f6e83c73dcca5
C5-OWNER-ANSWER: REMOVE

### C6 - default lag of the doctor ledger organ (a blocker point of the release gate)

What changes: `DEFAULT_MAX_VERSION_LAG` in `lib/core/doctor/capability-ledger-module.cjs` is 40 today. Plan 391-06 makes the organ name the unscreened range, warn on an incomplete recorded fetch and accept a test ledger, but it does NOT change the default. The default decides when a release cut is blocked.

Facts:
- capability-ledger-fresh is a blocker point of `doctor --acceptance` (applies_to pre-tag and full), and scripts/doctor.cjs fails any organ status other than ok. PROVEN by reading scripts/doctor.cjs lines 2029 to 2046.
- The organ warns when installed patch minus ledger patch is greater than the threshold (lag > threshold). PROVEN by reading the module line 145.
- The organ read ok for a 32-version gap because 32 is below 40. PROVEN (391-RESEARCH.md Pitfall 5).
- 32 releases came out in the 37 days from 2026-10-01 to 2026-11-07, about 6 per week. PROVEN by arithmetic from the ledger and the installed version.
- After plan 391-05 the real lag is 1 (installed 2.1.319, ledger_covers.to 2.1.318). PROVEN by running the organ on 2026-11-08.
- At 6 releases per week a cut is blocked after about 12 days without a radar fetch at default 10, about 23 days at 20, about 46 days at 40. Arithmetic, not a measurement.
- Opt-outs that exist today: MINDRIAN_LEDGER_MAX_VERSION_LAG (raises or lowers the threshold) and DOCTOR_SKIP_CAPABILITY_LEDGER=1 (skips the point). PROVEN by reading the module and scripts/doctor.cjs.

Options:
- LAG-10: default 10. Tight: a cut is blocked after about 12 days without a fetch.
- LAG-20: default 20. A cut is blocked after about 23 days without a fetch; the observed 32-version gap would have been flagged.
- KEEP-40: no change. The observed 32-version gap reads ok.

Risk: a smaller default makes every release cut fail once the claude on the release machine is more than N patches ahead of ledger_covers.to, until a radar fetch is run (the owner decides who runs it). A larger default lets a long gap read ok.

Recommendation: LAG-20. Rule: the smaller of the two lower values that still gives at least three weeks (21 days) before a cut is blocked and still flags the observed 32-version gap. LAG-10 gives about 12 days (fails the three-week rule); LAG-20 gives about 23 days and flags 32. KEEP-40 is never the recommendation because it reads that gap as ok.

Edit list:

<!-- C6-EDIT-LIST-BEGIN -->
lib/core/doctor/capability-ledger-module.cjs | DEFAULT_MAX_VERSION_LAG | 40 becomes 10 on LAG-10 | 40 becomes 20 on LAG-20
data/doctor-modules.json | capability-ledger description | state the new default
tests/test-391-doctor-ledger-gap.cjs | new arm D10 | pins the default boundary with the environment variable unset: lag N reads ok, lag N+1 warns
<!-- C6-EDIT-LIST-END -->

C6-ALLOWED: LAG-10 | LAG-20 | KEEP-40
C6-NOEDIT: KEEP-40
C6-RECOMMENDED: LAG-20
C6-LIST-SHA256: a092bf2afd22ffa6570eda02f9766ac668ce294ff1702bd565b019be4763afa6
C6-HEAD-AT-DECISION: 7dce93392b39d754490c2617414f6e83c73dcca5
C6-OWNER-ANSWER: LAG-20

## 4. Adjacent findings (recorded, no edit)

- The host ignores allowed-tools for 15 agent files (13 with no tools list). It also ignores mcpServers for plugin agents (agents/larry-extended.md, agents/reverse-salient-agent.md), initialPrompt (agents/larry-extended.md) and the keys persona_variants, extends, activation_gate, hitl_shape, hitl_why. Filed as SEED-145.
- The Phase 95.6 comment that relies on mcpServers is not true for the plugin install.
- tests/test-267-mcpv2-dual-era.cjs has 2 stale snapshot arms since Phase 387 (the eureka tools are missing from the snapshot). This is not caused by Phase 391. The fix is a snapshot update in a quick.
- CLAUDE.md names the SDK as @modelcontextprotocol/sdk ^1.29.0 while the repo is on the v2 packages 2.1.0.
- 2.1.319 carries two MCP handshake and task changes for the next radar fetch.
- The doctor default lag is card C6. Plan 391-06 keeps the default at 40 and changes only the naming of the gap and the incomplete-fetch warning.

## 5. Not decided here

- The /ultrareview decision (card C4 holds facts only).
- Adopting the mcp_tool hook type. It is out of scope: it changes the Part 8 guard path.
- Who runs the next radar fetch (PRD item i).
