---
created: 2026-04-14
extends: smart-notebook-cofounder.md
status: research-appendix
milestone_target: v1.10.3 (locked by user)
authority: user amendments 2026-04-14 (v1.10.3 lock, additive constraint, Brain query order, MINTO-Feynman-memory wiring)
---

# Smart Notebook Co-Founder: Pass 2 Appendix

> Pass 1 (`smart-notebook-cofounder.md`, 978 lines) proposed a 16-week, 21-phase rollout across v1.12.0 through v2.0. The user rejected that timeline and locked **v1.10.3** as the target milestone. This appendix does not restate the taxonomy, the coverage matrix, or the default scaffold. It extends pass 1 in five directions: (A) a real v1.10.3 scope cut that confronts the contradiction honestly, (B) a framework x section operation matrix mapping every existing command and skill to the proposed scaffold, (C) a Brain coverage matrix built from live Neo4j and Pinecone queries, (D) a PWS curriculum cross-reference, and (E) a MINTO + Feynman + Memory integration wiring spec naming files, functions, and fields.

---

## Appendix A: v1.10.3 scope cut (confronting the contradiction)

### A.1 The contradiction restated

Pass 1 section 8 proposed five stages (A through E) across v1.12.0, v1.13.0, v1.14.0, v1.15.0-alpha, and v2.0, 16-21 phases total, 16 weeks. The user's constraint:

- v1.11.0 is reserved for release pipeline hardening (beta). `docs/NEXT-RELEASE-v1.11.0-beta.1.md` is explicit.
- v1.10.3 is the next slot in the v1.10.x patch line.
- v1.10.2 (Feynman-MINTO Hybrid) just shipped 2026-04-14 and already took a semver deviation, using a patch slot to carry larger-than-patch work. Precedent exists for over-delivering in a v1.10.x slot.

The conflict: 16 weeks of work cannot fit in one patch release. But the precedent from v1.10.2 is that a v1.10.x release can carry meaningfully more than a normal patch when the user chooses to compress scope and keep v1.11.0 reserved.

### A.2 Path chosen: Path 1 (real v1.10.3 cut), narrowed aggressively

I pick Path 1. Path 2 (argue back and punt everything to v1.12.0) is tempting because the synthesis voice is genuinely hard and should not be rushed. But pass 1 already noted that **Stage A alone delivers real value** (pass 1 section 8.6). Stage A was defined as "expand KNOWN_SECTIONS from 11 to 17 and add the Tier 0 flat sections." That is already too ambitious for a single v1.10.3 release cycle given v1.10.2 just shipped. So I cut Stage A in half.

**v1.10.3 scope (the real cut):**

Ship the **scaffold loader and additive-section mechanism**, plus exactly **three new Tier 0 sections**: `stakeholder-analysis/`, `decisions/`, and `assumptions/` (the last promoted from the pattern mentioned in `.claude/includes/architecture.md` to a first-class section). No collection layer. No trigger framework. No synthesis voice. No rename of `competitive-analysis` to `competition`. All three new sections are additive to the existing 11 KNOWN_SECTIONS. Existing rooms continue to scan byte-identically until the user opts in.

**Why these three sections and not others:**

- `stakeholder-analysis/` is the single section the user explicitly named as missing when comparing to the Notion template. It is the face of the reframe. Shipping it answers the user's most visible complaint.
- `decisions/` is the load-bearing container for the co-founder voice to be possible at all. Pass 1 section 1.1 names decision rationale, rejected alternatives, reversibility, witnesses, and timing pressure as five separate dimensions. Without a `decisions/` section, none of them have a home. Shipping the container in v1.10.3 unblocks every later stage without committing to the voice itself.
- `assumptions/` is already decision 12 ("assumptions are first-class") in CLAUDE.md. It has existed conceptually for months as a file pattern but not as a section. Promoting it to a section in v1.10.3 closes a known gap between the declared architecture and the actual scanner behavior. Low risk, high clarity.

Every other Tier 0 addition from pass 1 section 4 defers to v1.10.4 or later.

### A.3 Exact minimum file set that changes in v1.10.3

1. **`lib/vault/room-scanner.cjs`** - extend `KNOWN_SECTIONS` from 11 to 14. Three new entries: `stakeholder-analysis`, `decisions`, `assumptions`. No other changes. The set remains a flat `Set<string>` for this release; the move to a loaded JSON structure defers to v1.10.4.

2. **`lib/scaffold/tier-0-v1.10.3.json`** (new) - partial scaffold manifest with three entries. Each entry has `name`, `description`, `room_md_template`, and `collections: []` (empty list, collections defer). The file is the seed of the eventual tier structure but ships as a patch-shaped slice.

3. **`lib/scaffold/loader.cjs`** (new, thin) - 40-80 lines. Loads `tier-0-v1.10.3.json` and exposes `getNewSections() -> Array<SectionSpec>`. This is the architectural seed. It can be called by a new materialization verb without being load-bearing for anything else in v1.10.3.

4. **`lib/scaffold/templates/stakeholder-analysis.md`** (new) - ROOM.md template with frontmatter and section-specific guidance following the existing ROOM.md pattern used elsewhere in the repo.

5. **`lib/scaffold/templates/decisions.md`** (new) - ROOM.md template. Frontmatter schema is the decision record schema from pass 1 section 7.3 (`decision`, `rationale`, `reversibility`, `witnesses`, `date`, `pressure_context`, `status`). This is the contract for all future v1.10.4+ decision artifacts.

6. **`lib/scaffold/templates/assumptions.md`** (new) - ROOM.md template for the assumptions section with `assumption`, `status` (active / invalidated / untested), `evidence_refs`, `last_verified`, `decays_on`.

7. **`commands/organize.md`** - extend. Add a new subcommand `--materialize-section <name>` that takes a section name from `tier-0-v1.10.3.json`, creates the directory if missing, writes the ROOM.md from the template, and logs the materialization to `.mos/scaffold-log.jsonl`. Idempotent: running twice is a no-op. This is the user-facing opt-in verb.

8. **`scripts/scaffold-migrate-1.10.3.cjs`** (new, optional helper) - stand-alone bash-callable migrator that walks an existing room and offers to materialize the three new sections. Prompts for confirmation per section. Writes a report to `.migration-report/1.10.3/<stamp>.md`. Not required for v1.10.3 itself but ships as a convenience so existing rooms can upgrade in one command.

9. **`commands/ask-cofounder.md`** (new, stub) - a slash command file that does **not yet invoke synthesis**. Instead it reads the three new sections (if they exist), produces a structured Feynman-style read-back of what the room contains in those areas, and explicitly tells the user "this is the scaffold surface only; the full co-founder voice ships later." This is the user-visible preview. It lives in `commands/` as a real, running command so users can feel the direction without the product over-promising.

10. **`CHANGELOG.md`** - add `[1.10.3] - 2026-04-21` entry (draft in A.6 below).

11. **`.claude-plugin/plugin.json`** and `package.json` - bump version string per the five-gate release rule in `release-process.md`.

12. **`lib/vault/room-scanner.test.cjs`** (extend) - three new unit tests asserting the three new sections are discoverable, and one regression test asserting the eleven existing sections still scan byte-identically.

Total: **4 new lib files, 3 new templates, 1 new stub command, 1 extended command, 1 extended scanner, 1 new migration script, 1 extended test file, plus the three release artifacts (CHANGELOG, plugin.json, package.json).** Roughly 600 to 900 lines of net new code. One week of focused work. Two weeks with test hardening and the Dror test pass.

### A.4 Exact user-visible surface after v1.10.3 ships

- Existing rooms scan **byte-identically** to before. No folders move, no files are renamed, no MINTO.md is touched. An unmigrated room is indistinguishable from a v1.10.2 room.
- Users who run `/mos:organize --materialize-section stakeholder-analysis` get a new top-level folder with a populated ROOM.md and an empty body, ready to file into. Same for `decisions` and `assumptions`.
- Users who run the new stub `/mos:ask-cofounder` get a clear message: "The co-founder voice is under construction. Today I can read your stakeholder-analysis, decisions, and assumptions sections and tell you what is there. Ask me a broader question after v1.10.4 ships." The command runs the Feynman-MINTO reader path over whichever of the three new sections exist and emits the same structured narrative the `/mos:reason` slash command emits, scoped to only those sections. This gives users a taste of the synthesis surface without committing to the voice.
- `session-start` renders the three new sections in the tree view if they exist, tagged with a "(v1.10.3 scaffold)" label so users know they are opt-in additions, not part of the original 11.

### A.5 Exact test strategy

