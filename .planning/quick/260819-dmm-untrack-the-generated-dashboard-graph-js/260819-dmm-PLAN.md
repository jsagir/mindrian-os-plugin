---
phase: quick-260819-dmm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .gitignore
  - dashboard/graph.json          # index removal only (git rm --cached), file stays on disk
  - lib/core/intelligence-cascade.cjs
  - lib/core/graph-ops.cjs
  - tests/test-cascade-surface-loop-fires.cjs
  - tests/test-compute-state-persists.cjs
  - tests/run-all-162.sh
autonomous: true
requirements: [QUICK-260819-DMM]

must_haves:
  truths:
    - "dashboard/graph.json is no longer tracked by git; the file remains on disk"
    - "Running the previously-drifting test leaves git status --porcelain --untracked-files=no empty"
    - "bash scripts/verify-release passes"
    - "A fresh clone with no dashboard/graph.json still serves and exports the dashboard"
    - "The cascade writes its graph to a deterministic path regardless of caller cwd"
  artifacts:
    - path: ".gitignore"
      provides: "dashboard/graph.json ignore entry carrying the drift-class doctrine comment"
      contains: "dashboard/graph.json"
    - path: "lib/core/intelligence-cascade.cjs"
      provides: "Step 9 build-graph call with an explicit PLUGIN_ROOT-anchored output path"
      contains: "dashboard"
    - path: "lib/core/graph-ops.cjs"
      provides: "buildGraph default output anchored to __dirname, not cwd"
  key_links:
    - from: "lib/core/intelligence-cascade.cjs"
      to: "scripts/build-graph"
      via: "execFileSync third argument (explicit OUTPUT_PATH)"
      pattern: "build-graph'\\)[,\\s]*roomDir"
    - from: ".gitignore"
      to: "git index"
      via: "git rm --cached makes the existing ignore entry effective"
      pattern: "^dashboard/graph\\.json$"
---

<objective>
Kill the release clean-tree drift class by untracking `dashboard/graph.json`, a generated
per-room artifact that has been committed since 2026-07-16.

Purpose: the release ceremony's clean-tree pre-flight (`doctor.cjs` check
`verify-release-clean-tree` at scripts/doctor.cjs:1124, and scripts/verify-release:362) aborts
whenever a repo-cwd process regenerates this file. That happens on every cascade run started
from the repo root, because scripts/build-graph defaults `OUTPUT_PATH` to the CWD-relative
`./dashboard/graph.json` (python branch line 15, bash branch line 727) and
lib/core/intelligence-cascade.cjs:527 calls it with `roomDir` only, no output argument and no
`cwd` option. The committed bytes are themselves a stale test fixture
(`"roomName": "Fixture"`, `"roomDir": "/tmp/chatctx-k0Efd9/rooms/fixture"`,
`"generatedAt": "2026-07-15T21:24:29Z"`), so every marketplace install currently ships a temp
fixture's graph.

Output: an ignored-and-untracked `dashboard/graph.json`, a doctrine comment recording why, and
two CWD-relative call sites anchored so the artifact lands in one deterministic place.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md

Grounding already established (do NOT re-derive; these were verified live on 2026-08-19):

- `.gitignore:9-10` ALREADY contains `dashboard/graph.json` under the thin comment
  `# Dashboard generated data`. `.gitignore` has NO effect on a path already in the index,
  which is exactly why the entry has been inert. Do NOT add a duplicate entry; upgrade the
  existing comment in place.
- `git ls-files --error-unmatch dashboard/graph.json` succeeds today (the file is tracked).
  `git check-ignore -v dashboard/graph.json` exits 1 only because check-ignore consults the
  index by default; that is a symptom, not a missing rule.
- Last commit touching it: `46211f8a 2026-07-16 chore: sweep generated artifacts (dashboard
  graph, eval baseline date-bumps) before release cut`. The drift has been hand-swept before.
- npm payload is NOT affected: package.json `files` is exactly
  `["bin/cli.js", "lib/core/active-plugin-root.cjs", "README.md", "LICENSE", "CHANGELOG.md"]`
  and there is no `.npmignore`. `dashboard/` never enters the tarball, so release.sh Step 9.5
  (`npm publish @mindrian_os/cli`) is untouched.
- Marketplace install is a git clone at a tag, so `dashboard/index.html` and
  `dashboard/export-template.html` stay tracked and only `graph.json` goes missing on a fresh
  install. Both consumers regenerate before use:
  - `scripts/serve-dashboard:28` runs `build-graph-from-sqlite.cjs "$ROOM_DIR"
    "${DASHBOARD_DIR}/graph.json"` BEFORE starting the server.
  - `scripts/generate-standalone:37` builds into a TEMP graph and inlines it into the HTML;
    it never reads `dashboard/graph.json`.
  - `scripts/serve-dashboard-live` has no graph.json reference at all.
  - `dashboard/index.html:1522` fetches a relative `graph.json?t=` with a `.catch` that logs
    `Failed to load graph.json:`, so an absent file degrades to a console error rather than a
    crash, and serve-dashboard always writes it first.
