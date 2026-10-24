---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 06
subsystem: ui-mod-copy
tags: [mos-face, copy, voice, theo, plain-english, reply-chip, commands-generator, drift-gate]
requires: [380-05]
provides:
  - ui/mos-face/tests/copy.test.tsx (C1 to C7, rendered-text scan)
  - tests/test-380-copy.cjs (static scan S1 to S5)
  - ui/mos-face/scripts/face-commands.cjs (--check and --write for hooks/commands.ts)
  - README section Copy
affects: [380-07, 380-08, 380-11]
key-files:
  created:
    - ui/mos-face/tests/copy.test.tsx
    - tests/test-380-copy.cjs
    - ui/mos-face/scripts/face-commands.cjs
  modified:
    - ui/mos-face/hooks/register.tsx
    - ui/mos-face/hooks/commands.ts
    - ui/mos-face/hooks/voice.ts
    - ui/mos-face/hooks/glossary.ts
    - ui/mos-face/.claude-plugin/plugin.json
    - ui/mos-face/panel.test.tsx
    - ui/mos-face/tests/support.ts
    - ui/mos-face/README.md
requirements-completed: [MOD380-04]
completed: 2026-10-23
---

# Phase 380 Plan 06: Copy, voice and the honest commands table (MOD380-04) - Summary

The panel now speaks as Theo in plain words: no panel-authored string names Larry, no stack word and no dash is drawn, registered, toasted or tabled, the reply chip quotes the reply as it stands (D-07), and the commands table is generated from the plugin registry with a drift gate.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing was pushed. No branch was created or switched. `git rev-list --count origin/main..main` is 20 (17 earlier plus the 3 below).

## Commits (release tree)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 8332e7068 | test(380-06): RED copy scan for the rendered text, commands, toasts and tables (D-04) |
| 2 | 9ef971fd7 | feat(380-06): face-commands generator and drift gate, regenerated WHY lines in plain words (D-04) |
| 3 | 65719398e | fix(380-06): the panel speaks as Theo in plain words, no Larry in panel copy (D-04) |

## Root cause (PROVEN by reading the source before the patch)

1. The badge text " Larry | MindrianOS " was drawn in the pane and in the box above the prompt, and the reply chip drew the same literal. Two click hints said "Larry thinks it through". The /mos-chip description and the manifest description named Larry. The persona name was typed into five panel strings, so D-04 could not hold.
2. The reply chip drew a fixed literal, not the reply's own lead. A chip that said anything else than the reply would misquote the reply (D-07).
3. `hooks/commands.ts` was generated against plugin 2.0.0-beta.69 by a script that was never kept. Five WHY lines held the words Brain, MCP or BRAIN.md and one held Aura. The file also held a command (/mos:pws-brain) that the registry no longer has, and a PLUGIN_VERSION constant that nothing reads and that goes stale at each release bump.

## RED list (commit 8332e7068, PROVEN)

`claude plugin test .`: 64 pass, 12 fail. Failing: C1 rest, listen, search, found, none, refused, handover (the badge Larry in every style, width and plain mode), C1 next move (badge and both hints), C1 every block (badge), C2 (the /mos-chip description), C4 (6 WHY lines), C5 (the badge). C3 passed in RED (no toast named a banned word) and C6 passed (no name in any table); both stay as guards. The 34 originals passed.

`node tests/test-380-copy.cjs`: 17 passed, 4 failed. Failing: S1 (12 hits: 6 in commands.ts, 6 in register.tsx), S2 (manifest names Larry), S3 (face-commands.cjs did not exist), S4 (one test title said Larry). S5 passed.

## GREEN run (PROVEN)

| Command | Result |
|---------|--------|
| `claude plugin test .` in `ui/mos-face` (also via `node tests/test-380-engine-tests.cjs`) | 76 pass, 0 fail (34 original plus 42 added); pass count equals the 76 declarations on disk |
| `node tests/test-380-copy.cjs` | 22 passed, 0 failed (S1 read 2050 text parts of 13 hook files, 0 hits) |
| `node ui/mos-face/scripts/face-commands.cjs --check` | 112 WHY lines, 0 drift warnings, 0 problems, exit 0 |
| `node ui/mos-face/scripts/typecheck.cjs` | exit 0 |
| `bash tests/run-all-380.sh` | `PASSED=9 FAILED=0 SKIPPED=4 KNOWN=0` (4 skipped: legs of plans 07 to 10 not yet landed) |
| `LC_ALL=C /usr/bin/grep -P '\xE2\x80[\x93\x94]'` over ui/mos-face (without node_modules, lockfile, engine types) and the new tests | no hit |

## Mutation runs (PROVEN, scratch copy under the session scratchpad, no git checkout)