- **Regression:** the eleven existing sections must scan byte-identically. Fixture-locked: a frozen room with known content produces the same `scanRoom()` JSON output before and after. Fails the build if any v1.10.2 room's scan output drifts.
- **New sections:** three unit tests, one per new section. Create a minimal room with each section, assert `scanRoom().sections` contains the new entry, assert `hasRoom` is true when the ROOM.md exists.
- **Materialization idempotency:** `/mos:organize --materialize-section <name>` run twice on the same room produces one folder, one ROOM.md, one scaffold-log entry. Not two.
- **Template fidelity:** the three ROOM.md templates produce valid frontmatter (YAML parseable by `parseFrontmatter` in `room-scanner.cjs`) and pass the no-em-dash rule (validator from `lib/memory/narrative-schema.cjs` extended to check templates).
- **Ask-cofounder stub:** the command runs against a room with zero artifacts in the three new sections and produces a clean "nothing to read yet" message, not an error. It runs against a room with one decision artifact and produces a Feynman narrative for that single artifact without hallucinating content.
- **Migration script:** on a fresh v1.10.2 room, `scripts/scaffold-migrate-1.10.3.cjs` with --dry-run produces a report of proposed additions. With --apply, it materializes the three sections. With --apply run twice, the second run is a no-op.
- **No em-dashes anywhere** in any new file. CI grep gate enforced via the existing pattern.

### A.6 CHANGELOG entry as a draft

```markdown
## [1.10.3] - 2026-04-21

onboarding: true
onboard_steps:
  - "NEW: Smart Notebook scaffold seed. Three new top-level sections available via /mos:organize --materialize-section: stakeholder-analysis/, decisions/, and assumptions/. These are additive. Existing rooms scan byte-identically until you opt in."
  - "NEW: /mos:ask-cofounder preview. Reads your stakeholder-analysis, decisions, and assumptions sections and produces a Feynman-style narrative of what you have filed. The full co-founder synthesis voice ships in a later release. This is the preview surface."
  - "NEW: scripts/scaffold-migrate-1.10.3.cjs migration helper. One command to materialize the three new sections in an existing room, with a dry-run flag and a per-section confirmation gate."

### Why this release exists

Pass 1 of the smart-notebook-cofounder research (.planning/research/smart-notebook-cofounder.md) proposed a 16-week, 21-phase rollout from v1.12.0 to v2.0. The user locked the next patch slot at v1.10.3 and asked for a narrower deliverable that seeds the reframe without over-promising. v1.10.3 is the seed release: it ships the three sections most load-bearing to the co-founder metaphor (stakeholder analysis, decision trails, and assumption validity), plus the scaffold loader mechanism that later releases will extend. The synthesis voice, the collection layer, the trigger framework, and the remaining fourteen Tier 0 sections defer to v1.10.4 and beyond per the forward plan in .planning/research/smart-notebook-cofounder-appendix.md Appendix A.7.

### Added
- lib/scaffold/tier-0-v1.10.3.json - partial scaffold manifest for the three seed sections
- lib/scaffold/loader.cjs - thin loader, exposes getNewSections()
- lib/scaffold/templates/stakeholder-analysis.md
- lib/scaffold/templates/decisions.md - decision record schema (decision, rationale, reversibility, witnesses, date, pressure_context, status)
- lib/scaffold/templates/assumptions.md - assumption schema (assumption, status, evidence_refs, last_verified, decays_on)
- commands/organize.md gains --materialize-section <name> subcommand, idempotent
- commands/ask-cofounder.md - Feynman-read preview over the three new sections
- scripts/scaffold-migrate-1.10.3.cjs - opt-in migrator for existing rooms
- .migration-report/1.10.3/ report directory convention

### Changed
- lib/vault/room-scanner.cjs KNOWN_SECTIONS grows from 11 to 14. The three new entries are additive. Backwards-compatible: all existing rooms continue to scan byte-identically.

### Architecture Note -- Why This Has No Collection Layer Yet
Pass 1 proposed a three-level hierarchy (section -> collection -> artifact). v1.10.3 ships the first level only. Collections require a scanner rewrite, a MINTO-generator rewrite, and a rewrite of every section-walking command (estimated 8-12 commands). That work lands in v1.10.4 or v1.12.0 depending on scheduling against v1.11.0-beta.1 release pipeline hardening. v1.10.3 is the seed. The collection layer is the next step.
```

### A.7 Phase breakdown and forward plan

**v1.10.3 phases (2 phases, ~2 weeks):**

- Phase 82: Scaffold seed (loader, three JSON entries, three templates, scanner extension, organize verb, regression tests). One week.
- Phase 83: Ask-cofounder preview (stub command, Feynman-read scoped to three sections, migration helper, docs, CHANGELOG, release). One week.

**Forward plan (post-v1.10.3 through the eventual v2.0):**

- **v1.10.4** - Collection layer introduction on `stakeholder-analysis/` only. Five collections: `stakeholders/`, `influence-interest-map/`, `concerns/`, `commitments/`, `interviews/`. Scanner learns three-level walking. MINTO generator learns collection rollups. ~2 weeks.
- **v1.10.5** - Remaining Tier 0 sections added. `value-proposition/`, `team-building/`, `experiments/`, `research-documents/`, `competition/` as rename with alias. Still flat (no collections for those). ~2 weeks.
- **v1.11.0-beta.1** - Release pipeline hardening (already scoped, untouched by this work).
- **v1.11.0** - Release pipeline hardening stable.
- **v1.12.0** - Collection layer expands to all Tier 0 sections. Trigger framework lands with three lowest-risk triggers (method invocation, missing-dimension audit, stage transition). ~3-4 weeks.
- **v1.13.0** - Synthesis voice alpha. `/mos:ask-cofounder` becomes real. Voice-log infrastructure. Three surface modes. ~4-5 weeks. Highest-risk release in the chain.
- **v2.0** - Voice hardening, disagreement mode, keyword and contradiction triggers, full Tier 1 and Tier 2 scaffolds. ~5 weeks.

Total forward plan: **approximately 18-20 weeks from v1.10.3 through v2.0**, including v1.11.0 insertion. That matches pass 1's 16-week estimate with room for the release pipeline work to land without blocking the smart-notebook track.

### A.8 Tri-polar check for v1.10.3

- **CLI.** Everything ships as scanner extensions, a new JSON loader, template markdown files, two new commands (`organize --materialize-section` and the `ask-cofounder` stub), and a migration script. All native CLI primitives. Zero new infrastructure.
- **Desktop.** Larry gets three new section types to talk about. Users say "add stakeholder analysis" and Larry runs the organize verb. The preview `/mos:ask-cofounder` is Desktop-discoverable because it reads natural-language-style ("ask Larry about your cofounder") even though the actual command name is the slash form.
- **Cowork.** The three new sections are shared state. Two users cannot both materialize simultaneously because the command is idempotent: both users calling it produce one folder, one ROOM.md, one scaffold-log entry. Concurrency-safe by construction. The `ask-cofounder` preview reads the same shared filesystem on every surface.

### A.9 Dror test for v1.10.3

Dror installs MindrianOS, runs `/mos:new-project`, answers the existing questionnaire, gets the v1.10.2 standard room. Then runs `/mos:organize --materialize-section stakeholder-analysis`, sees a new folder appear with a useful ROOM.md. Files one stakeholder interview note inside. Runs `/mos:ask-cofounder`, sees a Feynman narrative of what he just filed and an honest acknowledgment that the rest of the voice ships later. The test passes if Dror says "I understand where this is going and I can use the new folder today." The test fails if Dror says "what does this give me that v1.10.2 did not."

---

## Appendix B: Framework x Section operation matrix

This appendix maps every existing MindrianOS command and skill to the proposed pass 1 scaffold. Two views: forward (existing -> proposed) and inverse (proposed -> existing).

### B.1 Existing command inventory

Commands directory has 65 files. Grouped by function:

- **Room and scaffold operations:** new-project, room, rooms, organize, dashboard, wiki, present, publish, export, snapshot, vault, setup, status, help, splash, models, update, radar, scout, admin.
- **Filing and meetings:** file-meeting, speakers, reanalyze.
- **Reasoning and intelligence:** reason, structure-argument, think-hats, hat-briefing, persona, query, graph, suggest-next, diagnose.
- **Problem framing:** beautiful-question, map-unknowns, challenge-assumptions, root-cause, systems-thinking, analyze-systems, analyze-needs, analyze-timing, user-needs, build-knowledge.
- **Opportunity and venture:** opportunities, funding, scenario-plan, explore-futures, explore-trends, explore-domains, macro-trends, find-analogies, find-connections, find-bottlenecks, dominant-designs, score-innovation, lean-canvas, value-proposition, mullins, leadership, compare-ventures, act, pipeline, research, grade, deep-grade, build-thesis, causal, whitespace, validate.

