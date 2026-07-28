---
phase: 234
slug: mindrianos-as-infrastructure-skills-mcp-everywhere-open-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 234 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `234-RESEARCH.md`'s Validation Architecture section (research confidence: HIGH on codebase baseline and spec compliance, MEDIUM/LOW on commercial and per-host claims — see that document's Metadata section for the full breakdown).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` + `node:assert` (`lib/**/*.test.cjs`), plus bash harness `tests/run-all-234.sh` (repo convention) |
| **Config file** | None — convention-based. Test files sit beside their subject as `*.test.cjs`. |
| **Quick run command** | `node lib/<area>/<file>.test.cjs` (single file, seconds) |
| **Full suite command** | `bash tests/run-all-234.sh` (created in Wave 0) |
| **Estimated runtime** | ~30-60 seconds (small, mostly assertion-based tests; no foreign-host installs in the automated suite) |

---

## Sampling Rate

- **After every task commit:** `node scripts/check-skill-spec.cjs --check` plus the single `*.test.cjs` for the touched area
- **After every plan wave:** `bash tests/run-all-234.sh` plus `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs --check`
- **Before `/gsd-verify-work`:** `node scripts/doctor.cjs --acceptance` green, plus the human-verify checkpoint on at least one foreign host (see Manual-Only Verifications)
- **Max feedback latency:** under 60 seconds per task (no test in this phase requires a live foreign-host install or a live Brain round-trip to pass)

---

## Per-Task Verification Map

| Task ID | Decision | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|----------|-------------|----------|-----------|-------------------|-------------|--------|
| 234-W0-01 | D-01/D-02 | Portability | All 125 skills pass Agent Skills spec hard validation | unit | `node scripts/check-skill-spec.cjs --check` | ❌ W0 — new gate | ⬜ pending |
| 234-W0-02 | D-02 | Portability | Zed catalog stays under 50KB | unit | `node scripts/check-skill-spec.cjs --catalog-budget` | ❌ W0 — fold into same gate | ⬜ pending |
| 234-W0-03 | D-03 | Persona channel | `InitializeResult.instructions` is never populated | integration | `node lib/mcp/no-instructions.test.cjs` | ❌ W0 — new; currently passing by accident, this locks it | ⬜ pending |
| 234-W0-04 | D-03 | Persona channel | Persona ships as a skill, not via MCP `instructions` | unit | assert `skills/larry-personality/SKILL.md` exists and is spec-valid | ❌ W0 — fold into spec gate | ⬜ pending |
| 234-W0-05 | D-03 | Tool descriptions | No tool description reads as a bare label | unit | assert every `tools/list` description length >= floor (suggest 120 chars) | ❌ W0 — new | ⬜ pending |
| — | D-04 | Server-side governance | Governance enforced in tool handlers, not client hooks | unit | existing `connectors` export + `check-shape-declaration.cjs` | ✅ exists | ⬜ pending |
| 234-W0-06 | D-05 | Capability floor | Host detected and stated; capability floor honest on both axes (model + host-tier) | integration | `node lib/mcp/host-tier.test.cjs` — drive `initialize` with distinct `clientInfo.name` values, assert reported floor differs | ❌ W0 — new | ⬜ pending |
| 234-W0-07 | D-05 / Gap D | Tier-0 write path | `graph_write`, `memory_event`, `artifact_file` present on a non-Claude-Code host once host detection lands | integration | assert `tools/list` on a non-Claude-Code `clientInfo` includes the three write tools | ❌ W0 — new | ⬜ pending |
| — | D-06 | No proprietary content | No SKILL.md carries genuinely proprietary logic | manual-only | human review; not mechanically decidable | n/a | `checkpoint:human-verify` |
| — | D-08/D-09 | Free/paid separation | Free core (local MCP tools + navigation.cjs + key resolver) has zero network surface | unit | adversarial grep: no network tokens in `lib/mcp/tools/*.cjs`, `lib/core/navigation.cjs`, `resolve-brain-key.cjs` | pattern exists (Canon Part 8 scans) — needs a 234-scoped instance | ⬜ pending |
| — | D-09 | Honest degradation | Brain tools return `DIRECTOR_NOT_AVAILABLE` with no key | unit | existing `lib/core/tier0-messaging` tests | ✅ exists | ⬜ pending |
| 234-W0-08 | D-10 | Adoption engine intact | No `/mos:` methodology run gated on a paid check | unit | grep: no `resolve-brain-key` / `brainPlan` reference in any methodology command or skill execution path | ❌ W0 — new, cheap, high-value | ⬜ pending |
| — | D-11 | Canon Part 8 | Brain remains a READ service; no user content egresses | unit | existing Part 8 adversarial scans | ✅ exists | ⬜ pending |
| — | D-12 | Axis separation | Host-capability tiers, commercial tiers, Tri-Polar surface, and model capability are not conflated in any plan task | manual-only | plan-checker review | n/a | ⬜ pending |
| 234-W0-09 | Portability (Gap C) | `${CLAUDE_PLUGIN_ROOT}` removal | Affected skills/commands no longer hardcode `${CLAUDE_PLUGIN_ROOT}`; resolve via `MINDRIAN_OS_ROOT` | unit | grep count against a declining allowlist | ❌ W0 — new | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/check-skill-spec.cjs` — spec validation (required `name`/`description`, charset, `name`==dirname) + Zed catalog budget + `${CLAUDE_PLUGIN_ROOT}` census. Covers D-01, D-02, portability. Build with `gray-matter` (already vendored), no new deps. Do NOT add either `skills-ref` npm/PyPI package as a dependency (see RESEARCH.md Package Legitimacy Audit — npm `skills-ref` is an unaffiliated, source-repo-less, ~7-month-stale package; the official validator is PyPI-only and out-of-stack for this CJS-only repo).
- [ ] `lib/mcp/no-instructions.test.cjs` — locks D-03's currently-accidental compliance (no `InitializeResult.instructions` populated).
- [ ] `lib/mcp/host-tier.test.cjs` — D-05 two-axis floor + Gap D write-path assertion.
- [ ] `lib/mcp/tool-description-floor.test.cjs` — D-03 tool-descriptions-as-instructions floor.
- [ ] `tests/run-all-234.sh` — phase harness, per repo convention.
- [ ] No test framework install needed. `node:test` is built in.

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|--------------------|
| No SKILL.md carries genuinely proprietary logic (graph queries, scoring, ranking, grading) | D-06 | Not mechanically decidable — requires human judgment about what counts as "genuinely proprietary" vs. general methodology text | Human reviewer scans any newly-touched or newly-created SKILL.md for logic that consults the graph, scores, ranks, or grades (per CONTEXT.md's D-06 discretion note) and confirms it stays server-side. |
| A foreign (non-Claude-Code) host actually loads the skill catalog and connects to the MCP server | Portability (RESEARCH.md's single largest caveat — no foreign host is installed on this machine; every Tier-0 claim to this point is spec-derived and static-analysis-derived, never observed) | Requires installing a real second host (VS Code+Copilot, Cursor, or Goose recommended per RESEARCH.md's build-order) | Install one non-Claude-Code host locally, point it at the `dist/` bundle (or `skills/` directly if the host reads `.claude/skills/` in place), confirm the skill catalog loads without error and the MCP server (`mindrian-os`) connects and responds to `tools/list`. |
| Host-capability tier axis, commercial tier axis, Tri-Polar surface axis, and model-capability axis are not conflated anywhere in the plan or its execution | D-12 | Requires reading intent across multiple tasks, not a single assertable check | Plan-checker (and, at execution time, code reviewer) confirms no task or code path uses a bare "tier 1" / "tier 0" without naming which of the four axes it means. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (all 9 new gates above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 lands

**Approval:** pending
