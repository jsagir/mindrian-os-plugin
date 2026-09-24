---
phase: quick/260924-ohd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/label-355-gold.cjs
  - tests/test-355-label-cli.cjs
autonomous: true
requirements: [R1, R2, R3, R4, R5, R6, R7]

must_haves:
  truths:
    - "R1: an ACCEPTED answer is written back on its own line. Triple sets (pairings-unstamped, pairings-stamped): `useful? y`, `direction ok? n`, `already known? n` (the field label plus the normalized lowercase token). Keyed sets (sentences, citations): `label: <resolved label text>`, e.g. `label: analytical`, `label: says_nothing`. The echo is written through the existing doSession `write` helper, before the next prompt or before recordEntry"
    - "R2: every item render is preceded by its own line `[<labeled>/<total>]`, labeled = Object.keys(session.entries).length at render time, total = order.length (the item count). The legend line is byte-identical and still the first line of the session output. The `All items labeled...` completion message is unchanged and carries no counter"
    - "R3: `u` with at least one entry writes `undo: <id> cleared` (the removed item id) and then re-shows that item with the decremented counter. `u` with zero entries still writes nothing"
    - "R4: a key outside the accepted set (e.g. `x` on a triple set, `9` or `y` on the sentences set, an empty line) writes zero bytes"
    - "R5: session.entries values, the save points (saveSessionAtomic in start, recordEntry, undo, saveAndQuit, and nowhere else), order_seed/shuffle, the fixture_sha256 and phrase_module_hash refusals, emit, import, status and the six-key session shape (set, fixture_sha256, order_seed, phrase_module_hash, started_at, entries) are unchanged. No now() call is added. A session file written in the pre-change shape resumes and re-saves byte-identical, and a copy of the navigator's live labeling-session-pairings-unstamped.json resumes under the new code showing `[N/96]` without the copy being written"
    - "R6: tests/test-355-label-cli.cjs gains a B12 block (PassThrough, non-TTY line path, tmp session dirs, zero network) asserting the counter before the first item and its increment after a full triple, every accepted echo, the undo line, and zero new bytes on an ignored key. The whole file passes with FAIL: 0 and all 72 pre-existing checks still pass"
    - "R7: no em-dash (U+2014) anywhere in either touched file"
  artifacts:
    - path: "scripts/label-355-gold.cjs"
      provides: "answer echo, per-item progress counter, undo line in the interactive start/resume loop"
      contains: "cleared"
    - path: "tests/test-355-label-cli.cjs"
      provides: "B12 sitting-UX legs (triple echo + counter + undo + ignored key; keyed echo; pre-change session resume byte-identical)"
      contains: "B12"
  key_links:
    - from: "scripts/label-355-gold.cjs showCurrent()"
      to: "session.entries"
      via: "counter line written before renderItem"
      pattern: "Object\\.keys\\(session\\.entries\\)\\.length \\+ '/' \\+ order\\.length"
    - from: "scripts/label-355-gold.cjs handleToken()"
      to: "write"
      via: "echo written after the token is accepted, before recordEntry or the next prompt"
      pattern: "'label: ' \\+ label"
    - from: "scripts/label-355-gold.cjs undo()"
      to: "write"
      via: "undo line written before showCurrent re-renders the cleared item"
      pattern: "'undo: ' \\+ lastId \\+ ' cleared"
---

<objective>
Make the blind labeling CLI tell the navigator that each key registered, and where he is in the set.

Root cause of "I typed and could not tell it registered": on a TTY the CLI switches stdin to raw mode (readline.emitKeypressEvents + setRawMode(true), scripts/label-355-gold.cjs doSession). Raw mode turns off the terminal's own local echo, so the typed character never appears on screen, and handleToken writes nothing back for an accepted key. For a triple the only visible change is the next prompt line; for the third answer and for every keyed answer the screen jumps straight to the next item with no count, so a registered key and a lost key look alike. The fix is to write the accepted answer back ourselves, prefix each item with a `[labeled/total]` counter, and name the undone item on `u`.

Purpose: the navigator is mid-sitting on 96 pairings (pairings-unstamped, 11 labeled at planning time). He needs confirmation per key and a progress count, with zero risk to the session file he is writing right now.

Output: scripts/label-355-gold.cjs (echo, counter, undo line) and tests/test-355-label-cli.cjs (B12 legs), committed in one commit.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@scripts/label-355-gold.cjs
@tests/test-355-label-cli.cjs