Skills directory has 8 core skills: brain-connector, context-engine, conversation-mode, larry-personality, pws-methodology, room-passive, room-proactive, ui-system.

Pipelines directory has 3: analogy, discovery, thesis.

### B.2 Forward view: existing command -> proposed scaffold items it should operate on

Abbreviations: PD=problem-definition, SD=solution-design, VP=value-proposition, BM=business-model, MA=market-analysis, COMP=competition, TEAM=team, TB=team-building, SA=stakeholder-analysis, MTG=meetings, DEC=decisions, ASM=assumptions, EXP=experiments, RD=research-documents, LEG=legal-ip, FIN=financial-model, GTM=go-to-market, FR=fundraising, VAL=validation.

| Command | What it does today | Current sections | Proposed new scaffold items it should operate on | Change |
|---|---|---|---|---|
| new-project | Initialize room with questionnaire | ROOM.md creation | All Tier 0, questionnaire extended 6 to 10 questions | minor |
| room | Manage room, launch dashboard | Whole room | Whole room including collections | minor |
| organize | Navigate hierarchy, propose moves | Sections and sub-rooms | Sections + collections + artifacts, materialize verb | major |
| dashboard | Interactive graph | All sections | Three-level graph | major |
| wiki | Wikipedia-style browser | Section pages | Section pages plus collection pages | major |
| present | Six-view presentation | All sections | Including new Tier 0 | minor |
| export | De Stijl export | All sections | Including new sections | minor |
| snapshot | Single-file hub | All sections | Including new sections | minor |
| reason | Feynman-MINTO per section | Every section | Every section plus per-collection MINTOs and rollup | major |
| structure-argument | Minto pyramid MECE tree | Free input | Per-section and per-collection inputs | minor |
| think-hats | Six hats over room | Whole room | Over voice-logs and decisions section | minor |
| hat-briefing | Consolidated hat report | Whole room | Over decisions and contradictions-held | minor |
| persona | AI perspective lens | Whole room | Over stakeholder-analysis specifically | minor |
| query | NL knowledge graph query | Whole room | Three-level walk plus voice-log queries | major |
| graph | NL graph exploration | LazyGraph | Three-level graph including collection edges | major |
| suggest-next | Graph-informed next | All state | Scaffold gap audit feeds this | minor |
| diagnose | Classify problem type | Problem formulation | PD and decisions/pending | minor |
| beautiful-question | BQF reframe | PD | PD + decisions/pending | none |
| map-unknowns | Known/unknown matrix | Whole room | Plus dedicated `unknowns/` Tier 3 | minor |
| challenge-assumptions | Devils advocate | ASM | Reads ASM section natively, was file-based | minor |
| root-cause | 5-Whys, fishbone | PD | PD and DEC for decision post-mortems | minor |
| systems-thinking | Feedback loops stocks flows | Whole room | Plus reverse-salients Tier 3 | none |
| analyze-systems | Decompose layers | Whole room | Layer-aware including collections | minor |
| analyze-needs | JTBD | MA, PD | VP, MA, SA, MA/segments collection | minor |
| analyze-timing | S-curve | MA, COMP | MA/timing, COMP/moves | minor |
| user-needs | Importance-satisfaction | MA, VP | VP/segments, SA | minor |
| build-knowledge | DIKW climb | Whole room | Over decisions and assumptions | minor |
| opportunities | Grant discovery | opportunity-bank | Plus funding section | minor |
| funding | Funding lifecycle | opportunity-bank | Plus fundraising Tier 1 | minor |
| scenario-plan | 2x2 scenarios | Whole room | Plus FIN/scenarios collection | minor |
| explore-futures | TTA/scenario/s-curve | Whole room | Plus research-documents | minor |
| explore-trends | Trending to absurd | MA | MA/trends collection | minor |
| explore-domains | IKA scoring | MA, COMP | MA/segments, COMP/watched | minor |
| macro-trends | PEST | MA | MA/trends | minor |
| find-analogies | SAPPhIRE/TRIZ | PD, SD | Plus RD/literature | minor |
| find-connections | Cross-domain | Whole room | Three-level edges | minor |
| find-bottlenecks | Reverse salient | Whole room | Plus reverse-salients Tier 3 | minor |
| dominant-designs | Utterback-Abernathy | SD, COMP | SD/architecture, COMP/moves | minor |
| score-innovation | HSI | Whole room | Includes new sections | minor |
| lean-canvas | 9-box canvas | BM | BM/lean-canvas collection | minor |
| value-proposition | Score Real/Win/Worth | BM, VP | VP section natively, was subsection | minor |
| mullins | Seven-domain analysis | Multiple | Across MA, BM, COMP, TEAM | minor |
| leadership | Leadership coaching | TEAM | TB section and TEAM/trust-graph | minor |
| compare-ventures | Cross-venture comparison | Whole room | Includes new sections | minor |
| act | Autonomous methodology | Whole room | Routes to new sections when appropriate | minor |
| pipeline | Multi-step chain | Whole room | Pipeline stages can target collections | major |
| research | Web research + Brain | RD (new) | RD/literature collection | minor |
| grade | 6-component score | PD | PD, DEC, ASM weighted | minor |
| deep-grade | Calibrated assessment | Whole room | Whole room including new sections | minor |
| build-thesis | Ten questions + 6 categories | Whole room | Plus FR/story | minor |
| causal | Causal extraction | Whole room | Decisions causal chains | minor |
| whitespace | Detect missing | Whole room | Pass 1 section 5.4 gap audit equivalent | major |
| validate | Six hats evidence | ASM, EXP | ASM natively, EXP section | minor |
| file-meeting | File transcript | MTG | MTG/promises collection plus filing to DEC | minor |
| speakers | Who was in meetings | MTG, TEAM | Plus SA/interviews | minor |
| reanalyze | Re-run intel on meetings | MTG | Cascade to DEC and ASM | minor |
| query | NL room query | Whole room | Three-level walk | major |
| setup | Configure integrations | .mcp.json | No scaffold impact | none |

Skills:

| Skill | Current | Proposed attachment | Change |
|---|---|---|---|
| brain-connector | Weaves graph context | Brain queries per new section in Appendix C | minor |
| context-engine | USER.md and memory | Extend to voice-log and scaffold-log | minor |
| conversation-mode | Three modes for no-room | Mode 2 routes to new sections | minor |
| larry-personality | Ask-tell dial | Tells about decisions, asks about stakeholders | minor |
| pws-methodology | Framework routing | Routes to new sections for methodology matches | minor |
| room-passive | Filing intelligence | Routes filings to new sections | minor |
| room-proactive | Surfaces gaps | Runs scaffold gap audit (pass 1 5.4) | major |
| ui-system | 4-zone terminal | Renders three-level tree in body zone | minor |

Pipelines: analogy, discovery, thesis - all three pipelines operate over whole-room context and need to learn to include the new sections when they exist. Minor change each.

### B.3 Inverse view: scaffold item -> existing commands that natively fit

For each scaffold item from pass 1 section 4, name the existing commands that fit and flag the gap if none.

**Tier 0 sections (pass 1 section 4.1):**

| Scaffold item | Existing commands that fit | Gap (new command implied?) |
|---|---|---|
| problem-definition | beautiful-question, diagnose, root-cause, map-unknowns, grade, build-knowledge | No gap |
| problem-definition/statement | reason, structure-argument | No gap |
| problem-definition/reformulations | None | New helper: `/mos:reformulate` or extend diagnose |
| problem-definition/evidence | research, validate | No gap |
| problem-definition/wickedness | None | New helper or reference in diagnose |
| solution-design | dominant-designs, find-analogies, systems-thinking | No gap |
| solution-design/alternatives | challenge-assumptions | No gap |
| solution-design/prototypes | None | New: link experiments to prototypes |
| solution-design/architecture | analyze-systems | No gap |
| value-proposition | value-proposition command, analyze-needs, user-needs | No gap |
| value-proposition/segments | analyze-needs, explore-domains | No gap |
| business-model | lean-canvas, mullins | No gap |
| business-model/unit-economics | None | New: `/mos:unit-economics` |
| business-model/pricing | None | New: `/mos:pricing-decision` |
| market-analysis | explore-trends, macro-trends, analyze-timing, explore-domains | No gap |
| market-analysis/sizing | None | New: `/mos:market-sizing` |
| market-analysis/substitutes | analyze-needs | No gap |
| competition | compare-ventures, find-connections | No gap |
| competition/moves | analyze-timing, dominant-designs | No gap |
| competition/watched | radar | No gap |
| team | speakers, leadership | No gap |
| team/trust-graph | None | New: `/mos:trust-graph` (politically delicate per pass 1) |
| team-building | None entirely | New section, new command: `/mos:hiring-standards`, extend leadership |
| team-building/hiring-standards | None | New |
| team-building/pipeline | None | New |
| team-building/not-hires | None | New |
| stakeholder-analysis | persona (weak fit) | New: `/mos:stakeholder-map`, `/mos:stakeholder-interview` |
| stakeholder-analysis/influence-interest-map | None | New helper |
| stakeholder-analysis/concerns | None | New, or extend challenge-assumptions |
| stakeholder-analysis/commitments | file-meeting (promises subsurface) | Extend file-meeting |
| meetings | file-meeting, speakers, reanalyze | No gap |
| meetings/promises | None | New: extend reanalyze to extract promises |
| decisions | None | New: `/mos:decide` helper to log a decision with schema |
| decisions/active | None | Filter view via query |
| decisions/reversed | None | Query filter |
| decisions/pending | None | Query filter |
| assumptions | challenge-assumptions, validate | No gap once promoted to section |
| assumptions/active | validate | No gap |
| assumptions/invalidated | None | Query filter |
| experiments | validate | Partial |
| experiments/failed | None | New: `/mos:post-mortem` |
| research-documents | research | No gap |
| research-documents/literature | research | No gap |
| research-documents/patents | research | Partial, needs IP-specific |
| legal-ip | None explicit | New or extend grade for legal dimension |
| legal-ip/obligations | None | New |
| financial-model | None explicit | New: `/mos:runway`, `/mos:burn` |
| financial-model/runway | None | New |
| financial-model/scenarios | scenario-plan | No gap |

