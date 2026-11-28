---
phase: quick-261127-hdl
quick_id: 261127-hdl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/CLAUDE-SURFACE-MODEL.md
  - .planning/seeds/SEED-173-claude-surface-model-product-fixes.md
  - CLAUDE.md
  - .claude/includes/decisions.md
autonomous: true
requirements: [QUICK-261127-hdl]
owner_decision: "Map now, fixes later (card answer 2026-11-27): write the surface map and correct the old three-surface text; the product fixes go to a seed"

must_haves:
  truths:
    - "A reader of docs/CLAUDE-SURFACE-MODEL.md learns, in plain words, that chat and Cowork are one Claude that runs in Anthropic's cloud, and that MindrianOS runs in full only in local Claude Code (the CLI and a local Desktop Code-tab session)"
    - "The doc shows the 6-row surface table, the which-parts-load-where table, where the room (local SQLite) is reachable, the design rules, the 11 UNVERIFIED items marked UNVERIFIED, a recheck-by note, and links to both homes of the radar"
    - "Every date and every version string in the doc and in the seed appears in the radar"
    - "CLAUDE.md's Tri-Polar table has the rows Claude Code CLI, Claude Desktop Code tab, Claude Desktop chat (formerly chat plus Cowork), and no Cowork row; the table and the Three surfaces constraint line each point to docs/CLAUDE-SURFACE-MODEL.md; no other CLAUDE.md line changes"
    - "decisions.md row 4 names the same three surfaces and points to docs/CLAUDE-SURFACE-MODEL.md; rows 1, 5, 8 and 17 stay byte-identical"
    - "SEED-173 lists the product fixes (a) to (g) with evidence paths, and no code file changes in this quick"
  artifacts:
    - path: "docs/CLAUDE-SURFACE-MODEL.md"
      provides: "Canonical surface doctrine (six surfaces, what loads where, room reach, rules, UNVERIFIED, recheck)"
      contains: "## UNVERIFIED"
      min_lines: 90
    - path: ".planning/seeds/SEED-173-claude-surface-model-product-fixes.md"
      provides: "Seed for the product fixes (a) to (g)"
      contains: "id: SEED-173"
    - path: "CLAUDE.md"
      provides: "Corrected Tri-Polar table and Three surfaces constraint line"
      contains: "docs/CLAUDE-SURFACE-MODEL.md"
    - path: ".claude/includes/decisions.md"
      provides: "Corrected decision 4"
      contains: "| 4 | Three surfaces"
  key_links:
    - from: "CLAUDE.md"
      to: "docs/CLAUDE-SURFACE-MODEL.md"
      via: "pointer line under the Tri-Polar table and in the Three surfaces constraint line"
      pattern: "docs/CLAUDE-SURFACE-MODEL\\.md"
    - from: ".claude/includes/decisions.md"
      to: "docs/CLAUDE-SURFACE-MODEL.md"
      via: "row 4 rationale"
      pattern: "^\\| 4 \\|.*docs/CLAUDE-SURFACE-MODEL\\.md"
    - from: "docs/CLAUDE-SURFACE-MODEL.md"
      to: "claude-surface-radar.md (both homes) and SEED-173"
      via: "Sources and Open product fixes sections"
      pattern: "2026-11-27-claude-surface-radar/claude-surface-radar\\.md"
---

<objective>
Teach MindrianOS the current Claude surface model, per the owner decision "Map now, fixes later" (2026-11-27).

Purpose: CLAUDE.md is mandatory initial context for every GSD agent. Its Tri-Polar table and decision 4 still describe three local surfaces (CLI, Desktop, Cowork). The radar of 2026-11-27 shows that model is gone: chat and Cowork are one Claude that runs in Anthropic's cloud, and MindrianOS runs in full only in local Claude Code. Every agent that reads the old text plans for a surface that no longer exists.

Output:
1. docs/CLAUDE-SURFACE-MODEL.md, the one canonical doctrine doc.
2. .planning/seeds/SEED-173-claude-surface-model-product-fixes.md, the product fixes, not done here.
3. A small correction to CLAUDE.md (Tri-Polar rows, one pointer line, the Three surfaces constraint line) and to decisions.md row 4.

Do not change code. Do not rename the 'cowork' enum. Do not edit agents/, lib/, hooks/, commands/, skills/, tests/, docs/MINDRIAN-CANON.md, .planning/PROJECT.md or .planning/codebase/CONVENTIONS.md. Those go to the seed.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
@$HOME/.claude/protocols/agent-interaction-protocol.md
</execution_context>

<context>
@CLAUDE.md
@.claude/includes/decisions.md
@.planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md
@.planning/seeds/SEED-172-ledger-coupled-tests-run-at-release-and-part-6-cap.md