Read-only context, never write it: .planning/STATE.md, .planning/ROADMAP.md.

Interfaces the executor needs (already in the files, no exploration required):

- scripts/label-355-gold.cjs, doSession({ mode, setId, setDef, flags, input, output, write, now, root, direction }) at about line 556. Inside it: `order` (shuffled id list), `session` (the loaded or fresh session object), `showCurrent()` (line ~662), `recordEntry(entryValue)` (~677), `undo()` (~687), `saveAndQuit()` (~697), `handleToken(tokenRaw)` (~702, token is trimmed + lowercased), `nextUnlabeledId()`. The non-TTY path wires `readline.createInterface({ input })` with `rl.on('line', handleToken)`; that is the path the test drives.
- promptFor(field) at line ~187 returns 'useful? (y/n)', 'direction ok? (y/n)', 'already known? (y/n)', else field + '? (y/n)'. TRIPLE_FIELDS = ['useful', 'direction_ok', 'already_known'].
- SETS[setId].kind is 'keyed' (sentences keys 1-6 -> analytical/integrative/descriptive/evaluative/creative/none; citations s/n/c -> supports/says_nothing/contradicts) or 'triple'.
- module.exports = { run, SETS, LEGENDS, mulberry32 }.
- tests/test-355-label-cli.cjs helpers inside the file: loadCli(), mkTmpDir(label), writeJson(p, obj) (JSON.stringify(obj, null, 2), the same serialization saveSessionAtomic uses), makeOutput() (.text accumulates writes), stubDirection(overrides) (phrase_hash 'abc123'), the shared `now` clock, `goodDirection`, and fixture paths sentenceItemsPath (s1..s3), citationItemsPath (c1, c2), pairingItemsPath (p1 room 'alpha', p2 room 'beta'). The runner check(name, cond, detail) prints `PASS: <name>` or `FAIL: <name>`; the summary line is `PASS: <x> FAIL: <y>`. Baseline today: `PASS: 72 FAIL: 0`.

Hard safety rule for every run in this plan (the live sitting): NEVER run `start` or `resume` for any set without `--session-dir <a mktemp -d directory>`. A bare `node scripts/label-355-gold.cjs start --set pairings-unstamped` would overwrite the navigator's live session file with an empty one. Never open, edit, or write anything under .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/ ; the only permitted touch is a read-only `cp` of labeling-session-pairings-unstamped.json into a mktemp dir (Task 2 verify).

Scope notes: this is a dev-time script (never required from lib/ or hooks/), so the Tri-Polar three-surface rule and the Part 11 born-wired / HITL-shape declaration do not apply (it is not a command, agent, pipeline or skill). No Brain call, no network, no new dependency. Project skills (spike-findings, claude-md-optimizer) are not relevant to this change.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED - add the B12 sitting-UX legs to tests/test-355-label-cli.cjs</name>
  <files>tests/test-355-label-cli.cjs</files>
  <read_first>tests/test-355-label-cli.cjs (already in context: the B3 undo leg at ~line 191 is the harness pattern to copy; insert the new block after the B11c import legs and before the "Behavior 11 / static tripwire" block at ~line 766)</read_first>
  <behavior>
    - B12a (triple, pairings-unstamped): fresh start prints legend line, then `[0/2]` on its own line, then the first item's room line (alpha or beta)
    - B12a: `x` writes zero bytes; `y` writes exactly `useful? y\ndirection ok? (y/n)\n`; `n` writes exactly `direction ok? n\nalready known? (y/n)\n`; the third `n` writes `already known? n\n` followed by `[1/2]\n` and the other item
    - B12a: `z` after the triple writes zero bytes; `u` writes `undo: <firstId> cleared\n[0/2]\n` where firstId is the one key in session.entries before the undo; session.entries is empty after; q exits 0; the session file has exactly the six keys set, fixture_sha256, order_seed, phrase_module_hash, started_at, entries
    - B12b (keyed, sentences): start prints legend then `[0/3]`; `9` and `y` write zero bytes; `1` writes `label: analytical\n[1/3]\n` as the start of its delta; `6` writes `label: none\n[2/3]\n`
    - B12c (keyed, citations): `n` writes `label: says_nothing\n[1/2]\n` as the start of its delta (resolved label text, underscore kept)
    - B12d (resume compatibility, R5): a hand-written pre-change-shape session file resumes, prints legend then `[1/2]` then `beta`, and after q the file is byte-identical to what was written
  </behavior>
  <action>