**Tier 1 (stage-dependent):**

| Item | Existing fit | Gap |
|---|---|---|
| discovery | explore-domains, find-connections, analyze-needs | No gap |
| validation | validate, challenge-assumptions | No gap |
| go-to-market | None explicit | New: `/mos:gtm` |
| fundraising | funding, opportunities, build-thesis | Extend build-thesis for investor story |
| operations | None | New: `/mos:cadence` |
| culture | leadership | Partial |

**Tier 3 (context-triggered):**

All Tier 3 items are proposed as automatic materializations by the trigger framework. None have native commands. The trigger framework itself is the command.

### B.4 Top 3 wiring gaps

1. **No decision-logging command exists.** Every framework pulls toward pass 1 section 1.1 (decision trails) but there is no `/mos:decide` or `/mos:log-decision`. This is the most load-bearing gap because pass 1 section 6 (synthesis voice) depends on the voice being able to read decision records with reliable schema. Without a command, users file decision markdowns by hand and the frontmatter drifts. v1.10.3 ships the template but not the command. v1.10.4 should ship `/mos:decide`.

2. **Financial helpers are absent.** `financial-model/` has never had a dedicated command despite being one of the original 11 sections. `runway/`, `burn/`, `scenarios/` are target collections and only `scenario-plan` fits one of them. Pass 1 section 1.5 (runway as felt pressure) is central to the co-founder voice. A `/mos:runway` command that computes runway from a live spreadsheet and tags it with felt-pressure language is a future addition.

3. **Stakeholder commands are entirely new.** `stakeholder-analysis/` is the section the user most visibly wants, and not a single existing command natively targets it. `persona` is the closest (De Bono hats), but it is about perspectives, not stakeholders. Pass 1 section 1.4 proposes five collections under stakeholder-analysis, and all five need new or extended commands. v1.10.3 ships the section but no commands yet. v1.10.4 or v1.10.5 should ship `/mos:stakeholder-map`, `/mos:stakeholder-interview`, and `/mos:commitment-log`.

---

## Appendix C: Brain coverage matrix (real queries)

### C.1 Brain Neo4j schema summary (live query 2026-04-14)

Query: `CALL db.labels() YIELD label CALL { WITH label MATCH (n) WHERE label IN labels(n) RETURN count(n) AS cnt } RETURN label, cnt ORDER BY cnt DESC`

Actual results (top nodes by count):

- **LazyGraphConcept**: 7,578 nodes
- **__Entity__**: 5,747 (generic meta-label)
- **Concept**: 2,138
- **Entity**: 1,316
- **Product**: 1,295
- **Chunk**: 1,167 (RAG chunks)
- **DocumentChunk**: 1,136
- **Event**: 1,014
- **ProcessStep**: 615
- **Session**: 488
- **Person**: 440
- **StrategicResponse**: 432
- **Problem**: 413
- **DiagnosticElement**: 332
- **Document**: 287
- **DictionaryTerm**: 264
- **Characteristic**: 247
- **ReverseSalient**: 239
- **StrategicComponent**: 230
- **Technique**: 184
- **Organization**: 169
- **Insight**: 165
- **CreativeWork**: 144
- **Domain**: 143
- **Journey**: 137
- **Framework**: 100
- **Assumption**: 100
- **Phase**: 86
- **Component**: 83
- **Method**: 73
- **Author**: 68
- **Book**: 64
- **InnovationTool**: 40
- **Tool**: 30
- **Pattern**: 15
- **DataRoomSection**: 13

Total distinct node labels: over 500 (most with counts 1 to 10, indicating long-tail domain-specific nodes).

**Real node count in the Brain is consistent with the CLAUDE.md claim of "21K+ nodes"**: top 15 labels alone sum to ~22K. Relationship count query timed out at the default transaction timeout, which is itself a signal that relationships exceed 65K.

Key observations:
- `DataRoomSection` exists as a node label with exactly 13 entries. Queried directly and got: `business_model, competitive_analysis, financial_model, legal_ip, market_analysis, problem_definition, solution_design, team_execution, governance_esg, literary_analysis, research_angles, research_methodology, analytical_framework`. These 13 are a superset of the current 11 KNOWN_SECTIONS plus four analytical-research additions. The Brain already has a model of the room schema.
- **Framework** has exactly 100 nodes - this is the canonical count. The number matches the "teaching graph" framing.
- **Assumption** has 100 nodes, confirming the Brain already encodes validity status of 100 teaching assumptions, reusable for Decision 12.
- **ReverseSalient** has 239 nodes, direct ground for pass 1 section 5.5 (reverse salient trigger).
- **Pattern** has only 15 nodes with sparse descriptions. Pattern coverage is thinner than expected.

### C.2 Framework enumeration

Query: `MATCH (f:Framework) RETURN f.name, f.category LIMIT 100` returned 100 rows (the full set). Sampled:

Top strategy/leadership frameworks present:
- The Pyramid Principle, MECE, SCQA
- Jobs to Be Done, JTBD
- Cynefin Framework, Cynefin-Informed Sequential Innovation Discovery
- Six Thinking Hats, BONO Framework
- Beautiful Question Framework, BQF
- Systems Thinking, Theory of Change, Causal Loop Diagrams
- Scenario Planning, Scenario Analysis Framework
- Reverse Salient Analysis
- Four Lenses of Innovation
- Design Thinking, Process Mapping for Innovation
- Lean Canvas, Business Model Generation
- Hypothesis-Driven Problem Solving, Well-Defined Problem Framework
- Usher's Model of Cumulative Synthesis, Changing Terms of Competition
- PWS Triple Validation Compass, PWS Value Proposition Model
- Trending to the Absurd, Oracle Foresight Engine
- Stock and Flow Diagrams, Leverage Points (Meadows)
- Knowns and Unknowns Matrix
- Root Cause Analysis
- Devil's Advocate (PWS-Bias)
- HSI Semantic Surprise Analysis
- Red Teaming, Opposite Plan
- Transformational / Servant / Adaptive / Situational / Authentic / Distributed / Systems Leadership (8 leadership frameworks)
- Psychological Safety, Conflict Resolution, Tuckman Team Stages, High-Performing Teams
- Engineering Ethics in Leadership, ABET Accreditation Outcomes, Strategic Decision Making
- Legal / IP / Financial / ESG Due Diligence Frameworks (4 due diligence frameworks)
- ESG Materiality Assessment
- Golden Circle (Sinek), Level 5 Leadership, Hedgehog Concept, Flywheel, Stockdale Paradox, First Who Then What, Strategic Inflection Point (Grove), Braintrust (Catmull), Resulting (Duke), Five Practices of Effective Executives (Drucker), Seven Da Vincian Principles

That is an extraordinarily dense framework graph. Pagination past the first 100 returned zero additional results, confirming exactly 100 Framework nodes total (matches count query).

### C.3 Pattern enumeration

Query: `MATCH (p:Pattern) RETURN p.name, p.description LIMIT 30` returned 15 rows (the full set):