- `lib/core/graph-ops.cjs:44` carries a second CWD-relative default
  (`outputPath || './dashboard/graph.json'`). Its only in-repo caller is
  `buildGraphFromSQLite` (graph-ops.cjs:158), which always passes an explicit path, so the
  default is currently dead but is the same latent landmine.
- Three test files already carry hand-written workaround comments for this exact drift:
  `tests/test-cascade-surface-loop-fires.cjs:108` (pins cwd),
  `tests/test-compute-state-persists.cjs:120-124`, `tests/run-all-162.sh:21`
  ("would clobber the committed snapshot"). Those comments go stale with this fix.
- `lib/core/intelligence-cascade.cjs:34` already defines
  `const PLUGIN_ROOT = path.resolve(__dirname, '../..')`, and line 35 derives `SCRIPTS_DIR`
  from it. Use `PLUGIN_ROOT` for the anchor.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Untrack dashboard/graph.json and record the doctrine</name>
  <files>.gitignore, dashboard/graph.json (index removal only)</files>
  <action>
Remove the generated dashboard graph from git's index while leaving the file on disk, and
upgrade the inert ignore entry so the next reader knows why it must never be re-added.

1. Run `git rm --cached dashboard/graph.json`. Use `--cached` and nothing else. The working
   file MUST survive; `scripts/serve-dashboard` and the cascade both expect to write there.
2. Edit `.gitignore` lines 9-10. Keep the single existing `dashboard/graph.json` pattern
   exactly as it is on line 10 and do NOT add a second copy anywhere in the file. Replace the
   one-line comment `# Dashboard generated data` with a doctrine comment in the style already
   used at `.gitignore:1-5` and `.gitignore:12-13`: state that the file is generated per-room
   by `scripts/build-graph` (whose OUTPUT_PATH default is CWD-relative), that a tracked copy
   made every repo-cwd cascade run rewrite it with a temp-fixture room's graph plus a fresh
   generatedAt, that this aborted the release clean-tree pre-flight
   (`doctor.cjs verify-release-clean-tree`, `scripts/verify-release`), and that the committed
   bytes were themselves a 2026-07-15 `/tmp` fixture snapshot shipped to every install. Date
   it 2026-08-19. Hyphens only, no em-dashes, per CLAUDE.md conventions.
3. Confirm the packaging surfaces need no change, using the grounding in `<context>` rather
   than re-investigating: `package.json` `files` excludes `dashboard/`, and both
   `scripts/serve-dashboard` and `scripts/generate-standalone` regenerate their graph before
   use. If any of those three facts does not hold when you check them, STOP and report rather
   than inventing a compensating change.
4. Note in the SUMMARY that collaborators pulling this commit will have their local
   `dashboard/graph.json` deleted by git. That is correct and self-healing: the next
   `serve-dashboard` or cascade run regenerates it.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin &amp;&amp; ! git ls-files --error-unmatch dashboard/graph.json 2>/dev/null &amp;&amp; test -f dashboard/graph.json &amp;&amp; test "$(grep -v '^#' .gitignore | grep -c '^dashboard/graph\.json$')" = "1" &amp;&amp; test "$(npm pack --dry-run --json 2>/dev/null | grep -c 'dashboard/')" = "0" &amp;&amp; echo GATE-1-PASS</automated>
  </verify>
  <done>
`dashboard/graph.json` is absent from `git ls-files` but present on disk; `.gitignore` carries
exactly one `dashboard/graph.json` pattern preceded by the dated doctrine comment; the npm
`pack --dry-run` payload contains no `dashboard/` entry.
  </done>
</task>

<task type="auto">
  <name>Task 2: Anchor the two CWD-relative graph output paths and refresh the stale workaround comments</name>
  <files>lib/core/intelligence-cascade.cjs, lib/core/graph-ops.cjs, tests/test-cascade-surface-loop-fires.cjs, tests/test-compute-state-persists.cjs, tests/run-all-162.sh</files>
  <action>
Untracking stops git from seeing the drift; this task stops the drift itself, so the artifact
lands in one deterministic place instead of wherever the caller happened to be standing.

1. `lib/core/intelligence-cascade.cjs`, Step 9 at line 527: the call is currently
   `execFileSync('bash', [path.join(SCRIPTS_DIR, 'build-graph'), roomDir], {...})`. Add a third
   array element passing the explicit output path built from the already-defined `PLUGIN_ROOT`
   (line 34): the plugin's own `dashboard/graph.json`. Do not add a `cwd` option; the explicit
   argument is the fix, and `scripts/build-graph` already does `mkdir -p "$(dirname
   "$OUTPUT_PATH")"` (line 869) and `os.makedirs` (line 151) on both branches, so a missing
   dashboard dir is handled. Leave the surrounding try/catch untouched: a build-graph failure
   must stay non-fatal and keep setting `stepsResult.buildGraph = { status: 'error', ... }`.
   Add a short doctrine comment above the call explaining that the third argument exists
   because build-graph's own default is CWD-relative and a repo-cwd caller used to rewrite the
   repo copy.