Implements R2, R3, R4, R5 (test side) and R6. Add one new block headed by a comment `Behavior 12 (quick 260924-ohd): sitting UX - answer echo, [labeled/total] counter, undo line, ignored keys silent`. Every check name starts with `B12` so the RED gate below can filter on it. Define a local async helper `settle` inside the block that awaits two `setImmediate` turns (B2/B3 use one turn; two is margin for the readline line event). Use `cli.LEGENDS[setId]` for the legend string, never a retyped literal. Every run passes `--session-dir` pointing at a fresh `mkTmpDir(...)` directory and uses `goodDirection` and the shared `now`.

B12a: start pairings-unstamped on pairingItemsPath with `--seed 7`; await settle. Check `output.text.indexOf(legend + '\n[0/2]\n') === 0` and `/\[0\/2\]\n(alpha|beta)\n/` matches. Keep a `mark = output.text.length` and after each write + settle compute `delta = output.text.slice(mark)`, then move mark. Drive `x` (delta === ''), `y` (delta === 'useful? y\ndirection ok? (y/n)\n'), `n` (delta === 'direction ok? n\nalready known? (y/n)\n'), `n` (delta.indexOf('already known? n\n') === 0, delta.indexOf('[1/2]\n') > 0, and the counter comes after the echo). Read the session file: exactly one entry key, call it firstId. Drive `z` (delta === ''), then `u` (delta.indexOf('undo: ' + firstId + ' cleared\n[0/2]\n') === 0) and re-read the session file (zero entries). Drive `q`, await the run promise (code 0), and check `Object.keys(session)` equals exactly the six keys listed in the behavior block.

B12b: start sentences on sentenceItemsPath; legend + '\n[0/3]\n' at index 0; `9` and `y` each give delta === ''; `1` gives delta starting 'label: analytical\n[1/3]\n'; `6` gives delta starting 'label: none\n[2/3]\n'; q exits 0.

B12c: start citations on citationItemsPath; `n` gives delta starting 'label: says_nothing\n[1/2]\n'; q exits 0.

B12d: in a fresh tmp dir, writeJson a labeling-session-pairings-unstamped.json with set 'pairings-unstamped', fixture_sha256 = sha256 hex of the pairingItemsPath file bytes (crypto is already required, see B4), order_seed 42, phrase_module_hash 'abc123', started_at an ISO string, entries { p1: { useful: true, direction_ok: false, already_known: false, at: '2026-09-24T00:00:00.000Z', ms: 1234 } }. Capture the file bytes. Run `resume` on it; after settle check the output starts with legend + '\n[1/2]\nbeta\n'. Drive q, await (code 0), and check the file bytes equal the captured bytes exactly.

Keep the file's existing style: `'use strict'`, 2-space indent, single quotes, `check(name, cond, detail)`. Touch nothing outside the new block. No em-dashes (hyphens only). Do NOT commit in this task; the single commit happens at the end of Task 2 so main never carries a red test for peer sessions running run-all-355.

RED gate: run the file against the unchanged script. The B12 echo/counter/undo checks must FAIL, every non-B12 check must still PASS, and B12d (resume byte-identical) plus the zero-byte ignored-key checks are allowed to pass already (they describe behavior that must not change).
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && OUT=$(node tests/test-355-label-cli.cjs 2>&1); echo "$OUT" | tail -1; test "$(echo "$OUT" | grep '^FAIL:' | grep -vc '^FAIL: B12')" = "0" && test "$(echo "$OUT" | grep -c '^FAIL: B12')" -ge 1 && echo RED-OK</automated>
  </verify>
  <done>The B12 block exists with legs a-d; the run prints RED-OK (at least one `FAIL: B12...` line, zero non-B12 FAIL lines); scripts/label-355-gold.cjs is still unmodified (`git diff --quiet -- scripts/label-355-gold.cjs`); nothing committed yet.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN - echo, counter and undo line in scripts/label-355-gold.cjs, live-sitting compatibility check, commit</name>
  <files>scripts/label-355-gold.cjs, tests/test-355-label-cli.cjs</files>
  <read_first>scripts/label-355-gold.cjs lines 185-192 (promptFor) and 641-735 (doSession loop), already in context</read_first>
  <behavior>
    - Every B12 check from Task 1 passes; all 72 pre-existing checks still pass (FAIL: 0)
    - A read-only copy of the navigator's live pairings-unstamped session resumes under the new code, line 2 of output is `[N/96]` (N = its entry count), and the copy's sha256 is unchanged
  </behavior>
  <action>