Real patterns with descriptions:
- Vicious Cycle Pattern - reinforcing loop creating negative outcomes
- Tragedy of the Commons - shared resource depleted by individual rational behavior
- Shifting the Burden - quick fixes that undermine long-term solutions
- Success to the Successful - winner takes all dynamics
- Platform Evolution Pattern (no description)
- Complexity Fatigue Pattern (no description)
- Identity Preservation Pattern (no description)
- Curation Economy Pattern (no description)
- Technical Democratization Pattern (no description)
- High Temperature Pattern (no description)
- Growth Rate Pattern (no description)
- Pattern-6290, Pattern-6352, Pattern-6353, Pattern-6372 (unnamed, placeholder)

**Honest gap:** Pattern coverage is thin. Only 4 of 15 have descriptions. The Meadows systems archetypes (four of them) are the only substantive teaching patterns encoded. The eleven unnamed or undescribed entries are enrichment TODOs. Pass 1 leans heavily on "patterns as the durable teaching primitive," but the live Brain does not back that up. Pattern enrichment is a v1.11+ or standalone Brain milestone.

### C.4 Book enumeration (top 65 of 64-70)

Query: `MATCH (b:Book) RETURN b.title, b.author LIMIT 70` returned 65 rows. Representative sample includes: Zero to One, The Lean Startup, Crossing the Chasm (two entries), The Mom Test, Competing Against Luck, Innovation and Entrepreneurship, The Art of the Long View, The Startup Owner's Manual, The Medici Effect, The Innovator's Dilemma, Start with Why, Thinking in Bets, Good to Great, Creativity Inc., Only the Paranoid Survive, Business Model Generation, Four Steps to the Epiphany, A More Beautiful Question, Blue Ocean Strategy, The Fifth Discipline, Thinking in Systems, Seeing What's Next, Dilemmas in a General Theory of Planning (Rittel), Redesigning the Future (Ackoff), The Innovator's Solution, Creative Confidence, Reinvent Your Business Model, Scenarios: Uncharted Waters Ahead (Wack), Made to Stick, The Mythical Man-Month, Bulletproof Problem Solving, Four Lenses of Innovation, Design Thinking, Capitalism Socialism and Democracy (Schumpeter), Lateral Thinking, Risk Uncertainty and Profit (Knight), Antifragile, Networks of Power (Hughes), What Customers Want, Demand-Side Sales 101, Leverage Points (Meadows), The Structure of Ill-Structured Problems, Competition and Entrepreneurship (Kirzner), Technology Complex and Paradox of Technological Determinism (Fleck Howells), **PWS Value Proposition Model by Lawrence Aronhime and Jonathan Sagir**, Technological Discontinuities and Dominant Designs (Anderson Tushman), Principles of Forecasting (Armstrong), How to Think Like Leonardo da Vinci (Gelb), Collective Impact (Kania Kramer), Systems Thinking for Social Change (Stroh).

**Honest finding:** the "59 books" claim in CLAUDE.md resolves to approximately 65 Book nodes. The exact count is 64 from the label count query and 65 from the title query (one duplicate). The library is real and rich. It covers the founder / strategy / systems / innovation canon comprehensively. Six of the adjacent authors pass 1 section 1.8 pulled in (Horowitz, Voss, Bungay, Cagan, Catmull, Kelley) are present directly or via equivalent works.

### C.5 Pinecone index summary

Query: `mcp__pinecone__list-indexes` returned two indexes:

- **pws-brain** (the main teaching index)
  - Dimension: 1024
  - Metric: cosine
  - Embed model: multilingual-e5-large
  - Field map: `{text: "content"}`
  - Host: aped-4627-b74a us-east-1 AWS serverless
  - Status: ready
- **fil-brain** (Financial Innovations Labs sibling index, not used for MindrianOS scaffold work)

`describe-index` was permission-denied, so namespace enumeration via that tool was blocked. Namespace discovery came from direct `search-records` calls.

- `__default__` namespace returned zero hits on multiple queries, confirming empty.
- `books` namespace returned rich results on every query (avg top score ~0.78). This is the namespace where the 65 Book nodes' teaching descriptions live. Each record is `{author, content, domain, type, year, _id}`. Example `_id` values: `book-creativity-inc`, `book-good-to-great`, `book-start-with-why`, `book-thinking-in-bets`, `book-only-paranoid-survive`.
- Other likely namespaces: `tools`, `frameworks`, `patterns`, `chunks`, `sessions` - not directly probed due to context budget but inferred from the Neo4j label set (InnovationTool=40, Framework=100, Pattern=15, Chunk=1167, Session=488). The "1,427 embeddings" claim in CLAUDE.md is consistent with chunks + books + frameworks summing to roughly that number.

### C.6 Scaffold coverage table

For each v1.10.3 scaffold item (the three seed sections) and the remaining pass 1 Tier 0 scaffold items, BRAIN_COVERED / PARTIAL / MISSING. The Pinecone query coverage is drawn from actual books-namespace searches plus Neo4j framework inspection.

| Scaffold item | Brain framework nodes | Brain pattern nodes | Pinecone books top match | Verdict |
|---|---|---|---|---|
| stakeholder-analysis | None directly. "Conflict Resolution Framework", "ESG Materiality Assessment" adjacent | None | Weak hit on "stakeholder analysis" query: top match was Creativity Inc (Braintrust), Good to Great (First Who Then What), Start with Why (Golden Circle). None specifically on stakeholder mapping | **BRAIN_PARTIAL** - leadership framing exists, stakeholder-mapping-as-method does not |
| stakeholder-analysis/influence-interest-map | None | None | None | **BRAIN_MISSING** - classic 2x2 influence grid is absent |
| stakeholder-analysis/concerns | None | None | Thinking in Bets (Resulting) tangential | **BRAIN_MISSING** |
| stakeholder-analysis/commitments | None | None | None | **BRAIN_MISSING** |
| stakeholder-analysis/interviews | JTBD, Process Mapping for Innovation | None | Competing Against Luck, The Mom Test | **BRAIN_COVERED** - JTBD and Mom Test are directly applicable |
| decisions | Hypothesis-Driven Problem Solving, Strategic Decision Making for Leaders, Six Thinking Hats, Devils Advocate, Knowns and Unknowns Matrix, Cynefin Framework | Shifting the Burden, Vicious Cycle | Thinking in Bets (top hit, Resulting + Decision Pods), Only the Paranoid Survive (Strategic Inflection Point) | **BRAIN_COVERED** - decision science is one of the Brain's strongest areas |
| decisions/active | Same as above | - | - | **BRAIN_COVERED** |
| decisions/reversed | None specific | Shifting the Burden (reversibility archetype) | Thinking in Bets (Resulting challenges retrospective bias) | **BRAIN_PARTIAL** |
| decisions/pending | Cynefin Framework (Complicated vs Complex), Beautiful Question Framework | - | Made to Stick, A More Beautiful Question | **BRAIN_COVERED** |
| assumptions | Hypothesis-Driven Problem Solving, Well-Defined Problem Framework, Wicked Problem Detection, Beautiful Questions Bias Detection, PWS-Bias Devils Advocate Agent, PWS Triple Validation Compass | None | The Lean Startup, Four Steps to the Epiphany | **BRAIN_COVERED** - this is one of the deepest areas with an Assumption node label already at 100 entries |
| assumptions/active | Same | - | - | **BRAIN_COVERED** |
| assumptions/invalidated | Devils Advocate, Red Teaming | - | The Mom Test | **BRAIN_COVERED** |
| assumptions/untested | Hypothesis-Driven Problem Solving, Knowns and Unknowns Matrix | - | The Lean Startup, Bulletproof Problem Solving | **BRAIN_COVERED** |
| problem-definition | Beautiful Question Framework, Problem Definition Transformation, Well-Defined Problem, Wicked Problem Detection | - | A More Beautiful Question, Dilemmas in a General Theory of Planning (Rittel), The Structure of Ill-Structured Problems | **BRAIN_COVERED** (existing) |
| solution-design | Four Lenses of Innovation, Design Thinking, Dominant Designs (Utterback-Abernathy), SAPPhIRE/TRIZ, Cynefin-Informed Sequential | Platform Evolution Pattern | Innovators Dilemma, Innovators Solution, Four Lenses of Innovation | **BRAIN_COVERED** |
| value-proposition | PWS Value Proposition Model (Lawrence+Jonathan), Blue Ocean | - | PWS Value Proposition Model (book authored by Lawrence and Jonathan, in the library), Business Model Generation | **BRAIN_COVERED** - this is an in-house framework |
| business-model | Lean Canvas, Business Model Generation, Changing Terms of Competition | Curation Economy | Business Model Generation, Reinvent Your Business Model | **BRAIN_COVERED** |
| business-model/unit-economics | None directly | Growth Rate Pattern | None specific | **BRAIN_PARTIAL** - unit economics as a taught framework is absent, financial discipline is adjacent |
| business-model/pricing | None | None | None | **BRAIN_MISSING** |
| market-analysis | Trending to the Absurd, Scenario Planning, Blue Ocean, Macro trends (PEST implied) | - | Blue Ocean, Crossing the Chasm, Seeing Whats Next | **BRAIN_COVERED** |
| market-analysis/segments | JTBD, Four Lenses of Innovation | - | Competing Against Luck, What Customers Want | **BRAIN_COVERED** |
| market-analysis/sizing | None directly | - | None | **BRAIN_MISSING** - TAM SAM SOM as a method is not in the framework graph |
| market-analysis/timing | Scenario Planning, Dominant Designs, S-Curve (via analyze-timing command), Usher Cumulative Synthesis | - | Scenarios Wack, Principles of Forecasting | **BRAIN_COVERED** |
| market-analysis/substitutes | JTBD (non-consumption) | - | Competing Against Luck | **BRAIN_COVERED** |
| competition | Reverse Salient Analysis (Hughes), Changing Terms of Competition, Competition and Entrepreneurship (Kirzner) | - | Networks of Power (Hughes), Only the Paranoid Survive | **BRAIN_COVERED** |
| team | Tuckman Team Stages, High-Performing Teams, Psychological Safety | None | First Who Then What (Good to Great), Creativity Inc | **BRAIN_COVERED** |
| team/trust-graph | None | None | None | **BRAIN_MISSING** - trust as a graph primitive is absent |
| team-building | None dedicated | - | First Who Then What | **BRAIN_PARTIAL** |
| team-building/hiring-standards | None | - | Good to Great (First Who Then What) | **BRAIN_PARTIAL** |
| meetings | None framework-level (infra, not methodology) | - | - | N/A - meetings are the source, not the framework |
| experiments | The Lean Startup (build-measure-learn), Four Steps to Epiphany | None | The Lean Startup, Four Steps to the Epiphany | **BRAIN_COVERED** |
| research-documents | None | - | Bulletproof Problem Solving | **BRAIN_PARTIAL** - research as method lives in command layer, not framework layer |
| legal-ip | Legal Due Diligence Framework, IP Due Diligence Framework | - | None | **BRAIN_COVERED** |
| financial-model | Financial Due Diligence Framework | - | None | **BRAIN_COVERED** |
| financial-model/runway | None | None | Only the Paranoid Survive (Valley of Death - indirect) | **BRAIN_MISSING** |
| go-to-market | Crossing the Chasm (Moore) | None | Crossing the Chasm | **BRAIN_COVERED** |
| fundraising | None framework-level | - | Zero to One (Thiel) indirect | **BRAIN_MISSING** - fundraising playbook is absent from the teaching graph |