2. Immediately below that comment, record the DEFERRED product decision inline (an inline
   comment, not a `.planning/` file, because `.planning/` is gitignored and does not travel
   between machines): room-scoping this output to `<roomDir>/.presentation/graph.json` (the
   default `build-graph-from-sqlite.cjs` already uses at scripts/build-graph-from-sqlite.cjs:36)
   is a product decision about where a room's graph belongs, deliberately NOT taken here.
3. `lib/core/graph-ops.cjs:44`: change the `outputPath || './dashboard/graph.json'` default to
   an `__dirname`-anchored resolve of the same plugin dashboard file. Its only caller passes an
   explicit path, so this is a latent-landmine removal, not a behavior change; keep the JSDoc
   on line 39 accurate to the new default.
4. Refresh the three now-stale workaround comments so the next reader is not warned about a
   committed snapshot that no longer exists. Change the COMMENTS only; do NOT weaken or remove
   the cwd-pinning or any assertion, since the pins are still correct defensive behavior:
   - `tests/test-cascade-surface-loop-fires.cjs:108`
   - `tests/test-compute-state-persists.cjs:120-124`
   - `tests/run-all-162.sh:21`
   Each should now say the file is generated and gitignored (untracked as of 2026-08-19), not
   that it is a committed snapshot at risk of being clobbered.
5. Behavior note to respect while editing: in a real install the cascade's cwd is the user's
   room, so today Step 9 litters `<cwd>/dashboard/graph.json`. Nothing reads that path
   (`serve-dashboard` and `generate-standalone` both write their own), so anchoring is safe and
   also stops the littering.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin &amp;&amp; node --test tests/test-224-per-write-derive.cjs &amp;&amp; node --test tests/test-cascade-surface-loop-fires.cjs tests/test-compute-state-persists.cjs &amp;&amp; bash scripts/verify-release &amp;&amp; test -z "$(git status --porcelain --untracked-files=no)" &amp;&amp; echo GATE-2-PASS</automated>
  </verify>
  <done>
`node --test tests/test-224-per-write-derive.cjs` (the previously-drifting path) leaves
`git status --porcelain --untracked-files=no` empty; the two cascade tests still pass;
`bash scripts/verify-release` passes; Step 9 passes an explicit PLUGIN_ROOT-anchored output
path and carries both the doctrine comment and the deferred room-scoping note.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo -> marketplace install | Tracked repo bytes are cloned onto every user's machine at a tag |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick260819-01 | Information Disclosure | `dashboard/graph.json` | mitigate | The committed copy leaks a `/tmp/chatctx-k0Efd9/rooms/fixture` path and a fixture room's graph to every install. Task 1 removes it from the index; the ignore entry prevents re-adding. |
| T-quick260819-02 | Tampering | release clean-tree gate | mitigate | A generated file inside the gate's watch set let routine test runs forge a dirty tree and abort releases. Task 2 anchors the writer so the artifact stops moving with the caller's cwd. |
| T-quick260819-SC | Tampering | npm/pip/cargo installs | accept | No package-manager install task in this plan; no dependency is added, so the supply-chain surface is unchanged. |
</threat_model>

<verification>
1. `git ls-files --error-unmatch dashboard/graph.json` exits non-zero; `test -f dashboard/graph.json` succeeds.
2. `grep -v '^#' .gitignore | grep -c '^dashboard/graph\.json$'` returns exactly `1`.
3. `node --test tests/test-224-per-write-derive.cjs` then `git status --porcelain --untracked-files=no` returns empty.
4. `bash scripts/verify-release` passes.
5. `npm pack --dry-run` payload contains no `dashboard/` entry.
6. `node scripts/doctor.cjs --acceptance` reports `verify-release-clean-tree` as ok.
</verification>

<success_criteria>
- `dashboard/graph.json` is untracked and ignored, and still present on disk.
- `.gitignore` carries one entry plus a dated doctrine comment naming the release-abort cause.
- The cascade's Step 9 writes to a deterministic PLUGIN_ROOT-anchored path regardless of cwd.
- The room-scoping decision is filed as an inline deferred note, not implemented.
- Running the tests that previously caused drift leaves the tracked tree clean, and
  `scripts/verify-release` passes.
</success_criteria>

<output>
Create `.planning/quick/260819-dmm-untrack-the-generated-dashboard-graph-js/260819-dmm-SUMMARY.md` when done
</output>