Facts the planner checked on 2026-11-27 (PROVEN, read in this worktree, HEAD 1331fdeca):
- The radar has 169 lines. Its key line ranges: the dated table at lines 29-69, the component table (Q1) at line 77, the surface table "What MindrianOS must assume now" at lines 133-140, the 5 design rules at lines 142-148, the 11 UNVERIFIED items at lines 150-162, the field evidence at lines 164-169.
- The room copy of the radar exists: ~/MindrianRooms/rethinking-mindrianos/research/2026-11-27-claude-surface-radar/claude-surface-radar.md.
- docs/CLAUDE-SURFACE-MODEL.md does not exist yet.
- The highest seed number on every branch and every worktree is SEED-172. SEED-173 is the next free number. Recent seeds use the frontmatter keys id, status, planted, planted_during, trigger_when, scope, canon_parts, related (see SEED-170, SEED-171).
- .planning/* is in .gitignore (line 97). A new file under .planning/ needs `git add -f`. Tracked seeds already exist in .planning/seeds/.
- CLAUDE.md lines to change: the Tri-Polar rows at lines 41-43 (the header row at line 39 and the separator at line 40 stay), and the constraint line at line 99 (inside the GSD:project block, generated from .planning/PROJECT.md line 409).
- decisions.md row 4 is "| 4 | Three surfaces | CLI + Desktop + Cowork. |".
- Seed facts: `git grep -il cowork -- . ':!.planning' ':!CHANGELOG.md' ':!docs/autopsies' | wc -l` prints 819. lib/core/memory-ops.cjs:572 is "@param {string} opts.surface - 'cli' | 'desktop' | 'cowork'". lib/core/research-planner/sr-entry.cjs:60 is "const SURFACES = Object.freeze(['cli', 'cowork', 'desktop']);". .mcp.json sets "alwaysLoad": true at line 6 (mindrian-os) and line 11 (mindrian-brain). bin/ holds cli.js, mindrian-mcp-server.cjs, mindrian-brain-mcp-client.cjs, mindrian-mcp-shim.cjs, mindrian-tools.cjs, local-chain-recommender.cjs. hooks/mos-face.json exists. Phase 367 plan 11 is .planning/phases/367-newborn-room-graph-connected-no-repair/367-11-PLAN.md (files lib/mcp/session-room.cjs, lib/mcp/graph-catchup-spawn.cjs, tests/test-367-governed-census.cjs; its census lists tools "once per surface (CLI, Desktop, Cowork HTTP)").

Tests and scripts that pin CLAUDE.md or decisions.md text (PROVEN by git grep and by a baseline run):
- No test or script pins the exact strings that change ("What Matters Most", "Multi-user, persistent agents", "works across CLI, Desktop, and Cowork", "CLI + Desktop + Cowork"). `git grep` found them only in docs/IDEA-DOCUMENT.md and docs/BUSINESS-MODEL-AND-MOAT.md (seed item g).
- tests/test-250-amendment-unit.cjs pins decisions.md rows 1, 5, 8 by exact substring. Baseline: pass 9, fail 0.
- tests/test-250-doctrine-fence.cjs scans decisions.md for 4 banned phrases ("silent fallback", "never mention failures" or "never mention this bookkeeping", "graceful degradation everywhere", "never tell the user about degradation" or "never tell user about degradation"). Baseline: pass 6, fail 0.
- tests/test-369-constitution.cjs requires exactly one decisions.md line that starts with "| 17 |" and cites D-17, requires that the CLAUDE.md conventions block equals .planning/codebase/CONVENTIONS.md line for line, and forbids U+2014 and U+2013 in CLAUDE.md and decisions.md. Baseline: 7 passed, 0 failed.
- tests/269-doctrine-reconcile.test.cjs pins decisions.md rows 1 and 5 (MOAT-01, MOAT-02). Baseline: pass 5, fail 1. The 1 failure is MOAT-05 (bin/cli.js wording, pre-existing, not related to this quick).
- CLAUDE.md readers that pin other substrings: tests/test-195-canon-7-kind-floor.cjs, tests/test-245-skill-frontmatter-inert-keys.cjs, tests/test-canon-entry-40-corpus-figures-floor.cjs, tests/test-canon-entry-41-supersession-narrowing-floor.cjs (baseline exit 0 each), and tests/test-236-engines-floor.cjs (baseline "5 passed, 1 failed", the failure is "FAIL 5." stack-block floor drift, pre-existing).
- None of the em dash or en dash characters (U+2014, U+2013) is in CLAUDE.md, decisions.md or the radar today.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write the canonical doctrine doc docs/CLAUDE-SURFACE-MODEL.md</name>
  <files>docs/CLAUDE-SURFACE-MODEL.md</files>
  <read_first>.planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md (all 169 lines; it is the only source of dates, versions and claims), docs/GROUNDING-SOURCES.md (lines 1-5, the header style of a docs/ doctrine file)</read_first>
  <action>
Create docs/CLAUDE-SURFACE-MODEL.md with the Write tool. Use the radar as the only source. Write plain, short sentences (Feynman style, JTBD). Do not use em dashes or en dashes; use hyphens. Do not use the 4 banned phrases of tests/test-250-doctrine-fence.cjs (listed in the context). Do not write a personal name, an email address or an absolute home path; write home paths as ~/.... Every date (YYYY-MM-DD) and every dotted version string you write must appear in the radar. Do not add a new date of your own.

Use one term for one thing. Define once and then reuse: "Desktop chat" means the merged chat (formerly chat plus Cowork, radar surface 4); "device bridge" means the open Claude Desktop app on a linked computer that a cloud task uses to reach the computer; "the room" means the user's local SQLite room (room.db) and its folder.

Use these sections, in this order, with these exact headings:

1. "# Claude surface model" then 3 short lines: "Status: doctrine." / "Written 2026-11-27 from the Claude surface radar of 2026-11-27 (Tavily extract of primary Anthropic pages)." / "This file is the one place that says where MindrianOS runs. CLAUDE.md (Tri-Polar table, Three surfaces constraint) and .claude/includes/decisions.md (decision 4) point here."

2. "## In plain words". 5 to 8 sentences. State the old picture (three places on your own computer: CLI, Desktop, Cowork) and that it is gone. State the 3 facts: chat and Cowork are now one Claude that runs in Anthropic's cloud; your computer is now a remote device that a cloud task reaches only through the open Desktop app; MindrianOS runs in full only in local Claude Code (the CLI and a local Desktop Code-tab session; Remote Control drives such a local session). Give one picture: the room is a notebook on your desk; local Claude Code sits at the desk; Desktop chat works in Anthropic's office and can read or write the notebook only while the Desktop app holds the line open, and a write over that line can say "done" when the page never arrived. End with why it matters: a feature that needs the room must work in local Claude Code and must say "no room" honestly anywhere else (decision 8, honest refusal).

3. "## The six surfaces". Copy the radar table "What MindrianOS must assume now" (radar lines 133-140) row for row, with its 5 columns (Surface, Model runs, Plugin parts that load, Local MCP server, Room (local SQLite)) and its row labels "1." to "6.". Keep the content; you may only replace a radar phrase with the defined term "Desktop chat" or "device bridge". Under the table add one line that maps the three CLAUDE.md Tri-Polar rows: Claude Code CLI = surface 1; Claude Desktop Code tab = surfaces 2 (local session) and 3 (cloud session); Claude Desktop chat (formerly chat plus Cowork) = surfaces 4 and 5; Remote Control (surface 6) is a local Claude Code session driven from the cloud.

4. "## Which plugin parts load where". A table with columns Component, Chat, Cowork, Claude Code, copied from radar line 77: Skills (Loads / Loads / Loads); Commands ("Loads as a skill" / Loads / Loads); Agents (Ignored / Loads / Loads); Hooks (Ignored / Loads / Loads); Local MCP server (Ignored / "Loads when the Cowork session runs on your computer" / Loads); Top-level bin/ ("Can't be installed" / "Can't be installed" / Loads). Under it: the source line (https://claude.com/docs/plugins/platform-support, read 2026-11-27, page undated) and a note that the hooks-in-Chat change of Desktop v1.52386.0 (2026-09-10) is for third-party (3P) deployments only (radar line 80). Then a sub-list "MindrianOS today" with 3 facts: the repo has a top-level bin/ (cli.js, mindrian-mcp-server.cjs and others), so Customize > Plugins refuses this plugin shape; the mod hooks/mos-face.json works only in Claude Code; .mcp.json sets alwaysLoad: true on both servers (mindrian-os, mindrian-brain), so a cloud first turn waits for them if the plugin is synced (Claude Code 2.1.304, 2026-10-19). Mark these 3 as read from the repo, no install test on claude.ai (radar UNVERIFIED 11).

5. "## Where the room is reachable". State the 3 routes: (a) a local Claude Code session (surfaces 1, 2 and 6); (b) a cloud surface (surfaces 4 and 5) through the device bridge, only while the Desktop app is open on a linked computer; (c) Remote Control, while the machine is awake with Remote Control on. Every other case is "no room": Code-tab cloud sessions, claude.ai/code, Projects cloud threads and cloud scheduled tasks start from a fresh clone and do not see the user's disk. Add 2 warnings, each before the rule it applies to: a write from a cloud session to the user's computer reported success where the file never arrived (fixed in Claude Code 2.1.300, 2026-10-14), so every bridged room write needs a read-back; if the Desktop app closes, the cloud task keeps running but cannot reach the computer (support article 15520349), and an older page says the session may have ended (UNVERIFIED 4).

6. "## Design rules". Copy the radar's 5 rules (lines 144-148) as a numbered list. Add rule 6: "A feature that needs the room states 'no room' honestly on a surface without a route to it, and never reports a room write it did not read back (decision 8)."

7. "## Key dates". A short table (Date, Change, P/S) with these radar rows only: 2026-01-12 (Cowork research preview runs locally in a VM), 2026-07-07 (Cowork on web and mobile, sessions run remotely in beta), 2026-09-15 (synced plugins need Claude Code 2.1.273 or later; date secondary), 2026-09-16 (unified experience rolls out to Pro and Max), 2026-09-17 (Projects redesigned; threads are Claude Code cloud sessions; date secondary), 2026-10-06 (new Cowork tasks on Pro, Max and Ultra run in the cloud, no switch back), 2026-10-13 (Desktop v2.37337.1 computer-registration fix), 2026-10-14 (Claude Code 2.1.300 write fix), 2026-10-19 (Claude Code 2.1.304 alwaysLoad first-turn wait), 2026-10-23 (Enterprise GA), 2026-11-12 (Team GA), 2026-11-16 (Enterprise default on), 2026-11-20 (Desktop v6.28899.6, bundled Claude Code 2.1.330, the latest build read). Copy each date, version and P/S mark exactly from the radar table.

8. "## UNVERIFIED". Copy the radar's 11 UNVERIFIED items (lines 152-162) as a numbered list 1 to 11, keep the word ASSUMED in item 1, and keep every item marked as not proven. Do not resolve, soften or drop an item.

9. "## Field evidence (spike 012)". Copy the 4 bullets of radar lines 166-169 (Windows Desktop, 2026-11-27, legs A1 and A2; B1 and B2 not applicable). State that this is one machine, one run.

10. "## Open product fixes". One sentence: the product fixes are not done here; they are planted as SEED-173 at .planning/seeds/SEED-173-claude-surface-model-product-fixes.md (owner decision 2026-11-27, "Map now, fixes later"). Then one short line per item (a) to (g), with the same titles as Task 2.

11. "## Recheck by". The rollout moves, so this map ages. Recheck on or after 2026-12-01 (the Team default-on date that only a secondary source gives, UNVERIFIED 8), and at each Claude Desktop or Claude Code changelog entry that names Chat, Cowork, cloud sessions, plugins, hooks or MCP. Re-read the undated platform-support and plugins pages at each recheck (UNVERIFIED 10). The session that rechecks updates the radar in both homes and this file in the same commit.

12. "## Sources". The 2 homes of the radar as two bullets: .planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md (repo copy) and ~/MindrianRooms/rethinking-mindrianos/research/2026-11-27-claude-surface-radar/claude-surface-radar.md (room copy, the durable reasoning trail per the Dev-Research Compositing rule). Then the primary URLs the radar cites, one per bullet, without duplicates, copied exactly.

This is Claude's discretion (planner choice): the recheck date 2026-12-01 comes from radar UNVERIFIED item 8, because the scope requires every date to come from the radar.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin-release && D=docs/CLAUDE-SURFACE-MODEL.md && R=.planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md && test -f $D && test "$(grep -cE '^\| [1-6]\. ' $D)" -eq 6 && test "$(awk '/^## UNVERIFIED/{f=1;next} /^## /{f=0} f && /^[0-9]+\. /' $D | wc -l)" -eq 11 && grep -q '^## Recheck by' $D && grep -q '^## Which plugin parts load where' $D && grep -q '^## Where the room is reachable' $D && grep -q '^## Design rules' $D && grep -qF '.planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md' $D && grep -qF '~/MindrianRooms/rethinking-mindrianos/research/2026-11-27-claude-surface-radar/claude-surface-radar.md' $D && grep -qF 'SEED-173' $D && for d in $(grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' $D | sort -u); do grep -qF "$d" $R || echo "DATE NOT IN RADAR: $d"; done | (! grep .) && for v in $(grep -oE '[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?' $D | sort -u); do grep -qF "$v" $R || echo "VERSION NOT IN RADAR: $v"; done | (! grep .) && ! LC_ALL=C.UTF-8 grep -nP '[\x{2013}\x{2014}]' $D && ! grep -nE 'jsagi|Sagir|Jonathan|/home/' $D && ! grep -niE 'silent fallback|graceful degradation everywhere|never mention (failures|this bookkeeping)|never tell (the )?user about degradation' $D && echo TASK1-OK</automated>
  </verify>
  <done>docs/CLAUDE-SURFACE-MODEL.md exists with the 12 sections; the six-surface table has 6 rows; the UNVERIFIED section has 11 items; both radar homes and SEED-173 are linked; every date and version is in the radar; no em dash, no en dash, no personal name or home path; the command prints TASK1-OK.</done>
</task>

<task type="auto">
  <name>Task 2: Plant SEED-173 for the product fixes (a) to (g)</name>
  <files>.planning/seeds/SEED-173-claude-surface-model-product-fixes.md</files>
  <read_first>.planning/seeds/SEED-170-theo-envelope-coverage-status-vs-label.md (lines 1-12, frontmatter shape), .planning/seeds/SEED-172-ledger-coupled-tests-run-at-release-and-part-6-cap.md (body shape: Problem, Proposal), .planning/phases/367-newborn-room-graph-connected-no-repair/367-11-PLAN.md (lines 1-25), .mcp.json (14 lines)</read_first>
  <action>
First confirm the number is still free: run `ls .planning/seeds | grep -c '^SEED-173-'`. If it prints a number above 0, a peer session took 173: use the next free number, and change the SEED-173 references in docs/CLAUDE-SURFACE-MODEL.md (Task 1) to that number.

Create .planning/seeds/SEED-173-claude-surface-model-product-fixes.md with the Write tool. Frontmatter keys, in this order: id: SEED-173; status: planted; planted: 2026-11-27; planted_during: quick 261127-hdl (Claude surface model doctrine; owner card answer 2026-11-27 "Map now, fixes later"); trigger_when: the next phase that touches plugin packaging for claude.ai or Desktop, the Phase 367 Desktop path (plan 11), an MCP room-write tool, .mcp.json, or the surface enum; or the recheck date in docs/CLAUDE-SURFACE-MODEL.md; scope: large; canon_parts: [9, 11]; related: docs/CLAUDE-SURFACE-MODEL.md, the 2 radar homes (same paths as Task 1 section 12), .planning/phases/367-newborn-room-graph-connected-no-repair/367-11-PLAN.md, .mcp.json, .claude-plugin/plugin.json, lib/core/memory-ops.cjs, lib/core/research-planner/sr-entry.cjs.

Body: a title line "# SEED-173: fit MindrianOS to the merged cloud chat (product fixes from the surface radar)"; a "## Problem" paragraph in plain words (the plugin was built for three local surfaces; chat and Cowork are now one Claude in Anthropic's cloud; only local Claude Code runs the full plugin; see docs/CLAUDE-SURFACE-MODEL.md); then "## Items" with one "### (x) title" sub-section per item. Each item has 3 labelled lines: Fact (with the radar row or repo path and line), Proposed direction (one or two sentences, a direction, not a design), Needs owner ruling (yes or no, and why). Use these items and titles:

(a) "The top-level bin/ blocks a plugin install in chat". Fact: platform-support table, top-level bin/ "Can't be installed" in Chat and Cowork (radar line 77); bin/ holds cli.js, mindrian-mcp-server.cjs, mindrian-brain-mcp-client.cjs, mindrian-mcp-shim.cjs, mindrian-tools.cjs, local-chain-recommender.cjs. Direction: a claude.ai-facing package needs a separate shape (skills plus a remote or bridged MCP server, radar rule 3); check the mos-desktop marketplace copy against the same table. Needs owner ruling: yes (package shape).

(b) "Hooks, agents and local MCP servers are ignored in chat; re-check the Phase 367 Desktop path". Fact: Chat column Ignored for agents, hooks and local MCP servers (radar line 77); a Desktop-config stdio server reached the merged chat as mcp__remote-devices__s1-probe__s1_spawn (spike 012, radar lines 166-168); which side runs a plugin-bundled stdio server in a merged-chat cloud task is UNVERIFIED 2. Direction: re-check 367-11-PLAN.md (the MCP spawn wrapper in lib/mcp/graph-catchup-spawn.cjs and lib/mcp/session-room.cjs, and the tests/test-367-governed-census.cjs surfaces "CLI, Desktop, Cowork HTTP") against the device-bridge model before plan 11 runs. Needs owner ruling: no for the re-check, yes if plan 11 changes.

(c) "A room write from a cloud session can report success and not arrive". Fact: Claude Code 2.1.300 (2026-10-14) fixed Write, Edit and NotebookEdit in Cowork cloud sessions that reported success for a path on the user's computer where the file never arrived (radar line 56). Direction: every MCP room write that a bridged session can call confirms with a read-back of the same row or file before it reports ok (radar rule 4; Canon Part 9). Needs owner ruling: no for the read-back contract.

(d) "alwaysLoad: true on both servers makes a cloud first turn wait". Fact: .mcp.json lines 6 and 11 set "alwaysLoad": true on mindrian-os and mindrian-brain; Claude Code 2.1.304 (2026-10-19) lets a cloud first turn skip synced stdio servers unless a server sets alwaysLoad: true (radar line 58); a stdio server in the cloud VM sees the VM disk, not the room. Direction: measure the first-turn cost in a cloud session, then decide per server. Needs owner ruling: yes (local first-turn tool availability against cloud first-turn wait).

(e) "The 'cowork' label stays as a legacy label for now". Fact: `git grep -il cowork -- . ':!.planning' ':!CHANGELOG.md' ':!docs/autopsies' | wc -l` printed 819 on 2026-11-27; the surface enum 'cli' | 'desktop' | 'cowork' is at lib/core/memory-ops.cjs:572 and the frozen list ['cli', 'cowork', 'desktop'] at lib/core/research-planner/sr-entry.cjs:60. Direction: keep 'cowork' as a legacy label (it now means the Desktop chat surface); a rename is a separate, test-backed change with a stored-value migration plan for rows that already hold 'cowork'. Needs owner ruling: yes (rename or keep).

(f) "New Projects threads skip repo hooks and .mcp.json". Fact: a Projects cloud thread loads repo CLAUDE.md but not the repo .mcp.json servers or .claude/settings.json hooks; plugins come from Project settings > Plugins and MCP from claude.ai connectors; a local thread through Remote Control (Claude Code v2.1.280 or later) uses local hooks and MCP servers (radar lines 107-112). Direction: treat a Projects cloud thread as "no room"; document the Remote Control route for room work. Needs owner ruling: no.

(g) "Other doctrine text still names the old three surfaces". Fact: out of this quick's scope, these lines still carry the old model: CLAUDE.md lines 3, 25 and 90 ("Claude Code + Cowork plugin"); the CLAUDE.md conventions line "every feature works on all three surfaces", generated from .planning/codebase/CONVENTIONS.md line 17 and pinned line for line by tests/test-369-constitution.cjs scenario 3 (change both files together); .planning/PROJECT.md line 409, the generator source of the CLAUDE.md Three surfaces line (a regeneration of the GSD:project block reverts this quick's correction until it changes); .planning/PROJECT.md line 5; docs/IDEA-DOCUMENT.md lines 28, 107 and 130; docs/BUSINESS-MODEL-AND-MOAT.md line 70. Direction: one doc sweep that points each line to docs/CLAUDE-SURFACE-MODEL.md. Needs owner ruling: no.

End with "## Out of scope of this seed" (no item here is done by quick 261127-hdl; the quick changed only docs/CLAUDE-SURFACE-MODEL.md, CLAUDE.md, .claude/includes/decisions.md and this seed).

Rules for this file: no em dash or en dash; no personal name, email or absolute home path (write ~/...); every date and dotted version string must appear in the radar; mark each fact PROVEN (read in the repo or the radar) or UNVERIFIED where the radar says so.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin-release && S=.planning/seeds/SEED-173-claude-surface-model-product-fixes.md && R=.planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md && test -f $S && test "$(ls .planning/seeds | grep -c '^SEED-173-')" -eq 1 && grep -q '^id: SEED-173$' $S && grep -q '^status: planted$' $S && grep -q '^planted: 2026-11-27$' $S && test "$(grep -cE '^### \((a|b|c|d|e|f|g)\) ' $S)" -eq 7 && grep -qF 'memory-ops.cjs:572' $S && grep -qF 'sr-entry.cjs:60' $S && grep -qF '367-11-PLAN.md' $S && grep -qF '2.1.300' $S && grep -qF '2.1.304' $S && grep -qF '819' $S && for d in $(grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' $S | sort -u); do grep -qF "$d" $R || echo "DATE NOT IN RADAR: $d"; done | (! grep .) && for v in $(grep -oE '[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?' $S | sort -u); do grep -qF "$v" $R || echo "VERSION NOT IN RADAR: $v"; done | (! grep .) && ! LC_ALL=C.UTF-8 grep -nP '[\x{2013}\x{2014}]' $S && ! grep -nE 'jsagi|Sagir|Jonathan|/home/' $S && echo TASK2-OK</automated>
  </verify>
  <done>The seed exists as the only SEED-173 file, has the recent-seed frontmatter, lists items (a) to (g) with facts, directions and owner-ruling flags, cites the repo lines and radar versions; every date and version is in the radar; no em dash, en dash, personal name or home path; the command prints TASK2-OK.</done>
</task>

<task type="auto">
  <name>Task 3: Correct the CLAUDE.md Tri-Polar table, the Three surfaces constraint line and decision 4</name>
  <files>CLAUDE.md, .claude/includes/decisions.md</files>
  <read_first>CLAUDE.md (lines 35-45 and 95-100 only), .claude/includes/decisions.md (all 21 lines), tests/test-250-amendment-unit.cjs (lines 96-120), tests/test-250-doctrine-fence.cjs (lines 20-35)</read_first>
  <action>
Warning: CLAUDE.md is mandatory initial context for every GSD agent, and 4 doctrine tests read decisions.md. Change only the lines named here. Keep the edit small. Do not touch any other CLAUDE.md section, the Tri-Polar heading, the intro sentence at line 37, the table header (line 39) or the separator (line 40).

Step 1, CLAUDE.md Tri-Polar rows (lines 41-43). Use the Edit tool. Replace the 3 rows with these 3 rows, cell text as given (keep the pipe-table form and the bold on the first cell):
Row 1: first cell "**Claude Code CLI**"; second cell "The full local runtime: hooks fire, scripts run, `/mos:*` commands, the local MCP server and the room on disk"; third cell "Hook reliability, script execution, context budget, file output".
Row 2: first cell "**Claude Desktop Code tab**"; second cell "A local session is full Claude Code on the machine, the same as the CLI; a cloud session is a fresh repo clone on an Anthropic VM, with no room"; third cell "Local-session parity with the CLI; a cloud session says \"no room\" honestly".
Row 3: first cell "**Claude Desktop chat** (formerly chat plus Cowork)"; second cell "One Claude that runs in Anthropic's cloud; users talk to Larry; hooks, agents and local MCP servers do not load in chat; the room is reachable only through the open Desktop app"; third cell "Larry personality, natural-language discoverability, an honest \"no room\" state, a read-back after every bridged write".
Then replace the blank line directly after the table with: a blank line, then one pointer line "Full model (six surfaces, which plugin parts load where, where the room is reachable, UNVERIFIED items, recheck date): docs/CLAUDE-SURFACE-MODEL.md. MindrianOS runs in full only in local Claude Code (the CLI, or a local Desktop Code-tab session).", then a blank line before the existing "---". The only non-blank lines that change in CLAUDE.md are the 3 rows, the new pointer line and the constraint line of Step 2.

Step 2, CLAUDE.md constraint line (line 99). Replace the line that starts "- **Three surfaces**: every feature works across CLI, Desktop, and Cowork" with: "- **Three surfaces**: every feature is checked on the Claude Code CLI, the Desktop Code tab and the Desktop chat (formerly chat plus Cowork); only local Claude Code runs the full plugin, so a surface without the room says so instead of failing without a word (docs/CLAUDE-SURFACE-MODEL.md)." Do not edit .planning/PROJECT.md (the generator source of this line); it is seed item (g).

Step 3, decisions.md row 4. Replace "| 4 | Three surfaces | CLI + Desktop + Cowork. |" with "| 4 | Three surfaces: Claude Code CLI, Claude Desktop Code tab, Claude Desktop chat (formerly chat plus Cowork) | Chat and Cowork merged into one Claude (rollout from 2026-09-16), and new Cowork tasks run in Anthropic's cloud since 2026-10-06; MindrianOS runs in full only in local Claude Code (the CLI, or a local Desktop Code-tab session), and a cloud surface reaches the room only through the open Desktop app or Remote Control. Map: docs/CLAUDE-SURFACE-MODEL.md. |". Do not change any other row. Rows 1, 5, 8 and 17 must stay byte-identical (tests 250, 269 and 369 pin them).

Do not use an em dash or an en dash, and do not use the 4 banned phrases of tests/test-250-doctrine-fence.cjs. Every date in the new text must appear in the radar (2026-09-16 and 2026-10-06 do).
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin-release && R=.planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md && test "$(grep -c '^| \*\*Cowork\*\* |' CLAUDE.md)" -eq 0 && test "$(grep -c '^| \*\*Claude Code CLI\*\* |' CLAUDE.md)" -eq 1 && test "$(grep -c '^| \*\*Claude Desktop Code tab\*\* |' CLAUDE.md)" -eq 1 && test "$(grep -c '^| \*\*Claude Desktop chat\*\* (formerly chat plus Cowork) |' CLAUDE.md)" -eq 1 && test "$(grep -c 'docs/CLAUDE-SURFACE-MODEL.md' CLAUDE.md)" -ge 2 && test "$(grep -c 'works across CLI, Desktop, and Cowork' CLAUDE.md)" -eq 0 && test "$(git diff -U0 -- CLAUDE.md | grep -v '^--- a/' | grep -v '^+++ b/' | grep -c '^-.')" -eq 4 && test "$(git diff -U0 -- CLAUDE.md | grep -v '^--- a/' | grep -v '^+++ b/' | grep -c '^+.')" -eq 5 && test "$(grep -c '^| 4 | Three surfaces: Claude Code CLI, Claude Desktop Code tab, Claude Desktop chat' .claude/includes/decisions.md)" -eq 1 && grep -qE '^\| 4 \|.*docs/CLAUDE-SURFACE-MODEL\.md' .claude/includes/decisions.md && test "$(grep -c 'CLI + Desktop + Cowork' .claude/includes/decisions.md)" -eq 0 && test "$(git diff -U0 -- .claude/includes/decisions.md | grep -v '^--- a/' | grep -v '^+++ b/' | grep -c '^-.')" -eq 1 && test "$(git diff -U0 -- .claude/includes/decisions.md | grep -v '^--- a/' | grep -v '^+++ b/' | grep -c '^+.')" -eq 1 && for d in $(git diff -U0 -- CLAUDE.md .claude/includes/decisions.md | grep '^+' | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | sort -u); do grep -qF "$d" $R || echo "DATE NOT IN RADAR: $d"; done | (! grep .) && ! LC_ALL=C.UTF-8 grep -nP '[\x{2013}\x{2014}]' CLAUDE.md .claude/includes/decisions.md && node tests/test-250-amendment-unit.cjs >/dev/null 2>&1 && node tests/test-250-doctrine-fence.cjs >/dev/null 2>&1 && node tests/test-369-constitution.cjs >/dev/null 2>&1 && test "$(node tests/269-doctrine-reconcile.test.cjs 2>&1 | grep '^not ok' | grep -vc 'MOAT-05')" -eq 0 && node tests/test-195-canon-7-kind-floor.cjs >/dev/null 2>&1 && node tests/test-245-skill-frontmatter-inert-keys.cjs >/dev/null 2>&1 && node tests/test-canon-entry-40-corpus-figures-floor.cjs >/dev/null 2>&1 && node tests/test-canon-entry-41-supersession-narrowing-floor.cjs >/dev/null 2>&1 && node tests/test-236-engines-floor.cjs 2>&1 | grep -q '5 passed, 1 failed' && echo TASK3-OK</automated>
  </verify>
  <done>CLAUDE.md has the 3 new Tri-Polar rows, no Cowork row, a pointer line and a corrected constraint line (the diff removes exactly 4 non-blank lines and adds exactly 5: 3 rows, the pointer line, the constraint line); decisions.md row 4 is corrected (1 line removed, 1 line added) and points to the doc; no em dash or en dash; tests 250 amendment (9/0), 250 doctrine fence (6/0), 369 constitution (7/0), 195, 245, canon-entry-40 and canon-entry-41 pass; 269 fails only on the pre-existing MOAT-05; 236 stays at the pre-existing "5 passed, 1 failed"; the command prints TASK3-OK.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo doctrine to every GSD agent | CLAUDE.md and decisions.md load as mandatory context; a wrong claim there misleads every later plan |
| repo to outside readers | docs/ ships with the public plugin repo; personal data must not enter it |
| generator source to CLAUDE.md | the GSD:project block is generated from .planning/PROJECT.md; a regeneration can revert a hand edit |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-hdl-01 | Tampering | docs/CLAUDE-SURFACE-MODEL.md, SEED-173 | mitigate | Copy the 11 UNVERIFIED items verbatim; the verify loop checks every date and dotted version against the radar file |
| T-hdl-02 | Information disclosure | docs/CLAUDE-SURFACE-MODEL.md, SEED-173 | mitigate | Write home paths as ~/...; the verify step greps for a personal name or /home/ and fails on a hit |
| T-hdl-03 | Tampering | CLAUDE.md line 99 (GSD:project block) | accept | A regeneration from .planning/PROJECT.md line 409 reverts the line; the block already differs from PROJECT.md (line 90 against line 5), so no regeneration runs today; recorded as seed item (g) |
| T-hdl-04 | Denial of service | doctrine tests 250, 269, 369, 195, 236, 245, canon-entry-40, canon-entry-41 | mitigate | Task 3 verify runs every pinning test against its recorded baseline |
</threat_model>

<verification>
Run from /home/jsagi/dev/MindrianOS-Plugin-release:
1. The Task 1, Task 2 and Task 3 automated commands print TASK1-OK, TASK2-OK and TASK3-OK.
2. `git status --short -- agents lib hooks commands skills tests docs/MINDRIAN-CANON.md .planning/PROJECT.md .planning/codebase/CONVENTIONS.md .mcp.json bin` prints nothing (no out-of-scope file changed).
3. `git diff --stat` lists only CLAUDE.md and .claude/includes/decisions.md as modified tracked files; `git status --short docs/CLAUDE-SURFACE-MODEL.md` shows the new doc; `git status --short --ignored .planning/seeds/SEED-173-claude-surface-model-product-fixes.md` shows the new seed (ignored path, needs `git add -f`).
4. `LC_ALL=C.UTF-8 grep -nP '[\x{2013}\x{2014}]' docs/CLAUDE-SURFACE-MODEL.md .planning/seeds/SEED-173-claude-surface-model-product-fixes.md CLAUDE.md .claude/includes/decisions.md` prints nothing.
</verification>

<success_criteria>
- docs/CLAUDE-SURFACE-MODEL.md is the one canonical surface doctrine, in plain words, with the six-surface table, the which-parts-load-where table, the room-reach routes, the design rules, the 11 UNVERIFIED items, the recheck-by note and both radar homes.
- CLAUDE.md (Tri-Polar rows, pointer line, constraint line) and decisions.md row 4 name the three current surfaces and point to the doc; nothing else in those files changes.
- SEED-173 holds the product fixes (a) to (g); no code, enum, test, agent, hook, command, skill or canon file changes.
- Every pinning test keeps its recorded baseline.
</success_criteria>

<output>
Create .planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/261127-hdl-SUMMARY.md when done, in STE-style English with the fixed report fields (STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT).

Commit on main (this worktree is on main; do not create a branch; do not push). .planning/* is gitignored: stage the seed, the plan, the summary and the radar with `git add -f` (the radar, so the doc's repo-copy link resolves in a clone). Stage docs/CLAUDE-SURFACE-MODEL.md, CLAUDE.md and .claude/includes/decisions.md normally. Suggested message: "docs(quick-261127-hdl): Claude surface model doctrine; chat and Cowork merged into one cloud Claude; SEED-173 for the product fixes", with the attribution line the session gives.
</output>