Implements R1, R2, R3, R4, R5, R7 in scripts/label-355-gold.cjs. Four small edits, nothing else in the file changes behavior.

(a) Field label for the echo (R1). Add a function `answerLabel(field)` next to promptFor that returns 'useful?' for useful, 'direction ok?' for direction_ok, 'already known?' for already_known, and field + '?' otherwise. Rewrite promptFor to return answerLabel(field) + ' (y/n)' so its four outputs stay byte-identical.

(b) Counter (R2). In showCurrent, after the `currentId === null` completion branch and the itemById lookup, and immediately before `write(renderItem(setDef, item) + '\n')`, write '[' + Object.keys(session.entries).length + '/' + order.length + ']\n' on its own line. The completion message stays exactly as is (no counter). The legend write at `write(setDef.legend + '\n')` is untouched. Do not move `itemShownAt = now()` and do not add any now() call (entries.ms semantics and the test clock stay unchanged).

(c) Echo (R1, R4). In handleToken keyed branch: after `if (!label) return;` write 'label: ' + label + '\n', then recordEntry as today. In the triple branch: after `pending[nextField] = val;` write answerLabel(nextField) + ' ' + token + '\n' (token is already the normalized lowercase 'y' or 'n'), then the existing remaining/recordEntry/next-prompt logic unchanged. Every early `return` for a rejected token (empty, not y/n, unknown keyed key, currentId null, no nextField) stays before any write, so an ignored key writes nothing.

(d) Undo line (R3). In undo, keep the `keys.length === 0` silent return, the delete and the saveSessionAtomic call exactly as they are; after the save and before `currentId = lastId; showCurrent();` write 'undo: ' + lastId + ' cleared\n'.

Add one sentence to the file-header comment describing the new sitting feedback (accepted answers echoed, a [labeled/total] counter before each item, an undo line; raw mode turns off terminal echo, so the CLI writes the answer back itself; quick 260924-ohd). Hyphens only, no em-dashes (R7).

Then run the test (GREEN), the em-dash gate, and the live-sitting compatibility check in the verify block. The live check copies the navigator's session file into a mktemp dir (read-only on the original), resumes against the copy with stdin from /dev/null (no key is ever read, so nothing is saved), and confirms line 2 is `[N/96]` and the copy is unchanged. If `resume` refuses with a phrase_module_hash or fixture_sha256 message, STOP and report it: that means the live sitting itself would refuse too and is out of this plan's scope.

Optionally run `bash tests/run-all-355.sh` as an advisory signal; peer sessions are editing Phase 355 files in this same tree, so report any FAILED leg outside test-355-label-cli.cjs in the SUMMARY as observed-not-owned and do not touch it.

Commit (shared working tree with peer sessions; a diff the executor did not make is a peer's work and is never staged or reverted):
1. Before editing (start of Task 1) and again now, confirm `git status --porcelain -- scripts/label-355-gold.cjs tests/test-355-label-cli.cjs` shows only this plan's own edits, and `git diff -- scripts/label-355-gold.cjs tests/test-355-label-cli.cjs` contains only the hunks this plan made. If either file carries a hunk you did not write, STOP and report; never revert it.
2. Stage with `git add scripts/label-355-gold.cjs tests/test-355-label-cli.cjs`.
3. Commit with `git commit --only -m "feat(quick-260924-ohd): label-355-gold echoes accepted answers, shows [labeled/total], names undone item" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- scripts/label-355-gold.cjs tests/test-355-label-cli.cjs`.
4. Record the sha and confirm it is an ancestor of HEAD with `git merge-base --is-ancestor <sha> HEAD`.
5. The SUMMARY (and this PLAN) live under .planning/quick/, which is gitignored: stage them with `git add -f <path>` and commit with `git commit --only -- <paths>`, same form.

HARD LINE: never `git add -A` or `git add .`, never `gsd-tools query commit` (it sweeps the whole index), never `git commit --amend`, `git reset` (any mode), `git checkout -- <path>`, `git restore`, `git stash`, `git rebase`, `git cherry-pick`, or `git clean`. Do not touch .planning/STATE.md or .planning/ROADMAP.md.

In the SUMMARY, tell the navigator how to pick up the new UX: his running process keeps the old code in memory; press q between items (right after a `[n/96]` counter appears, never mid-triple, because a partial triple is held in memory and only saved once all three answers are in), then run `node scripts/label-355-gold.cjs resume --set pairings-unstamped`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-355-label-cli.cjs 2>&1 | tail -1 | grep -E '^PASS: [0-9]+ FAIL: 0$' && ! grep -nP '\x{2014}' scripts/label-355-gold.cjs tests/test-355-label-cli.cjs && T=$(mktemp -d) && F=labeling-session-pairings-unstamped.json && cp .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/$F "$T/" && B=$(sha256sum "$T/$F" | cut -d' ' -f1) && N=$(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).entries).length)" "$T/$F") && node scripts/label-355-gold.cjs resume --set pairings-unstamped --session-dir "$T" < /dev/null | sed -n '2p' | grep -qx "\[$N/96\]" && test "$(sha256sum "$T/$F" | cut -d' ' -f1)" = "$B" && echo LIVE-COMPAT-OK</automated>
  </verify>
  <done>The test file ends `PASS: <n> FAIL: 0` with n greater than 72; zero em-dashes in both files (the grep deliberately counts comments too, since the rule covers comments); LIVE-COMPAT-OK printed; one commit containing exactly scripts/label-355-gold.cjs and tests/test-355-label-cli.cjs, its sha an ancestor of HEAD; the live session file under .planning/phases/355-.../ was never written by this plan.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigator keyboard -> CLI | local keypresses (raw mode on a TTY, line mode otherwise); the only input |
