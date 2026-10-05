---
phase: quick
plan: 261005-lzg
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/larry-extended.md
autonomous: true
requirements: [SEED-121]
must_haves:
  truths:
    - "agents/larry-extended.md frontmatter carries exactly one YAML comment line naming SEED-121 as an idea dormant until Phase 369.6, with the seed file path, placed directly after the layer_why: key and before the closing --- fence"
    - "The edit adds exactly one line and removes none (git diff --numstat reads 1 0); every frontmatter key and the whole prompt body are byte-identical to HEAD, so Larry's runtime behaviour is unchanged"
    - "The frontmatter still parses to the same 13 keys under js-yaml and under the repo's own parseFrontmatter (scripts/check-shape-declaration.cjs), with connector.excluded true, hitl_shape F.1, layer loop"
    - "check-shape-declaration --check reports the larry-extended line identically before and after the edit; build-connector-registry --check passes"
    - "The commit contains agents/larry-extended.md and nothing else; every other dirty file in the working tree is left exactly as found"
  artifacts:
    - path: "agents/larry-extended.md"
      provides: "SEED-121 pointer as a frontmatter provenance comment (Phase 95.6 D-10 / Phase 172-06 precedent)"
      contains: "# SEED-121 (idea, dormant until Phase 369.6)"
  key_links:
    - from: "agents/larry-extended.md"
      to: ".planning/seeds/SEED-121-larry-review-spine-from-the-seven-larrai-reviews.md"
      via: "YAML comment carrying the seed's repo-relative path"
      pattern: "SEED-121-larry-review-spine-from-the-seven-larrai-reviews\\.md"
---

<objective>
Add a single YAML comment line to the frontmatter of agents/larry-extended.md that points at SEED-121 (the LarrAI review spine idea), so the next person who opens the Larry agent before Phase 369.6 sees the seed exists and where it lives.

Purpose: SEED-121 targets this agent ("a review mode, or a reach the agent hosts"). A pointer in the agent's own provenance comments keeps the idea discoverable without encoding any review behaviour before the 369.6 Larry contract opens. The body is Larry's live system prompt, so the pointer goes in the frontmatter as a comment, which every YAML parser discards: zero runtime change.

Output: agents/larry-extended.md with one added comment line; one commit containing only that file; 261005-lzg-SUMMARY.md.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@agents/larry-extended.md
@.planning/seeds/SEED-121-larry-review-spine-from-the-seven-larrai-reviews.md

