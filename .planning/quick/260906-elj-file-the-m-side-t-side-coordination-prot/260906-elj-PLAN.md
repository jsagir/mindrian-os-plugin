---
phase: quick-260906-elj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md
autonomous: true
requirements: [QUICK-260906-ELJ]
user_setup: []

must_haves:
  truths:
    - "The M-side/T-side coordination protocol exists as a durable file inside this repo's own .planning tree, mirroring the copy already sent to the T-side session"
    - "The filed body is the protocol text verbatim: one H1, six H2 sections, substance unchanged"
    - "The file survives .gitignore -- it is git-tracked, not silently ignored the way .planning/RELEASE-COORDINATION.md is"
    - "No pre-existing file in the repo was modified, staged, or committed by this work"
  artifacts:
    - path: ".planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md"
      provides: "The coordination protocol verbatim, wrapped in this repo's dated-artifact YAML frontmatter"
      contains: "M-side / T-side Coordination Protocol"
      min_lines: 40
  key_links:
    - from: ".planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md"
      to: "git index"
      via: "git add -f (mandatory: .gitignore:97 is `.planning/*`, and :98 un-ignores only `.planning/debug/`)"
      pattern: "coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL\\.md"
---

<objective>
File the M-side/T-side coordination protocol into MindrianOS-Plugin's own `.planning/` tree as a durable, git-committed coordination reference, mirroring the copy already sent to the Theo-side session.

Purpose: right now the protocol lives only in a live session on each side. A live ping is a nudge, not a record -- which is the protocol's own rule. Until it is a dated, git-committed file in each repo, the boundary discipline it describes has no durable home on this side.

Output: exactly ONE new file, `.planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md`, force-added and committed. Zero existing files touched.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md

Convention findings from disk (already done -- do NOT re-investigate, just honor):

- **`.planning/` is gitignored.** `.gitignore:97` is `.planning/*`; `:98` is `!.planning/debug/`. Yet `git ls-files .planning` returns 3542 tracked files (70 of them under `.planning/seeds/`). Every durable `.planning` doc in this repo got there via `git add -f`. This plan's file needs the same.
- **Counter-example that proves the point:** `.planning/RELEASE-COORDINATION.md` is the repo's only existing coordination-protocol doc, and it is **UNTRACKED** -- it exists on one machine's disk only. That is the failure mode this task exists to avoid, so do not copy its placement (a bare `.planning/` root file with a plain `Status:` / `Last updated:` header).
- **`.planning/coordination/` does not exist yet.** Creating it is explicitly sanctioned by the task constraints. Chosen over `.planning/seeds/` because a seed is a planted future-work idea carrying `trigger_when` / `target_milestone` / `scope` / `bundle` frontmatter and an entry in `.planning/seeds/INDEX.md` -- this is a standing operating protocol, not a queued idea, and the constraints forbid modifying `INDEX.md` (or any other existing file).
- **Dating / frontmatter convention** comes from `.planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md`: YAML frontmatter, `status:` / `kind:` / `canon_parts:` / ISO-8601-Z `created:` and `updated:`.
- **Filename convention** comes from the recent tracked cross-repo docs in `docs/` (`2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md`, `2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md`): date-first, `YYYY-MM-DD-SCREAMING-KEBAB.md`.
- **Project hard rule (CLAUDE.md, Conventions):** no em-dashes anywhere, hyphens only. The payload below already complies (`--`); do not "improve" it into em-dashes.
- **Project skills:** `.claude/skills/agentshield` and `.claude/skills/claude-md-optimizer` were checked. Neither has a `rules/` directory and neither governs markdown filing. Nothing to apply.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write the protocol file with repo-convention frontmatter</name>
  <files>.planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md</files>
  <action>
Create the directory `.planning/coordination/` (it does not exist yet), then use the Write tool to create the single file `.planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md`.

The file is exactly two parts, in this order:

PART A -- YAML frontmatter. Mirror the `.planning/debug/` RCA style named in `<context>`. Emit these keys, in this order: `status: active`; `kind: coordination-protocol`; `scope: cross-repo`; `sides: [MindrianOS-Plugin, Theo]`; `mirrors: "T-side session copy, sent 2026-09-06"`; `canon_parts: [8]`; `created:` and `updated:`, both set to the real current UTC instant obtained by running `date -u +%Y-%m-%dT%H:%M:%SZ` -- do not hand-type a timestamp and do not reuse the one in this plan. Nothing else. Do not add a summary, a provenance paragraph, a table of contents, or a "why this file exists" section: the constraints allow adaptation of frontmatter and dating only.

