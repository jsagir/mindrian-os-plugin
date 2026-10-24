# Handoff 2026-10-20: Claude and Codex on the Eureka adapter (read before you touch the repo)

Two agent sessions work on the same two repositories for one owner. This file is the shared contract. Both agents read it first and follow it. It is written in plain, short English on purpose.

## 1. Who is who

- **Claude** (Claude Code, main session): planning, review, verification, GSD flow for MindrianOS-Plugin, the Phase 372 work, the critical-path roadmap.
- **Codex**: wrote the Eureka engine integration and the adapter branch. Owner of Eureka-side code and of the adapter source until the owner says otherwise.
- **Owner** (Jonathan): decides scope, approves any push, decides open questions below.

## 2. Repositories and where each agent works

| Repo | Path | Rule |
|---|---|---|
| MindrianOS-Plugin | /home/jsagi/dev/MindrianOS-Plugin | The shared checkout stays on `main`. Neither agent switches its branch. |
| Eureka engine | /home/jsagi/dev/mindrian-eureka | Codex commits here. Claude changes it only through a request the owner approved. |

**Rule W1: one working tree, one agent.** Work on a branch in your own worktree: `git worktree add /tmp/<name> -b <branch> main`. Never switch the branch of /home/jsagi/dev/MindrianOS-Plugin. (On 2026-10-20 the shared checkout was moved to `feat/eureka-adapter-rebased` while Claude was committing. Claude's two planning commits landed on that branch by accident. This rule stops it.)
**Rule W2: stage paths, not folders.** Use `git add <path>` then `git commit --only -- <path>`. Never `git add .`, `-A`, or `-a`. Never stash, reset, or restore changes you did not make.
**Rule W3: no push without review.** List every commit ahead of origin (subject and files) and confirm each is intended. Stop on anything unrelated or unclear. Only the main session of the owner's choice pushes, after review.
**Rule W4: a `main` commit is not a release.** Do not bump versions. Do not run `scripts/release.sh`. The beta.73 cut is the owner's act.

## 3. Current state (verified 2026-10-20)

- `main` holds Phase 372 (`context_assemble` reports `_meta.omitted[]`), its audit fixes, the planning files, and the critical-path roadmap (Phases 373 to 379).
- Eureka `main` (pushed by Codex, `219033a`) holds six hardening fixes: random swap orientation in the hole and atypicality null models, a clear error for graphs with fewer than 2 distinct edges, resource budgets, the `unrepresented_categories` count, finite `fit_model` output, and the stated polarity of `structural_transfer`. Codex confirmed these on 2026-10-20.
- The adapter branch `feat/eureka-adapter-rebased` (`4a32b0937`, 89 files) is **not merged**. Three independent reviews found it **not mergeable as it stands**:
  - It adds a git-SSH devDependency (`mindrian-design-system`) to package.json and npm-shrinkwrap.json. This fails `tests/test-341-shrinkwrap-no-dev.cjs` and can break user installs.
  - Two lineage checks accept a missing `scope_id` or `snapshot_id` (async job result, opportunity scout).
  - Engine statuses `failed`, `blocked` and `invalid_input` arrive as `ok:true`.
  - No sealed-room check. No `identity.state === 'ready'` check.
  - It adds 25 tools. `tests/test-270-tool-schema-budget.cjs` fails (75 tools, +41.5 percent).
  - The 267 wire snapshots and the 276 ledger are stale. `brain_framework_id` trips `test-234-free-core-network-scan`.
  - The five graph services and the docs lack an "experimental" label and the backtest result.
  - About 49 of the 89 files do not belong (brand install, `docs/design/**`, `.icm/**`, the RS features).

## 4. Who does what next

1. **Codex:** keep the adapter branch as the source. Do not merge it to `main`. Do not push over my commits. Remove from the branch, or move to their own branches: the brand commit `bb5f30ad8`, `docs/design/**`, `.icm/**`, the dangling CLAUDE.md link, and the RS features (`rs_experts_find`, `rs_thesis_read`, the `/mos:rs-experts` rewrite).
2. **Claude:** review each fix Codex pushes to the adapter branch, using the same three-reviewer method (security, MCP quality, run the gates in an isolated export).
3. **Phase 373 scope** is `.planning/phases/373-integrate-eureka-graph-algorithm-services-with-authorized-mi/373-MVP-PLAN.md`: six tools (`eureka_graph_project` and the five graph services), four behaviors, one end-to-end test. Codex's `373-01-PLAN.md` is a larger alternative. The owner chooses. Until then, do not start either.
4. **Eureka side (Codex), requested by the reviews:** a job-store owner lock and a terminal-state guard; a distinct `budget_exceeded` status; reject snapshots with no `scope_id` or `snapshot_id` when the host asks for lineage; `cutoff` parsed as a date; `--attr` passed through in the CLI; disclose `cycle_limit` truncation; an allowlist for the Neo4j query guard; drop `n.path` from `snapshot_nodes.cypher`; update the catalog `resource_limits` for `explore` (2,500 nodes, 12,000 edges). Mark each as a separate commit.

## 5. Facts both agents must state the same way

- Eureka capabilities are `experimental` or `host_brokered`. They produce leads, not validated findings.
- A 2026-10-19 backtest placed 0 of 30 held-out edges in the top 200 for every graph method and baseline.
- No engine has numeric parity with upstream reference outputs.
- Authorship and reuse rights of the five graph services are unresolved. Keep them local-only.
- Theo contributes methodology. Eureka contributes engine analysis. MindrianOS owns authorization, lineage, human review and every write. Room content never goes to the Brain (Canon Part 8).

## 6. Environment warnings

- The plugin checkout `node_modules` was removed on 2026-10-19 by a package change. Restore it with the owner before running tests there. Until then run tests in an isolated export with `node_modules` linked from `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.69/node_modules`.
- The machine load average was about 95 from unrelated `gsd-graph-derive-drain` workers. Live tests (bridge, job cancel, capability run) time out under that load. Re-run them on an idle host.

## 7. Questions still open for the owner

1. Which Phase 373 plan: the MVP plan, Codex's `373-01-PLAN.md`, or a merge of both.
2. Tool surface: ship about 6 tools now, route the rest through the router, or accept 75 tools and re-baseline.
3. A distinct `budget_exceeded` status in `mcp_server.py`.
4. Rights on the five graph services, and when they may leave local-only use.