Facts measured at plan time (2026-10-05, HEAD includes 5b42ad733, the last commit to touch the agent file):
- agents/larry-extended.md is 217 lines and CLEAN in the working tree. Frontmatter fences are line 1 and line 34. Line 33 is the only line starting with `layer_why: ` (the anchor). Line 26 is the `# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---` block header; lines 27-33 are connector:, excluded:, reason:, hitl_shape:, hitl_why:, layer:, layer_why:.
- Baseline: zero em-dash characters in the file; zero occurrences of SEED-121.
- Baseline: js-yaml (present in node_modules) parses 13 keys: name, description, model, color, skills, mcpServers, initialPrompt, persona_variants, connector, hitl_shape, hitl_why, layer, layer_why.
- Baseline: `node scripts/check-shape-declaration.cjs --check` exits 0 and prints exactly one larry-extended line, the pre-existing advisory WARN that the agent declares hitl_shape F.1 AND connector.excluded:true. That WARN is not this task's to fix. NOTE: the script without `--check` prints usage and exits 2, so always pass `--check`.
- Baseline: `node scripts/build-connector-registry.cjs --check` and `node scripts/build-orchestration-projection.cjs --check` both print OK and exit 0. `bash tests/test-114-substrate-preload.sh` and `bash tests/test-115-persona-variants.sh` both pass (115 Test 7 is a no-em-dash check on this file).
- The insertion was dry-run on a scratch copy at plan time: js-yaml and parseFrontmatter both still return 13 keys with connector.excluded true, hitl_shape F.1, layer loop; SEED-121 count 1; em-dash count 0.
- The working tree carries about 50 dirty paths belonging to other sessions, including data/harness-manifest.json (a peer's uncommitted regen). None of them are this task's.
- KNOWN SIDE EFFECT, out of scope: data/harness-manifest.json pins a sha256 digest of agents/larry-extended.md (runtime role cli_agent). Any byte change to the agent file makes `node scripts/build-harness-manifest.cjs --check` report STALE for that surface. HEAD's committed manifest was ALREADY stale for this file since 5b42ad733 (HEAD manifest digest 73127dd6..., HEAD file digest 4035f4c6...); the working tree only reads OK today because a peer's uncommitted regen of the manifest sits in the tree. This task does NOT touch, regenerate or commit the manifest (locked decision 4 and the --only commit scope). The pre-commit hook only runs the manifest check when a data/ registry or manifest file is staged, so a commit of agents/larry-extended.md alone does not trip it.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Capture baselines, insert the SEED-121 comment line, verify the frontmatter and gates</name>
  <files>agents/larry-extended.md</files>
  <read_first>agents/larry-extended.md lines 1-35 (frontmatter only; the body is not edited and does not need reading)</read_first>
  <action>
Run everything from /home/jsagi/dev/MindrianOS-Plugin (never from ~/.claude/plugins). Shell state does not persist between Bash calls, so the baselines live at a FIXED path and every command block sets it first: `S=.planning/quick/261005-lzg-add-a-one-line-pointer-to-seed-121-the-l/.baseline && mkdir -p "$S"`. That directory sits under the gitignored .planning/ tree, so it never shows in `git status --porcelain` and is never staged; Task 2 deletes it after the SUMMARY is written.

Step 0, ownership guard: `git status --short agents/larry-extended.md` must print nothing. If the file is already dirty, STOP and report: someone else owns an uncommitted diff on it, and this task never edits or reverts an unowned diff.

Step 1, baselines BEFORE the edit (the after-checks compare against these):
- `node scripts/check-shape-declaration.cjs --check > "$S/shape-before.txt" 2>&1`, then `grep 'larry-extended' "$S/shape-before.txt" > "$S/shape-before-larry.txt"` (expected: exactly one line, the pre-existing F.1 plus connector.excluded advisory WARN).
- `git status --porcelain | grep -v ' agents/larry-extended.md$' | sort > "$S/dirty-before.txt"` (the peer-owned dirty set; Task 2 proves it is untouched).
- `node scripts/build-harness-manifest.cjs --check > "$S/manifest-before.txt" 2>&1; echo "manifest-before exit $?" >> "$S/manifest-before.txt"` (informational only, for the SUMMARY).

Step 2, the edit (locked decisions 1, 2 and 3): insert exactly ONE new line directly after the line that starts with `layer_why: ` (line 33) and directly before the closing `---` fence (line 34). The new line, verbatim, is the navigator's locked shape:

# SEED-121 (idea, dormant until Phase 369.6): the LarrAI review spine, four moves every one of the seven 2025 reviews shares; candidate review mode or hosted reach for this agent. See .planning/seeds/SEED-121-larry-review-spine-from-the-seven-larrai-reviews.md

Wording kept verbatim on purpose: it already carries every required element (the seed id, the word idea, the 369.6 dependency, the file path) and is the same single-long-line shape as the existing `# Phase 95.6 D-10:` precedent on line 11. It names no reviewed venture and no person; do not add any (the seed lists the seven ventures; the shipped agent file must not). It must be a single line so `grep -c SEED-121` counts exactly 1 (a second line carrying the path would contain SEED-121 again). No leading spaces (column 0, like the line 26 and line 11 comments), no trailing whitespace, hyphens only, no em-dash or en-dash.

Insert mechanically, not by rewriting the file: either the Edit tool with old_string = the full layer_why line plus the newline plus `---` and new_string = the same text with the comment line between them; or awk with the comment held in a shell variable L: `awk -v line="$L" '{print} /^layer_why: /{print line}' agents/larry-extended.md > "$S/le.md" && cat "$S/le.md" > agents/larry-extended.md` (the awk form was dry-run at plan time; `cat >` keeps the file's inode and mode). The anchor `^layer_why: ` matches exactly one line in the file.

Locked decisions 4 and 5: change nothing else in agents/larry-extended.md (no key edits, no reordering, no reflow, no body edits, no trailing-newline change) and do not open the seed file for writing. Do not touch data/harness-manifest.json or any other file.

Step 3, after-checks: run the verify block below exactly as written. It is one unbroken && chain that only prints ALL-TASK1-CHECKS-PASS when every check passed; the SQLite ExperimentalWarning on stderr is noise, not a failure. Do not wrap any node call in a pipe (a pipe would report the pipe's exit code, not node's). If any check fails, fix only what this edit caused; if the failure is pre-existing or peer-caused (compare against the Step 1 baselines), record it in the SUMMARY and do not chase it.

Step 4, expected side effect (record, do not fix): `node scripts/build-harness-manifest.cjs --check > "$S/manifest-after.txt" 2>&1; echo "exit $?" >> "$S/manifest-after.txt"` is expected to exit 1 with a `STALE: the cli_agent larry surface (agents/larry-extended.md)` line plus the byte-compare STALE line for data/harness-manifest.json. Do NOT run `build-harness-manifest.cjs` (default write) or `--refresh`: the manifest carries a peer's uncommitted diff and is outside this task's commit scope. Record in the SUMMARY under a "Hand-off" heading: "data/harness-manifest.json cli_agent digest for agents/larry-extended.md must be regenerated (node scripts/build-harness-manifest.cjs --refresh) by whoever commits the manifest next; HEAD's committed manifest was already stale for this file since 5b42ad733."
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && S=.planning/quick/261005-lzg-add-a-one-line-pointer-to-seed-121-the-l/.baseline && F=agents/larry-extended.md && [ -s "$S/shape-before-larry.txt" ] && [ "$(git diff --numstat -- $F)" = "$(printf '1\t0\t%s' $F)" ] && [ "$(grep -c 'SEED-121' $F)" = "1" ] && sed -n 34p $F | grep -q '^# SEED-121 (idea, dormant until Phase 369.6): ' && sed -n 34p $F | grep -qF '.planning/seeds/SEED-121-larry-review-spine-from-the-seven-larrai-reviews.md' && sed -n 33p $F | grep -q '^layer_why: ' && [ "$(sed -n 35p $F)" = "---" ] && ! grep -qP '\x{2014}' $F && ! grep -qP '\x{2013}' $F && ! sed -n 34p $F | grep -qP '\s$' && node -e "const y=require('js-yaml');const t=require('fs').readFileSync('$F','utf8');const m=t.match(/^---\n([\s\S]*?)\n---\n/);const fm=y.load(m[1]);const k=Object.keys(fm);if(k.length!==13||k[12]!=='layer_why'||fm.connector.excluded!==true||fm.hitl_shape!=='F.1'||fm.layer!=='loop'){console.error('js-yaml FAIL',k);process.exit(1)}console.log('js-yaml OK 13 keys')" && node -e "const {parseFrontmatter}=require('./scripts/check-shape-declaration.cjs');const fm=parseFrontmatter(require('fs').readFileSync('$F','utf8'));if(!fm.connector||fm.connector.excluded!==true||fm.hitl_shape!=='F.1'||fm.layer!=='loop'||!fm.layer_why){console.error('parseFrontmatter FAIL');process.exit(1)}console.log('parseFrontmatter OK')" && node scripts/check-shape-declaration.cjs --check > "$S/shape-after.txt" 2>&1 && grep 'larry-extended' "$S/shape-after.txt" > "$S/shape-after-larry.txt" && diff "$S/shape-before-larry.txt" "$S/shape-after-larry.txt" && node scripts/build-connector-registry.cjs --check && node scripts/build-orchestration-projection.cjs --check && bash tests/test-114-substrate-preload.sh > "$S/t114.txt" 2>&1 && bash tests/test-115-persona-variants.sh > "$S/t115.txt" 2>&1 && echo ALL-TASK1-CHECKS-PASS</automated>
  </verify>
  <done>
- agents/larry-extended.md line 34 is the SEED-121 comment, line 33 is still layer_why:, line 35 is the closing ---; git diff --numstat reads exactly 1 added, 0 removed.
- grep -c SEED-121 is 1; no em-dash (U+2014) and no en-dash (U+2013) anywhere in the file; no trailing whitespace on the new line.
- js-yaml and the repo's parseFrontmatter both parse 13 keys with connector.excluded true, hitl_shape F.1, layer loop, layer_why last.
- The larry-extended line of check-shape-declaration --check is byte-identical before and after (diff empty, file non-empty).
- build-connector-registry --check and build-orchestration-projection --check print OK; tests 114 substrate-preload and 115 persona-variants pass.
- build-harness-manifest --check STALE on the cli_agent surface is recorded as the expected hand-off, and data/harness-manifest.json is untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Commit agents/larry-extended.md alone with --only and prove the commit scope</name>
  <files>agents/larry-extended.md</files>
  <action>
Commit ONLY agents/larry-extended.md with `git commit --only`. The working tree carries about 50 unrelated dirty paths owned by other sessions; they must not be staged, committed, stashed, reset, checked out or reverted.

Forbidden in this task: `git add -A`, `git add .`, `git add -u`, `git commit -a`, `git stash`, `git reset`, `git checkout -- <anything>`, `git restore`, `--no-verify`, and `gsd-tools query commit --files` (it sweeps the whole index; a prior incident in this repo). Do not push.

Commit command shape (two -m flags, subject then trailer, path after the double dash):
git commit --only -m "docs(261005-lzg): point larry-extended at SEED-121 (LarrAI review spine idea)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- agents/larry-extended.md

Trailer rule: the orchestrator supplied `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` as the trailer its harness requires. The trailer must name the model that actually authored the commit: if the executor's own harness attribution reminder names a different Co-Authored-By line, use the executor harness's line verbatim instead and note the substitution in the SUMMARY.

The pre-commit hook (scripts/hooks/pre-commit, identical to .git/hooks/pre-commit) fires the connector-registry, orchestration-projection and shape-declaration gates for a staged agents/*.md; all three passed in Task 1. If the hook fails, read its message: fix only a failure this edit caused, otherwise stop and report the hook output verbatim. Never bypass it.

After the commit:
- Record the new sha by subject, not by HEAD (a peer may commit right after you): `SHA=$(git log -1 --format=%H -F --grep='docs(261005-lzg): point larry-extended at SEED-121')`.
- Prove the sha is on the branch: `git merge-base --is-ancestor "$SHA" HEAD` (guards against a peer reset orphaning the commit).
- Prove the scope: `git show --name-only --format= "$SHA"` prints exactly agents/larry-extended.md and nothing else; `git show --numstat --format= "$SHA"` reads 1 0.
- Prove the peer-owned dirty set is untouched: with `S=.planning/quick/261005-lzg-add-a-one-line-pointer-to-seed-121-the-l/.baseline`, `git status --porcelain | grep -v ' agents/larry-extended.md$' | sort` equals "$S/dirty-before.txt" from Task 1 (a peer may legitimately have changed files meanwhile; if the sets differ, list the difference in the SUMMARY and confirm none of the differing paths were touched by this task's commands).
- `git status --short agents/larry-extended.md` prints nothing (the file is committed and clean).

Then write .planning/quick/261005-lzg-add-a-one-line-pointer-to-seed-121-the-l/261005-lzg-SUMMARY.md: the sha, the exact inserted line, the before/after check results, the trailer used, and the Hand-off note about data/harness-manifest.json from Task 1. The SUMMARY is not part of the code commit (.planning/ is gitignored; the quick workflow handles its own docs commit with git add -f). After the SUMMARY is written, delete the baseline directory: `rm -rf .planning/quick/261005-lzg-add-a-one-line-pointer-to-seed-121-the-l/.baseline` (it must never be git add -f'd).
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && SHA=$(git log -1 --format=%H -F --grep='docs(261005-lzg): point larry-extended at SEED-121') && [ -n "$SHA" ] && git merge-base --is-ancestor "$SHA" HEAD && [ "$(git show --name-only --format= "$SHA" | sed '/^$/d')" = "agents/larry-extended.md" ] && [ "$(git show --numstat --format= "$SHA" | sed '/^$/d')" = "$(printf '1\t0\tagents/larry-extended.md')" ] && git log -1 --format=%s "$SHA" | grep -qF 'docs(261005-lzg): point larry-extended at SEED-121 (LarrAI review spine idea)' && git log -1 --format=%B "$SHA" | grep -q '^Co-Authored-By: Claude ' && [ -z "$(git status --short agents/larry-extended.md)" ] && [ "$(git show "$SHA":agents/larry-extended.md | grep -c 'SEED-121')" = "1" ] && echo ALL-TASK2-CHECKS-PASS</automated>
  </verify>
  <done>
- HEAD is a commit whose only changed path is agents/larry-extended.md (1 line added, 0 removed), subject "docs(261005-lzg): point larry-extended at SEED-121 (LarrAI review spine idea)", ending with the Co-Authored-By trailer.
- The sha is an ancestor of HEAD; the committed file carries exactly one SEED-121 line.
- No other path was staged or committed; the peer-owned dirty set matches the Task 1 snapshot (or every difference is explained in the SUMMARY as peer activity).
- Nothing pushed. 261005-lzg-SUMMARY.md written with the Hand-off note.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| dev repo -> shipped plugin (npm tarball, marketplace) | agents/larry-extended.md ships to every install; the comment line ships with it, though every YAML parser drops it before the agent runs |
| this session -> peer sessions sharing one working tree | about 50 dirty paths belong to other sessions; a broad stage or revert would commit or destroy their work |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261005-lzg-01 | Tampering | git index / peer-owned dirty files | mitigate | `git commit --only -- agents/larry-extended.md`; broad add, stash, reset, restore and gsd-tools commit --files are forbidden; post-commit `git show --name-only` must list one path; dirty-set snapshot compared before and after |
| T-261005-lzg-02 | Tampering | Larry runtime prompt (agents/larry-extended.md body) | mitigate | the line is a YAML comment inside the frontmatter, not body prose; git diff --numstat must read 1 0; js-yaml and parseFrontmatter must return the same 13 keys and values |
| T-261005-lzg-03 | Information Disclosure | comment text shipped in the public agent file | mitigate | the line names only the seed id, a product term (LarrAI review spine), a phase number and a repo-relative path; no reviewed venture, no person, no user data (No-real-names rule, Canon Part 8: nothing crosses to the Brain) |
| T-261005-lzg-04 | Repudiation | commit attribution trailer | mitigate | trailer must name the model that authored the commit; any substitution of the orchestrator-supplied line is recorded in the SUMMARY |
| T-261005-lzg-05 | Denial of Service | data/harness-manifest.json drift guard | accept | the cli_agent digest goes STALE in the working tree; HEAD was already stale for this file since 5b42ad733; the manifest is peer-owned and out of the locked commit scope; recorded as a Hand-off for the next manifest regen; the pre-commit manifest check does not fire for an agents/*.md-only commit |
</threat_model>

<verification>
- Task 1 automated block prints ALL-TASK1-CHECKS-PASS (requires the Step 1 baselines in .planning/quick/261005-lzg-add-a-one-line-pointer-to-seed-121-the-l/.baseline, captured BEFORE the edit).
- Task 2 automated block prints ALL-TASK2-CHECKS-PASS.
- `grep -c SEED-121 agents/larry-extended.md` is 1; `grep -P '\x{2014}' agents/larry-extended.md` prints nothing.
- `node scripts/check-shape-declaration.cjs --check` larry-extended line unchanged; `node scripts/build-connector-registry.cjs --check` prints connector-registry: OK.
</verification>

<success_criteria>
- One comment line added to the frontmatter of agents/larry-extended.md, after layer_why: and before the closing fence, carrying SEED-121, the word idea, the Phase 369.6 dependency and the seed file path, with no em-dash.
- Zero other bytes changed in the file; the seed file untouched; Larry's runtime behaviour unchanged.
- Shape-declaration, connector-registry and orchestration-projection gates report exactly as before; tests 114 and 115 pass.
- One commit, one file, made with --only, not pushed; harness-manifest hand-off recorded.
</success_criteria>

<output>
Create `.planning/quick/261005-lzg-add-a-one-line-pointer-to-seed-121-the-l/261005-lzg-SUMMARY.md` when done
</output>