PART B -- the protocol body, copied VERBATIM from the `<verbatim_payload>` block below (everything strictly between the BEGIN and END sentinel lines; the sentinel lines themselves are NOT part of the file). Do not rewrite, re-order, summarize, expand, re-punctuate, or "correct" any of it. It is a mirrored artifact -- its counterpart already sits in the T-side session, and divergence between the two copies defeats the point. Specifically preserve: the six `##` section headings and their exact wording; every `--` double-hyphen (never convert to an em-dash, per the project's no-em-dash hard rule); every backticked path and filename; the bolded `**M-side**` / `**T-side**` / `**Grey zone, explicitly assigned:**` / `**Durable (source of truth):**` / `**Live (nudge only):**` runs; and the final Addressing paragraph's ephemeral-address caveat with its `2026-09-06` date and the two session names in backticks.

Do NOT create, edit, stage, or `git add` any other file. In particular `.planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md` carries an unrelated in-progress modification from another workstream: read-only, leave it exactly as found. Do not update `.planning/seeds/INDEX.md`, `CLAUDE.md`, `docs/OPEN-HANDOFFS.md`, or `.planning/STATE.md` as part of this task.
  </action>
  <verify>
    <automated>F=.planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md; test -f "$F" && [ "$(grep -c '^## ' "$F")" -eq 6 ] && [ "$(grep -c '^# M-side / T-side Coordination Protocol$' "$F")" -eq 1 ] && grep -q '^kind: coordination-protocol$' "$F" && grep -qE '^created: 2[0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' "$F" && grep -q 'Grey zone, explicitly assigned' "$F" && grep -q 'ListAgents at send-time' "$F" && ! grep -q '—' "$F" && echo PASS</automated>
  </verify>
  <done>The file exists with YAML frontmatter (`kind: coordination-protocol`, real ISO-Z `created`/`updated`) followed by the verbatim body: exactly one H1 `# M-side / T-side Coordination Protocol`, exactly six H2 sections, the grey-zone and ListAgents clauses intact, and zero em-dash characters. `git status --porcelain` shows no modification to any pre-existing tracked file.</done>
</task>

<task type="auto">
  <name>Task 2: Force-add past .gitignore and commit the single file</name>
  <files>.planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md</files>
  <action>
Make the file durable. A plain `git add` is a silent no-op here because `.gitignore:97` ignores `.planning/*` and `:98` un-ignores only `.planning/debug/` -- that is precisely why `.planning/RELEASE-COORDINATION.md` never made it into the repo.

Run `git add -f -- .planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md`, then commit with the path explicitly scoped so nothing else can ride along: `git commit -m "<message>" -- .planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md`.

Never use `git add -A`, `git add .`, or `git commit -a` in this task -- the working tree holds an unrelated in-progress modification to `.planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md` that must stay uncommitted and unmodified.

Commit subject: `docs(coordination): file M-side/T-side coordination protocol`. Per this session's standing attribution rule, end the commit message with the `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` line followed by the `Claude-Session:` line. Do not push.
  </action>
  <verify>
    <automated>F=.planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md; git ls-files --error-unmatch "$F" >/dev/null 2>&1 && [ "$(git show --pretty=format: --name-only HEAD | grep -c .)" -eq 1 ] && git show --pretty=format: --name-only HEAD | grep -q 'coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL\.md' && ! git show --pretty=format: --name-only HEAD | grep -q 'card-fire-stale-f1' && echo PASS</automated>
  </verify>
  <done>`git ls-files --error-unmatch` resolves the protocol file (proving the force-add beat the ignore rule), and HEAD's diff touches exactly one path -- the new protocol file -- with the debug RCA file provably absent from the commit and still dirty in the working tree.</done>
</task>

</tasks>

<verbatim_payload>
Copy everything strictly between the two sentinel lines. The sentinel lines themselves do not go in the file.

BEGIN-PROTOCOL-BODY
# M-side / T-side Coordination Protocol

**M-side** = `~/dev/MindrianOS-Plugin` -- Larry's persona/doctrine, plugin release pipeline, `command-registry.json`/`recipe-maps.cjs`, room graph.
**T-side** = `~/Theo` -- the graph, ingestion pipeline, Theo's own tool catalog (content + operational).

## Boundary -- no overlap, no exceptions
Each side owns its own repo's files, schema, and GSD process. Neither side edits the other's files, ever -- not even a "obviously correct" one-line doc fix. Propose it across the boundary; the owning repo's own GSD process lands it.

**Grey zone, explicitly assigned:** shipping a release, flipping a default, suspending/decommissioning a service -- all HUMAN-HELD, on both sides, regardless of how ready a plan looks or which repo's checkpoint fires it.

## Two channels, neither sufficient alone
1. **Durable (source of truth):** a dated, evidenced entry in a shared file, git-committed, citing exact paths/lines/live-measured numbers with timestamps -- the discipline SEED-004 and 09-FLIP-RECORD.md already model. Every real finding or ask goes here first.
2. **Live (nudge only):** a cross-session ping saying "there's something in the durable file for you." First line self-contained -- it's the only part previewed. Never the only record of anything.

## T-side triggers M-side when:
- A Theo phase's checkpoint:human-action names a MindrianOS-Plugin action (a release, a flip).
- T-side needs the current command-registry.json/recipe-maps.cjs for a MindrianCommand sync payload -- ask for the exact shape needed, not "everything."
- A doctrine question's answer might live in MindrianOS-Plugin (persona rules, reach doctrine) -- ask before assuming it doesn't exist.
- T-side finds a live gap or collision touching the plugin (tool-name collision, a doctrine-named tool with no Theo equivalent) -- report it, don't patch it from that side.
- T-side needs a plugin-side number (installed version, live tool count) re-confirmed rather than assumed stale-safe.

## M-side triggers T-side when:
- A persona/room feature needs a Theo content tool that doesn't exist -- spec the exact contract, don't make T-side guess intent.
- A cutover-scoping decision needs a live coverage/parity re-measurement -- never reuse a stale snapshot across the boundary.
- A plugin release is about to touch command-registry.json/recipe-maps.cjs -- that's T-side's own sync trigger, per its CLAUDE.md.

## Never, either side:
- Ship/flip/suspend without the human navigator's explicit go.
- Assume the other side's state from memory -- re-measure live, cite the call and timestamp.
- Let a live ping substitute for the durable file entry.
- Cross-edit the other repo's files.

## Addressing (ephemeral, not permanent)
Session identity is ephemeral -- resolve the live address via ListAgents at send-time. As of 2026-09-06: M-side session answered to `jsagi-9d`, T-side session answered to `Brain–Theo graph reconciliation execution`. Do not hardcode either past this date.
END-PROTOCOL-BODY
</verbatim_payload>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| M-side repo -> T-side repo | The protocol's own subject: neither side may write across it. This task writes only on the M-side. |
| working tree -> git index | `.planning/*` is ignored by default; only a deliberate `git add -f` promotes a file to durable. An over-broad add sweeps an unrelated workstream's dirty file into the commit. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick260906-01 | Information Disclosure | The Addressing section names two live session identifiers | accept | No credentials, no real tester/advisor names (honors the no-real-names-in-repo hard rule). The clause is explicitly self-expiring: "ephemeral ... do not hardcode either past this date." |
| T-quick260906-02 | Tampering | Git operations inside a working tree that already holds an unrelated dirty file (`.planning/debug/card-fire-stale-f1-...md`) | mitigate | Task 2 scopes every git call to the single new path (`git add -f -- <path>`, `git commit ... -- <path>`); `git add -A` / `git add .` / `git commit -a` are forbidden by name; Task 2's automated gate asserts HEAD touches exactly one file and that `card-fire-stale-f1` is absent from it. |
| T-quick260906-03 | Tampering | Cross-repo edit of `~/Theo` | mitigate | Out of scope by construction: `files_modified` lists exactly one M-side path, and the protocol being filed is itself the rule forbidding the cross-edit. |
| T-quick260906-SC | Tampering | npm/pip/cargo installs | not applicable | Docs-only plan, zero package-manager operations. The Package Legitimacy Gate does not apply and no RESEARCH.md audit table is required. |
</threat_model>

<verification>
1. `test -f .planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md` -- the file landed.
2. `[ "$(grep -c '^## ' <file>)" -eq 6 ]` -- all six protocol sections present, none dropped or merged.
3. `! grep -q '—' <file>` -- no em-dashes, per the CLAUDE.md Conventions hard rule.
4. `git ls-files --error-unmatch <file>` -- durable: the force-add beat `.gitignore:97`.
5. `[ "$(git show --pretty=format: --name-only HEAD | grep -c .)" -eq 1 ]` -- the commit touches exactly one path.
6. `git status --porcelain .planning/debug/card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md` still reports that file as modified-and-uncommitted, unchanged from the pre-task state.
</verification>

<success_criteria>
- `.planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md` exists, is git-tracked, and is committed.
- Its body is the protocol verbatim: one H1, six H2 sections, `--` hyphens preserved, no em-dashes, substance unaltered.
- Its frontmatter follows the `.planning/debug/` RCA convention with a real `date -u`-generated ISO-Z `created`/`updated` pair.
- Exactly one file is created and exactly one file appears in the commit. No pre-existing file in the repo was modified, and the in-progress debug RCA file is untouched and still dirty.
</success_criteria>

<output>
Create `.planning/quick/260906-elj-file-the-m-side-t-side-coordination-prot/260906-elj-SUMMARY.md` when done.
</output>