| Mutation | Caught by |
|----------|-----------|
| chip text fixed to " Theo | MindrianOS " | C5 |
| chip text fixed to a Larry literal | S1 |
| pane badge back to Larry | C1 (7 states), the adopted pane test, S1 |
| a click hint names Larry | C1 next move, S1 |
| the word Brain put in a thought | C4, S1 |
| an em-dash put in the start toast | C3, S1 |
| the word ICM put in a command description | C2, S1 |

## WHY table and override list

`--write` changed the commands table as follows (112 lines now, 113 before):

- 4 lines changed because the registry text changed since beta.69: /mos:deep-grade, /mos:causal, /mos:find-connections, /mos:suggest-next.
- 5 lines changed by the plain-words override map (the generated sentence still held a banned word):
  - /mos:admin: "When you need to inspect or rotate your Theo access keys, /mos:admin opens the admin panel"
  - /mos:agentshield: the word MCP removed; "scans all five" replaces "scans all five surfaces"
  - /mos:brain-derive: "When a room section drifts from its Theo context file, /mos:brain-derive rebuilds that file now"
  - /mos:mos-reason: the registry's second sentence is used (the first, "FeyMinto is ... BRAIN.md ...", does not name the command)
  - /mos:research: "cross-referenced with Theo's methodology graph"
- 1 line removed: /mos:pws-brain (Aura Agent line). The registry no longer holds that command.
- Commands added against the beta.69 file: none. Removed: /mos:pws-brain.
- PLUGIN_VERSION ("2.0.0-beta.69") is removed: nothing reads it and it goes stale at each release.
- The key order of the file is kept, so the diff holds 16 insertions and 17 deletions.
- Every command named by TERM_COMMANDS, STATE_COMMANDS and DOCTOR exists in the registry. No NEEDS_HUMAN case arose.
- The Larry-to-Theo reading of the generator changed no further line (the old file already held it).

## What changed in the panel

- Badge: " Theo | MindrianOS " in the pane and in the box above the prompt.
- Reply chip: `LEAD` gained a capture group for the marker text; the chip draws that group between the same padding spaces. Quoted text is the reply's own marker text; the move glyph stays the chip color (as before) and the markdown stars stay out of the chip (as before). The panel adds, removes and rewrites nothing in the quote.
- Hints: "click: a question about your case goes in the prompt box, and Enter sends it. Run puts the bare command in the box." and "click a number: a question about your case goes in the box, then Enter sends it. Run: the bare command". Both say what really happens.
- /mos-chip description: "Turn the colored badge on replies on or off".
- Manifest description: "Shows the Theo face, the state of your data room and the next move beside the chat, driven by what really happens in the session." Name, version and types field are unchanged.
- voice.ts: comment only. No thought text changed: the scan found no banned word in any thought, label, why or table.
- glossary.ts: header comment only (source named, vendored sentence). No definition edited. The names scan found no person or institution name in any table or drawn text.
- README: new section Copy (rules with book citations, what the tests scan, the chip decision, the glossary note).

## Real engine check (PROVEN)

`claude --plugin-dir ui/mos-face -p "/mos-text"` ran on the real engine (no model call). Printed text (home path replaced by HOME, the real room name replaced by ROOM):

```
mos-face: /m:os state, read 18:36:01 through files
WRITES TO: nothing, this session is not bound
READS: ROOM
NOW: 4 sections have reasoning older than their files (/mos:reason)
ROOM ROOM: stage Pre-Opportunity, 19 entries, state read 2026-10-23T15:35:54Z
STALE REASONING: financial-model, legal-ip, solution-design, team-execution
  section ...: N entries (13 sections)
THEO: health theo-mcp.onrender.com - 200 292ms; 0 calls this session (0 ok, 0 empty, 0 error, 0 blocked)
SITE: www.mindrian-os.com - 200 711ms
PLUGIN: 2.0.0-beta.73 active, 2.0.0-beta.73 installed
NEXT: Theo suggests once the talk gives something to go on
NOTE: The MindrianOS tools were out of reach, so the room was read from files
NOTE: room_state_bound was refused by the permission mode
NOTE: The data room numbers were not read: they need the room tools, which were out of reach
```

Scan result: no em-dash, no en-dash, no Larry, ICM, Brain, Aura, "the book" or name. The plan's own verify command (first 12 lines, Larry|Brain|MCP|ICM) passes. The word MCP appears once, inside the host name theo-mcp.onrender.com in line 8 (a server address the panel read from the machine, not copy); the scan rule treats a host name as data (see Decisions).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] support.ts (plan 04 file, not in this plan's file list) needed two additive options**
- `registered` (name and description of every `$.command.register` call) and `toasts` (every toast text), so C2 and C3 can read what the panel registers and toasts. No existing test changed.
- **Commit:** 8332e7068