**Coverage summary across the items tested:**
- BRAIN_COVERED: 17 items (mostly problem, solution, market, business, competition, assumptions, decisions, team, experiments - the core PWS curriculum)
- BRAIN_PARTIAL: 6 items (stakeholder-analysis, unit-economics, team-building hiring, decisions/reversed, research-documents, team-building)
- BRAIN_MISSING: 8 items (influence-interest-map, stakeholder-concerns, stakeholder-commitments, pricing, market-sizing, trust-graph, runway, fundraising)

### C.7 Brain enrichment TODO (v1.11+ standalone Brain milestone)

The MISSING items below need teaching content added to the Brain before the co-founder voice can cite real Brain-backed patterns for them. This list is input to a future "Brain enrichment wave."

1. **Stakeholder Analysis curriculum.** Add Framework nodes for Mendelow's Power-Interest Grid, Freeman's Stakeholder Theory, Salience Model (Mitchell/Agle/Wood), Stakeholder Circle. Pinecone: embed Freeman 1984 "Strategic Management: A Stakeholder Approach", Mendelow 1981. Pattern nodes: "Stakeholder Coalition", "Silent Veto", "Legitimacy Spiral".

2. **Trust Graph primitive.** No existing concept in the Brain. Would need new node label `TrustEdge` between `Person` nodes with type (covers-for, conflict-with, amplifies, blocks). Teaching ground: add Edmondson "The Fearless Organization", Patrick Lencioni "Five Dysfunctions". Delicate because trust is private; local-only enrichment.

3. **Pricing curriculum.** Add Frameworks: Van Westendorp Price Sensitivity, Economic Value to Customer, Segment Pricing, Value-Based Pricing. Books: Hermann Simon "Confessions of a Pricing Man", Madhavan Ramanujam "Monetizing Innovation".

4. **Unit Economics curriculum.** Frameworks: CAC, LTV, Payback Period, Gross Margin decomposition, Cohort Analysis. Books: David Skok essays (SaaStr), "Lean Analytics" by Croll and Yoskovitz.

5. **Market Sizing (TAM SAM SOM).** Frameworks: top-down sizing, bottom-up sizing, value-theory sizing. Books: already have Principles of Forecasting, need to tag sizing chapters.

6. **Runway and burn discipline.** Frameworks: zero-based budgeting, runway scenarios, burn multiple. Books: Brad Feld "Venture Deals", "Secrets of Sand Hill Road" by Scott Kupor.

7. **Fundraising playbook.** Frameworks: Ten Slides Deck (Guy Kawasaki), Series A readiness, investor narrative arcs. Books: "Venture Deals", "Secrets of Sand Hill Road", "Pitch Anything" by Oren Klaff.

8. **Pattern enrichment.** Only 4 of 15 Pattern nodes have descriptions. The remaining 11 are enrichment TODOs in themselves. Pass 1 relies on patterns as the durable teaching primitive; the Brain does not currently back that up.

The Brain enrichment wave is a separate milestone from the plugin-side scaffold work. It can run in parallel but it is not blocking for v1.10.3, which ships only the scaffold seed.

### C.8 Query failure modes encountered (honesty)

- `mcp__my-neo4j__get_neo4j_schema` failed on first call with a syntax error (APOC schema call passed `None` instead of an integer). Second call with explicit `sample_size=200` returned a 1.4MB result that exceeded token budget and was saved to a tool-results file. Used label+count Cypher instead to get the same data compactly.
- `mcp__my-neo4j__read_neo4j_cypher` timed out on the relationship-type-count query (`CALL db.relationshipTypes() ... count(r)`) due to default transaction timeout. The total relationship count is high (>65K per CLAUDE.md) and a full COUNT of every relationship type hit the server-side timeout. Workaround: sampled individual types would have worked but was not context-budget-feasible for this pass. The relationship topology is therefore inferred from label inspection, not directly measured.
- `mcp__pinecone__describe-index` was permission-denied. Namespace enumeration fell back to direct search probes. The `__default__` namespace is empty. The `books` namespace is rich and was used for all curriculum cross-referencing. Other namespaces (frameworks, patterns, tools, chunks, sessions) likely exist but were not probed due to context budget.
- The `pws` namespace returned zero hits, suggesting no such namespace or it is empty.

No query fabricated results. Every Brain finding above is grounded in an actual response. Missing coverage is marked MISSING, not inferred from absence of data.

---

## Appendix D: PWS curriculum cross-reference

### D.1 Sources the PWS curriculum draws from

- **64-65 Book nodes** in the Brain (enumerated in C.4 above)
- **40 InnovationTool nodes** plus **30 Tool nodes** - not directly queried but surfaced in the label count
- **100 Framework nodes** (enumerated in C.2)
- **15 Pattern nodes** (enumerated in C.3, thin)
- **16 Claude Desktop projects** at `/home/jsagi/MindrianOS/.planning/research/pws-academy-input/` (referenced in CLAUDE.md, not directly probed in this session)
- **1,427 Pinecone embeddings** (inferred; books namespace confirmed rich)
- **Lawrence style guide** `claude-project-12-larry-style-guide.md` and **Week 7 Combining Tools** `pws-week-7-combining-tools.md` (referenced in CLAUDE.md)
- **PWS Value Proposition Model** - a Book node authored by Lawrence Aronhime and Jonathan Sagir, found in the Brain. This is an in-house framework.

### D.2 Scaffold item x PWS sources table

Restricted to the v1.10.3 seed sections plus the highest-value pass 1 Tier 0 items. Columns: scaffold item | PWS sources | application note.