| CLI -> session file on disk | labeling-session-<set>.json, written by saveSessionAtomic; the navigator's live sitting writes the pairings-unstamped one right now |
| CLI -> screen | what the judge sees; blinding depends on nothing label-biasing being printed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ohd-01 | Tampering | live labeling-session-pairings-unstamped.json | mitigate | Every start/resume in this plan passes --session-dir to a mktemp dir; the live file is only ever the source of a read-only cp; no edit touches saveSessionAtomic call sites or the session object's keys |
| T-ohd-02 | Tampering | session file shape across the code change | mitigate | B12d resumes a pre-change-shape file and asserts byte-identical bytes after q; Task 2 verify resumes a copy of the real sitting and asserts `[N/96]` with the copy's sha256 unchanged |
| T-ohd-03 | Information disclosure | echo, counter and undo line vs blinding (D-31) | accept | The echo repeats only the judge's own key or its label; the counter is two integers; the undo line prints an item id, and ids are opaque (pairings are 12-hex hashes, sentences s001.., citations cp-001..). No displayFields whitelist change, no boundary_tag or stamp text; the B9 forbidden-substring leg keeps guarding the unstamped display |
| T-ohd-04 | Repudiation | commit attribution in a shared tree | mitigate | git commit --only on the two owned paths; pre-commit diff check that every hunk is this plan's; merge-base ancestor check after commit |
| T-ohd-05 | Denial of service | ignored keys | accept | Unknown keys still return before any write or save; no new loop or listener |
</threat_model>

<verification>
- `node tests/test-355-label-cli.cjs` ends `PASS: <n> FAIL: 0`, n > 72, including every B12 check.
- `grep -nP '\x{2014}' scripts/label-355-gold.cjs tests/test-355-label-cli.cjs` prints nothing.
- LIVE-COMPAT-OK from the Task 2 verify (copy of the real sitting resumes with `[N/96]`, copy unchanged).
- `git show --stat HEAD` style check on the recorded sha lists exactly the two owned files.
</verification>

<success_criteria>
- R1: accepted answers echo as `useful? y` / `direction ok? n` / `already known? n` / `label: <label>`.
- R2: `[labeled/total]` on its own line before every item render; legend line unchanged.
- R3: `undo: <id> cleared` before the re-shown item.
- R4: ignored keys write zero bytes.
- R5: entries, saves, seed, hash refusals, emit, import, status and session shape unchanged; the navigator's live session resumes under the new code.
- R6: B12 legs in tests/test-355-label-cli.cjs, pure local, zero network, all green.
- R7: no em-dashes in either file.
</success_criteria>

<output>
Create `.planning/quick/260924-ohd-label-355-gold-sitting-ux-echo-accepted-/260924-ohd-SUMMARY.md` when done (stage with `git add -f`, commit with `git commit --only -- <path>`). Include the commit sha, the before/after sample of a triple and a keyed answer as it appears on screen, the LIVE-COMPAT-OK N value, and the navigator pick-up instruction from Task 2.
</output>