**2. [Rule 3 - Blocking] S1 cannot use the TypeScript parser**
- **Issue:** the plan asked for a static scan of string literals. The walled package pins TypeScript 7.0.2, a native build with no script API (no lib/typescript.js), and the wall rules forbid another compiler.
- **Fix:** tests/test-380-copy.cjs holds a small reader for TS and TSX (quote strings, template parts, JSX text; skips comments, regex literals and module paths; throws on a string that runs over a line). Four self-test legs prove the reader and five prove the rule. It needs no compiler, so the leg never skips.
- **Commit:** 8332e7068

**3. [Rule 1 - Bug in the plan's verify command] Task 2 verify greps the word Brain in commands.ts**
- `/mos:brain-derive` is a real command name of the plugin and sits in the file (key and value), so the literal grep always hits. The check was run with command names removed (`sed -E 's#/mos:[a-z0-9-]+# #g'`): no hit. The same rule is in all three scanners.

**4. [Rule 2 - Missing critical rule] The scan treats a host name as data**
- **Found during:** the real-engine run. The Theo block draws the server address read from the warm-up record (theo-mcp.onrender.com), which holds the letters MCP between hyphens.
- **Fix:** the scan removes command names and host names (a name ending in .com, .net, .org, .io, .dev, .app or .test) before it looks for words. A self-test leg proves a bare "MCP server" is still caught, and C1 "every block" draws a host name through a prewarm file and checks the Theo block shows it.
- **Commit:** 65719398e

**5. [Plan figure] "10 lines with Brain, MCP, BRAIN.md or Aura"**
- The beta.69 file holds 6 WHY lines with a banned word (admin, agentshield, brain-derive, mos-reason, pws-brain, research). The 10 of the plan matches the 10 lines that differed from the registry by sentence shape. Both are listed above; no line was left.

### Edits to adopted tests (panel.test.tsx), complete list

1. Line about 171, test "the box draws when the panel is not placed, and Hide leaves a way back": the assertion looked for the text Larry; it now looks for `Theo | MindrianOS`.
2. Line about 186, test "the side panel draws the avatar, the meter and the room": same change.
3. Line about 360: the test title "a click asks Larry to think it through ..." now reads "a click asks Theo to think it through ...". The body is unchanged.

The count stays 34. The plan 05 edit (the `world()` call of one test) is unchanged and no other adopted assertion was edited.

### Test expectation fixes (my own tests)

- The chip test (C5) needs a base drawing under the plugin: the engine has no renderer for `AssistantMessage` in a test, so the test registers one (it draws the text it is given). This also proves the quoted lead is cut from the text and the rest is passed on.
- C3 reaches the "failed" toast by returning `isError` from the tool handler. The engine accepted it and the toast appeared.

## Decisions

- The chip pattern still matches only a lead that says Larry | MindrianOS (the plugin persona's own lead). A reply led by "Theo | MindrianOS" gets no chip, as before. I did not widen the pattern: that would be a new feature, and it would change which turns set the face color. Open item for plan 07 or the navigator if the persona prompt later says Theo.
- Command names and host names are data, not copy. A command name is owned by the plugin and typed as written, and renaming /mos:brain-derive is out of scope.
- The override map lives in the script, applies only where a generated sentence holds a banned word, and --check validates the map itself.
- --check warns (exit 0) on registry drift and fails only on hard problems, as the plan says; the recovery text is "run --write, then the build".

## Open items for later plans

- Plan 11 (owner): does the vendored glossary ship in the public tarball? It holds first sentences of a private PWS glossary. This plan scanned it for names (none found) and named its source in the header. The reply chip question is closed by D-07.
- Plan 07 (book review): words that are not on the D-04 list but may read as stack lingo: tool identifiers drawn as written (room_state_bound in a note, brain_ask in the Calls pane), and terms inside registry sentences (Cypher in /mos:graph, HSI, PEST, TRIZ). The dump for the review is `MOS_COPY_DUMP=1 claude plugin test .` (prints COPYDUMP_BEGIN ... COPYDUMP_END from test C7; UNVERIFIED that the engine passes the variable to the test process, not run here).
- The book follow-up of N1 (stale Canon v5 label) is untouched.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file access or schema. T-380-21 to T-380-24 are mitigated as planned: the override map and --check plus C1 to C4 (stack words), C6 (names), --check against the registry (stale commands), C5 (chip equals the reply's lead).

## Not measured

- No real-terminal screenshot was taken here (plan 380-10 owns the captures). The rendered-text scan reads the drawing tree from the engine test kit, not pixels. Implementation complete; visual verification pending.
- MOS_COPY_DUMP output was not run through the book review (plan 07).

## Self-Check: PASSED

- Files found in the release tree: `ui/mos-face/tests/copy.test.tsx`, `tests/test-380-copy.cjs`, `ui/mos-face/scripts/face-commands.cjs`.
- Commits found in the release tree: 8332e7068, 9ef971fd7, 65719398e (`git log --oneline -3`).