| Scaffold item | PWS sources (book / tool / framework / project) | Application |
|---|---|---|
| stakeholder-analysis (v1.10.3) | Frameworks: Conflict Resolution Framework, ESG Materiality Assessment, Psychological Safety. Books: Creativity Inc (Braintrust as stakeholder surface), Good to Great (First Who Then What). Tools: persona command (Six Hats) | Stakeholder mapping as method is a real gap in the curriculum. Existing leadership-focused books cover the softer side. Need Mendelow grid added. |
| stakeholder-analysis/interviews | Frameworks: JTBD, Process Mapping for Innovation. Books: Competing Against Luck, The Mom Test, Demand-Side Sales 101, What Customers Want | JTBD interviews are a mature PWS method. The Mom Test directly applies to stakeholder interviews. Strong coverage. |
| decisions (v1.10.3) | Frameworks: Hypothesis-Driven Problem Solving, Strategic Decision Making for Leaders, Six Thinking Hats, Cynefin Framework, Devils Advocate, Knowns and Unknowns Matrix, PWS Triple Validation Compass. Books: Thinking in Bets (top hit), Only the Paranoid Survive (10X Force, Valley of Death), Made to Stick, Zero to One | Decision science is one of the strongest zones in the curriculum. Annie Duke's Thinking in Bets and Cynefin together give the decision record schema its rationale-reversibility-uncertainty framing. |
| assumptions (v1.10.3) | Frameworks: Hypothesis-Driven Problem Solving, Well-Defined Problem, Wicked Problem Detection, Beautiful Questions Bias Detection, PWS-Bias Devils Advocate, PWS Triple Validation Compass, Red Teaming. Books: The Lean Startup, Four Steps to the Epiphany, The Mom Test, Bulletproof Problem Solving. Node: Assumption label (100 entries) | This is where the Brain is deepest. The Lean Startup's build-measure-learn loop is the canonical home for assumption validity tracking. |
| problem-definition | Frameworks: Beautiful Question Framework, Problem Definition Transformation, Well-Defined Problem, Wicked Problem Detection, Cynefin. Books: A More Beautiful Question, Rittel Dilemmas (in curriculum), The Structure of Ill-Structured Problems | Canonical PWS starting zone. |
| problem-definition/wickedness | Frameworks: Wicked Problem Detection. Books: Rittel Dilemmas, Redesigning the Future (Ackoff) | Rittel is in the curriculum by title. |
| solution-design | Frameworks: Four Lenses of Innovation, Design Thinking, Dominant Designs, SAPPhIRE, TRIZ, Cynefin-Informed Sequential Innovation Discovery. Books: Innovators Dilemma, Innovators Solution, Four Lenses of Innovation, The Medici Effect, Art of Innovation | Canonical zone. |
| value-proposition | Framework: PWS Value Proposition Model. Book: PWS Value Proposition Model (Aronhime + Sagir) | In-house. The authoritative source lives in the Brain as both a Framework node and a Book node. |
| business-model | Frameworks: Lean Canvas, Business Model Generation. Books: Business Model Generation, Reinvent Your Business Model, Zero to One | Canonical. |
| market-analysis | Frameworks: Trending to the Absurd, Scenario Planning, Macro Trends (via command), Dominant Designs. Books: Blue Ocean Strategy, Crossing the Chasm, Seeing Whats Next, The Art of the Long View, Scenarios Uncharted Waters Ahead (Wack), Principles of Forecasting | Strong coverage. |
| market-analysis/timing | Frameworks: Scenario Planning, Dominant Designs, Analyze Timing (S-Curve), Usher Cumulative Synthesis. Books: Principles of Forecasting, Technological Discontinuities and Dominant Designs (Anderson Tushman) | This is a research-grade zone. |
| competition | Frameworks: Reverse Salient Analysis (Hughes), Changing Terms of Competition, Competition and Entrepreneurship (Kirzner), Red Teaming. Books: Networks of Power (Hughes), Only the Paranoid Survive, Seeing Whats Next | Hughes is canonical for reverse salients. |
| team | Frameworks: Tuckman Team Stages, High-Performing Teams, Psychological Safety, 8 leadership frameworks (Transformational, Servant, Adaptive, Situational, Authentic, Distributed, Systems, Emotional Intelligence). Books: Good to Great, Creativity Inc, Mythical Man-Month, Start with Why | Rich leadership curriculum. |
| experiments | Frameworks: PWS Triple Validation Compass, Hypothesis-Driven. Books: The Lean Startup, Four Steps to the Epiphany, Thinking in Bets (Resulting) | Canonical. |
| research-documents | Tools: Bulletproof Problem Solving. Books: Bulletproof Problem Solving, The Art of the Long View | Partial. Research as method lives in the command layer more than the book layer. |
| meetings | N/A - meetings are the source, not the framework. Related books: Creativity Inc (Notes Day, Dailies) | The meeting filing pipeline is infrastructure, not curriculum. |
| legal-ip | Frameworks: Legal Due Diligence Framework, IP Due Diligence Framework | In-house PWS frameworks. |
| financial-model | Framework: Financial Due Diligence Framework | In-house but thin on tactical runway and unit-economics tooling. |
| fundraising | None direct. Adjacent: Crossing the Chasm (positioning). No dedicated fundraising framework in the Brain | Curriculum gap. Enrichment TODO. |

### D.3 Overall coverage assessment

The PWS curriculum is dense for **problem-definition, solution-design, value-proposition, business-model, market-analysis, competition, decisions, assumptions, experiments, and team/leadership**. These are the ten strong zones. v1.10.3 lands squarely in the strong zones (decisions, assumptions, plus stakeholder-analysis which is partial).

The PWS curriculum is thin for **stakeholder-analysis-as-method (vs stakeholders-as-actors), trust graphs, pricing, unit economics, TAM SAM SOM, runway tactics, and fundraising playbooks**. These are the curriculum enrichment TODOs that pair with the Brain enrichment TODOs from Appendix C.7. The Brain and the curriculum have the same gaps, which is a consistency signal - the missing areas are genuinely missing, not a schema mismatch.

---

## Appendix E: MINTO + Feynman + Memory integration wiring

This appendix is the implementation contract for the three-level hierarchy against the existing MindrianOS machinery. Names files, functions, and fields. No hand-waving.

### E.1 For a new SECTION (Tier 0 or Tier 1)

**Discovery by `lib/vault/room-scanner.cjs`:**

The current `KNOWN_SECTIONS` is a flat `Set<string>`. For v1.10.3 it expands to 14 strings (14 = 11 + 3 new seed sections). For v1.10.4+ it migrates to a loaded structure:

```js
// lib/scaffold/loader.cjs
function loadSectionManifest() {
  // Merges tier-0.json + stage-matched tier-1 + type-matched tier-2
  // Returns: Map<sectionName, {tier, collections: [], template, description}>
}
function getKnownSectionNames() {
  return new Set([...loadSectionManifest().keys()]);
}
```

`room-scanner.cjs` imports `loader.cjs` and replaces the hardcoded `KNOWN_SECTIONS` constant with a call to `getKnownSectionNames()`. Backwards compatibility: `KNOWN_SECTIONS` remains exported for any consumer that imports it directly (checked via grep - used in the scanner only).

**Walking by `scripts/vault-section-minto-generator.cjs`:**

The `--plan` subcommand takes a section path and emits JSON with artifacts list. For v1.10.3 it walks the three new sections flat (no collections). For v1.10.4+ it gains a `--depth collection` flag that walks section -> collection -> artifact. The JSON payload gains a `collections: [{name, artifacts: [...]}]` field. The `--write` subcommand consumes the new payload shape and emits per-collection MINTO.md files plus a rollup.

New function signatures:

```js
// scripts/vault-section-minto-generator.cjs
function planSectionFlat(sectionPath) { ... }          // v1.10.3
function planSectionWithCollections(sectionPath) { ... } // v1.10.4
function writeMintoFromNarrative(sectionPath, narrativeJson) { ... }
function writeMintoRollup(sectionPath, collectionMintos) { ... } // v1.10.4
```

**Orchestration by `commands/mos-reason.md`:**

The Feynman-MINTO orchestrator in `commands/mos-reason.md` receives a new optional argument `--include-new-sections`. Default behavior: walks only the 11 existing KNOWN_SECTIONS to avoid regression. With the flag, also walks the three new seed sections. This preserves byte-identical output on unmigrated rooms. For v1.10.4+, the flag default flips to true.

**Gap detection by `room-proactive` skill:**

`skills/room-proactive/SKILL.md` today surfaces gaps and contradictions. Extend to run the scaffold gap audit (pass 1 section 5.4). New helper: `scripts/scaffold-gap-audit.cjs` (deferred to v1.10.5) reads `loader.cjs` for the expected set and compares against `scanRoom().sections`. Missing Tier 0 sections are ranked by Hughes reverse-salient weight and surfaced on session-start. For v1.10.3, the room-proactive skill is unchanged - the gap audit is not yet wired.

**Memory persistence by SQLite foundation (Phase 77) and memory-layer (Phase 78):**

Cross-session state for a new section lives in the existing `.mos/memory.db` SQLite foundation from Phase 77. Schema extension for v1.10.3:

```sql
-- additive, no existing table changes
CREATE TABLE IF NOT EXISTS scaffold_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'materialize' | 'hide' | 'rename'
  section TEXT NOT NULL,
  collection TEXT,                -- NULL for section-level
  user_reason TEXT,
  surface TEXT NOT NULL           -- 'cli' | 'desktop' | 'cowork'
);

CREATE TABLE IF NOT EXISTS voice_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  command TEXT NOT NULL,         -- 'ask-cofounder' | 'surface-on-entry'
  question TEXT,
  answer_summary TEXT,
  artifacts_cited TEXT,           -- JSON array
  confidence INTEGER,             -- 1-10 Tetlock scale
  contradictions_flagged TEXT     -- JSON array
);
```

v1.10.3 creates these tables via migration. Writes to `scaffold_log` happen inside the materialize verb. Writes to `voice_log` are deferred until the real synthesis voice ships (v1.13.0). The tables exist in v1.10.3 as schema reservations so later releases can write into them without a migration.

### E.2 For a new COLLECTION (nested inside a section, v1.10.4+)

**Folder structure:**

```
room/
  stakeholder-analysis/
    ROOM.md                       -- section identity (Decision 15)
    MINTO.md                      -- section rollup from collection MINTOs
    stakeholders/                 -- collection
      ROOM.md                     -- collection identity (Decision 15)
      MINTO.md                    -- collection-level MINTO
      alice-johnson/              -- artifact folder (Decision 16)
        alice-johnson.md          -- artifact content
        interview-2026-03.pdf     -- attachment
      bob-chen/
        bob-chen.md
    influence-interest-map/
      ROOM.md
      MINTO.md
      grid-v1/
        grid-v1.md
```

**Hierarchical MINTO:**

The collection MINTO.md aggregates artifacts inside that collection. The section MINTO.md aggregates all collection MINTOs plus any direct-section-level artifacts filed in a synthetic `_root/` pseudo-collection. This preserves backwards compatibility: a section with no collections has one `_root/` collection and the section MINTO.md is identical to the v1.10.2 output.

The Feynman-MINTO generator gains a two-pass behavior:
1. Pass 1: run per-collection Feynman stages (essence, plain language, mental model, governing thought) and emit `<collection>/MINTO.md`
2. Pass 2: run section-level Feynman stages over the collection governing thoughts (not over raw artifacts), emit `<section>/MINTO.md`

The narrative-schema validator in `lib/memory/narrative-schema.cjs` gains a `level` field (`"collection"` or `"section"`) and validates the appropriate schema shape for each.

**Scanner collection recognition:**

A collection is a directory inside a section directory that is **not** an artifact folder. Disambiguation rule: an artifact folder contains a markdown file with the same slug as the folder (per Decision 16: `alice-johnson/alice-johnson.md`). A collection folder contains a `ROOM.md` and zero or more artifact folders. The scanner check:

```js
function isCollection(dir) {
  const hasOwnRoomMd = fs.existsSync(path.join(dir, 'ROOM.md'));
  const selfSlugFile = path.join(dir, path.basename(dir) + '.md');
  const isArtifact = fs.existsSync(selfSlugFile);
  return hasOwnRoomMd && !isArtifact;
}
```

Alternative for robustness: a collection's ROOM.md frontmatter carries `type: collection`. The scanner reads the frontmatter to disambiguate. v1.10.4 ships both checks as a belt-and-braces guard.

### E.3 Memory chain specifics

**Cross-session memory of decisions:**

Lives in the SQLite `decisions` table (new schema for v1.10.3):

```sql
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,             -- slug
  room TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  reversibility TEXT,              -- 'reversible' | 'irreversible' | 'costly'
  witnesses TEXT,                  -- JSON array
  date TEXT,
  pressure_context TEXT,
  status TEXT,                     -- 'active' | 'reversed' | 'pending'
  artifact_path TEXT               -- pointer to room/decisions/<id>/<id>.md
);
```

The table mirrors the markdown file frontmatter. The file is the source of truth; the table is a queryable index rebuilt on every scan. Scanner emits a `decisions` field in `scanRoom()` output populated from the table.

**Cross-session memory of unresolved tensions:**

Lives in an existing `tensions` table (Phase 78 memory-layer) or a new one if Phase 78 has not landed:

```sql
CREATE TABLE IF NOT EXISTS held_contradictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source_artifact TEXT,
  target_artifact TEXT,
  tension_summary TEXT,
  status TEXT,                     -- 'open' | 'resolved' | 'parked'
  resolved_at TEXT
);
```

The synthesis voice, when it ships, reads `WHERE status = 'open'` before every answer. v1.10.3 reserves this schema without writing to it.

**Voice-log schema (reserved for v1.13.0):**

Already defined in E.1 above. v1.10.3 creates the table.

**Assumption tracking (Phase 78 integration):**

Phase 78 defined an `assumptions` SQLite table for memory-layer-assumptions. v1.10.3 promotes `assumptions/` to a section, which writes markdown files. The SQLite index follows the same scan-and-rebuild pattern as decisions:

```sql
CREATE TABLE IF NOT EXISTS assumptions (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  assumption TEXT NOT NULL,
  status TEXT,                     -- 'active' | 'invalidated' | 'untested'
  evidence_refs TEXT,              -- JSON array of artifact paths
  last_verified TEXT,
  decays_on TEXT,                  -- optional ISO date
  artifact_path TEXT
);
```

This harmonizes with the Phase 78 work: the table name, primary key, and core fields are compatible. If Phase 78 has already shipped a different schema, v1.10.3 aligns to it rather than duplicating.

### E.4 Backwards compatibility

**Existing v1.10.2 rooms opened by v1.10.3+ client:**

- The scanner finds 11 KNOWN_SECTIONS plus any of the three new ones that happen to exist (unlikely in a v1.10.2 room). No auto-migration. No prompt. The room is indistinguishable from v1.10.2 at the filesystem level.
- `/mos:reason` produces byte-identical MINTO.md for the 11 existing sections (regression test enforces this).
- The SQLite schema migration adds the new tables but does not populate them. Existing tables are untouched.
- Larry's session-start greeting does not mention the new sections unless they exist. No clutter for unmigrated users.
- The only visible change: `/mos:organize --materialize-section` is available as a new verb. Users who ignore it see no difference.

**v1.10.3 rooms opened by an older client (v1.10.2 and earlier):**

- The older scanner does not know about `stakeholder-analysis`, `decisions`, or `assumptions` as sections. It reads them as generic directories under the room root, which means they are **not** included in the section walk but their content is still visible to a user browsing the filesystem.
- The older `/mos:reason` does not generate MINTO.md for them. The MINTO.md files written by v1.10.3+ inside those sections are orphaned on the older client.
- The SQLite tables created by v1.10.3 are ignored by the older client (it never reads them).
- The user experience on an older client: graceful degradation. Nothing breaks. The new sections are just folders.
- No warning is shown. This is consistent with the plugin's additive philosophy - a user who downgrades sees fewer features, not errors.

**Rename handling:**

v1.10.3 does NOT rename any section. `competitive-analysis` stays. The rename to `competition` defers to v1.10.4 or later, at which point the implementation is an alias: both names scan to the same section.

### E.5 Tri-polar check for the memory chain

- **CLI.** SQLite lives in `.mos/memory.db`. Hook scripts read/write directly. All CLI-side. Works today.
- **Desktop.** Desktop has filesystem access via MCP tools in v3.0, which means `.mos/memory.db` will be readable. For v1.10.3 (pre-v3.0 MCP), Desktop interactions do not directly read the SQLite DB; they rely on Larry's context window and the filesystem ROOM.md + MINTO.md files. The SQLite tables are a CLI-side convenience until MCP tools expose them.
- **Cowork.** Shared filesystem means shared `.mos/memory.db`. SQLite's single-writer model requires care: concurrent materializations must serialize. The materialize verb uses `BEGIN IMMEDIATE TRANSACTION` to force serialization. This is standard SQLite concurrency handling, well understood.

---

## Closing note

This appendix is an extension of `smart-notebook-cofounder.md`, not a replacement. Pass 1 remains the substrate. Pass 2 grounds it in real machinery, real Brain queries, and a real v1.10.3 scope cut. The next Claude session picking this up should read pass 1 for the conceptual frame and this appendix for the implementation contract.

The hardest thing in this appendix is Appendix A's decision to ship something this small in a patch release. That decision is not a retreat from pass 1's vision. It is a commitment to ship the seed under the constraint the user imposed, so that the full vision can grow on a foundation that is already in users' hands. The Feynman-MINTO hybrid that shipped as v1.10.2 is the template: land the right mechanism under a modest version number, then grow the surface area one release at a time. v1.10.3 is the same move for the smart notebook.
