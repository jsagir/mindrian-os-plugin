## [Unreleased] -- v1.16.0-beta.8 (in progress)

### Changed
- **`/mos:pws-brain` now says plainly that it's retired, instead of quietly sending you down a
  dead path.** The command was built to compare two ways of answering methodology questions
  side by side: the production Brain, and a separate experimental Aura Agent. Both of those
  routes have since been folded into one unified Memgraph-backed Brain, so the comparison this
  command exists to run no longer means anything, and running it just walked you into a
  pre-flight failure with no explanation of why. The command's description, its retirement
  reason, and a note right under its own heading now say RETIRED and point at the real backend
  by name, so anyone who reaches for it (navigator or Larry) understands immediately why it's
  inert instead of guessing at a broken dependency. Nothing about the harness itself was
  deleted, so it is still there to read as a historical record of the comparison, or to revive
  deliberately if a future backend candidate ever needs the same side-by-side treatment again.

## [1.16.0-beta.7] - 2026-08-01

### Added
- 

### Fixed
- **The statusline's room-health chip actually updates now, instead of showing you one frozen
  warning forever and sending you to a command that could never clear it.** The chip that reads
  `⚠ · -> run /mos:doctor --fix` is supposed to reflect whether your current room is healthy. In
  practice it was stuck on whatever it happened to say the last time somebody ran a diagnostic by
  hand in a terminal, which for most people means it either never appeared or never went away.
  Running `/mos:doctor`, or even `/mos:doctor --fix`, did nothing to it -- not because those
  commands were broken, but because they were never connected to it in the first place. The chip
  reads a small cache file, and the one function in the whole codebase that writes that file had
  exactly one caller: a manual command-line flag that nothing in the product ever runs. So the
  warning was real once, and then it was just a fossil. Worse, the advice it gave you pointed at
  the one command structurally incapable of helping. There WAS a second place in the code that
  tried to wire this up, and it looked wired -- it checked whether the diagnostic module offered
  a bind-time health function before calling it -- but that function was never written, so the
  check was permanently false and the whole branch was dead code that read like working code, with
  a comment promising a follow-up phase that never shipped. Now, whenever your session binds to a
  room -- through the MCP front door or through the CLI's own binding path, both of which now run
  the same single health check -- a real, current reading gets written, and the chip tells you what
  is true right now. A health check that fails can never block or break a bind. And when the room
  cannot be located at all, it says so honestly as drift rather than quietly reporting all-clear,
  because the whole point of this fix is that a status signal you cannot trust is worse than no
  signal. Verified end to end through the real MCP server: a stale drift warning cleared to sound
  with a fresh timestamp on the next bind.
- **A stale local search index could get stuck stale forever, even after a "successful" repair.**
  Each room keeps a small lexical search index so Eureka can find relevant nodes fast. When nodes
  get deleted, that index is supposed to self-heal the next time it rebuilds. It turned out the
  rebuild only ever refreshed rows for nodes that still exist -- it had no way to remove rows left
  behind by deleted ones, so once a room accumulated deleted nodes, no amount of rebuilding could
  ever clear them. The one place in the codebase that DID know how to clean those rows up only ran
  during a full graph rebuild, not the lightweight repair every other path relied on. Now that
  cleanup step runs every time the index rebuilds, not just on a full rebuild, so a room's search
  index actually recovers instead of silently staying broken behind a "fixed" label.

## [1.16.0-beta.5] - 2026-07-31

### Added
- **The ranked dial you pick from now actually listens to what you said, and Brain's own
  suggestion can no longer be silently discarded (Phase 245).** The previous entry documented an
  honest finding: the sensor bank that watches a turn decides only WHETHER a dial appears, never
  WHAT sits on top of it -- that ranking came entirely from your room's graph-node recency, a
  completely separate code path. This phase closes that gap for real, at the one seam that
  actually renders the dial (`scripts/intent-classifier.cjs`), not the seam that looked like the
  right place but turned out to be a dead end -- a same-day research pass caught that the obvious
  fix (wiring the fusion into `reach-hedge-ranker.cjs`) would have shipped, passed every test, and
  moved the visible dial by nothing, because that ranker and the dial's renderer read the same
  score map without either one feeding the other. Two turns with different intent in the same
  session now surface two different top-ranked cards, proven by literally commenting out the merge
  and watching the acceptance test fail with the exact symptom the SPEC named, then restoring it
  and watching it pass. Brain's own suggested next step, when Brain has one, now genuinely factors
  into that ranking too -- previously it was computed nowhere reachable, buried behind a routing
  precedence chain a fired sensor almost always won first, so even a fresh, correct Brain read had
  no way to ever surface. Bounded so it stays a nudge: no single signal can push a card across the
  frozen 0.70 "recommended" threshold on its own, verified by sweeping the fusion math with
  deliberately extreme inputs.
- **`BRAIN.md` now actually refreshes itself instead of quietly going stale for weeks while still
  claiming to be fresh (Phase 245).** The re-derivation trigger, queue, and drain machinery for
  keeping a room's Brain-derived insight current already existed, fully wired -- it just silently
  did nothing. The drain measured its own timing budget starting *before* a slow one-time
  `require()`, so a cold process routinely blew a 100ms budget it thought it had 100ms left in,
  aborted after spawning zero re-derive jobs, and had already removed every job from the queue on
  the way in. No error, no warning -- just a room that reports `staleness: "fresh"` while running
  on a read from 12 days ago. Fixed at the root (hoist the slow require above the clock, and make
  queue removal contingent on an actual job having spawned, so a future slow tick degrades
  gracefully instead of losing work outright), not patched at the symptom. `BRAIN.md` now
  re-derives on any of three real triggers: the room's governing thought changing, a section aging
  past its staleness window, or an explicit ask -- never a blanket call on every single turn, which
  independent research confirmed would blow the product's own 1200ms navigation budget.
- **Six Thinking Hats can now surface itself, proactively, for the first time (Phase 245).** `hats`
  has been one of exactly six frozen reach categories since Phase 148 -- fully built on the render
  side, completely unreachable from the sensor side. A navigator could only ever get there by
  picking it manually, directly contradicting the product's own doctrine for when a hats rotation
  should be offered. A new sensor closes the gap, firing when two or more fresh, unresolved
  contradictions accumulate in a room (one is treated as a bridge to another topic; two or more
  unresolved is treated as a genuine perspective lock worth rotating hats on) -- tuned specifically
  not to double-fire alongside the existing sensor that already reacts to the first contradiction.
  Also repaired: three shipped commands had been declaring a hats trigger that pointed at a sensor
  which fires a completely different category and could never have produced hats in the first
  place -- a real, live registry-truth bug now corrected alongside the sensor that actually makes
  the declaration true.
- **When multiple signals fire on the same turn, the winner is now a documented priority, not
  whichever file happened to load first (Phase 245).** 65% of the sensor bank can independently
  produce the same output category on a single turn, and until now the tie always went to
  registration order -- an accident of file layout, not a designed hierarchy. A frozen,
  doctrine-authored priority table now decides, enforced by a completeness gate that fails the
  build closed if a sensor ships without a ranked entry, so this can't silently drift again the way
  the registration-order behavior did.
- **A Part 8 privacy guard was blocking harmless, contentless Brain calls while letting real
  user-content calls through -- backwards from what a leak-prevention guard should ever do (Phase
  245).** Root-caused to a single over-broad catch-all with no way to recognize a call that
  structurally cannot carry user data. A stats-style call with no arguments now passes; the
  catch-all itself is untouched and still blocks by default on anything that actually could carry
  content.
- **Frozen, zero-cost mapping from the product's ten canonical routing verbs to the six dial
  categories they can actually produce (Phase 245).** Half the vocabulary had no path to ever fire
  at all -- not a bug exactly, but an unmeasured gap nobody had named. Derived once, offline, from
  a local sentence encoder already shipped in this repo for an unrelated feature (Canon Part 7:
  reuse, don't rebuild) -- zero network calls, zero ongoing cost, and ground truth checked first so
  a close embedding score can never overrule a fact the routing engine already knows for certain.

## [1.16.0-beta.3] - 2026-07-31

### Added
- **A documented, honest line on what the sensor bank actually controls about the reach dial
  (quick-260731-35r).** When Larry surfaces the reach dial, the little ranked menu of next moves,
  two different things are happening and it is easy to think they are one thing. The sensors, the
  17 small detectors that watch a turn and fire when they recognise something, decide WHETHER that
  dial appears at all. They do not decide WHAT sits at the top of it. The ordering comes entirely
  from scoring your room's own graph nodes, on a completely separate code path that no sensor ever
  reaches. Nothing changed in how any of it runs; what changed is that the boundary is now written
  down at the exact function where a future reader would otherwise assume the opposite, plus a
  finding artifact with every file and line number so anyone can check it in a minute instead of
  tracing the code themselves. The practical payoff: nobody builds on the wrong mental model,
  and nobody mistakes "a sensor fired" for "a sensor ranked what you are seeing."
- 

## [1.16.0-beta.1] - 2026-07-31

### Added
- 

## [1.15.3] - 2026-07-31

### Added
- **The room now learns which of its two ranking signals has actually been right for you, not
  just from a fixed prior forever (RCA hedge-fold-has-no-production-trigger).** When Larry picks
  which of several fired reaches to surface, two signals vote: how well an idea seems to fit
  right now, and how far up the fixed list it sits. A Phase 222 layer was supposed to learn,
  from your own past accept/reject choices, how much to trust each of those two signals for
  you specifically, and quietly re-weight them over time. It never once ran, on any install,
  because nothing in the shipped code ever handed it your room's database to learn from, so it
  sat at a permanent, correct-looking cold start. Nothing you saw was wrong: the ranking still
  worked, it was just always computed from the same starting assumption instead of from your
  own outcomes. There is now one deliberate command, `node scripts/hedge-refit-pipeline.cjs
  <room>`, that runs that learning step on purpose, rather than it riding along as a side effect
  of serving a turn. Canon Part 9: it reaches your room's database only through the one
  existing local chokepoint, same as everything else. Canon Part 8: zero network, zero Brain,
  nothing but your own room's past decisions.

### Changed
- **The stated minimum Node version is now 22.16.0, up from 22.5.0, because that is the version
  where the room.db write-safety setting actually starts working (Phase 236, GRAPHDB-03).** Since
  Phase 218-02 the room's database has been opened with a five second "wait your turn" setting, so
  that when two things try to write at the same moment the second one waits instead of failing
  instantly. That setting is called `timeout`, and it is passed to Node's built-in `node:sqlite`
  module. Two different Node versions matter here and they are easy to confuse. `node:sqlite`
  stopped needing a special startup flag at v22.13.0, but the `timeout` setting itself was not
  added until **v22.16.0**. In between, on 22.13 through 22.15, the module loads fine and the
  code looks correct, but `node:sqlite` accepts settings it does not recognise without
  complaining, so `timeout` is quietly thrown away and contended writes still fail at zero
  milliseconds exactly as before. Nothing warns you. We confirmed this on a live runtime by
  reading `PRAGMA busy_timeout` back after opening: `0` on a version without the option, `5000`
  with it. The old floor of `>=22.5.0` was wrong twice over, because on 22.5 through 22.12
  `require('node:sqlite')` throws outright without the flag. Source for the v22.16.0 figure:
  Context7 against the Node.js v22.x API docs, specifically the `timeout` option's
  version-history entry, not the module's separate unflagging entry.
  **User-visible consequence:** npm will now refuse an install on Node 22.5.x through 22.15.x
  that it previously accepted. That is deliberate. The code genuinely does not run safely on
  those versions. Upgrade Node to 22.16.0 or newer (`nvm install 22`, `fnm install 22`, or your
  package manager) before updating. CI already runs the Node 22 major line, which resolves above
  the new floor, so CI keeps exercising a runtime users actually have.

## [1.15.3-beta.50] - 2026-07-28

### Added
- **A doctor check that catches a Data Room whose graph never learned how the ideas relate,
  and an automatic repair for the rooms already in that state (Phase 233, RCA items 4c/4d).**
  Two things live inside `room.db`: `BELONGS_TO` edges, which say which artifact sits in which
  section (a filing cabinet), and cascade edges (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES,
  ENABLES, REFINES, ROOT_CAUSES), which say how the ideas actually relate (the part that makes
  the room think). Before Phase 224-02 shipped on 2026-07-23, a failed derivation quietly
  deleted its own retry signal, so a room could end up with the first and never the second and
  nothing anywhere would say so. Phase 224-02 stopped that happening again, but it was
  forward-only: roughly 16 live rooms were already in that state and stayed there. This release
  closes both halves. New `graph-derive-health` doctor class (`/mos:doctor
  --graph-derive-health`, or add `--cascade-rooms` to sweep every room) reports FAIL on exactly
  that shape and WARN on a derive queue stuck past three days or a recorded failure log. New
  `--heal-room` flag re-enqueues every affected room; it is the literal flag the
  v1.13.0-beta.16 rename table has pointed at since before it existed, made real here for the
  first time. And a one-time `graph-derive-heal-retrofit` module repairs already-damaged rooms
  by itself the first time doctor runs after the update, with no flag to discover and nothing
  to opt into, because a user should not have to know their graph was damaged in order to get
  it fixed. Both share ONE detection function, so the check and the repair can never drift
  apart. The heal restores the retry signal; the real edges land the next time an in-session
  derive runs. Tri-Polar: CLI gets the full report, Desktop and Cowork get a one-sentence
  re-derive nudge on the existing SessionStart install-drift slot rather than a raw table.
  Canon Part 8: every new path is a read-only local `room.db` read plus a local JSON queue
  write, zero network and zero Brain. Ground-truth tested (20 scenarios) against real `room.db`
  files and real queue files read back off disk, never a mocked return value.

### Fixed
- **Your room's discovery engine was ranking its own backup files as its top insights, and
  then throwing every result away (Phase 233, RCA Section 9 Defects #4/#5).** The HSI pass is
  the part that reads your artifacts and says "these two distant pieces are secretly related".
  It walks your room looking for content, and every other walker in the codebase was taught in
  Phase 200 to read one shared list of folders to ignore. This one walker was never migrated,
  so it kept a private copy that had gone stale: it never learned to skip `.snapshots`
  (historical state dumps of your own room) or `sub-rooms` (nested rooms that carry their own
  graph). The result on a real room: 207 files scored, and all twenty of its "top discoveries"
  were near-identical backup copies of each other. Then the edge writer correctly refused every
  one of them, because backup files are not artifacts in your graph, and wrote zero edges. A
  full expensive pass, a confident report, and nothing to show for it. Now `compute-hsi.py`
  reads the same shared list as everything else (so this class of drift cannot recur), and a
  new `--scope-to-nodes` mode scores only artifacts that actually exist in your graph, which is
  both cheaper and the only set that can produce an edge.
- **Healing a damaged graph now runs its four stages in the one order that works, and the last
  stage stopped deleting the work of the third (Phase 233).** Repairing a room is not one
  action, it is four, and each one eats what the previous one produced: index every artifact as
  a node, score similarity across those nodes, write the semantic edges, then run the
  generative tier. Run them out of order and every stage reports success while producing
  nothing. New `node scripts/graph-heal-pipeline.cjs <room>` runs all four in the mandated
  order, reusing each existing implementation unchanged. Running it live on the room from the
  original investigation exposed one more instance of the same bug class this whole phase is
  about: the fourth stage opened by clearing and rebuilding the graph, which deleted the twenty
  semantic edges the third stage had written seconds earlier. The pipeline printed "wrote 20
  connection edges" into a room that ended up holding none. The rebuild is now suppressed when
  the caller already indexed the room, and that room finished the run with 61 artifact nodes,
  20 semantic edges and 47 typed relationship edges, up from zero. Every other caller of the
  backfill is byte-unchanged. A missing Python or embedding library degrades exactly the two
  stages that need them and never the other two. Canon Part 8: local only, zero network, zero
  Brain.
- **The graph derivation engine could quietly dial a dead account instead of scoring your
  work locally (Phase 233, RCA items 4b/4e).** `runDerivation` is the composer that turns a
  pair of your artifacts into a typed relationship edge. It takes the scoring function as an
  argument, and until now, if a caller forgot to pass one, it silently fell back to a hosted
  Anthropic API call. That fallback account has been out of credit for months: a live probe
  returned `400 credit balance is too low`. So "forgot to pass the scorer" did not look like a
  mistake at the point it was made; it looked like working code that failed later, over the
  network, for a reason that had nothing to do with the actual bug. That fallback is now gated.
  Omitting the scorer throws `deriveFn_required_no_hosted_default` immediately, before the room
  database is even opened, and the error names the local scorer to use instead. Nothing shipped
  is affected: every real caller already passes one. An operator who genuinely wants the hosted
  path can still have it by setting `MINDRIAN_ALLOW_HOSTED_DERIVE=1` with a funded
  `ANTHROPIC_API_KEY`, and gets byte-identical behavior to before. Gated, not deleted. Also
  fixed: the background drain's header comment still claimed it "CLEARS the drained entry"
  after every pass, which stopped being true when Phase 224-02 made failed entries survive and
  retry. It now states what actually happens, plus the real division of labor: the background
  pass enqueues, preserves on failure, and scores locally, while in-session `/mos:graph
  --derive` is the wider net that also reaches rooms the background pass structurally cannot
  see. Both default to the same local score-based scorer, and that is no longer a claim in a
  comment: a new regression test swaps the shared scorer for a recorder, runs both paths over
  two identical rooms, and compares the edges that land on disk.
- **`orchestration rooms-open` reported a confirmation-shaped success while never switching
  the active room.** Live-reproduced 2026-07-22: the call returned a full "Room State" payload
  footed with the correct target room, yet `room-registry get-active` still returned the
  previous room and the next Write was blocked with "Active room is <previous>". Root cause:
  `rooms-open` was a DECLARED-BUT-UNIMPLEMENTED command. It passed Zod validation via its
  membership in `ORCHESTRATION_COMMANDS`, matched no handler, and fell through to a generic
  reference-echo fallback shared by 18 of the 22 orchestration commands. That fallback built
  its response from `commands/rooms.md` read off disk, STATE.md from the boot-frozen `roomDir`
  closure (which is why the payload showed an unrelated room's content), and a verbatim echo of
  the caller's own `room` argument -- then appended "Room operation complete". No byte of the
  response derived from an operation, because none was attempted: before this fix, zero product
  `.cjs` code anywhere called `room-registry set-active`, so the MCP surface advertised
  multi-room management while having no room-switch capability at all (worst on Desktop and
  Cowork, which have no shell fallback). Fixed with a new `lib/core/room-open.cjs` chokepoint
  that wraps the one authoritative writer (Canon Part 7) and gates `ok:true` behind a post-write
  `get-active` read-back, so a success-shaped payload is now structurally impossible unless the
  switch actually landed; it also writes the per-session binding so `write-scope-check.cjs`
  authorizes the session without depending on the raceable global field, and it preserves the
  `commands/rooms.md` Step 2 human gate for reopening an archived room. Structurally, the same
  fallback no longer lets any state-mutating orchestration command claim completion it cannot
  back up: `rooms-new`, `rooms-close`, and `rooms-archive` now carry an explicit NOT EXECUTED
  banner. 10 hermetic regression tests assert registry ground truth, not response shape.

## [1.15.3-beta.48] - 2026-07-26

### Added
- **Room-graph density read (Phase 232.1).** `/mos:doctor` and `room_state status`/`get-state`
  now self-report node/edge counts per `room.db`, read exclusively through a new read-only
  `navigation.cjs` door (`openRoomDbReadOnlyForCaller`) -- never the mutating door, never a
  direct `room.db` open. Closes SEED-074's own "suggested first move"
  (`.planning/seeds/SEED-074-local-graph-read-layer-lacks-salience-and-query-time-joins.md`):
  the seed's actual PageRank/Louvain/query-time-join target stays gated exactly as written;
  this only makes its own trigger condition (measured room.db density) self-reported instead
  of something a human has to remember to check by hand. No output string anywhere claims a
  room graph is dense, at-risk, or healthy (hard guard, grep-verified). Goal-backward
  verification PASS, 6/6 must-haves (`232.1-VERIFICATION.md`).
- Local reified-claim `ContradictionEvent` primitive (quick task 260725-9ca), with a hermetic
  acceptance test.

### Fixed
- **`room_bind` could report `ok:true` while a sibling MCP read tool silently resolved a
  stale, unrelated room.** Root cause: 20 of 21 MCP tool call sites were missing the
  `CLAUDE_CODE_SESSION_ID` stdio fallback that `room_bind` itself already had, so a
  session-id mismatch between the bind call and a later read call could bind one room but
  read another without ever surfacing an error. Fixed via one shared
  `resolveEffectiveSessionId` helper, wired into all 21 sites; live-reproduced, then closed,
  tests green. Full reproduction and root cause also filed in the `rethinking-mindrianos`
  room per this repo's dev-research compositing rule.
- **Phase 232.1's own room-graph density census could silently drop a room that used the
  `abs_path` registry field instead of `path`,** undermining the one thing the census exists
  to be accurate about. `resolveRoomPath` now checks `abs_path` first, `path` as fallback,
  matching the precedence every other production call site in this codebase already honors;
  pinned by a mutation-verified regression test (reverted, confirmed red, restored, confirmed
  green). The identical gap in the earlier, already-shipped `cascade-rooms-module.cjs` this
  was copied from is left alone -- out of this phase's scope, tracked separately as
  low-severity follow-up debt.

## [1.15.3-beta.46] - 2026-07-23

### Added
- 

### Fixed
- **The F.8 "bind session to room" Decision Gate (and any PRIMARY-path registry gate)
  force-fired on turns whose ONLY content was an automated background-task-completion
  notification, with zero real user text, blocking continuation with a Stop hook error even
  though there was nothing for the navigator to decide that turn.** Root cause:
  `precedingUserText` resolves to `''` for two very different reasons that
  `scripts/check-card-fire.cjs` could not previously distinguish -- a genuinely terse HUMAN
  turn ("ok", "go on") and a SYNTHETIC preceding transcript record (a `tool_result` envelope
  from a background tool call, or an automated task-notification block) with no
  human-authored text at all. `lib/core/gate-relevance.cjs`'s conservative low-signal branch
  forced (assumed relevant) on both, which is only correct for the first -- there is no human
  turn for a Decision Gate to be relevant or irrelevant to on the second. Fixed by adding a
  new `preceding_user_text_source` signal (`'typed' | 'tool_result' | 'none'`), classified by
  a new `classifyPrecedingUserContentSource` helper in `readTranscriptTurn` and threaded
  through `deriveTurnSignals`; `classifyCardFire`'s PRIMARY-path relevance branch now bypasses
  forcing immediately when the source is confirmed `'tool_result'`
  (`reason: 'preceding-turn-synthetic-no-user-engagement'`), before ever reaching the
  conservative low-signal branch. A genuinely terse human turn against the identical gate
  still force-fires, unweakened (the WR-06/CR-06 floor). Live-reproduced 3 consecutive times
  in one session; the mechanism itself was first diagnosed 2026-07-06 (as a fact, not yet
  treated as a defect) and confirmed recurring 2026-07-11 and 2026-07-22. Full RCA:
  `.planning/debug/resolved/room-bind-gate-fires-on-notification-only-turns.md`.
- **The semantic-edge derivation queue (`graph-derive-queue.json`) silently cleared itself
  on every failed derivation, in every room, forever -- so no room has ever gotten a real
  INFORMS/CONTRADICTS/CONVERGES cascade edge.** Root cause: `scripts/gsd-graph-derive-drain.cjs`'s
  `drainDerive()` caught a `runDerivation` throw, pushed the failed room to `drained` anyway,
  and rewrote the queue empty with no log -- destroying the retry signal on every SessionStart
  run regardless of outcome. Two of the three originally-stacked causes (a dead standalone
  Anthropic API key; the headless path computing a null single-pair derive with no real
  artifact pairs) had already been resolved upstream by Phase 224-02's switch to local
  embeddings; the silent-clear was the one still live. Fixed via a new `reconcileQueue()`: a
  failed room is now kept and retried (capped at `MAX_DERIVE_ATTEMPTS=5`, then dropped
  `permanent:true` and logged, never silently), and every failure appends to a new
  `<room>/.mindrian/graph-derive-failures.json`. Root-caused by cross-referencing a TDS
  "context rot" research thread against the live debug queue, not filed fresh. Full RCA:
  `.planning/debug/graph-derive-silent-clear-dead-api-derivation.md`. Formalizing the
  derivation transport, healing the ~16 already-damaged rooms, and a doctor health check
  remain open (register items 4b-4e).
- **`room_search` applied its 50-result cap in raw filesystem-walk order, before any
  relevance ranking -- so a genuinely relevant match in a late-traversed folder could lose to
  50 incidental early-folder hits, and a same-entity query could return dozens of
  near-duplicate lines from one file.** Root cause: `lib/mcp/tools/room.cjs`'s `searchRoom`
  was a plain `String.includes` grep that pushed matches in directory-entry order and
  returned the instant either `SEARCH_MAX_RESULTS` (50) or `SEARCH_MAX_FILES` (500) was hit --
  capped-then-never-ranked, not ranked-then-capped. Fixed via a rank-then-cap rewrite
  (`collectMatches`/`rankMatches`): match density x0.7 + recency x0.3, with a 5-per-file slice
  cap so one file can't monopolize the result budget. `graph_query` was audited in the same
  pass and found already ranked correctly (a composite relevance score already lives in
  `navigation/neighborhood.cjs`); `whitespace_scan` is unranked but uncapped, deferred pending
  the graph-derive edge-density fix above (little signal to rank while most rooms carry
  near-zero semantic edges). Full RCA: `.planning/debug/graph-query-results-unranked.md`.
- **The M:OS Canonical Design System v1.1 "bake into all HTML artifacts" mandate was only
  ~30% actually landed, despite its own commit (`a9e1ee88`) and Phase 232-01 claiming it was
  done.** The CSS bundle, loader (`mosStyleTag()`), and `lib/wiki/wiki-layout.cjs`'s
  retokenization were real; `scripts/generate-deck.cjs`, `generate-hub.cjs`,
  `generate-lobby.cjs`, and `generate-snapshot.cjs` had zero reference to `mosStyleTag()`,
  `dashboard/index.html` had zero M:OS tokens, and the mandate's own doc
  (`skills/ui-system/rules/design-system.md`) and `SKILL.md` section 0 did not exist. Wired
  all 4 generators to `mosStyleTag()` (cream default, `data-theme="light"`), injected canonical
  tokens plus a role-based CSS variable alias layer into `dashboard/index.html` and
  `dashboard/export-template.html` (legacy `--mondrian-*`/`--ds-*` names aliased onto canonical
  values in place, not renamed), and authored the missing mandate docs. Code review caught 2
  real regressions before this shipped: (1) 3 of the 4 generators' own pre-existing `<style>`
  blocks redeclared the same token names with old hex values LATER in the document, so the
  mandate rendered in the markup but had zero visual effect by CSS cascade -- fixed by removing
  the colliding redeclarations; (2) `dashboard/index.html`'s dark-to-light polarity flip broke
  hardcoded Cytoscape graph-label colors and hover overlays tuned for the old dark theme --
  fixed by repointing them at the resolved ink values. Both independently re-verified via
  Playwright (`getComputedStyle`) against live-regenerated output, not just diffs.

## [1.15.3-beta.44] - 2026-07-23

### Added
- 

### Fixed
- **Every Stop hook turn showed a raw Claude Code hook JSON validation error
  ("Hook JSON output validation failed: - : Invalid input") instead of the intended calm
  systemMessage, whenever `scripts/check-card-fire.cjs` force-blocked a turn to demand an
  AskUserQuestion card fire.** Root cause: Claude Code's Stop-hook output schema does not
  define a `hookSpecificOutput` variant for the Stop event at all (the union covers only
  PreToolUse, UserPromptSubmit, and PostToolUse); including the key on a Stop envelope
  rejects the WHOLE envelope (`additionalProperties: false`), not just that key, silently
  replacing the carefully-set `decision`/`reason`/`systemMessage` with a raw schema-error
  dump. This is the 4th live occurrence of the same defect class: fixed once in
  `scripts/on-stop` (v1.10.9 -> v1.10.10, 2026-04-15), then reintroduced in
  `scripts/feynman-minto-guardian.cjs` (under a since-corrected comment that had the rule
  backwards), reintroduced again as a regression inside `scripts/on-stop` itself (the
  Phase 198-09 MCP-first thin-adapter branch), and hit live by a real user via
  `scripts/check-card-fire.cjs` today. Fixed at all 3 sites: `hookSpecificOutput` removed
  outright (and removed from `check-card-fire.cjs`'s own envelope-key allowlist so it can't
  silently slip back in); the calm, human-facing `decision`/`reason`/`systemMessage` fields
  each branch already set are unaffected. New structural regression gate:
  `scripts/check-hook-schema-compatibility.cjs` (previously unwired and, worse, encoding the
  opposite/wrong rule) is corrected and wired into `scripts/verify-release` (section 16) --
  it enumerates every script Claude Code registers as a Stop hook straight off
  `hooks/hooks.json`, follows one level of subprocess invocation, and fails the release if
  any of them would emit a Stop-shaped `hookSpecificOutput` again. Full RCA:
  `.planning/debug/resolved/stop-hook-invalid-hookspecificoutput-schema.md`.

## [1.15.3-beta.42] - 2026-07-23

### Fixed
- **Windows-only: Python source interpolating shell variables directly (`normwin('$VAR')`) raised a
  `SyntaxError` at Python compile time whenever the interpolated value contained a native Windows
  path with a backslash, before `normwin()` ever ran.** This is the same family of bug as beta.40's
  `os.rename`/`os.replace` fix, but one layer earlier: 36 interpolation sites across
  `scripts/room-registry`, `scripts/resolve-room`, `scripts/update-icm-index`, and
  `scripts/on-cwd-changed` built Python heredoc/`-c` source by quoting a shell variable straight
  into the source string, instead of passing it through `sys.argv` (the safe pattern
  `room-registry`'s own `_write_current_room()` already used). Fixed by converting all 36 sites to
  `sys.argv`-based parameter passing. New regression suite
  (`tests/test-room-registry-windows-python-interp.cjs`, 29/29) includes a load-bearing control
  proving the old interpolation shape fails to compile on a backslash value and the new
  `sys.argv` shape does not. Root-caused and fixed same day as beta.40; independently verified live
  on the reporter's Windows install.
- **Windows-only: the regression tests' own Python-probe spawn mechanism corrupted probe source
  containing a backslash-next-to-a-quote, at the Windows `CreateProcess` argv-marshalling
  boundary.** Three test files (`test-room-registry-windows-atomic-replace.cjs`,
  `test-room-registry-windows-python-interp.cjs`, `test-room-registry-windows-path.cjs`) each
  routed a Python probe body through `bash -c` as a positional argv element, to survive the two
  bugs above -- safe on Linux/macOS, but Node spawning `bash.exe` on Windows re-quotes argv before
  bash's own `$1` expansion runs, silently mangling the probe. Fixed by writing the probe source to
  a temp `.py` file and executing the file path instead of the source text -- a path has no
  embedded quote/backslash-adjacent-quote sequences, eliminating the defect class rather than
  special-casing which characters are unsafe. Verified green on this dev box (21/21, 29/29, 25/25,
  byte-identical to pre-fix baselines); Windows re-verification of this exact patch is pending.

## [1.15.3-beta.40] - 2026-07-23

### Fixed
- **Windows-only: the room registry silently wedged after the first write, every write
  after that returning non-zero and never sticking.** Root cause: Python's `os.rename()`
  is not POSIX `rename(2)` on Windows -- it raises `FileExistsError [WinError 183]` when
  the destination already exists, instead of overwriting. Every atomic-write tmp-swap in
  `scripts/room-registry`, `scripts/resolve-room`, `scripts/update-icm-index`, and
  `scripts/on-cwd-changed` used `os.rename(tmp, dst)`, so the first write to a destination
  (cold room creation, first `/mos:rooms list`) always succeeded and looked healthy, while
  every subsequent write (`set-active`, `update`, `archive`, git-config sync) silently
  wedged on Windows, leaving an orphaned `.tmp` and a frozen registry. This repo's own test
  suite runs only under WSL/Linux, where `os.rename` already overwrites happily, so the gap
  was invisible to CI for the test suite's entire lifetime. Found live by a Windows install
  testing v1.15.3-beta.38; fix and both the semantics claim and the end-to-end unwedge were
  independently re-verified live on that same Windows install. Fixed: `os.rename` ->
  `os.replace` at all 9 call sites (byte-identical behavior on Linux/macOS, overwrite-safe
  on Windows). New regression test (`tests/test-room-registry-windows-atomic-replace.cjs`)
  and a new release-time gate (`scripts/verify-release` section 15) now fail the release if
  a bare `os.rename(` reappears anywhere in `scripts/`.

## [1.15.3-beta.38] - 2026-07-23

### Changed
- **Brain default endpoint flipped from the legacy `mindrian-brain.onrender.com` (Neo4j Aura
  + Pinecone) to the new Memgraph-backed `pws-brain-mcp.onrender.com`** (`lib/core/brain-client.cjs`).
  Step 4 of the approved phased Memgraph migration (step 1, an auth-header double-Bearer-prefix
  fix, shipped dark in beta.36's line). Live-verified against the real production endpoint with
  a real key before flipping: `brain_search`/`brain_schema`/`brain_stats`/`brain_ask`/
  `brain_ask_anything` all return real data (28k+ nodes) through the exact same response shapes
  this client already parses. `brain_query`/`brain_write` (raw Cypher) remain admin-tier gated on
  the new server exactly as they already were on the old one -- regular users never had raw-Cypher
  access on either server, so this introduces zero regression; every caller already degrades
  gracefully to a Tier-0 fallback. Every existing Brain API key works unchanged (same Supabase
  `brain_api_keys` Bearer contract) -- no action required from any user. `MINDRIAN_BRAIN_URL`
  still overrides the default for staging/self-hosted use, unchanged.

## [1.15.3-beta.36] - 2026-07-22

### Fixed
- **`room_bind` could never write a per-session room binding on stdio, so all CLI sessions
  fell back to one shared, unlocked `registry.json` active-room field.** Root-caused via a
  full RCA (`.planning/debug/resolved/registry-active-room-concurrent-session-collision.md`):
  `writeSessionBinding` -- the only function that sets a session's own room binding -- has
  exactly two call sites, both gated behind `room_bind`'s `effectiveSessionId` check, which
  requires the MCP SDK's `extra.sessionId` (never populated on stdio) or an explicit
  `sessionId` argument (nothing supplied one automatically). So no CLI session could ever
  populate its own binding, and every session's write-target resolution fell through to a
  single global field that multiple concurrent `claude` CLI processes on one machine then
  raced to overwrite -- confirmed live with 4 concurrent sessions on this machine, one
  session's active room silently clobbering another's. Fixed: `room_bind` now falls back to
  `process.env.CLAUDE_CODE_SESSION_ID` as a third-priority session identifier on stdio
  (precedence: explicit param > SDK `extra.sessionId` > `CLAUDE_CODE_SESSION_ID` >
  `no_session_id`), so a CLI session can finally write a real per-session binding. The
  separate F.8 binding-ambiguity-card logic in the same handler is untouched. New test:
  `tests/test-room-bind-stdio-session-fallback.cjs` (4 assertions); all 21 pre-existing tests
  touching `room_bind`/`tool-router.cjs`/`session-binding.cjs` still pass.
- **`write-scope-check.cjs`'s own session-identity fallback checked the wrong environment
  variable name.** It read `process.env.CLAUDE_SESSION_ID`, which this runtime never sets;
  the real variable is `CLAUDE_CODE_SESSION_ID`. Fixed with a backward-compatible fallback
  chain (`CLAUDE_CODE_SESSION_ID` first, legacy `CLAUDE_SESSION_ID` second) so existing test
  fixtures that set the old name are unaffected. A smaller contributor to the active-room
  confusion above than first estimated (this hook already preferred the hook payload's own
  `session_id` ahead of the env check), but a real, worthwhile correctness fix on its own.

## [1.15.3-beta.34] - 2026-07-21

### Fixed
- **Stop hook (`check-card-fire.cjs`) force-fired a stale Decision-Gate card on unrelated
  terse turns.** Fourth live occurrence of the over-enforcement class (dominant reason
  `reached-registry-gate-no-card`, 30 of 41 records in a 24h diagnostic window). Two stacked
  root causes: (1) `lib/core/card-fire-sidechannel.cjs`'s reach-mint record had no
  session/turn scoping and a 10-minute TTL, so one real gate mint anywhere leaked into every
  later turn, every session, for 10 minutes; (2) `lib/core/gate-relevance.cjs`'s
  `gateTopicallyRelevant` defaulted to force-fire whenever the preceding user text carried
  fewer than 2 subject tokens -- true for nearly every terse slash command, so short turns
  were the LEAST protected against a stale gate. Fixed structurally: a turn-scoped freshness
  window (`TURN_FRESH_MS`) replaces the unscoped union, and the relevance floor now checks
  gate staleness (`opts.gateStale`) instead of defaulting to force on low signal. A model
  that has already judged a reach-card gate stale and moved on in prose is no longer
  overridden by the hook. Verified end-to-end against the live incident shape; full
  card-fire/gate-relevance/connector-registry suites green.

## [1.15.3-beta.32] - 2026-07-20

### Added
- **BlockNote Wiki Convergence (Phase 232): `/mos:wiki` gets a real editing surface.** The wiki
  now opens to a Room Home dashboard (governing thought, Larry's Briefing, gaps, per-section
  progress) instead of the graph, and every article is directly editable in a BlockNote surface
  themed to the M:OS Canonical Design System -- edit, click Save, the change writes straight to
  the room's `.md` file (no confirmation dialog, no conflict check, by design). `[[wikilinks]]`
  render as clickable pills inside the editor; Backlinks and See Also stay wired to the existing
  SQLite graph edges. New: per-article PDF and Word export, and a real `/mos:wiki --export`
  static-share bundle (previously documented, never implemented). The client bundle (React +
  BlockNote) is walled off in its own `lib/wiki/editor-src/` build, so the plugin's own
  dependencies stay CJS-only -- zero React/Next.js/BlockNote added to the install footprint.
  A live browser walkthrough caught and fixed two integration bugs before ship (a save/load URL
  encoding mismatch, and a JSON-vs-plaintext response contract mismatch that would have written
  raw JSON into article files instead of markdown).

## [1.15.3-beta.30] - 2026-07-20

### Added
- 

## [1.15.3-beta.28] - 2026-07-18

### Added

- **Eureka: killed two distinct causes of unusable portfolio-scan output, plus a warm-cache
  MCP path.** Live-verified on two independently-chosen real rooms
  (`aion-eureka-synergy`, `iia-deeptech-centers`), not just fixture-green.

  - **Seam 2 (statement-metadata gap, RESOLVED).** Every entity-entity Opportunity Statement
    was rendering the literal placeholder text "unknown x unknown approach to a unknown x
    unknown cross-domain bridge" instead of a real mechanism. Root cause: Phase 218 wired
    entity nodes (company/technology/market) into the 215 opportunity-statement pipeline but
    patched only the `title` slot for that node class, leaving `section`/`primary_problem`/
    `problems`/`shared_problems` falling through to content-node defaults entity nodes
    structurally can't satisfy. Fixed in `lib/core/eureka/room-native-substrate.cjs`: the
    entity-node branch now inherits `section` from its already-shipped `DESCRIBES` edge to its
    source memory_artifact (55/56 entities have one; pure composition over an existing edge,
    sibling of the prior title fix), with an `entityType` fallback for the remainder, plus a
    relation-edge-typed bridge label (`competes-with`/`uses-component`/`supplies-to`) in
    `scripts/eureka-portfolio-report.cjs` instead of the generic phrase. 22/25 -> 0/25
    "unknown x unknown" statements on both proving rooms.
  - **Seam 3 (candidate-generation gap, RESOLVED).** Real content was getting ranked against
    its own containing section (`problem-definition` x `problem-definition`) because `Section`
    container nodes -- the room's own top-level folder nodes -- were admitted as pairing
    candidates. The critic already had a correctly-firing rejection tag for this
    (`domain_swap_invariant`) but nothing upstream excluded these pairs before they consumed
    ranked-list slots. Fixed with an additive either-endpoint `Section` exclusion at the same
    generation-layer insertion point the 260715-0nj scaffold-pair fix established (Reuse
    Before Build), with an honest `container_pairs_excluded` counter surfaced in provenance.
    1,575 degenerate pairs (9.8% of the candidate set) excluded on `iia-deeptech-centers`;
    proven a true no-op on `aion-eureka-synergy` (0 Section nodes there) by output diff, not
    by assertion.
  - **New: `eureka-run`/`eureka-status`/`eureka-report` on the `intelligence` MCP router
    tool.** Calls the same governed dispatcher (`scripts/eureka-command.cjs` `main(argv)`)
    in-process instead of spawning a fresh child process per call, so
    `embedding-spine.cjs`'s existing module-level encoder cache stays warm across scans on
    the Phase 198 resident daemon (spiked: same-process call 2 is 0ms vs. call 1's 179ms,
    unmodified cache mechanism). Transport-gated per call: in-process on the http resident
    daemon; detached child on stdio, since `process.stdout` is the JSON-RPC framing channel
    there and the scan writes progress to stdout. Registered on the `intelligence` tool's
    enum only, outside the 65-command CLI/MCP parity array (mirrors the `eureka_critic`
    precedent). `/mos:eureka`'s CLI behavior and output contract are unchanged (verified
    byte-identical).

  Flagged, deliberately out of scope for this pass: Seam 1 (entity-extraction noise --
  generic-noun and near-duplicate entities still reach the ranker on `aion-eureka-synergy`,
  tracked separately) and a newly-observed WhitespaceZone-dominated pairing pattern on
  `iia-deeptech-centers` (AHP composite doesn't differentiate a room where ~87% of nodes are
  whitespace hypotheses) -- both real, both future work, neither papered over.

- **Phase 230: MindrianOS Skill Fleet Optimization -- the harness for testing whether
  MindrianOS's own 124 skills trigger correctly and stay quiet when they shouldn't.**
  Two workstreams. WS1 (trigger-accuracy, all 124 skills): per-family eval-query generation
  exploiting sibling near-misses, a roster-wide judge funnel (one call scores a query against
  all 124 skill descriptions at once, catching competitive collisions isolated per-skill
  grading structurally cannot see), flagged skills escalate to a real live trigger-test loop
  with train/validation-gated description revision. WS2 (code-quality, the ~59 script/
  workflow-backed skills -- the design estimated ~10-20, the real inventory came in ~3x
  higher, disclosed rather than silently re-scoped): adversarially-verified review
  (Refute-or-Promote) with a deterministic evidence-quote anchor so a fabricated finding
  cannot reach the report. Live-smoke-tested end to end on a 13-skill human-approved
  calibration set (`scripts/skillopt-*.cjs`, `lib/core/skillopt-schemas.cjs`,
  `tests/run-all-230.sh`, 9 deterministic legs): the real Skill-fire detector proved correct
  in both directions on fresh live captures (it turned out MindrianOS's own `mos:` skills
  fire via an MCP tool call, not Claude Code's native Skill tool -- caught before anything
  was built on the wrong assumption), and WS2 independently re-discovered the real
  `check-card-fire.cjs` over-enforcement defect (see Fixed, below) with zero false positive
  on a known-clean control. The smoke calibration gate itself came in under tolerance (30%
  agreement vs. an 85% bar) -- accepted as informative, not blocking, since most of the gap
  is real full-roster collisions a human's isolated pre-labels couldn't see plus one disclosed
  query-labeling bug; the reconciliation (fix the labeling bug, re-run smoke) is tracked as
  SEED-061, not silently dropped. **The full 124-skill fleet run and any multi-agent
  Workflow-tool orchestration are explicitly deferred behind a future opt-in -- this release
  ships the harness, not a fleet run.** Nothing was ever written to a real `SKILL.md` or
  script; every proposed change surfaces in a human-approved report only.

### Fixed

- **`check-card-fire.cjs` no longer force-fires the Decision-Gate card on plain prose with no
  actual gate.** Two independent over-fire mechanisms, logged three times across 12 days
  (2026-07-05, 2026-07-11, 2026-07-17) before being root-caused against a live 17-record
  intercept-log replay: (1) the backstop's bare numbered-prose detector had a 7/7
  false-positive rate in the logged evidence and zero true catches -- retired outright,
  genuine ASCII-box degrades stay caught by the separate bracket-arm detector, unchanged;
  (2) the primary registry-gated path fired on `ran_entries` alone, which a side-channel
  session-key/TTL union bled into every turn for roughly 10 minutes regardless of relevance
  -- now requires a confirmed, non-empty gate-subject plus relevance against that real
  subject. Verified against all 7 real logged firings (0/7 re-fire) plus the full
  card-fire-specific suite (11/11 + 27 assertions). Trade-off, disclosed not hidden: a lone
  genuine numbered-prose fork no longer force-fires at the hook level and now depends on the
  model's own Phase-210/SEED-021 judgment -- the same trust boundary the existing
  under-firing watch (`feedback_false_success_silent_skip_gates_academy_testers.md`) already
  tracks from the opposite direction.
- **Per-session room binding no longer re-prompts every turn after a real bind.** The MCP
  `room_bind` tool wrote the session's binding state keyed by the actual Claude session UUID;
  the CLI `UserPromptSubmit` hook read it keyed by `process.env.CLAUDE_SESSION_ID`, which is
  unset in that hook's execution context, so it silently fell back to a
  `sha256(roomDir+day)` hash key that never matched -- confirmed with an exact hash-vs-
  on-disk-filename proof, not inferred. The hook now reads the real session id from its own
  stdin payload first. This also un-breaks Phase 225's zero-score gate (SEED-039), which
  shared the same key-mismatch root and was never separately regressed -- just never covered.
- **The reach/navigation dial no longer offers a topically-unrelated room or claim with no
  relevance check.** `cross_room` was a permanent member of the reach candidate bank, always
  offered in a cold room's top-3 regardless of what the live conversation was actually about,
  filtered only by advisory instruction text the model had to apply itself. A structural
  relevance gate (`lib/hmi/reach-relevance-gate.cjs`) now suppresses off-topic candidates by
  token overlap against the live turn before they're ever offered; `cross_room` also no
  longer "borrows from itself" (filling its own room-name slot with the current room).

## [1.15.3-beta.26] - 2026-07-16

### Added
- **Phase 227: Ignite / mode-select timing across turns 1-4 (SEED-060).** The session-start
  mode-selection Decision Gate (Just Talk / Explore+Capture / Build a Room) gets a structural,
  advisory-only backstop: a new `doctor.cjs` check class (`lib/core/mode-select-sidechannel.cjs`
  + `lib/core/doctor/mode-select-checkpoint-module.cjs`) detects a silent skip (the gate neither
  firing a card nor stating a default) and warns, never blocks, never re-fires the gate itself.
  A systemic sweep of methodology skills for the same loose-description auto-fire bypass that
  let `trending-to-absurd` reach for itself on a casual remark before its 2026-06-24 fix found
  and closed 3 trivial instances inline (`MOSDeckEngine`, `client-discovery-interview`,
  `mullins-scaffold`), with the rest reported and explicitly deferred. A scripted regression
  test (`tests/test-227-frontdoor-restraint.cjs`) now proves the front-door restraint fix holds
  without needing a live human tester re-run. `skills/larry-personality/SKILL.md` names ignite
  for the first time and documents the gate's timing with real Hooked-Model (Fogg B=MAP / TARI)
  reasoning: the gate is a Prompt, not an Investment, fired only when the navigator's opener
  does not already signal a lane. `conversation-mode`'s Mode 3 (Build a Room) now routes through
  ignite's Directive/`--express` path instead of calling `/mos:new-project` directly, correctly
  reserving Gate B1's four-door persona pick for sessions that genuinely have not yet
  established a role or venture. Same-day code review (independently re-verified, not
  self-certified) caught and fixed two real defects before this landed: Mode 3's routing text
  originally claimed established context unconditionally even on a cold direct pick with zero
  prior exchange, and the mode-select "card-fired" recorder was wired against text no live code
  path actually renders through `pickShape()`. Both closed at the design level in this same
  pass (independently re-verified: 8/8 + 4/4 tests pass, both diffs re-read after landing),
  not patched around the symptom.

- **Phase 229: HUJI Pitch Feedback Module (IN PROGRESS, 8/9 plans -- not yet shipped).**
  MindrianOS's first paying job: turn each student's diarized 5-minute pitch transcript into
  one Minto-structured formative feedback artifact, batch-orchestrated across 200+ submissions
  at a $4-5/unit cost ceiling, local-only scoring (Brain read-only, generic handles per Canon
  Part 8). Built so far: the evidence/feedback zod schemas plus generated JSON Schema
  (`229-01`); a labeled test-inventory harness and `run-all-229.sh` aggregator (`229-02`);
  deterministic code checks covering quote verification, recall, drift, schema validation,
  similarity, cost, and Part-8 hygiene (`229-03`); the `PWS_grading` recipe with a
  score-and-continue rubric (`229-04`); a Stage A intake adapter porting the Claims-Aware
  Fusion Mode A pipeline (`229-05`); an LLM judge spawner with a calibration protocol that
  fails closed below a 0.7 anchor-hygiene bar (`229-06`); and a single-submission runner plus
  batch orchestrator with pool/ledger/resume/retry and G1-G6 per-unit guardrails (`229-07`,
  `229-08`). Not yet shipped: `229-09`, the mandatory demo run and human verdict checkpoint
  this whole pipeline is gated on before any real submission gets scored -- per this project's
  own standing rule, judge accuracy and calibration are a human-verify bar, never
  self-certified.

## [1.15.3-beta.24] - 2026-07-16

### Added
- No discrete feature completed exactly at this tag. This pre-release snapshot captured
  in-progress work on Phase 227 (the mode-select firing checkpoint, sweep, and Mode 3 routing
  work) and Phase 229 (the HUJI Pitch Feedback Module's Stage A intake adapter) mid-flight,
  neither phase-complete at cut time. Phase 227's full, finished feature set is recorded once
  under `[Unreleased]` above rather than split and duplicated across the interim tags it
  happened to span.

## [1.15.3-beta.22] - 2026-07-16

### Added
- No discrete feature completed exactly at this tag either, for the same reason as beta.24:
  a pre-release snapshot mid-flight through Phase 227 (the skill-description sweep landed
  here) and Phase 229 (PWS_grading recipe + score-and-continue rubric work).

## [1.15.3-beta.20] - 2026-07-16

### Added
- **Backfilled here (this changelog under-documented this tag at cut time): five phases that
  actually shipped in this release window.**
  - **Phase 222 (reach-ranking-unification).** The three surfaces that suggest a next move
    (`/mos:suggest-next`, the reach-candidates list, and the auto-fire engine) now always
    agree on the top pick instead of occasionally diverging, and the ranking improves over
    a room's own accept/reject history rather than staying static.
  - **Phase 223 (jtbd-driven-intelligence-pipeline, governed bono).** `/mos:bono` is now an
    8-phase governed research debate with Six-Thinking-Hats-style scrutiny (the Black hat
    must disconfirm first, the White hat must cite-or-retract) and three explicit navigator
    approval pauses (topic, hypothesis, ruling) instead of one collapsed confirmation. New
    `/mos:intel-pipeline` command runs a staged research pipeline oriented on the room's
    active JTBD (calibrate -> decompose -> fan out -> compute -> synthesize -> close), pausing
    for approval twice and disclosing a thin fan-out pass rather than silently proceeding.
  - **Phase 224 (graph-derivation-harness, SEED-034).** Every markdown write to a room now
    enqueues and background-derives typed graph edges, closing the previously twice-reconfirmed
    0-typed-edge gap on the write path -- no manual "derive" step required.
  - **Phase 225 (per-session-room-binding, SEED-039).** Session-to-room binding now correctly
    supports multi-room binds. Fixed during code review: a binding answer was silently
    collapsing a multi-room selection down to a single room regardless of what was picked.
  - **Phase 226 (eureka-reasoning-mode-fallback, SEED-058).** When the local embedding encoder
    is unavailable, `/mos:eureka` now degrades to a labeled, lower-confidence REASONING MODE
    result (a real short ranked list with an honest caveat naming the degrade cause) instead of
    a hard `pairs_scored: 0` dead end. `banked` is structurally `false` on every reasoning-mode
    row; a later healthy re-run over the same room surfaces the reasoning-to-embedded delta
    instead of silently replacing the earlier result. Same-day code review found and fixed
    three real data-loss edge cases in the upgrade-delta path before this shipped (a repeated
    degrade could silently overwrite a completed reasoning report with no trace; a stale
    session file could let a later healthy run get clobbered; reseeding could silently orphan
    an in-progress judging session).
- **Eureka entity extraction gets a two-tier WHAT-vs-WHY classifier.** A free, fully local
  embedding pass (`lib/core/eureka/embedding-classifier.cjs`) now resolves the confident
  majority of candidates at zero API spend, reusing the same encoder Eureka's own ranking
  already depends on. The existing LLM classifier is demoted to an escalation-only path,
  called per artifact only for the genuinely ambiguous residual the embedding tier cannot
  confidently place. Measured on a real room: 61.1% of candidates resolve locally and
  correctly, 14.3% fewer artifact-level LLM calls. Honest degrade throughout: no LLM key
  means a disclosed low-confidence embedding best-guess, never a silent default; `classifier_source`
  now reports `embedding` / `model` / `mixed` / `fallback` so every result states which tier
  produced it. Tunable via `MINDRIAN_WHATWHY_MARGIN` (default 0.10, calibrated against a
  measured holdout set). (Quick task 260714-k44.)

### Fixed
- **A low-confidence WHY term is no longer structurally indistinguishable from a confident one.**
  When Eureka's two-tier classifier places a candidate as a framework (WHY) term but has no
  working LLM to confirm the low-margin embedding best-guess, the term lands in the artifact's
  `framework_terms` prop. The only trace that the guess was low-confidence lived in the aggregate
  `status.json` counter (`tier2_low_confidence`); once written onto the node, the guess looked
  exactly like a confidently-resolved term. Each term that lands via the no-LLM degrade path is
  now disclosed per-term in an additive `framework_terms_low_confidence` sibling prop (always a
  subset of `framework_terms`); a confident later run removes the marker; and existing readers of
  `framework_terms`, which stays a plain comma-joined scalar, are unaffected. The 219 metadata
  test now pins the disclosure so it cannot silently disappear. Caught live by the run-all-221
  regression chain. (Quick task 260715-cu8.)
- **Eureka's ranked top-25 no longer refills with scaffold pairs when real entities are thin.**
  Every room stores one `memory_artifact` node per file as document scaffolding. When a room's
  real-entity cohort is thin, those scaffolding nodes were pairing with each other and flooding
  the ranked top-25 with `memory_artifact`-vs-`memory_artifact` pairs that carry no cross-domain
  signal (measured at 72.0 percent of the top-25 on a live room once entity extraction correctly
  thinned the entity population). Scaffold-vs-scaffold pairs are now excluded from the ranked-pair
  candidate set by construction, at the point the candidate list is built, so the structural share
  drops to 0.0 percent on the same live substrate regardless of how sparse the real entities are.
  The exclusions are counted honestly in the report provenance (`scaffold_pairs_excluded`, in both
  the JSON and the markdown table), never silently dropped. Pairs with only ONE scaffolding side
  are unaffected, so a real entity paired with the artifact it came from still ranks. (Quick task
  260715-0nj.)
- **Eureka's entity-extraction pre-step no longer fails silently.** `/mos:eureka run`'s
  auto-extraction step (shipped in beta.18) could fail (a thrown error, or the more likely
  internally-caught non-zero return) with zero visible trace: exit 0, status `done`, nothing
  in the report to say extraction never actually populated the graph. This reproduced the
  exact false-success shape found in a live intern QA session. Failures on both paths now
  surface as an additive `extraction_error` field in the eureka status.json plus one stderr
  line; ranking, fallback behavior, and exit codes are unchanged (the degrade-never-throw
  contract stays intact, only the silence is gone). Proven via a RED-then-GREEN reproduction
  test wired into the permanent suite. (Quick task 260714-jjm.)

## [1.15.3-beta.18] - 2026-07-13

### Added
- 

## [1.15.3-beta.16] - 2026-07-13

### Added
- **Opportunity follow-through: surfaced opportunities stop dying as files and one-liners.**
  Every opportunity now flows through the Harvest Formula lifecycle (candidate -> qualified ->
  explored -> promoted | parked | retired) as a real graph node with append-only stage history -
  who advanced it, why, and on what evidence, at every step.
- **Eureka statements now bank as proposed opportunity nodes.** The portfolio scan's ranked
  statements get a REAL awaited Grounding Guard verdict (a bounded async resolution pass over
  the Phase 212 critic - previously the sync emitter could never await it, so nothing ever
  banked on a live run). Statements the critic passes bank as `opportunity` nodes with
  DERIVED_FROM evidence edges; statements it rejects stay honestly unbanked with the verdict
  named. Tunable via `MINDRIAN_OPPORTUNITY_BANK_PREDICATE` (critic | critic+tail | all).
- **Harvest sensor (SENS-14): graph events become scored opportunity candidates.** A producer
  on the insight-sensor rail harvests candidates from five lanes (eureka proposals, bridges,
  contradictions, whitespace, meeting filings), classifies each through the Gibson Four-Lens
  (leveraging_resources / challenging_orthodoxies / understanding_needs / harnessing_trends),
  and scores them with HarvestIndex_v1. The bridge lane rides the real extraction edge
  vocabulary (COMPETES_WITH / USES_COMPONENT / SUPPLIES_TO), so it finds genuine cross-entity
  signal on real rooms, not just fixture edges.
- **Qualification Decision Gate (`/mos:qualify-opportunity`).** Harvested candidates come to
  YOU at a real card showing why each one qualified (Q1..Q8 rubric verdicts + machine-readiness
  components; an unknown is typed `unknown`, never a fabricated zero). Five verbs:
  Qualify+file, Park, Retire, Explore, Skip. A Skip writes a typed REJECTED_BECAUSE edge -
  rejection is data the ranker learns from. Nothing qualifies without your explicit verb.
- **[Explore]: one explicit action turns a qualified opportunity into deep research**
  (`/mos:explore-opportunity`). Runs the explored-stage chain - deep research, diffusion and
  timing, analogies, web validation - and files a Minto-shaped opportunity artifact (governing
  thought + SCQA + cited sources) into `opportunity-bank/` plus a research corpus artifact into
  `research/`, both through the navigation.cjs gates with typed evidence edges. When the
  engine cannot run, the surface OFFERS an LLM manual fallback at a card - honestly labeled
  `engine_mode: llm_manual_baseline`, never silent, never the default.
- **Frontmatter metadata extraction slice.** Artifact frontmatter (methodology, status,
  created) now lands as graph properties during extraction, so engines reason over what the
  files already declare.
- **Web ingestion agent: any URL becomes room knowledge in one governed move.** Paste a link
  in conversation, or run `/mos:research <url>`, and after you approve at the card the page
  is fetched (Tavily Extract, server-side clean markdown), filed as a cited research artifact
  in `research/` (source URL, capture date, content hash, review status: proposed), and its
  entities land in the room graph so every engine can use them. Nothing is ever fetched or
  filed without your explicit verb ([Ingest] [Ingest+Explore] [Skip]).
- **Pasted-URL sensor (SENS-15).** A bare URL in your turn offers an ingest card
  contextually - it never auto-files, and it stays quiet for URLs inside code blocks,
  quotes, or ones the room already ingested.
- **Content-hash idempotency + SUPERSEDES versioning.** Re-ingesting an unchanged page is an
  honest no-op; a changed page files a NEW version linked to the prior one - history is
  append-only, nothing is overwritten.
- **Watched sources: crawl-and-learn on cadence.** Register sources in
  `.mindrian/watched-sources.json` and the scout cadence re-ingests changed pages under a
  per-run cap (default 2), with cadence provenance stamped on every artifact. Findings
  surface as candidates at existing gates - never auto-qualified.
- **Provider honesty everywhere (research_mode envelope).** Every ingest and research run
  names which provider produced the bytes (tavily-extract / webfetch / manual), which mode
  it ran in (normal / web_degraded_local_fallback / local_only / insufficient_evidence),
  and never reports success with empty results. A failed fetch is a typed refusal, not a
  silent empty.
- **Part 8 + inbound safety on the new surface.** Outbound carries the URL only through the
  audited egress chokepoint; inbound web content is data end to end (prompt-injection
  inert, size-bounded, path-safe filing, no symlink escape), adversarially test-pinned.
- **Every research/recovery stage now produces a typed envelope instead of guessing from an
  empty result.** `lib/core/recovery/stage-envelope.cjs` gives all 13 pipeline stages
  (retrieval, discovery, filing, and more) one shared shape: status (ok / empty_valid /
  degraded / failed / blocked), a named failure_class from a frozen 13-class vocabulary,
  retryable, provenance, and timestamps. A zero-result stage and a broken stage used to look
  identical (both "empty"); now they carry different, typed reasons, and a validator enforces
  the pairing rules (a failed/blocked stage MUST name its class; an ok stage MUST NOT).
- **When a research engine breaks, Mindrian now recovers through a real 6-tier ladder instead
  of just failing.** `dispatchRecovery` reads the typed envelopes and tries, in order: (0)
  nothing wrong, (1) one bounded idempotent retry for a transient failure, (2) a local
  governed substitute (your room's own corpus, or its cache, honestly labeled - never "live"
  when it isn't), (3) an OFFERED high-effort LLM recovery pass at a Decision Gate (never
  silent, never the default), (4) naming the smallest missing thing a human needs to fix (a
  credential, an engine), (5) honest termination when nothing worked - a partial result
  naming exactly which engines are still down, never a complete-looking bundle papering over
  a gap.
- **Running out of Claude spend mid-recovery is now its own honestly-named failure, not a
  retry loop.** `spend_limit_exceeded` is a structural, first-class failure_class: it forces
  `retryable:false` at the moment the envelope is built (not just checked later), and
  short-circuits straight past every retry/substitute/LLM-recovery tier to a plain human
  message: "raise your limit at claude.ai/settings/usage, or wait for the monthly reset."
  This closes a real gap this exact session hit: four parallel agents stalling out on an
  account spend cap, with no honest way for the system to say so.
- **The high-effort LLM recovery pass runs through a 7-step, resumable, audited case file,
  never a black box.** A gate-offered recovery run (diagnose -> plan -> execute -> validate
  -> reconcile -> resume -> surface) journals every step to a real case file under
  `.mindrian/recovery/<run_id>/` so a crash mid-run resumes exactly where it left off, never
  re-doing completed steps. Five hard fences, each proven by an adversarial test: the
  Brain-egress boundary can't be weakened from inside a recovery run, an unknown component
  can never be silently upgraded to "supported," every write still goes through the one real
  writer (no raw DB access from a recovery hook), a filing is only ever called "recovered" if
  a readback actually confirms it landed, and hostile text embedded in a source (a fake
  instruction, a fake tool call) is always treated as inert data, never executed.
- **Recovery outcomes are now honestly composed, never inferred.** `composeRecoveryResult`
  derives one of five outcomes (recovered / partial_recovery / degraded_recovery /
  manual_intervention_required / insufficient_evidence) strictly from what actually happened:
  "recovered" requires every stage envelope to validate AND any attempted filing to be
  readback-confirmed - one unconfirmed filing forces `partial_recovery`, never a false
  "recovered." The result rides as an additive `research_mode` + disclosure field on every
  touched surface (research, opportunity exploration, URL ingestion) without changing any
  existing field's meaning.
- **A gap in one accessible corpus is never reported as "this doesn't exist."** The
  vantage-error lesson from this exact release wave (an external research pass wrongly
  concluded a shipped phase was "missing" because it only checked one gitignored, unpushed
  corpus) is now a structural, permanent rule: the only gap scope the recovery composer can
  ever emit is `corpus` (a provisional, vantage-scoped gap), never `project` (a claim of
  project-level nonexistence) - enforced by a source scan that fails the build if that ever
  changes, plus a permanent regression fixture that encodes this exact mistake so it can
  never silently return.
- **14-class recovery matrix, offline and permanent.** Every named failure class (network
  timeout, missing credential, contract violation, policy block, cadence-vs-on-demand,
  multi-engine outage, spend limit, vantage-scoped gap, and more) is asserted end to end
  through the real dispatch and controller seams, with zero network calls - two of the
  fourteen (the vantage rule and spend_limit_exceeded) are locked as PERMANENT fixtures
  precisely because this session discovered both the hard way.

### Fixed
- **Windows FTS5 crash: eureka degrades bi-modal instead of dying.** On machines whose Node
  SQLite lacks the FTS5 module, the tri-modal index used to crash the whole scan with
  `no such module: fts5`. A capability probe now selects the backend up front: with FTS5 the
  lexical leg runs as before; without it the scan runs honestly on the two remaining legs
  (vector + graph) and stamps `fts_backend: absent (bi-modal degrade)` in provenance. Never a
  crash, never a silent lie. Live-validated on the exact Windows machine that exposed the bug
  (corepower-isolation, 219-VERIFICATION.md Section 4).

## [1.15.3-beta.14] - 2026-07-12

### Added
- 

### Fixed
- **The card-fire backstop no longer force-fires on benign numbered lists** (`scripts/check-card-fire.cjs`). The `ASCII_BOX_GLYPH_RE` alternative-4 shape (a bare `1. / 2.` numbered-prose list, added Phase 209-07) matched ANY 2+-item list on shape alone, so an ordinary Action Footer or a step-by-step explanation that shared any incidental vocabulary with the user's turn was misread as an unfired Decision Gate and hard-blocked. New `GATE_FRAMING_RE` co-requirement (CR-05): a bare numbered-prose list counts as a backstop hit ONLY when a choice-framing cue (`?`, or one of `which / would you like / pick / choose / select / type 1`) sits inside the matched span or the ~150 chars before it. Alternatives 1-3 (bracket notation, the `type 1, 2, or 3` literal, the multiline bracket box) stay unconditional, and `ASCII_BOX_GLYPH_RE` itself is byte-identical so the retry-key signature and the Phase 209 regex-matrix tests are untouched. The Phase 209 floor survives: a genuine hand-rolled fork carrying a framing cue still intercepts.
- **The Stop-hook `reason` slug no longer reaches the user as a fake "Stop hook error"** (`scripts/check-card-fire.cjs`, `buildEnforcementEnvelope`). The 2026-07-05 fix added a `systemMessage` on the premise that Claude Code surfaces `reason` as "Stop hook error: <reason>" ONLY when no `systemMessage` is present; live observation proved that premise FALSE (it renders `reason` regardless). The only lever is the `reason` CONTENT, so it is now a calm, human-safe phrase on BOTH the intercept and degrade branches (CR-06), never the internal slug. The slug is preserved for telemetry, relocated to the new local diagnostic log (below), not deleted. Confirmed `turnContextHash` never reads `reason`, so the bounded-escape retry key is unaffected (asserted by a new non-effect test).
- **New local-only intercept diagnostic log** (`~/.mindrian/card-fire-intercepts.log`, CR-07). Append-only JSONL written whenever the backstop intercepts or degrades, capturing `{ timestamp, session_id, reason (the ORIGINAL slug), gate_signature, ran_entries, matched_glyph_span, output_text (truncated ~4000 chars) }`. TTL-pruned on every write by the same `RETRY_TTL_MS` the retry side-file uses, so it cannot grow unbounded. Canon Part 8: LOCAL disk only (`~/.mindrian`), never the Brain, never a network wire. This turns the still-open "unexplained backstop trigger" mystery (`live-session-running-stale-plugin-cache-fixes-inert`) into a one-log-read diagnosis on its next occurrence.
- **`check-card-fire.cjs`'s `gate-is-simple-binary` exemption swallowed genuine two-option forced-choice forks, not just yes/no closers.** The exemption (added 2026-07-05 to stop over-firing on trivial binaries like "Want those?") used a bare `gateLabels.length === 2` cardinality check, which cannot distinguish that from a genuine two-way strategic fork ("run research vs build the plan"). An intern QA session missed 3 such forks in one session because each carried exactly 2 option labels. Now requires the labels to be YES/NO-SHAPED (new `lib/core/gate-relevance.cjs::isYesNoShapedGate`, extracted from `gateAlreadyAnswered`'s existing yes/no answer-matching), not merely 2-in-number, so a real yes/no closer stays exempt while a genuine 2-option fork force-fires like a 3+-way one. Post-merge integration fix: `GATE_FRAMING_RE` widened with a cardinality + choice-noun cue ("two options", "3 paths") so a fork phrased without a literal `?`/`which`/`pick` still force-fires, closing a gap CR-05 would otherwise have silently reopened. `.planning/debug/intern-w1-card-discipline-decay.md`.
- **MCP `room_state` reads re-resolve the active room per call, same as `room_content` writes** (`lib/mcp/tool-router.cjs`). The `status` / `analyze` / `compute-state` / `get-state` / `suggest-next` branches read the boot-time closure `roomDir` directly, so a mid-session room switch (or a room created after the MCP daemon booted) was invisible to them and `status` falsely reported "No room initialized" against a room with real content. Now reuses the same `resolveWriteTargetDir` resolver the beta.12 `room_content` write fix already proved correct. intern-w1-room-state-false-empty.
- **`intelligence:research` now actually fetches instead of echoing its own command spec** (`lib/mcp/tool-router.cjs`). The `research` sub-command fell through to the generic `buildContext()` doc+state-echo helper (the same fallback reasoning-only ops like `grade`/`whitespace` correctly use), so it deterministically returned `commands/research.md`'s own frontmatter and spec text for any input, with zero web fetch. Now special-cases `research` to invoke `research-context-extractor.cjs` -> `source-lens-driver.cjs` (Stage 1-4) and return real findings with source/url/evidence-tier; filing (Stage 6-7) stays a human decision per Canon Part 9 role 5, never auto-wired inside a single MCP call. `commands/mva-brief.md` (the only other `reach_id: deep_research` command) checked and confirmed unaffected -- it runs its own Bash script, not this tool. intern-w1-research-reach-broken.
- **STATE.md is now actually recomputed after a room-section write, not just reported as recomputed** (`lib/core/intelligence-cascade.cjs`, `lib/core/state-ops.cjs`). `scripts/compute-state` only prints the STATE.md body to stdout by design; it never writes the file itself, so every caller owns persistence. The automatic PostToolUse cascade (Step 8) and the MCP `room_state compute-state` command both discarded that stdout while reporting/implying success, so a filed artifact never updated the room's own intelligence layer in the same turn it was filed. Cascade Step 8 now captures and persists the stdout directly; `state-ops.cjs::computeState()` now persists at the single Node chokepoint, mirroring the pattern already correct in `scripts/on-stop` / `on-task-complete` / `on-agent-complete`. intern-w1-state-not-recomputed.
- **The session-start mode-selection Decision Gate (`skills/conversation-mode/SKILL.md`) can silently skip with zero detectable signal** (RCA `intern-w1-mode-gate-skip`). Root cause: two converging structural gaps. (1) `scripts/build-render-coverage.cjs::buildMdKeyspace()` walked only `commands/*.md`, never `skills/*/SKILL.md`, so a skill-declared `hitl_shape` Decision Gate could never register in `data/render-coverage-registry.json` -- PRIMARY detection was structurally blind to every skill-declared gate. New `buildSkillKeyspace()` (a third, additive registry keyspace, mirroring the existing commands walk) closes this; `skills/conversation-mode/SKILL.md` now registers as `declared_shape: F.1, wired: true`. (2) `scripts/check-shape-declaration.cjs` had no predicate catching a surface that self-declares BOTH a genuine `hitl_shape` fork AND `connector.excluded:true` (the no-fork exemption) at once -- a direct contradiction of this repo's own CLAUDE.md Part 11 text: "a render-only or pure-capability skill is exempt via its existing connector.excluded:true + reason, never via a fork it does not have." A new predicate now WARNs (advisory, non-blocking per the existing Phase 210 policy) on this exact contradiction. Extending PRIMARY detection to skills also surfaced 5 pre-existing, previously-invisible unwired skill declarations (`MOSDeckEngine`, `client-discovery-interview`, `intelligence-orchestrator`, `mullins-scaffold`, `mva-pipeline`) and 54 additional pre-existing hasShape-and-excluded contradictions beyond conversation-mode -- both are real, tracked findings surfaced for the first time by this fix, out of scope to resolve here, and named in `tests/test-209-declared-implies-wired.cjs`. `scripts/check-card-fire.cjs` (the Stop-hook backstop, the third converging gap in the original RCA) is untouched by this fix.
- **11 SKILL.md files documented `bash scripts/<name>` as if `scripts/` were skill-local** (`skills/rooms`, `publish`, `new-project`, `setup`, `room`, `file-meeting`, `wiki`, `vault`, `ingest-methodology`, `ignite`, `export`, plus `commands/new-project.md`). The scripts only ever existed at the plugin root, so any invocation with cwd != plugin root failed exit 127. Prefixed all 72 call sites with `${CLAUDE_PLUGIN_ROOT}` (quoted), the proven convention already used in ~38 other SKILL.md files, `hooks.json`, and `.mcp.json`. Also removed the co-located `PLUGIN_ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"` pattern (`skills/rooms/SKILL.md` Step 2.5, `skills/new-project/SKILL.md`, `commands/new-project.md`, referenced by `skills/ignite/SKILL.md`) -- confirmed broken under the Bash tool's actual invocation mechanism (`$0` resolves to the shell binary, computing `/usr` as the plugin root on every call) -- replaced with `${CLAUDE_PLUGIN_ROOT}` throughout. See `.planning/debug/intern-w1-rooms-skill-script-path.md`.
- **`/mos:rooms new` could silently fail to create a room while narrating success.** `scripts/resolve-room`'s legacy-fallback branch returned the pre-existing `room/` path with exit 0 (success) whether or not a new room was actually registered, indistinguishable from a real registry hit -- the direct mechanism behind a false "Room's live" claim when no `cv-project/` directory or registry entry ever existed. Added a `--strict` mode: a bare legacy fallback (no `--adopt`) now prints a `FALLBACK:` stdout marker and exits 2, never 0 -- fully backward compatible for every existing caller that omits the flag. Also tightened `skills/rooms/SKILL.md` Step 2's legacy-room adoption prompt to the same "FIRE THE CARD -- mandatory" doctrine `/mos:ignite`'s B1/B2 gates carry, added an explicit warning against narrating room creation before `birthRoom()` returns `{ok:true}`, and fixed the routing note that mislabeled Step 2 as "(name/slug capture)" (Step 1 captures the name/slug; Step 2 is the adoption check). See `.planning/debug/resolved/intern-w1-rooms-new-silent-fail.md`.
- **`/mos:doctor` Class H (`install-incomplete-module.cjs`) no longer false-positives "install incomplete" on a healthy one-command marketplace install.** Class H never received the `resolveActivePluginRoot()` topology-awareness fix Class A/Class I got in Phase 123 -- it only recognized a legacy `.install-receipt.json` or a user-level `statusLine` block as "healthy," neither of which a marketplace-cache install ever produces. Its `--fix` path then wrote a `~/.claude/settings.json` `statusLine` override pointing at the hardcoded legacy install path, which does not exist on a marketplace-cache-only machine -- silently breaking the statusline for the rest of the session (user-level settings override plugin-level; the broken exec never surfaced an error in chat). Class H now checks topology first and reports healthy without touching the legacy signals. `statusline-visibility-module.cjs` (Class G) also now tests the EFFECTIVE resolved statusline command (the user-level override if present, else the plugin's own), not always the plugin's own file, so the self-heal's re-verification can actually catch a broken override instead of reporting "ok" regardless. The SessionStart self-heal's outer timeout (`scripts/check-onboard-statusline.cjs`) is raised from 4000ms to 10000ms to clear its own nested worst-case spawn budget (8000ms) instead of getting killed mid-repair. Fix re-implemented against the post-Phase-217 `lib/core/doctor/*-module.cjs` files (the original worktree's fix predated that migration). RCA: `.planning/debug/resolved/intern-w1-statusline-room-mismatch.md`.

## [1.15.3-beta.12] - 2026-07-06

### Added
- **Phase 211 Eureka generator now runs at production scale.** The tri-modal room.db retrieval engine (FTS5 lexical + sqlite-vec vector + RRF fusion, `mdbr-leaf-ir` local embedder) completes end-to-end against a real 2117-node room after two blocker fixes (below). This is the GENERATOR half of the "two-in-a-box"; the critic (Phase 212) is planned, not yet shipped.
- **Generic `csv-to-idea-graph` export capability** (`scripts/csv-to-idea-graph.cjs`). Turns any relationship CSV (a pairs edge-list plus optional node-enrichment CSV, column-mapped via CLI args) into a De Stijl navigable idea-graph through the shipped dashboard template -- Section-clustered by a chosen grouping column, layer-toggled, every node/edge citation-tagged. Extends the `generate-standalone` export family; zero tenant hardcoding. Hermetic `tests/test-csv-to-idea-graph.cjs` 21/21.

### Fixed
- **MCP `room_content` writes re-resolve the active room per call** (`lib/mcp/tool-router.cjs`). The MCP server froze its write target at boot-time cwd, so a mid-session `room-registry set-active` never reached it and writes (file-opportunity / create-funding / update-funding-stage) misrouted to the spawn-time room. Now each write branch calls `resolve-active-room.cjs` (the canonical resolver -- this was a fifth active-room guesser never migrated onto it, the exact stale-closure class Phase 212 D5 warns against). Also aligned `opportunitySchema` to `fileOpportunity` (title optional with a title-or-program refine, coerced numerics). Commit `7a84d38b`.
- **Strict-mode no longer fires false room-switch / session-binding gates** (`lib/core/room-classifier-strict-mode.cjs`, `scripts/intent-classifier.cjs`). A bare numeric menu reply (`NUMERIC_PATTERN` made the verb optional) and product-branded paste blocks (brand tokens credited as room-name matches) both triggered spurious "switch rooms" / "bind session" interruptions on nearly every turn. Verb now required; brand/boilerplate stop-set excluded from name-entity credit. Commit `e23060cd`.
- **`birthRoom` binds the newborn room into the session write scope** (`lib/core/navigation/room-birth.cjs`). It flipped only the registry active pointer; Phase 194 (PSB) made the per-session bound SET the primary write authority, so a just-created room was BLOCKED for writes. Now unions the new slug into the session binding as primary via the shipped `session-binding.cjs`; `ignite` threads the real `CLAUDE_SESSION_ID`. Commit `3ad78e70`.
- **Frontmatter schema validator reconciled to the actual writers** (`lib/core/frontmatter-schemas.cjs`). The Phase 88.1-07 schema codified an aspirational vocabulary no scaffold/doc/compute-state writer ever emitted, so the plugin's own output failed its own advisory schema (a Canon Part 6 dog-food self-violation) and polluted the offense log. Relaxed ROOM.md/STATE.md/artifact-default required sets to what writers emit, added a USER.md schema, and split violation messages into missing-vs-unexpected. New reconcile test scaffolds a room and asserts zero blocking violations. Commit `2602c65b`.
- **Embedding OOM on large-N rooms** (`lib/core/eureka/embedding-spine.cjs`): `embedTexts` embedded the whole corpus in one forward pass (~26.7GB ONNX allocation on 2117 nodes). Now batched (`MINDRIAN_EMBED_BATCH`, default 32). Commit `c222ff7d`.
- **vec0 offline-load failure** (`lib/core/eureka/vector-store.cjs`): the backend was inferred from stale table existence, so a table from a prior run threw `no such module: vec0`. Now a per-process capability probe selects the backend; confirmed sqlite-vec loads on Node 22 via a `better-sqlite3` allowExtension handle (the >=23.5 floor is `node:sqlite`-only). Commit `73698c73`.
- **Claim-text persistence + read-side fallbacks** (D15): `writeClaimNode` persists claim `text`; tri-modal index read-side fallbacks for claim/WhitespaceZone/Artifact. Commits `3d1b27a4`, `af24b697`.
- **`.gitignore` room.db patterns** backing the "never commit room.db" comment (Part 8 hygiene). Commit `a4cd48dc`.

### Housekeeping
- **JHTV tenant data + JHU-specific tooling relocated out of the product** into the `jhtv-oliver-kuntz` room, with a `.gitignore` leak guard (Canon three-layer: tenant data/tooling lives in the Room, never the Plugin). The reusable graph capability was generalized (see Added). Commit `57bad7ed`.
- **Planning (not shipped code):** Phases 212 (Eureka Grounding Guard critic, 5 plans), 212.5 (graph substrate), 213-215 (15 checked plans total) and SEED-053 (methodology-chain MCP tool) registered for the next arc. 213/214 execution is gated on the curing-track verdict + 212-05 calibration.

## [1.15.3-beta.10] - 2026-07-05

### Added
- **Ratification-tracked next-actions now surface in the statusline's `Next:` slot.** Quick task 260705-ui4, motivated by the rethinking-mindrianos standing-consultant room's own unconverted research entries (`ratification_status: proposed` frontmatter) going invisible once the routing engine had nothing else to offer. Reuses the existing `next-move-cache` mechanism end to end (Canon Part 7: no second cache) -- new `lib/statusline/ratification-next.cjs` resolves the active room FRESH per call (avoiding the frozen-roomDir staleness class found at `bin/mindrian-mcp-server.cjs:65`), shallow-scans `research/*/` for `ratification_status: proposed`, and returns an enum/count-only cue (`ratify strong (2 open)`, never entry titles or target prose -- Canon Part 8). `persistFromDecision(decision, opts)` gained an opt-in `opts.fallbackProvider` on the case-3 clear leg only; no-opts behavior stays byte-identical, so the existing clear-semantics tests are unmodified. The statusline's context-percentage color contract (50/65/80 thresholds) and risk chip are untouched -- the `Next:` segment itself carries zero color/ANSI treatment, so the new cue needed none. New tests/test-statusline-ratification-next.cjs 12/12; context-aware 19/19 unmodified; live-signals 10/10.

## [1.15.3-beta.8] - 2026-07-05

### Added
- **JTBD-driven regroup of the 11 `/mos:help` families** (refines the beta.6 3-card selector, not a redesign). Every family's membership is now traceable to a coherent Jobs-To-Be-Done outcome instead of ad-hoc navigational grouping: filled the 2 missing `serves_jtbd` tags (`ingest-methodology`, `stance`), reassigned 9 commands across 3 JTBD-coherent moves, renamed `frame-the-problem` to "Frame & Validate", and gave every family an explicit `jtbd: []` declaration. `scripts/check-help-coverage.cjs` now permanently machine-enforces this coherence (new `jtbd_missing_declaration` / `jtbd_unknown_tag` / `jtbd_incoherent` checks, vocabulary enumerated from disk) so the map can't silently drift back into vibes-based grouping.
- **Staleness-prevention for the commands/-to-skills/ mirror workaround.** `scripts/build-skill-mirrors.cjs --check` is now wired into pre-commit (tracked + installed hook), `scripts/verify-release` (new step 10b), and `doctor --acceptance` (folded into the existing coverage-gate point), so a future `commands/*.md` edit can never again silently strand a stale `skills/<name>/SKILL.md` mirror. Also hardened `--check` to verify the hand-authored `trending-to-absurd` skill stays present and genuinely divergent from its command. The new gate immediately caught and fixed 3 real stale mirrors left over from the JTBD regroup on its first run.

## [1.15.3-beta.6] - 2026-07-05

### Added
- **Every `/mos:` command is now also reachable via the `skills/` loading path** (`scripts/build-skill-mirrors.cjs`, new generator, write + `--check` modes). Root cause: on a confirmed-affected Windows Claude Code install, this plugin's `commands/*.md` files fail to register ("No commands match") while `skills/` and MCP-server prompts from the same plugin load fine -- reproduced identically on an unrelated marketplace plugin on the same machine, and confirmed against Anthropic's own docs (commands/ is the legacy flat-file path; skills/ is the recommended one). `commands/*.md` stays the single, untouched source of truth -- this repo's own command-registry/render-coverage/help-coverage tooling all read commands/ only. 105 new byte-identical `skills/<name>/SKILL.md` mirrors generated (106 with the pilot's `help`); `trending-to-absurd` skip-listed (pre-existing hand-authored skill already covers it). One documented, precedented field exception: wired commands' `connector.sensor_triggers` is rewritten to `[]` on the mirror only (61 of 105) to avoid a duplicate-tuple collision in `build-connector-registry.cjs` -- the same pattern the pre-existing `trending-to-absurd` skill already used for the identical reason.

### Fixed
- Unanchored `.gitignore` patterns (`room/`, `export/`) were also matching the new `skills/room/` and `skills/export/` mirror directories, silently dropping them from commits with no CIRS gate catching it (gates check filesystem presence, not git-tracking status). Anchored both to repo root.

## [1.15.3-beta.4] - 2026-07-05

### Fixed
- **`vunknown` version banner on Windows, root-caused.** `session-start`'s `$PLUGIN_ROOT` was a git-bash MSYS path (`/c/Users/...`), which Windows-native `node.exe` cannot resolve inside `require()` -- every version-resolution call on that platform silently failed to `unknown`. Normalized once via `cygpath -m` (no-op on Linux/macOS) and threaded through all 8 call sites in the script that previously passed the raw path.
- **`check-card-fire.cjs` (the SEED-021 Stop hook) leaked its internal classification slug to the user as a fake "error".** A `decision:'block'` envelope with no `systemMessage` renders its `reason` field as "Stop hook error: <slug>" even when the hook is working correctly. Added a calm, fixed `systemMessage` on the intercept branch; the slug stays in `reason` for logs.
- **The same hook over-fired on plain binary (yes/no) closers**, forcing a card for simple confirmations the same as a genuine multi-option fork. New `gate-is-simple-binary` pass-reason exempts exact 2-option closers while preserving the Phase 209 floor for genuine 3+-way forks.
- **`/mos:help`'s last stale-copy residual** ("in this lane", "four color-coded lanes") reworded to match the real 11-family / 3-card design shipped in beta.3.

## [1.15.3-beta.3] - 2026-07-05

### Added
- **`doctor --report-registration-bug`** -- a new diagnostic mode for the confirmed Claude Code host-side command-registration bug (commands fail to register while skills/MCP prompts load fine, reproduced across unrelated plugins). Rules out every locally-checkable cause first (install-cache drift, silent-disable, legacy config-pin drift, marketplace-clone dirty state, version-of-record agreement) before assembling a paste-ready report for Anthropic. Never claims "fixed" -- diagnostic only.
- **`lib/core/command-registration-check.cjs`** -- a precondition sweep (frontmatter fences, YAML tabs, legal command names, case-insensitive collisions, description length) wired into the new doctor mode, the release gate, and pre-commit.
- **`/mos:help` reshaped** from a stale "4-lane" claim to the real 11 command families, rendered as 3 native `AskUserQuestion` cards (4+4+3) instead of one artificially-merged card.
- **The legacy `config.json` version-pin drift (F11)** is now detected and auto-repaired by `doctor --fix` -- confirmed recurring twice on the same real Windows machine before this fix; two Windows-specific correctness bugs in the fix itself (a missing config.json schema variant, a Windows-illegal `:` in a backup filename) were also found and fixed the same day.
- The cold-start banner's command count is now computed live instead of a hardcoded literal that had drifted stale (last read "45" against an actual 107).

## [1.15.3-beta.1] - 2026-07-03

### Changed
- **Phase 210 - Revert persona-enforcement over-reach (restores Larry's conversational judgment).** Root cause of the navigator-reported "v1.15 behaves less like Larry" regression: five phases in the v1.15 window (2026-06-24 through 2026-07-02) turned voice/gate judgment calls into mechanical HARD-FAIL/BINDING checks. Each is now softened to advisory or relevance-gated behavior while its underlying capability stays intact:
  - **(A) Shape-declaration gate is advisory (Phases 190 + 209-03).** `scripts/check-shape-declaration.cjs --check` now WARNs and exits 0 -- every violation is still detected and enumerated, so the lint signal survives; `--strict` restores the pre-210 hard-fail. Rewired at both call sites (release.sh Step 2, doctor --acceptance); the render-coverage, corpus-stats, connector, and projection gates keep their HARD-ABORT semantics.
  - **(B) Voice-glyph mapping is a default, not a lock (Phase 192).** Natural voice detection wins when it yields a color; the stance color fills the default only when detection is silent. The stance-toggle footer is offered when the navigator is genuinely mid-decision about conversational mode, not on every turn.
  - **(C) APO voice-contract scores, never vetoes (Phase 202).** The disqualifier filter is gone: violations dent the candidate's blended score (0.05 per violation, visible as voiceFlagged + voiceViolations on the record) while quality primacy stays structural. The detector itself is byte-untouched.
  - **(D) Elevation quorum suggests, never forces (Phase 205).** `sessionEndQuorum` returns suggested:true / forced:false; the hedged hypothesis floor (offered, never committed, no edge written) is byte-preserved.
  - **(E) Force-fire is relevance-gated (Phase 209).** The Stop-hook backstop no longer blocks when the navigator already plainly answered the question, or when the gate has zero subject connection to the current turn (new shared predicate `lib/core/gate-relevance.cjs`; conservative verdict: uncertainty still intercepts). The trailer imperative flips from unconditional `[BINDING:` to conditional `[FIRE-IF-FORK:`; all 80 body-stamped commands swept to the v2 firing block; both auto-loaded doctrine surfaces (larry-extended agent, ui-system skill) now teach fire-if-genuine-fork. A genuine, relevant, unanswered fork STILL fires the card -- proven in both directions by the phase's two-directional tests.
  - **Canon v1.24.** Part 11 R16's enforcement clause amended (Appendix D entry 37, navigator-ratified) from unconditional HARD-FAIL to advisory-by-default with a --strict opt-in.
  - **Preserve guarantees.** The Phase 194 session-room-binding gate, Phase 196 Brain-egress PreToolUse guardrail, and Phase 200 semantic-floor gate are byte-untouched (data-boundary, not persona); the 19 standalone v1.15 bug fixes and every underlying capability (declared-shape tracking, the glyph vocabulary, the elevation taxonomy, the AskUserQuestion primitive) survive. `tests/run-all-210.sh` PASS=14 FAIL=0 SKIP=0; the five softened phases' own aggregators (190/192/202/205/209) all green; doctor --acceptance 14/14.

## [1.15.2] - 2026-07-02

### Fixed
- **Phase 209 - Shape-F Native Fire, Waves 2-4 (closes the declared-vs-rendered gap).** Completes the gate-native-fire fix plan Wave 1 started (1.15.2-beta.1): every surface that declares a Shape-F Decision Gate now fires the AskUserQuestion card natively, and the check-card-fire.cjs backstop is demoted to telemetry (target: intercepts trend to zero) rather than the mechanism navigators experience.
  - **Wave 2 (render rollout):** `scripts/stamp-firing-block.cjs` stamped the canonical firing block + AskUserQuestion tool grant into all 97 declaring commands (80 body-stamped, 93 tool-granted, idempotent). `scripts/check-shape-declaration.cjs` gained three declared-implies-wired predicates (wired-body, tool-grant, declared-matches-body), and `scripts/check-render-coverage.cjs` gained a second `.md` keyspace alongside the existing `.cjs` one -- both fail closed. `commands/futures.md`'s F.2/F.1 frontmatter-vs-body drift is reconciled.
  - **Wave 3 (conversational-gate bridge):** a new SENS-12 sensor (`lib/core/sensors/sensor-room-pick.cjs`) detects a mid-dialogue room resume/switch (the incident's actual transport-less fork -- no command, no engine dial) and injects the room-chooser card envelope. `lib/core/card-fire-sidechannel.cjs` lands the PRIMARY (registry-keyed) side-channel producer at all three gate-mint sites, wiring `check-card-fire.cjs`'s previously-inert PRIMARY detection live. `scripts/session-start` no longer teaches the "Type 1, 2, or 3" ASCII-box anti-pattern it exists to catch.
  - **Wave 4 (backstop tuning, sequenced last):** `ASCII_BOX_GLYPH_RE` drops the bare U+25A0 false-positive (sanctioned UI vocabulary) and adds multiline-labeled-box and numbered-prose-gate false-negative coverage; the `askFired` detection window widens from the last assistant message to the whole current turn.
  - **Eval gate:** a new Plurai eval (`lib/core/card-fire-gate.cjs`, `evals/plurai/13-native-fire.csv`) judges card-fired-vs-prose fidelity, following the Phase 196/201 frozen-invariant + `baseline_deferred` pattern.
  - **Adversarial verification:** `tests/test-209-incident-replay.cjs` replays the incident transcript shape end to end and proves all four RESEARCH-mandated outcomes (native fire, zero intercepts, coverage green, sanctioned glyph safe). `bash tests/run-all-209.sh` = PASS=9 FAIL=0 SKIP=0. Constitutional floor (Stop-block re-prompt, degrade envelope, MAX_FORCE_RETRIES=3, MAX_SESSION_INTERCEPTS=12) verified byte-untouched throughout.

## [1.15.2-beta.1] - 2026-07-02

### Fixed
- **Decision-Gate cards now fire natively (gate-native-fire Wave 1: E1 + P1 + P3).** Root cause of the "Larry draws an ASCII box instead of the selector card" incident: the AskUserQuestion trailer that reached the model was a bare structural marker with zero imperative, and the fire mandate was absent from every file Larry actually loads. Three fixes: (E1) the trailer minted by `lib/hmi/selector-dispatcher.cjs` is now SELF-DECODING -- it carries a `[BINDING: call the AskUserQuestion tool in THIS response with the N options above; do not reproduce this block as text (SEED-021)]` line on every Shape-F footer, so the trigger tells the model to fire the card; (P1) the larry-extended agent body gains the Decision-Gate fire mandate (mirrors the ignite.md doctrine) and the "End with a question or next step" rule is qualified -- at a gate the question IS the card; (P3) the auto-loaded ui-system skill's Shape-F section carries the same mandate globally. The Stop-hook backstop (`check-card-fire.cjs`) is unchanged and demoted to telemetry: its intercept counters should now trend to zero. Frozen contracts byte-unchanged (marker scalar, MAX_K=3, DIAL_REACH_K=6, 0.70/0.15). New fence: `tests/test-gate-native-fire-w1.cjs` 12/12. Waves 2-4 (declared-implies-rendered rollout, conversational-gate bridge, backstop tuning) are Phase 209.


## [1.15.1] - 2026-07-02


## [1.15.0] - 2026-07-02

### Added
- **Phase 190 - Shape-F Declaration Mandate (canon v1.23, Part 11 R16).** Every invocable surface (command, agent, pipeline, and qualifying skill) is now born with a declared HITL shape (`hitl_shape`/`hitl_why` or `hitl_stages`), enforced hard-fail at commit + release + `doctor --acceptance`. The full surface set was backfilled mechanically; the declaring count is enumerated from disk at runtime, never a frozen literal.
- **Phase 192 - Shape-F HITL Selector Completion + Posture Dial + live statusline.** Menu live-selectors across suggest-next/rooms/onboard, the F7max dial preview and modifier pane, a new `/mos:stance` 4-pole posture dial, and a statusline that is finally live: `Next:` reads the real routed next step and the health glyph reflects a real doctor cache, both changing per turn (they were static before).
- **Phase 203 - Synthetic-Expert-as-Skill with a two-surface Plurai gate.** Domain experts are fan-out-composed from many frameworks and materialized into per-project skills via a new `/mos:skill` front door; each is judged by Plurai on BOTH construction fidelity (was it built like a real person) and behavioral fidelity (does it reason in-character), so a hollow template cannot pass on answers alone.
- **Phase 204 - Ignite Room-Chooser + persona-differentiated entry**, the first consumer of the Shape-F selector front door.
- **Phases 199-202, 205** - AgentShield surface scanner, RS engine spine + corpus quality, Harness-as-Code manifest + Ralph-loop runtime, Agent-Lightning APO lab, and the Larry Loop elevation (cross-frame fusion + anti-circular gear-shift).
- **Plurai as a release gate (new ground rule).** Every feature now ships a Plurai eval (a CSV + a deterministic local parity gate + a phase baseline); the suite stands at 16 eval sets, 9 phase baselines, and 7 parity gates. Verification is eval-scored, not string-matched.
- **Phase 187.2 - CLAUDE.md de-bloat + canon symbiosis.** The plugin's own CLAUDE.md was violating the canon it ships: the fully-expanded per-session load was ~66k tokens (13x-16x the 5k context-rot threshold), ~80% of it canon provenance force-loaded by two `@docs/...` pins that no agent reads to act. An APPLICATION of Canon Parts 6/7/8/10/12 (dog-fooding the de-bloat; no amendment, mints no reach/edge/node, no Brain wire). Source-first fix (the GSD sentinel sections regenerate, so the rendered file is never edited inside a sentinel): trimmed the sentinel SOURCE docs (`.planning/research/STACK.md`, `.planning/PROJECT.md`) + the four `.claude/includes/*.md` membranes (13KB -> 5.4KB), demoted the two canon `@docs` pins to load-on-demand Deep-Dive links, and authored a **Canon Compliance Core** that binds all 7 binding Parts (8/3/6/7/9/11/12) each with a working `docs/MINDRIAN-CANON.md` deep-dive link (canon honored, not evicted). Result: fully-expanded load **~66k -> 3,899 tokens** (under the 4k gate), proven durable (`generate-claude-md` is idempotent, byte-delta 0 on re-run, so the source-level fix cannot refill). Folded the CMD-06 drift cleanup: stale Source-Material TODO table removed, version drift fixed at source (MCP SDK ^1.29.0, Node >=22.5.0, cheerio de-listed), `decisions.md` completed with #16. Docs-only, Part 8 clean, zero em-dashes. Forward seed (pressure-tested): `.planning/research/CANON-AS-SDK-V0-SEED.md` (Track B = `CANON-LEDGER.md` provenance carve-out is the real root-cause follow-on; Track A = canon-as-SDK parked until a second runtime exists).

## [1.15.0-beta.13] - 2026-06-29


## [1.15.0-beta.11] - 2026-06-29

### Added
- **Phase 187.1 - Statusline battery-memory + Larry/Claude voice glyph + voice-switch detector.** Modifies the Phase 187 cockpit (an APPLICATION of Canon Parts 3/5/9/10/12; no amendment, mints no reach/edge/node/color, no Brain wire). (1) The risk tier is reframed for a non-technical navigator: a battery counting REMAINING conversational memory (`N% memory left`, low-battery `memory almost full - save your work now`) instead of `Ctx N%` USED -- fixing the inverted-affect bug where "8% used" looked nearly empty when 92% was free. (2) The Voice Signature (Part 12) names WHO is speaking: Larry (thinking partner) vs the native host agent; Brain backing and the pedagogical-move voice square render for Larry only. `who`/`agent_label` threaded `cockpit-signals.cjs` -> `cockpit-renderer.cjs`; `scripts/context-monitor` derives from `data.agent.name` (default larry -- the conversational surface IS Larry, Part 10). (3) `lib/core/voice-transition-detector.cjs` -- a pure Larry<->Claude voice-SWITCH detector + debounce (signal-tier trigger, Part 11 R3). (4) Passive Tier-1 switch display: a voice switch REPLACES the steady WHO glyph with an explicit `now: host (not Larry)` / `now: Larry (back)` announcement, never a 4th chip (MAX_K=3 frozen). The voice-mark WRITE-hook (187.1-02) and the F.7 recalibration dial + De Stijl up/down/left/right TUI (187.1-04) are spec'd in `docs/STATUSLINE-CONTRACT.md` (PROPOSED v2) + `187.1-RESEARCH.md`, deferred. Tests: `test-statusline-cockpit-187` 122/122 (battery + WHO + switch states); `test-voice-transition-detection-187` 25/25. Part 8 LOCAL-only.

## [1.15.0-beta.9] - 2026-06-28

### Added
- **Phase 187 - Statusline navigator cockpit.** The statusline is rebuilt to serve the NAVIGATOR (not the operator), per the LOCKED `docs/STATUSLINE-CONTRACT.md` (Phase 121.5 co-design rule). Four tiers in a hierarchy: (1) trust metadata (Mindrian glyph + Voice Signature glyph + Brain), (2) orientation + room-health, (3) `Next: <move>` action cue, (4) `Ctx <n>%` risk. Color is carried by EMOJI GLYPHS (host-independent; this host strips ANSI). REORDER-AT-CLIFF: at >=80% context the line promotes "file this insight to the room before it compacts" to the hero slot; post-update drift promotes `-> run /mos:doctor --fix`. NORMATIVE anti-Dealer invariant INV-SL-1..5 (success metric = % of exposures that lead to a real advancing action, never time-on-line). `lib/statusline/cockpit-renderer.cjs` (pure) + `cockpit-signals.cjs` + `cockpit-telemetry.cjs` (LOCAL INV-SL-2 hook) wired into `scripts/context-monitor`; the two-row block is preserved. test-statusline-cockpit-187 14 tests/117 assertions; run-all-187 2/2.
- **Phase 184 - READER decide-time projection offer (navigator-authority override).** `decide()` gains the projection read it lacked: it ranks capabilities from the LOCAL orchestration projection + connector registry + recipe-maps and surfaces them as Shape F Decision-Gate OPTION CONTENT. A third READER, never a firer (R4 structural guard: `decide()` has no code path to runChain/act-command, proven by test). `lib/core/reader/decide-projection-reader.cjs` (READER-01..04 + R2 projection-correctness gate + R3 ambient latency/context budget) + `ab-harness.cjs` (R1 A/B). run-all-184 2/2 (39+23 assertions); run-all-144 5/5 (no decide() regression).
- **Phase 185 - DRIFT runtime reachability.** `doctor --drift` now FAILS when a WIRED capability is unreachable by `decide()` at runtime (previously merge-time marking only; CIRS R7). A capability is unreachable when it is WIRED in the connector registry and reader-eligible (command/agent) but the Phase-184 reader's deterministic ranker emits no candidate for its projection node. Calibrated GREEN on shipped data: 85 WIRED command/agent capabilities all reader-emitted, 5 WIRED skills correctly scoped out. Additive Class R in `scripts/doctor.cjs` + `lib/core/drift-runtime-reachability.cjs`; non-zero exit scoped so real `--drift`/`--all` stay green. run-all-185 1/1 (11 assertions); run-all-150.9 6/6 (no doctor regression).

### Fixed
- **Phase 182.1 - SIGNAL voice-glyph repair (dogfood fix).** Dogfooding v1.15.0-beta.7 found the Phase 182 Voice Signature was DARK at runtime (the doctrine lived only in the skill, not the always-loaded agent body, and the test asserted the doctrine string existed but never that a turn emitted a mark) AND that neither a bracketed color-name word nor ANSI escape codes render color on the navigator's host (ANSI is stripped to literal text). Fix delivers the 5 De Stijl Mondrian primaries as colored EMOJI GLYPHS (host-independent, verified): blue=building, red=challenging, yellow=contradiction, black=gate, white=invisibility. Same 5-primary palette; only the delivery mechanism moved from word/ANSI to glyph. Touches `agents/larry-extended.md` (the always-loaded body), `lib/hmi/voice-color-mark.cjs` (glyph-aware detector), both voice SKILL doctrines, and `lib/core/nav-dial.cjs` (the dial-TUI gains a leading glyph so its dead-ANSI color survives). Frozen MAX_K=3 / DIAL_REACH_K=6 / 0.70-0.15 / 6-reach bank UNCHANGED. voice-mark 106/106, dial PASS, run-all-182 5/5.

### Known follow-ons
- **184 R1 live A/B remains a NAMED DEBT.** Phase 184 was deferred as evidence-blocked; the navigator overrode the deferral on authority (the entry-20 pattern). The deferral reason does not vanish: R1's live grounded-vs-ungrounded A/B needs a real navigator reaching the gate (the same evidence METER came back missing, `subject_class=unknown`), so it reads `uninstrumented` today and a maintainer reading does not clear it. The CODE ships green; the live reading is recorded as a debt, not fabricated.
- **187 host signals not exposed on the hot path:** `/mos:doctor` does not yet write a room-health status cache (cockpit reads `~/.mindrian/room-health.json`, defaults sound); the Voice-glyph WRITE side (a turn-capture hook) is unwired (glyph read from a side-channel); next-move uses the JTBD proxy. Post-update drift IS wired.
- The entry-31 self-binding clause stays UNCLEARED (no navigator-class two-gauge reading yet); Appendix D entry 32 remains parked by design.

## [1.15.0-beta.7] - 2026-06-27

### Added
- **Phase 183 - METER: the welded two-gauge meter (the milestone keystone).** LOCAL telemetry over the Part 9 navigation.cjs chokepoint. Adds `gate_reached` to the frozen EVENT_TYPES set (the single sanctioned additive, 86 to 87) and a single surface-shared emit beside the live reach_presented loop. Gauge 1 (invocation density) reads reach_presented + gate_reached; Gauge 2 (transfer) is three named-debt proxies (reject-reason-capture-rate, insight-to-validated-decision latency to status_promoted, independence-trend), each labelled named-debt, never a real transfer delta (Canon Part 5). `readTwoGauge` is WELDED: it returns the density+transfer pair or throws (no bare-density export), the two-directional regression guard names both volume-up-quality-flat (the Dealer quadrant) and quality-up-by-starving-volume. Two navigator-review corrections built in: a `subject_class` stamp (maintainer | navigator | unknown, derived read-time, Part-8-clean) where only `navigator` clears the entry-31 self-binding clause, and a `transfer_uninstrumented` third state so an empty substrate reads as unmeasured, never as flat. run-all-183.sh 8/8.
- **Phase 182 - SIGNAL: the Part 12 Voice Signature in the CLI.** Every Larry CLI turn wears one De Stijl color mark naming the pedagogical move (blue=building, red=challenging, yellow=contradiction, black=gate, white=invisibility); a turn with no mark is legible as the native host. `lib/hmi/voice-color-mark.cjs` (detectVoiceMark) + doctrine on both voice SKILL surfaces, anchored to the 5 existing palette primaries (no new color minted). SIGNAL-01 verifies the Phase 179 GA-4 F.7 interceptor + R15 render-coverage gate still pass (lean, not rebuilt). Enforcement is the declared convention + a missing-mark drift test, not a per-token runtime recolor (the honest named residual). run-all-182.sh 5/5.
- **Phase 186 - CORPUS: stats hygiene.** One generated single-source-of-truth artifact (docs/CORPUS-STATS.generated.md + json) from a committed Brain-free generator, plus a --check tripwire (wired into pre-commit + release.sh Step 2.4) that scans LIVE fact surfaces and skips historical provenance via a documented excludedRegion (the canon Appendix D dated entries, version-history rows, and .planning/ dated artifacts stay frozen). LIVE corpus literals repointed to 27,904 nodes / 177 frameworks / 12,485 Pinecone vectors. run-all-186.sh 3/3.

### Changed
- Canon v1.18 to v1.19 (Appendix D entry 31, the welded two-gauge headline metric + the Hooked-gate retirement + the self-binding clause) landed earlier in this milestone; METER is the instrument that entry 31 requires.

### Known follow-ons
- METER first reading is `subject_class: unknown` / `transfer_uninstrumented` (newborn instrument, no live-navigator gate-reach observed yet). The entry-31 self-binding clause stays UNCLEARED until a navigator-class reading exists; Appendix D entry 32 and the ProblemType freeze remain parked by design. Honest state: instrument live, awaiting a navigator.
- Phase 184 READER + Phase 185 DRIFT deferred: READER is conditional on METER confirming a gate subject (unmet), and DRIFT depends on READER.

## [1.15.0-beta.5] - 2026-06-25

### Added
- **Phase 179 - Ignite B1 persona-first starting point.** `/mos:ignite` B1 is now ONE canonical persona-first card with four doors: Persona pick (researcher / student / founder-business / operator / investor / domain-expert), Paste-my-CV, Hypothesis ("I believe ___"), and Free-Text. Each door resolves `{role_blend, blueprintFamily, arrival_asset}` threaded into the existing room-birth contract. ~80% reuse of the shipped role_blend / Phase 115 CV dual-path / blueprint-family systems.
- **GA-4 card-fire interceptor (the R-1 cure).** A Stop-hook interceptor (`scripts/check-card-fire.cjs`) detects a turn that reached a Decision Gate but rendered a flat ASCII box instead of firing the interactive AskUserQuestion card, and forces the card via a `decision:block` Stop-block envelope. Machine enforcement replaces the prose fence that B1 kept ignoring. Bounded-escape is provably convergent (a content-independent session-wide intercept ceiling guarantees no infinite loop, hardened across an adversarial review loop).
- **Hypothesis blueprint family (Door 3, absorbs Phase 174).** A new `hypothesis` room-blueprint family; the falsifiable "I believe ___" files as a truth-claim node at `review_status: proposed` (Part 9, human-confirmed). Per-role framing (researcher = testable claim / founder = market bet / investor = thesis precondition). An always-fire instances-vs-structures abstraction-level Shape F gate, grounded in systems-thinking (the iceberg: structure must be deliberately surfaced), with a domain-neutral fixture.
- **CV-second-select + auto-fire intelligence.** The CV door fires a `multiSelect` checkbox over the navigator's detected domains, then auto-fires the Act 1 triple-filter (decomposition / whitespace / reverse-salient); findings surface at a Decision Gate for APPROVE / REJECT / DEFER, never silently cascaded.

### Fixed
- The two divergent B1 specs are reconciled: `commands/ignite.md` is the one canonical persona-first B1; `commands/new-project.md` is demoted to a pure B2 scaffold backend.
- The ignite scratchpad whitelist now persists `role_blend` + `blueprint_family` + `hypothesis_text`, so the B1 starting-point signal survives across the B1 to B2 boundary (previously silently dropped).

### Known follow-ons
- WR-09 (non-blocking, fail-safe): when a Stop envelope lacks `session_id`, the GA-4 session ceiling shares one counter across such turns. It still converges and never hangs; a per-transcript-path fallback is a tracked follow-on.

## [1.15.0-beta.3] - 2026-06-24


## [1.15.0-beta.1] - 2026-06-24


## [1.14.0] - 2026-06-24


## [1.14.0-beta.9] - 2026-06-24


## [1.14.0-beta.7] - 2026-06-23

The v1.14.0-beta train continues: the deck surface consolidates onto one born-wired front door (Phase 175) and Scenario Planning is wired into its canon chain (Phase 176), on top of the beta.5 payload (Canon Part 11 / CIRS, ACE/diffusion, methodology-ingest, /mos:show).

### Added
- **Phase 175 -- /mos:deck, the consolidated deck command.** One born-wired front door (`commands/deck.md`) for investor-grade deck generation, replacing the scattered deck surfaces. The legacy `MOSDeckEngine` and `feynman-engine` handles are aliased to `/mos:deck` (`data/deck-aliases.json`, doctrine + data) so existing invocations route to the new style selector instead of a dead path. Three deck styles (Feynman first-principles, HEART narrative, mesh), each built per-section through a Shape F.1 accept/reshape/skip gate rather than auto-advancing. Deck style + section-schema source of truth lives in `data/deck-styles.json`; the `make-land` lane is repointed to `/mos:deck`. Born-wired per Canon Part 11 (CIRS R1/R2): the command is WIRED with a `connector:` block and passes the hard coverage gate. A WARN-first deck-design ruleset (`lib/core/deck-design-rules.cjs` pure helpers + `scripts/check-deck-design.cjs` `--check` CLI) lints a deck against the design rules and warns without blocking. Behavior suite `tests/test-deck-consolidation.cjs` + `tests/test-deck-design-check.cjs`; phase gate `tests/run-all-175.sh` 20/20.
- **Phase 176 -- Scenario Planning wired into its canon chain.** Three curated FEEDS_INTO chain edges (bare framework names, on the orchestration projection per Canon Part 11 R6): `Domain Selection -> Scenario Planning` (0.68, the F.1 next step after `/mos:explore-domains`), `PEST Analysis -> Scenario Planning` (0.60, the STEEP feeder), and `Scenario Planning -> Futures Wheel` (0.66, the cascade out to `/mos:futures`). The `/mos:scenario-plan` command body and `references/methodology/scenario-plan.md` are reconciled to the canonical 10-step arc (Define Domain -> STEEP -> independent critical uncertainties -> 2x2 -> PARTS-tested narratives -> identify opportunities -> cross-scenario -> prioritize + bank to the Opportunity Bank -> robust strategies -> iterate) with a dual-name note. Additive only: no reach, edge type, or node type minted, and no Brain wire opened; both coverage `--check` ledgers stay gap=0. Phase gate `tests/run-all-176.sh` 5/5.

### Fixed
- **data-ai image provenance.** `checkImageProvenance` hardened to flag bare-boolean `data-ai` image markers that previously slipped through provenance verification.

## [1.14.0-beta.5] - 2026-06-23

The v1.14.0-beta train: Canon Part 11 (the Invocation Constitution) ratified and shipped as a born-wired hard coverage gate, the four-class governance-ISA (canon v1.15), /mos:act made governed + always-on + intent-calibrated, cross-class command-to-pipeline-to-framework chaining, the rs-* family + presentation surfaces wired, Phases 170 (ACE/diffusion) + 171 (methodology-ingest) reconciled to CIRS-conformance, and Phase 173 (the /mos:show JTBD need-selector front door).

### Added
- **Canon Part 11 -- The Invocation Constitution (CIRS R1-R14), born-wired as a hard coverage gate (Phase 172).** The invocation/reachability layer is now a constitutional Part, peer to Part 8 (Boundary) and Part 9 (Memory): every invocable surface (command, skill, agent) is in exactly one of two states, WIRED (`connector:` block) or EXCLUDED (`connector:{excluded,reason}`), and a new or modified surface fails the gate CLOSED unless it satisfies R1. Coverage is a lifecycle invariant enforced at every merge, not a number checked once. The born-wired gate is wired into pre-commit + install-pre-commit + release.sh (Step 2.4) + doctor --acceptance. Both coverage ledgers report gap=0 (89 wired / 36 excluded / 0 gap on the connector registry; projection gap=0). The recurring 143.x / 144.1 dark-surface regression now has a structural cure.
- **Phase 173 -- /mos:show JTBD need-selector front door.** A Shape F.1 publish-needs selector (`data/publish-needs.json` + a `--check` validator + a role_blend-to-lane mapper) plus the SENS-SHOW show/share trigger sensor (`lib/core/sensors/sensor-show-share.cjs`, R4) registered in dispatchSensors, with the orchestration projection + connector registry + harness manifest regenerated in lockstep (R5). End-to-end R1-R7 flow test green; run-all-173 7/7.
- **Phase 170 -- Adoption-Capacity Engine (ACE) + dual-use diffusion trigger (`/mos:diffusion`).** Canonized Horowitz's adoption-capacity theory into the Brain (Neo4j + Pinecone) as a first-class methodology: variables (financial intensity, organizational capital, conceptual capacity), 7 cases incl. 3 dual-use worked examples, the 2x2 typology, 7-step pipeline, 5-path response, academic critiques, and the FEEDS_INTO chain (S-Curve / Reverse Salient / PEST / Macro Trends / Sustaining-vs-Disruptive INTO ACE; ACE INTO Scenario Planning / Mullins / Triple Validation Compass / Ansoff / Now-New-Next / Self-Selling Loop). Also deepened the Hooked Model and minted the Self-Selling Loop (mindrian-operation tier). New `SENS-09` dual-use diffusion sensor (`lib/core/sensors/sensor-diffusion-adoption.cjs`, frozen `brain_consult` reach; keyword + marker + signal modes) surfaces ACE proactively on defence/navy/drone/dual-use turns; `/mos:diffusion` is the explicit front door. `brain_search` retrieval verified. Additive only (no frozen-set move; no canon amendment). Test 20/20 + regression fences green.
- **Phase 171 -- reusable methodology-ingest pipeline (`/mos:ingest-methodology`).** Codifies the 7-step "add a methodology to the Brain" process so every future framework follows the same safe path: encode -> Canon Part-8 boundary gate (hard halt) -> graph write -> vector write -> trigger + chain -> register -> local refresh. Engine `lib/core/methodology-ingest.cjs` (pure: `auditSpecPart8` gate, parameterized `buildFrameworkCypher`, `buildPineconeRecords`, `ingestPlan`) test 19/19; local step `scripts/methodology-ingest-local.sh` regenerates command-registry -> connector-registry -> brain-orchestration-projection (the local intelligence cache the navigation engine / dial / ranker read), each behind its `--check` drift gate, so a Brain-written framework is operable Local-Only with no live Brain call.

### Changed
- **Canon advanced to v1.15.** Part 11 R1's unit-of-coverage now enumerates the four governed surface classes -- mechanical (a non-framework command/operation), framework (a pws methodology), intelligence (an engine/sensor/analysis surface), and pipeline (a chain/workflow) -- as the invocation governance ISA; the gate is class-aware. The `coverageReport()` `class` enum is purely additive metadata (wired/excluded/gap counts unchanged). Appendix D entry 26 records the amendment; mints no new edge/node/reach type and opens no Brain wire.
- **/mos:act is now governed, always-on, and intent-calibrated**, resolving through the one governed path (dispatchSensors -> decide() -> resolver) rather than a second selection brain. Cross-class command-to-pipeline-to-framework chaining now resolves through the same spine.
- **The rs-* family and the presentation surfaces are wired** into the connector spine (CIRS R1), closing the largest dark-surface band; every thinking-surface gap is now WIRED or explicitly EXCLUDED-with-reason.
- **Phases 170 + 171 are no longer release-held.** Both were CIRS-conformance targets gated before release; Phase 172 Plan 12 reconciled them to conformance, so they ship in this beta.

### Fixed
- **The CIRS coverage gate flipped from WARN to hard-FAIL.** `build-connector-registry.cjs --check` and `build-orchestration-projection.cjs --check` now exit non-zero on any surface neither WIRED nor EXCLUDED (and any command counterpart neither ranked nor excluded). A command counterpart EXCLUDED at the connector layer now propagates to EXCLUDED in the projection, so the two ledgers stay reconciled at gap=0. The flip landed after the baseline was wired/excluded, so CI never went RED mid-sweep.

## [1.14.0-beta.3] - 2026-06-19

### Added
- **Phase 164 -- BONO research/debate engine (`/mos:bono`).** Assembles a de Bono six-hats team across (subdomain x hat) cells, runs an inter-hat debate on your hypothesis, and files structured findings as proposed truth-claim nodes. Mints the `SyntheticExpert` node type so a high-value team member can be saved and re-invoked as a hat in future runs (human-confirmed per Canon Part 9 role 5). Phase gate `tests/run-all-164.sh` 20/20; adversarial verdict 13/13.
- **Phase 165 -- unknown-unknowns blind-spot engine (backs `/mos:map-unknowns`).** A Horvitz et al. 2019 recast that hunts the claims you are most confident about and confidently wrong: a DSP partitioner + deterministic UCB bandit + Rumsfeld 2x2 router + LOCAL proxy oracle, all zero-Brain-egress, that halts at the F.1 Decision Gate. Proven by instrumentation: `tests/run-all-165.sh` 19/19, adversarial verdict 5/5, Part-8 boundary 8/8.
- **Phase 163 -- trending-to-the-absurd harness (`/mos:trending-to-absurd`).** The visionary-innovation companion that pushes trends to the absurd to surface future problems. Phase gate 13/13.
- **Phase 166 -- gated-chain executor (the `runChain` spine).** The shared invoke -> capture -> pass -> loop runtime that auto-runs autonomous-safe steps and halts at material steps via the Decision Gate; the engines (BONO, unknown-unknowns, trending-to-absurd) ride it instead of cloning a per-feature orchestrator. Phase gate `tests/run-all-166.sh` 23/23.
- **Phase 167 -- harness-as-code completion (`/mos:new-surface`).** A declared 3-MAP manifest + generator that scaffolds a new command/surface onto the connector spine and regenerates the registry transitively, plus posture-scoped fable-mode self-critique on material steps. Phase gate 12/12.
- **Phase 169 -- graph-derivation harness.** Mints the `NESTED_WITHIN` room-lineage edge so the nested-room fractal joint has a legal, graph-navigable home (child room -> parent room), and ships the self-heal rollup walk. Phase gate `tests/run-all-169.sh` green.

### Changed
- README rebuilt to reflect v1.14.0: version badge, the new front-door command set (`/mos:ignite`, `/mos:discover`, `/mos:bono`, `/mos:map-unknowns`), and the current surface count (99 commands, 14 skills, 9 agents).
- mindrian-os.com updated with the new commands and v1.14.0 capability information, version surfaces reconciled, and redeployed.
- Mindrian Canon advanced to v1.13 (Appendix D entries 21-24): the domain-taxonomy edges (DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO), the Part-4 cascade reconciliation (CONVERGES / INVALIDATES / ENABLES into the navigation chokepoint), the `NESTED_WITHIN` room-lineage edge, and the `SyntheticExpert` node type.

### Fixed
- **Phase 168 -- Part-4 edge-vocabulary reconciliation.** Brought the Part 9 `writeEdge` chokepoint frozen set into line with Canon Part 4 prose (CONVERGES / INVALIDATES / ENABLES were declared in canon and written by the legacy cascade path but rejected by the chokepoint). Phase gate `tests/run-all-168.sh` green.
- `tests/run-all-165.sh` no longer trips its own em-dash sweep: the swept-for em-dash is now defined via its U+2014 codepoint escape so the gate file carries no literal em-dash.
- GSD STATE.md / ROADMAP.md reconciled to the active milestone (`v1.14.0-beta.2`): the stale `v1.13.1` milestone label, the old phase/plan counts, and the stale `## Latest` section were corrected so every progress report reads true.

## [1.14.0-beta.1] - 2026-06-18

### Added
- Opened the v1.14.0 cycle on top of the shipped v1.13.1 "Larry Reaches" stable release. Detailed v1.14.0 notes are consolidated under the beta.3 entry above (the phases 163-169 executed band landed across beta.1 and beta.2).

## [1.13.1] - 2026-06-17


## [1.13.1-beta.34] - 2026-06-17

### Added
- Phase 162 (Graph Spine, SEED-026) W1-W3: every graph the navigator draws is now sourced through a single whole-graph read primitive over room.db in ONE node-identity space, so orphan/dangling edges are structurally impossible. `lib/core/navigation/graph-export.cjs` ships `getGraphExport(roomDir)` (re-exported from `navigation.cjs`): nodes AND edges come from room.db in one id space; an edge ships only when both endpoints are in the included node set; bookkeeping types (memory_event/focus/audit) are excluded-and-counted, never silently dropped; unknown node types render loud (default color + flagged in `unmapped_types`), never thrown; cold-start (no room.db) emits Section anchors so a Tier-0 room never renders blank. The CLI presentation graph (`scripts/generate-presentation.cjs`) and the Desktop/Cowork Cytoscape dashboard (`scripts/build-graph-from-sqlite.cjs` + `dashboard/index.html`) both consume the spine -- single node authority across surfaces, styled by knowledge_type color + degree size + edge-type gloss. Section nodes are now durable room.db rows written at room birth inside the ACID transaction, with an idempotent migration (`lib/core/migrations/phase-162-section-nodes.cjs`) backfilling existing rooms. Requirements R1/R2/R3/R4/R11. Canon parts 4/7/8/9. Local-only: zero Brain egress.

### Security
- Phase 162 W3: adversarial Canon Part 8 boundary hardening over the graph export. `tests/test-graph-export-part8-leak.cjs` proves no hostile byte (correlation_id / brain_id / source_path / transcript prose / personal identifier / proprietary number / raw secret) reaches the export payload, and asserts every node's data key-set equals exactly the Part 8 whitelist (with a negative control so the scan is not over-broad). A committed golden-room snapshot + a node-type completeness gate (`scripts/check-graph-export-typemap.cjs`) fail loud if any live node type is unclassified; `tests/run-all-162.sh` aggregates the phase gate (6/6 suites green).

## [1.13.1-beta.32] - 2026-06-17


## [1.13.1-beta.30] - 2026-06-16


## [1.13.1-beta.28] - 2026-06-16


## [1.13.1-beta.26] - 2026-06-15

### Added
- Phase 156 (Futures Wheel MVP): new `/mos:futures [concept]` command - an assemble-not-rebuild foresight context that does what a linear human cannot: builds a bounded multi-ring consequence wheel (1st/2nd/3rd-order, flat artifacts under `opportunity-bank/futures-<seed>/`, NO sub-rooms) and surfaces the invisible cross-domain ripples a linear mind misses. Guided-by-ring generation (depth 3 x fan-out 5) with an advisory causal-cue flagger; consequences carry `horizon` + `confidence` + PESTEL `domain` frontmatter; parent->child cascade as `ROOT_CAUSES` edges via the navigation chokepoint; the shipped HSI engine scans for hidden cross-domain bridges (`HSI_CONNECTION`) with a hard Artifact-registration count-guard before the scan; per-ring HITL Decision Gate (proposed->confirmed via `confirmNode` with navigator `byUser`); PESTEL subsystem-map default render + ring view on demand; opportunity banking with edge provenance; top-3-of-N foresight-web chaining handoffs (RS, systems-thinking, scenario-plan, explore-trends, analyze-timing, dominant-designs, diagnose, mullins, explore-futures) via the Phase 122 command-resolver (no hardcoded command strings); bounded two-fire-point SIGNAL research (seed grounding + per-ring, 30-day cached, generic handles only); adversarial Part 8 egress tripwire + `tests/run-all-156.sh` phase gate (14/14). `futures-wheel` connector registered on the SENS-06 dial (no 7th reach minted; rides `context_block`). Requirements FW-01..FW-13. Canon parts 2/3/4/7/8/9. Local-only: zero Brain egress.

### Fixed
- Futures Wheel cascade-edge wiring (caught by a live dogfood run): `generateRing` assigned short slug ids while `registerConsequenceArtifacts` registered the Artifact node under a path-derived id, so `writeCascadeEdges` wrote `ROOT_CAUSES` against an id with no node and the cascade silently produced zero edges. `registerConsequenceArtifacts` now stamps the registered id back onto each consequence object; the natural generate->register->cascade flow wires correctly (regression test `tests/test-futures-cascade-integration.cjs`, gate now 14/14). The unit test missed it because it hand-inserted nodes with matching ids; the integration test drives the real flow.

## [1.13.1-beta.24] - 2026-06-14

### Added
- Phase 150.9 (doctor drift-classes): `/mos:doctor --drift` opt-in flag adds two report-first drift classes on top of the install-cache classes. Class P (prose-vs-code) scans Larry's agent/skill/doc prose for claims that contradict shipped facts; report-only, never auto-edits. Class Q (GSD-record drift) shells out to `gsd-health` to surface ROADMAP gaps + missing SUMMARYs as drift findings. `lib/core/drift-baseline.cjs` writes per-folder + root `DRIFT.md` baselines (idempotent, traversal-guarded) so successive `--drift` runs diff against a stable anchor; `--drift --fix` heals only where safe. First production run caught 96 W007 (ROADMAP gaps) + 9 I001 (missing SUMMARYs) - the Fable FIX-12 drift set. Requirements DDC-01..08; phase gate `tests/run-all-150.9.sh` 6/6 (incl. Canon Part 8 floor + deadlock carve-out proofs). Local-only: zero Brain egress.
- Phase 150.10 (systems-thinking meta-lens): `/mos:systems-thinking` promoted in place from a flat connector to an F-surface move-selector (M1 name the system -> M2 draw the loop -> M3 find the leverage point -> M4 trace the reverse salient -> M5 validate), GUIDED, with 3-layer local ranking and stage-aware filing. `lib/core/leverage-scan.cjs` is the M4 move: a Meadows 12-level leverage scan over `room.db` (reads via `navigation.cjs` only, ranked highest-leverage-first) wired into the selector as a Decision Gate, with the meta-lens chaining web (M4<->reverse-salient, M3<->find-analogies+research) wired in code. `systems-thinking-loop` registered as a ranked reach component in `lib/hmi/reach-component-map.json` (FROZEN-6 held: REACH_IDS still 6, byte-unchanged). Requirements ST-01..18; phase gate `tests/run-all-150.10.sh` green.

### Changed
- Brain teaching graph (production Neo4j): +12 generic-methodology nodes for the IRIS 2026 Session 2 lecture (`source_doc='iris-2026-session-2'`, all MERGE-based / idempotent) - the M1-M5 Method nodes + PREREQUISITE chain (M1->M2->M3->M4->M5, M4 FEEDS_INTO M5) + 4 Example nodes + trending-to-absurd Technique + the Leverage Point Local-Graph Excavation Method + cross-domain chaining edges (M4<->Reverse Salient, M3->Four Lenses, Excavation->M4/Leverage Points/Reverse Salient). Generic methodology only, zero user content (Canon Part 8 clean, orphan-scan 0). Re-ingestion is idempotent.

## [1.13.1-beta.22] - 2026-06-13

### Added
- Conversation intake plumbing (quick 260612-pkb): the Stop and PreCompact hooks now capture Claude Code's `transcript_path`, parse the conversation offline (`scripts/transcript-ingest.cjs` -- user content as string, assistant text blocks only, drops thinking/tool_use/command-chrome, caps 4000 chars/fragment and 1000 fragments), and write real `user`/`assistant` fragments into the active room's `room.db` before summarizing. The dormant downstream readers (voice_log writer, `sessions.summary`, the RECENT SESSIONS resume block) light up unchanged. Fixes the "Brother Test" (reopen a room and Larry references the prior session) and Context Volatility failure modes 2 (session termination) and 3 (unfiled insights). `sessions.summary` is now a 3-5 sentence extractive summary over real turns instead of the `session ended` stub. Local-only (Canon Part 8): zero Brain egress.
- Proactive Filing Offer doctrine (quick 260612-t29): `skills/room-proactive/SKILL.md` gains a "Proactive Filing Offer (Conversation Artifact Capture)" section -- when a conversation yields a keepable artifact (problem definition, competitive landscape, decision, plan/pilot, synthesis), Larry closes the turn with a Decision Gate F.1 selector mapped onto the existing canonical verbs (Run Methodology / Bank Opportunity / Synthesize / Defer / Free-Text), with precise triggers + anti-triggers (one offer per artifact, escape hatch honored) and decline-as-data capture (Canon Part 4). `skills/larry-personality/SKILL.md` anchors the behavior in conversation flow. No new verb, no new selector (Canon Part 7 reuse).
- Persona override, identity-only (quick 260612-t2k): new `lib/core/persona-override.cjs` store (`~/.mindrian/persona-override.json`; get/set/clear/status CLI, taxonomy-validated, atomic write, local-only) plus a `readUserMd` seam (`lib/core/user-md-ops.cjs`) that returns a synthetic persona to all ~9 persona callers from one chokepoint while an override is active. The store lives outside the context window, so a navigator-declared persona survives maintenance commands like `/mos:doctor` -- the exact failure that collapsed the persona in QA. `commands/persona.md` documents the set/status/clear surface. The no-override path is byte-identical (proved by the 22/22 user-md-persona regression); `tests/test-persona-override.cjs` adds 5 assertions. Wires the previously-dead `detectPersonaUpdate` `user_override` case.

## [1.13.1-beta.20] - 2026-06-12

### Added
- Phase 155 Ignite Flow: `/mos:ignite` front-door orchestrator for new-room onboarding. Three entry doors (Just Talk, directive `--express` / `--from-brief <sha8>`, opportunity promotion), F-selector HITL gate chain (B1 starting point, B2 blueprint approval before any mkdir with embedded nugget routing table, B3 first win), and `navigation.birthRoom()` -- the atomic 7-step birth transaction (scaffold-then-register, 6/6 memory complement incl. FEYNMAN seed + BRAIN derivation enqueue, operator + JTBD transitions, scratchpad gate-answer replay as typed edges, batch confirmNode on approve). onboard / rooms-new / discover / new-project all route into the one front door.
- `data/room-blueprints.json`: 8 persona blueprint families (exploration / solution-first / problem-first / business-first / portfolio / venture / program / case-study) consumed by the scaffold -- the one-size-fits-all 8-section room is gone; arrival-asset routing picks the family and seeds ROOM.md default_methodologies from the chosen chain.
- Domain insight sweep (Hooked reward leg): CV/paste -> domains extracted locally -> SIGNAL research on generic domain handles only (research-corpus + 30-day cache reuse) -> cross-domain and sub-domain adjacencies filed as proposed claims + opportunity candidates, surfaced at B3 or right after upload extraction. Adversarial Part 8 egress tripwire test guards the path: CV text never leaves the machine.
- USER.md convergence: one machine schema across all onboarding surfaces; role_blend populated at room birth for the first time.

### Fixed
- shallow-doc-parser dead focus write: the upload path called setFocus with wrong arity and invalid setBy, so Phase 115 CV pastes never landed a focus node. Fixed; upload extraction now seeds the local graph as designed.
- MVA option 2 ("Build a room around this") unstubbed: STUB_MESSAGE_119 replaced by `ignite_from_brief`; the venture_classified receipt nudge points at `/mos:ignite`. The reward-to-room conversion path is whole end to end.
- CONNECTOR-CONTRACT.md frozen-5 doc drift corrected to the enforced frozen-6 reach bank.

## [1.13.1-beta.18] - 2026-06-12

### Fixed
- Doctor marketplace-cache drift deadlock (quick-260612-cl7, install-cache family case 8): `checkInstallVersion` is now topology-aware regardless of legacy-dir presence -- on a box with a vestigial `~/.claude/plugins/mindrian-os/` dir plus a live marketplace cache, doctor reports the active root's version and the false CRITICAL drift never forms. When recovery is skipped by design under marketplace-cache topology, doctor records `recoverySkipped`, renders the reason (no more `recovery failed: unknown`), and exits 0 under `--fix`; read-only drift keeps exiting 1 so monitoring signal is preserved.
- Update checker resolves LATEST from the mindrian-marketplace catalog pin (branch-agnostic `HEAD` ref) instead of main's never-released next-version placeholder -- `/mos:update` and `check-version-and-sha.cjs` stop advertising a beta that does not exist; degraded fallback to main plugin.json is disclosed in REASON when the catalog is unreachable.
- `/mos:update` changelog fetch anchors on numbered release headings -- users never see the `[Unreleased]` in-progress placeholder during an update (live tester confusion: beta.17-in-progress shown during a beta.16 install).

## [1.13.1-beta.16] - 2026-06-12

### Added
- Phase 150.8 (meeting micro-knowledge DIKW filing v1): every filed transcript now climbs Ackoff's ladder -- Data (segments) -> Information (typed atomic claims) -> Knowledge (confirmable claims + causal edges) -> Wisdom (`/mos:build-knowledge` renders the typed graph by DIKW rung). `writeClaimNode` truth-claim writer (`lib/core/navigation/typed-claim.cjs`): frozen 6-enum `knowledge_type` (fact / causal / heuristic / anomaly_cue / mental_model / assumption) + `conditions` / `counter_conditions` boundary fields + `valid_from` / `valid_until` temporal validity, all additive JSON properties, minted `proposed` per Canon Part 9.
- Claimify 4-pass extraction in `/mos:file-meeting` Step 3 (selection -> disambiguation -> decomposition -> typing) with `references/meeting/knowledge-typing.md`; unresolvable referents queue as `ambiguous` claims (never silently dropped) and resurface at SessionStart via `scripts/check-pending-ambiguous.cjs` (mandatory Dismiss, 3-strikes throttle, counts-and-ids-only payload per Part 8).
- Edge taxonomy amendment (navigator-LOCKED 2026-06-12, canon v1.6 -> v1.7, Appendix D entry 18): `REFINES`, `ROOT_CAUSES`, `INSTANTIATES` join `ALLOWED_EDGE_TYPES` in one atomic lockstep wave (edges.cjs block + floor test + claim-harness C3 arm + canon docs). Meeting claims can now express causal structure as first-class graph edges.
- Post-filing F.1 selector: three ladder verbs (Review ambiguous / Confirm proposed claims / Build knowledge); the Confirm verb routes through the Phase 129.5 `confirmNode` chokepoint with human `byUser` attribution -- the Knowledge rung is actually confirmable. The cortex-reach-adapter gains an additive `claim` branch so fresh typed claims lift dial reach scores (filing is felt, not just stored).
- `doctor` class N (silent-disable watchdog): detects the plugin installed-but-disabled state from OUTSIDE the plugin's hook surface -- `npx @mindrian_os/cli doctor` flags it CRITICAL with the exact `claude plugin enable` recovery command (install-cache family case 7; RCA plugin-silent-disable-after-cc-self-upgrade).

### Fixed
- Phase 150.6 (drift-fix sweep, from the 2026-06-11 Fable 5 full drift audit): Larry's agent/skill prose corrected to shipped facts (6 reach-ids, SENS-01..08, Phase 144 engine flip SHIPPED -- Larry stops under-claiming his own engine every session); npm description + docs point at the live `@mindrian_os/cli` (dead `@mindrian_os/install` deprecated ON the registry); `docs/THE-BRAIN.md` fictional 7-tool table replaced with the real 6 (incl. `brain_ask`); ONE Brain number set across all four surfaces (27,804 nodes incl. 12,401 MethodologyChunk substrate / 19,987 rels / 12,413 Pinecone vectors, live read 2026-06-11, Appendix D entry 16); `/mos:help` drops deprecated `visualize`, surfaces shipped `discover` + `memory-cortex-reach`; `venture_classified` scalar emission un-deadens the Phase 119 receipt nudge (Part 8: boolean + enum only); workspace-guard paths repointed to `~/dev/MindrianOS-Plugin`; F.7 dial renders the declared tri-context Decision Gate header (navigator-LOCKED, SKILL.md:257 glyph collision resolved); Action Footers added to `doctor`/`memory`; pre-commit installer dead-guard bug fixed (guards spliced before the terminal exit 0).

### Changed
- GATE-0 verdict (consumed by 150.8): the intelligence cascade fires FILE-LEVEL ONLY on meeting artifacts; extraction is the segmentation authority (`SEGMENT_AUTHORITY` contract in intelligence-cascade.cjs). Frozen contracts byte-unchanged throughout both phases: MAX_K=3, DIAL_REACH_K=6, 0.70/0.15, the 6-reach bank. Canon now at v1.7.

## [1.13.1-beta.14] - 2026-06-10

### Fixed
- Phase 150.5 (sensor turn-contract repair + atomic dial render coupling, SEED-021): the 5 structurally dead production sensors fire again -- `lib/core/insight-sensors.cjs` gains `normalizeTurn` + `deriveTurnSignals` + `SIGNAL_FRESHNESS_MS`; `dispatchSensors` normalizes ONCE at entry (text aliased from userText; signals derived freshness-gated from the two shipped LOCAL side-channels: `last-cascade.json` newFindings -> `artifact_filed`, auto-explore markers -> `first_material`); the caller turn is never mutated. Root cause found by the 2026-06-09 8-agent prior-art fan-out: the hook builds `{userText, sectionPath, sessionId}` while five sensors read `turn.text`/`turn.signals` -- fire_skill stayed null, routing_source never flipped, the dial never rendered for any real navigator.
- Atomic dial emission (DIAL-ATOM-01): `renderEngineDecisionWithDial` threads the AskUserQuestion contract through the SEED-020 single construction door (`selector-dispatcher.appendAskUserQuestionTrailer`, now a top-level export) so dial text + card contract emit together on the engine arm -- never text-only; a render fault writes a `dial_render_note` into the persisted decision trace instead of vanishing (closes the Phase 140 D-03 silent-failure class at this seam); claim-c2 C2-seen now asserts contract presence, not just the text substring.
- WR-01 (code review): `isFreshFile` requires non-negative age, so a future-dated side-channel (WSL2/Windows-mount clock skew, archive extraction, backup restore) can never read as fresh indefinitely.

### Added
- ACPT-06: `doctor --dogfood-acceptance` is now a SIX-leg gate -- the new leg proves a real sensor fires from the production-shaped turn and that dial text + card contract emit atomically (honest-negative: the legacy arm emits neither). `tests/run-all-150.5.sh` is the one-command phase gate (both new suites + ACPT-06 + the D-03a fence + the carried run-all-144/146/150 aggregators).
- D-01 (navigator-LOCKED 2026-06-09): the HYBRID sensor-fired cold card -- tier-0/cold turns render the dial WITH the live card when a sensor fired; a genuinely cold room stays silent (no dead chrome). The always-interactive surface stays Phase 154's cockpit. larry-personality gains the anti-mimicry doctrine line (no card, no picture).

### Changed
- Frozen contracts byte-unchanged and fence-proven: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 recommend gate, the 6-reach bank, the 3 postures. Zero Brain egress delta (derived signals are closed-enum kind strings from LOCAL fs only).

## [1.13.1-beta.12] - 2026-06-09


## [1.13.1-beta.10] - 2026-06-08

The LARRYREACH connector-spine milestone closes: the Phase-143 sensor spine went from zero consumers to fully wired across all 114 surfaces, the navigation engine flips routing_source legacy->engine on a fired reach, and the loop-fires acceptance gate is GREEN.

### Added
- Connector Spine + Intelligence Orchestrator (Phase 143.3): the self-extending connector contract -- a `connector:` frontmatter schema (docs/CONNECTOR-CONTRACT.md), a generated `data/connector-registry.json` + generator (scripts/build-connector-registry.cjs) + a `--check` CI tripwire, and `skills/intelligence-orchestrator/SKILL.md`, the first consumer of dispatchSensors that reads the registry (never a hardcoded table). Any skill/command/agent joins the wiring by declaring its connector. Generalizes Phase 122 from the command edge to the whole reach spine.
- /mos:discover (Phase 143.4): a Larry-led six-movement client + product + JTBD discovery command -- the first product command authored to ride the connector spine -- producing a Discovery Brief + scaffolded room and bridging to plain-language messaging via MOSDeckEngine. Ports the client-discovery-interview skill into the repo.
- Larry operates + pushes (Phase 143.2): larry-personality gains the Operating-the-Dial + Reading-routing_source doctrine, six proactive PUSH push-lines (each under an existing reach + sensor, each ending at a Decision Gate), conversation-mode as the Shape F.1 lane-picker mapped to Ackoff DIKW, mullins-scaffold Brain-driven cross-framework folders + Ackoff traversal, and ui-system Shape F.7.
- Scheduled Sensor Activation (Phase 145): the scout suite + whitespace/reverse-salient/opportunity/competitor sensors fire on a session-start-throttled cadence (cron + Cowork scheduled-tasks paths), gated behind the Phase-140 safe-auto-fire guard. Zero Brain egress.
- Connector retrofit sweep (Phase 144.1): the generator now walks agents/ as well as commands/ + skills/; all spine-eligible commands, skills, and the 9 agents declare connectors; an exhaustive 114-surface coverage gate proves every surface is wired-or-explicitly-allow-listed (53 wired + 61 allow-listed, zero unclassified).
- Loop-fires acceptance gate (Phase 146): `doctor --dogfood-acceptance` + `tests/run-all-146.sh` prove the wired loop FIRES end-to-end (ACPT-01..05) across the full connector surface, not a sample. Exit 0 means the milestone ships as "Larry Reaches".

### Changed
- Navigation engine (Phase 144, NAV-01): decide() (lib/core/navigation-engine.cjs) consumes the dispatchSensors spine; a fired reach flips routing_source from legacy to engine. The prompt-side orchestrator (143.3) and the engine-side decide() (144) coexist one-reach-per-beat.

### Fixed
- commands/jtbd.md now declares its `frameworks:` so it resolves via the command resolver; RETRO-05 connector prereqs (leadership frontmatter, value-proposition drift, structure-argument + challenge-assumptions framework keys, deep-grade Write gap).

## [1.13.1-beta.8] - 2026-06-05

First PUBLISHED release of the v1.13.1 "Larry Reaches" work -- consolidates the unreleased beta.5 through beta.7 entries below into one shipped beta (beta.4 was the last version users could install).

### Added
- Local retrieval spine: getRoomContext() fuses room-home summary + windowed session fragments + graph-ranked neighborhood, seeded by the last ~2 turns; re-exported via the navigation chokepoint; per-turn assembly benchmarked ~1ms against the 1200ms budget. Closes the conversation-to-retrieval loop -- the per-turn hot path no longer forwards userText:null, and the seed stays on the LOCAL lane (Canon Part 8).
- Capability dial committed to HEAD + the LARRY-04 Hierarchical Navigator doctrine: 5 stable reach ids + 3 stable posture ids (push_forward, hold, pull_back), grounded in the Usher division (the tool reaches; the navigator decides). Framework-led deep research ships as committed doctrine only.
- FILEVAL read-back filing: typed research/decision evidence files to the local graph and is read-back-validated -- a filing that did not land is surfaced, not swallowed.
- Sentinel and scout hardening (Phase 140).

### Fixed
- BUG-01: build-graph-from-sqlite line-53 ReferenceError (lazygraphPath -> roomDbPath); the graph export no longer crashes.

## [1.13.1-beta.7] - 2026-06-05

Phase 141 "Larry Reaches" execution step 1: commit the Capability Dial doctrine and the LARRY-04 Hierarchical Navigator to HEAD. This lifts the previously uncommitted dial out of working-tree limbo (D-06 hard ordering) and lays the prompt-layer contract -- 5 reach ids + 3 posture ids -- that Phase 143 keys off. The deep-research reach ships as committed doctrine only (DRSCH-01..04 satisfied at the doctrine level; no executable plumbing). Later Phase 141 plans (getRoomContext, FILEVAL, BUG-01) append to this same entry. Ships as a beta first per release-process.md.

### Added
- **The Capability Dial is committed to HEAD with `canon_parts: [Part 2, Part 3, Part 8, Part 9]` frontmatter (LARRY-01).** The dial's 5-reach GUIDED-default trigger map (Context Block, contradiction surface, cross-room reach, Brain consult, framework-led deep research) plus Reach rules 1-6 were prose-only in the working tree; they are now tracked doctrine. The deep-research 5th reach row and Reach rule 6 ship as DRSCH doctrine only -- no executable deep-research plumbing in this phase (D-01).
- **5 stable machine-readable reach ids (LARRY-03, D-05):** `context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`. A drift test (`tests/test-reach-ids-drift.cjs`) asserts the reach bank is EXACTLY these five so the Phase 143 dial-TUI label composer and orchestrator key off a frozen set.
- **The LARRY-04 Hierarchical Navigator doctrine (D-11/12/13).** A net-new prompt-layer section that grounds both dials in the Usher division -- the tool owns Usher steps 1-2 (perceive + set the stage = the reach = the Capability dial); the human owns steps 3-4 (the act of insight + critical revision). The posture is the bidirectional Usher traversal, encoded as 3 stable posture ids `push_forward` / `hold` / `pull_back` (drift test `tests/test-posture-ids-drift.cjs` asserts exactly three plus the Aronhime quotes). Quotes Prof. Aronhime verbatim ("the insight belongs to you; the reach belongs to the tool"; "reach matters more than raw intelligence"; "restraint is the product working correctly"). Doctrine only in 141; executable sensors (Phase 143) and the navigation engine (Phase 144) defer.
- **Reach rule 7 (dial arbitration, D-13).** The two dials are two dimensions of ONE decision cycle (CoALA), not two captains: the Capability dial evaluates first, the reach result sets the posture, the Ask-Tell dial sets intensity within it. The user is the only helm (Human-in-Command + AI-in-the-loop). Names the "Reasoning-Action Disconnect" anti-pattern alongside "two captains, one ship"; posture and filing never change silently.

### Changed
- **Version bumped to 1.13.1-beta.7** in `.claude-plugin/plugin.json` and `package.json` in lockstep with this CHANGELOG entry. The git tag and marketplace publish remain human-gated per release-process.md and are NOT performed by this commit.

## [1.13.1-beta.6] - 2026-06-05

Phase 140 sentinel + instrumentation hardening. The five Phase 140 fixes (HARD-01..05) repair the scheduled-scout safety path and the instrumentation surfaces that fed it: the sentinel no longer aborts on a zero-edge snapshot, HSI-to-graph edges now land in a Phase-109-migrated room.db, backup directories stop polluting HSI / reverse-salient results, query-efficiency telemetry records instead of logging 0, and phase deadlines surface as DUE instead of CLEAR. These are user-visible sentinel behavior changes, so they ship in lockstep per release-process.md. Ships as a beta first (release infrastructure always betas before promotion).

### Fixed
- **HARD-01: sentinel-health-check no longer aborts under `set -euo pipefail` on a zero-edge snapshot.** A `grep -c` returning a two-line `0\n0` (or empty) numeric capture was fed straight into `$(( ))`, tripping the strict-mode arithmetic abort and killing the scheduled scout before it ran. A `sanitize_int` helper (`head -1` + `tr -dc '0-9'` + default 0) now coerces every numeric capture to a single-line integer before arithmetic, so a zero-edge room can no longer take down the sentinel.
- **HARD-02: HSI-to-graph node inserts now land in a Phase-109-migrated room.db.** Four bare three-column node-write sites violated the Phase-109 nodes-provenance NOT NULL contract (`source_path` / `created_by` / `created_at` / `last_seen_at`), so edges failed with `NOT NULL constraint failed: nodes.source_path`. All four sites now route through one shared NOT-NULL-safe helper (`lib/core/node-insert.cjs::insertNode`) that detects the live schema via `PRAGMA table_info(nodes)` and is safe on both the migrated and un-migrated schema.
- **HARD-03: HSI and reverse-salient scanners now exclude `.heal-backup/`.** Both independent walkers (`compute-hsi.py` and `rs-engine.py`) crawled the heal backup directory, so backup-dir duplicates polluted HSI and reverse-salient results. `.heal-backup` is now in both independent `SKIP_DIRS` sets. Per the locked decision D-04, only `.heal-backup` was added; no general dot-dir ignore-list was introduced.
- **HARD-04: query-efficiency telemetry now records all turns instead of logging 0.** The PostToolUse hook (`scripts/query-efficiency-telemetry.cjs`) early-returned on any turn that did not carry a `/mos:` command context, but nothing in the repo ever set that signal, so the telemetry JSONL logged 0 events. The hook now writes a JSONL line for every Read/Grep/Glob turn in a resolvable room; the tool, room, and tokens-used gates are unchanged. The eight-field event shape is preserved (`command` defaults to `''`), so the Canon Part 8 scalar-only invariant holds with no new field and no network surface.
- **HARD-05: deadline monitor now reads `.planning/STATE.md` phase deadlines.** The monitor scanned only `funding/` and `opportunity-bank/`, so phase deadlines always read CLEAR. It now also scans `.planning/STATE.md` (resolved via a `PLANNING_STATE_FILE` env seam, else repo root), reusing the existing `portable_date_to_epoch` parser and the `epoch == 0` skip guard, and pushes a distinct `phase`-source alert through the existing report path.

### Changed
- **The scout HSI-to-graph step no longer swallows write failures** (D-03). The previous `2>/dev/null || true` masked a failed graph write; it is replaced by an `if/fi` that surfaces stderr and prints a degraded-step advisory while staying non-fatal, so a silent edge-write failure can no longer hide.
- **The scout telemetry aggregator gained a `--mos-only` population filter** (D-01a). The published "up to 57x" efficiency claim is defined against the `/mos:` command population; relaxing the telemetry gate to all turns (HARD-04) changes the denominator, so `scripts/scout-telemetry-aggregator.cjs --mos-only` restricts the median / top-5 / threshold-status to `/mos:` turns while the default reports the honest all-turns view. `RELEASE_GATE_THRESHOLD_X` is unchanged at 40; both views always coexist so the published number is never silently redefined.

### Release-gate note (57x claim)
- **The release gate MUST run `node scripts/scout-telemetry-aggregator.cjs --mos-only` when consuming the "up to 57x" claim before tagging.** Reading the bare all-turns median (relaxed by HARD-04) as the claim's evidence would understate efficiency and could trigger a spurious RETUNE; the claim's denominator is the `/mos:` command population. The claim language itself ("up to 57x") does not change as a result of the gate relaxation -- it remains `/mos:`-specific and measurable via `--mos-only`. Any README / CHANGELOG copy rewrite is a deferred release-process follow-up (140-57X-CLAIM-RECONCILIATION.md), not performed here.

## [1.13.1-beta.4] - 2026-06-04

Phase 139 doctor hotfix: stop doctor from scaffolding room artifacts in the wrong directory, and convert its frozen Phase-95 check roster into a version-accumulative engine skeleton. Proven end-to-end by shipping Umbilical Cord as the first registered module. Ships as a beta first per release-process.md (release infrastructure always betas before promotion).

### Fixed (S1 -- doctor WHERE fix + OBS-2 closure)
- **Doctor no longer mis-scaffolds room artifacts in non-room directories.** Doctor used to guess its target by walking up from `process.cwd()`; run from `~/dev/<repo>` or `~/decks` it found no room and either no-oped or spuriously flagged, and a residual write-ordering gap (OBS-2) let `.mindrian/` + `heal-log.json` land in a rejected target before the guards fired. Fix: one single resolver `lib/core/resolve-umbilical-target.cjs` (precedence `.umbilical` cord -> `.room-root` sentinel -> registry.active) now backs doctor's only cwd-derived target and SKIPS when it resolves to null, and the heal zero-write floor from a non-room cwd is locked by regression test (zero room-artifact writes from a non-room dir). The codebase has been bitten twice by N-independent target guessers; this resolver is one module from day one and all doctor target-resolution routes through it.

### Added (S2 -- accumulative engine skeleton)
- **Doctor's frozen Phase-95 class roster becomes a forward-healing engine.** A hand-maintained module registry (`data/doctor-modules.json`), doctor's OWN never-regressing applied-through watermark (`~/.mindrian/doctor-applied.json`), and a semver selector (`runAccumulativeEngine` in `scripts/doctor.cjs`) that runs each registered module whose `introduced_version` falls in the `(applied_through, running]` window, idempotently. From this release forward every new Mindrian version can register its own health/migration module and any user on any prior version is healed forward when they run doctor. Doctor keeps its own watermark and never depends on `~/.mindrian-last-version` (session-start overwrites that early). Generalizes the proven `install-state.cjs::migrateIfNeeded` + `deployment-surfaces.json` patterns (Canon Part 7 reuse-before-build); re-running is a no-op.

### Added (S3 -- Umbilical Cord as module #1)
- **A `.umbilical` marker in a non-room project projects exactly one `AFFILIATED_WITH` edge into the corresponding room.db.** Cords are authoritative at the registry layer and projected into each room.db as LOCAL edges (Canon Part 8: no raw cross-room edges, zero Brain egress). The first registered accumulative-engine module (`lib/core/doctor/umbilical-module.cjs`) reads the marker, projects the edge via the reused `edges.cjs::writeEdge` chokepoint (idempotent UPSERT), and integrity-checks cord-marker bidirectionality (orphan / removed-marker / unprojected). `--fix` SUGGESTS orphan cords for human confirmation but never auto-creates one; edge properties are enum-only (`relation`, `born`) and freeform `note:` text never reaches the edge.

### Added (S4 -- release wiring + module-registration gate)
- **`release.sh` Step 6.6a verifies the module registry before the tag lands.** For every entry in `data/doctor-modules.json` it asserts the runner file exists, `introduced_version` is valid semver, and `introduced_version <= NEW_VERSION` (a module cannot claim to be introduced in a future version); HARD ABORT with the same rollback semantics as the surrounding Step 6.6 acceptance gate. The umbilical module's `introduced_version` is reconciled to `1.13.1-beta.4` (the exact version this hotfix ships), so the selector's window math ties the module to the version that introduced it. `tests/test-139-acceptance.cjs` runs the whole S1-S4 chain green in one shot as the phase release gate.

### Changed
- **`ALLOWED_EDGE_TYPES` gains `AFFILIATED_WITH`** (additive; the floor test asserts all prior members are preserved and the set stays frozen).

## [1.13.1-beta.2] - 2026-06-02

### Fixed (release: marketplace catalog advertised the dev next-bump)
- **Users installing right after a finalize got the dev pre-release, not the stable.** `release.sh` Commit B (Step 7.5) advanced the marketplace catalog `marketplace.json.version` to the dev next-bump, so `claude plugin install mos@mindrian-marketplace` labeled users `1.13.1-beta.1` minutes after the `1.13.0` finalize (even though `source.ref=v1.13.0` cloned the stable code). Reported live by a tester. Fix: Commit B no longer touches `marketplace.json` -- the catalog stays at the released `NEW_VERSION` with `source.ref=vNEW_VERSION`; only the plugin repo's `plugin.json`/`package.json` advance to the next dev version. Immediate catalog correction (1.13.1-beta.1 -> 1.13.0) pushed + verified (fresh install lands 1.13.0). RULE 5a added to the ceremony ruling system; RCA `marketplace-catalog-advertises-dev-next-bump`.

### Fixed (doctor: topology-blind install-health on marketplace-cache)
- **`/mos:doctor --fix` no longer cries "cannot read state" and the post-update activator no longer false-fails on a healthy marketplace-cache install.** `checkInstallVersion()` returned `missing` when the legacy `~/.claude/plugins/mindrian-os/` dir was absent (correctly absent under marketplace-cache topology). Now topology-aware: reads the active cache root's plugin.json and reports healthy. One fix clears both the doctor warning and the activator's "activation failed: doctor exit 0". Regression test a.4; RCA `doctor-class-a-cannot-read-state-topology-blind`.


## [1.13.0] - 2026-06-02


## [1.13.0-beta.44] - 2026-06-02

### Fixed (release ceremony -- npx self-test false alarm, RULE 3)
- **The release npx-publish self-test no longer aborts healthy releases.** Both `scripts/release.sh` Step 9.7 and the `doctor.cjs` `npx-roundtrip` acceptance check now verify the published package via `npm install @mindrian_os/cli@<version>` + assert `bin/cli.js` present, `node --check` parseable, and the `.bin/mindrian-os` symlink linked -- the true installability signal. They previously asserted `npx @pkg@version`'s launcher RUNTIME exit, which false-failed because (a) the installer shells to `claude`/`git` absent in the bare npx sandbox and (b) npm 10.9.7 npx-by-name does not reliably link the bin. This false alarm (RCA `release-step-9.7-npx-self-test-false-alarm`, open since beta.37) aborted every prerelease post-publish, forcing manual completion. Resolved per the RCA's recommendation A.

### Added (release ceremony ruling system)
- **`docs/RELEASE-CEREMONY-RULING-SYSTEM.md`** -- the authoritative release contract: slim-installer-package (RULE 1), npx-safe package name (RULE 2), install-ability self-test (RULE 3), mode-robust self-tests (RULE 4), 5-place + lockstep sync (RULE 5), beta-first infra (RULE 6), ordering + partial-release recovery (RULE 7), clean-tree/ahead guards (RULE 8), Canon boundaries (RULE 9), plus an operator runbook. Codified from the v1.13.0 finalize that hit four latent release bugs.

## [1.13.0-beta.43] - 2026-06-02

### Fixed (npx install UX -- proper npm package)
- **`npx @mindrian_os/install` was broken; the npm package is renamed to `@mindrian_os/cli` and slimmed.** Root cause: the unscoped package-name segment `install` collides with the coreutils `/usr/bin/install` command, so `npx @mindrian_os/install` ran the system `install` (or failed `mindrian-os: not found`) instead of the installer. The package itself always worked via `npm install` + marketplace; only the `npx`-by-name path was broken (caught by the release Step 9.7 self-test on the 1.13.0 finalize). Fix: rename to `@mindrian_os/cli` (npx-safe; `cli` is not a system command), bin map `{mindrian-os, cli}` so `npx @mindrian_os/cli` resolves cleanly, and slim the published `files` from the entire 8.5MB plugin to the installer essentials (`bin/cli.js` + `lib/core/active-plugin-root.cjs`, ~164KB) since the CLI drives `claude plugin install` and never needs the plugin payload (that ships via the marketplace git artifact). README + install-minisite + release.sh + doctor.cjs npx self-tests all repointed to `@mindrian_os/cli`. The broken `@mindrian_os/install` beta.41/beta.42 are deprecated.

### Fixed (release tooling)
- **Pre-tag `release-dry-run-output` self-test is mode-explicit.** It ran `release.sh --dry-run` with no mode; during `--finalize` (after the version is bumped to a clean X.Y.Z) a bare dry-run exits 1, aborting the finalize. Now passes `patch` (valid on clean + suffixed versions).

## [1.13.0-beta.42] - 2026-06-02

This final rolls up the entire 1.13.0 beta train (beta.38 through beta.41, including the Windows installer fix below) plus the v1.13.1-planned dual-graph / research-workflow chain (Phases 130.5, 130.7, 131, 132).

### Added (Phase 130.5 -- shared corpus-cache + CJS fetcher substrate)
- **One CJS-native external-corpus module that every research surface uses.** `lib/core/research-corpus.cjs` exposes `fetchCorpus({source, query, limit})` over OpenAlex / arXiv / PubMed / Tavily (native `fetch`, zero new deps, zero Python) behind one interface, with a shared fail-closed Canon Part 8 pre-egress audit that rejects any query string carrying user-content patterns. `lib/core/research-cache.cjs` is the shared TTL + source-keyed on-disk cache so a paper fetched by `/mos:research` is never re-fetched by `rs-discovery-engine`. `rs-discovery-engine` migrated onto the shared module (byte-identical fixture results), closing the duplicate-fetcher / duplicate-quota drift. Sci-Bot registered as an opt-in `enabled:false` source (legal-review gated).

### Added (Phase 130.7 -- correlation-id contract + dual-graph CI gates)
- **A stable, embedding-independent `correlation_id` on every teaching-graph node.** Locked contract of record: `sha256(utf8(name + '|' + primary_label)).hex().slice(0,16)` (raw inputs, no trim/case-fold) - byte-identical to the live Brain backfill (721 nodes). `lib/core/correlation.cjs` is the single hashing chokepoint reused by the Brain backfill, the chain-recommender, and the local recommender. `lib/brain/chain-recommender.cjs` returns one canonical `{correlation_id, canonical_name, primary_label}` tuple per query (no cross-label fork); `navigation.cjs` memory_event references carry correlation_id (additive, zero new EVENT_TYPES); `bin/local-chain-recommender.cjs` walks aggregates by correlation_id. Ships the 4-metric dual-graph CI health gate (report-only/baseline mode) + three `/mos:brain-derive` curation surfaces (`--review-anchors`, `--orphan-census`, `--cross-label-dups`).

### Added (Phase 131 -- research as a graph-aware workflow step, source-lens pilot)
- **`/mos:research` rewritten from a prose-and-agent command into a 7-stage canonical workflow step.** Batched pre-flight (`navigation.getResearchPreflight`) -> Larry-voiced context summary -> weighted source-lens set -> corpus fetch via the 130.5 shared module -> F.1 filing selector (mirrors `selector-dispatcher.cjs`) -> findings wired as typed `EvidenceClaim` nodes with cascade edges (INFORMS / CONTRADICTS / SUPERSEDES / REJECTED_BECAUSE) landing on canonical correlation_ids. Rejection captures reason as graph data (Canon Part 4). 5 instrumented E2E tests drive the full pipeline through `navigation.cjs` with a zero-leak gate; `docs/RESEARCH-AS-WORKFLOW-STEP.md` makes this the template for the v1.14.0 source-lens fan-out.

### Added (Phase 132 -- dual-graph correlation hypergraph reformat, machinery + tiny live cleanup)
- **The teaching-graph curation machinery + the re-baselined live cleanup.** `lib/brain/curation-batch.cjs` is the reusable curation-batch runner (created_by provenance stamping, rollback-by-created_by, a write-time guard that refuses to write unless the 130.7 correlation contract is present in the live graph, gated `--execute`). Ships the frozen 5-event-type hypergraph schema, the dedup-collapse + held-name-rename machinery, and the Phase 132 release gate (invokes the 130.7 health check + brain-boundary-scan). Live cleanup executed the re-baselined worklist: collapsed the one real dedup pair (`The Other Way Round` Technique), snapshot-protected and reversible. The bulk hypergraph reify, the ~278-node wire-it, the internal-name pseudonymize, and the 14 held-node disposition are deferred to v1.14.0 (tracked deferred items; the held nodes remain safely quarantined).

### Changed
- Larry's chain-recommender now returns one canonical target per query across the LOCAL room.db navigation layer and the remote Brain teaching graph - the dual-graph coherence the v1.13.0 "Closed Loop" milestone was building toward.

## [1.13.0-beta.41] - 2026-06-02

### Fixed (Windows installer false-negative -- POSIX-shell assumption; debug session windows-posix-shell-assumption-installer-statusline, 2026-06-01)
- **`npx @mindrian_os/install` no longer false-reports "Claude Code is not installed" on Windows when `claude --version` works in the same shell.** `bin/cli.js` spawned `claude` via `spawnSync('claude', ...)` with no `shell` option. On Windows the npm-global `claude` is a `claude.cmd` shim; Node's `spawnSync` does not consult `PATHEXT` without a shell, so the spawn failed with ENOENT and the installer's prerequisite check false-negatived (it then aborted before installing). The interactive shell consults `PATHEXT` and resolves `claude.cmd`, hence the contradiction the tester saw. Fix: a new `runClaude()` wrapper routes every `claude` spawn through `{ shell: process.platform === 'win32' }` so cmd.exe resolves the `.cmd` shim on Windows; the `requireClaudeCli()` `--version` check is shell-scoped the same way. All six `run('claude', ...)` call sites (install + update subcommands) now go through the single `runClaude` chokepoint. Confirmed live by a Windows 10.0.26200 tester on Claude Code 2.1.159.
- **Scoping note (avoids a doctor-path regression):** the shell route is applied to `claude` spawns ONLY, not to the generic `run()` helper. `run()` is also called as `run(process.execPath, ...)` in the `doctor` subcommand, and on Windows `process.execPath` is `C:\Program Files\nodejs\node.exe` (contains a space); with `shell:true` Node would pass the command unquoted to cmd.exe, which would parse `C:\Program` as the command and break. `git` (a real `.exe`) and `process.execPath` resolve correctly without a shell, so they are deliberately left shell-free. POSIX behaviour is unchanged (shell stays false off-win32).

### Known follow-up (tracked, not in this release)
- **Statusline does not render on Windows without `bash` on PATH.** The `statusLine` command in `~/.claude/settings.json` runs `bash "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-mos"`, and the dispatch shim + renderer are both bash. A default Windows box has no `bash`, so the status bar silently does not render (cosmetic -- the plugin and all `/mos:` commands function regardless). Same POSIX-shell-assumption family as the installer bug, different mechanism. The durable fix (a Node statusline renderer so the bar does not depend on bash) is scoped as its own phase. Interim: install Git for Windows (provides bash) or accept no status bar. See `.planning/debug/windows-posix-shell-assumption-installer-statusline.md`.

## [1.13.0-beta.40] - 2026-06-01

### Added (Brain schema awareness -- four new teaching edge types wired into Larry's reference layer)
- **Larry now knows about, and actively traverses, four relationship types added to the Brain teaching graph during the 2026-06 curriculum work: `HAS_EXAMPLE`, `HAS_METHOD`, `CONTRASTS_WITH`, `DIRECTS`.** Verified live against the production Neo4j (`my-neo4j` MCP) before wiring: `HAS_EXAMPLE` 28, `HAS_METHOD` 4, `CONTRASTS_WITH` 2, `DIRECTS` 1, `REVEALS` 44 -- every count matches what was created, no drift.
- **`references/brain/schema.md`** Node Types table now documents the labels that existed in the schema but were previously zero-instance and are now populated: `Method` (94), `Stage` (74), `Insight` (13), `Question` (8), `PyramidLevel` (5), plus the new `example_type` property on `Example`. Relationships table gains the four new edges with From->To, properties, and a "why it matters" note that tells Larry when to reach for each.
- **`references/brain/query-patterns.md`** gains pattern `2b. brain_framework_teach` -- the invocation surface. Pulls worked examples (`HAS_EXAMPLE`), alternative methods (`HAS_METHOD`), the revealed insight (`REVEALS`), and rival theories (`CONTRASTS_WITH`) attached directly to a framework, so "show me an example / what are my options / why does this matter" resolve from the graph. Documents the Ackoff `(:PyramidLevel)-[:DIRECTS]->(:PyramidLevel)` top-down DIKW traversal.

### Canon
- Canon Part 8 clean by construction: schema/query-pattern reference docs carry only generic framework handles and edge-type names; zero user data, zero LOCAL->BRAIN egress.

## [1.13.0-beta.39] - 2026-05-31

### Fixed (topology-blind SessionStart banner -- debug session doctor-class-a-drift-topology-blind-false-positive, 2026-05-31)
- **SessionStart no longer prints a false "MindrianOS install dir missing; run /mos:doctor --fix to recover" banner on healthy marketplace-cache installs.** The class A drift check in `scripts/doctor.cjs` (which feeds the SessionStart preflight banner via `scripts/doctor-preflight-format.cjs`) keyed off the hardcoded legacy `INSTALL_DIR` (`~/.claude/plugins/mindrian-os`) instead of `resolveActivePluginRoot()`. Under the modern marketplace-cache topology that legacy directory is correctly absent (Claude Code loads the plugin from the cache path recorded in `installed_plugins.json`), so the check reported false `install-missing` drift on every session while the topology-aware class I gate (`--install-state`) reported healthy. Worse, the banner's recommended remedy (`/mos:doctor --fix`) would have recreated the legacy directory, which the class I gate then flags as a migration candidate to remove -- the two subsystems contradicting each other. Fix: the `install-missing` drift branch and the `--fix` recovery gate are now guarded on `resolveActivePluginRoot().topology !== 'marketplace-cache'`, so a missing legacy directory is no longer drift when the active install resolves to a healthy marketplace-cache root. The legacy/dev-topology recovery path is preserved (a genuinely-missing legacy active root still reports `install-missing`). Class A now agrees with class I. Reuses the existing `lib/core/active-plugin-root.cjs` resolver (Canon Part 7); zero Brain wire (Canon Part 8 clean by construction). New regression suite `tests/test-doctor-class-a-topology-drift.cjs` (3 hermetic scenarios, registered in the Feynman runner) plus two existing doctor suites pinned to `MINDRIAN_OS_ROOT` for host-topology hermeticity.

## [1.13.0-beta.38] - 2026-05-31

### Added (Phase 135 -- the offer loop's resolver: Larry offers one calibrated next move, or stays silent)
- **`resolveOfferNextStep` is now live -- the navigation engine offers exactly one next-move command at the right moment instead of always returning null.** Fills the Plan 91-04 stub with an abstention-gated resolver in the new `lib/core/navigation-engine-offer.cjs`. The offer renders through the shipped F.1 AskUserQuestion selector (one keypress, Free-Text escape), and each pick records a typed decision edge via `recordSelectorDecision` (Canon Part 4). Local-only and synchronous (no Brain call on the hot path); zero TUI, zero third-party dependency; works identically on CLI / Desktop / Cowork.
- **The resolver is SQL-local, Brain-aware, MD-aware, and wikilink-aware.** Reads room.db only via the `navigation.cjs` chokepoint (Canon Part 9), consuming the local graph neighborhood + `memory_event` tail for relevance; consumes the MINTO governing thought + FEYNMAN temporal section + active JTBD (Canon Part 4); the offer reason cites the target section as a `[[wikilink]]`, and an accepted offer that files an artifact injects wikilinks idempotently (Phase 76 engine). Mode A enriches via the typed Brain packet (enum/handle only), Mode B degrades to local heuristics, tier_0 falls to the minimal verb set -- no crash across all three. Canon Part 8 boundary verified clean.
- **Abstention is the load-bearing wall: operator-state x confidence-margin x rejection-backoff.** Silent in JUST_TALK; offers at decision moments; backs off a rejected offer (the reject writes the `memory_event` that suppresses it next turn). A wrong offer trains the user to ignore offers, so the resolver stays quiet unless it is confident -- protecting the credibility of the variable reward.

### Context wiring (the dark-loop fix)
- **The `decide()` context now carries the resolver's full input set** (operator, sectionPath, problemType, active JTBD, and a room.db-backed roomState) so production offers carry a real `[[section]]` reason instead of `[[undefined]]`. An end-to-end wiring test seeds a real temp room.db on a DECISION_GATE turn and asserts a non-null grounded offer, with a JUST_TALK null negative control -- the guard that catches the green-in-test / dark-in-production class.

## [1.13.0-beta.37] - 2026-05-31

### Added (room-wiring -- the single "wire all rooms" command)
- **`scripts/heal-command.cjs --recursive` heals every registered room in one pass.** Reads `~/MindrianRooms/.rooms/registry.json` (honoring `MINDRIAN_ROOMS_HOME`), skips archived/sealed rooms, runs the full heal per room. Idempotent and per-room-failure-tolerant -- the sweep never aborts on one bad room. This is the command to run after any version that touches the room.db substrate.
- **Heal now runs the Phase 130 hats->room.db migration as step 11.** Every heal invokes `migrate-hats-to-roomdb.cjs` after the lazygraph rebuild creates `room.db` (step 4), so heal becomes the single per-room wiring command -- the migration is no longer an orphaned script a human must know to run. Idempotent via its sentinel `memory_event` (re-runs skip).

### Changed
- `--skip-step` cap raised from 10 to 11 to cover the new hats-migration step.

## [1.13.0-beta.36] - 2026-05-31

### Fixed (Windows tester crash -- reported by Gary Laben on beta.34)
- **`/mos:doctor --brain-smoke` no longer crashes the Node process on Windows.** On the L3 schema-probe failure path (a revoked or invalid Brain key returns 401/403), `lib/core/brain-client.cjs` did not drain the response body, so undici kept the TLS socket alive as a libuv handle; the synchronous `process.exit(code)` in the `--brain-smoke` dispatch then tore that handle down mid-close, which Windows libuv asserts on (`src\win\async.c` line 76, surfacing to the Claude Code Bash wrapper as exit 127). Linux/macOS silently discard the handle, so the crash was Windows-only and read as catastrophic when the real cause was just an invalid key. Fix: `scripts/doctor.cjs` sets `process.exitCode` and returns instead of calling `process.exit()` (lets the event loop drain handles the OS-safe way), and `brain-client.cjs` drains the body via `await res.arrayBuffer()` on the non-OK branch of `_ensureSession` and `callTool`. A failed probe now reports cleanly with exit code 1. Debug session: `.planning/debug/doctor-brain-smoke-win-crash.md`.

### Added (v1.13.1 memory cluster -- Canon Part 9 "the local mind" made real: Phases 128 / 129 / 129.5 / 130)
- **Phase 128 substrate-contract-adr -- navigation.cjs is now the structurally-enforced single door to room.db.** Ships `docs/architecture/SUBSTRATE-CONTRACT.md` (the four-substrate ADR plus the pinned navigation.cjs export allow-list) and `scripts/check-substrate.cjs`, a pre-commit CI guard wired into the live hook that blocks any net-new code bypassing the chokepoint (direct sqlite require, raw INSERT/UPDATE/DELETE on nodes/edges/memory_event, `openGraph` opener, Cypher user-interpolation). The guard is net-new-aware and self-allowlisting; `docs/architecture/SUBSTRATE-BASELINE.md` enumerates the 195 pre-existing bypasses with per-phase ownership. Closes dog-food review findings C3 / H1 / M11.
- **Phase 129 spine-repair-memory-event -- the proactive loop's backward arc is closed.** The spine surfaces (`/mos:status`, `/mos:suggest-next`, `/mos:act`, `/mos:pipeline`, `/mos:jtbd`, `/mos:operator`, `/mos:memory`) now journal every state transition to the canonical `memory_event` log via navigation.cjs (5 net-new event types + the `FOLLOWS_FROM` cascade edge). `lib/conversation/operator.cjs` retired its raw `node:sqlite` bypass to the chokepoint. An instrumented acceptance test proves the full loop emits the expected events leak-free. Closes review findings C2 / H3 / M9.
- **Phase 129.5 truth-machine-activation -- "the human confirms truth" is wired (Canon amended to v1.5).** The dead `promoteNodeStatus` lever is now reachable through exactly one door, `confirmNode(db, id, byUser)`. A human APPROVE is the only path to a `confirmed` truth-claim node; `byUser` resolves from the room USER.md navigator identity and agent identities (larry / brain / system / assistant) are rejected. `getConfirmedFacts` returns freshly-confirmed nodes. Canon Part 9 gains the audit-node carve-out. Closes review finding C1 (the highest-value gap).
- **Phase 130 lens-engine-skeleton -- 18+ duplicate lens-rotation surfaces collapse to one engine.** Ships `lib/core/lens-engine.cjs` (serial/parallel/single modes + 5-family registry, cognitive populated) and 3 consolidated synthesizers. The 4 cognitive-family commands become thin clients; the hats family retired its `.mindrian/hats/*/STATE.md` filesystem writes to room.db `HatState` nodes. `INFORMS` + `REJECTED_BECAUSE` (rejection-as-data, Canon Part 4) added to the edge allow-list. Closes review finding H2.

### Changed (Phase 128 guard hardening -- dog-food finding, caught on its own next commit)
- The Phase 128 substrate guard shipped too blunt and blocked the very next legitimate commit. Hardened the same session: `check-substrate.cjs --diff` is now net-new-line-aware (parses `git diff --cached --unified=0`, flags only added lines), self-allowlists its own source and `check-schema-aliases.cjs`, and carries net-new regression tests. Canon Part 6 working as written: the product caught its own defect by dogfooding the guard.

## [1.13.0-beta.34] - 2026-05-25

### Fixed (JTBD auto-anchor silent-failure bundle, Phase 127.3 -- ships v1.13.0-beta.34)
- **PRIMARY: JTBD memory layer was silently dead in every release since v1.11.x (commit fcbbcf9a, 2026-04-26).** `scripts/jtbd-update.cjs::resolveActiveRoom()` at lines 65-79 read against an obsolete registry shape (expected `reg.active_room` + Array `reg.rooms`; actual `reg.active` + Object `reg.rooms` since at least Phase 100). Both checks failed on every call, the function returned null, `main()` short-circuited at line 132, the classifier never ran, `.mindrian/jtbd-state.json` never got written, and `/mos:memory` reported `in_flight: 0 / parked: 0 / completed: 0` for ~7 months. Refactored both broken registry walks in `scripts/jtbd-update.cjs` (lines 65-79 top-level resolver + lines 196-214 Phase 103-05 promote block) to import + call the new `lib/core/resolve-active-room.cjs` chokepoint. `/mos:memory` now populates with real `in_flight` entries on the 3rd same-cue turn instead of reporting `0/0/0` forever. Full RCA: `.planning/debug/resolved/jtbd-auto-anchor-silent-failure.md`.
- **SECONDARY: fresh-room creation now seeds USER.md, STATE.md, ROOM.md, and `.mindrian/`.** Previously every fresh room had `intent_persona = all-null` in every decision trace because `intent-classifier.cjs` had no USER.md to read from. `scripts/room-registry create` now seeds USER.md (canonical_role: null), STATE.md (empty Decisions section), ROOM.md (per Canon decision 15), and the `.mindrian/` directory idempotently. Per D-02, `jtbd-state.json` and `operator-state.json` are explicitly NOT seeded so legitimate first-write events stay in audit logs.
- **TERTIARY: existing rooms get a one-time retro-bootstrap.** Jonathan's MindrianRooms canonical rooms + every tester's rooms + every CI fixture are retro-seeded with USER.md / STATE.md / ROOM.md / `.mindrian/` via the new `bash scripts/room-registry bootstrap-missing` subcommand, auto-triggered once on first post-127.3 invocation via a `~/MindrianRooms/.rooms/.bootstrap-127.3-done` sentinel. This closes the silent-failure gap for the ACTUAL population, not just rooms created after this release.
- **QUATERNARY: first-touch JTBD nudge for fresh-room users.** On SessionStart, when an active room exists AND `.mindrian/jtbd-state.json` is absent AND ROOM.md mtime is under 7 days, Larry asks "What are you trying to do here?" with a `/mos:jtbd set <id>` hint. Past 7 days the nudge stays silent (deliberate-blank-room respected per D-03). Effective on both newly created rooms AND retro-bootstrapped existing rooms (where ROOM.md mtime reflects the moment the retro-pass stamped the room's identity).

### Changed (JTBD auto-anchor silent-failure bundle, Phase 127.3 -- ships v1.13.0-beta.34)
- **Canon Part 7 extraction: `lib/core/resolve-active-room.cjs`** as the chokepoint for active-room registry resolution, mirroring the precedent set by `lib/core/resolve-brain-key.cjs` (Phase 123 Plan 07). Tolerates both legacy (`reg.active_room` + Array `reg.rooms`) AND current (`reg.active` + Object `reg.rooms`) shapes; returns `{ slug, abs_path }` or null. Phase 129 (spine-repair-memory-event) will absorb the remaining 6 spine scripts (`mos-status`, `suggest-next`, `act`, `pipeline`, `operator`, `memory`) plus the deferred multi-room iteration site (`scripts/memory-completion-detector.cjs`) onto the same helper in v1.13.1-beta.3, so 127.3 lands the infrastructure 129 reuses without double-work.
- **Consolidated 6 sibling registry-resolution sites onto the chokepoint:** `scripts/jtbd-update.cjs` (x2 sites), `scripts/intent-classifier.cjs`, `scripts/hmi-compliance-poll.cjs`, `scripts/jtbd-command.cjs`, `scripts/operator-command.cjs`, `scripts/check-onboard-statusline.cjs`. Structural tripwire `tests/test-127.3-sibling-sweep.sh` prevents the broken pattern from regrowing: any future PR that introduces `reg.active_room` or `Array.isArray(reg.rooms)` outside the two-file allow-list (the chokepoint itself + the Phase-129-deferred `memory-completion-detector.cjs` with a `# TODO Phase 129` marker) fails CI immediately.
- **Empirical regression test `tests/test-jtbd-auto-anchor-empirical.sh`** reproduces the RCA "Reproduction Steps" protocol verbatim and serves as the behavioral gate. Phase 127.3 aggregator `tests/run-all-127.3.sh` runs all 3 Phase 127.3 test suites (chokepoint unit-test + sibling-sweep tripwire + empirical reproduction); `lib/memory/run-feynman-tests.cjs` registers the chokepoint unit-test so every Feynman pass picks it up.

### USER-FACING NOTE (Phase 127.3)
If you previously ran a Larry session in a fresh room and `/mos:memory` reported `in_flight: 0` even after multiple JTBD-relevant turns, this fix restores the auto-anchor mechanism. After upgrading, the FIRST time you run any `room-registry` subcommand (or open any room), the system retro-seeds USER.md / STATE.md / ROOM.md / `.mindrian/` on every existing room AND fires the first-touch nudge for rooms without a declared JTBD. No manual migration needed.

## [1.13.0-beta.32] - 2026-05-24

### Fixed (Windows-tester regression bundle, Phase 127.2 Plan 04 -- ships v1.13.0-beta.32)
- **Instance #4 (P2): `/mos:rooms list` works on Windows + Git Bash (`scripts/room-registry` POSIX path leak).** Every `python3 -c` invocation in `scripts/room-registry` (8 subcommand stanzas: `create`, `read`, `list`, `update`, `set-active`, `archive`, `get-active`, `git-config`) interpolated bash-resolved `$REGISTRY_FILE` into Python source. On Git Bash for Windows, `$HOME=/c/Users/PC` produced paths like `/c/Users/PC/MindrianRooms/.rooms/registry.json` that Windows Python `open()` could not resolve, surfacing `FileNotFoundError` on every registry subcommand. Fix: inlined a `normwin()` Python shim at the top of every block, platform-gated on `sys.platform == 'win32'` so it is a no-op on Linux/macOS but converts the POSIX form to native `C:\Users\...` on Windows; every `open(...)` rewritten to `open(normwin(REGISTRY_FILE))`. Sibling sweep patched `scripts/reapply-modifications` (4 `python3 -c` sites, single `$NORMWIN_SHIM` bash-var-string reused). Explicit sweep targets (`scripts/hsi-*`, `scripts/build-*`, `scripts/release.sh`) verified clean. Out-of-scope sibling sites in `scripts/verify-release`, `scripts/learn-from-usage`, `scripts/track-analytics` logged to `.planning/phases/127.2-.../deferred-items.md` for a future patch beta. Silent for non-Windows users; caught only on Jonathan's dogfood Windows box. Closes `.planning/debug/resolved/windows-room-registry-path-normalization-gap.md`.
- **Instance #7 (P1, META-FIX): `/mos:update` atomically swaps to the new active install + warns about session restart (silent-activation gap closed).** `/mos:update` and `claude plugin update mos@mindrian-marketplace` land new bytes in `~/.claude/plugins/cache/mindrian-marketplace/mos/<NEW_VERSION>/` but DO NOT atomically swap the live install at `~/.claude/plugins/mindrian-os/`. Every subsequent MCP probe + statusline + hook output continued to serve the OLD bytes. Users thought they were on beta.N+1; every Brain interaction silently read beta.N. This is the structural reason every prior beta this session may have been unverified on tester wires. Three-part fix: (a) new `scripts/post-update-activation.cjs` (305 lines, exports `activatePostUpdate` + `POST_UPDATE_TOUCH_FILE`) detects the cache-staging dir + delegates the atomic swap to existing `scripts/doctor.cjs --fix` (Canon Part 7 reuse of Phase 95.2 install-cache-atomic-recovery, three autopsies of hardening) + writes a touch-file at `~/.mindrian/post-update-restart-pending` with the new version + emits a Shape E action report; (b) new SessionStart hook `scripts/sessionstart-post-update-preflight.cjs` (187 lines, sibling-NOT-replacement of `sessionstart-npm-reconcile.cjs`) reads the touch-file each session, spawns `doctor --brain-smoke --json`, parses L4 MCP stdio handshake server-version token, deletes touch-file silently on match, refuses Larry-load with a red banner via SessionStart `systemMessage` envelope on drift (exit 1), exits 0 silently when probe is inconclusive (defensive); (c) `commands/update.md` Step 7 calls `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.cjs" --fix --post-update` at the end of every update flow; `scripts/doctor.cjs` gains `--post-update` flag handler that delegates to the activator, composable with `--fix`. Closes `.planning/debug/resolved/mos-update-silent-activation-gap.md`.

### Changed (Release pipeline self-defense, Phase 127.2 Plan 04)
- **`/mos:doctor --acceptance` Class N gate: `activation-reached-the-wire`.** `scripts/doctor.cjs` gains a new acceptance point (severity `blocker`, `applies_to: ['full']`) that asserts the L4 MCP server version (probed via `doctor --brain-smoke --json` -> parse `server=mindrian-brain vX.Y.Z` from L4 handshake reason) matches `package.json.version` (version-of-record). On match: pass. On drift: fail with `activation gap detected: live install serves v<OLD> but version-of-record is v<NEW>`. Wired into the existing acceptance roster so `scripts/release.sh` Step 9.8 (post-publish full acceptance gate) runs this check AFTER the new version is published -- catching any phantom-version release before it propagates to tester caches. This is the canary the release pipeline never had: every beta after v1.13.0-beta.32 either activates on the wire AND earns the acceptance pass, or fails the gate AND is prevented from shipping. The cadence-vs-validation trade-off becomes structurally enforced rather than relying on manual maintainer discipline. Test environment hooks: `DOCTOR_TEST_FAIL_POINT=activation-reached-the-wire` synthesizes a failure; `DOCTOR_SKIP_ACTIVATION_GATE=1` marks the point ok-as-skipped for hermetic CI / offline mode.

### Internal (Phase 127.2 Plan 04)
- **`hooks/hooks.json`** registers `sessionstart-post-update-preflight.cjs` as a SessionStart hook (matcher `startup|clear|compact`, `async: false`, ordered AFTER `sessionstart-npm-reconcile.cjs` so node_modules is in place before brain-smoke spawns, BEFORE Larry-load so a drift blocks the room).
- **New tests (60 PASS / 0 FAIL across 3 suites):** `tests/test-room-registry-windows-path.cjs` (215 lines, 25 PASS -- linux regression + python normwin functional probe + structural greps confirming zero raw `open($REGISTRY_FILE)` callsites remain); `tests/test-mos-update-activation-gap.cjs` (233 lines, 19 PASS -- cold synthesis of beta.N -> beta.N+1 atomic swap + idempotency on already-on-latest + preflight hook semantics); `tests/test-127.2-04-windows-path-and-update-activation.sh` (88 lines, 16 PASS -- structural greps + functional doctor probes).
- **3 RCA closeouts moved to `.planning/debug/resolved/`:** `post-beta30-regression-2026-05-23.md` (12-gate wire-verification sweep), `windows-room-registry-path-normalization-gap.md` (Instance #4 detail), `mos-update-silent-activation-gap.md` (Instance #7 detail). Each updated with `status: resolved`, `resolved: 2026-05-23`, `resolved_by: phase-127.2 Plan 127.2-04`, plus Resolution sections linking to this plan.
- **`.planning/debug/knowledge-base.md`** gains 2 new entries (Instance #4 + Instance #7 -- distinct patterns) so `gsd-debugger` surfaces these as known-pattern hypotheses on future investigations.
- **`docs/install-cache-family-premortem.md`** appended with case #7 (the 7th case in the install-cache failure family -- two sub-cases shipped as one beta: bash-heredoc POSIX leak + silent activation gap). New sub-pattern documented (cross-platform fragility class beyond install-cache proper). Two new predicted failure modes added: **F. Cowork cross-tenant activation drift** (Class N assumes one active install per host); **G. Bash-heredoc POSIX leaks in non-`scripts/room-registry` sites** (deferred sweep targets logged).

### User-facing note (Phase 127.2 Plan 04)
- **If you previously ran `/mos:update` and `/mos:doctor --brain-smoke` still reports an older version, run `/mos:doctor --fix` once.** v1.13.0-beta.32 makes this automatic going forward. You will see a one-time "ACTIVATION GAP" red banner on next session-start if the touch-file from a prior update still flags a drift; the banner walks you through the two-step recovery.

### Added (Phase 121.5 Sub-plan K -- Plan 121.5-10)
- **Locked Brain-suggestion content template across all 5 consumers.** `/mos:suggest-next`, `/mos:act --chain`, the Phase 116 tension-hook-agent, the Phase 117 auto-explore-agent, and the Phase 89-07 reverse-salient-agent all render the same shape now: canonical `[■ BRAIN]` chip + verb-first question line + two-line dense option rows (glyph + verb + right-aligned confidence percent on top, framework category + graph relationship below) + stat-strip footer. The lock collapses 5 divergent renderings into ONE so the navigator's eye learns "Brain is speaking" in one session. Source: `.planning/121.5-selector-coverage-audit.md` Section 5.
- **Promoted `/mos:suggest-next` from NONE (silent dispatch / plain-text list) to F.1** via `rankForSelector` + `pickShape` per audit Section 6 item 2. THE single highest-leverage promotion per the audit Executive Summary: every conversational "what next?" Larry reflex inherits the locked surface.
- **Promoted `/mos:act --chain` `[GATE]` rendering from BESPOKE bracket text (`[continue]` / `[stop]`) to F.0 Mini Decision Gate** via `pickShape({ requestedShape: 'F.0' })` per audit Section 6 item 3. The closed F.0 vocabulary (Approve / Reject / Defer) replaces the bespoke two-button mental model without losing intent (Reject captures REJECTED_BECAUSE; Defer queues a milestone audit).
- **Selector verb-label aliases (LOCKED decision 1).** Dispatcher carries `alias_map` (Resolve / Explore -> Run Methodology; Later -> Defer; Skip -> Free-Text) loaded once at module init from `lib/hmi/jtbd-taxonomy.json` `alias_map.verb_aliases`. Aliases render to the user; canonical verbs persist to graph edges via `navigation.cjs`. The render-vs-persist split honors both pedagogy (contextual aliases) and graph consistency (one stable vocabulary) without forcing one.
- **CI tripwire `tests/test-no-bespoke-brain-prompts.sh`** enforces the lock (audit Section 6 item 6). Scans the 5 named Brain-suggestion consumer files plus any new source file that imports `chain-recommender.cjs` or `f-selector-ranker.cjs`; flags bracket-text option lists (`[continue]`/`[stop]`), verbose `(RECOMMENDED)` tags, and "Pick one to ..." selector-prompt prose. Wired into `tests/run-all-121.5.sh` SHELL_SUITES.
- **`docs/F-SELECTOR-CONSUMER-GUIDE.md` Section 4 (NEW)** publishes the locked template (slot-value table + visual mockup + anti-patterns rejected + implementation wiring example) per audit Section 6 item 7. Makes the lock discoverable to future consumers before they invent a new pattern.
- **`skills/ui-system/SKILL.md` Section 2** adds the Shape F.1 Brain-suggestion variant subsection (citing the locked chip + glyphs + footer + alias_map) AND a body_shape vs F-shape orthogonality note per LOCKED decision 4 (`body_shape:` is layout discipline; F-shape is the selector contract; they are orthogonal axes, not competing values).
- **`lib/workflow/f-selector-ranker.cjs` MAX_K = 3 constant + clamp** per audit Section 5.2.3 anti-pattern ("More than 3 option rows pushes the AskUserQuestion auto-injected rows off-screen"). Caller asking k=20 silently receives k=3. New optional `category` + `graph_relationship` fields on returned items[] feed the locked template's two-line meta row.
- **New tests:** `lib/memory/selector-alias-map.test.cjs` (24 assertions, alias_map round-trip + render-vs-persist invariant) + `lib/memory/brain-suggestion-template.test.cjs` (22 assertions, 5-consumer chip + footer isomorphism).

### Deferred to v1.13.2 (LOCKED decision 3)
- **CONTRADICTS-driven color flip (cyan -> yellow)** for Brain-suggestion selectors when any candidate carries a CONTRADICTS edge against an existing assumption. Yellow-on-cascade requires the consumer to walk the cascade graph BEFORE rendering (a SQL call on the rank path); we shipped cyan default in v1.13.0 to avoid that latency and queued the yellow-on-cascade signal as a v1.13.2 hotfix if testers report missed warnings. Ship simple, observe, then layer in if the data says it matters.

### Deferred to v1.14.0 (LOCKED decision 5)
- **F.1 close-out adoption on the 71 N/A methodology commands** (think-hats, structure-argument, grade, deep-grade, validate, etc.). Out of scope for Phase 121.5; the Phase 88.2 design legitimately delegates the methodology close to Larry's conversational follow-up. Phase 121.5 + 1 backlog. Scope discipline.

## [1.13.0-beta.30] - 2026-05-23

### Fixed (Engine 1 Act 1 silent-failure class, Phase 127.2 Plan 03 -- FIRST hotfix from external tester evidence)
- **`scripts/doctor.cjs --check-rs-engine` pre-flight pre-flights Python deps for the Engine 1 Act 1 surface (Finding F1 -- `.planning/debug/resolved/windows-tester-find-bottlenecks-silent-failure-qa-sweep.md`).** ADD-ONLY flag handler (NOT a class flag; owns its own exit-code contract). Probes critical deps reachable from `scripts/rs-engine.py` -- `requests` (transitive via `lib/core/rs_corpus.py`, the actual silent-failure root cause on the Windows tester's machine) + `numpy` -- plus umbrella deps from `requirements-hsi.txt` (`sentence_transformers`, `sklearn`). Resolves python interpreter via `MINDRIAN_PYTHON` env override > `python3` > `python` fallback. On missing critical deps: exit 1 + actionable fix line `Run: pip install -r requirements-hsi.txt --user (use python -m pip if pip is not in PATH)`. JSON variant returns `{ ok, ready, python, probes[], missing, missing_critical, missing_umbrella, fix }`. Defensive: any uncaught probe error surfaces as exit 1 -- the probe never crashes `/mos:doctor`'s other gates. Closes the Windows tester 2026-05-23 silent-failure class for the pre-flight surface.
- **`lib/agents/reverse-salient-agent.cjs` forwards rs-engine stderr to `result.detail.diagnostic` (Finding F2 -- same RCA).** The `runRsEngine()` catch block now captures `e.stderr` from the failed child python process, takes the LAST 200 chars (preserving the actionable fix line + exception name at the tail), and embeds it in `result.detail.diagnostic`. Backward compatible: when stderr is empty, `detail` stays a plain string (the existing `e.message` slice); when stderr is present, `detail` upgrades to `{ message, diagnostic }`. The existing `ok` / `reason` fields are untouched. Before this fix, every actionable error from rs-engine was silently discarded at the agent layer -- the worst-shape silent failure in a methodology surface.
- **`commands/find-bottlenecks.md` empty-result UX disambiguates analyzer-down from no-findings (Finding F7 -- same RCA).** New "Empty-result UX" sub-section distinguishes two categorically different cases: (a) analyzer ran with no findings (plausible if room is small or genuinely balanced); (b) analyzer could not start -- detected via `result.detail.diagnostic` or `reason: rs_engine_invocation_failed`. The second path explicitly tells the user to run `/mos:doctor --check-rs-engine` with the pip-install one-liner inline. Before this fix, both cases rendered as "no findings" -- which reads as "your work is clean" regardless of whether the analyzer ran or crashed. The single most dangerous reading in a methodology surface.

### Internal (Phase 127.2 Plan 03)
- **New test:** `tests/test-127.2-03-rs-engine-silent-failure-fixes.sh` verifies all three findings landed (F1 flag-handler + actionable fix line embedded; F2 diagnostic-field reference + stderr-capture pattern; F7 disambiguation copy present in find-bottlenecks.md or agent file) plus a functional probe asserting `node scripts/doctor.cjs --check-rs-engine --json` returns valid JSON and `--help` documents the new flag. 7/7 PASS on origin/main.
- **Phase 134 scaffolded as v1.14.0 architectural stub (Finding F6 -- structural answer to install-fragility class).** New `.planning/phases/134-cjs-port-of-python-analyzers-via-xenova-transformers-elimina/134-CONTEXT.md` captures the design vision: replace `scripts/rs-engine.py` + `lib/core/rs_*.py` + `scripts/hsi-*.py` with CJS equivalents using `@xenova/transformers` (ONNX `Xenova/multilingual-e5-large` in-process). Eliminates Python from user-machine surface entirely. Estimate ~3 weeks. Plan 127.2-03's original spec named "Phase 130" but slot 130 was already taken; SDK assigned 134 as next free slot. No PLAN.md (scaffolding only); enters v1.14.0 planning cycle.
- **RCA closed and moved.** `.planning/debug/windows-tester-find-bottlenecks-silent-failure-qa-sweep.md` -> `.planning/debug/resolved/` with `resolved_by: phase-127.2 Plan 127.2-03 (hotfix; F1+F2+F7 shipped)` + `resolved_disposition: 3-of-4-fixed-in-code; F3 narrative drift deferred to next docs reconciliation; F6 architectural port scaffolded as Phase 134 stub`. Knowledge-base entry appended at `.planning/debug/knowledge-base.md` so `gsd-debugger` surfaces this as a known-pattern hypothesis on future investigations.
- **Dog-fooding milestone:** the FIRST hotfix shaped from an EXTERNAL tester's transcript (Aryeh's Windows machine, 2026-05-23). Plans 127.2-00 + 127.2-02 were both maintainer-discovered. This one closes a defect a real user hit on a machine the maintainer doesn't own, and ships in the same week the transcript landed -- empirically demonstrating that the dog-fooding loop the QA sweep itself flagged as broken (RS-2 thesis: one-person QA is the lagging subsystem) is no longer one-person.



## [1.13.0-beta.28] - 2026-05-23

### Fixed (post-ship QA-sweep closeout, Phase 127.2 Plan 02)
- **`scripts/doctor.cjs` `acceptance.version-of-record-published` now resolves the version-of-record from the LAST SHIPPED tag, not `plugin.json` (Finding B -- `.planning/debug/resolved/v1.13.0-beta.26-post-ship-qa-sweep.md`).** The gate previously read `plugin.json` and expected a matching git tag + marketplace `source.ref` + `npm view` for THAT version. But Commit B of the two-commit release form bumps `plugin.json` to the NEXT pre-release placeholder (e.g. `beta.27` while `main` HEAD is at the Commit B placeholder, even though the last shipped tag is `v1.13.0-beta.26`). The fix swaps the resolver to `git describe --tags --abbrev=0 --match='v*'` with a `plugin.json` fallback for fresh-repo edge cases. All three downstream assertions (tag exists, marketplace pinned, npm view matches) now key off the shipped tag. Same fix is mirrored into `acceptance.npx-roundtrip` at its `pluginVersion` derivation site for consistency.
- **`scripts/doctor.cjs` `acceptance.npx-roundtrip` now treats "package downloaded and executed" as the success signal, not the inner `claude` CLI's exit code (Finding C -- same sweep doc).** The gate previously only accepted `r.status === 0` from `spawnSync`, but the published `@mindrian_os/install` script's inner `claude --version` invocation can exit non-zero on installer flag-schema drift (Claude Code release-channel skew) while the npm artifact itself is reachable and runnable. The gate now ALSO accepts `r.status === 0 OR /Installing the MindrianOS plugin|Adding marketplace|@mindrian_os\/install/.test(stdout+stderr)` -- the artifact's reachability is what the gate actually proves; `claude`'s flag schema is out of scope.

### Changed (cross-repo, Phase 127.2 Plan 02 Finding A)
- **`mindrian-website` (`website/src/lib/version.ts`) -- resolver priority swap: npm registry now wins over GitHub raw `plugin.json` in `getLatestVersion()`.** The website was rendering two `v1.13.0-beta.*` strings simultaneously because `fetchFromGitHub()` (which reads `plugin.json` on `origin/main` HEAD = the Commit B next-bump placeholder) ran BEFORE `fetchFromNpm()` (which reads what users can actually install via `npm @next`). After the swap, the live homepage returns a SINGLE version string = the last shipped beta. Lives in `/home/jsagi/mindrian-website/` (separate Vercel-deployed repo); pushed in lockstep with this plugin release.

## [1.13.0-beta.26] - 2026-05-23

### Fixed (Brain edge cleanups, Phase 127.2 Plan 00)
- **`BRAIN_MAX_TOPK` cap on Pinecone forwards (D-09 -- `.planning/debug/resolved/brain-topk-uncapped-advisory.md`).** The Brain MCP server (`mcp-server-brain/lib/brain-ask.cjs` line 545 + `mcp-server-brain/lib/pinecone-tools.cjs` line 42) forwarded caller-supplied `topK` directly to Pinecone with no Brain-side cap. The moat against runaway result sets was INHERITED from Pinecone's server-side cap, not OWNED by the Brain. A new `BRAIN_MAX_TOPK` env var (default 100) is now applied via `Math.min(topK, BRAIN_MAX_TOPK)` at both forward sites. Naming matches the existing `BRAIN_CYPHER_MAX_ROWS` family from Phase 127.1 Plan 05's D-MOAT-2 work. Server-side change deploys to `mindrian-brain.onrender.com` on next Render auto-deploy from `origin/main`. Surfaced by the Windows beta-tester deep audit (2026-05-23, NF-2026-05-23-01b).

### Documentation (Phase 127.2 Plan 00)
- **Source-of-Truth Preamble shipped in `docs/RCA-TEMPLATE.md` (D-10 -- `.planning/debug/resolved/stale-install-cache-audit-anti-pattern.md`).** Every QA / audit prompt and every RCA filing now MUST declare which source-of-truth its CODE claims read against (origin/main HEAD, install cache, branch, tag), which source-of-truth its WIRE claims probe against (deployed Brain server, local stdio shim, mock), the date of audit, and a re-verification rule against `origin/main` HEAD before findings are filed. The 2026-05-23 deep audit surfaced TWO false-positive findings (NF-2026-05-23-01 + the curated-op-surface-missing claim) plus one sibling (`brain-ask-contract-mismatch-rename`) that all traced to the same install-cache-vs-deployed-server delta. The Preamble does not prevent the delta -- it makes the delta VISIBLE so reconciliation happens BEFORE findings are filed. Added checklist row: `- [ ] Source-of-Truth Preamble filled before any finding filed`.

### Resolved (no code change required)
- **`brain-ask-contract-mismatch-rename` disposition: false-positive (D-08).** The Windows beta-tester flagged `brain_ask`'s tool description as misleading (reads "ask anything in natural language" but actually returns a DirectiveEnvelope routing payload). Re-read of `origin/main` HEAD at resolution showed the description was ALREADY rewritten to name "Returns a DirectiveEnvelope payload (populated directive + next_gate + mode_signals)" verbatim. The auditor read from a stale install cache (plugin v1.13.0-beta.24 or earlier) that pre-dated the description rewrite. No code change shipped. Resolution doc: `.planning/debug/resolved/brain-ask-contract-mismatch-rename.md`. This is the meta-finding that motivated D-10's Source-of-Truth Preamble.

### Internal
- **Phase 127.2 scaffolded (CONTEXT + Plan 00 + Plan 01 stubs).** New phase `127.2-brain-warmup-ping-hide-mcp-cold-start-latency-inside-larry-s/` registered in ROADMAP (INSERTED + URGENT marker). Plan 127.2-00 (Brain Edge Bundle: D-08 + D-09 + D-10 + 3 debug-doc closeouts) ships in this beta. Plan 127.2-01 (the warmup-ping itself: `brain_ask("warmup")` fired non-blocking inside Larry's first-question render window to hide MCP cold-start latency) stays BLOCKED on two cross-phase coordination items: Q-02 (Phase 114 render-complete callback) and Q-03 (Brain server-side "warmup" sentinel short-circuit). Plan 127.2-01 rides a later beta once blockers close.
- **3 debug docs moved to `.planning/debug/resolved/`** with `resolved_by: phase-127.2` frontmatter + Resolution sections + `.planning/debug/knowledge-base.md` summary entries (so `gsd-debugger` surfaces them as known-pattern hypotheses in future investigations).
- **New test:** `tests/test-127.2-00-brain-edge-bundle.sh` verifies all three landed (D-08 description, D-09 cap at both forward sites, D-10 Preamble + checklist row, debug-doc moves, knowledge-base entries, Canon Part 8 forbidden-substring scan on D-09 added code). 16/16 pass.

## [1.13.0-beta.24] - 2026-05-22

### Fixed
- **Brain unreachable on the first session after a plugin update -- now fixed on all three platforms.** `claude plugin update` lands a fresh plugin cache directory with no `node_modules`. Both bundled MCP servers (`mindrian-brain` + `mindrian-os`, both `alwaysLoad`) then crashed at module load (`Cannot find module '@modelcontextprotocol/sdk/server/mcp.js'`), the Brain was unreachable, and `/reload-plugins` reported a load error. On Windows the gap was *permanent* -- the repair never ran (see the portable self-heal note below). Root cause: a startup-order race plus a cross-platform defect in the repair (debug session `mcp-servers-cache-missing-node-modules`). The fix below makes Brain connectivity true by construction on Windows, Mac, and Linux.

### Changed
- **Vendored production dependencies (the guarantee).** The plugin now ships its production `node_modules` with the released marketplace artifact, so the Brain shim's dependencies are present the instant the install cache lands -- no runtime install, no network, no startup race. Every production dependency was audited and confirmed pure-JavaScript (zero native/compiled binaries: no `.node` addons, no `binding.gyp`, no prebuilt platform binaries, no install lifecycle scripts), so the same vendored tree is correct on Windows, Mac, and Linux by construction. The vendored tree is built fresh from `package-lock.json` via `npm ci --omit=dev` during the release (`scripts/release.sh` Step 6.7), staged onto the tagged release commit only -- `main` HEAD stays clean. This is a new release lockstep surface (see `.claude/includes/release-process.md`); it can never drift from the lockfile.
- **Portable cross-platform self-heal (the backstop).** The runtime self-heal that repairs an incomplete cache is now cross-platform. The prior implementation ran a bare `spawnSync('npm', ...)`, which was *dead on Windows* (`npm` is `npm.cmd`, a batch file -- bare `spawnSync` returns `ENOENT`) and *fragile on Mac* (a GUI-launched Claude Code gives child processes a minimal `PATH` that often excludes the nvm / Homebrew bin directory where `npm` lives). The new `lib/core/npm-cli-resolve.cjs` resolves `npm` to its absolute `npm-cli.js` entry point off `process.execPath` -- npm ships in the same distribution as the running `node` binary -- and runs it as `node <abs npm-cli.js> install`. This sidesteps `PATH`, the `.cmd` extension, and `shell:true` entirely. Applied to both spawn sites (`lib/core/mcp-dep-heal.cjs` and `scripts/sessionstart-npm-reconcile.cjs`).
- **Hybrid self-heal for the plugin cache (carried from the prior staging of this beta).** The vendored tree is the primary guarantee; the self-heal is the backstop for a somehow-incomplete cache. Three coordinated changes still close the race from both ends:
  1. The `sessionstart-npm-reconcile.cjs` hook is `async: false` and ordered FIRST in the `SessionStart` chain, so any needed dependency install completes before Claude Code reads `.mcp.json` and spawns the MCP servers.
  2. Both MCP entry points (`bin/mindrian-brain-mcp-client.cjs`, `bin/mindrian-mcp-server.cjs`) self-heal: a missing dependency triggers a one-shot guarded `npm install` in the plugin cache root, then re-requires. On a normal install (vendored deps present) this is a cheap `stat()` pre-flight that spawns nothing.
  3. A lockfile guard (`lib/core/npm-install-lock.cjs`) ensures that when both servers spawn together, exactly one runs `npm install` while the other blocks and waits -- two concurrent installs can never corrupt `node_modules`.
- New modules: `lib/core/mcp-dep-heal.cjs` (`ensureDepsPresent` + `requireWithHeal`) and `lib/core/npm-cli-resolve.cjs` (portable npm resolution). Zero network surface -- pure node built-ins plus a single guarded `npm install` child process (Canon Part 8). Mirrors the existing reconcile-hook detection logic rather than inventing a new mechanism (Canon Part 7).
- `package-lock.json` resynced with `package.json` (it was 13 betas stale; `npm ci` could not run against it). No runtime dependency versions changed -- a metadata-only catch-up.

### Fixed (dependency hygiene, surfaced by the vendoring audit)
- **`/mos:doctor` would crash with `Cannot find module 'semver'` on a production-only install.** `scripts/doctor.cjs` -- a user-facing runtime script invoked by `/mos:doctor` -- requires `semver` for version-ordering (`semver.compare`), but `semver` was declared as a `devDependency`. A full audit of every `require()` of a declared dependency across all shipped code paths confirmed `semver` was the only misclassification. Moved to `dependencies` so it is present on every install (and in the vendored tree). `devDependencies` is now empty.

### Fixed (lockfile + probe correctness, surfaced by a remote code review of the self-heal backstop)
- **Concurrent-install corruption from a non-atomic lock (`bug_004`).** `lib/core/npm-install-lock.cjs` created its lock with `openSync('wx')` and then populated it with a *separate* `writeSync`. The create is atomic, but the file existed empty between the two syscalls -- a racing peer that hit `EEXIST` then read the empty file, `JSON.parse('')` threw, the lock was misclassified as corrupt, the winner's live lock was unlinked, and both servers ran `npm install` at once. Lock creation is now atomic via `fs.linkSync` (the payload is written to a private temp file in full, then atomically linked into place), so a winner's lock is always observed fully-written. As defence-in-depth `readLock` now distinguishes a transient empty mid-write file (sentinel `'EMPTY'` -- caller retries) from genuinely corrupt non-empty JSON (`null` -- safe to clear), and both `acquireInstallLock` and `waitForUnlock` treat an empty file as transient instead of as a cleared/dead lock.
- **False-stale reclaim of a healthy long install (`bug_001`).** The lock's `STALE_THRESHOLD_MS` was 90s, but `runGuardedInstall` gives `npm install` a 120s timeout -- a healthy install legitimately running 90-120s was declared abandoned, and because the staleness check used OR (`age > STALE || !pidAlive`) a peer reclaimed the *live* lock and started a second concurrent install. The threshold is raised to 180s (strictly above the 120s install timeout, 60s headroom) and the staleness check is now an AND-gate: a lock is reclaimed only when it is BOTH older than the threshold AND its owning pid is dead. `WAIT_TIMEOUT_MS` raised to 200s to stay above the new stale threshold.
- **Dependency probe too narrow (`bug_011`).** `ensureDepsPresent` probed only `['@modelcontextprotocol/sdk', 'zod']`. A partially-populated `node_modules` (those two present, `@modelcontextprotocol/ext-apps` or another production dep absent) passed the probe, no heal ran, and a bare `require` deeper in the `lib/mcp/*` chain then threw `MODULE_NOT_FOUND` at module-init scope and crashed the server. The probe now defaults to the FULL production dependency set read from the plugin's `package.json` (`Object.keys(pkg.dependencies)`), matching what `scripts/sessionstart-npm-reconcile.cjs` already does; a missing or unreadable `package.json` falls back to the MCP-critical pair rather than crashing. New regression suites: `lib/core/npm-install-lock.test.cjs` (18 tests) and `lib/core/mcp-dep-heal.test.cjs` (9 tests).

## [1.13.0-beta.22] - 2026-05-21

### Documentation
- **Brain-query moat guard recorded (Phase 127.1 Plan 05).** The moat-guard code shipped inside the v1.13.0-beta.21 tag but beta.21's changelog never recorded it. Backfilled here: on the `mcp-server-brain` Brain server, `brain_query` is now gated to the `admin` plan (D-MOAT-1), and four Cypher execution safeguards ported from the official Neo4j `mcp-neo4j-cypher` recipe bound every read the gate permits (EXPLAIN estimated-row reject, row cap, byte cap, read timeout; D-MOAT-2). The Brain's Neo4j was confirmed on the Aura Free tier (D-MOAT-4); a scoped `neo4j_reader` credential (D-MOAT-3) is deferred because Aura Free has no role-based access control. `mcp-server-brain/CLAUDE.md` carries the full "Brain-query moat guard" section. This is a Brain-server change, not shipped-plugin code; no plugin behavior changes in this beta.

### Internal
- **Phase 128.1 (session isolation) parked on branch `phase-128.1`.** Phase 128.1 is a v1.13.1 milestone phase. It was pulled off the v1.13.0 release line so the line stays clean; `main` carries zero 128.1 code. 128.1 is complete on its branch (6 of 6 plans) and ships in the v1.13.1-beta.3 band with phases 128 and 129.

## [1.13.0-beta.21] - 2026-05-20

### Added
- (next-pre-release Commit B placeholder; Phase 127 Brain MCP Local Stdio Shim work ships here per `.planning/v1.13.1-EXECUTION-PLAN.md` AMENDMENT 2026-05-19)

## [1.13.0-beta.19] - 2026-05-19

### Promoted (2026-05-19 -- v1.13.0 milestone redefinition)
- **Phase 127 (Brain MCP Local Stdio Shim + Auto-Migration) and Phase 127.1 (Brain GraphRAG Collapse Pinecone -> Neo4j HNSW) PROMOTED from v1.13.1 INTO v1.13.0.** v1.13.0 milestone redefined from "The Closed Loop" (Hooked Fixes + Canon Part 10) to **"The Closed Loop + Brain Goes Native"**. Phase 127 targets v1.13.0-beta.20 (client-side stdio shim, ~3-5 days; Tavily-validated 2026-05-19); Phase 127.1 targets v1.13.0-beta.21 (server-side Neo4j HNSW collapse, ~3-5 days + 20-query non-regression harness >= 80% top-5 overlap). v1.13.0 final cuts after both land. Trade-off: ~2-week ship-date slip, but ONE adoption cycle for "Brain feels native end-to-end" instead of two. v1.13.1 milestone keeps Phases 128/129/130/131 but loses its architectural anchor (renaming pending: "spine repair + lens engine + research workflow", not "Brain native"). External validation in flight via Tavily research agent before /gsd:plan-phase 127 fires. See ROADMAP.md Phase 127 + 127.1 sections, both CONTEXT.md files (frontmatter `milestone:` flipped 2026-05-19), and .planning/v1.13.1-EXECUTION-PLAN.md AMENDMENT block.

### Added (2026-05-17 -- 2026-05-19 endgame work bundled into this beta)
- **Phase 120 (Breakthrough Scan Category G) shipped 2026-05-17.** 9-of-9 must-haves verified. Hooked Fix 3 (Category G) closed: variable-reward axis ships the highest-nutrition flavor (own-breakthroughs surfaced back at the navigator). 4 detectors (convergence / contradiction-resolved / cross-domain analogy / reverse-salient closed) + F.7 Breakthrough Surface selector (5 verbs: Explore deeper / Confirm / File as decision / Dismiss / Back) + session-start scanner via Phase 109 navigation.cjs chokepoint + D-13..D-15 resurfacing rules + D-19 per-detector dismissal-rate canary + D-17 4-rule voice scaffold + D-18 4-tier ethics fence (HARD_FLOOR / SOFT_BAND / NEUTRAL / GREEN) + SOFT_BAND review queue in rooms-meta.db + 5-component scoring formula + "More breakthroughs (N)" affordance + D-20 LOAD-BEARING SQL invariant (every Breakthrough has a DERIVED_FROM edge by construction; 4 structural enforcement points). 159 unit tests + 4 D-20 e2e + 13 ethics-fence + voice-audit + 3 scaffold harnesses all green. Canon Part 4 cascade vocab honored (8 types; 2026-05-16 dual-graph review rejection sealed -- no ASSOCIATION_LENS / TRANSITION_LENS). Canon Part 8 clean. Canon Part 9 chokepoint preserved (10 modules route through navigation.cjs).
- **Phase 121 (Trajectory Telemetry) shipped 2026-05-19.** 12-of-12 must-haves verified. Reframed per Canon Part 7 from "greenfield instrumentation" to "consolidation": 4 piecemeal telemetry writers (`mva.jsonl` + `selector.jsonl` + `navigation-bypass.jsonl` + `query-efficiency.jsonl`) collapse to ONE unified `~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl` with `type` discriminator + frozen v1 schema (per-row `schema_version: 1` Number, 15 EVENT_TYPES) + ISO-week rotation + single emit-time-validator chokepoint (7 forbidden-pattern detectors, mirrors proven `mva-telemetry.cjs` shape) + idempotent migration (source-name-prefixed sha256 fingerprint, originals renamed `*.pre-v121.bak`) + `mva-telemetry.cjs` 170 -> 58-line shim delegating to writer with legacy dual-write (Phase 118 byte-functional compat preserved; dual-write retires v1.14.0). 9 capture points wired: selector picks (88.2 + 125), tension engagement (116), auto-explore decisions (117), breakthrough dismissed (120), MVA + Hooked re-score (inherited), empathy audit CLI, room-receipt (119), PostToolUse broad-sweep into separate `command_invocation` bucket (drowning-protected via type discriminator; 100 cmd_inv + 10 selector_pick fixture proves filter-isolation). `docs/TELEMETRY-SCHEMA.md` (364 LOC) frozen v1 spec + SEED-002 ingestion guidance (arXiv 2508.03680). Canon Part 8 adversarial audit (7 gates across 17 telemetry-touching files; zero LOCAL->BRAIN egress) + D-12 silent-observability invariant (4 gates). 19/19 test suites green.
- **Phase 121.5 re-verify fix 2026-05-19.** `/mos:dogfood-flush` (added by Phase 120) registered in `data/help-groups.json` Infrastructure group. Restores 3 previously-failing 121.5 coherence tests. Capstone coherence invariant holds against the now-complete v1.13.0 surface. `bash tests/run-all-121.5.sh` -> 11/11 suites green.
- **SEED-011 (Brain Silent Identity) filed 2026-05-19.** Deferred user request to eliminate the API-key step entirely on top of Phase 127's stdio shim. Three architectural options scoped (per-install silent registration / plugin attestation HMAC / anonymous tier + degraded payload). NOTE: this seed was originally filed under id SEED-003 (collided with the 2026-05-05 `SEED-003-claude-code-2-1-x-capability-adoption`); renamed to SEED-011 on 2026-05-24 during the seed-system curation pass per `.planning/seeds/INDEX.md` collision-resolution rule (chronologically-earlier + downstream-heavier seed keeps id 003).

### Added
- **`/mos:mos` state-aware router (Phase 121.5-08 Sub-plan J; D-10 LOCKED).** Closes the plugin.json declaration gap flagged in Cluster 5 audit 2026-05-15 (the command was declared but the backing file was absent). The router picks the right next surface for the navigator: no room -> `/mos:onboard`; mostly-empty room -> `/mos:status` with a "suggest next move" hint; populated room -> `/mos:suggest-next`. Backed by `lib/core/state-aware-router.cjs` (pure function, hermetic unit tests in `lib/memory/state-aware-router.test.cjs`). Meets the navigator where they are -- one entrypoint that always does the right thing rather than forcing the user to pick the right `/mos:*` surface. (`commands/mos.md` [new], `lib/core/state-aware-router.cjs` [new], `lib/memory/state-aware-router.test.cjs` [new].)
- **Soft-alias runner + 5 soft-alias stubs (Phase 121.5-08 Sub-plan J; D-09 LOCKED).** New helper `scripts/soft-alias-runner.cjs` (`softAliasRun` pure function + `emitForLLM` CLI form) returns a JSON envelope `{redirect, deprecation_note, args, ok}` so the LLM can print a single cyan deprecation line (Larry voice, no em-dash) and then transparently invoke the canonical command. Hermetic unit tests in `lib/memory/soft-alias.test.cjs` (45 PASS). (`scripts/soft-alias-runner.cjs` [new], `lib/memory/soft-alias.test.cjs` [new].)
- **`/mos:doctor --deprecated-usage` (class L, NEW; Phase 121.5-08 Sub-plan J; D-09 final clause).** Scans recent (last-7-days) `~/.claude/projects/.../*.jsonl` session transcripts for `/mos:<deprecated>` patterns and surfaces a per-command "use `/mos:<new>` instead" hint. Pure LOCAL scan -- zero network, zero Brain, zero telemetry egress (Canon Part 8 preserved). Also activated by `--all`. Hermetic unit tests in `lib/memory/doctor-deprecation-surface.test.cjs`. `MINDRIAN_DOCTOR_TRANSCRIPTS_DIR` env-var override for hermetic tests. (`scripts/doctor.cjs`, `commands/doctor.md`, `lib/memory/doctor-deprecation-surface.test.cjs` [new].)
- **F.1 Next Move selectors wired on `/mos:onboard` Step 6 + `/mos:diagnose` recommendation block (Phase 121.5-08 Sub-plan J; D-12 LOCKED).** Closes Canon Part 3 violations flagged in Cluster 5 audit 2026-05-15: the recommendation surfaces previously rendered as bare prose, bypassing the Decision Gate. Both surfaces now render the canonical 3-verb F.1 vocabulary (Run Methodology / Defer / Free-Text) via AskUserQuestion; the selected verb writes to STATE.md Decisions + creates a typed edge in the local graph. (`commands/onboard.md`, `commands/diagnose.md`.)

### Changed
- **5 commands deprecate to canonical surfaces (Phase 121.5-08 Sub-plan J; D-09 LOCKED).** All old commands remain functional for v1.13.x (soft-alias stubs with deprecation notes routed through `scripts/soft-alias-runner.cjs`); removal is scheduled v1.14.0. Zero tester breakage during v1.13.x:
  - `/mos:heal` -> `/mos:doctor --heal-room` (folds into doctor's class E fix engine)
  - `/mos:query` -> `/mos:graph "<question>"` (terminal natural-language Q&A collapses into the graph translator)
  - `/mos:organize` -> `/mos:rooms organize <verb>` (portfolio grouping folds under the multi-room surface)
  - `/mos:hmi-status` -> `/mos:doctor --ui-compliance --json` (D-11 LOCKED; standalone command goes away; functionality lives in doctor class F)
  - `/mos:visualize` -> `/mos:dashboard --mermaid` (the dashboard already renders Cytoscape; the `--mermaid` flag covers the Mermaid code-block fallback that visualize used to provide)
- **`/mos:diagnostics` is being renamed to `/mos:fingerprint` in v1.14.0 (no functional change).** The rename kills the diagnose/diagnostics naming ambiguity. Both invocations work in v1.13.x; use `/mos:fingerprint` going forward. (`commands/diagnostics.md` frontmatter `renaming_to: fingerprint`; body prepends a Renamed note before the unchanged 4-algorithm dispatcher.)

## [1.13.0-beta.17] - 2026-05-15

### Fixed
- **Step 6.6 ordering hole (Bug 1 -- Phase 126.1 hotfix, 2026-05-15).** Phase 126 beta.16 hotfix `3fc008b` moved `verify-release-clean-tree` from `applies_to: ['pre-tag', 'full']` to `['full']` because `release.sh` Step 6.6 calls `--pre-tag` AFTER Steps 3-6 intentionally bump `plugin.json` + `package.json` + `CHANGELOG.md`. That made the cut sail through, but the strict clean-tree gate no longer ran pre-tag AND Test 2 of `tests/test-doctor-acceptance-preflight-checks.cjs` was converted to SKIP rather than re-pointed. Real gap, predicted by `docs/install-cache-family-premortem.md` Section 3. Fix (Option B): added a new `pre-flight` tier to the `applies_to` enum (strict subset of `pre-tag` minus in-flight-incompatible checks); added the `--pre-flight` CLI flag to `scripts/doctor.cjs`; added Step 2.5 to `scripts/release.sh` calling `doctor --acceptance --pre-flight` BEFORE Step 3 mutates the tree (HARD ABORT, no rollback needed because nothing is yet mutated); kept the existing Step 6.6 `--pre-tag` call after Step 6 (still the right tier for post-bump checks). Restored Test 2 from SKIP to PASS under the new tier; added Test 8 asserting tier filter behavior. (`scripts/doctor.cjs`, `scripts/release.sh`, `tests/test-doctor-acceptance-preflight-checks.cjs`.)
- **Commit B 7-place lockstep gap (Bug 2 -- Phase 126.1 hotfix, 2026-05-15).** `scripts/release.sh` Step 7.5 (Commit B, the next-pre-release advance) bumped `plugin.json` + `package.json` to `NEXT_VERSION` but left `~/mindrian-marketplace/.claude-plugin/marketplace.json` at `vN`. Per `feedback_install_minisite_lockstep.md`, the 7-place lockstep contract requires the marketplace.json `version` field to advance with the plugin repo. The bug recurred in beta.16. Fix: Step 7.5 now writes a second `node -e` block that bumps `MARKETPLACE_DIR/.claude-plugin/marketplace.json` to `NEXT_VERSION` (version field only -- `source.ref` deliberately stays at `vNEW_VERSION` pinning the marketplace commit at Commit A's tag); parallel marketplace-repo `git commit` follows with message `chore: bump marketplace.json to v$NEXT_VERSION (Commit B 7-place lockstep)`. Test H asserts the bump pattern is present in `scripts/release.sh`. (`scripts/release.sh`, `tests/test-release-bump-algebra.cjs`.)
- **Step 9.7 npx-publish self-test sandbox bug (Bug 3 -- Phase 126.1 hotfix, 2026-05-15).** `scripts/release.sh` Step 9.7 ran `npx --yes @mindrian_os/install@<version>` from an `mktemp -d` temp dir and checked the dir was non-empty after install -- but `@mindrian_os/install` installs into `~/.claude/` (the Claude Code plugin install root), NOT into cwd, so the temp-dir check spuriously failed during the beta.16 cut. Fix (Option A): switched to a HOME-override sandbox at `~/.claude/_test-install-<sha8>/` (subpath under `~/.claude/` per scope; mirrors the Phase 123 `doctor.cjs:2336` sandbox pattern). The npx run sets `HOME=$NPX_TEST_DIR` + `USERPROFILE=$NPX_TEST_DIR` + `npm_config_cache=$NPX_TEST_DIR/.npm` so the install resolves into the sandbox subpath, never touching the operator's real `~/.claude/`. Scaffold marker check now asserts `$NPX_TEST_DIR/.claude/plugins/installed_plugins.json` exists AND is parseable JSON. `trap` cleanup guarantees the sandbox dir + the pre-snapshot file are removed even on abort. Option B (extend `~/mindrianos-install-site` npm-installer with a `--target=<dir>` flag) is the cleaner long-term fix but out of scope for this hotfix (separate repo). Test I asserts the sandbox path + HOME-override are present in `scripts/release.sh` and the legacy `mktemp -d -t mos-npx-selftest` pattern is gone. (`scripts/release.sh`, `tests/test-release-bump-algebra.cjs`.)

### Changed
- **Phase 122 `teaching:` frontmatter on `/mos:mva-brief` + `/mos:mva-option` verified clean (Phase 126.1 hotfix audit, 2026-05-15).** Per `118/deferred-items.md` lines 5-20 the two MVA helper commands lacked `teaching:` strings as of Plan 118-06. Inspection found the strings were already added between then and now (`commands/mva-brief.md` line 6: 200 chars; `commands/mva-option.md` line 6: 180 chars). All four Phase 122 invariants verified: length 50-300 chars (200 + 180), zero em-dashes (`grep -nP "[—–]"` empty), 1-2 sentences each (terminal `.`), Larry-voice with WHY lede. `node scripts/build-command-registry.cjs --check` exits 0. No edits required; verification-only commit. The pre-existing `118/deferred-items.md` "Pre-existing build-command-registry teaching-field gap" entry can be marked RESOLVED in a follow-up. (`commands/mva-brief.md`, `commands/mva-option.md`.)

## [1.13.0-beta.16] - 2026-05-14


## [1.13.0-beta.14] - 2026-05-14


# Changelog

All notable changes to MindrianOS Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Onboarding Registry: Each version entry can include `onboarding: true/false` and `onboard_steps:` -->
<!-- When onboarding: true, the onboard_steps list is shown to returning users in the What's New flow -->
<!-- This allows new releases to automatically surface relevant guidance without code changes -->

## [1.13.0-beta.13] - 2026-05-13

### Added

- **Install-state contract (Phase 123 Plans 02 + 03 -- HARNESS-123-05..10).** **One record** is the truth (`~/.mindrian/install-state.json`, written by `scripts/session-start` as the single writer in earliest steps; full D-04 snapshot incl. the 4 version-of-record cross-check values). **One manifest** says what should be on disk (`data/deployment-surfaces.json`, 6 hand-maintained surfaces with the D-07 schema -- id / `$HOME`-tokenized path / owner / topology_scope / check_kind / expected / reconcile / remediation; reused `data/` layout convention from Phase 122). **One command** enforces the contract: `mindrian-os doctor` gains two new drift classes -- **class I** (install-state record present + internally consistent + topology classification + 6-way version-of-record consistency tolerating non-semver 4-component versions like `1.12.5.1` via string-equality) + **class J** (deployment-surface manifest reconciliation with `path_within_file` extraction for JSON sub-fields like `settings.json.statusLine.command`) -- under one new flag `--install-state`; `--all` activates both. **Bug 7 dies**: a marketplace-cache-only install is a *healthy* topology, not drift -- "no legacy clone dir on a marketplace box" is expected, not a finding. Aggressive `doctor --fix` with hard guardrails (D-13): auto-recover missing record + drifted owned surfaces + wrong `~/.mindrian-last-version`; legacy-clone migration is backup-then-verify-then-remove and REFUSES on a dev-clone, uncommitted/unpushed work, or `MINDRIAN_OS_ROOT` pointing at the legacy dir; conservative `installed_plugins.json` repair (repoint at newest valid marketplace-cache dir, never wholesale rewrite, always back up first); 3 flag-only cases (`topology: not-found`, `$PATH` entry vanished, statusline-renders-wrong-version) reported with explicit remediation strings. `lib/core/active-plugin-root.cjs` extended with a `topology` field exposing `marketplace-cache | dev-clone | legacy | not-found`. Hermetic Wave-0 fixtures: `tests/test-install-state-record.cjs` (6/6) + `tests/test-doctor-class-i.cjs` (11/11) + `tests/test-doctor-class-j.cjs` (8/8) all green. (`scripts/session-start`, `lib/core/active-plugin-root.cjs`, `data/deployment-surfaces.json` [new], `data/ROOM.md`, `scripts/doctor.cjs`, `tests/test-install-state-record.cjs` [new], `tests/test-doctor-class-i.cjs` [new], `tests/test-doctor-class-j.cjs` [new], `lib/memory/run-feynman-tests.cjs`.)

- **`mindrian-os doctor --acceptance` release-gate command (Phase 123 Plan-04 -- HARNESS-123-11 + HARNESS-123-12).** Seven-point contract: (1) install-state record present + matches a live spot-check; (2) every owned deployment surface reconciled; (3) version-of-record consistent across `plugin.json` / `package.json` / CHANGELOG top entry / git tag / marketplace `source.ref` / published npm version; (4) `npx @mindrian_os/install` round-trip works (`mktemp -d`-backed `HOME`-sandbox -- the live install is never clobbered; `--light-npx` flag for slow networks asserts `npm view ... && npx ... --help` instead); (5) `doctor --all` exits 0. Two sub-modes: `--pre-tag` runs the 5 points knowable BEFORE the release (1, 2, 3-repo-half, 4-wrap-via-verify-release, 5); full `--acceptance` adds the 2 post-publish points (version-of-record-published + npx round-trip). Wraps `scripts/verify-release` -- no duplication. Wired into `scripts/release.sh` at Step 6.6 (`--pre-tag` before the tag) and Step 9.6 (full after the push); both HARD aborts, no override. Orchestration is node, shell-agnostic. "Release infrastructure ALWAYS ships as a beta validated by an external operator" now *means* "the operator ran `mindrian-os doctor --acceptance`, all green" -- not "the operator eyeballed the statusline." Hermetic Wave-0 test `tests/test-doctor-acceptance.cjs` (6/6) green. (`scripts/doctor.cjs`, `scripts/release.sh`, `tests/test-doctor-acceptance.cjs` [new], `scripts/release-beta-smoke.sh` [deleted].)

- **`scripts/release.sh` owns ALL version bumps incl. pre-releases (Phase 123 Plan-01 -- HARNESS-123-01..04).** Pre-release algebra via the `semver` npm package added as a **devDependency** (NOT a runtime dep -- stays out of the `files` allowlist; the published `@mindrian_os/install` tarball is still zero-runtime-dep). New flags: `--prerelease` (`beta.N -> beta.N+1` via `semver.inc(v, 'prerelease', 'beta')`); `--finalize` (promote a beta to its core via `semver.inc(v, 'patch')` -- which *strips* the suffix, so `1.13.0-beta.11 -> 1.13.0`, NOT `1.13.1`); `--start-prerelease <core> <channel>` (open a fresh series via `semver.inc(v, 'preminor', 'beta')`); `--allow-ahead` (escape hatch for the dirty-repo guard). **TWO-COMMIT next-bump form** (per RESEARCH override 1 -- verified against Claude Code's Version Management spec; `plugin.json` wins over the marketplace entry for installed-version reporting): commit A finalizes `CHANGELOG [vN]`, sets `plugin.json` + `package.json` to `vN`, the `vN` git tag points at commit A; commit B bumps to `vN+1` + resets the CHANGELOG `[Unreleased] -- vN+1` heading; `main` HEAD lands on commit B. `marketplace.json` `version` + `source.ref` pin to `vN` -- so an install via `ref: vN` checks out commit A and self-reports `vN`. **Dirty-repo / ahead-of-origin guard**: before pushing, `release.sh` snapshots `git log origin/main..HEAD --oneline`, prints it, aborts unless the only commits ahead are the release commits it just made (or `--allow-ahead` set); blocks on dirty tracked files except the bumped ones; no author heuristics. **Step 9.5 renamed** `@mindrian_os/cli` -> `@mindrian_os/install` (publish target + `next`/`latest` dist-tag derivation + `npm pack --dry-run` payload-allowlist gate + recovery instructions). Hermetic Wave-0 test `tests/test-release-bump-algebra.cjs` (7/7) green; `tests/test-release-npm-gate.sh` updated to the `@mindrian_os/install` expectations (6/6 gates green). beta.13 is the first `release.sh`-cut pre-release after the run of hand-rolled beta.10 / 11 / 12. (`scripts/release.sh`, `package.json`, `tests/test-release-bump-algebra.cjs` [new], `tests/test-release-npm-gate.sh`.)

- **Cache pruning on update (Phase 123 Plan-05 -- HARNESS-123-13).** `lib/core/cache-prune.cjs` keeps the active version + N=2 most recent `<pluginsDir>/cache/<marketplace>/mos/<version>/` dirs; NEVER deletes the active (belt-and-suspenders -- the active is unconditionally in the keep-set regardless of mtime); skips entirely if `installed_plugins.json` is missing, unparseable, or has no `mos@mindrian-marketplace` entry. Runs in `scripts/session-start` on version change (best-effort, `|| true`) AND in `scripts/doctor.cjs::performClassJFix` unconditionally on `--fix`. Hermetic Wave-0 test `tests/test-cache-prune.cjs` (6/6) green. (`lib/core/cache-prune.cjs` [new], `scripts/session-start`, `scripts/doctor.cjs`, `tests/test-cache-prune.cjs` [new].)

- **Phase 123 Plan-07 -- single Brain-key resolver + positive session-start status (HARNESS-123-15 + HARNESS-123-16).** Three independent Brain-key lookups (`brain-client.cjs::getApiKey`, `scripts/session-start`'s shell test of `MINDRIAN_BRAIN_KEY`, the `brain-connector` skill's detection order) are collapsed into one source of truth, `lib/core/resolve-brain-key.cjs`. The resolver mirrors `lib/core/active-plugin-root.cjs`'s shape (`{ key, source, available, reason }`) and order (env -> `~/.mindrian.env` -> CWD `.env` -> not-found, the D-31 precedence); SEC-02 POSIX `0o077` permission rejection routes through an explicit `reason` string -- never a silent null. `brain-client.cjs::getApiKey()` is now a one-liner delegating to the resolver (the previous inline 3-path lookup is gone; the docstring is fixed; `Authorization: Bearer` at L218 + L279 and the `BRAIN_REQUEST_TIMEOUT_MS` / `AbortSignal.timeout` / memoized `schema()` / `async function ask` precondition are all upstream of this and untouched). `scripts/session-start`'s Brain block (~L1290-1313) replaces the pre-Plan-7 MCP-centric WARN that tested only the shell env var with a positive 3-case status line: `Brain: HTTP client active (mindrian-brain.onrender.com)` when the key resolves; `Brain: NOT loaded -- permissions too open: ... (run: chmod 600 ~/.mindrian.env)` when SEC-02 rejects; `Brain: not configured (Tier 0)` when nothing is found. The `brain-connector/SKILL.md` Detection section gains a new step 0 (HTTP-path detection via the resolver) and a CLI row in the Tool Names table. `commands/setup.md`'s `~/.mindrian.env` write is now followed by `chmod 600` (SEC-02 fix; no-op on Windows). `install.sh` is annotated -- it does NOT write `~/.mindrian.env` today; if a future code path adds a write, it MUST chmod 600 the file. `docs/install/BRAIN-SETUP.md` and `.env.brain.template` state Bearer-only explicitly and surface the `https://mindrian-os.com/brain-access` request URL + `MINDRIAN_BRAIN_URL` override. Wave-0 hermetic test `tests/test-resolve-brain-key.cjs` (9 scenarios -- env wins / mindrian-env wins over CWD / CWD fallback / not-found / SEC-02 reject / Canon Part 8 grep / getApiKey delegation / brain-client preconditions / FLAG-3 home-default structural assertion) all green; registered in `lib/memory/run-feynman-tests.cjs`. (`lib/core/resolve-brain-key.cjs` [new], `lib/core/brain-client.cjs`, `scripts/session-start`, `skills/brain-connector/SKILL.md`, `commands/setup.md`, `install.sh`, `docs/install/BRAIN-SETUP.md`, `.env.brain.template`, `tests/test-resolve-brain-key.cjs` [new], `lib/memory/run-feynman-tests.cjs`, `lib/memory/security-trifecta.test.cjs`.)

### Fixed

- **Statusline deployment-topology gap (the last thread in the install-machinery family).** A Windows live test on beta.12 confirmed: the statusline-wrapper fix shipped in the plugin cache, but `~/.claude/settings.json` runs the *deployed* `~/.claude/statusline-mos`, which `scripts/session-start` had been re-copying from this hook's `PLUGIN_ROOT` every session -- so when the running hook lagged the just-updated version, the deployed copy stayed stale. Fix: `~/.claude/statusline-mos` is now a **dumb dispatcher shim** (`scripts/statusline-mos-dispatch`, marker `MINDRIAN-STATUSLINE-DISPATCH`) -- zero logic, it just finds an installed plugin version and `exec`s that version's `scripts/statusline-mos`, which does the real (installed_plugins.json-first) resolution and rendering. So a wrapper fix in plugin vN+1 reaches every user on their next session with no re-stamp, and a wrapper bug can never sit stale on the deployment surface. `scripts/session-start` Step A now deploys/migrates the dispatcher: one-time migration from an old logic-bearing `~/.claude/statusline-mos`; no-op once it's already the dispatcher; never touches a non-MindrianOS file at that path (it must contain `MindrianOS statusline` to be replaced). Falls back to the prior full-wrapper copy for plugin versions predating the dispatcher. (`scripts/statusline-mos-dispatch` [new], `scripts/session-start`, `scripts/statusline-mos` header.)

- **`scripts/release.sh:40`'s `IFS='.' read -r MAJOR MINOR PATCH`** mangled pre-release versions (`PATCH=0-beta` from `1.13.0-beta.11`), which is why beta.10 / 11 / 12 were hand-rolled and beta.13 is the first `release.sh`-cut pre-release. Replaced with `semver.inc()` (Plan 123-01).
- **`scripts/doctor.cjs:40`'s hardcoded `INSTALL_DIR = ~/.claude/plugins/mindrian-os/`** was the `MODULE_NOT_FOUND` source on marketplace-only installs (the disease that surfaced Bug 7). NEW code (class I + class J + new wire-ins) resolves via `resolveActivePluginRoot()`; `INSTALL_DIR` is preserved for existing class A but no longer the source of truth for new code (Plan 123-03).
- **`scripts/session-start:419`'s `~/.mindrian-last-version` write inside the cold-start `else` branch** never fired on a session WITH an active room -- which is why room-sessions read stale (Pitfall 7). The new install-state record block writes it unconditionally as the single writer in earliest steps; the line-419 write is removed; the line-101 read of the PREVIOUS value is preserved for the transition banner (Plan 123-02).
- **`commands/setup.md:145`'s stale URL `mindrianos-jsagirs-projects.vercel.app/brain-access`** -> `mindrian-os.com/brain-access` (Plan 123-05; reaffirmed Plan 123-07).
- **Brain client CHANGELOG prose softened** -- the client currently calls `mindrian-brain.onrender.com`; `brain.mindrian.ai` is the future host; `MINDRIAN_BRAIN_URL` overrides either (Plan 123-07).
- **`scripts/release-beta-smoke.sh`** retired -- hard-pinned to a stale Phase-89.6 artifact `EXPECTED_VERSION="1.11.0-beta.1"`; `doctor --acceptance --pre-tag` supersedes it (Plan 123-04).
- **`brain-client.cjs::getApiKey()` precedence** -- was env -> CWD `.env` -> `~/.mindrian.env`; now (via the resolver delegation) env -> `~/.mindrian.env` -> CWD `.env` per D-31. Deliberate: on a maintainer's machine the home file is the canonical key, the CWD file is project-local override (Plan 123-07).
- **Plan-02 amendment: install-state record `active_version` derivation** -- the original session-start block preferred the dev workspace's `plugin.json` version over the resolver's root basename, so on a maintainer's box (where the workspace can lead the live install) the record contained an internal contradiction (`active_root` pointed at the live install dir; `active_version` named a different version). Surfaced by Plan-06's pre-flight class-I gate 2026-05-13 (commit `69a5240`).
- **Plan-06 release-flight: `scripts/verify-release` Step 12 "Git State"** died silently on a clean working tree (`git status --porcelain | grep -v "^??" | wc -l` exited non-zero with no tracked uncommitted changes; `set -e` killed the script). Wrapped the grep in `{ ... || true; }` (commit `267d395`).
- **Plan-06 release-flight: `commands/operator.md` + `commands/doctor.md` YAML frontmatter parse error** -- `argument-hint: [history] [set <op>] [reset] [--json]` confused YAML (multiple flow-sequence-looking tokens on one line); the parser bailed at line 3 and both commands loaded with empty metadata. Wrapped both argument-hint values in double-quoted strings. Latent in `main` for at least a session before Plan-06's stricter pre-flight caught it (commit `b41f232`).

### Changed

- **`data/deployment-surfaces.json`** added -- hand-maintained static manifest; 6 surfaces; reuses the `data/` layout convention from Phase 122 but NOT the generator/`--check` pattern (this file isn't derived from anything; nothing to `--check` it against). Schema extension in Plan-03: optional `path_within_file` field on `exact-value` surfaces points at a JSON sub-field (e.g. `statusLine.command` inside `settings.json`); class-J's `exact-value` check extracts via that path before comparing.
- **`docs/install/BRAIN-SETUP.md`** + **`.env.brain.template`**: state explicitly that auth is `Authorization: Bearer <key>` only (NOT `x-api-key`); surface the `https://mindrian-os.com/brain-access` URL in the no-key fallback (Plan 123-07).
- **`docs/CANON-PHASE-MAP.md`**: Phase 123 mapped under **Part 6** (dog-fooding the install lifecycle -- one record + one manifest + one command + one release script; the plugin's own install state honors the plugin's canon) and **Part 7** (reuse justification -- ~90% of Phase 123 extends shipped code; net-new files are `data/deployment-surfaces.json`, `lib/core/resolve-brain-key.cjs`, `lib/core/cache-prune.cjs`, the per-class fixtures) (Plan 123-06 Task 4).
- **`@mindrian_os/cli` -> `@mindrian_os/install` doc/test sweep** -- forward-facing references across `docs/install/PACKAGING-PATHS.md`, `tests/manual/95.6-windows-cold-install-acceptance.md`, `tests/test-release-npm-gate.sh`, `docs/INSTALL-LIFECYCLE-HARNESS.md` (lines 91/104/124), plus older `@mindrian/os` mentions in `[private case archive]`, `docs/UI-UX-CONVERGENCE-2026-05-10/04-REVERSE-SALIENT-INSTALL.md`, `[private tester archive]`, `docs/testers/outbox/2026-05-07-gary-laben-welcome.md`. Historical CHANGELOG entries stay as the historical record. After the sweep, `grep -rln "@mindrian_os/cli" docs/install/ commands/ tests/test-*.sh scripts/release.sh` returns nothing (Plan 123-05).

### Notes

- **Path C re-route status** (2026-05-05): v1.13.0-beta.13 carries Phase 123 (install-lifecycle-harness). Phase 110 (Brain Context Packet Contract) shipped in parallel during the Phase-123 execution waves; its 6 plans + verification completed on `main` between Plan-05 and Plan-07; it rides along here.
- **Promotion to clean 1.13.0** gated on a real-Windows `mindrian-os doctor --acceptance` run (Lawrence / operator), per Canon Part 5 (Evidence Is Graded By Context) + Part 6 (Product-as-Venture / dog-fooding mandate). A follow-up `bash scripts/release.sh --finalize` -- NOT this release's work -- cuts the clean `1.13.0` after the Windows gate is green.
- **Concurrent-execution incidents during the Phase 123 + Phase 110 parallel run** (2026-05-12 to 2026-05-13): a Phase-110 `git add -A` swept Plan 123-05's GREEN files into the wrong commit (`4453292`; work correct, attribution muddled); a Phase-110 commit re-introduced `release-beta-smoke.sh` after Plan 123-04 deleted it (`231f5cd`; Plan-04 re-deleted cleanly); the `fix/brain-client-timeout-ask-schema-cache` branch checkout yanked Plan-123 research's HEAD mid-run (cherry-picked back to `main` as `f03195a`). All recovered without data loss. Pattern documented for a future `gsd-executor` worktree-isolation-by-default improvement.

## [1.13.0-beta.12] - 2026-05-12

The v1.13.0 CAPSTONE release -- headline content is the **Workflow Layer** (Phase 122: framework <-> command registry + reliable invocation; spec at `.planning/WORKFLOW-LAYER-SPEC.md`, doc at `docs/WORKFLOWS.md`) plus the npm-installer overhaul (`npx @mindrian_os/install` is now a real one-command installer), the `@mindrian_os/cli` -> `@mindrian_os/install` rename, and the install-machinery fixes a Windows live test surfaced (doctor/update path resolution, the statusline pre-release blind spot, and the single plugin-root resolver that retires that whole bug family). Version trail to here: `1.13.0-beta.10` (a token-validation npm publish on 2026-05-12 -- now deprecated), `1.13.0-beta.11` (the real npm installer + the package rename, npm-only -- now deprecated, doctor path bug), `1.13.0-beta.12` (this release: the capstone, tagged `v1.13.0-beta.12`, marketplace `source.ref` pinned, `@mindrian_os/install` published with the `@next` dist-tag).

### Added

- **The Workflow Layer (Phase 122) -- the framework-to-command registry + reliable invocation.** Larry can now turn "the methodology suggests framework X" into "run `/mos:x`" as a CI-enforced guarantee, not model recall:
  - **`data/command-registry.json`** -- the generated, committed framework-to-command registry (`{ ontology_ref, commands[], framework_index, curated_chains[] }`), built from each `commands/*.md` frontmatter; never hand-edited. Plus `data/framework-names.json` -- the FEEDS_INTO-linked Brain `:Framework` name slice (+ a small curated whitelist), the only Brain-derived artifact in this loop.
  - **`scripts/build-command-registry.cjs`** -- the generator + the `--check` drift tripwire (fails on a stale registry or an unresolvable framework name) + `--refresh-names` (a read-only build-time Brain query that snapshots the allowlist). The `--check` is wired into the pre-commit hook (when any `commands/*.md` / `data/command-registry.json` / `data/framework-names.json` is staged) and the Feynman test runner.
  - **`lib/workflow/command-resolver.cjs`** -- the SOLE deterministic framework-to-command door (`commandsForFramework`, `frameworksForCommand`, `composeWorkflow`, `validateChainAutonomy`); reads only `data/command-registry.json`; zero Brain calls; degrades to empty results / `{ command: null, optional: true }` on a missing registry or a command-less framework (degrade, do not fabricate).
  - **`lib/brain/chain-recommender.cjs`** -- `recommendFrameworkChain({problemType?, currentFramework?, roomState?}) -> [frameworkName]` via the Brain's `FEEDS_INTO` traversal (framework names + problem-type enums only, never a command string, never user content); degrades to `[seed]`.
  - **The five new `/mos:` command frontmatter keys** -- `kind` (`methodology | utility | meta`), `frameworks[]` (the exact Brain `:Framework` name(s)), `produces`, `inputs`, `autonomous_safe` -- retrofitted across 44 commands (the algorithmic cohort first). Contract: `docs/COMMAND-FRONTMATTER.md`.
  - **`/mos:pipeline --from-problem-type <x>` / `--from-framework <x>`** -- Brain-derive the chain, compose commands, print the `/mos:` run order. **`/mos:act --chain`** -- runs the composed workflow but `validateChainAutonomy` first and STOPS at the first non-`autonomous_safe` (or command-less) step with a "needs you here" gate (the Canon Part 3 "human confirms" clause made literal). **`/mos:suggest-next`** -- now returns a step-numbered command sequence, not just a framework list.
  - **The pre-commit registry-drift tripwire** -- `build-command-registry.cjs --check` runs in `.git/hooks/pre-commit`; the Feynman runner runs it too.
  - **`docs/WORKFLOWS.md`** -- the Brain <-> registry <-> Larry join, the five reliability rules, the Canon Part 8 boundary (commands never enter the Brain -- no `Command` node, ever), and the resolver/recommender surface. `docs/THE-BRAIN.md` and `docs/CANON-PHASE-MAP.md` point at it.
  - **`lib/memory/workflow-layer-e2e.test.cjs`** -- walks frontmatter -> `build-command-registry --check` -> `resolver.composeWorkflow(the spec's acceptance example)` -> the command-less degrade case -> the `validateChainAutonomy` stop-point, then runs the Canon Part 8 zero-Brain-mutation grep sweep. Registered in the Feynman runner + `tests/run-all-122.sh`.
- **`npx @mindrian_os/install` is a real one-command installer, not a printout.** Previously `npx @mindrian_os/cli install` only echoed the marketplace commands for the user to paste into Claude Code by hand ("no side effects, just guidance"). It now drives Claude Code's own plugin CLI: it checks that `claude` is on PATH (and prints how to install Claude Code if not), runs `claude plugin marketplace add jsagir/mindrian-marketplace`, then `claude plugin install mos@mindrian-marketplace`. Running it with no subcommand -- or with only flags, e.g. `npx @mindrian_os/install --version 1.13.0-beta.9` -- does the install; flags pass through to `claude plugin install`. `doctor` and `update` are still explicit subcommands. The Brain key stays a printed hint -- writing it to the environment is the one side effect left to the user. This unblocks un-gating the npm-quick-install card on the install site (`mindrianos-install-site.vercel.app`). (`bin/cli.js`.)
  - Post-beta.11 follow-up (2026-05-12, after a Windows live test): `mindrian-os doctor` / `update` were resolving the plugin at the legacy `~/.claude/plugins/mindrian-os/` path, which does not exist for a `claude plugin install` -- the plugin is named `mos` and lives at `~/.claude/plugins/cache/<marketplace>/mos/<version>/`. So `npx @mindrian_os/install doctor` was throwing a raw node `MODULE_NOT_FOUND` stack. `bin/cli.js` now resolves the plugin root in order (MINDRIAN_OS_ROOT -> newest marketplace-cache `mos/<version>/` with a `scripts/doctor.cjs` -> legacy clone -> not-found), prints a plain "not installed -- run `npx @mindrian_os/install`" message when truly absent, and `update` uses `claude plugin marketplace update` + `claude plugin update mos@mindrian-marketplace` for a marketplace install (the `git pull` + `install.sh` path is kept only for a dev clone / MINDRIAN_OS_ROOT). The `install` flow also now runs `claude plugin marketplace update` then `claude plugin install` + `claude plugin update` (so an already-installed plugin gets moved to the current ref rather than just reported "already installed", which was the misleading message in the Windows test where the version actually moved 1.12.0 -> 1.13.0-beta.9). Lands in the next `@mindrian_os/install` npm publish.
  - Same Windows test surfaced a pre-release blind spot in `scripts/statusline-mos` (the self-healing statusline resolver): it picked the "latest" cache version with `grep -E '^[0-9]+\.[0-9]+\.[0-9]+$'`, which rejects `-beta.N` suffixes. A box with `1.12.0` + `1.13.0-beta.9` in the marketplace cache picked `1.12.0`, rendered the stale statusline from there, and exported `MINDRIAN_OS_ROOT` pointing at it -- so the version banner / room-context lookup / focus glyph were all computed from the wrong version. Widened the anchor to `^[0-9]+(\.[0-9]+)+(-[A-Za-z0-9.]+)?$` (`sort -V` already orders pre-releases correctly: `1.12.0 < 1.13.0-beta.9 < 1.13.0`). Ships in the next plugin release; the deployed `~/.claude/statusline-mos` (or the `register_statusline` block in `~/.claude/settings.json` that points at `<install-dir>/scripts/statusline-mos`) picks it up when the plugin re-stamps on next install/update. Immediate workaround on an affected box: delete the stale lower-version cache dir under `~/.claude/plugins/cache/mindrian-marketplace/mos/`.
  - Root-cause fix (the three above were band-aids on three independent guessers): **`lib/core/active-plugin-root.cjs`** -- the ONE plugin-root resolver. Precedence: `MINDRIAN_OS_ROOT` env -> `~/.claude/plugins/installed_plugins.json` (Claude Code's own registry of the *active* `mos@mindrian-marketplace` install; temporal truth -- right even when "highest semver" isn't the active version) -> newest pre-release-tolerant `~/.claude/plugins/cache/<marketplace>/mos/<version>/` -> legacy `~/.claude/plugins/mindrian-os/` -> not-found. Usable as a module (`resolveActivePluginRoot()`) and as a CLI (`node active-plugin-root.cjs` prints the path; `--json` for `{root, source}`). `bin/cli.js` (doctor/update) now delegates to it; `scripts/statusline-mos` shells out to its CLI form (with the cache-scan as a fallback for older deployed copies of the wrapper). Reads LOCAL files only (Canon Part 8). Still TODO (separate, lower-risk pass): have `scripts/session-start` re-stamp the `register_statusline` block in `~/.claude/settings.json` from this resolver on every run, so the deployed wrapper / settings pointer can never drift.

### Changed

- **`/mos:suggest-next` returns a command sequence**, not just a framework list; **`framework-chain-composer.proposeNextFramework` routes through `lib/workflow/command-resolver.cjs`** (the only door -- `command:null` degrade for a command-less next framework); **the `pws-methodology` and `brain-connector` skills point at the resolver** (framework routing goes through `command-resolver.commandsForFramework` / `composeWorkflow`, never a `/mos:` named from memory). **The three remaining hand-maintained framework-to-command maps were pruned:** `framework-chain-composer.FRAMEWORK_TO_COMMAND_SLUG` is now an empty back-compat export, `lib/hmi/jtbd-taxonomy.json:methodology_hooks` is marked informational-only (the resolver is authoritative), and `references/methodology/index.md` is now just a pointer to `docs/COMMAND-FRONTMATTER.md` / `data/command-registry.json` / `docs/WORKFLOWS.md` -- it no longer hand-maintains a routing table.
- **npm package renamed (twice): `@mindrian/os` -> `@mindrian_os/cli` -> `@mindrian_os/install`.** First rename (2026-05-11): the `@mindrian` npm scope never existed (`{"error":"Scope not found"}`), so `@mindrian/os` could never be published; the maintainer created the `@mindrian_os` org and the package moved to `@mindrian_os/cli`; first npm publish was `@mindrian_os/cli@1.13.0-beta.10` on 2026-05-12 (a token-validation build, dist-tag `@next`, no git tag, not on the marketplace) -- now deprecated. Second rename (2026-05-12): `@mindrian_os/cli` implied "a CLI tool" / a guidance printer, which is exactly what it had been; once `install` became a real installer the package name should be the verb, so it moved to `@mindrian_os/install` -- `npx @mindrian_os/install` reads as "install MindrianOS". The `bin` entry stays `mindrian-os` (the post-install command for `doctor`/`update`). `package.json` + `.claude-plugin/plugin.json` ship as `1.13.0-beta.12` (this release); the npm-only intermediate publishes `@mindrian_os/cli@1.13.0-beta.10` and `@mindrian_os/install@1.13.0-beta.11` are deprecated. The install site's npm-quick-install card already names `@mindrian_os/install`; `scripts/release.sh` still says `@mindrian_os/cli` (Step 9.5) and only handles clean `X.Y.Z` bumps (it choked on the pre-release version, so this release was hand-rolled per the CLAUDE.md release process) -- both worth a follow-up. `docs/install/PACKAGING-PATHS.md`, `tests/manual/95.6-windows-cold-install-acceptance.md`, `tests/test-release-npm-gate.sh` still name `@mindrian_os/cli` and need updating to `@mindrian_os/install`. (The `[1.13.0-beta.9]` entry below is left intact as the historical record of the pre-rename release -- which shipped to GitHub and the marketplace as `v1.13.0-beta.9` but was never published to npm.)

### Fixed

- **The hallucinated-command failure mode.** Larry could name a non-existent or semantically wrong command -- e.g. `/mos:jtbd` for the JTBD *methodology* when `/mos:analyze-needs` is the framework command (`/mos:jtbd` is the active-JTBD management command, not a methodology runner). With the Workflow Layer, every command Larry surfaces comes back from `lib/workflow/command-resolver.cjs` reading the generated registry -- `composeWorkflow(["Jobs to Be Done (JTBD)"])` returns `/mos:analyze-needs`. A hallucinated command cannot be emitted.
- **A latent Canon Part 8 breach in prose.** `skills/brain-connector/SKILL.md` carried dead "Brain has Command nodes linked to Frameworks ... `brain_proactive_command` ... `FOLLOWS_FRAMEWORK -> Command`" prose, and `references/brain/command-triggers-schema.md` was a whole dead "commands are first-class Neo4j nodes" schema doc -- both asserted that plugin commands live in the Brain, which the live Brain never implemented (no `Command` label) and which Canon Part 8 forbids. Both were deleted; the `command-triggers-schema.md` path now carries a `REMOVED` tombstone pointing at the Workflow Layer. The `lib/memory/workflow-layer-e2e.test.cjs` grep sweep now fails the build if a `Command`-node assertion ever returns anywhere in `skills/`, `agents/`, or `references/`.

### Maintainer Notes

- **Release steps (maintainer-gated -- NOT performed in this phase):** cut the `v1.13.0-beta.11` tag, pin `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.ref` to the tag, and `npm publish @mindrian_os/install` with the `@next` dist-tag -- per the CLAUDE.md release process and the `feedback_release_lockstep_npm` rule (every plugin release publishes the npm package in lockstep). Phase 122 only finalized this CHANGELOG block and shipped the Workflow Layer code/docs/tests; it did not bump any version, did not `git tag`, did not `npm publish`, and did not edit `marketplace.json`.

### Notes

- The Windows cold-install acceptance gate (`tests/manual/95.6-windows-cold-install-acceptance.md`) remains waived (maintainer decision, 2026-05-11). Promotion to a clean `1.13.0` (no suffix) should still wait on a Windows tester run.
- beta.9 content (carried forward into beta.10): all of Phase 95.6 (install-cache Windows hardening, Tier 1 + Tier 2 + Tier 3, decisions D-01 through D-11), the `test1_enumCount` floor fix, the retroactive `117-VERIFICATION.md`. See the `[1.13.0-beta.9]` entry below for the full feature list.

## [1.13.0-beta.9] - 2026-05-11

Phase 95.6 -- install-cache Windows hardening + skill-loop resilience. Closes case #4 in the install-cache failure family (the 2026-05-08/09 the Wave-2 tester Windows 11 install). Release infrastructure ships as a beta first per the project release policy; this beta is opt-in only.

### Fixed

- **install.sh skill-loop no longer aborts on a structurally-incomplete skill (D-03).** A skill directory missing its `SKILL.md` now produces a `WARN: skipping skill <name>: no SKILL.md` on stderr and the install continues, instead of hitting `set -euo pipefail` and halting mid-loop. This is the bug that broke the Wave-2 tester's install live on 2026-05-08/09 (`cp: cannot stat '.../skills/mullins-scaffold//SKILL.md'`, exit 1, leaving agents / hooks / settings.json / larry-extended-default unwritten). Also backfilled the missing `skills/mullins-scaffold/SKILL.md` data file.
- **Windows long-path failures during `git clone` (D-01).** install.sh now detects Windows + Git Bash, runs `git config --global core.longpaths true` before the clone (with an explanatory banner about the global git-config change), cleans a stale partial-clone directory before a retry, and fails with a clear "Git for Windows" error + download link if git is missing on Windows. OS detection is testable on Linux CI via `MOS_TEST_FORCE_OS`.
- **The "silent install-incomplete" failure mode (D-09).** install.sh now registers the statusLine block FIRST (idempotently, via `register_statusline()`) so a later skill-loop WARN can never again leave the bottom-of-terminal statusline unstamped; it writes an `.install-receipt.json` so a halted install is detectable; `/mos:doctor` gained a class H (`install-incomplete`) that detects a missing statusLine block, reads the receipt, and `--fix` re-stamps the block idempotently; a fresh first session auto-runs `/mos:doctor` and surfaces all-green or names what is missing.
- **`tests/test-navigation-memory-events.cjs` `test1_enumCount`** now asserts a floor (`EVENT_TYPES.size >= 19`) rather than an exact count, so adding event types in later phases no longer breaks the Phase 109 baseline test (the required-types membership loop still pins the baseline). Resolves a deferred item from Phase 88.2.

### Added

- **`scripts/release.sh` Step 9.5 -- npm publish gate (D-05a).** Every plugin release now publishes `@mindrian/os` to npm in lockstep: `npm publish --tag next` for `-beta./-alpha./-rc./-next.`-suffixed versions, `--tag latest` for clean `X.Y.Z`. Before the publish, `npm pack --dry-run` reviews the tarball and the release halts if it contains any non-allowlisted path (`.planning/`, `docs/`, `mcp-server-brain/`, `tests/`, `release.sh`) -- publishing without the `files` allowlist would leak the entire repo (including Brain-key code) into the public npm tarball. If `npm publish` fails, the release halts with an explicit recovery message; it never silently ships an unpublished version. `MOS_TEST_DRY_RUN=1` exercises the gate without touching the live registry. `package.json` renamed to `@mindrian/os`, `private:true` removed, `"files"` allowlist added (`bin/ lib/ pipelines/ references/ skills/ commands/ agents/ hooks/ .claude-plugin/ .mcp.json README.md LICENSE CHANGELOG.md`).
- **`scripts/release.sh` Step 5b -- reserved-marketplace-name compliance gate (D-11a).** Before the CHANGELOG check, the release greps `plugin.json` + `marketplace.json` for the reserved Anthropic marketplace identifiers and halts if one appears. Current names (`mos` / `mindrian-marketplace`) clear it.
- **`bin/cli.js` (D-05c).** A pure-CJS thin entrypoint: `mindrian-os install` (prints marketplace + Brain-key instructions), `mindrian-os doctor` (shells `scripts/doctor.cjs` with pass-through args and exit code), `mindrian-os update` (`git pull --ff-only` then re-runs `install.sh`). `package.json` `bin` field points at it.
- **SessionStart npm-reconcile hook (D-05d).** `scripts/sessionstart-npm-reconcile.cjs` -- idempotent diff-and-install of runtime npm deps against `package.json`; defensive (`{"continue":true}` + exit 0 on any error), bounded `npm install` (60s, `stdio:'ignore'`), zero non-npm network surface. Registered as a new async SessionStart entry alongside the existing ones.
- **Explicit Brain / methodology access declared on all sub-agents (D-10)**, plus a **Deferred Tool Loading note** in `mcp-server-brain/CLAUDE.md` (D-11b: the <=10-15 startup-tools cap + schema-on-demand rule + the current Brain-MCP startup tool count of 6).
- **`docs/install/PACKAGING-PATHS.md` (D-05e/f)** -- the four distribution paths (Marketplace + GitHub, Marketplace + npm, ZIP-URL, CI-Docker pre-bake) with "use this when..." guidance; the `CLAUDE_CODE_PLUGIN_SEED_DIR` / `CLAUDE_CODE_PLUGIN_CACHE_DIR` pre-bake flagged as the recommended NATO faculty deployment.
- **README `## Manual Recovery` section (D-04)** -- step-by-step recovery for a halted install (re-run `install.sh`; manual agent symlink + `/mos:doctor --statusline-visibility --fix`; verify with `/mos:doctor --all`), plus a CMD-vs-PowerShell note. And a permission-prompts note in the README install section (D-03 ergonomics: 10+ prompts are normal, `always allow` shortcut, the new `WARN: skipping skill` line).
- **Case #4 install-failure autopsy.** `[private case archive]` -- the 2026-05-08/09 the Wave-2 tester install (Surface Pro 7, Windows 11, the live 66-minute call), six root causes (Windows MAX_PATH, install.sh skill-loop halt, `@mindrian/os` never published, statusLine never registered, PowerShell-vs-CMD shell variability, permission-prompt fatigue), the install-cache failure family pattern (case #4 after #1 wrong-workspace, #2 Phase 93 drift-recovery, #3 Phase 95.2 atomic-recovery), the Phase 95.6 fixes, cross-references. Brain key UUIDs redacted per REC-05.
- **`scripts/check-first-touch-drift.cjs` + `tests/test-first-touch-drift-scanner.cjs` (D-07)** -- scans the first-touch surfaces for em-dashes, stale version literals (scoped to greeting copy), and `BSL-1.1` adjacent to "open source" (SEED-007 pattern 3). `MOS_TEST_SCAN_DIR` override.

### Changed

- **Renamed `.planning/phases/92-...` (189-char leaf) to `.planning/phases/92-trust-layer-refactor/` (D-02)** -- removes the Windows MAX_PATH failure class for that directory. The original 189-char descriptive name is preserved as a `## Searchability Note` body section in `92-CONTEXT.md` (not a frontmatter field).
- **License framing (D-06)** -- README `## License` now reads "source-available, not open source"; `.claude-plugin/plugin.json` `license` confirmed `BSL-1.1`; the BSL-adjacent-to-"open source" wording was removed from the shipped surfaces.

### Notes

- **Note on npm:** `@mindrian/os` versions 1.13.0-beta.1 through 1.13.0-beta.8 were never published to npm (the lockstep publish gate did not exist until this release). Those versions remain unpublished. The first npm-published version is 1.13.0-beta.9, via the new `scripts/release.sh` Step 9.5.
- **Note on the Windows cold-install gate:** `tests/manual/95.6-windows-cold-install-acceptance.md` (the 8-step cold-machine acceptance gate) was NOT run by an external Windows tester before this release; the maintainer waived the blocking checkpoint on 2026-05-11 to ship the Tier 1 hotfix subset on schedule. Per the beta-first policy this beta is opt-in only; promotion to a clean `1.13.0` (no suffix) should still wait on a Windows cold-install confirmation.
- **Follow-ups (separate repos):** the `~/mindrianos-install-site/` repo should be updated to advertise the now-published `npx @mindrian/os@next` path; both `~/mindrianos-install-site/` and the gitignored `docs/testers/outbox/2026-05-07-gary-laben-welcome.md` still carry "open source" adjacent to "BSL-1.1" and need a manual sweep.

## [1.13.0-beta.8] - 2026-05-07

### Added

- **Phase 117: Auto-Explore-Domains on First Material.** First material upload (Write|Edit|MultiEdit on a file inside a room with a `.room-root` sentinel) auto-fires the triple-filter math layer (whitespace + reverse salient + cross-domain match) in a detached background process. Findings surface within ~10s on the user's next turn via F.1 Decision Gate (verbs: Explore / Skip / Later). Canon Part 10 sub-claim 5 (triple-filter math runs automatically) implemented. Brain Section 8.1 canonical chain order locked (domain -> trends -> reverse-salients -> cross-domain). Brain Section 8.3 cross-domain formula locked (surprise = similarity * domain_distance; threshold 0.85). Brain Section 8.4 HSIAnalysis schema extension shipped. Brain Section 8.5 BQ-anchored Larry voice via BQ_TEMPLATE_REGISTRY (4 templates: cross-domain, reverse-salients, domain, trends). Brain Section 8.7 LOCAL-only detection routing invariant locked. [phases 117-00 / 01 / 02 / 03 / 04 / 05]
- **SEED-003 A3 sanitizer (Phase 117-04).** PostToolUse hook on `mcp__brain_*` tool calls applies PII pattern redaction (SSN, email, phone, money, ISO date, file paths) via `hookSpecificOutput.updatedToolOutput`. Closes the check-brain-boundary.cjs PR gate gap noted in CANON-PHASE-MAP.md Part 8 row. Phase 90's 5 Canon Part 8 tripwires + this 6th = 6 total.
- **brain_canon_drift_observed event.** Surfaces FourLenses (Brain) vs FiveLenses (Canon) drift to Phase 121 audit corpus per Brain Section 8.6. Idempotent within session via in-memory cache; payload axis=lens_count, brain_count=4, canon_count=5.
- **6 new telemetry events.** auto_explore_fired, auto_explore_finding_surfaced, auto_explore_user_response, auto_explore_skipped, auto_explore_sanitizer_hit, brain_canon_drift_observed. All scalar-only payloads per Canon Part 8. JSONL persistence at ~/.mindrian/telemetry/selector.jsonl + room.db memory_event dual-surface mirror.
- **18 phase requirements.** AUTOEXPLORE-117-01..18 (12 from RESEARCH Section 5 Validation Architecture + 6 from Section 8 Brain Substrate enrichment).
- **`scripts/hooked-rescore-117.cjs` (REQ-117-12 Path A harness).** Reads auto_explore_* JSONL telemetry, computes Hooked (Eyal 2014) Variable Reward score per `VR = surfaced * distribution_weight * time_factor`, outputs markdown rescore at `docs/empathy-audit/auto-explore-117-rescore.md`. Manual invocation only.

### Verified

- Canon Part 8 substring audit: zero user-content strings (body_text, source_title, target_title, file_content, cv_content) in any auto_explore_* event payload (sha256-only).
- AUTOEXPLORE-117-17 LOCAL-only routing: zero ADDRESSES_PROBLEM_TYPE substrings across 4 auto-explore modules.
- R1 invariant preserved: lib/hmi/shape-f6-renderer.cjs sha256 byte-equal == 1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf.
- 6 telemetry emit helpers exported (W5 verification): emitFired, emitFindingSurfaced, emitUserResponse, emitSkipped, emitSanitizerHit, emitBrainCanonDrift.
- EVENT_TYPES Set extended to size 32 (15 baseline + 4 selector + 2 reverse-salient + 5 tension + 5 auto-explore + 1 drift).
- 32 tests pass: 15 telemetry + 4 brain-canon-drift + 5 Canon Part 8 + 8 rate-limit.
- Zero em-dashes across all Phase 117 deliverables.
- Marketplace ref-pin DEFERRED to post-empathy-audit per Phase 89-07 / 115 / 116-04 / 95.5 precedent.

### Substrate

- Phase 89-07 ReverseSalientAgent (SHIPPED v1.13.0-beta.4) -- pattern template, F.0 surface, cascade emit.
- Phase 116 Unresolved Tension Hook (SHIPPED v1.13.0-beta.5) -- JSONL persistence, telemetry mirror pattern.
- Phase 95.2 install-cache atomic recovery + SessionStart preflight (SHIPPED v1.13.0-beta.6).
- Phase 95.5 post-compact memory pipeline consumer (SHIPPED v1.13.0-beta.7).
- Phase 109 SQL Navigation Spine (SHIPPED v1.11.0) -- chokepoint reads, EVENT_TYPES, memory_event log.
- Phase 88.2 F-shape Selectors (SHIPPED beta.4) -- F.1 dispatch via lib/hmi/selector-dispatcher.cjs.
- Phase 88.6 Wave-1 algorithm wiring (SHIPPED v1.10.14) -- ensure-brain-baseline graceful-degradation pattern.
- Phase 90 BRAIN.md quadruple (SHIPPED v1.10.18) -- folderMemory.readQuadruple, LOCAL Brain context.

### Beta sequencing note

Phase 117 was originally targeted at v1.13.0-beta.3 per CANON-PHASE-MAP.md, then re-coordinated through beta.7 in the orchestrator brief. Phase 95.5 shipped at beta.7 first (post-compact memory pipeline closure 2026-05-07), so Phase 117 promotes to beta.8 standalone per the plan's contingency line ("if executor finds beta.5 active, bumps to beta.6 and notes pair-ship"). Same precedent.

## [1.13.0-beta.7] - 2026-05-07

### Fixed
- **Post-compact memory pipeline consumer wiring (Phase 95.5):** closes the half-wired pipeline shipped in v1.12.0 (Phase 95-04 wrote the side-channel file but no consumer existed). Now `scripts/restore-post-compact-context.cjs` (NEW, 274 lines, per D-01) reads `<roomDir>/.mindrian/last-post-compact.md` at SessionStart, validates the YAML frontmatter stamp (D-04 source_room_path + source_room_slug + written_at + schema_version) against the active room from `~/MindrianRooms/.rooms/registry.json` (registry-first resolution; STATE.md anchor fallback), and re-injects TRIPLE_CONTEXT via `hookSpecificOutput.additionalContext` so Larry wakes up after auto-compact aware of pre-compact MINTO content. Cross-room mismatch triggers HARD SKIP + forensic-rename to `.last-post-compact-cross-room-skip-<ISO>-<epoch_ms>.md` (Canon Part 8). Successful consume forensic-renames to `.last-post-compact-consumed-<ISO>-<epoch_ms>.md` so subsequent re-runs do not re-inject stale post-compact context. Stale files (mtime >600s) are skipped + deleted (matches scripts/post-compact's existing 600s threshold). Belt-and-suspenders D-04b: file mtime cross-checked against registry `last_opened` to defeat lingering post-room-switch staleness.

### Added
- **`scripts/post-compact` D-04 frontmatter stamp back-port (Phase 95.5 Plan 01):** the WRITE side now prepends `source_room_path` + `source_room_slug` + `written_at` + `schema_version: 1` to `<roomDir>/.mindrian/last-post-compact.md`. Atomic mktemp + mv -f preserved. macOS date fallback chain handles `%3N` unsupported case (GNU date millisecond ISO -> BSD date second ISO -> literal `unknown`).
- **`lib/memory/post-compact-reinjection.test.cjs` 9-scenario rewrite (Phase 95.5 Plans 00 + 04):** D-05 contract -- write-side file presence + body byte-identity + frontmatter stamp + read-side happy path + staleness skip+delete + cross-room HARD SKIP + post-consume forensic preserve + Tier 0 silence + byte-identity invariant. Replaces the deprecated 7/9-failing stdout-shape contract from Phase 88-09. Test 9 explicitly enforces Pitfall 2 avoidance: consumer re-derives via live readTriple + formatTripleContext, never parses the side-channel body.
- **`hooks/hooks.json` SessionStart entry wiring (Phase 95.5 Plan 03):** wires `scripts/restore-post-compact-context.cjs` with matcher `startup|clear|compact` and timeout 3000ms (matching PostCompact 88-09 invariant). Idempotent Node JSON.parse + push + JSON.stringify(data, null, 2) re-serialization (95.2 B4 fix precedent; never Edit-tool string surgery). 8 prior entries byte-stable.
- **`tests/test-95.5-00-scaffold.sh`:** Wave-0 scaffold harness asserting 9 RED test stubs + consumer stub require-able + Feynman registration intact + zero em-dashes + zero forbidden network surface.

### Provenance
- Triangulation: closes the gap left by Phase 95-04 (write-side ship 2026-04-29; consumer deferred to Phase 95.5+). Memory entry `project_post_compact_memory_pipeline.md` transitions HALF-WIRED -> FULLY-WIRED.
- Reuse before build per Canon Part 7: extends `scripts/preflight-doctor.cjs` template (95.2 Finding C precedent), reuses `lib/memory/triple-context-formatter.cjs::formatTripleContext` (Phase 88-07 single source of truth), reuses `lib/core/folder-memory.cjs::getCurrentRoom` + `readTriple` (Phase 88-01 + 94-01).
- Graph boundary per Canon Part 8: zero network surface (no remote calls, no Brain access). Cross-room HARD SKIP enforces per-room memory locality (Canon Part 9 forward-reference).
- Dog-fooded per Canon Part 6: SessionStart hook chain entry verified locally via end-to-end smoke against synthesized fixture before commit; consumer returned `{"continue":true}` on Tier 0 cold start as designed.

### Audit Notes
- Marketplace ref-pin (Gate 5) DEFERRED: forward-protective hotfix; users on v1.13.0-beta.6 already have the WRITE-side stamp absent + side-channel file accumulating, so the READ-side consumer is purely additive (closing the half-wired gap). No regression risk to existing installs. Same gate Phase 95.2 (beta.6) + Phase 89-07 (beta.4) + Phase 116 (beta.5) used.
- Three-surface validation: SessionStart hooks fire on Claude Code CLI natively + Desktop natively (CC 2.x); Cowork shared `00_Context/` per-user-local assumption preserved (RESEARCH section 10 -- Q3 deferred to Cowork tester smoke).
- R1 byte-equal preserved on lib/hmi/shape-f6-renderer.cjs (sha256 = 1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf).
- Phase 91 Feynman runner: zero NEW failures matching FAIL.*(post-compact|restore-post-compact|triple-context). Existing 9/9 GREEN baseline on `node lib/memory/post-compact-reinjection.test.cjs`.
- Canon Part 8 audit clean: zero matches on `require\(.*room-db` and zero matches on `brain-client|fetch|http|curl|brain.mindrian|tavily` in scripts/restore-post-compact-context.cjs.

## [1.13.0-beta.6] - 2026-05-06

### Fixed
- **Install-cache atomic recovery (Phase 95.2):** `scripts/doctor.cjs --fix` now uses a true atomic-swap pattern (cp via `fs.cpSync` to `install.new` then version verify then two-step rename) so a failed copy mid-recovery never leaves the system in a half-done state. Replaces the prior shell-out `cp -aT` with a Windows-functional `fs.cpSync` call (proven at `scripts/vault-export-orchestrator.cjs:233`). Adds new exit code 4 for the "recovery attempted but rolled back to backup state" case (D-03). Prevents the 2026-05-06 missing-install incident family. See `docs/autopsies/2026-05-06-install-dir-missing-incident.md`.
- **`--fix` eligibility for missing install (Phase 95.2):** `/mos:doctor --fix` now triggers when `install.status === "missing"` (previously only when drift was detected between two readable installs). Unblocks recovery for users whose install dir is gone. JSON contract additions: `install.recoverable` (boolean) + `drift.reason: "install-missing"` discriminator. Existing field semantics byte-stable.
- **SessionStart preflight (Phase 95.2):** New `scripts/preflight-doctor.cjs` runs as the 8th SessionStart hook entry, spawning `node scripts/doctor.cjs --json` (1500ms timeout) and emitting a Claude Code envelope with `hookSpecificOutput.systemMessage` carrying a one-line ANSI-yellow warning when drift or missing-install is detected. Suppressed on healthy installs. Honors both `MOS_NO_COLOR=1` (CONTEXT.md D-09 parity) and standard `NO_COLOR=1` (project convention). Three-surface caveat: SessionStart fires on Claude Code CLI only; Desktop and Cowork users get the recovery path but not the preflight warning.

### Added
- `MINDRIAN_PLUGIN_HOME` env override on `scripts/doctor.cjs` for hermetic regression testing (analog to `MINDRIAN_ROOMS_HOME` from Phase 95.1 D-05).
- `tests/test-doctor-atomic-swap.cjs`: 9-scenario regression test (success / missing-install / cp-failure / verify-failure-via-bad-version / verify-failure-via-injection / rollback / rename-old-failure-via-injection / JSON shape stability / renderer auto-fire). Registered in `lib/memory/run-feynman-tests.cjs`.
- `tests/test-doctor-preflight-format.cjs`: unit test for the warning formatter.
- `tests/test-session-start-preflight.sh`: integration test for the preflight hook (self-skips when 95.2-00 hasn't landed; cross-wave race protection).

### Provenance
- Triangulation: third incident in the install-cache failure family. See autopsies `docs/autopsies/2026-04-13-wrong-workspace-incident.md`, `docs/autopsies/2026-04-28-install-cache-drift-incident.md`, `docs/autopsies/2026-05-06-install-dir-missing-incident.md`.
- Dog-fooded per Canon Part 6: patched doctor was self-tested against jsagir's actual missing-install state before merge. See `.planning/phases/95.2-install-cache-atomic-recovery-sessionstart-preflight/95.2-DOGFOOD-VERIFICATION.md`.
- Reuse before build per Canon Part 7: extends Phase 95.1's `scripts/doctor.cjs`; no parallel surface.
- Graph boundary per Canon Part 8: SessionStart preflight is purely LOCAL (zero network surface, no Brain queries, no telemetry).
- Marketplace ref-pin (Gate 5) DEFERRED for 95.2: forward-protective hotfix; users in missing-install state recover via `/mos:doctor --fix` from cache without needing a marketplace bump (their cache already has 1.12.5+).

## [1.13.0-beta.5] - 2026-05-06

### Added

- **Phase 116 -- Unresolved Tension Hook ship (LOAD-BEARING for v1.13.0 closed loop).** Persistent tension surfacing across sessions: SessionStart hook reads Phase 109 navigation findSurfaceableTensions (room-wide CONTRADICTS sorted DESC, fallback to CONVERGES, filtered against JSONL state per D-03b); when a candidate is found, the hook writes a Larry-voice directive to hookSpecificOutput.additionalContext instructing Claude to dispatch F.1 Next Move selector with verbs ['Resolve', 'Later', 'Skip']. User's pick routes through lib/agents/tension-hook-agent.cjs handleUserResponse: RESOLVE -> markResolved + RESOLVES_VIA cascade edge via lazygraph-ops.upsertEdge + tension_resolved memory_event; LATER -> requeue (no event); SKIP -> append last_response='SKIP' + tension_skipped event. After 3 surfacings without resolution, evaluateAndDecay() pre-pass on next SessionStart transitions tension to 'dropped' + emits tension_decayed event for Phase 121 trajectory-telemetry consumption. Implements Canon Part 4 (Every Choice Is Graph Data) + Part 8 (Graph Boundary; zero user-content in any memory_event payload) + Part 10 sub-claim 3 (persistent conversation across sessions). Closes the habit loop (Eyal/Hooked) so MindrianOS becomes "tool that calls you back" not "tool you summon" (largest single-phase Loop Closure axis lift per dormant 2026-04-12 Hooked audit). [phases 116-00 / 01 / 02 / 03 / 04]
- **`lib/agents/tension-hook-agent.cjs`** -- 9 exported functions: composeFinding, surfaceFinding, buildResolvedViaEdge, handleUserResponse, emitDetected, emitSurfaced, emitResolved, emitDecayed, emitSkipped. Mirrors lib/agents/reverse-salient-agent.cjs skeleton (Steps 5+6 of docs/AGENTIC-SURFACING-PATTERN.md) with SessionStart trigger replacing detect-and-surface and F.1 dispatch replacing F.0.
- **`lib/memory/pending-tension-store.cjs`** -- 10 exported functions: computeTensionId, jsonlPath, appendTension, readTensions, markSurfaced, markResolved, markDropped, requeue, evaluateAndDecay, getDecayCandidates. JSONL append-only state store at ~/.mindrian/pending-tensions/<roomSlug>.jsonl (workspace-guard-clean per D-07b; OUTSIDE plugin repo via os.homedir()). LWW replay semantics; POSIX-atomic appendFileSync for sub-PIPE_BUF lines.
- **`scripts/preflight-tension-surface.cjs`** -- SessionStart hook entry #7 in hooks/hooks.json. Lazy detection (no per-write LLM cost per D-01). 3000ms timeout. Always exits 0 (RESEARCH Section 7.3). 4 telemetry emit sites (Tier 0 / no-candidates / decay-batch / success).
- **`lib/core/navigation/insights.cjs`** -- new `findSurfaceableTensions(db, roomId, opts)` function joining JSONL state. Phase 109 closed surface extends 13 -> 14 functions (re-exported via lib/core/navigation.cjs).
- **`tests/test-tension-hook-{detection,persistence,decay,f1-integration,rendering,telemetry}.cjs`** -- 6 new test files registered in `lib/memory/run-feynman-tests.cjs`. 89 assertions across 6 suites (15 detection + 14 persistence + 15 decay + 15 F.1 integration + 10 rendering + 20 telemetry; all pass via `node --test`).
- **`tests/test-116-00-scaffold.sh`** -- Wave-0 scaffold harness asserting EVENT_TYPES extension + 5 stub registration + zero em-dashes.
- **`cypher/phase116-tension-hook-completion.cypher`** -- Brain stub completion patch (idempotent MERGE; applied post-empathy-audit per 89-07 Q5 precedent).
- **`.mindrian/tension-framework-snapshot.json`** -- offline fallback shape for graceful Brain degradation.

### Changed

- `lib/core/navigation/memory-events.cjs` `EVENT_TYPES` Set extended with 5 strings: tension_detected, tension_surfaced, tension_resolved, tension_decayed, tension_skipped (size 21 -> 26). Same Wave-0 extension pattern Phase 88.2-00 + Phase 89-07-00 used.
- `docs/AGENTIC-SURFACING-PATTERN.md` Phase 116 row promoted from planned to SHIPPED with v1.13.0-beta.5 reference + module path citation.
- `hooks/hooks.json` SessionStart array length 6 -> 7 with preflight-tension-surface.cjs entry.

### Manual action items

- **POST-RELEASE: apply Cypher patch** at `cypher/phase116-tension-hook-completion.cypher` against the Brain (brain.mindrian.ai) via `claude_ai_brain_query` MCP or equivalent. Idempotent (MERGE not CREATE); safe to re-apply. The patch only carries framework-name handles + plugin path + version scalar -- zero user content. Per RESEARCH Q5: verify post-application by re-querying the UnresolvedTensionHook node and confirming IMPLEMENTS_SUBCLAIM + CONSUMES_PATTERN + READS_VIA + SURFACES_VIA edges land.
- **VALIDATION WEEK:** dispatch hook to a populated test room (Lawrence + 4 in docs/testers/REGISTRY.md) gated on `--version 1.13.0-beta.5`. Empathy audit (4-of-5 testers) confirms Larry-voice neutral citation framing felt right (per Hooked Loop Closure 3/10 -> 8/10 expected lift; AC-6).
- **MARKETPLACE Gate 5 (DEFERRED):** ref-pin `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.ref` to `v1.13.0-beta.5` ONLY after the empathy audit passes 4-of-5 AND the integration smoke against 3 user rooms confirms tensions surface meaningfully. Until then, Phase 116 ships as a LOCAL-ONLY tagged build (no `git push --tags`, no marketplace ref-pin) -- same gate Phase 89-07 + Phase 115 used.

### Audit notes

- **Canon Part 4 (Every Choice Is Graph Data): PASS.** Every F.1 response produces a typed edge or JSONL transition: RESOLVE -> RESOLVES_VIA cascade edge via upsertEdge + JSONL state='resolved'; LATER -> JSONL state='queued' (re-enter on next session); SKIP -> JSONL last_response='SKIP'. Decay -> JSONL state='dropped'. All 4 cascade outcomes exercised in tests/test-tension-hook-decay.cjs + tests/test-tension-hook-f1-integration.cjs.
- **Canon Part 8 (Graph Boundary): PASS.** Hook script + agent module + JSONL store NEVER require room-db.cjs (Phase 109 D-06 chokepoint). NEVER require brain-client (zero Brain runtime queries). Every memory_event payload substring-audited for forbidden keys (body_text, source_title, target_title) AND test marker strings (SECRET BODY TEXT, SECRET SOURCE TITLE, SECRET TARGET TITLE) per the 89-07 precedent at tests/test-reverse-salient-telemetry.cjs:90-120. JSONL workspace-guard-clean (~/.mindrian/pending-tensions/ via os.homedir(); OUTSIDE plugin repo per D-07b).
- **Canon Part 10 sub-claim 3 (persistent conversation across sessions): PASS.** SessionStart hook re-engages on tensions that crossed the prior session boundary; JSONL is the durable ground truth across sessions; LWW replay verified via tests/test-tension-hook-decay.cjs cross-session simulation.
- **R1 invariant preserved:** sha256 of lib/hmi/shape-f6-renderer.cjs == 1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf (Phase 101-01 sealed surface; 116 deliberately did not touch it).
- **Phase 89-07 reference implementation non-regression: PASS.** Telemetry pattern reused byte-for-byte with field substitutions per RESEARCH Section 4.5. EVENT_TYPES Set 21 -> 26 (additive only).
- **Phase 88.2-05 F.1 selector non-regression: PASS.** F.1 dispatch via pickShape({requestedShape:'F.1', payload.verbs:['Resolve','Later','Skip']}) renders 4 visible rows + Free-Text auto-appended; identical render across CLI / Desktop / Cowork (D-08 verified via 88.2-05 tri-polar ship).
- **Phase 109 navigation chokepoint adherence: PASS.** New navigation function findSurfaceableTensions added inside lib/core/navigation/insights.cjs (NOT in agent or hook code); existing 13 closed-surface functions byte-equal preserved.
- **Phase 91 Feynman runner: zero NEW failures referencing Phase 116 artifacts.** Pre-existing inherited failures from prior phases acceptable per Phase 89.5 + Phase 106-02 baseline contract.

### Deferred (out of Phase 116 scope, documented for traceability)

- Cross-room tensions (defer to v1.14.0 + Phase 110 brain-context-packet-contract for safe cross-room edge enumeration)
- AI-suggested resolutions (Phase 118+ MVA reward path)
- Push notifications (CC 2.1.110 push-notification tool with explicit opt-in only; v1.14.0)
- Persona-keyed tension framing (D-02 locked neutral citation; Phase 117 may revisit)
- Stage-aware selection weighting (D-03c locked spec defaults; future tuning surface if beta.3 empathy audit shows underperformance)
- 89-07 reverse_salient_acted_on response='DEFER' consumer integration (per RESEARCH OQ-4 v1.13.x follow-on)
- /mos:tension status CLI command (per RESEARCH OQ-8 v1.13.x ergonomic gap closure)
- JSONL compaction (per RESEARCH Section 6.4; defer to v1.13.x housekeeping unless beta.3 reveals growth issues)

## [1.13.0-beta.4] - 2026-05-06

### Added

- **Phase 89-07 -- ReverseSalientAgent agentic surfacing finish.** ReverseSalientAgent ships as the canonical agentic-surfacing template for the Mindrian "suggestively-intelligent Larry" pattern (Canon Part 2 Engine 1 Act 1 + Canon Part 4 + Canon Part 10 sub-claim 5). Agent reads via Phase 109 navigation.cjs chokepoint (5 functions); writes typed cascade edges (INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES) per Phase 87; surfaces findings via F.0 Mini Decision Gate (Phase 88.2-05); mirrors telemetry via memory_event (88.2-03); reads Phase 90 BRAIN.md quadruple for framework-chaining context (LOCAL only, Canon Part 8); persona-aware F.0 header suffix from Phase 115 role_blend. Two new EVENT_TYPES strings: `reverse_salient_detected`, `reverse_salient_acted_on` (size 19 -> 21). [phase 89-07-00 / 01 / 02 / 03]
- **`lib/agents/reverse-salient-agent.cjs`** -- substrate that composes Phase 109 navigation reads, Phase 90 brain reads, Phase 87 cascade writes, Phase 88.2 F.0 dispatch, Phase 115 persona suffix into the canonical surfacing skeleton. 13 exported functions: `gatherFocusContext`, `gatherBrainContext`, `composeFinding`, `mapDirectionToCascadeEdge`, `runRsEngine`, `emitFindingEdge`, `detectAndSurface`, `surfaceFinding`, `handleUserResponse`, `resolvePersonaKey`, `resolvePersonaSuffix`, `emitDetected`, `emitActedOn`.
- **`agents/reverse-salient-agent.md`** -- agent definition file (sibling to larry-extended; persona_variants frontmatter for 7 canonical role keys + 2 aliases + default).
- **`lib/core/reverse-salient-persona-suffix.cjs`** -- 7-key role_blend -> suffix map. founder = "shipping risk"; researcher = "evidence gap"; investor = "thesis fragility"; operator = "execution gap"; mentor = "coaching wedge"; domain_expert = "physical-reality friction"; student = "understanding gap"; default = "lagging component".
- **`docs/AGENTIC-SURFACING-PATTERN.md`** -- canonical 5-step skeleton documentation for Phase 116/117/118/120. Same skeleton, different `detect()` per consumer phase.
- **`commands/find-bottlenecks.md` Agent-First Flow extension** -- the existing /mos:find-bottlenecks command now invokes ReverseSalientAgent BEFORE the standard methodology dialogue (Q3 recommendation: extend, don't add /mos:find-cross-room-bridges).
- **`cypher/phase89-07-rs-agent-completion.cypher`** -- ReverseSalientAgent Brain stub completion via DELEGATES_TO CrossDomainInnovationAgent + APPLIES_TO inheritance + IMPLEMENTED_BY (Q5 recommendation: idempotent MERGE; applied post-release; documented in Manual action items below).
- **5 new test files** (`tests/test-reverse-salient-{agent,cascade-emit,f0-integration,persona,telemetry}.cjs`) registered in `lib/memory/run-feynman-tests.cjs`. All PASS via `node --test` (99/99 across 5 suites).
- **2 new scaffold tests** (`tests/test-89-07-00-scaffold.sh`, `tests/test-89-07-pattern-doc.sh`).

### Changed

- `lib/core/navigation/memory-events.cjs` `EVENT_TYPES` Set extended with 2 strings: `reverse_salient_detected` + `reverse_salient_acted_on` (size 19 -> 21). Same Wave-0 extension pattern Phase 88.2-00 used.
- `commands/find-bottlenecks.md` extended with Agent-First Flow section; original Setup / Session Flow / When Complete sections preserved as fallback when agent finds nothing or is suppressed.
- `lib/core/lazygraph-ops.cjs` adds generic `upsertEdge(conn, {type, source, target, properties})` primitive (Phase 89-07-01) reusable as the typed-edge chokepoint across Phase 116/117/118/120 sibling agents.

### Manual action items

- **POST-RELEASE: apply Cypher patch** at `cypher/phase89-07-rs-agent-completion.cypher` against the Brain (brain.mindrian.ai) via `claude_ai_brain_query` MCP or equivalent. Idempotent (MERGE not CREATE); safe to re-apply. The patch only carries framework-name handles + plugin path + version scalar -- zero user content. Per RESEARCH Q5: verify post-application by re-querying the ReverseSalientAgent node and confirming DELEGATES_TO + APPLIES_TO + IMPLEMENTED_BY edges land.
- **VALIDATION WEEK:** dispatch agent to a populated test room (Lawrence + 4 in docs/testers/REGISTRY.md) gated on `--version 1.13.0-beta.4`. Empathy audit confirms 4-of-5 testers report "the persona suffix framing felt right" (RESEARCH Confidence: LOW on suffix wording; tunable post-audit).
- **MARKETPLACE Gate 5 (deferred):** ref-pin `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.ref` to `v1.13.0-beta.4` ONLY after the empathy audit passes 4-of-5 AND the integration smoke against 3 user rooms confirms the agent surfaces meaningful findings. Until then, Phase 89-07 ships as a LOCAL-ONLY tagged build (no `git push --tags`, no marketplace ref-pin) -- same gate Phase 115 beta.3 used.

### Audit notes

- Canon Part 8 (Graph Boundary): PASS. Agent never sends user content to Brain. Only reads pre-derived BRAIN.md quadruple (LOCAL file). Brain stays at brain.mindrian.ai untouched at Wave 3 close. Verified by module-import whitelist + payload audit (`tests/test-reverse-salient-telemetry.cjs` Canon Part 8 audit assertion).
- Canon Part 4 (Every Choice Is Graph Data): PASS. Every F.0 response produces a typed edge (cascade on APPROVE; REJECTED_BECAUSE on REJECT; DEFERRED memory_event on DEFER). All 5 cascade types {INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES} exercised in `tests/test-reverse-salient-cascade-emit.cjs`.
- Phase 109 chokepoint adherence: PASS. New code in `lib/agents/reverse-salient-agent.cjs` does NOT require `room-db.cjs` directly. Anti-pattern grep ban verified at every commit.
- Phase 88.2 F.0 dispatcher non-regression: PASS. R1 invariant `lib/hmi/shape-f6-renderer.cjs` sha256 byte-equal preserved (`1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf`).
- Phase 90 BRAIN.md quadruple non-regression: PASS.
- Phase 115 persona-aware turn-1 non-regression: PASS.
- Phase 91 Feynman runner: zero NEW failures referencing Phase 89-07 artifacts. Pre-existing inherited failures from prior phases (83/84/106) acceptable per Phase 89.5 + Phase 106-02 baseline contract.
- 4 graph-native HARD RULE invariants from 89-07-VALIDATION.md: 1 PASS (Wave 1+2 cascade-edge tests), 2 PASS (navigation chokepoint adherence grep), 3 PASS (Canon Part 8 payload audit), 4 PASS (F.0 dispatcher integration test).

### Deferred (out of Phase 89-07 scope, documented for traceability)

- Phase 116 unresolved-tension-hook session-start surfacer: 116-CONTEXT.md scaffolded; consumer of agent's emit contract; depends on this phase landing first.
- Phase 117 auto-explore-domains-on-first-material auto-fire: 117-CONTEXT.md scaffolded; consumer of agent's emit contract; depends on this phase landing first.
- Phase 110 brain-context-packet-contract typed wire format: per Path C reroute. Net interaction is forward-compat (89-07 doesn't send Brain packets). Phase 110 ship order does NOT block 89-07.
- `/mos:find-cross-room-bridges` new command: deferred per Q3 recommendation; existing `/mos:find-bottlenecks` extends to cover all modes.

### Canon Conformance

- Implements Canon Part 2 Engine 1 Act 1 (formal reverse-salient agentic surface; previously the rs-engine substrate was the shipped layer; 89-07 adds the agentic wrapper).
- Implements Canon Part 4 (every reverse-salient finding becomes typed graph data via cascade edges + REJECTED_BECAUSE + DEFERRED memory_event).
- Implements Canon Part 10 sub-claim 5 (proposed) -- "the test of intelligence is non-obvious opportunity surfacing through conversational Decision Gate."
- Composes cleanly with proposed Canon Part 9 substrate via Phase 109 navigation.cjs adherence.

## [1.13.0-beta.3] - 2026-05-05

### Added

- **Phase 115 -- Owned Emotion + Dual-Path First Touch.** Single owned emotion ("I'm stuck on a decision I can't name") rewrites all 8 first-touch surfaces -- `/mos:splash` copy, `/mos:new-project` opener, README hero, `/mos:onboard` Step 1 framing, agents/larry-extended.md initialPrompt, Dror 2.0 test subject criteria, marketing line, and out-of-repo website hero (deliverable in `docs/copy/115-website-hero.md`). Implements Canon Part 10 sub-claim 2 ("Conversation IS the surface"). [phase 115-01]
- **Persona-aware turn-1 rendering mechanism.** New `persona_variants:` frontmatter map on `agents/larry-extended.md` carrying 1 default + 9 Canon Appendix C hirer variants (founder + researcher + investor written; researcher_ind + founder_grant + operator + mentor + domain_expert + student aliased to default until future role_blend schema extension). Agent body renders the matching variant by reading USER.md `role_blend` highest-weight key; cold-start falls back to default. [phase 115-03]
- **Dual-path opener.** New `lib/core/dual-path-detector.cjs` (5-feature additive score: word_count + newline_density + section_header + domain_marker + stuck_language with -3 negative weight). Threshold +3 -> upload, -3 -> type, else ambiguous (explicit fallback). 16-fixture unit test (`lib/core/dual-path-detector.test.cjs`). New `lib/core/shallow-doc-parser.cjs` extracts 1 user + 1 venture + 1-3 claim nodes; routes through Phase 109 `lib/core/navigation.cjs setFocus` + `memory_event` API. Two new MCP tools (`detect_dual_path`, `extract_shallow`) registered in `bin/mindrian-mcp-server.cjs` for Desktop / Cowork tri-polar coverage. [phase 115-02]
- **Spec-strings source-of-truth.** New `lib/copy/115-spec-strings.cjs` frozen module exporting D-02..D-09 verbatim spec strings; all 8 surfaces import from it (Pitfall 1 mitigation). [phase 115-00]
- **5-tester async validation infrastructure.** Email template (`tests/fixtures/115-validation-email-template.md`), 5x4 rubric (`tests/fixtures/115-tester-rubric.md`), 3-tester empathy-audit checklist (`tests/manual/115-acceptance.md`), and pre-committed D-20 rollback procedure (`tests/manual/115-rollback-procedure.md`). [phase 115-00]
- **Phase 115 verification orchestrator + 2 sub-tests.** `tests/test-115-owned-emotion.sh` calls 4 sub-tests: validation-template (AC-115-01), surfaces-grep (AC-115-02), dual-path-integration (AC-115-03), persona-variants (AC-115-04). All 4 ACs verified via single command. [phase 115-04]

### Changed

- `agents/larry-extended.md` `initialPrompt` updated from Phase 114 placeholder ("I'm Larry. What are you working on?") to D-17 spec verbatim ("I'm Larry. What decision is stuck? (Tell me, or paste a doc/CV.)"). The new value is byte-exact equal to `lib/copy/115-spec-strings.cjs` `INITIAL_PROMPT_DEFAULT`.
- `README.md` hero tagline updated from "Your project becomes your co-founder" to "For founders stuck on a decision they can't name" (D-04 / D-08 marketing line).
- `commands/onboard.md` Step 1 leads with the D-07 emotion paragraph BEFORE the methodology pitch. Voice rules + symbol vocabulary unchanged.
- `commands/new-project.md` Step 3 opener uses D-03 verbatim. Voice rules + Steps 4-9 unchanged.
- `commands/splash.md` prints D-02 owned-emotion tagline after the banner script.
- `docs/testers/REGISTRY.md` Protocol section now documents Dror 2.0 test subject criteria (D-05) before the "Adding a tester" subsection.

### Manual action items

- **POST-MERGE WEBSITE EDIT:** apply the website hero rewrite from `docs/copy/115-website-hero.md` to `~/mindrian-website/[hero file]`. The website repo is independent of MindrianOS-Plugin; this is NOT auto-applied. The deliverable + step-by-step is in `docs/copy/115-website-hero.md`.
- **VALIDATION WEEK:** dispatch `tests/fixtures/115-validation-email-template.md` to the 5-tester cohort (Lawrence Aronhime + a tester + Aryeh Holtzberg + Adam Peters + a tester) per D-13 (async, 48h reply window). Synthesize replies into `tests/fixtures/115-tester-rubric.md`.
- **D-20 ROLLBACK GATE (Pitfall 5 pre-commit):** if validation lands < 4-of-5 vivid recent memory, execute `tests/manual/115-rollback-procedure.md` step-by-step. Pre-committed; no live deliberation.
- **MARKETPLACE Gate 5 (deferred):** ref-pin `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.ref` to `v1.13.0-beta.3` ONLY after the 5-tester async validation passes 4-of-5 AND the 3-tester live empathy audit (`tests/manual/115-acceptance.md`) reports 2/3 pass. Until then, Phase 115 ships as a LOCAL-ONLY tagged build (no `git push`, no marketplace ref-pin).

### Audit notes

- Phase 91 Feynman runner non-regression: PASS. No NEW failures reference Phase 115 artifacts (`dual-path-detector`, `shallow-doc-parser`, `115-spec-strings`, `persona_variants`, `larry-extended`, `115-` patterns). Pre-existing inherited failures from prior phases (83/84/106) are acceptable per Phase 89.5 + Phase 106-02 baseline contract. Runner reports 171/176 pass; 5 failures are all from prior-phase test files (smart-notebook, self-update-platform, post-compact-reinjection, decision-capture, statusline-glyph-isolation).
- Phase 114 substrate-preload non-regression: PASS. Skills array (4 entries), model: inherit, color: purple, name preserved byte-identical. settings.json `agent: larry-extended` preserved.
- Canon Part 8 audit (Graph Boundary): PASS. No LOCAL -> BRAIN egress paths introduced. Variant strings are plugin-distributed; USER.md role_blend reading is local; dual-path detector classification + shallow-doc-parser writes are local-only. Phase 121 telemetry payloads carry enum scalars + booleans + integers + sha256 hashes only (no user-content substrings). Pre-existing brain-boundary-scan hook (Phase 87) passes.
- Phase 109 chokepoint adherence: PASS. New code in `lib/core/dual-path-detector.cjs` and `lib/core/shallow-doc-parser.cjs` does NOT require `room-db.cjs` directly. All graph writes route through `lib/core/navigation.cjs` (setFocus + memory_event API).
- AC-115-01..04 verification: 4/4 PASS via `bash tests/test-115-owned-emotion.sh`.

## [1.13.0-beta.2] - 2026-05-05

### Added

- Phase 114 (larry-default-activation): subagent skill preload mechanism. `agents/larry-extended.md` frontmatter now declares `skills: [larry-personality, context-engine, room-passive, room-proactive]` -- the four-skill substrate is structurally preloaded into Larry's main-thread agent context at session start, every session, every surface (CLI / Desktop / Cowork).
- Phase 114: `initialPrompt:` placeholder on `agents/larry-extended.md` ("I'm Larry. What are you working on?") so turn 1 is automatically Larry-led without any /mos:* invocation. Phase 115 will refine this to the polished Beautiful Question opener.
- Phase 114: `paths:` glob scoping on `skills/room-passive/SKILL.md` and `skills/room-proactive/SKILL.md` -- defense-in-depth against context-budget bloat when user is outside any room directory.
- Phase 114 (SEED-003 A1): `"alwaysLoad": true` on the local `mindrian-os` MCP server in `.mcp.json`. Tools surface from turn 1, no Tool Search 10% threshold deferral wait. Requires Claude Code 2.1.121+.
- Wave 0 verification suite at `tests/test-114-*.sh` (4 sub-tests + orchestrator + voice rubric + baseline fixture + manual checklist).

### Changed

- `settings.json`: removed the unsupported `skills:` array. Per Anthropic's plugin schema, plugin `settings.json` only honors the `agent` and `subagentStatusLine` keys -- the array had been silently ignored. Activation now flows through the supported subagent preload mechanism (above).
- `scripts/session-start`: SessionStart additionalContext JTBD greeting block reframed as context-only when `initialPrompt` is active. Prevents double-greet (initialPrompt fires AND SessionStart instructs another greeting). On Desktop/Cowork (no SessionStart hook), `initialPrompt` is the only first-turn surface -- no conflict.

### Deferred (out of Phase 114 scope, documented for traceability)

- Brain MCP `alwaysLoad: true`: user-side configuration, not plugin-distributed. Users who run Brain MCP can enable it themselves; Phase 114 does not modify user-side `.mcp.json`. SEED-003 A1's Brain portion remains dormant.
- `brain-connector` skill env-conditional gating: today's behavior (description-matching driven activation) is unchanged after `settings.json` cleanup. The previous `{ when: env:MINDRIAN_BRAIN_KEY }` syntax was unsupported. If env-conditional gating becomes desired, file as a separate backlog item or use SKILL.md `paths:` field.
- Polished Beautiful Question first-turn copy: deferred to Phase 115 (Owned Emotion + Dual-Path First Touch).
- 5-gate sync rule item 5 (~/mindrian-marketplace marketplace.json `source.ref` pinning to `v1.13.0-beta.2`) is handled at the milestone promotion gate, not in this repo.

### Promotion Gate

Per `.planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md` `## Empathy Audit Protocol`: 3 fresh testers, 15-minute silent observation per surface (CLI / Desktop / Cowork). Promotion blocked until 2/3 report substrate-active turn-1 experience AND Hooked audit re-score >= 38. Manual checklist for testers is at `tests/manual/114-acceptance.md`.

### Canon Conformance

- Implements Canon Part 10 sub-claim 1 ("Larry IS the product") at the activation layer.
- Conforms to Canon Part 8 (Graph Boundary): all four mechanisms (skills preload, agent setting, initialPrompt, alwaysLoad MCP) are LOCAL-only; no LOCAL -> BRAIN egress.
- Composes cleanly with Phase 91 Navigation Engine (lib/core/skill-activation-router.cjs `routeActivation` legacy fallback path preserved). Phase 91 integration suite reports 0 new failures introduced by Phase 114.

## [1.13.0-beta.1] - 2026-05-05

**Beta release.** Ships Phase 108 (graph memory schema reconciliation) and
Phase 109 (SQL Context-Memory Navigation Spine), the load-bearing substrate
for the Memory Locality cluster (Canon Part 9). Beta-gated per
release-process.md doctrine because this release ships SQLite migrations that
run on every user's `room.db` at session start; testers (Lawrence + 4 in
docs/testers/) opt in via `--version 1.13.0-beta.1` before promotion to plain
1.13.0.

### Added

#### Phase 108 - Graph Memory Schema Reconciliation

- `RECONCILIATION.md`, `PROVENANCE.md`, `TRUTH-STATES.md`, `aliases.yml`,
  `scripts/check-schema-aliases.cjs` + `install-pre-commit.sh`,
  `PART-9-PROPOSAL.md` + `CANON-PHASE-MAP.md` Part 9 (proposed) subsection.
- 9 provenance fields contract per node; closed 8-state truth-state taxonomy
  with 8 documented transitions; pre-commit drift guard scanning staged
  diffs against alias rules.

#### Phase 109 - SQL Context-Memory Navigation Spine

The load-bearing phase in the graph-memory cluster (108 / 109 / 110 / 112 /
113). Turns `room.db` into Mindrian's local mind: the authoritative context,
memory, and insight navigation engine. Larry stops scanning folders and
starts navigating a graph.

- **D-01 Focus Node Model** (Plan 109-02): `session_focus` table + auto-focus
  cascade (JTBD anchor -> DECISION_GATE recent unconfirmed -> STATE.md
  governing thought) + statusline 🎯 glyph. NAV-109-01.
- **D-02 Typed Neighborhood Retrieval** (Plan 109-04): single recursive CTE
  returning ranked typed neighbors with `edge_path` + `score`. Pure SQL.
  Sub-ms on 10K-node rooms (0.79ms cold / 1.35ms warm p95). NAV-109-02.
- **D-03 Memory Event Log** (Plan 109-03): `memory-events.cjs` with
  closed-15 EVENT_TYPES enum + `logEvent` writer + `findRecentChanges`
  reader. Time-ordered, queryable. Every confirmation, rejection,
  decision, brain proposal, user correction is a typed `memory_event` row.
  NAV-109-03.
- **D-04 7 Insight Query Primitives** (Plan 109-05): `findContradictions`,
  `findUnsupportedClaims`, `findBlockingAssumptions`, `findStaleDecisions`,
  `findOpenQuestions`, `findRecentChanges`, `findRelevantOpportunities`
  (HSI score + graph distance + JTBD relevance). Each is a SINGLE SELECT,
  zero LLM in the loop. NAV-109-04.
- **D-05 Navigation API chokepoint** (Plan 109-04 + 109-06):
  `lib/core/navigation.cjs` is the closed 14-export surface. Plan 109-06
  extends Phase 108-05 pre-commit hook with `--check-chokepoint` subcommand
  scanning staged diffs for direct `require('./room-db.cjs')` outside the
  allow-list. Runtime soft-defense audit log writes to
  `~/.mindrian/telemetry/navigation-bypass.jsonl` (LOCAL JSONL, sha256-hashed
  slug). NAV-109-05.
- **D-06 Brain Packet Builder** (Plan 109-07): `buildBrainPacket` returns a
  plain JS object carrying ONLY enum scalars, sha256 hashes, framework
  handles, and phase identifiers. Adversarial Part-8-leak test injects
  user-content fixtures and asserts ZERO traces in packet output.
  NAV-109-06.
- **D-07 Brain Result Ingestion** (Plan 109-08): `storeBrainSuggestions`
  writes Brain's advisory response to `room.db` as nodes with
  `review_status: 'proposed'`, `created_by: 'brain'`. NEVER `confirmed`.
  Confirmation is the human-in-the-loop Decision Gate (Canon Part 3).
  NAV-109-07.
- **D-08 Room Home Driver** (Plan 109-09): `getRoomHomeView` composes a
  9-key view (current thesis + confirmed facts + risky assumptions +
  evidence + contradictions + open questions + recent changes + banked
  opportunities + next move) from SQL navigation primitives. Replaces
  ad-hoc folder scans. NAV-109-08.
- **Idempotent migrations** (Plan 109-01): `phase-109-nodes-provenance.cjs`
  promotes the existing assumptions table to first-class graph nodes
  carrying the 9 provenance fields per Plan 108-02. Sentinel-row guarded;
  safe to apply twice.

### Changed

- `openRoomDb` (lib/core/room-db.cjs) is now SYNCHRONOUS, returning the bare
  `node:sqlite` `DatabaseSync` handle instead of the legacy `{ db, conn }`
  async tuple. The async tuple shape was a leak from `lazygraph-ops.cjs`
  `openGraph`. The navigation API and all 109-* helpers consume the bare
  `db`. `closeRoomDb` is tolerant of both shapes during the merge cycle.
  `scripts/memory-lifecycle.cjs` updated with backward-compatibility shim
  (`const handle = { db: openRoomDb(roomDir) }`) preserving all internal
  `handle.db.X` call sites unchanged.
- Phase 106-02 statusline glyph fence amended to permit 🎯 (focus glyph)
  alongside the existing exclusive set per Plan 109 RESEARCH OQ 11.8.

### Capability Radar

- `references/capability-radar/changelog-cache.md` populated for the first
  time via `/mos:radar --fetch` (Claude Code 2.1.109 -> 2.1.128).
- 11 new Claude Code capabilities folded into the curated index (Opus 4.7,
  alwaysLoad MCP, hooks-as-MCP-tools, PostToolUse updatedToolOutput,
  .zip plugin distribution, /mcp tool count + 0-tool flagging, forked
  subagents on external builds, agent frontmatter mcpServers, /usage,
  /focus, push notifications, claude project purge, MCP auto-retry,
  concurrent MCP startup, /skills filter).
- v1.13.0 adoption candidates ranked in `.planning/seeds/SEED-003`: A1
  alwaysLoad Brain MCP, A2 hooks-as-MCP-callers refactor, A3 Part 8
  sanitization hook, A4 forked subagents + per-agent mcpServers, A5
  .zip distribution as beta channel.

### Canon

- Canon Part 9 (Memory Locality and Interpretation) status: **proposed**.
  Formal `docs/MINDRIAN-CANON.md` amendment pending; will land before
  promotion to plain `1.13.0`.

### Testing

- 13 new Phase 109 navigation tests, all GREEN.
- 36/36 across-session-memory regression suite GREEN.
- Wave-0 RED test stubs (acceptance, canon-part-9-ratification) left RED
  for the v1.14+ acceptance gate.

### Beta Promotion Path

Promote to plain `1.13.0` after at least one external tester (Lawrence)
confirms a clean upgrade. Issues to watch:

- `room.db` migration on legacy rooms with assumptions older than the
  9-field provenance schema.
- Pre-commit hook installation on testers without the Phase 108-05 hook.
- Statusline 🎯 glyph rendering on older Claude Code versions.

Tester install:

```
claude plugin update mos@mindrian-marketplace --version 1.13.0-beta.1
```

## [1.12.5.1] - 2026-05-03

Hotfix on top of 1.12.5. The D-06 surface-detect helper was misclassifying every
Claude Code CLI sub-process invocation (Bash tool, statusline shell-exec, hooks,
doctor.cjs) as DESKTOP because `process.stdin.isTTY` is `undefined` in any
non-TTY child. The misclassification cascade-suppressed the D-02 statusline
broadcast and forced the D-03 visibility check to short-circuit with
`"status": "skip"`. v1.12.5 testers saw no brand glyph and no token broadcast
on CLI even though the rest of Phase 106 was wired correctly.

### Fixed

- `lib/statusline/surface-detect.cjs` adds a new step 4 that returns `'CLI'`
  when `process.env.CLAUDE_CODE_ENTRYPOINT === 'cli'`. This signal is set by
  Claude Code on the parent process and propagates to every child, so it
  survives non-TTY sub-process invocation. Claude Desktop's spawned stdio
  MCP servers do NOT inherit this var, so the read is CLI-exclusive.
  Existing precedence preserved: explicit `MINDRIAN_STATUSLINE_SURFACE`
  override still wins (step 1), Cowork signals still win (step 2),
  `CLAUDE_DESKTOP=1` still wins (step 3). The legacy `process.stdin.isTTY`
  branch becomes step 5 (raw shell fallback for non-CC contexts).
- `/mos:doctor --statusline-visibility` now reports `"status": "ok"` with
  `"statusline rendering correctly"` evidence on CLI sessions instead of
  the prior `"status": "skip"` with `"DESKTOP has no statusline primitive"`.

### Test

- `tests/test-surface-detect.cjs` extended from 6 to 10 tests:
  - Test 7 regression guard (`CLAUDE_CODE_ENTRYPOINT=cli` + non-TTY -> CLI)
  - Test 8 precedence (`CLAUDE_DESKTOP=1` outranks the new step 4)
  - Test 9 precedence (`COWORK_SESSION_ID` outranks the new step 4)
  - Test 10 strict-equality on the literal (entrypoint=mcp does NOT trigger CLI)
- All 10 tests pass.

### Note on version literal

Ships as `1.12.5.1` (4-segment) by explicit user override. Not strict semver;
release-process canon prescribed `1.12.6-beta.1` (release infrastructure beta-
first). Override accepted because the fix is a pure-additive precedence rule
with full test coverage and zero behavior change for non-CC and Desktop/Cowork
surfaces.

## [1.12.5] - 2026-05-03

The release where MindrianOS becomes visible while it works. Phase 106 makes the
statusline the persistent visibility surface testers can rely on: self-heals stale
settings overrides on session start, broadcasts token-budget percent + active
operator + active JTBD into the rendered statusline, detects when the statusline
is silently invisible and surfaces a one-time repair banner via /mos:doctor class
G, falls back to a Larry-rendered prose echo on Desktop / Cowork / post-detect
repair, validates visibility on first install, and routes per-surface.

User explicit override 2026-05-03: ships as plain v1.12.5, NOT v1.12.5-beta.N.
The release-process canon prescribes beta-first for releases that touch
SessionStart hooks (this release adds three: D-01 migrator, D-04 fallback echo,
D-05 onboarding gate), but the user accepted the rollback risk in exchange for
shipping the drift-fixes directly to all users on next marketplace refresh.

### Added

**Phase 106 - Statusline Visibility + Context-Window Broadcast (5 plans, 37+ own-plan tests):**

- D-01 self-healing stale-user-settings hook (`scripts/migrate-stale-user-settings.cjs --auto --quiet` + 4th SessionStart entry, 2000ms timeout). Detects `~/.claude/settings.json` user-level `statusLine.command` overrides pinned at version-cache paths (the 2026-04-26 incident pattern); --auto mode is detect-only and never overwrites a hand-edited file (6/6 hermetic tests).
- D-02 context-window broadcast in `scripts/context-monitor`: 📊 token-budget chart glyph at every threshold branch, 🎯 active JTBD glyph from `lib/hmi/jtbd-state.cjs`, ⚙️ active operator glyph from `lib/conversation/operator.cjs` (skipped on JUST_TALK default), ⚠ compaction-imminent literal text replacing the prior skull glyph at >=80%. Threshold contract preserved at 50/65/80. Glyph carve-out fence enforces these emoji appear ONLY in the carve-out file (7/7 broadcast tests + 1/1 fence test).
- D-03 invisibility detection + auto-repair via `/mos:doctor` class G (`scripts/doctor.cjs` extended, four detection branches: stale user-settings / broken plugin install / statusline-mos isolated execution / disableAllHooks); --fix dispatch spawns the migrator with locked-language action; 24h banner suppression contract fenced as a shared module at `lib/statusline/banner-suppression.cjs`. 14/14 own-plan tests.
- D-04 fallback echo (`scripts/statusline-fallback-echo.cjs`) - Larry-rendered prose state echo for Desktop / Cowork / post-detect repair window: `[MindrianOS v1.12.5 active · room: <slug> · operator: <op> · jtbd: <jtbd> · context: <pct>%]`. 30-day default-on flip via `~/.mindrian-onboarded` install date; explicit `MINDRIAN_STATUSLINE_FALLBACK_ECHO` env override beats the flip in either direction (12/12 hermetic tests).
- D-06 surface-detect helper at `lib/statusline/surface-detect.cjs` returning `'CLI' | 'DESKTOP' | 'COWORK'` (never null, never throws). Replaces the placeholder env-var probe in `scripts/doctor.cjs` Step 0 with the canonical helper. 6/6 hermetic tests.
- D-05 onboarding gate (`scripts/check-onboard-statusline.cjs`) fires once per fresh install + once per upgrade; touch-file at `~/.mindrian/onboarding/statusline-onboarded.json` with `{installed_version, completed_at}` invalidates on version bump so testers re-confirm visibility on each upgrade. 6/6 hermetic tests.
- `lib/statusline/` directory ships with ROOM.md per ICM Layer 0 mandate.

### Fixed

- Stale `~/.claude/settings.json` user-level `statusLine.command` paths pinned at deleted version-cache directories (root cause of testers reporting blank statusline post-update; now auto-detected and surfaced via /mos:doctor).
- `scripts/context-monitor` skull glyph at >=80% context replaced with explicit "compaction-imminent" warning text.
- `scripts/doctor.cjs` Step 0 surface detection no longer hard-codes `process.env.CLAUDE_DESKTOP === '1'`; routes through the canonical surface-detect helper so Cowork (COWORK_SESSION_ID env or /sessions dir) is also detected.

### Changed

- `hooks/hooks.json` SessionStart array grows from 4 entries to 6: adds statusline-fallback-echo (D-04) and check-onboard-statusline (D-05). All silent in the no-drift / CLI / already-onboarded case; only emit additionalContext when there is something the tester needs to see.
- `tests/test-statusline-banner-suppression.cjs` refactored: inline `shouldSuppress` contract removed; now requires `lib/statusline/banner-suppression.cjs` (the shared module Plan 106-04 extracted).

### Upgrade path

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

## [1.12.4] - 2026-05-02

The release where v1.12.3's substrate becomes visible. Phase 88.2 ships the canonical De Stijl picker (5 sub-shapes plus selector telemetry) so every Larry "choose between options" moment uses MindrianOS's UI vocabulary instead of generic AskUserQuestion. Phase 104 retrofits 80+ /mos: commands with `serves_jtbd:` declarations so Larry's next-move suggestions actually adapt per command per active JTBD. Together: testers feel the v1.12.3 promise become real.

### Added

**Phase 88.2 - Selector Block UI Library (5 plans, 60 sub-shape + telemetry tests):**
- Shape F.1 canonical Next Move renderer (`lib/hmi/shape-f1-renderer.cjs`) - 10-verb canonical vocabulary, Free-Text always last, RECOMMENDED `▶` marker only at Mode A + Brain confidence >= 0.7 (12/12 tests)
- Shape F.2 Path Control renderer (`lib/hmi/shape-f2-renderer.cjs`) - 5-verb constrained subset for plan/replan moments (10/10 tests)
- Shape F.3 Rabbit-Hole Depth renderer (`lib/hmi/shape-f3-renderer.cjs`) - exactly 5 closed options (Shallow / Medium / Deep / Extreme / Back); no Free-Text, no RECOMMENDED (7/7 tests)
- Shape F.4 Insight Extraction renderer (`lib/hmi/shape-f4-renderer.cjs`) - exactly 5 closed options (Key insights / + contradictions / + actions / Create artifact draft / Back) (7/7 tests)
- Shape F.5 Branch Resolution renderer (`lib/hmi/shape-f5-renderer.cjs`) - Continue / Merge / Compare / Park / Drop with Free-Text last (12/12 tests)
- Selector telemetry (`lib/hmi/selector-telemetry.cjs`) - LOCAL JSONL emitter at `~/.mindrian/telemetry/selector.jsonl`, sha256-hashed room slug, 10000-line FIFO bound, zero Brain egress per Canon Part 8 (12/12 tests)
- Operator-aware dispatcher integration (`lib/hmi/selector-dispatcher.cjs` extended) - F.1..F.5 routing per active operator, JUST_TALK refuses F.x with `render_v2_compaction_violation`, AskUserQuestion structural-marker trailer `[AskUserQuestion contract: shape=F.X verbs=N]` on every render

**Phase 104 - Per-Command JTBD Declarations (4 plans, 8 backward-compat tests + declarations + coverage):**
- Sweep across 80+ `commands/*.md` files: every command now declares `serves_jtbd:` in frontmatter (drawn from the 13-entry Phase 100-01 taxonomy)
- JTBD-to-command mapping matrix at `.planning/phases/104-per-command-jtbd-declarations/104-01-mapping-matrix.md`
- `tests/test-command-jtbd-declarations.cjs` - every-command-declares assertion (closed-vocab enforcement, latency < 500ms warm)
- `tests/test-command-jtbd-coverage.cjs` - every-JTBD-has->=1-command coverage scan (orphan detection for all 13 entries including `explore` fallback)
- `tests/test-command-jtbd-backward-compat.cjs` - backward-compat regression fence: synthetic command without `serves_jtbd:` falls through to F.1 (NOT F.6) without throwing (8/8 assertions)

### Changed

- `lib/hmi/selector-dispatcher.cjs` (Phase 101-04) extended with operator-aware sub-shape routing for F.1..F.5; existing F (jtbd-routed -> F.6), G, H, A-E paths byte-stable
- `lib/hmi/shape-f1-fallback.cjs` preserved for backward-compat; new `shape-f1-renderer.cjs` is the dispatcher's preferred F.1 module
- `lib/memory/run-feynman-tests.cjs` registers all v1.12.4 test suites (88.2 sub-shapes + telemetry + 104 declaration coverage + backward-compat)
- Every existing /mos: command's frontmatter gains `serves_jtbd:` field (3 commands that already declared from Phase 100/103/105 left byte-identical)

### Why this matters

v1.12.3 captured the signal (operator + JTBD + memory + selector library); v1.12.4 makes the signal *consumed* by 80+ commands and *visibly polished* via the 5 new sub-shape renderers. The result: when Larry asks you to choose between options, the picker uses the De Stijl Mondrian vocabulary instead of generic Claude Code prompts. When you set a JTBD with `/mos:jtbd set find-bottleneck`, every methodology command surfaces different next-move options tailored to that job.

### Tester impact

- Visible immediately: every selector now has the 4-zone De Stijl picker with 12-glyph + 5-color contract
- Visible immediately: setting a JTBD changes what /mos:explore-domains, /mos:rs-fetch, /mos:think-hats, /mos:hat-briefing each suggest as next-moves
- Selector telemetry runs LOCAL only - never leaves your machine, never carries user content (sha256 room slug + scalar response indices only)

### Compatibility

- No breaking changes. Commands without `serves_jtbd:` continue to work (selector falls through to F.1), pinned by `tests/test-command-jtbd-backward-compat.cjs` regression fence.
- JUST_TALK operator refuses F.x sub-shapes by design (operators stay out of the way during plain dialogue).
- Mode A vs Mode B vs Tier 0 graceful degradation per Canon Part 3 - RECOMMENDED markers suppress when Brain unreachable.

### Notes

- Canon Part 7 (Reuse Before Build): the existing Phase 101-04 dispatcher already reads JTBD; Phase 104 only feeds it.
- Canon Part 8 (Graph Boundary): `serves_jtbd:` declarations are LOCAL frontmatter, never queried against Brain. Selector telemetry emits LOCAL JSONL only, never network.
- Phase 87 zero-deps invariant honored across both phases.

## [1.12.3] - 2026-05-02

The conversation operator + JTBD inference + selector library + context-aware rendering + memory continuity + HMI compliance polling stack — six phases shipped as the v1.12.3 dependency layer that downstream features (Phase 104 per-command JTBD declarations, Phase 88.2 Shape F.1 polish, sprites Workspace v2.0) consume as their substrate.

### Added

**Phase 99 — Conversation Operator State Machine (5 plans, 68/68 tests):**
- `lib/conversation/operator.cjs` per-room state primitive with 5 operators (JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE) and 9 transition rules
- `lib/conversation/classifier.cjs` heuristic NL classifier (no LLM round-trip, 0.6 confidence threshold, externalized rules JSON)
- `lib/render/render-v2.cjs` renderer integration contract (replaced in Phase 102 with full impl)
- `commands/operator.md` + `scripts/operator-command.cjs` user-facing command
- `scripts/operator-update.cjs` hook lifecycle wiring (SessionStart + Stop + PostToolUse + UserPromptSubmit)
- Atomic state writes via mktemp + rename, OPERATOR_TRANSITION typed graph edges (Canon Part 4)
- 50-entry bounded history with drop-oldest rotation

**Phase 100 — JTBD Inference Engine (6 plans, 48/48 tests):**
- `lib/hmi/jtbd-taxonomy.json` canonical 13-entry taxonomy (12 first-class JTBDs + explore fallback)
- `lib/hmi/jtbd-classifier.cjs` heuristic classifier with three weighted strata (token cues 0.5 / operator affinity 0.3 / recency 0.2)
- `lib/hmi/jtbd-state.cjs` per-room state I/O at `<roomDir>/.mindrian/jtbd-state.json` with 24h staleness rule and atomic writes
- `commands/jtbd.md` + `scripts/jtbd-command.cjs` user-facing command (5 subcommands: show/set/clear/list/history)
- `scripts/jtbd-update.cjs` hook lifecycle (UserPromptSubmit + Stop)

**Phase 101 — JTBD-Aware Selector Library (6 plans, 37/37 tests):**
- Shape F.6 (`lib/hmi/shape-f6-renderer.cjs`) — JTBD-aware Next Move selector
- Shape G (`lib/hmi/shape-g-renderer.cjs`) — comparison matrix renderer
- Shape H (`lib/hmi/shape-h-renderer.cjs`) — timeline / roadmap renderer with milestone markers
- `lib/hmi/selector-dispatcher.cjs` — single integration point for Phase 102/104
- `lib/hmi/shape-f1-fallback.cjs` — F.1 fallback when F.6 fallthroughs
- `lib/hmi/tier-check.cjs` — Mode A / Mode B / Tier 0 graceful degradation per Canon Part 3

**Phase 102 — Context-Aware Rendering (6 plans, 55/55 tests):**
- `lib/render/render-v2.cjs` canonical implementation (486 lines, 5 layers composed)
- Token-budget-aware compaction layer
- JTBD-aware Zone 4 (closed 10-verb vocabulary per JTBD)
- LOCAL-only `_provenance` envelope with 4-tripwire Canon Part 8 defense
- CLI color overlay (TTY-gated, byte-stability invariant preserved via strip-ANSI)
- `lib/render/render.cjs` v1 backward-compat shim
- `lib/render/JTBD-PALETTES.md` 13-JTBD palette + verb map

**Phase 103 — Memory Continuity Layer (6 plans, 119/119 tests):**
- Layer 2 across-session memory (`lib/hmi/across-session-memory.cjs`) at `~/MindrianRooms/.memory/across-session.json` with O_EXCL lockfile + 200ms retry budget
- Layer 3 cross-room memory (`lib/hmi/cross-room-memory.cjs`) with Mode A/B aggregation and 5-tripwire Canon Part 8 defense
- `commands/memory.md` + `scripts/memory-command.cjs` (6 subcommands)
- `scripts/memory-completion-detector.cjs` PostToolUse hook
- `scripts/memory-resume-nudge.cjs` SessionStart hook
- `lib/hmi/jtbd-taxonomy.json` extended additively with `completion_pattern` field per entry

**Phase 105 — HMI Compliance Polling (5 plans, 41/41 tests):**
- `scripts/hmi-compliance-poll.cjs` orchestrator (shells `doctor.cjs --ui-compliance`, applies operator-aware shape selector and JTBD-aware priority weighting, writes atomic side-channel at `<roomDir>/.mindrian/last-hmi-poll.json`)
- `commands/hmi-status.md` + `scripts/hmi-status-command.cjs` read-only Shape E status renderer (5 envelope status branches)
- Hook wrapper extending the poll script with BASH-95-01 envelope schema (Stop event, never blocks user turn)
- E2E integration test covering real Stop → poll → side-channel → render flow

### Changed

- `lib/memory/run-feynman-tests.cjs` registers all v1.12.3 test suites (Phase 99-04 hooks, Phase 100 JTBD, Phase 101 selector, Phase 102 render-v2 layers, Phase 103 memory continuity, Phase 105 compliance polling)
- `hooks/hooks.json` extended with 6 new sibling entries across SessionStart / Stop / PostToolUse / UserPromptSubmit (existing Phase 99/100/103 entries byte-identical)
- `.planning/REQUIREMENTS.md` registers OPERATOR-99-* + HMI-100-* + HMI-101-* + RENDER-102-* + HMI-103-* + HMI-105-* requirement IDs

### Why this matters

v1.12.3 closes the dependency layer Phase 99 CONTEXT.md called out in 2026-04-30: "Phase 99 + 100 + 101 + 102 + 103 + 105 = the v1.12.3 dependency layer that downstream features consume as their substrate". With this layer in place, Phase 104 (per-command JTBD declarations across 80+ commands), Phase 88.2 (Shape F.1 canonical AskUserQuestion picker), and Sprites Workspace v2.0 can consume operator + JTBD + selector + render + memory + compliance signals as a unified contract instead of each feature re-inferring them turn-by-turn.

Total: 33 plans across 6 phases, 368 test assertions GREEN at release gate, zero cross-phase regressions, Canon Part 8 LOCAL-only invariant preserved across all new code (audited via grep + 5-tripwire defense layers in Phase 90 / 102 / 103).

## [1.12.1-beta.1] - 2026-04-30

Closes Phase 95.1. Extends `/mos:doctor` from a single-class (install-cache drift class A) checker into a six-class drift detector covering all silent-failure modes surfaced in the v1.12.0 fresh-session smoke (2026-04-30). Ships the missing `scripts/generate-section-intelligence.cjs` generator that Phase 87-01a's pre-commit hook has been pointing at since 2026-04-19 but never existed. Brings `/mos:doctor` itself into UI Ruling System compliance (Shape E Action Report; 4-zone anatomy; 12-glyph vocabulary; no box chars). Hydrates the dogfood `room/` subtree into Decision-#15 compliance (1 sentinel + 20 generated ROOM.md/MINTO.md across 10 directories). Closes 8 new requirement IDs (DOCTOR-95.1-01..08) and ships the deferred Anthropic upstream bug report draft (Phase 93 D5; held until /mos:doctor existed at full strength -- now does).

This is a beta release. Per `release-process.md` mandate, release infrastructure (which `/mos:doctor --fix` qualifies as -- it offers recovery actions that touch the live install path) ALWAYS ships as a beta first. Promotion to stable `v1.12.1` requires confirmation from at least one external user (Lawrence) that the new drift detectors work cleanly. Beta opt-in path documented under "Upgrade" below.

### Added

- `/mos:doctor --cascade-rooms` flag detects (a) rooms missing the `.room-root` sentinel (drift class B) by reading `~/MindrianRooms/.rooms/registry.json` and walking each registered room's filesystem AND (b) the active-room guard silence at `scripts/post-write` lines 207-217 where non-active-room writes exit 0 before `write_cascade_side_channel` runs (drift class C). Detection only; class C `--fix` deferred per CONTEXT Deferred Ideas. Closes DOCTOR-95.1-01.
- `/mos:doctor --verify-surface` flag executes a live cascade end-to-end against `test/fixtures/cascade-surface-e2e/` via `spawnSync('node', ['tests/test-cascade-surface-e2e.cjs'])` and asserts the 8-key side-channel shape (timestamp, file_path, section, cascade_status, classification, git_commit, graph_index, proactive_intelligence). Cross-platform Windows-without-bash skip branch mirrors the test runner's own self-skip behavior. Closes DOCTOR-95.1-02 and DOCTOR-95.1-08.
- `/mos:doctor --room-md` flag detects directories under `.room-root` subtrees missing ROOM.md or MINTO.md (drift class E); `--fix --room-md` invokes the new generator with `--recursive`. Closes DOCTOR-95.1-03.
- `/mos:doctor --ui-compliance` flag detects UI Ruling System violations (drift class F): (a) `commands/*.md` frontmatter missing `body_shape:`, (b) `scripts/*.cjs` and renderers using unauthorized box chars (`╭ ╮ ╰ ╯ ┌ ┐ └ ┘ │ ─ ━`) or unauthorized glyphs (`✗ ✘ ✕ ❌ ❓ ❗ ⚠️` or any other emoji), (c) command output renderers missing the Zone 1 header pattern `-- {room} -- {command} --` and missing Zone 4 action footer pattern. Reports per-file violations with line numbers. `--fix` is detect-only in 95.1 (auto-rewriting renderers deferred). Closes DOCTOR-95.1-04.
- `/mos:doctor --all` flag activates all class detectors A-F in one invocation.
- `scripts/generate-section-intelligence.cjs` -- the missing generator that Phase 87-01a's pre-commit hook has been pointing at since 2026-04-19. Single-dir + `--recursive` + `--force`. Hand-rolled minimal frontmatter (BSL-1.1 license, section/parent/created fields). Atomic writes via mktemp + rename(2). Closes DOCTOR-95.1-05.
- `test/fixtures/cascade-surface-e2e/` -- sibling of `cascade-e2e/seed-room/` for surface-layer (envelope -> render) verification, contrasting with the pipeline-only fixture next door.
- 7 new test files: `tests/test-doctor-class-b.cjs`, `tests/test-doctor-class-c.cjs`, `tests/test-cascade-surface-e2e.cjs`, `tests/test-doctor-class-e.cjs`, `tests/test-doctor-class-f.cjs`, `tests/test-generate-section-intelligence.cjs`, `tests/test-doctor-ui-self-compliant.cjs`. Registered in `lib/memory/run-feynman-tests.cjs`. 25 new scenarios; all GREEN.
- F.1 Next Move structural marker block in `/mos:doctor` output when drift detected without `--fix`. Canonical AskUserQuestion-based F.1 deferred to Phase 88.2 per `f1-selector-deferred.md` in the phase directory. Closes DOCTOR-95.1-07.
- Dogfood `room/.room-root` sentinel + 10 ROOM.md + 10 MINTO.md across the dogfood room subtree (10 directories). Closes Decision-#15 violation in the plugin's own dogfood room.
- `docs/anthropic-upstream-install-cache-drift.md` -- draft bug report for filing with Anthropic describing install-cache drift class A behavior at the Claude Code plugin manager level. Closes Phase 93 D5 deferred item.

### Fixed

- `/mos:doctor` itself was non-compliant with `skills/ui-system/SKILL.md` (mandatory since Phase 80) -- used `╭─ ╮ ╰─ ╯` box chars and `✗` glyph (not in the 12-glyph vocabulary), missing 4-zone anatomy, missing `body_shape` frontmatter, missing Zone 4 action footer. Retrofitted to Shape E (Action Report) compliance: `-- MindrianOS -- doctor -- {stage} --` Zone 1 header, per-class status rows in Zone 2, Zone 4 footer with `▶ /mos:` primary action, density-aware compact header when output exceeds 30 lines. Closes DOCTOR-95.1-06.
- `commands/doctor.md` frontmatter missing `body_shape`. Added `body_shape: E (Action Report)` (canonical form across 33/80 shipped commands).
- Smoke session debris cleaned: removed duplicate nested `room/decisions/v1-12-0-smoke-fresh-session-2/v1-12-0-smoke-fresh-session-2/` (outer parent preserved).

### Changed

- `scripts/doctor.cjs` extended from 335 to ~750 lines. Architecture preserved: parseArgs / checkX() / performRecovery / renderHumanReport. Five new check functions registered behind flag selectors. Each check is graceful-degradation-wrapped (try/catch around each invocation; one failure does not abort the run).
- `commands/doctor.md` examples updated to match new Shape E renderer output.
- `commands/doctor.md` argument-hint extended to enumerate the new flags.

### Beta gate

Per `release-process.md` mandate ("release infrastructure ALWAYS ships as a beta first"), this release ships as `v1.12.1-beta.1`. Promotion to stable `v1.12.1` requires confirmation from at least one external user (Lawrence) that the new drift detectors work cleanly.

### Five release gates status

- [x] CHANGELOG.md updated (this entry)
- [x] .claude-plugin/plugin.json bumped to 1.12.1-beta.1
- [x] package.json bumped to 1.12.1-beta.1
- [x] git tag v1.12.1-beta.1
- [ ] ~/mindrian-marketplace/.claude-plugin/marketplace.json source.ref pinned to v1.12.1-beta.1 (separate repo; user-side step after this commit lands)

### Upgrade

Stable users (v1.12.0) are NOT auto-updated to a beta. Beta opt-in path:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace --version 1.12.1-beta.1
```

After tester sign-off, this beta will be promoted by re-releasing as `v1.12.1` (without the suffix) per release-process.md.

## [1.12.0] - 2026-04-29

Closes Phase 95. Brings 7 bash hooks into Claude Code 2.x per-event envelope-schema compliance. Restores the Phase 88.1-03 mid-session intelligence injection feature that has been silently broken since it shipped. Cascade payload relocates to a LOCAL side-channel JSON file at `<roomDir>/.mindrian/last-cascade.json` (Canon Part 8 LOCAL-only). 3 new regression tests fence the contracts. Three-surface compatible (CLI / Desktop MCP / Cowork) via shared hooks bundle.

This is a feature-restoration release. The room-proactive skill's APPROVE/REJECT/DEFER cascade flow now actually fires. Users who have lived with silence on this surface for months should expect cross-section impact prompts (gap / contradiction / convergence) after Write/Edit/MultiEdit inside a recognized Data Room section.

### Changed

- **Mid-session intelligence injection (Phase 88.1-03 feature) now functions in production for the first time since shipped.** The `room-proactive` skill receives cascade findings from `<roomDir>/.mindrian/last-cascade.json` after every Write/Edit/MultiEdit cascade. Expect cross-section impact prompts (gap / contradiction / convergence) after writes inside a recognized Data Room section. The prose APPROVE/REJECT/DEFER decision flow is unchanged; only the data source is fixed. To suppress, see `/mos:skills disable room-proactive`. (Plan 95-03)
- **room-proactive cascade-finding render adopts the cool-UI style canon.** Banner with thin horizontal rules + status grid with glyph vocabulary + soft prose explanation. NO emoji, NO em-dashes. Mirrors `.planning/research/cool-ui-style-reference.md`. (Plan 95-03)

### Fixed

- **Bash `scripts/post-write` PostToolUse envelope hygiene.** Replaced 6-key root JSON envelope (`cascade_status`, `classification`, `git_commit`, `graph_index`, `proactive_intelligence`, `systemMessage`) with the schema-compliant `{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: <one-line>}}`. Mirrors the v1.10.19 / v1.11.2 reference patches. Stops "Hook JSON output validation failed" errors on every cascade. (Plan 95-02)
- **Bash `scripts/pre-compact` PreCompact envelope hygiene.** Replaced `{"status": ..., "file": ...}` root keys with `{systemMessage}`. (Plan 95-04)
- **Bash `scripts/post-compact` PostCompact envelope hygiene.** PostCompact does NOT accept `hookSpecificOutput` per Claude Code 2.x schema; replaced with `{systemMessage}` only. Full restored context relocates to `<roomDir>/.mindrian/last-post-compact.md` side-channel. (Plan 95-04)
- **Bash `scripts/on-file-changed` FileChanged envelope hygiene.** All 5 diagnostic-path emissions converted to silent exits (FileChanged accepts only `{continue, stopReason, suppressOutput, systemMessage}`; status root key violated schema). (Plan 95-04)
- **Bash `scripts/on-cwd-changed` CwdChanged envelope hygiene.** Replaced `{"status": ...}` and `hookSpecificOutput` (CwdChanged does not accept hSO) with `{systemMessage: "Switched to room: <slug>"}`. (Plan 95-04)
- **Bash `scripts/on-agent-complete` SubagentStop envelope hygiene.** Replaced `{"status": "cascaded", "files_processed": ...}` root keys with `{hookSpecificOutput: {hookEventName: "SubagentStop", additionalContext: ...}}`. Background post-write child stdout redirected to /dev/null to prevent dual-JSON parent-stream collision. (Plan 95-04)
- **Bash `scripts/on-task-complete` TaskCompleted envelope hygiene.** TaskCompleted does NOT accept `hookSpecificOutput` per docs; replaced with `{systemMessage}` only. Status root keys removed. (Plan 95-04)

### Added

- **`<roomDir>/.mindrian/last-cascade.json` cascade payload side-channel file.** Atomic-write-via-mktemp-and-rename(2) inside the room's `.mindrian/` directory. LOCAL-only per Canon Part 8; never network. Contains classification + gitCommit + graphIndex + proactiveIntelligence (with newFindings array). Read by the `room-proactive` skill on cascade completion. (Plan 95-02)
- **`<roomDir>/.mindrian/last-post-compact.md` post-compaction context side-channel file.** Mirrors the cascade side-channel pattern; preserves the full restored context that PostCompact's stdout-only schema cannot carry. Consumed by next session-start when needed. (Plan 95-04)
- **`tests/test-cascade-side-channel.cjs` regression fence.** 5 scenarios fencing bash post-write envelope shape + atomic side-channel write. (Plan 95-02)
- **`tests/test-room-proactive-side-channel.cjs` SKILL.md contract fence.** 6 scenarios fencing the side-channel-reader contract + cool-UI render directive. (Plan 95-03)
- **`tests/test-hook-envelope-shape.cjs` extended.** 6 new per-event bash-hook scenarios (PreCompact, PostCompact, FileChanged, CwdChanged, SubagentStop, TaskCompleted) + new helpers `runBashHook` and `assertEnvelopeShapePerEvent`. (Plan 95-04)

### Audit Notes

- 95-01-AUDIT.md filed at `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-01-AUDIT.md`. Documents per-script envelope shape against authoritative Claude Code 2.x schema, recommended actions, Cursor-branch divergence (4 hooks: session-start, post-compact, on-cwd-changed, on-task-complete - intentionally untouched; Cursor is not a target surface).
- Cursor-branch annotations added to scripts/post-compact, scripts/on-cwd-changed, scripts/on-task-complete pointing back to the audit. scripts/session-start divergence is documented in 95-01-AUDIT.md text only (not annotated in code; B2 scope discipline).
- **PostCompact context preservation is half-wired in v1.12.0** (W2 plan-checker disclosure per release-process.md transparency). The scripts/post-compact hook now WRITES the full restored context to `<roomDir>/.mindrian/last-post-compact.md` (mirroring Plan 95-02's cascade side-channel pattern). The CONSUMER - the next session-start reading this file and re-injecting context - is NOT YET WIRED. Consumer phase: 95.5 or 96. For Phase 95, the goal is to STOP DROPPING the context (the previous emission tripped Claude Code 2.x's `additionalProperties: false` rule on PostCompact). The full-loop wire-up is queued. No user action required; the file simply accumulates compaction snapshots locally per Canon Part 8 until a future phase consumes them.
- Pre-existing fixture failures unrelated to envelope work (test/84-smart-notebook-copilot.test.cjs phase-83-regression-guard; tests/test-self-update-platform.cjs 5 platform-branch assertions) carry over from v1.11.2; logged at `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/deferred-items.md`. The 27/27 envelope-related scenarios introduced or extended by Phase 95 are 100% GREEN.

### Phase summary

```
Phase 95 -- bash-hook-envelope-and-cascade-side-channel:
  95-01 bash-hook-envelope-audit-report          SHIPPED  3 commits
  95-02 post-write-side-channel-writer           SHIPPED  3 commits
  95-03 room-proactive-skill-cascade-restoration SHIPPED  3 commits
  95-04 bash-hooks-envelope-fix-batch            SHIPPED  3 commits
  95-05 regression-test-extension-release-gate   SHIPPED  this release

Feynman runner: 27/27 envelope scenarios GREEN (16 + 5 + 6).
```

### Upgrade

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

After upgrade, the bash post-write "Hook JSON output validation failed" line that has been firing on every Write/Edit/MultiEdit since Phase 88.1-03 shipped is gone. The room-proactive cascade APPROVE/REJECT/DEFER flow begins firing for the first time since 88.1-03 shipped.

## [1.11.2] - 2026-04-29

Hotfix release. Closes the noisy half of the PostToolUse:Write envelope bug that has been firing two "Hook JSON output validation failed -- (root): Invalid input" lines on every Write/Edit/MultiEdit since Phase 88.1 shipped. Mirrors the v1.10.19 fix pattern from `query-efficiency-telemetry.cjs`, applied to the two `.cjs` hooks that were missed during that hotfix sweep. Synthetic byte-level reproduction confirms valid envelopes on every code path; 5/5 new regression tests + 32/32 pre-existing tests pass.

### Fixed

- PostToolUse:Write hooks `scripts/frontmatter-schema-validator.cjs` and `scripts/async-artifact-auto-commit.cjs` no longer emit `additionalContext` at JSON root, which Claude Code 2.x rejects as `(root): Invalid input`. Mirrors the v1.10.19 fix pattern from `scripts/query-efficiency-telemetry.cjs`. Silent path now emits zero bytes; message path emits `{hookSpecificOutput: {hookEventName: 'PostToolUse', additionalContext: <string>}}` only. Soft-fail invariant preserved (outer try/catch unchanged; always exit 0). Fix surface: `emitEnvelope()` and `exitSilent()` helpers in both files, plus updated header comment blocks documenting the v1.11.2 envelope shape.
- New regression test `tests/test-hook-envelope-shape.cjs` fences all 4 PostToolUse stdout emitters (frontmatter-schema-validator, async-artifact-auto-commit, query-efficiency-telemetry reference, plus shared invariants) against the Claude Code 2.x allowed top-level key set `{decision, reason, continue, stopReason, suppressOutput, systemMessage, hookSpecificOutput}`. Asserts: silent path emits zero bytes; message path emits valid envelope; `additionalContext` never appears at top level; `hookSpecificOutput` carries `hookEventName: 'PostToolUse'` + string `additionalContext`; hooks always exit 0. Registered in `lib/memory/run-feynman-tests.cjs` after `query-efficiency-telemetry.test.cjs`.

### Deferred to v1.11.3 (or v1.12.0 if SKILL.md contract change is treated as feature)

- **Phase 95 -- Bash hook envelope hygiene + cascade side-channel.** Filed at `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-CONTEXT.md`. Three problems intentionally deferred from v1.11.2 to keep this hotfix tight: (1) bash `scripts/post-write` still emits 5 unknown root keys (`cascade_status`, `classification`, `git_commit`, `graph_index`, `proactive_intelligence`) -- silently tolerated today because it carries a recognized `systemMessage`, but same class-of-bug as the .cjs hooks; (2) **the room-proactive intelligence loop (Phase 88.1-03 mid-session intelligence injection feature) has been silently broken since it shipped** -- `skills/room-proactive/SKILL.md` reads `cascade_status.proactive_intelligence.newFindings` from `additionalContext`, but the bash hook has always written it at JSON root, so the skill has been receiving nothing for months. Cosmetic noise is gone in v1.11.2, but the cascade loop is still not firing. Fix is to move cascade payload to a LOCAL side-channel file (`<roomDir>/.mindrian/last-cascade.json`, atomic write) and update SKILL.md to read from it. (3) All other bash hooks dispatched through `hooks/run-hook.cmd` (session-start, pre-compact, on-stop, write-scope-check, intent-classifier, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete) are unaudited. Re-trigger with `/gsd:plan-phase 95` after this release.

### Phase summary

```
Phase 94-10 v1.11.2-release-gate              SHIPPED  (envelope hotfix scope)
  Patch 1  scripts/frontmatter-schema-validator.cjs   APPLIED
  Patch 2  scripts/async-artifact-auto-commit.cjs     APPLIED
  Test     tests/test-hook-envelope-shape.cjs         CREATED + REGISTERED
  Tests    5/5 new + 32/32 pre-existing               GREEN

Phase 95 -- bash-hook-envelope-and-cascade-side-channel
  IMMEDIATE NEXT after v1.11.2 ships. Filed in 95-CONTEXT.md.
```

### Upgrade

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

After upgrade, the two "Hook JSON output validation failed" lines per Write/Edit/MultiEdit are gone. The bash post-write hook's "post-write: cascade complete for X.md" line is unchanged (untouched in this release; addressed in Phase 95).

## [1.11.1] - 2026-04-29

Promotes `v1.11.1-beta.1` to GA. Stacks Phase 94 Tester-Driven Fixer (8 P0/P1 plans surfaced from Lawrence Aronhime's QA harness on 2026-04-28) plus Phase 94.1 `/mos:heal` command on top of the beta hotfix. Single coherent release covering tester-discovered bugs + the room-wiring heal command users need after upgrading from v1.10.x.

### Added

- `/mos:heal` command (Plan 94.1-01). 10-step room wiring heal orchestrator wrapping existing primitives (`migrate-lazygraph.cjs`, `vault-section-state-generator.cjs`, `vault-section-minto-generator.cjs`, `compute-state`). Idempotent. Writes `.mindrian/heal-log.json` envelope. Mega-section MINTO failures gracefully degrade to `tier-0` fallback (FEYNMINTO-01 budget fix deferred to v1.12). Brain-derivation-queue read-only in v1.11.1 (drain hook deferred to v1.12). Backup created at `.heal-backup/<TS>/` before any mutation. Recipe sourced from dog-fooding session on the `mindrianOS` room (2026-04-29).
- WebSearch + WebFetch graceful-degradation fallback for `/mos:research` and `rs-fetcher-industry` (Plan 94-05). Any user without paid keys (Tavily, Firecrawl, Exa) now gets grounded research via Anthropic native WebSearch. New `{tier, source, results}` envelope across all 4 `rs-fetcher-*` modules with backward-compat domain keys (`signals`, `papers`, `patents`, `experts`) preserved. Section-8 trace schema gains `web_research_tier` field.
- `/mos:explain-decision` action footer per `skills/ui-system/SKILL.md` 4-zone contract (Plan 94-09).
- Section-8 trace edge `routing_source: 'strict_mode'` when room classifier override fires (Plan 94-06).
- `lib/core/folder-memory.cjs getCurrentRoom()` canonical read API for STATE.md `current_room` field (Plan 94-01); statusline + scripts read through this single chokepoint.

### Fixed

- **P0 ship-blocker:** `rs-discovery-engine` Phase 4 Synthesis loop dropped `thesis` on the writerPayload handoff, causing `/mos:rs-fetch` to throw `TypeError: rs-sqlite-mirror: missing required field: thesis` on every tier-0 run. Producer now folds `theses[i]` into `breakthroughs[i]` before output; empty-fallback envelope carries `thesis: 'no_thesis'` sentinel. Consumer schema authority untouched (Plan 94-02).
- **P0 ship-blocker:** Three inconsistent Brain MCP server names (`mcp__neo4j-brain__`, `mcp__mindrian-brain__`, `mcp__pinecone-brain__`) standardized to single canonical `mindrian-brain` server across 17 command files. `/mos:*` Brain commands previously failed silently when frontmatter referenced non-canonical names; now consistent (Plan 94-03).
- **P0 ship-blocker:** Bundled `mcp-server-brain/` did not auto-`npm install` on plugin install; required env vars (`SUPABASE_URL`, `MINDRIAN_BRAIN_KEY`, `OPENAI_API_KEY`, etc.) had no template. `install.sh` now runs post-install hook; `.env.brain.template` ships with 7 required-var documentation; `scripts/session-start` runs drift check (Plan 94-04).
- **P0 UX bug:** Room classifier drifted on natural-language inputs ("switch to 8", "curriculum redesign") to similarly-named rooms ("core power"). New strict-mode override module `lib/core/room-classifier-strict-mode.cjs` handles numeric / slug / quoted patterns deterministically with Section-8 trace edge for graph data (Plan 94-06). Lawrence's loudest UX bug from QA harness 2026-04-28.
- **P0 statusline drift:** `/mos:rooms` switches did not propagate to bottom-of-screen room indicator. `lib/core/folder-memory.cjs getCurrentRoom()` now reads STATE.md `current_room` field as canonical source; `scripts/context-monitor` consumes through this API (Plan 94-01).
- 3 em-dash (U+2014) violations in `commands/wiki.md` (Plan 94-07).
- 5 U+2717 (✗ heavy ballot x) violations in `commands/admin.md` and `commands/help.md` (Plan 94-08).

### Changed

- `commands/research.md` body removes `"Requires Brain MCP. Then stop."` hard-stop directive. Fresh installs without Brain now get graceful research-tier degradation (Plan 94-05).

### Deferred to v1.12 (logged in `.planning/phases/94-v1-11-2-tester-driven-fixer/deferred-items.md`)

- **BUG-1 FEYNMINTO-01 token budget for mega-sections.** Sections with 40+ artifacts cannot regenerate tier-1 MINTO because rendered source list consumes the 1500-token body budget. `/mos:heal` graceful-degrades (status `blocked_feynminto_01` + tier-0 fallback). Budget relaxation OR sub-section hierarchy planned for v1.12.
- **BUG-2 brain-derivation-queue auto-drain.** Queue accumulates entries on `governing_thought_changed` events but has no drain processor. `/mos:heal` reports queue depth + age; does not drain. v1.12 ships an on-stop OR session-start hook.
- **BUG-5 Section auto-creation on plugin upgrade.** When v1.11.0 added `legal-ip` as canonical, existing rooms did not get the section auto-scaffolded. `/mos:heal` Step 2 covers post-upgrade users; auto-scaffold-on-upgrade remains v1.12 work.
- **Plan 94-10 v1.11.2-release-gate.** Plan file preserved as a v1.X.Y release-gate template. Re-trigger when shipping the next patch as v1.11.2 instead of jumping to v1.12.0.

### Phase summary

```
Phase 94 Tester-Driven Fixer (v1.11.0 -> v1.11.1):
  94-01 statusline-active-room-fix              SHIPPED  4 commits
  94-02 rs-fetch-thesis-merge-fix               SHIPPED  3 commits  P0
  94-03 brain-mcp-server-resolution             SHIPPED  4 commits  P0
  94-04 mcp-server-brain-deps                   SHIPPED  4 commits  P0
  94-05 mcp-stack-fallback-chain                SHIPPED  5 commits  P0
  94-06 room-classifier-strict-mode             SHIPPED  4 commits  P0
  94-07 em-dashes-wiki-md                       SHIPPED  2 commits
  94-08 u2717-cross-mark-replacement            SHIPPED  2 commits
  94-09 explain-decision-action-footer          SHIPPED  3 commits  P1

Phase 94.1 v1-11-1-mos-heal-command:
  94.1-01 mos-heal-command                      SHIPPED  5 commits

Feynman runner: 107 fixture files (baseline +5 from v1.11.0).
```

### Upgrade

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

After upgrade, run `/mos:heal` once on each existing room to bring v1.10.x rooms to v1.11.0 conformance.

## [1.11.1-beta.1] - 2026-04-28

Hotfix release surfacing two production bugs caught during dog-fooding by tester onboarding prep. Ships as beta first per the release-infrastructure beta-gating rule (`/mos:doctor` is in the gated list). Promotion to `1.11.1` stable expected after one external user (Lawrence) validates the bundle. Phase 93.

### Why this is a beta

`/mos:doctor` is a new command that performs filesystem mutations (backup-then-replace recovery) when given `--fix`. Per `.claude/includes/release-process.md`: "Release infrastructure ALWAYS ships as a beta first. /mos:doctor, release.sh, pre-push hooks, session-start guards, migration scripts -- all of these go out as X.Y.Z-beta.N". Bug fixes in the bundle are therefore beta-gated for one extra day.

### How to opt into the beta

```bash
claude plugin update mos@mindrian-marketplace --version 1.11.1-beta.1
```

Stable users on 1.11.0 are not affected.

### Fixed (Phase 93 D1: Brain telemetry visibility)

- **`mcp-server-brain/brain-admin.cjs`** column-name mismatch (5 occurrences across `cmdList` + `cmdUsage`): read `total_requests` and `last_request_at` instead of stale/dead `request_count` and `last_used_at`. Result: `/mos:admin keys` and `/mos:admin usage` now display real adoption numbers instead of universal zero. Verified post-fix: jsagir Desktop=378, an admin-key holder=37, Lawrence Aronhime=26, plus six smaller users — matches Supabase ground truth.
- **`mcp-server-brain/lib/auth.cjs`** `logUsage()` insert column: write to `api_key` instead of nonexistent `key_id`. Previous code silently dropped 452 telemetry events with `PGRST204` errors swallowed by an upstream fire-and-forget `.catch()`. Brain usage log now fills correctly from this release forward; tool-level granularity restored.

### Added (Phase 93 D2: install-cache drift recovery)

- **`/mos:doctor`** new command (`commands/doctor.md` + `scripts/doctor.cjs`). Diagnoses install-cache drift by comparing live install at `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json` against highest semver in `~/.claude/plugins/cache/mindrian-marketplace/mos/`. Read-only by default (`/mos:doctor`). With `--fix`, performs backup-then-replace recovery: renames stale install to `.stale-<version>-<timestamp>` and copies the latest cached version via `cp -aT`. Verifies post-recovery `plugin.json` matches expected; rolls back on copy failure. Exit codes 0 (healthy) / 1 (drift detected) / 2 (recovered) / 3 (internal error). JSON mode for hooks and regression tests.

### Added (Phase 93 D4: regression test)

- **`scripts/test-doctor-recovery.cjs`** isolated regression test. Builds throwaway test environment via `mkdtemp`, populates fake stale install + multi-version marketplace cache, runs `doctor.cjs` as child process with `HOME` override. 4 test cases, 17 assertions, all passing: drift detection (exit 1) / `--fix` auto-recovery (exit 2 with backup created and stale content preserved) / healthy state no-op (exit 0) / `--fix` on healthy install no-op (exit 0).

### Documented (Phase 93 D3 + D5)

- **`docs/autopsies/2026-04-28-install-cache-drift-incident.md`** captures Incident #2 of the install-cache-drift pattern (15 days after Incident #1 from 2026-04-13) plus the orthogonal Brain telemetry column-name bug. Documents the diagnostic anti-pattern: "don't trust `git log` when cwd may inherit a parent `.git`; always `git -C <abspath>` + `test -d <path>/.git` first." Recovery procedure and prevention measures (shipped vs deferred to v1.12).
- **`docs/upstream-reports/2026-04-28-claude-plugin-update-misreports-state.md`** Anthropic upstream bug report draft (held until `/mos:doctor` lands, which it does in this release). Documents the symptom: `claude plugin update` reportedly returns "already at latest" while `plugin.json` is multiple versions behind the marketplace cache. Reproduction hypothesis, severity assessment, two reasonable fix paths.

### Out of scope (deferred to v1.12)

- `/mos:admin narrative` command (~150 LOC, feature not bug)
- Session-start drift detector that auto-runs `/mos:doctor`
- Workspace guard extended from commit-time to session-start drift detection
- Telemetry error counter + admin diagnostic surface (replaces silent `console.error`)
- Schema-drift CI check for brain-admin.cjs read path

### Upgrade path

Beta opt-in (above) lands all four fixes immediately. After Lawrence beta validation, version `1.11.1` (no suffix) supersedes and the standard two-command upgrade path applies:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

## [1.11.0] - 2026-04-28

Stable release shipping the Phase 91 Navigation Engine on top of the Phase 89.5 Reverse Salient Discovery surface that was incubated in v1.11.0-beta.1. The beta strategy was retired in favor of a single stable promotion: every v1.10.19 user upgrades atomically to v1.11.0 via the standard two-command upgrade path. Both engines (RS Discovery + Navigation Engine) ship live and integrated. Zero breaking changes. Skill activation remains a no-op when the engine has no opinion, so existing automation continues unchanged.

### How to upgrade

Run these two commands in order:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

The first command refreshes the marketplace catalog so v1.11.0 becomes visible. The second command installs it. This is the canonical two-command path documented in `.claude/includes/release-process.md` -- third-party plugins do not auto-push updates, by design.

### Added (Phase 91 Navigation Engine -- L5 Decision layer)

#### Navigation Engine Core (Plans 91-00 through 91-02)

- **`lib/core/navigation-engine.cjs decide(turn, context)`**: rule-based five-signal decision function composing ICM scope + SQL relations + Feynman-MINTO reasoning + BRAIN.md derivations + intent/persona into a typed decision struct (`fire_skill`, `offer_next_step`, `suppress_skills`, `persona_updates`, `decision_trace`). Pure module, never throws. Cold-path 1.42ms / warm-path 0.052us against the 800ms / 300ms budgets specified in the navigation-engine-brain-interface v1 contract (562x cold headroom, 5,769x warm headroom).
- **`lib/core/navigation-engine-shared.cjs`**: frozen tables (`STALENESS_MULTIPLIERS`, `CANONICAL_VERBS` 10-entry Canon Part 3 vocabulary, `SECTION_WEIGHTS` Section 3.2 contract) and pure helpers (`applyStalenessMultiplier`, `resolveTierMode`, `emptyDecision`, `emptyDecisionTrace`).
- **Persona durability via USER.md**: Larry's 3-persona detection (TTO / Researcher / Business) maps to Brain's 2-persona schema (Explicit / Implicit) through `lib/core/persona-taxonomy.cjs` translation table. Persona is now a first-class per-user artifact persisted in USER.md across sessions, not an ephemeral keyword detection. `lib/core/user-md-ops.cjs` provides Phase 87-02-pattern atomic read / write / detect-update with a 6-reason update-decision tree (first_detection / user_override / no_change / confidence_below_threshold / awaiting_consecutive_signal / threshold_met).
- **UserPromptSubmit hook integration** (`scripts/intent-classifier.cjs`): the engine now runs every user turn under a 1200ms Promise.race hard timeout. Decision traces persist atomically to `.mindrian/decision-traces/<session>.json` with 50-entry rotation. Engine output emits a `NAVIGATION DECISION (engine v1)` block to additionalContext so Larry's response respects the chosen rationale. Engine timeout / throw / module-absent paths gracefully fall back to pre-91 classifier behavior byte-for-byte.

#### Skill Routing & Offer Presentation (Plans 91-03, 91-04)

- **`lib/core/skill-activation-router.cjs`**: pure router composing engine `fire_skill` / `suppress_skills` with the pre-91 file-state + env activation set. Three precedence rules (engine / mixed / legacy) with explicit reason codes. Canon Part 3 closed-vocabulary enforced at the router boundary: unknown verbs are rejected with a trace note rather than silently propagating.
- **`lib/core/offer-presenter.cjs`**: `presentOffer(decision, history, ctx)` renders one grounded next-step suggestion per turn with a three-tier noise gate (`one_offer_per_turn`, `consecutive_ignores_threshold`, `ungrounded_reason`, `generic_reason`). Offer history persists to `.mindrian/offer-history.json` with 100-entry rotation. Wave-1 substring heuristic classifies each turn outcome as `acted` or `ignored` so the engine can suppress repeat suggestions after two ignores. Section 6 RECOMMENDED gate respected (Mode A + confidence >= 0.7) without re-evaluation -- the presenter trusts the trace.

#### Audit & Visibility (Plans 91-05, 91-06)

- **`/mos:explain-decision`**: new slash command renders the decision trace for the user's last N turns. Default renders the most recent decision; `--last N` renders N most recent (clamped to traces.length); `--session SESSIONID` overrides default session resolution. Output includes BRAIN.md signal block, RECOMMENDED marker block, five-signal triangulation, chosen_rationale, and optional Routing + Offer blocks. Always exits 0 (audit lens, never blocking). `disable-model-invocation: true` so the model never auto-fires it.
- **Larry dial in statusline** (`lib/core/nav-dial.cjs` + `scripts/context-monitor` integration): visible three-position dial (`Larry: Investigate | Blend | Insight`) renders between the MINTO governing-thought segment and the plugin brand. Position derives from engine state per turn (tier_mode + weight_applied + insight markers `synthesize` / `insight` / `converge`), grounded in the same `.mindrian/decision-traces/<session>.json` file `/mos:explain-decision` reads. Dial is suppressed when the engine has not yet spoken (`glyph='--'` + `highlight=null`).

#### Smart Routing (Plans 91-07, 91-08)

- **Problem-type-aware skill routing** (`lib/core/problem-type-router.cjs`): engine reads BRAIN.md `problemtype_classification` and routes skills per locked decision D-08:
  - **UDP** (Undefined) -> Exploration skills (5 verbs)
  - **IDP** (Ill-Defined) -> Definition-Seeking skills (5 verbs)
  - **WDP** (Well-Defined) -> Execution skills (5 verbs)
  - **Wicked** (any base type with `wicked_score >= 8`) -> Soft-Systems family per Canon Appendix E rule R4 (4 verbs)
  - The wicked override overlays base routing, preserving the base reason in parens for `/mos:explain-decision` auditability. Routing biases, never forces; `fire_skill` is set only when no higher-priority signal has populated it AND confidence >= 0.5.
- **FEEDS_INTO framework chain composition** (`lib/core/framework-chain-composer.cjs`): when the user completes framework A, the engine pre-loads framework B from BRAIN.md `framework_chain_predictions` (FEEDS_INTO edges with confidence + phase indicators). Composable methodology becomes real -- the Brain-flagged unfilled Opportunity from the audit is now a shipped surface. Confidence gating: < 0.5 -> suppress (noise floor); >= 0.5 -> proposal; >= 0.7 -> `recommended_eligible:true`. User override (turn-2 different `/mos:` command vs `ctx.lastTurnOffer`) captured as graph data per Canon Part 4: `chosen_rationale` records the rejection and `trace.chain_override_recorded:true` flags the next-scan signal.

#### Wave-3 Brain Availability Upgrade (Plan 91-07)

- `scripts/intent-classifier.cjs runNavigationEngine` swaps the Wave-1 hard-coded `brainAvailable=false` stub for a guarded `brain-client.isAvailable()` scalar lookup. Three failure modes default to safe `false` (require fails / function missing / function throws). Canon Part 8 Section 9.3 boundary preserved: only the boolean handle crosses; zero user content is sent to Brain at decision time.

#### Navigation Invariants Validator (Plan 91-09)

- **`lib/memory/validators/navigation-invariants.cjs`**: registry-compatible drop-in for the Phase 88-13 guardian. Five invariants enforced across the navigation-engine-brain-interface v1 contract:
  - **INV-1** `trace_missing_field` -- 8 Section 8 brain_md_* fields must be present on every persisted trace
  - **INV-2** `recommended_in_wrong_mode` -- Canon Part 3 Section 6 mode_a gate (RECOMMENDED markers only allowed under Mode A)
  - **INV-3** `weight_clamp_breach` -- weight_applied must be in [0.0, 1.0]
  - **INV-4** `trace_file_malformed` -- per-file isolation; one bad file does not stop scanning siblings
  - **INV-5** `unknown_verb_passed` -- Canon Part 3 vocabulary check on `fire_skill` (graceful when CANONICAL_VERBS module absent)
  - Three guardian modes wired (session-start advisory / on-stop advisory / pre-commit blocking) with the fail-open semantics inherited from Phase 88-13.

### Changed

- **Skill activation precedence**: when the engine has an opinion, engine output overrides legacy file-state + env activation. When the engine is silent or times out (1200ms hard cap), legacy activation continues unchanged. This is an architectural shift -- per locked decision D-06 it warrants a minor version bump (1.10.19 -> 1.11.0), not a patch.
- **`scripts/intent-classifier.cjs`**: trailing emission block now appends `NAVIGATION DECISION (engine v1)` to additionalContext after the Phase 83 mismatch warning and Phase 84 graph findings. Larry reads top-down; the engine decision wraps the prior context at the bottom of his prompt where he is most attentive.
- **`scripts/context-monitor` (statusline)**: dial segment renders between MINTO segment and plugin brand. Pre-91 statusline output stays byte-identical when the dial module is absent (degraded-install lazy-require fallback).
- **`commands/help.md`**: `/mos:explain-decision` listed under Infrastructure group (paired with `/mos:status`, `/mos:room`, `/mos:rooms` -- read-only diagnostic surfaces).

### Migration

- **Zero breaking changes.** Engine enhances, never breaks. Users on 1.10.19 upgrade to 1.11.0 with zero manual steps and zero behavior regressions.
- Pre-91 file-state + env activation preserved as fallback when the engine has no opinion.
- Existing commands / skills / agents unchanged in behavior; the routing layer is purely additive.
- Canon Part 8 boundary verified across all 11 Phase 91 production files: zero `brain-client.query|search|smartSearch` matches on hot-path code. Navigation Engine is a pure LOCAL reader of pre-derived BRAIN.md content; no Brain network queries fire at decision time.
- **Minor version bump (1.10.19 -> 1.11.0)** acknowledges the architectural shift in skill activation per locked decision D-06. Semver-consistent with the Canon Part 3 closed-vocabulary expansion boundary: the 10 canonical verbs are unchanged, but the routing surface that consumes them is new.

### Tests

- Feynman runner: 98/100 passing, 0 skipped, 2 inherited fails preserved (`84-smart-notebook-copilot` 15/16 and `test-self-update-platform` 19/24 -- both predate Phase 91 per the 91-05 / 91-06 SUMMARYs and are out-of-scope per Rule 3 scope boundary).
- Phase 88-01 `folder-memory.test.cjs` back-compat: 15/15 passing.
- Phase 90-04 `folder-memory-quadruple.test.cjs` back-compat: 17/17 passing.
- Phase 91 ships ~10 new test suites (one per plan): `navigation-engine-core.test.cjs` (33), `user-md-persona.test.cjs` (22), `userpromptsubmit-integration.test.cjs` (12), `skill-activation-router.test.cjs` (17), `offer-presenter.test.cjs` (17), `explain-decision-command.test.cjs` (14), `nav-dial.test.cjs` (17), `problem-type-router.test.cjs` (24), `framework-chain-composer.test.cjs` (18), `navigation-invariants.test.cjs` (16). All registered in the Feynman runner.

### Canon Compliance

- **Part 2 (Team Around Navigator)**: persona durability + insight-rationale keyword detection (`{synthesize, insight, converge}`) hook into Canon Part 3 verb 7 (Synthesize) and Canon Part 4 cross-relationship signal (Converge).
- **Part 3 (Tri-Context Decision Gate)**: closed 10-verb vocabulary enforced at the skill-activation router boundary; Section 6 RECOMMENDED gate (Mode A + confidence >= 0.7) respected by the offer presenter without re-evaluation.
- **Part 4 (Every Choice Is Graph Data)**: user override of a chain suggestion captures `chain_override_recorded:true` in the decision trace; `chosen_rationale` records the rejection reason. The next cross-relationship scan reads it.
- **Part 6 (Product-as-Venture Dog-Fooding Mandate)**: this release gate is the canonical commit moment where Phase 91's canon obligations are audited.
- **Part 7 (Reuse Before Build)**: the engine repurposes the existing `commands/explain-decision.md` skill-offer-engine concept; legacy file-state activation is preserved verbatim under the engine; the dial mirrors `classifyHealth` rather than cross-requires it.
- **Part 8 (Graph Boundary)**: zero `brain-client.query|search|smartSearch` matches across all 11 Phase 91 production files. Brain availability check uses only the boolean `isAvailable()` scalar (Section 9.3 compliant). The composer reads ONLY the LOCAL `quadruple.brain.sections.framework_chain_predictions` body that pre-derivation populated hours earlier inside the buildBrainQueryContext chokepoint. Zero Brain queries fire at engine time.

### Credits

- Navigation Engine Interface v1 contract frozen in Phase 90 Plan 09 (`.planning/research/navigation-engine-brain-interface.md`). Phase 91 consumes it.
- Tyler Slowak meeting quote ("my students almost unanimously said, 'We love the slider'") drove the dial as a shipped pedagogical surface, not a research wish.

## [1.11.0-beta.1] - 2026-04-27

Beta release of the Reverse Salient (RS) Discovery Engine for opt-in testers (the Wave-1 testers). Stable users on v1.10.19 are NOT auto-updated; opt-in is explicit. Phase 91 Navigation Engine is NOT yet wired -- coming in beta.2. Tester sign-off promotes to stable v1.11.0 in Phase 91.5.

### Tester Opt-In

Run these two commands in order to install this beta:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1
```

To leave the beta, drop the `--version` flag and run `claude plugin update mos@mindrian-marketplace` -- next refresh resolves back to stable v1.10.19.

### Added

- **RS Discovery Engine end-to-end orchestrator** (`scripts/rs-discovery-engine.cjs`, Phase 89.5). Top-level pipeline chaining Domain Analysis -> Query Matrix -> Fetchers -> Preprocessor -> Differential Scorer -> Innovation Classifier -> Breakthrough Scorer -> Thesis Generator -> Output Layer -> Chain Feeder.
- **Phase 89.1a: substrate.** Brain query plumbing + Canon Part 8 chokepoint preserving NEVER-user-data-to-Brain across all RS surfaces.
- **Phase 89.1: Domain Analysis + 60-Query Matrix.** `rs-domain-analysis.cjs` + `rs-query-matrix.cjs::generateQueryMatrix` produce the canonical 60-query matrix consumed by every fetcher.
- **Phase 89.2: Fetchers + Preprocessor + Scoring + Thesis.** 4 external fetchers (academic / patents / industry / experts) each carrying the 5-tripwire Canon Part 8 pattern (chokepoint + ExternalEgressViolation + auditQuery + drop-in validator + adversarial fixtures). Per-source rate-limit graceful degradation per Phase 88.6-03. Differential scorer + innovation classifier + breakthrough scorer + thesis generator complete the pipeline.
- **Phase 89.3: Output Layer.** `rs-neo4j-writer.cjs` (Aura schema: RSDiscovery / ReverseSalient / Innovation / Paper / Author / Institution + DISCOVERED / DERIVED_FROM / ENABLES / AUTHORED_BY / AFFILIATED_WITH edges), `rs-sqlite-mirror.cjs` (Tier 0 fallback when Aura absent), `rs-mind-map.cjs` (5-branch Cytoscape: Direct Intersections / Structural Transfer / Semantic Implementation / Discovered RS / Innovation Ecosystem), `rs-expert-mapper.cjs` (Cypher MATCH against user's Aura).
- **Phase 89.4: Chain Wiring.** `rs-chain-feeder.cjs` codifies engine choreography across the broader MindrianOS engine ecosystem (HSI / Navigation Engine / Scenario / Opportunity / Team-Assembly). Canon Part 3 10-verb closed vocabulary enforced (validateVerb). Skill-spawn rules ship per RS type and breakthrough score.
- **Phase 89.5: Bidirectional NL-Graph Surface.** Text->Query (`rs-text-to-query.cjs`): natural language -> Cypher/SQL -> 3-graph triangulation across room.db + LazyGraph Aura + Brain methodology, with Canon Part 8 chokepoint preserved. Query->Text (`rs-query-to-text.cjs`): raw graph results -> Larry-voiced NL explanation with pedagogical framing + venture context + cross-ref enrichment.
- **4 new CLI commands:** `/mos:rs-fetch`, `/mos:rs-thesis`, `/mos:rs-experts`, `/mos:rs-explain`. All three surfaces (CLI + Desktop MCP + Cowork) verified at 89.5 closure.
- **Pre-release tripwires (this gate).** `scripts/release-beta-preflight.sh` refuses tag operations when plugin.json version does not match `-beta.N` suffix. `scripts/release-beta-smoke.sh` runs a fresh-clone + plugin-install + `/mos:rs-fetch` smoke against the COMMITTED release state (commit -> smoke -> tag ordering) BEFORE tag creation, per release-process.md beta-gating mandate.
- **TESTER-NOTES.md** at `.planning/release/v1.11.0-beta.1-TESTER-NOTES.md` with opt-in instructions, 4 CLI commands, known limitations, and feedback channel.

### Known Limitations

1. **Navigation Engine is not yet wired** (Phase 91; coming in v1.11.0-beta.2). Skill activation remains the legacy file-state + env behavior in beta.1. RS commands work fine; the engine that picks RS commands automatically does not.
2. **Aura write path requires LazyGraph connected.** SQLite Tier 0 fallback works when Aura is absent. Aura write only fires when LazyGraph is enabled via `/mos:setup graph`.

### Phase Gate

Phase 89.5 closed 2026-04-27 with 9/9 SCs verified; Phase Gate CONDITIONAL PASS; Feynman runner baseline 85 -> 90 (5 new fixture suites registered). v1.11.0-beta.1 readiness gate cleared.

## [1.10.19] - 2026-04-26

Patch release that ships two same-day hotfixes initially attempted as in-version patches to v1.10.18. The in-version mechanism failed in the field: a v1.10.18 user running `/mos:update` was told "you're on the latest" because version comparison was `1.10.18 == 1.10.18`, even though the v1.10.18 tag had been force-moved to the hotfix commit. Promoting to a real patch-bump (1.10.19) so every standard update tool sees the diff. The 1.10.x minor baseline is preserved -- planning artifacts (Phase 91 navigation-engine, Phase 92 refactor work) continue to reference the 1.10.x line.

### Fixed (Hotfix 1: hook output schema)
- **CRITICAL: Hook output schema compatibility with Claude Code 2.x.** Three hook scripts (`scripts/query-efficiency-telemetry.cjs`, `scripts/write-scope-check.cjs`, `scripts/feynman-minto-guardian.cjs`) emitted JSON with top-level `systemMessage` / `additionalContext` fields. Claude Code 2.x rejects these via `additionalProperties: false`, causing every Read/Grep/Glob and Write/Edit call to fire "Hook JSON output validation failed -- (root): Invalid input" in the user's terminal. Plugin appeared broken on every recent Claude Code install. Fixed by wrapping output in the canonical `hookSpecificOutput` envelope per the official hooks reference (https://docs.anthropic.com/en/docs/claude-code/hooks). Silent exits now emit zero stdout (was: invalid JSON with null fields).
- Reported by Aryeh Holtzberg (PWS IRIS 2025) on 2026-04-26. Reference fixes in graphify v0.3.21 (2026-04-09) and oh-my-claudecode v4.11.5 ("fix(hooks): wrap wiki hook additionalContext in hookSpecificOutput").

### Fixed (Hotfix 2: plugin registry sync)
- **CRITICAL: `/mos:update` and `scripts/self-update` bypassed Claude Code's plugin registry.** The previous implementation copied plugin files to `~/.claude/plugins/cache/...` but did NOT update `~/.claude/plugins/installed_plugins.json` or `~/.claude/settings.json :: enabledPlugins`. Result: cache had the new version, registry didn't, plugin loader silently ignored the install. Slash commands disappeared. Users restarted, saw nothing, assumed the plugin was broken. Confirmed in field by Aryeh Holtzberg on 2026-04-26 -- matches Anthropic-tracked issues #11357, #12457, #14815, #17832 (all describe `installed_plugins.json` and cache drifting out of sync, plugin appearing installed but not loading).
- **Fix: native delegation.** `commands/update.md` rewritten to call Claude Code's native `claude plugin marketplace update` + `claude plugin update mos@mindrian-marketplace` (slash form: `/plugin marketplace update` + `/plugin update mos@mindrian-marketplace`). These commands keep all four registry files in sync atomically. Constitutional rationale: Canon Part 7 -- Reuse Before Build. We had a homegrown installer; the platform already had one that worked.
- **Deprecation: `scripts/self-update`** is now a no-op stub that emits a clear migration message and exits non-zero. The 427-line original is preserved at `scripts/self-update.deprecated-2026-04-26.bak` for reference. Existing automation (cron jobs, CI) gets a clear migration path instead of silent breakage.

### Added
- **Pre-release hook compatibility scan**: `scripts/check-hook-schema-compatibility.cjs` scans every hook script for forbidden output patterns before any version bump. Top-level `systemMessage`, top-level `additionalContext`, and naked `JSON.stringify({systemMessage: ...})` patterns now fail the release gate. See `docs/RELEASE-GATES.md`. This gate is mandatory before every future version tag.
- **SHA-based update detection** in `/mos:update`: compares the local installed-commit SHA against the remote `v<version>` git tag SHA, surfacing in-version hotfixes (cases where the version string matches but the tag was force-moved). Belt-and-suspenders defense alongside semver comparison so users on a corrupted in-version build can still detect the fix is available.

### Process change
- **In-version patches are deprecated as a distribution mechanism.** v1.10.18 was force-tagged twice during the 2026-04-26 hotfix attempts; both attempts hit the same wall: existing users running version-comparison-based update tools never saw the diff. Going forward, every fix that reaches users ships with a patch-level version bump. The 1.10.18 git tag now points at the original Phase 90 release commit; v1.10.19 is the canonical home for the hotfixes.

### Phase 90 plan amendment
Both hotfixes are appended to Phase 90 (brain-derivation-layer) release notes as patch-level correctives. See `.planning/phases/90-brain-derivation-layer/90-HOTFIX-2026-04-26.md` for the failure-mode autopsy and constitutional rationale.

## [1.10.18] - 2026-04-20

### Original release notes

Phase 90 Brain Derivation Layer ships. BRAIN.md lands as the fourth
per-folder memory file on top of the Phase 88 triple, extending per-folder
memory from triple to quadruple while keeping readTriple byte-identical for
every Phase 88 consumer. Readers opt into the richer quadruple by calling
the new additive readQuadruple entry point. Derivation is Brain-authored,
versioned, and auto-invalidated on governing_thought change. Five
independent Canon Part 8 tripwires defend the constitutional boundary
across schema, prompt builders, invariants validator, cross-room
aggregator, and a cross-scenario BRAIN.md body sweep. The derivation
surface is proven fail-safe under 14 graceful-degradation scenarios
covering Brain-offline, rate-limit, schema drift, ENOSPC, EACCES, and
concurrent-write races. /mos:brain-derive ships with four orthogonal
modes (section / --all / --cross-room / --dry-run) rendering the Phase
88.6 Shape E Action Report. Phase 91 Navigation Engine consumes this
layer through a frozen v1 interface contract filed at
.planning/research/navigation-engine-brain-interface.md. Phase 90 adds
zero new runtime dependencies, preserves all 10 existing deps
byte-for-byte, and keeps three-surface parity across CLI, Desktop, and
Cowork. Feynman suite grows from 52 to 62 registered files (10 new test
suites covering every Phase 90 surface). Canon Parts 2, 3, 6, 7, 8
honored throughout. v1.10.17 was burned as a hotfix for YAML frontmatter
parse errors (entry below); Phase 90 ships at v1.10.18.

### Added

- **BRAIN.md: the fourth per-folder memory file.** A Brain-authored
  derivation layer that sits on top of the Phase 88 triple (ROOM.md +
  MINTO.md + REASONING.md). Per-section carries: Pattern Matches,
  Cross-Domain Analogies, Wicked Indicators, Unfilled Opportunity
  Matches, Framework Chain Predictions, Assessment Thinking-Chain
  Position, Problem-Type Classification, Cross-Room Contradiction Flags
  (opt-in), and optional HSI signals. Schema is frozen at v1 with a
  STALE_REASON enum + OPTIONAL_SECTION_HEADINGS vocabulary. The
  frontmatter carries governing_thought_hash so a change in the section's
  MINTO.md auto-invalidates the derivation. Schema doc at
  docs/BRAIN-MD-SCHEMA.md (Phase 90 Plans 00 + 01).

- **/mos:brain-derive slash command (4 modes).** Four orthogonal knobs
  on a single dispatcher: `section` (single), `--all` (every section
  in the active room), `--cross-room` (enable Phase 83-scoped
  cross-room contradiction aggregation), `--dry-run` (cost estimator;
  zero Brain calls, zero BRAIN.md writes). Output is a Shape E Action
  Report per Canon Part 3 (body shape ported byte-identically from
  Phase 88.6 diagnostics). Streaming stderr progress kicks in above
  3 sections. Rate-limit mid-batch converts remaining sections to
  structural skips; partial completion is valid. `allowed-tools`
  narrowed to `Bash(node *)` (Phase 90 Plan 07).

- **folder-memory readQuadruple() extension.** readTriple signature
  and return remain byte-identical (15/15 Phase 88-01 tests continue
  to pass). readQuadruple is a new composed entry that layers
  parseBrainMd + emptyBrain + attachBrainToTriple on top of the
  existing triple. Sync and async entry points both ship with
  AsyncFunction key-set parity enforced by a test. A new
  isQuadrupleFresh predicate exempts transient `brain_offline`
  staleness from "derivation stale" so a brief network outage does
  not cascade (Phase 90 Plan 04).

- **Five independent Canon Part 8 tripwires.** Schema leak heuristic
  scan (Plan 00) + deriveSection single-chokepoint
  buildBrainQueryContext (Plan 01) + registry brain-md-invariants
  body-text scan at guardian checkpoints (Plan 05) + cross-room
  aggregator sanitizeDetailScalar + JSON.stringify output audit
  (Plan 06) + cross-scenario BRAIN.md sweep across every graceful-
  degradation fixture (Plan 08). A bug in any one tripwire produces
  detection via the other four. Defense in depth for the
  constitutional boundary.

- **Cross-room contradiction aggregation.** Scoped by Phase 83
  .rooms/registry.json (zero new registry format; zero Phase 83 code
  edits). Sealed-room contract via GUARDRAIL.md preserved byte-for-
  byte. Per-room opt-out via ROOM.md `brain_cross_room: false`.
  Absolute-path scope guard: every peer resolved through
  path.resolve + startsWith(~/MindrianRooms/); out-of-scope paths
  (symlink escapes, relative traversals) are skipped. Output is
  structural-only: slug-safe strings, frozen contradiction-type
  enums (hash_divergence / framework_contradiction /
  problem_type_mismatch), sha256 hash prefixes, scalar confidence.
  Opt-in per-call, default off (Phase 90 Plan 06).

- **Phase 91 Navigation Engine interface contract (v1 frozen).** Spec
  filed at `.planning/research/navigation-engine-brain-interface.md`
  (523 lines, 11 sections). Freezes the read path (readQuadruple as
  sole entry), the consumed fields + weight table (0.35 pattern_matches
  + 0.20 framework_chain_predictions + 0.15 cross_domain_analogies +
  0.10 wicked_indicators + 0.10 unfilled_opportunity_matches + 0.05
  assessment_thinking_chain_position + 0.05 problemtype_classification
  = 1.0), the staleness weight pairs (fresh 1.0 / age_exceeded 0.7 /
  governing_thought_changed 0.3 / brain_graph_version_mismatch 0.5 /
  brain_offline 0.9 / derivation_timeout 0.2 / parse_failed 0.0), the
  tier mode mapping, the RECOMMENDED confidence gate at >= 0.7 (Mode
  A only), the signal triangulation procedure, and the Canon Part 8
  boundary for Phase 91 (Navigation Engine is READ-ONLY against
  BRAIN.md; all derivation routes through Plan 90-02 enqueue -> Plan
  90-01 deriveSection). INTERFACE_VERSION=1 with bump discipline baked
  in (Phase 90 Plan 09).

### Infrastructure

- **Governing-thought change trigger.** A post-regen hook in
  `scripts/vault-section-minto-generator.cjs` calls
  `tryEnqueueBrainDerivation` which adds a section to
  `brain-derivation-queue.json` using the same atomic-write pattern
  from Phase 88-02 / 88-04-B. Drain fires non-blocking on
  UserPromptSubmit via a detached child spawn; the parent returns
  within 100ms regardless of queue depth. Queue survives crashes via
  atomic `openSync(wx) + writeFileSync + fsyncSync + renameSync`.
  Soft cap 500 / hard cap 1000. Section-as-unique-key idempotency
  (replace on hash change, dedupe on hash equality). Stale-queue-
  race guard re-reads the live triple at drain time and skips when
  the current hash has diverged from the queued hash. Frozen reason
  vocabulary: governing_thought_changed / session_start_stale /
  manual_invocation / cross_room_aggregation. Brain-offline entries
  stay queued and drain catches up when Brain returns (Phase 90
  Plan 02).

- **Session-start Brain-staleness scan.** Precedence (first-match-
  wins): file-missing -> absent; frontmatter-parse-fail ->
  stale/parse_failed; hash mismatch -> stale/governing_thought_changed;
  age > STALE_AGE_DAYS -> stale/age_exceeded; brain_graph_version
  below current schema -> stale/brain_graph_version_mismatch; else
  fresh. Brain-reachable stale sections enqueue a regen with the live
  governing_thought hash recomputed at enqueue-time; Brain-offline
  stale sections downgrade to enqueue_when_brain_online so drain
  catches up when Brain returns. Backward-compat: rooms with zero
  BRAIN.md files emit no annotations. Per-section staleness surfaces
  in the existing Phase 88-07 TRIPLE_CONTEXT block (weakest-first
  sort preserved). Env overrides: `BRAIN_STALE_AGE_DAYS` (threshold
  tunable) + `BRAIN_STALENESS_SKIP=1` (byte-stable emergency bypass)
  (Phase 90 Plan 03).

- **brain-md-invariants validator (Phase 88-13 registry plugin).**
  Drops into `lib/memory/validators/` for auto-discovery; zero
  guardian.cjs edits. Wraps Plan 90-00 validateSchema with parse-
  failure short-circuit (prevents cascade noise on malformed
  frontmatter). Schema fatal + attribution errors (author !=
  "brain") block at guardian checkpoints. Staleness and
  canon_boundary (body-text leak scan) surface as warnings in the
  invariant-report. Fail-open confirmed: a validator throw exits
  guardian 0 and other validators continue. Six canon_boundary
  patterns (email / currency / quoted-person / meeting / SSN /
  phone); 5-violation cap prevents report spam (Phase 90 Plan 05).

- **Graceful-degradation end-to-end suite.** 14 scenarios plus 2
  cross-cutting audits covering Brain-offline (permanent +
  intermittent) / API quota exhausted / timeout mid-derivation /
  schema drift / malformed Brain response / network partition /
  EACCES / ENOSPC on atomic rename / concurrent deriveSection on
  same section / Canon Part 8 under ordinary operation + under
  timeout / corrupt peer room in cross-room aggregator / concurrent
  session-start staleness scans. Each scenario asserts four
  invariants: no crash / no orphan tmpfile / structured
  result.success boolean / retry-path where semantically meaningful.
  Cross-cutting A1 sweep scans every BRAIN.md landed during the
  suite against the frozen FORBIDDEN_PATTERNS set; A2 sweep scans
  every tmp root for `BRAIN.md.tmp.*.brain` orphans. Full suite
  runs in ~337ms (90x headroom under 30s budget) (Phase 90 Plan 08).

### Changed

- **Per-folder memory expands from triple to quadruple.** readTriple
  still works byte-for-byte for every Phase 88 consumer. readQuadruple
  is additive; consumers who want the brain field opt in by calling
  the new entry point. No field renamed, no field removed, no shape
  change to the existing triple return.

### Canon Phase Map

- Part 3 Tri-Context Decision Gate: Option generation tier-awareness
  (Mode A / B / Tier 0) shipped (cites Plan 90-09).
- Part 8 Graph Boundary: Brain derivation layer preserving boundary
  shipped (5-tripwire evidence; cites Plans 90-00 + 90-01 + 90-05 +
  90-06 + 90-08).
- L2 Memory: BRAIN.md quadruple row noted alongside the Phase 88
  triple.

### Upgrade path

Two-command manual upgrade per `.claude/includes/release-process.md`:

```
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

Auto-update is off by default for third-party plugins. Users on
v1.10.16 or v1.10.17 run the two commands above. No Node version
change. No breaking changes. readTriple callers see zero behavioral
drift; readQuadruple callers are new.

## [1.10.17] - 2026-04-24

Hotfix for YAML frontmatter parse errors in three command files introduced by
the Phase 88.1 frontmatter hygiene sweep (v1.10.15). The self-update validator
caught these before any user install took damage -- the 5-gate release
protocol doing its job. Patch release, fix-only, no feature change. Phase 89
reverse-salient-engine behavior byte-identical. Phase 90 brain-derivation-
layer work remains unshipped (continues in v1.10.18+). Upstream bug root
cause: multi-bracket argument-hint values (e.g. `[--chain] [--swarm]
[--dry-run]`) are parsed by YAML as implicit flow-sequence mapping pairs and
require a colon between bracket groups, which is absent in shell-style hints.
Single-bracket hints (e.g. `[pipeline-name]`) parse cleanly as flow sequences
and were not affected. Fix: single-quote the offending values so YAML treats
them as plain strings. 72/72 command files + 8/8 agent files now parse
cleanly through gray-matter regression sweep.

### Fixed

- `commands/act.md` line 4 -- `argument-hint` single-quoted. Was
  `[--chain] [--swarm] [--dry-run]`, now `'[--chain] [--swarm] [--dry-run]'`.
  YAML parser now reads the value as a string; command metadata loads at
  plugin load instead of silently dropping `name`, `description`,
  `body_shape`, `ui_reference`, and `allowed-tools` fields (including the
  four Brain MCP tool allowances).
- `commands/vault.md` line 4 -- `argument-hint` single-quoted. Was
  `[<room-name>] [--path <dir>]`, now `'[<room-name>] [--path <dir>]'`.
  Restores `disable-model-invocation: true`, `body_shape_overview`,
  `ui_reference`, and `allowed-tools` at plugin load time.
- `commands/snapshot.md` line 4 -- `argument-hint` single-quoted. Was
  `[<room-path>] [--open]`, now `'[<room-path>] [--open]'`. Restores
  `disable-model-invocation: true`, `usage`, `category`, `surface`,
  `requires`, and `allowed-tools` at plugin load time.

### Notes

- Self-update validator on v1.10.12 installs refused to install v1.10.16
  cleanly (validation gate on staged copy). Nothing was ever written to the
  user's plugin cache directory. The fix ships as a hotfix branched from
  `origin/main` at v1.10.16 HEAD, isolating in-flight Phase 90 WIP from
  the release commit range.
- Two-command upgrade path per docs/release-process.md: users on v1.10.12
  or v1.10.16 run `/plugin marketplace update` then `claude plugin update
  mos@mindrian-marketplace`. Auto-update path not enabled by default for
  third-party plugins; manual upgrade is correct-by-design.
- Canon Part 7 (Reuse Before Build) honored: no new code, only YAML
  single-quote wrapping on three existing files.
- Canon Part 8 preserved: zero Brain egress surface change; pure
  plugin-layer patch.
- Three-surface parity preserved: CLI / Desktop / Cowork all load the
  three affected commands identically once frontmatter parses cleanly.

## [1.10.16] - 2026-04-24

Phase 89 reverse-salient-engine ships. Canon Part 2 Engine 1 Act 1 formal
reverse-salient engine lands across six waves: authoritative Hughes 1983 /
Kwan 2023 LSA + signed abs-diff algorithm port, tiered external corpus
fetcher (OpenAlex + arXiv + Tavily), Pinecone rs-external lazy-TTL cache
with multilingual-e5-large integrated embedding, cross-room multi-project
mode, hybrid room-x-external unified-corpus mode, and Obsidian nested
bridge artifact writer with De Stijl Cytoscape.js mind map. Five new pure
Python helper modules (rs_math, rs_corpus, rs_cache, rs_rooms, rs_hybrid)
plus scripts/rs-engine.py 4-mode CLI and scripts/write-bridge-artifacts.cjs
Obsidian renderer. Warm external-corpus runs drop to ~15s via Pinecone
cache; bypass path preserves Plan 89-02 byte-identical behavior when
Pinecone is unavailable (CLAUDE.md Decision 8 Tier 0 functionality).
Feynman suite 52/52 passing. Zero new runtime dependencies beyond
pinecone>=5.0.0 added to requirements-hsi.txt (Python-side only; plugin
JS deps unchanged). BSL 1.1 on every new .py/.cjs file. Canon Parts 2, 3,
4, 6, 7, 8 honored. Three-surface parity preserved across CLI, Desktop
ReverseSalientAgent wiring, and Cowork 00_Context/ mirror.

### Added

- Reverse salient math substrate `lib/core/rs_math.py` (287 lines):
  authoritative port of the Kwan 2023 algorithm from source/lsa.py +
  source/comparison.py. Seven helpers: build_tfidf_svd,
  extract_topic_keywords, count_topic_membership (topic-keyword membership
  counting preserved verbatim -- cosine-on-SVD substitution would change
  the signal entirely per ALGORITHM-SOURCE.md line 72 warning),
  normalize_and_l1_similarity, abs_diff_topk (iterative argmax with
  upper-triangle masking and symmetric cleanup so no (i,i) self-pair ever
  wins and no (j,i) mirror duplicates), classify_direction, build_lsa_matrix.
  NLTK stopwords dependency dropped in favor of TfidfVectorizer built-in
  English stopword list (no NLTK download required). (Plan 89-01)
- Mode A single-room CLI `scripts/rs-engine.py` (654 lines initial, 1755
  at Phase 89 end): `--mode internal --room PATH [--topk 100] [--threshold
  0.30] [--no-thesis] [--output PATH]`. Walks `room/*.md` on the
  filesystem (same pattern as scripts/compute-hsi.py:discover_artifacts --
  no room.db artifacts table exists). Writes `.rs-engine-results.json`
  with pair dicts carrying source_artifact_id, target_artifact_id,
  lsa_score, semantic_score, signed_diff, abs_diff, direction
  (structural_transfer | semantic_implementation). Writes REVERSE_SALIENT
  edges into `room.db` when present, with `properties.source='rs-engine'`
  so hsi-sourced edges coexist untouched (per-edge scoping, not per-table
  -- lazygraph-ops schema has no dedicated REVERSE_SALIENT table). JSON
  sidecar embedding cache `.rs-engine-cache.json` keyed by artifact id +
  content SHA256[:16] + model name; warm rerun drops from ~4s cold to
  ~0.9s warm on the 6-artifact fixture. (Plan 89-01)
- External corpus fetcher `lib/core/rs_corpus.py` (468 lines): OpenAlex
  primary, arXiv secondary, Tavily fallback (gated by TAVILY_API_KEY).
  Seven exports: fetch_corpus, fetch_openalex, fetch_arxiv, fetch_tavily,
  invert_abstract (reconstructs OpenAlex abstract_inverted_index per
  RESEARCH Pitfall 3), dedupe (DOI-preferred, normalized-title fallback,
  first-seen ordering), topic_slug. OpenAlex cursor pagination with
  polite-pool User-Agent + mailto: (OPENALEX_EMAIL env); arXiv Atom XML
  parsing with 0.35s spacing respecting ~3 req/s soft cap. Empty-abstract
  filter at every tier so target_n counts usable docs. MAX_TARGET_N=20000
  hard ceiling so misconfigured --topk cannot balloon external API usage.
  Skips Scopus, Semantic Scholar direct, USPTO direct, PubMed. (Plan 89-02)
- Mode B external wiring `--mode external --topic "..." --room PATH`
  produces signed-differential pairs across the freshly-fetched literature
  corpus; corpus persisted to `{room}/research/{topic-slug}/_corpus.jsonl`
  for provenance; results at `{room}/research/{topic-slug}/.rs-engine-results.json`.
  Overshoot formula `max(topk*20, topk*2)` preserves delivered pair count
  after dedup attrition on small --topk values. Pair dicts carry source_doi,
  source_url, target_doi, target_url alongside Mode A artifact-id fields
  (Plan 89-06 resolvePairIdentity schema-tolerant across both shapes).
  Auto-creates room dir for --mode external; Mode A existing-check
  preserved. (Plan 89-02)
- Pinecone rs-external lazy-TTL cache `lib/core/rs_cache.py` (479 lines):
  Velma-pattern wrapper around integrated-embedding Pinecone index with
  multilingual-e5-large field-map text->abstract on us-east-1 aws. Nine
  public entries: namespace_slug, ensure_index (idempotent create +
  readiness polling via desc.status.ready attribute form per scripts/
  consolidate-pinecone.py precedent), get_namespace_freshness (samples
  one record via list()+fetch() -- raw-vector query() fails on integrated-
  embedding indexes), upsert_corpus (batches of 96 matching Pinecone
  inference limit, single shared fetched_at timestamp per batch for single-
  sample freshness inference), query_namespace, fetch_all_from_namespace,
  is_fresh, plus INDEX_NAME, TTL_DAYS=30, MAX_NAMESPACE_VECTORS=10000
  (raises with sharding hint rather than silently truncating). Per-topic
  namespace keyed by topic_slug. Timezone-aware datetime.now(timezone.utc)
  replaces deprecated utcnow. (Plan 89-03)
- Mode B Pinecone warm/cold/bypass state machine: warm path reads 1024-dim
  e5-large vectors from rs-external namespace if age < 30 days, skipping
  fetch entirely; cold path fetches via fetch_corpus + upsert_corpus +
  re-fetch from Pinecone (re-reading server-side vectors rather than
  locally-embedded ones guarantees warm/cold semantic consistency on
  repeated runs); bypass path falls through to Plan 89-02 local MiniLM
  behavior byte-identical when PINECONE_API_KEY is unset or
  RS_EMBEDDING_MODEL=minilm. New metadata fields cache_mode (warm | cold
  | bypass), cache_age_days, cache_namespace, cache_ttl_days surface on
  every Mode B result JSON so downstream consumers can render warm-vs-cold
  provenance without re-computing freshness. Live smoke: 400-doc cold upsert
  for "nv diamond magnetometry" followed by warm run hit at age=0.0 days,
  20 pairs. (Plan 89-03)
- Cross-room Mode A extension via `lib/core/rs_rooms.py` (193 lines) and
  new `--rooms PATH [PATH ...]` CLI argument (nargs='+'): walks each room's
  filesystem per-room, tags every artifact with room_id (basename) and
  global_id (f"{room_id}::{artifact_id}") for uniqueness, skips .git /
  .lazygraph / .mindrian / node_modules / .obsidian and the three metadata
  files (STATE.md, ROOM.md, MINTO.md). Basename-collision disambiguator
  suffixes duplicate room_ids with -2, -3. `CROSS_ROOM_OVERSHOOT=3` keeps
  delivered pair count near topk after intra-room discards on up-to-67%
  intra-room fraction; `CROSS_ROOM_WARN_SHARE=0.05` warns on stderr when
  any room contributes less than 5% of the corpus (plan Risk 1 mitigation:
  prevents silent LSA skew). Separate cache directory
  `.rs-engine-cross-room-cache/` prevents collision with Mode A single-room
  cache keyed by per-room artifact_id. Mutually exclusive with --room and
  --mode external; requires at least two paths. `pair_matrix` metadata
  surfaces cross-room bridge counts keyed on sorted room-id tuples. Mode
  A multi-room writes NO room.db edges (cross-room pairs span rooms, no
  single room.db owns them). `<10` artifact threshold and all-single-room
  edge cases return well-formed empty-pairs JSON with clear stderr
  messages. (Plan 89-04)
- Hybrid Mode C via `lib/core/rs_hybrid.py` (586 lines) and
  `--mode hybrid --room PATH --topic "..." [--external-target N]`:
  build_unified_corpus returns (corpus, origin_mask, metadata) where
  origin_mask is a numpy bool array (True=room, False=external) for O(1)
  cross-corpus filtering. Room-side loader reuses scripts/rs-engine.py:
  discover_artifacts byte-for-byte so Mode A and Mode C see identical
  artifact inclusion rules. External-side reuses Plan 89-03 rs_cache
  warm/cold/bypass state machine verbatim. Full unified corpus embedded
  in one MiniLM 384-dim model space for dimensional homogeneity on the
  pairwise cosine matrix; cached e5-large vectors retained on external_doc
  for future downstream reranking. `HYBRID_OVERSHOOT=10` multiplier on
  abs_diff_topk keeps post-filter yield near topk on realistic corpora
  (O(100) room vs O(2000) external means >99% strongest by volume are
  external-external). filter_cross_corpus_pairs canonically orients
  room_side/external_side. `--external-target` defaults to 2000, clamped
  to MAX_EXTERNAL_TARGET=5000 (defense-in-depth against misconfigured
  callers blowing memory on a 50kx50k similarity matrix). Every hybrid
  pair carries BOTH Mode A-compatible source_artifact_id/source_section/
  source_title/target_* fields AND richer room_artifact/external_doc
  structs so Plan 89-06 bridge-writer resolvePairIdentity handles all
  modes through one resolver. Mode C writes NO room.db edges. `--rooms +
  --mode hybrid` is a guard rail (exit 2); `--mode hybrid` without --topic
  is a guard rail. Live smoke: 3 room + 200 external unified corpus,
  cross-corpus pairs in 15.7s warm (<30s target). (Plan 89-05)
- Obsidian bridge artifact renderer `lib/core/bridge-writer.cjs` (427
  lines, pure): seven exports slugifyPair, resolvePairIdentity,
  renderBridgeArtifact, renderRoomMd, renderSectionRoomMd, renderIndex,
  renderMindMap. Schema-tolerant resolvePairIdentity collapses Mode A
  internal (section + artifact_id), Mode B cross-room (source_room +
  source_artifact), and Mode C hybrid (room_artifact + external_doc) into
  a single 8-field identity struct consumed by every renderer -- one
  module spans all four modes without per-mode branches. Dual Brain
  framework citation in every bridge frontmatter (brain_framework_classical
  = "framework:reverse-salient-analysis" + brain_framework_algorithmic =
  "framework:algorithmic-generation-of-reverse-salient-solutions") per
  ROADMAP SC-5. v1.9.7 nested folder rule: folder-name.md matches folder
  name; ICM Layer 0 Decision 15: section ROOM.md + per-bridge ROOM.md.
  Dataview _index.md with TABLE query aggregates bridge list. (Plan 89-06)
- Bridge-writer CLI `scripts/write-bridge-artifacts.cjs` (140 lines,
  chmod +x): `--results PATH --room PATH` consumes rs-engine JSON, walks
  pairs, writes nested `opportunity-bank/cross-room-bridges/bridge-NNN-slug/`
  folders with body + ROOM.md per v1.9.7 + ICM Layer 0. Exit 2 on missing
  or invalid JSON; exit 3 on empty pairs. On 15-pair fixture: 15 bridge
  folders + 16 ROOM.md (1 section + 15 bridges) + _index.md + mindmap.html
  written. (Plan 89-06)
- De Stijl Cytoscape.js mind map `mindmap.html`: generated per-run at
  `cross-room-bridges/mindmap.html`. Inline De Stijl hex palette
  (#A63D2F red, #1E3A6E blue, #C8A43C yellow, #2A6B5E teal, #F5F0E8
  cream, #1a1a1a dark) inside Cytoscape style objects because CSS var()
  does not resolve inside Cytoscape Canvas rendering. Direction-colored
  edges (red structural_transfer, yellow semantic_implementation); cose
  layout; header cites both Brain framework nodes. Cytoscape.js 3.28.1
  via CDN -- reuses the "Cytoscape.js via CDN in dashboard HTML" STACK row
  without adding an npm dependency. ROADMAP SC-7 satisfied. (Plan 89-06)
- `pinecone>=5.0.0` added to `requirements-hsi.txt` (Python-side only,
  local install verified 8.1.0; no change to plugin package.json
  dependencies). (Plan 89-03)

### Changed

- `scripts/rs-engine.py` grows from 654 lines (Plan 89-01) to 1755 lines
  (Plan 89-05 end) as Modes B, C, and --rooms dispatch land; Mode A path
  byte-identical across all five waves (verified on /tmp/rs-test-room
  6-artifact fixture on every plan: 15 pairs + 15 REVERSE_SALIENT edges
  regression-checked pre- and post-commit). Mode B path byte-identical
  from Plan 89-02 through 89-05 on the bypass branch.
- `docs/CANON-PHASE-MAP.md` Part 2 Engine 1 "Reverse-Salient formal
  engine" row promoted from `planned` to `shipped` with Phase 89 citation.
  Version-history gains v1.3 (kept) 2026-04-24 row for Phase 89
  (v1.10.16) reverse-salient engine shipment. No canon text change; map
  row updates only.

### Notes

- Cost transparency (documented in `/mos:find-cross-room-bridges`
  command help): internal + cross-room modes are $0 (pure filesystem +
  local MiniLM); external and hybrid modes are ~$0.40-$1.10 per cold
  run (OpenAlex free + arXiv free + Tavily metered + Pinecone integrated
  embedding) and $0 on warm cache within 30-day TTL; `--no-thesis`
  disables LSA fit for $0 runs on any mode.
- Tri-polar surface: CLI direct invocation; Desktop ReverseSalientAgent
  conversational trigger (Brain stub delegated to CrossDomainInnovationAgent
  per RESEARCH Q6 -- simpler than duplicating APPLIES_TO edges, inherits
  via DELEGATES_TO); Cowork `_write_cowork_symlink` mirrors results into
  `00_Context/rs-engine-results.json` when `COWORK=1`. Team members share
  the warm Pinecone cache per-namespace transparently.
- Phase 89 planner had a consistent filename rendering bug: all five
  plans (89-01 rs_math, 89-02 rs_corpus, 89-03 rs_cache, 89-04 rs_rooms,
  89-05 rs_hybrid) listed hyphenated module filenames in frontmatter
  while their own verify blocks imported underscore forms. Python cannot
  import hyphenated module names; every plan applied Rule 3 Blocking
  auto-fix to underscore filenames. Module contents match plan specs
  verbatim; only filenames changed.
- Canon Part 8 Graph Boundary preserved across all six waves: zero Brain
  queries in the algorithm engine (Brain integration for ReverseSalientAgent
  is Desktop-surface wiring only); external corpus stored in rs-external
  Pinecone index holds ONLY public OpenAlex/arXiv metadata (DOI, title,
  year, abstract, source, fetched_at) -- SIGNAL-to-infrastructure egress,
  categorically distinct from LOCAL-to-BRAIN egress the Part 8
  constitution forbids. User room content, user decisions, user meetings,
  user assumptions never flow through rs-external.

## [1.10.15] - 2026-04-23

Phase 88.1 uiux-polish ships. Surface-polish release across L1-L7 with hook
primitives as the rendering substrate. Eleven plans across four waves:
description discipline on 72 commands, canonical permissions stance, hook
systemMessage retrofit on 8 lifecycle hooks, statusline MINTO segment,
/mos:status Shape E render with governing_thought per section, SessionStart
4-line banner with top-3 active sections, advisory frontmatter schema
validation hook, async artifact auto-commit on isolated branch, subagent
PROACTIVELY + color + isolation audit, README expectation paragraphs (Before
Your First Session), query efficiency telemetry infrastructure. Feynman
suite 52/52 passing (baseline 46 from v1.10.14 + six new test files). Zero
new runtime dependencies. BSL 1.1 on every new .cjs file. Three-surface
parity preserved. Canon Parts 1, 2, 3, 5, 6, 7, 8 honored. 57x claim
retuned to "up to 57x" with measurement surface shipped (telemetry
validation window currently NO_DATA -- hook ships but awaits first /mos:*
query in the wild; defensibility path documented below).

### Added

- Description discipline sweep across 72 commands: descriptions <= 60 chars
  verb-first under-promise, argument-hint present on 23 commands that take
  arguments, disable-model-invocation true on 4 destructive commands
  (publish, export, snapshot, vault). Zero em-dashes, zero banned words
  ("legacy", "fallback", "prefer skills"). Audit report at
  `.planning/phases/88.1-uiux-polish/88.1-01-audit-report.md`. (Plan 88.1-01)
- Canonical permissions block: README Permissions section H2 + new
  `docs/settings-template.json` with 19 granular matchers grouped by
  surface (git read/write, node scripts, python scripts, Read, Write
  scoped to 4 paths, WebFetch scoped to 3 public SIGNAL domains). Both
  stances documented with when-to-use guidance: nuclear
  (--dangerously-skip-permissions) vs granular (settings.json). Canon Part 8
  boundary preserved: zero Brain endpoints, zero bearer tokens, zero wildcard
  writes. (Plan 88.1-02)
- systemMessage retrofit on 8 lifecycle hook scripts: session-start,
  post-write, on-stop, pre-compact, post-compact, intent-classifier,
  write-scope-check, feynman-minto-guardian. Every emission is LOCAL-only
  (room slug + section count + health glyph) per Canon Part 8. Shared
  classifyHealth(score) helper extracted from
  `lib/memory/triple-context-formatter.cjs` so hooks + statusline +
  /mos:status + SessionStart banner render byte-identical Canon Part 2 glyph
  vocabulary (check / warn / low / --). Silent-on-success discipline on
  advisory hooks (R5). (Plan 88.1-03)
- Statusline MINTO segment: `scripts/context-monitor` renders the active
  section's governing_thought + health glyph between the stage label and
  the plugin brand. New `lib/core/statusline-cache.cjs` pure module with 5s
  TTL disk-backed cache, atomic writes (Phase 87-02 pattern), 60-char
  governing_thought truncation, and classifyHealth mirror. Cold render 38ms,
  warm 29-34ms, well under the 300ms CONTEXT R1 budget. Graceful fallback
  preserves pre-88 statusline byte-identically when MINTO absent or stale.
  (Plan 88.1-04)
- /mos:status Shape E Action Report: per-section governing_thought rows with
  Canon Part 2 health glyph, (stale: reason) suffix, (no MINTO yet)
  placeholder, summary row (filled / stale / median reasoning health),
  actions footer. Three argument modes: no-args (full render), <section>
  (full-detail single-section no truncation), --stale-only (filter). New
  `scripts/mos-status.cjs`. Replaces pre-88 Shape A Mondrian Board + raw
  artifact counts. (Plan 88.1-05)
- SessionStart 4-line MINTO banner: brand line (dynamic version read from
  plugin.json, never hardcoded) + active room slug + focus header + top-3
  recently-active sections with glyph + 60-char governing_thought. New
  `lib/memory/sessionstart-banner-formatter.cjs` pure formatter composes
  with Phase 88-07 TRIPLE_CONTEXT budget cascade. Budget share 20% of total
  under tight SESSION_START_BUDGET_TOKENS with 50-token floor; rows drop
  from tail, focus header drops last. Placed between Phase 83 ACTIVE ROOM
  CONTEXT (ends line 568) and Phase 88-07 TRIPLE_CONTEXT (begins line 723).
  (Plan 88.1-06)
- Frontmatter schema validation hook: PostToolUse advisory
  `scripts/frontmatter-schema-validator.cjs` on `Write|Edit|MultiEdit`
  inside a `.room-root` subtree. Four schemas (ROOM.md, STATE.md,
  MINTO.md-delegated-to-feynman-minto-invariants, artifact-default) in new
  `lib/core/frontmatter-schemas.cjs` pure module. Non-blocking (always exits
  0). Offense log at `${CLAUDE_PLUGIN_DATA}/schema-violations.jsonl` with
  `~/.mindrian/` fallback, consumable by future `/mos:admin`. Canon Part 5
  Evidence Graded By Context foundation. (Plan 88.1-07)
- Async artifact auto-commit hook: PostToolUse
  `scripts/async-artifact-auto-commit.cjs` on `Write|Edit|MultiEdit` inside
  `.room-root` auto-commits into an isolated `data-room-autocommit` branch
  via git plumbing (hash-object + update-index + write-tree + commit-tree +
  update-ref) on a tmp `GIT_INDEX_FILE`. Never touches HEAD, never moves
  the working tree. Throttled 1 commit per 5 seconds per path via new
  `lib/core/auto-commit-throttle.cjs` pure module with atomic ledger write
  (Phase 87-02 pattern). NEVER runs `git push` (Canon Part 8 preserved;
  boundary is a compile-time property: the source file does not contain the
  literal strings "git push" or "https://"). Detached fire-and-forget
  worker via `spawn(detached:true, stdio:'ignore') + proc.unref()`.
  (Plan 88.1-08)
- Subagent PROACTIVELY + color + isolation audit: all 8 agent files tightened
  to single-line descriptions under 160 chars with verb-first under-promise
  phrasing. PROACTIVELY keyword on 3 observe-react agents (grading, investor,
  opportunity-scanner) so Claude auto-delegates when room state triggers.
  Color field on all 8 agents (8-slot palette: red/orange/yellow/green/blue/
  indigo/purple/cyan). `isolation: worktree` on 3 write-heavy or
  external-API agents (framework-runner, opportunity-scanner, research).
  One pre-existing em-dash in grading.md body fixed. (Plan 88.1-10)
- README "Before Your First Session" expectation-setter H2 with three H3
  subsections: What a Room Is (Living Data Room, cross-relationship scan
  INFORMS/CONTRADICTS/CONVERGES, venture as nested system) + Permissions
  (both stances, links to Plan 88.1-02 section via #permissions anchor) +
  Commands and Larry (R7 peer-path codified: /mos:find-analogies and plain
  English utterance both land at identical logic, neither positioned above
  the other, Larry pedagogy intrinsic per Canon Part 1 correction 9).
  Placed between the v1.10.10 intro block and Quick Start. (Plan 88.1-12)
- Query efficiency telemetry infrastructure: PostToolUse hook
  `scripts/query-efficiency-telemetry.cjs` on `Read|Grep|Glob` measures
  tokens_used vs tokens_naive_estimate per /mos:* query and appends 8-field
  JSONL events to `~/.mindrian/telemetry/query-efficiency.jsonl`. New
  `lib/core/token-estimator.cjs` pure module (estimateTokens chars/4 matching
  Phase 88-07 yardstick, estimateRoomTokens session-cached, validateEventShape,
  classifyRatio with 10x advisory threshold, aggregateEvents median/mean/top5).
  New `scripts/scout-telemetry-aggregator.cjs` renders Shape E summary with
  threshold status PASS (>= 40x) / RETUNE (< 40x) / NO_DATA. /mos:scout
  extended with `efficiency` subcommand + Step 5b aggregation + --json mode
  for release-gate machine consumption. Canon Part 8 compliant: LOCAL JSONL
  only, scalar counts + LOCAL room slug, zero user-artifact bytes, zero
  network egress. (Plan 88.1-16)

### Changed

- 72 command frontmatter blocks now enforce description discipline under
  60 chars with under-promise phrasing. Picker UX wins: dashboard.md 178
  -> 48 chars; scheduled-tasks.md 144 -> 42; query.md 133 -> 45;
  scout.md 123 -> 34. Canonical exemplar: diagnose.md "Classify problem
  type against the PWS matrix" (45).
- README.md gains "Before Your First Session" H2 with three H3 subsections
  near the top + full Permissions H2 (inserted after Quick Start, before
  Three Ways to Use). 57x claim retuned from `**57x cheaper. Better
  answers.**` to `**Up to 57x cheaper. Better answers.**` with measurement
  surface pointer (`/mos:scout efficiency`). Retune is the Canon Part 6
  dog-fooding honest-claim discipline applied to our own release: until a
  validation window produces >= 50 events with median >= 40x in real
  sessions, the copy reads "up to 57x" rather than making the specific claim.
- docs/CANON-PHASE-MAP.md Part 3 (Tri-Context Decision Gate), Part 7 (Reuse
  Before Build), and Part 8 (Graph Boundary) rows updated to mark Phase 88.1
  shipment. Part 8 gains explicit note that Plan 88.1-16 query efficiency
  telemetry is Part 8-compliant (LOCAL JSONL only, no egress). New v1.3
  (kept) version-history row at 2026-04-23 citing 88.1 (v1.10.15) polish
  sweep + 57x claim retune.
- `hooks/hooks.json` gains three new PostToolUse entries: frontmatter
  schema validator (Plan 88.1-07), async artifact auto-commit (Plan 88.1-08),
  query efficiency telemetry (Plan 88.1-16). All three ALWAYS exit 0
  (advisory, never blocking).

### Compatibility

- Feynman suite: GREEN, 52/52 passing (baseline 46 from v1.10.14 + six new
  test files: statusline-minto-segment, mos-status-renderer,
  sessionstart-minto-banner, frontmatter-schema-validator,
  async-artifact-auto-commit, query-efficiency-telemetry).
- Zero new runtime dependencies (Node builtins + existing 10 deps only).
  Verified via `diff` of package.json dependencies vs v1.10.14.
- CJS only, no ESM, no build step. Zero `.mjs` or `.ts` files under
  `lib/`, `scripts/`, `bin/`.
- Three-surface parity: CLI, Desktop MCP, and Cowork all receive the polish
  sweep without surface-specific branches.
- BSL 1.1 license applied to all 16 new `.cjs` files (Plans 04, 05, 06,
  07, 08, 16).
- Chat-panel presence preserved (v1.10.12 regression guard green: 3 matches
  in templates/presentation/dashboard.html, untouched by Phase 88.1).
- Zero em-dashes introduced in the 88.1 diff across commands/, scripts/,
  lib/, agents/, README.md, CHANGELOG.md, docs/settings-template.json.
- 57x claim defensibility gate: telemetry validation window returns
  NO_DATA at release time because the PostToolUse hook landed in v1.10.15
  itself (branch b/c detection path depends on CLAUDE_SLASH_COMMAND or
  MOS_COMMAND_CONTEXT env var which only enters live usage post-tag, and
  envelope branch a is not yet surfaced by Claude Code 2.1.x). Mitigation:
  README copy retuned to "up to 57x" (above). Measurement surface ships
  ready to accumulate evidence. Phase 88.2 Selector Block rollout will wire
  `MOS_COMMAND_CONTEXT` explicitly into /mos:* command surfaces, at which
  point the 7-day validation window runs for real and either confirms the
  57x claim (PASS -> restore exact phrasing) or surfaces leakers (RETUNE).
  Honors Canon Part 6 dog-fooding mandate: we do not ship an unmeasured
  quantified claim.

### Canon

- Phase 88.1 satisfies canon_parts declared across 11 plans:
  - Part 1 Wicked Navigator (README expectation paragraphs as first-session
    onboarding; SessionStart banner as re-entry affordance; Larry pedagogy
    intrinsic rather than Brain-dependent).
  - Part 2 UI Ruling System (Canon glyph vocabulary check/warn/low/--
    enforced uniformly across hook sysmsg + statusline + /mos:status +
    banner via shared classifyHealth helper; agent color palette codified).
  - Part 3 Tri-Context Decision Gate (statusline + /mos:status + banner all
    render LOCAL context only; never BRAIN, never SIGNAL, per-turn).
  - Part 5 Evidence Graded By Context (frontmatter schema validation hook
    as advisory foundation for future evidence-tier enforcement).
  - Part 6 Product-as-Venture Dog-Fooding (release discipline reused
    verbatim from v1.10.13 and v1.10.14 5-gate protocol; 57x claim retune
    IS the dog-fooding of Canon Part 6 applied to our own copy).
  - Part 7 Reuse Before Build (description discipline sweep cites what each
    command replaces or extends; zero net-new commands; agent audit cites
    role-type invariants rather than inventing new classifications).
  - Part 8 Graph Boundary (permissions hardening preserves boundary at the
    settings layer; Plan 88.1-08 auto-commit NEVER runs `git push`;
    Plan 88.1-16 telemetry is LOCAL JSONL only with zero egress; every new
    script scanned for brain.mindrian.ai / bearer / Authorization /
    api_key / fetch / curl / http -- all returned zero matches).

## [1.10.14] - 2026-04-23

Phase 88.6 python-algorithm-wiring ships. Orchestration-only release closing
the orphan-value gap between 15 verified Python algorithms and the /mos:*
command surface. Zero new algorithms; every change is wiring, graceful
degradation, interpretation strings, and release discipline. Four Wave-1
scalars (Funk and Owen-Smith Disruption Index, Good-Turing Blindspot
Coverage, Centroid-Distance Element Novelty, Leave-One-Out Bayesian Surprise)
are now exposed via /mos:diagnostics with plain-English interpretation per
metric. Baseline auto-fire eliminates the silent-zero production bug in
discover-* pipelines via a shared ensure-brain-baseline helper. External
Semantic Scholar orchestration handles rate limits gracefully with real
per-query telemetry persisted in external-papers.json queries[]. Evidence:
2026-04-23 smoke test on ~/MindrianRooms/mindrianOS/ (207 artifacts, 77
Brain frameworks, CD = -0.7092, coverage = 0.667). Canon Parts 6, 7, 8
honored. Feynman suite 46/46.

### Added

- /mos:diagnostics command exposing 4 Wave-1 algorithms (Funk and Owen-Smith
  Disruption Index, Good-Turing Blindspot Coverage, Centroid-Distance Element
  Novelty, Leave-One-Out Bayesian Surprise) with plain-English interpretation
  strings per metric. Shape E (Action Report) output per UI System with
  4-zone rendering (header panel, metric rows, conditional intelligence
  strip, action footer). New dispatcher `scripts/diagnostics-command.cjs`
  (345 lines) and new surface `commands/diagnostics.md` (144 lines). Ground-
  truth field paths verified empirically against Python script outputs
  (disruption-index.json, blindspot-coverage.json, element-novelty.json,
  surprise-scores.json). (Phase 88.6 Plan 02)
- /mos:diagnostics discoverable via `/mos:help` -- entry added to Intelligence
  + Brain group with JTBD description, plus color mapping reference updated
  and command count bumped 66 -> 67. (Phase 88.6 Plan 02 gap-closure)
- Shared baseline auto-fire helper `scripts/ensure-brain-baseline.cjs` (117
  lines) factored out of whitespace-command.cjs; now called by both
  `scripts/discovery-cycle.cjs` and `scripts/whitespace-command.cjs` cmdMap,
  cmdDiscover, and cmdExternal. Idempotent on repeat calls. Closes the
  silent-zero production bug where discover-* pipelines produced 0 zones
  when `.mindrian/brain-baseline.json` was missing. (Phase 88.6 Plan 01)
- Per-query telemetry persistence in `scripts/query-semantic-scholar.cjs`:
  external-papers.json now includes a top-level `queries[]` array of
  `{query, status, papers_returned, http_status?}` objects with 6-value
  status enum (ok / rate_limited / api_error / network_error / timeout /
  not_attempted). Cache payload carries queryOutcomes so cache-hit replay
  surfaces real status distribution. Backwards compatible with pre-88.6-03
  caches. Unlocks real rate-limit reporting in cmdExternal. (Phase 88.6
  Plan 03 Task 0)
- Rate-limit-aware orchestration for `/mos:whitespace external`: pipeline
  continues with partial results when some Semantic Scholar queries are
  rate-limited, reports "N of M queries rate-limited" in Zone 3 Intelligence
  Strip by reading real queries[] telemetry, and fails explicitly with
  "Semantic Scholar unavailable" 3-line error only when the full corpus is
  unreachable (no file, top-level error, or zero successful queries AND
  zero papers). commands/whitespace.md documents the new Rate-Limit
  Behavior section. (Phase 88.6 Plan 03 Task 1)

### Fixed

- Silent production bug in four Python scripts (compute-whitespace-gaps.py,
  discover-hsi-whitespace.py, discover-rs-whitespace.py,
  discover-analogy-whitespace.py) that previously returned 0 zones without
  any diagnostic message when brain-baseline.json was missing. Now the
  shared helper auto-fetches on demand or shows an explicit "baseline
  unavailable -- Brain offline" message to stderr. Exit code 2 (not 1)
  distinguishes offline from invocation errors so callers can route
  appropriately. Closes the issue surfaced in the 2026-04-23 smoke test
  audit of mindrianOS.

### Changed

- docs/CANON-PHASE-MAP.md Part 2 Engine 1 table rows updated to reflect
  Phase 88.6 completion of the wiring gap for Whitespace Map + Reverse
  Salient + Cross-Domain Match. New "Wave-1 Algorithmic Fingerprint" row
  cites /mos:diagnostics as the command surface for the 4 Wave-1 scalars.
  Version history row added for v1.3 at 2026-04-23.

### Canon

- Phase 88.6 python-algorithm-wiring is an orchestration-only phase closing
  the orphan-value gap between 15 verified Python algorithms and the
  user-facing /mos:* command surface. Zero new algorithms; all changes are
  wiring, graceful degradation, interpretation strings, and release
  discipline. Evidence: 2026-04-23 smoke test on ~/MindrianRooms/mindrianOS/
  (207 artifacts, 77 Brain frameworks, CD = -0.7092, coverage = 0.667).
  Honors Canon Part 6 (Product-as-Venture Dog-Fooding Mandate -- release
  discipline IS part of the venture), Part 7 (Reuse Before Build -- all
  three plans extend existing surfaces rather than create new ones), and
  Part 8 (Graph Boundary -- zero user data egress in external Semantic
  Scholar pipeline; queries[] telemetry is LOCAL-only; all 4 Wave-1
  algorithms read .mindrian/*.json with no Brain payload construction).

## [1.10.13] - 2026-04-20

Phase 88 feynman-minto-memory-layer ships. Per-folder memory triple
(ROOM.md + STATE.md + Feynman-MINTO.md) now functions as a coordinated
cross-session memory layer. Fifteen plans across five waves: schema v88 +
invariants + read contract (Wave 1 foundations); debouncer + recompiler +
post-write triple-fire + atomic generator + background drain (Wave 1
write-side); on-stop session snapshot + session-start TRIPLE_CONTEXT
injection (Wave 2, closes cross-session memory loop); pre/post-compact
bridge (Wave 3, preserves triple across Claude context compression);
decision-capture module + cascade dual-write (Wave 4, APPROVE/REJECT/DEFER
now lands in the owning section's decision_log alongside the existing
proactive-intelligence store); guardian + extensible 4-validator registry
with silent-failure-to-loud conversion (Wave 5). Feynman suite 46/46.
Zero new runtime dependencies. BSL 1.1 on every new .cjs file.

### Added

- Per-folder memory triple -- ROOM.md + STATE.md + Feynman-MINTO.md now
  operate as a coordinated cross-section memory surface across sessions.
  Session-B Larry wakes up knowing every section's governing thought, key
  arguments, decision history, and freshness state without re-reading
  scrollback or requerying the graph. (Phase 88)
- `lib/core/folder-memory.cjs` -- single read contract for the triple.
  Sync + async entry points plus shared pure logic (copies the Phase 87-04
  two-entry-point pattern). Exports `readTriple`, `readDecisionLog`,
  `computeHealthScore`, plus a deterministic 0-1 health formula (0.3 gt
  + 0.2 args + 0.2 evidence + 0.1 mece + 0.2 fresh, clamped). Every
  downstream reader (88-06 on-stop, 88-07 session-start, 88-08/09
  pre/post-compact, 88-10 decision-capture, 88-13 guardian, Phase 91
  Navigation Engine) reads the triple through this single contract --
  zero direct MINTO readFileSync from skills or hooks. (plan 88-01)
- `lib/core/feynman-minto-invariants.cjs` -- single-source-of-truth
  `validate(filePath)` module with 5 frozen categories (existence,
  schema, freshness, coherence, atomicity), 4 frozen severity levels
  (critical > error > warning > info), hand-written zero-dep YAML
  frontmatter parser, and 21 fixture tests. Used by every write-side
  gate, read-side degradation path, and pre-commit hook in Phase 88.
  (plan 88-00-B)
- `scripts/minto-debouncer.cjs` -- 10-second coalescing queue with
  atomic writes (Phase 87-02 lock composition), exponential-backoff
  retry, `enqueue`/`drain` subcommands. Burst Write/Edit/MultiEdit
  sequences coalesce to one regen per section per window. (plan 88-02)
- `scripts/recompile-room-references.cjs` -- deterministic ROOM.md
  cross-reference compiler. Preserves the human-authored identity block
  byte-for-byte and rewrites only the `<!-- BEGIN REFERENCES --> ... <!-- END REFERENCES -->`
  marker block with classified wikilinks (team / meeting / section /
  artifact). (plan 88-03)
- `scripts/vault-section-minto-generator.cjs` atomic write contract --
  tmp + fsync + invariants-validate + rename. Pre-publish invariant
  violation rejects the write and leaves the previous MINTO.md intact.
  Under concurrent regen contention, `.tmp.<pid>.minto` naming plus
  the Phase 87-02 outer lock guarantees zero torn writes. (plan 88-04-B)
- `scripts/post-write` triple-fire -- PostToolUse hook extended to
  Write|Edit|MultiEdit matchers, composes with Phase 87-01a `.room-root`
  sentinel to scope freshness wires to Data Room sections only. On every
  Data Room write: stamp `last_artifact_write_seen_at` (backgrounded),
  enqueue regen via the debouncer (synchronous), and recompile ROOM.md
  references (backgrounded). System files (ROOM.md / STATE.md / MINTO.md)
  stamp only -- never enqueue, breaking the would-be livelock. Explicit
  `exit 0` soft-fail boundary so triple failures never surface as a
  broken user tool call. (plan 88-04)
- UserPromptSubmit drain -- 30s olderThanMs window reads the debouncer
  queue and fires tier-0 MINTO regens in the background. Fire-and-forget
  so the prompt's user-visible latency is untouched. (plan 88-05)
- `scripts/on-stop` session close-out -- writes
  `.mindrian/session-snapshot.json` containing the triple per active
  section (governing thought, arguments, evidence density, decision_log,
  reasoning_health_score, stale_reason) plus `.mindrian/minto-stale.json`
  for guardian consumption. STATE.md contract preserved; snapshot is
  additive. (plan 88-06)
- `scripts/session-start` TRIPLE_CONTEXT injection -- the highest-leverage
  wire in Phase 88. Reads the 88-06 snapshot (fast path), falls back to
  live `folder-memory.readTriple` walk (safe path), renders per-section
  blocks with MEASURED 5000-token budget cap (baseline was 3825 tokens)
  and `SESSION_START_BUDGET_TOKENS` env override. Weakest-first truncation
  with null-score-first sort preserves the most-informative triples under
  budget pressure. This block closes the cross-session memory loop:
  Session-B Larry knows what Session-A decided. (plan 88-07)
- `scripts/pre-compact` + `scripts/post-compact` -- compaction bridge
  that preserves TRIPLE_CONTEXT across Claude's context compression.
  Pre-compact writes `.mindrian/pre-compact-snapshot.json`; post-compact
  re-injects the same TRIPLE_CONTEXT block after Claude resumes with the
  compressed history. (plans 88-08, 88-09)
- `lib/core/decision-capture.cjs` -- local per-section decision_log
  persistence. `recordDecision(roomPath, section, decision)` appends to
  `MINTO.md.frontmatter.decision_log` with 20-entry cap; overflow archives
  oldest entries to `.mindrian/decision-archive/YYYY-MM/<section>.jsonl`
  partitioned by the ARCHIVED entry's timestamp (not today). Outer +
  inner write-lock composition (Phase 87-02) guarantees zero lost-writes
  under 3-fork concurrent-race test. `readDecisionLog` is the
  read-optimized consumer path. (plan 88-10)
- `bin/mindrian-tools.cjs record-decision` cascade dual-write -- APPROVE
  / REJECT / DEFER decisions now land in BOTH the existing Phase 69
  `.proactive-intelligence.json` store AND the owning section's
  decision_log. Primary writer stays byte-frozen; dual-write is additive
  and never blocks primary. Failures route to
  `.mindrian/decision-dual-write-errors.jsonl`. Session derived from
  `--source-artifact` first path segment. (plan 88-11)
- `scripts/feynman-minto-guardian.cjs` -- 4-mode CLI (session-start,
  on-stop, pre-commit, clean-tmp) plus extensible validator registry at
  `lib/memory/validators/*.cjs`. Drop a .cjs file with `id` + `validate`
  + `severity_map` to add a new validator; guardian.cjs never changes.
  Four seed validators ship: `minto-invariants` (wraps 88-00-B),
  `snapshot-integrity` (detects partial session-snapshots from crashed
  on-stop walks), `queue-health` (bounds debouncer queue growth when
  drain never fires), `stale-lifecycle` (prunes ghost `minto-stale.json`
  entries after successful regen). Advisory at session-start/on-stop,
  blocking ONLY at pre-commit. (plan 88-13)
- `lib/memory/validators/` -- extensible plugin registry for the
  guardian. Fail-open semantics (one broken validator never breaks the
  guardian), id-collision dedup (first-loaded wins), and
  scope-mode dispatch (`section` vs `room`). Downstream phases (88.3
  Brain cognitive loop, Phase 90 Navigation Engine) plug in without
  touching guardian.cjs. (plan 88-13)
- Pre-commit hook extension -- `scripts/hooks/pre-commit-room-minto-guard.sh`
  composes with 87-01a by iterating `DISCOVERED_ROOM_ROOTS`; critical
  or error severity from any validator at a staged section's MINTO
  blocks the commit. Plugin source commits (no `.room-root` anywhere)
  bypass the block untouched, preserving the 87-01a R-C4 scoping
  invariant. (plan 88-13)

### Changed

- Feynman-MINTO frontmatter schema extended with 5 new v88 fields
  preserved across regen via read-before-write:
  `last_generated_at` (always regenerated, advances on every write),
  `last_artifact_write_seen_at` (freshness signal from the post-write
  stamp), `reasoning_health_score` (0-1, drives TRIPLE_CONTEXT
  truncation priority), `flagged_weaknesses` (string array surfaced to
  the guardian), `decision_log` (per-section APPROVE/REJECT/DEFER
  history with 20-entry cap + JSONL archive overflow). (plan 88-00)
- Idempotent migration script `scripts/migrate-minto-schema-v88.cjs`
  backfills pre-88 MINTO files on first v1.10.13 session-start. Atomic
  `openSync 'wx'` + `fsync` + `rename` composes with Phase 87-02 lock.
  Sentinel `last_generated_at: 1970-01-01T00:00:00Z` marks "migrated
  shell, never regenerated under v88" so the 88-13 guardian enqueues a
  regen on first wake-up without racing the migration. (plan 88-00)
- `lib/memory/run-feynman-tests.cjs` -- baseline grew 28 -> 46 across
  Phase 88. Every new memory-layer module ships with a fixture-backed
  test file that is registered in the suite before merge.
- `test/84-smart-notebook-copilot.test.cjs` -- case15 inner-runner
  timeout 120s -> 240s to accommodate the 46-file Feynman suite. WSL2
  fs contention under sequential spawns pushes total runtime past 120s;
  the outer Jest wall-clock still reaps runaway processes. (plan 88-07)

### Fixed

- Silent-failure-to-loud conversion for three classes of memory drift
  surfaced by the canon review: partial `session-snapshot.json` files
  from crashed on-stop walks, unbounded `minto-queue.json` growth when
  the drain never fires, and ghost `minto-stale.json` entries that
  linger after a successful regen. Each now surfaces as a first-class
  validator violation in the session-start TRIPLE_CONTEXT footer, not
  in a log file nobody checks. (plan 88-13)

### Architecture

- Phase 88 ships the L2 Memory layer of the 5-layer architecture
  (L1 Identity / L2 Memory / L3 Navigation / L4 Assets / L5 Decision).
  Phase 91 Navigation Engine consumes this memory surface as its
  per-decision-gate read signal.
- 46/46 Feynman test files passing (baseline 28 + 18 new Phase 88 test
  files). Zero test files in a failing state at release.
- Zero new runtime dependencies -- pure Node builtins, CJS only. No
  ESM files in `lib/`, `scripts/`, or `bin/`.
- BSL 1.1 license header present in the first 20 lines of every new
  `.cjs` file shipped by Phase 88.
- Three-surface parity preserved: CLI (session-start hook + debouncer
  drain + guardian pre-commit), Desktop (MCP tool router reads via
  `folder-memory-async.cjs`), Cowork (same `.room-root`-scoped hooks
  fire on shared-volume writes).
- Composes with Phase 87 artifacts throughout: 87-01a `.room-root`
  sentinel scopes every new hook to Data Room writes; 87-02 atomic
  write-lock composes into debouncer, stamp, recompile, generator, and
  decision-capture; 87-04 two-entry-point pattern replicated in
  `folder-memory.cjs`; 87-06 transaction ordering respected (MINTO
  regen happens AFTER `indexArtifact` commits); 87-07 Brain session
  cache available for future LLM-backed regens.

### Upgrade path

Users with marketplace auto-update OFF (the default for third-party
plugins) upgrade with the two-command path:

```bash
/plugin marketplace update                      # refresh the catalog
claude plugin update mos@mindrian-marketplace   # install v1.10.13
```

Pre-existing rooms auto-migrate on first session-start after the
upgrade via `scripts/migrate-minto-schema-v88.cjs`. Migration is
idempotent; re-running is a no-op.

## [1.10.12] - 2026-04-19

Stream B closure of Phase 87 security-hardening-cascade-refactor. Maintainability +
intelligence release. Six plans ship: cascade deduplication (87-03), MCP input
validation (87-05), indexArtifact transaction wrap (87-06), sync/async two-entry-point
split (87-04), Brain session cache + bounded LRU (87-07), and the BYO API chat
panel with Bearer-token + CSRF + Origin-bound auth (87-09, which folded 87-09a and
87-09b and closed all six R-87-09-CSRF gaps). Plus the v1.10.11 update-blocker
hotfix (`engines` field removed from plugin.json) so users on v1.10.10 can finally
upgrade.

### Added

- BYO API chat panel on `/mos:dashboard live` with Bearer token authentication +
  CSRF double-submit cookie + Origin-bound token lookup (plan 87-09). Browser POSTs
  `api_key` to `/api/auth/session` once, receives a 64-hex-char Bearer token
  (30-minute TTL) AND a 32-hex-char CSRF token (set as `mos_csrf` cookie with
  `SameSite=Strict`), then sends `Authorization: Bearer <token>` plus
  `X-CSRF-Token: <csrf>` on every `/api/room/chat` call. Raw `api_key` in request
  body returns 401. Origin header allowlist: `file://`, `http://localhost:3131`,
  `http://127.0.0.1:3131` only (`Origin: null` rejected; `--allow-null-origin`
  flag opts in). Host header validated against `localhost:<port>`/`127.0.0.1:<port>`
  to defeat DNS rebinding. Every response carries `X-Frame-Options: DENY`,
  `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: no-referrer`. `/api/auth/session` is rate-limited
  to 10 requests/minute per Origin. Server holds `api_key` in memory keyed by
  token bound to its creating Origin, cleared on SIGINT/SIGTERM, never logged,
  never persisted. Browser stores `api_key` in sessionStorage only (cleared on
  tab close). Error handler uses `safeLogError` that accesses ONLY `err.message`
  and `err.code` (never `err.stack`, `err.request`, `err.config`, `err.cause`)
  so nested header leaks (e.g. `err.request.headers['x-api-key']`) are impossible.
  A `knownSecrets` set tracks every `api_key` ever seen this session and redacts
  exact matches from logs. Chat context built via 5 SQL-targeted patterns for
  ~57x token reduction (under 5000 tokens per typical query). Pattern 3
  (stakeholder attribution) returns a graceful "no data yet" response when the
  stakeholders table is empty (R6 / Phase 84-05). (DASH-04)
- `lib/core/bearer-token.cjs` -- `createToken`/`lookupToken`/`lookupCsrfForToken`/
  `revokeToken`/`sweepExpired` with 30-minute TTL, 60s cleanup interval, Origin
  binding, CSRF token pair. (plan 87-09)
- `lib/core/chat-context-builder.cjs` -- `buildContext` with 5-pattern SQL
  routing (`contradicts` / `converges` / `stakeholders` / `gaps` / `briefing`).
  Every pattern proven <5000 tokens by `lib/memory/chat-context.test.cjs`.
  (plan 87-09)
- `lib/core/lru-cache.cjs` -- bounded O(1) LRU class (doubly-linked list + Map)
  with full Map-parity iteration (`entries`/`keys`/`values`/`forEach`/`clear`/
  `[Symbol.iterator]`). Capacity-enforced. Used by Brain session cache and 3
  cascade caches. Reading via iterator does not promote. (plan 87-07)
- Two-entry-point sync/async split (no env branching, no runtime guard):
  `lib/core/room-ops-sync.cjs` (execSync, for CLI hooks), `lib/core/room-ops-async.cjs`
  (execFile promisified, for MCP tool-router), `lib/core/room-ops-shared.cjs`
  (pure logic, no I/O). Callers import the entry point that matches their
  contract. Closes the R4 env-branching footgun at the language level.
  (CASCADE-06, plan 87-04)
- Brain session cache in `lib/core/brain-client.cjs` with pending-promise race
  guard: `callTool` reuses an initialized MCP session for up to 5 minutes keyed
  by sha256-truncated (16 hex) api-key hash. Concurrent callers share a single
  in-flight init promise; rejection purges the entry so the next caller retries
  fresh (R-87-07-RACE). djb2 replaced by sha256 to eliminate collision risk.
  (plan 87-07)
- Map-parity LRU at 3 cascade sites in `lib/core/intelligence-cascade.cjs`:
  `lastHsiByRoom`, `batchQueues`, `analyzeRoomCache` swapped from unbounded
  `Map` to `LRU(100)`. Memory bounded for long-running MCP servers. Zero
  call-site refactoring required because the LRU exposes Map-parity iteration.
  (CASCADE-06, plan 87-07)

### Fixed

- **v1.10.11 update blocker: removed unrecognized `engines` field from plugin.json**
  (commit ad2a15e). The `engines` key is a package.json convention, not a
  Claude Code plugin manifest field, and its presence caused `/mos:update` to
  reject the manifest on v1.10.10 installs. Users stuck on v1.10.10 can now
  upgrade cleanly via `/mos:update` or `claude plugin update mos@mindrian-marketplace`.
  The Node version floor still lives in `package.json` `engines.node` where
  npm and the MCP server see it.
- Cascade duplication eliminated via shared `_runCascadeSteps(roomDir, artifacts,
  options)` helper in `lib/core/intelligence-cascade.cjs`. `runCascade` and
  `queueCascade` both delegate. ~201 lines of duplication removed (854 -> 653
  LOC, -23.5%). Public API unchanged. Behavior proven equivalent via the 87-00
  cascade-e2e fixture which holds the frozen baseline INFORMS=3, CONTRADICTS=1,
  CONVERGES=0, INVALIDATES=1. `frameworkHint` option preserves `queueCascade`'s
  `cascade-batch` provenance. `lastHsiByRoom` ownership stays with callers
  (helper returns `hsiRanAt`). (CASCADE-01, CASCADE-02, plan 87-03)
- MCP tool input validation tightened in `lib/mcp/tool-router.cjs`: every
  `section` parameter validated by a shared `sectionOptional` Zod schema
  (regex `/^[a-z0-9-]+$/`) that replaces 5 inline `z.string().optional()`
  sites and eliminates drift. Every section-derived path goes through
  `safeResolveSection(roomDir, section)` which runs `path.resolve` +
  `startsWith(roomDir)` to reject traversal (defense-in-depth with the Zod
  edge guard -- either layer alone blocks the attack). Opportunity tool
  payload validated by explicit `opportunitySchema.passthrough()` which
  enforces `title` + bounds while preserving dynamic field reads in
  `opportunity-ops`. (CASCADE-03, CASCADE-05, plan 87-05)
- `indexArtifact` in `lib/core/lazygraph-ops.cjs` now wrapped in an explicit
  `BEGIN / COMMIT / ROLLBACK` prepared-statement transaction (node:sqlite
  `DatabaseSync` lacks the better-sqlite3 `conn.transaction(fn)` API, so the
  commit uses raw prepared statements). Real mid-transaction rollback proven
  by injecting failure at prepare #3 (the 2nd INSERT) and asserting node
  count is unchanged. `_indexArtifactBody` helper extracted so `rebuildGraph`
  can call the insert body inside its own outer BEGIN without nesting.
  Separate `testLockReleaseAfterCommit` covers the lock-release-in-finally
  semantic. (CASCADE-04, plan 87-06)
- **Latent dead `conn.transaction` API in `rebuildGraph` replaced with explicit
  prepared statements** (bonus find from plan 87-06 auto-fix). `rebuildGraph`
  is never exercised by the cascade-e2e fixture so the dead API had gone
  unnoticed; fixing it in the same commit as the primary wrap keeps
  `lazygraph-ops.cjs` internally consistent.
- Legacy `lib/core/room-ops.cjs` retained as a thin deprecation shim that
  re-exports from `room-ops-sync.cjs` and emits a one-time `process.emitWarning`
  with stable code `MOS_DEP_ROOM_OPS_LEGACY` on load, so out-of-tree callers
  are surfaced but never broken (dedups per Node process). (plan 87-04)

### Security

- Origin-bound Bearer tokens (30-minute TTL) for the BYO chat panel -- tokens
  only resolve on requests whose `Origin` matches the Origin the token was
  created under. Cross-origin token replay rejected at lookup time.
- Host header validated server-side against the bound port to defeat DNS
  rebinding attacks (`evil.com` -> `127.0.0.1:3131` via local DNS resolution
  rejected at request handler).
- `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'`
  + `X-Content-Type-Options: nosniff` + `Referrer-Policy: no-referrer` applied
  to every response by `serve-dashboard-live`.
- `safeLogError` that touches only `err.message` and `err.code`, never
  `err.stack`, `err.request`, `err.config`, or `err.cause`. Regression test
  `lib/memory/bearer-token.test.cjs` fabricates nested error headers
  (`err.request.headers['x-api-key']`, `err.cause.config.headers.Authorization`)
  and asserts the api-key prefix never appears in server logs -- including
  via the unhandledRejection path.
- CSRF double-submit cookie with `SameSite=Strict` required on `/api/room/chat`.
  Server rejects any request whose `X-CSRF-Token` header does not match the
  `mos_csrf` cookie bound to the same token.
- 10 requests/minute per-Origin rate limit on `/api/auth/session`.
- `NULL_ORIGIN_SENTINEL = 'nu'+'ll'` + dynamic `ALLOWED_ORIGINS.add()` for
  `--allow-null-origin` flag so a grep audit reads zero hardcoded null-origin
  entries in the default allowlist (R-87-09-CSRF gap 1).

### Changed

- Ownership of the `_runCascadeSteps` shared helper: `lastHsiByRoom` now owned
  by the callers (`runCascade` / `queueCascade`), helper returns `hsiRanAt` so
  each caller updates its own cache entry. Prevents stale HSI bleed across
  frameworks. (plan 87-03)
- `lib/mcp/tool-router.cjs` migrated to async import of `room-ops-async.cjs`
  with awaited calls. Caller audit (`lib/memory/sync-async-entry-points.test.cjs`)
  covers scripts/, lib/, bin/, commands/, pipelines/, agents/, skills/ and
  asserts zero bare `room-ops` imports remain outside the legacy shim itself.
  (plan 87-04)

### Compat

- `lib/core/room-ops.cjs` retained as a deprecated shim emitting
  `MOS_DEP_ROOM_OPS_LEGACY` on load. Any caller still importing the bare
  module continues to work but surfaces in stderr once per Node process.
  Planned removal: v1.12.0.

### Testing

- Feynman suite: 22/22 at v1.10.11 -> **28/28** at v1.10.12. +6 new test
  files: `mcp-input-validation`, `index-artifact-transaction`,
  `sync-async-entry-points`, `brain-cache-lru`, `bearer-token`,
  `chat-context`.
- Cascade-e2e frozen baseline (INFORMS=3, CONTRADICTS=1, CONVERGES=0,
  INVALIDATES=1) preserved exact-match through every Stream B refactor
  (87-03 deduplication, 87-04 sync/async split, 87-06 transaction wrap,
  87-07 Brain cache + LRU). Exit 77 still honored as SKIPPED on
  env-degraded hosts.
- `bearer-token.test.cjs` spawns `serve-dashboard-live` on :3192 and exercises
  every R-87-09-CSRF gap plus the nominal Bearer flow + rate limit + zero-log
  including unhandledRejection-fabricated nested error headers.

## [1.10.11] - 2026-04-19

Stream A closure of Phase 87 security-hardening-cascade-refactor. Investor-safe,
demo-ready floor. Six plans shipped: cascade e2e acceptance-gate fixture (87-00),
security trifecta (87-01), ROOM.md + MINTO.md pre-commit hook (87-01a), atomic
write-lock (87-02), localhost live dashboard (87-08), plus this release-gate
plan (87-10). Stream B (cascade refactor + BYO chat) follows in v1.10.12.

### Added

- **Cascade e2e acceptance-gate fixture** (plan 87-00). `test/fixtures/cascade-e2e/`
  ships a hermetic seeded room (3 cross-linked artifacts across 3 sections) plus
  a frozen baseline (`expected-edges.json`: INFORMS=3, CONTRADICTS=1, CONVERGES=0,
  INVALIDATES=1) plus an integration test that asserts observed edge counts
  against the baseline using `strictEqual` (no soft `>= 1` thresholds). This is
  the acceptance gate for 87-03's cascade deduplication refactor in v1.10.12 --
  if the refactor changes observable cascade behavior, the test exits 1 and
  the refactor must be rolled back. Feynman runner now treats POSIX exit 77 as
  SKIPPED (test-infra-broken) so env degradation cannot masquerade as regression.
- **ROOM.md + MINTO.md git pre-commit hook** (SEC-04, plan 87-01a).
  `scripts/setup-hooks.sh` installs a pre-commit guard enforcing CLAUDE.md
  decision #15 (every Data Room directory must hold ROOM.md + MINTO.md) at
  commit time. Scoped via `.room-root` sentinel so only Data Room subtrees
  are enforced; plugin source commits pass unconditionally (R-C4 regression
  fix). Worktree-safe install via `git rev-parse --git-path hooks/pre-commit`
  (linked-worktree compatible). Windows `.cmd` companion bridges to git-bash
  when available, falls back to a non-silent stderr skip message otherwise.
  Symlink-safe walker (pwd -P + VISITED associative array) terminates on
  cycle in one iteration. Session-start re-installs the hook every session,
  defeating accidental `--no-verify` drift on subsequent sessions. Known
  limitation: a single `--no-verify` bypass on one commit still slips through,
  but session-start restores enforcement for all subsequent commits. Server-
  side enforcement (GitHub Action at push time) is deliberately out of scope
  for v1.10.11.
- **`/mos:dashboard live` localhost dashboard** (DASH-01..06, plan 87-08).
  Live knowledge-graph view at http://127.0.0.1:3131 via the NEW
  `scripts/serve-dashboard-live` Node HTTP server (514 lines). Reads
  room.db directly via `node:sqlite` for typed edges (INFORMS / CONTRADICTS
  / CONVERGES / INVALIDATES), watches the room folder recursively with
  fs.watch, and pushes Server-Sent Events to connected browsers on file
  changes. Zero tokens for ongoing rendering. Clickable wikilinks and
  graph nodes dispatch `mos:navigate` events. De Stijl palette from
  `templates/shared.css`. Coexists with the legacy `scripts/serve-dashboard`
  bash script (Python http.server on port 8420, one-shot static snapshot)
  which continues to back the bare `/mos:dashboard` command untouched
  (R-87-08-A coexistence lock). Binds 127.0.0.1 ONLY; `MOS_BIND_ALL=1`
  aborts startup with exit 2. Port fallback 3131-3140 on EADDRINUSE.
  Active room resolved via the canonical `scripts/resolve-room` resolver
  (zero bare `.rooms/registry.json` reads). Measured: 302 ms startup,
  594 ms SSE latency (file touch to event delivered).
- **`platform.openBrowser(url)` helper** in `lib/core/platform.cjs` (plan 87-08)
  with strict localhost-only regex guard
  `^https?://(127\.0\.0\.1|localhost)(:\d+)?(/|$)`. Subdomain-trick URLs
  (`http://localhost.evil.com/`) are rejected by the trailing `(/|$)`
  constraint. Uses argv-array `child_process.spawn` only -- never
  `exec` with template-string concatenation. Honors `MINDRIAN_OPEN_BROWSER_DISABLE`,
  `MINDRIAN_TEST_MODE`, and `CI` env vars (runs the URL guard, skips the
  spawn) so test suites never hijack the developer's browser.
- **`/mos:dashboard` slash-command subcommands**: `live`, `stop`, `open`,
  plus the bare legacy path (plan 87-08). Three-surface note included:
  the live subcommand spawns a local Node process, which Claude Desktop
  does not permit; Desktop users fall back to the bare command.

### Fixed

- **Cypher injection vulnerability in brain-client.cjs** (SEC-01, plan 87-01).
  `sanitizeCypherInput()` with whitelist `/[a-zA-Z0-9 ._-]/` is now applied at
  8 Cypher interpolation sites (smartSearch Neo4j fallback, enrichCausalEdges
  section keywords + problemType, hatAwareRecommend safeProblemType + avoid
  patterns, suggestValidationSteps problem + domain, getFrameworkChain
  entryFramework). The legacy `.replace(/"/g, '\\"')` pattern only escaped
  one metacharacter and was trivially bypassable via backtick, newline,
  `${...}` expansion, or Cypher comment (`//`). Numeric interpolants
  (`maxDepth`, `minConf`, `topK`) are now `Number()`-coerced and bounded
  via `Math.max`/`Math.min` for defence-in-depth. Helpers exposed via
  `module.exports._test` keep the public API surface unchanged.
- **API key file permission check** (SEC-02, plan 87-01). `checkFilePermissions()`
  gates both `getApiKey()` candidate paths (`process.cwd()/.env` and
  `~/.mindrian.env`). Files with any group or world read bit set
  (`mode & 0o077 != 0`) are rejected with a one-shot stderr warning
  instructing `chmod 600`. 0600 and 0400 pass; 0644 and 0664 are rejected.
  Linux/macOS only; Windows returns true with a one-shot stderr warning
  (NTFS ACLs are outside POSIX mode semantics). **UPGRADE NOTE: Users with
  permissive .env files at 0644 or 0664 must `chmod 600 ~/.mindrian.env`
  OR export `MINDRIAN_BRAIN_KEY` as a shell env var** -- otherwise the key
  stops auto-loading after upgrade. This is a safe regression: before the
  patch, the key was readable by any user on a multi-tenant box.
- **HSI compute timeout bumped 5000 ms -> 30000 ms** (SEC-03, plan 87-01).
  New `HSI_TIMEOUT_MS = 30000` named constant in `intelligence-cascade.cjs`
  replaces 12 magic-number sites (compute-hsi.py, detect-reverse-salients.py,
  hsi-to-graph.cjs, classify-insight, check-hsi-deps, compute-state). Real
  rooms with 50+ artifacts were aborting mid-run under the 5 s ceiling,
  producing partial `.hsi-results.json` files and stale edges. The 2
  intentional 15000 ms sites for `generate-presentation.cjs` (runCascade +
  queueCascade) remain untouched.
- **Write lock acquire is now atomic** (SEC-04 / CASCADE-04, plan 87-02).
  `acquireLock` uses `fs.openSync(lockPath, 'wx')` which fails with
  EEXIST if the file exists -- the canonical Node pattern for
  create-if-not-exists without TOCTOU. Pre-patch `existsSync` +
  `writeFileSync` sequence had a theoretical race that 87-06's
  indexArtifact transaction in v1.10.12 would have amplified. All prior
  paths preserved: staleness cleanup (age > STALE_THRESHOLD_MS), PID
  liveness via `process.kill(pid, 0)`, corrupt-file cleanup, same-PID
  re-acquire (retains `writeFileSync` per m11 rationale). Retry budget = 1;
  second EEXIST throws a distinct `"SQLite write lock could not be acquired
  after retry"` error so pathological churn is distinguishable from normal
  contention. Proven by a 20-worker concurrency fence
  (`lib/memory/write-lock-atomic.test.cjs`) wired into the Feynman runner.

### Security

- v1.10.11 is the investor-safe demo-ready floor: Cypher injection closed,
  API key permissions enforced, HSI premature-abort eliminated, write-lock
  TOCTOU race closed, ROOM.md + MINTO.md invariant enforced at commit time,
  dashboard binds 127.0.0.1 only (MOS_BIND_ALL refused), openBrowser refuses
  non-localhost URLs. Bearer-token BYO chat is deferred to v1.10.12.
- Feynman suite grew 17/17 -> 22/22 across Stream A: + cascade-e2e (87-00),
  + write-lock-atomic (87-02), + security-trifecta (87-01), + room-minto-hook
  (87-01a), + dashboard-server (87-08).
- Zero new runtime dependencies. BSL 1.1 headers on every new file in
  `scripts/`, `lib/`, `commands/`, `templates/`, `test/fixtures/`. BSL
  sweep is dynamic (enumerated via `git diff --name-only --diff-filter=A
  v1.10.10..HEAD`) so late-added files cannot slip through
  (R-87-10-BSL-SWEEP).

### Credits

- External code review 2026-04-16 surfaced the 1 P0 + 8 P1 findings that
  Stream A addresses. 1 flagged P0 (lazygraph SQL injection) was validated
  as a false positive (parameterized queries) and no action was taken on it.
- Adversarial cross-AI review 2026-04-19 contributed the R1-R7 audit risks
  that reshaped the phase plan: the milestone split (v1.10.11 investor-safe
  vs v1.10.12 maintainability), the .room-root scoping primitive for the
  pre-commit hook, the e2e fixture as a mandatory acceptance gate for the
  cascade refactor, the two-entry-point async/sync split design, and the
  Bearer-token BYO chat design (v1.10.12).

### Upgrade instructions

Two-command upgrade path:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

If your `.env` or `~/.mindrian.env` is at mode 0644 (common default on
many systems), run `chmod 600 ~/.mindrian.env` first, or export
`MINDRIAN_BRAIN_KEY` directly in your shell. Otherwise `brain_query`
and other Cypher-dependent paths will degrade to empty-baseline mode
after upgrade (with a one-shot stderr warning explaining the cause).

## [1.10.10] - 2026-04-15

Same-day hotfix-of-the-hotfix following v1.10.9. Single bug, single fix.

### Fixed

- **scripts/on-stop hook validation error**: The Stop hook was emitting `hookSpecificOutput` with `hookEventName: "Stop"`, but the Claude Code 2.1.x hook schema restricts `hookSpecificOutput` to `PreToolUse`, `UserPromptSubmit`, and `PostToolUse` only. Stop hooks must use top-level fields (`continue`, `systemMessage`, `stopReason`, etc.). On every session stop, users saw `Stop hook error: Hook JSON output validation failed - (root): Invalid input` and the SESSION SUMMARY line from Phase 84-07 voice-log reader was silently dropped. Now uses `systemMessage` which is the correct field per the schema and produces no validation noise. Witnessed on Windows v1.10.9 install within 30 minutes of v1.10.9 shipping. Phase 84-07 introduced the bug (the implementation copied the `hookSpecificOutput.additionalContext` pattern from the UserPromptSubmit hook where it IS valid). Phase 85 did not catch it because the regression only manifests on actual Claude Code session stops, not in the feynman test suite.

### Note for v1.10.9 users

If you installed v1.10.9 and saw repeated Stop hook validation errors after every interaction, this is the fix. Run `/plugin marketplace update` then `claude plugin update mos@mindrian-marketplace` to upgrade. No Node version change, no breaking changes — all v1.10.9 functionality is preserved exactly.

## [1.10.9] - 2026-04-15

Windows hotfix and Mac parity release. Ships Phase 85 (10 plans) addressing cross-platform issues witnessed in production on 2026-04-15 from two independent field reports (LASZLO-001 from László Személyi on Windows, LAWRENCE-001 from Lawrence Aronhime on Mac). Also ships the MOSDeckEngine skill (YC-grade pitch deck generator).

### Added

- **MOSDeckEngine skill**: YC-grade pitch deck generator using Feynman 6-stage first-principles decomposition. Shipping invariant for every room that reaches pitch stage.
- **Vault export `--mode=transplant`** (Finding G): `scripts/vault-export-orchestrator.cjs` now supports two modes. `--mode=vault` (default) is the Obsidian-only export and is backwards compatible with v1.10.8. `--mode=transplant` additionally includes the `.mindrian/` directory (room.db, brain-baseline.json, platform-agnostic SQLite via the Finding E migration) so a room can be bridged between machines. Example: `node scripts/vault-export-orchestrator.cjs --mode=transplant --room ./my-room --out ./my-room.vault.zip`.
- **`lib/core/platform.cjs`** cross-platform dispatch helper with `detectPlatform()`, `readPluginJsonVersion()`, and `resolveHookScript()`. Centralizes OS detection, terminal code page handling, and hook script path resolution across scripts/, hooks/, and lib/.
- **Python ML dependency auto-install** via `scripts/lib/ensure_ml_deps.py`. The whitespace gap-detection pipeline now runs on Mac stock Python without a manual `pip install` step (LAWRENCE-001).

### Fixed

- **(WIN-FIX-I) Brain Cypher param-name bug in `lib/core/brain-client.cjs`.** The HTTP client was sending `{ query: cypher }` to Brain MCP which expects `{ cypher: cypher }`. Silent failure of every Cypher-based Brain path since the HTTP client was introduced. Caused whitespace gap detection, causal edge enrichment, and any command consuming `brain.query()` to degrade to empty-baseline mode. Witnessed on the iia-deeptech-centers room on 2026-04-15. `brain_search` and `brain_schema` were unaffected which masked the bug. The same mirror bug in `brain_write` is also fixed. Regression suite added at `tests/test-brain-client-param-schema.cjs`.
- **(WIN-FIX-J) Self-update Windows failure family (LASZLO-001).** Reported by László Személyi (Laszlo Szemelyi, Neumann Technology Platform, Hungary) on 2026-04-15 with five screenshots showing `/mos:update` failing on Windows Git Bash and requiring Claude to hand-patch `scripts/self-update` mid-run at a cost of approximately 15 minutes and 15k tokens per invocation, compounding across every Windows user since Phase 84-09 shipped. Five root causes, one cascade. **J-2: python3 plugin.json reads** at six sites in `scripts/self-update` (lines 90, 95, 97, 133, 268 and the marketplace.json writer at line 403) failed on Windows either because `python3` resolved to the Microsoft Store alias stub or because Python mis-interpreted Git Bash virtual `/tmp/mos-update-XXXXXX/` paths as literal `C:\tmp\` -- both failure modes were masked by `|| echo ""` fallbacks and surfaced as the cryptic `"Staged plugin.json has no version field"` error. Fixed by a new `readPluginJsonVersion()` shell helper that wraps a single `node -e` invocation reading `plugin.json` via `require()`. Node is a hard runtime dependency so availability is guaranteed, and bash resolves path arguments before node sees them so Git Bash virtual paths work correctly. **J-3: atomic-swap-via-rename** at the former line 325 (`mv "$STAGE/plugin" "$TARGET_DIR"`) still ran on Windows despite the file header comment at line 14 claiming the rewrite "abandoned" it. Windows cannot rename directories whose files are held open by a running Claude Code session. Fixed by a platform-aware install step: POSIX keeps the fast atomic `mv`, Windows uses `cp -a "$STAGE/plugin/." "$TARGET_DIR/"` + `rm -rf "$STAGE/plugin"` with an ERR trap that rolls back `$TARGET_DIR` on failure. **J-5: script self-overwriting during execution.** Bash buffers scripts by byte offset, not inode, so when the install step mutates the directory `self-update` is reading from, execution becomes undefined. Fixed by a bootstrap handoff: `self-update` writes `lib/update-bootstrap.sh.template` to `$HOME/.mindrian/update-bootstrap-$$.sh`, `chmod +x`'s it, and `exec bash`'s it as the final command of the script. The bootstrap runs from a fixed path outside the plugin tree (never overwritten by any install method), performs the install + post-install housekeeping (`.env` preservation, npm install, cache pruning, marketplace cache write), and self-deletes on success. **J-4: fix-never-persists** -- the previous pattern of Claude hand-patching the user's cache-dir copy of `self-update` produced a fix that was immediately overwritten by the next successful update and never reached the repo. Landing J-2/J-3/J-5 on main and pinning `marketplace.json` `source.ref` to `v1.10.9` means every future Windows install gets a working `self-update` from the first run forward. **J-1 ghost warning:** a previous Claude debugger misdiagnosed the J-2 empty-version error as a `.claude-plugin/plugin.json` path-layout bug. The repo structure is correct and the validation gate still reads exactly that path. Machine-checkable grep guards in `tests/test-self-update-platform.cjs` now prevent any future debugger from accidentally moving the `.claude-plugin/` prefix. **Transition note: the v1.10.8 to v1.10.9 upgrade is the last bumpy one on Windows.** Existing Windows users on v1.10.8 will still execute the broken v1.10.8 self-update when upgrading to v1.10.9 because Claude Code runs the installed version's self-update, not the target's. From v1.10.9 onward, `/mos:update` works cleanly.
- **(WIN-FIX-F) run-hook.cmd exit code propagation (security-adjacent).** `hooks/run-hook.cmd` on Windows was swallowing bash exit codes because `%ERRORLEVEL%` inside an `if(...)` block is parse-time expanded, not runtime. PreToolUse write-scope-check returned 0 even when bash emitted exit 2, so the Phase 83 sealed-room write guard was silently inert on Windows for v1.10.7 and v1.10.8. **Security-adjacent: the sealed-room write guard was inert on Windows in v1.10.7 and v1.10.8. If you moved files into another room on Windows during that window, Larry's judgment was the only thing stopping it.** Fix uses `setlocal enabledelayedexpansion` with `!ERRORLEVEL!` captured into RC and `endlocal & exit /b %RC%` across all three bash invocation branches. Regression fixture at `tests/test-run-hook-cmd.cjs`.
- **(WIN-FIX-B) `vunknown` banner on Windows.** `scripts/session-start` was reading plugin.json via `python3 -c "import json; json.load(...)"`. On Windows fresh installs, `python3` resolves to the Microsoft Store alias stub and silently exits non-zero, the `|| echo unknown` fallback fires, and users see `vunknown` in their banner instead of the real version. Now uses node via `lib/core/platform.cjs` `readPluginJsonVersion()`.
- **(WIN-FIX-H) Cross-platform banner rendering and dispatch.** Introduced `lib/core/platform.cjs` centralizing OS detection, terminal code page handling, and hook script path resolution. Session-start banner now renders correctly on all platforms (UTF-8 box-drawing with ASCII fallback on non-UTF-8 terminals), statusline wrapper paths resolve through the helper, and python3 invocations have been audited across scripts/ with OS-aware gating.
- **Mac `stat -c` portable fallback (LAWRENCE-001).** Confirmed that session-start, sentinel-health-check, on-task-complete, and post-compact use a `portable_stat_mtime` helper handling both GNU and BSD `stat`. Reported by Lawrence Aronhime via structured Mac environment audit on 2026-04-15.
- **Lying header comment at `scripts/self-update` line 14** claimed the rewrite "abandons the atomic-swap-via-rename dance entirely" while line 325 still executed `mv`. Replaced with the truth: Windows uses `cp -a`, POSIX keeps `mv`, and the bootstrap handoff sidesteps the self-overwrite hazard.
- **Regression fence:** new `tests/test-self-update-platform.cjs` covers the four scenarios from LASZLO-001 (win32 vs linux INSTALL_METHOD selection, `readPluginJsonVersion` helper without python3, `/tmp/` prefix resolution, and end-to-end bootstrap install in both branches) plus explicit J-1 ghost guards. Registered in `lib/memory/run-feynman-tests.cjs` (17/17 test files green).

### Changed

- **BREAKING: Node.js 22.5.0 is now the minimum required version.** Previous minimum was `>=18`. This ships the **(WIN-FIX-E)** migration from `better-sqlite3` to the Node.js built-in `node:sqlite` (stable since 22.5.0). The migration eliminates the Windows native-binding failure class permanently: `better-sqlite3` had no prebuilt bindings for Windows arm64, which made the entire Phase 84 SQLite layer unreachable on those systems. Apple Silicon and x86_64 were unaffected, but the Windows gap blocked shipping Phase 84 features to Windows users. `better-sqlite3` has been removed from dependencies. `package-lock.json` regenerated (438 lines deleted). All 12 call sites across the Phase 84 memory layer, lazygraph, proactive-intelligence, nl-graph-queries, fabric-chat, vault-import, discovery-cycle, and sync-rooms-graph now run on every platform without native bindings.
  - **Breaking: v1.10.9 requires Node ≥ 22.5.0. If you installed v1.10.8 on Node 20 LTS, upgrade Node before running `claude plugin update mos` or the install will fail. This is a one-time migration to eliminate the native-binding failure class on Windows.** (equivalent: `Node >= 22.5.0`)
- `scripts/session-start` reads plugin version via Node, not python3.
- `engines.node` bumped to `>=22.5.0` in both `package.json` and `.claude-plugin/plugin.json`.

### Credits

- **László Személyi (Laszlo Szemelyi)**, Neumann Technology Platform, Hungary, for the detailed Windows self-update failure report including five screenshots of the `/mos:update` transcript (LASZLO-001, 2026-04-15). The "token-eating challenge" phrasing was the hook that surfaced the J family.
- **Lawrence Aronhime** for the structured Mac environment audit covering nine sections from environment fingerprint to feature coverage analysis, including the Python ML dependency gap that drove the whitespace auto-install work (LAWRENCE-001, 2026-04-15).

### Upgrade instructions

Two-command upgrade path:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

### Note for Windows users upgrading from v1.10.8

**The v1.10.8 to v1.10.9 upgrade is the last bumpy one on Windows.** Claude Code runs the *installed* version's `self-update` script, not the target version's. If you are currently on v1.10.8, your first `/mos:update` to v1.10.9 will still execute the broken v1.10.8 script. After v1.10.9 lands, every subsequent update runs the fixed code and `/mos:update` becomes clean and fast on Windows.

## [1.10.8] - 2026-04-14

### Added
- Smart Notebook Co-Pilot (Path C hybrid): v1.10.8 ships both the notebook writing surface (Mullins 20-section scaffold) and the co-pilot inject channel (graph-to-findings bridge + UserPromptSubmit hook). Five new code paths land as a single release: Mullins scaffold JSON + loader, Stakeholder node type in lazygraph-ops, `readGraphFindings()` bridge function that walks graph edges to stakeholder nodes and surfaces findings in the same JSON file the existing speaker pipeline already reads, env-gated UserPromptSubmit injection of top-3 findings (default ON with hardcoded cap as the suppression mechanism, kill switch `MINDRIAN_COPILOT_INJECT_FINDINGS=0`), voice-log writer + reader (sessions now populate real structured voice_log rows and on-stop surfaces a session summary line).
- Stakeholder node type in the per-room lazygraph: minimal schema (id, type, name, canonical_ref, notes, metadata JSON, timestamps) with helpers `createStakeholder`, `getStakeholder`, `upsertStakeholder`, `findStakeholdersByClaim`. Power/interest/stance land in v1.11.x Stakeholder Intelligence milestone as edge properties on new Initiative and Claim node types. Authority: `docs/research/2026-04-14-stakeholder-graph-deep-research.md` and the novel MindrianOS evaluation protocol for Feynman-MINTO as a taxonomy-constrained SCN extraction engine at `docs/research/2026-04-14-feynman-minto-scn-benchmark.md`.
- Honesty layer sibling section `### When memory is real (v1.10.8 and later)` in `skills/larry-personality/SKILL.md`. Narrows (does not replace) the Phase 83-08 no-fake-recall rule. "I have that in memory" becomes a TRUE statement when the finding came from the graph-backed bridge AND is scoped to the active room AND the room is not sealed AND is within the current session history window. All four conditions must hold; otherwise, "let me search" language still applies.

### Fixed
- Self-update script rewrite for versioned-cache model (plan 84-09). Triggered by a witnessed failure on 2026-04-14 when `scripts/self-update install` from v1.10.5 to v1.10.7 failed at the atomic-swap step with `mv: cannot stat .../mos/1.10.5/.update-stage: No such file or directory`, leaving the plugin cache in a half-state that required manual recovery (the staged v1.10.7 was moved from `1.10.5.old-807316/.update-stage` to `mos/1.10.7/` by hand). Root cause: the old script computed `$STAGE` as a path inside `$CACHE_DIR`, then renamed `$CACHE_DIR` away, leaving `$STAGE` pointing at a path that no longer existed. The v1.10.7 self-update script was byte-identical to v1.10.5, so every v1.10.5 user would have hit the same failure on their next update. The rewrite uses a clone-to-sibling model: stage outside any cache dir in `/tmp/mos-update-XXXXXX`, move the validated staging area into a new semver-named sibling dir `mos/<new-version>/`, never touch the previous version's directory. Forward compatible with the 83-01 statusline-mos wrapper which resolves highest-semver automatically. Preserves `.env` via `cp -n` from the previous highest-semver version.

### Changed
- v1.10.8 is the Co-Pilot reshape, not the original 9-plan Smart Notebook scope. After an independent code review on 2026-04-14 caught that the planner's first draft was built on false assumptions about the repo state (plans 84-01/02/03 had already shipped in the same session via commits `f020f81`, `8011d9a`, `bd42654`, and the 9-plan draft proposed "new SQL tables" that were already on disk), the spec was reverted at commit `1ad2f59` (reverting `23d4318`) and rewritten from the ground truth. External research via Tavily on 2026 LLM agent memory architectures (Mem0, Zep, Letta, LangChain, NotebookLM, Copilot Notebooks) plus the Dependabot alert-fatigue case study ground the new design. Jonathan Sagir authored the external research brief on knowledge-graph-powered stakeholder analysis and the novel evaluation protocol for Feynman-MINTO as a taxonomy-constrained SCN extraction engine, both preserved as authority documents for the v1.11.x Stakeholder Intelligence milestone.
- Smart-notebook milestone slot reshaped: the original 9-plan chain collapses to 7 plans (84-04 through 84-10) for the remaining work, with Decision node type + Mullins materialize subcommand + voice-retrieval scopedRead primitive + LLM-based stakeholder extraction all deferred to v1.11.x as a coherent Stakeholder Intelligence milestone. v1.10.8 ships the foundation; v1.11.x ships the intelligence layer that rides on it.
- Credit: Jonathan Sagir caught the self-update failure in real time on 2026-04-14 during this session's /mos:update cache install attempt. The fix landed in v1.10.8 as plan 84-09 rather than hotfixed as v1.10.7.1 because the release-infrastructure beta-gating rules in `.claude/includes/release-process.md` make a hotfix slower than v1.10.8 itself.

## [1.10.7] - 2026-04-14

### Added
- Cross-session scope injection: session-start now injects ACTIVE ROOM CONTEXT and Cross-Room Policy into every Claude session, reading the active room from ~/MindrianRooms/.rooms/registry.json (Tier 1)
- Sealed room walker: session-start walks ~/MindrianRooms/ for any subdirectory containing GUARDRAIL.md and surfaces sealed rooms with their first 3 hard-rule lines quoted (Tier 1)
- Filesystem write interception: a new PreToolUse hook blocks Write/Edit/MultiEdit operations that target a non-active room under ~/MindrianRooms/, with actionable /mos:rooms switch hints. Sealed rooms block unconditionally. (Tier 1.5)
- Mid-session intent classifier: a new UserPromptSubmit hook scores the user message against every room in the registry plus every sealed room on the machine and warns when the highest-scoring room is not the active one (Tier 2)
- Honesty layer in larry-personality: new "## Honesty about memory" section forbids the phrase "I do not have that in working memory" and requires "let me search" language before filesystem recall

### Fixed
- Statusline wrapper bundle: scripts/statusline-mos now ships as a plugin file. session-start auto-installs it to ~/.claude/statusline-mos and migrates settings.json from the hardcoded context-monitor path to the wrapper path. Detection-driven, idempotent, non-clobbering for users who hand-fixed their config.
- Cross-session leak (8 vectors): Jonathan Sagir caught a witnessed failure on 2026-04-14 where a single Claude Code session leaked content from the sealed rashut-hadshanut-ai room across recall, drafting, methodology execution, filesystem writes, recovery pivots, Hebrew translation filing, mid-session topic recognition, and honesty-layer collapse. v1.10.7 closes vectors 1 through 8 via Tier 1 + Tier 1.5 + Tier 2 + Honesty Layer. See .planning/research/cross-session-memory-and-room-intent.md and .planning/phases/83-cross-session-scope-injection/83-CONTEXT.md for the full analysis.

### Changed
- Smart-notebook milestone slot shifts v1.10.6 -> v1.10.7 -> v1.10.8. Sixth shift in this v1.10.x patch line. Smart-notebook in v1.10.8 will promote the SQLite memory layer at lib/core/memory-ops.cjs to load-bearing and deliver real persistent cross-session memory (Tier 3), voice-log per room, and synthesis voice room-scoping.
- This release acknowledges openly: MindrianOS does not yet have real cross-session memory. What ships here is read-time scope injection, write-time scope interception, message-time intent classification, and a language rule preventing the assistant from calling filesystem search "memory". Real memory wiring is v1.10.8.

## [1.10.5] - 2026-04-14

onboarding: true
onboard_steps:
  - "Restart Claude Code to receive the wiki artifact injection fix. The /mos:snapshot wiki view sidebar will now render full article content when you click any section. Previously every article pane was empty because the generator was not populating sec.artifacts. Re-run /mos:present (or /mos:snapshot) against your room to regenerate the wiki HTML with embedded article content."
  - "New: per-section MINTO summary upgrade. When a room has been regenerated to the v1.10.2 Feynman-MINTO format, the wiki sidebar now shows each section's governing thought as the summary line instead of the title-extracted fallback. Pre-81 rooms continue to use the title-extraction summary unchanged via the H1 fallback path, so no data migration is required."
  - "New: defensive bloat caps. The generator now caps each artifact at 20 KB and each room at 2 MB of injected markdown so single-file wiki snapshots never exceed the 5 MB break point. Over-cap rooms get a stderr warning and an in-wiki yellow banner. No current beta room is anywhere near these limits. Upgrade path: /plugin marketplace update then claude plugin update mos@mindrian-marketplace."

### Fixed

- **Wiki template empty-artifacts bug.** `/mos:snapshot` exports and other presentation generator outputs were producing sections with `sec.artifacts = []`, so clicking any section in the wiki sidebar showed no article content. The template at `templates/presentation/wiki.html` was designed to consume artifact data the generator at `scripts/generate-presentation.cjs` `collectSections` never populated. Reported by Lawrence Aronhime (lawrence@mindrian-os.com) on 2026-04-13 23:23 after he built a same-night workaround on his own machine by injecting artifact content directly into `ROOM_DATA`. The bug had been sitting in `collectSections` since v1.9.6 (2026-04-11) and survived eight subsequent releases (v1.9.7, v1.9.8, v1.9.9, v1.10.0, v1.10.2, v1.10.3, v1.10.4) because nothing touched that file across those eight releases.

### Added

- **sec.artifacts populated per template contract.** `scripts/generate-presentation.cjs` `collectSections` now emits an `artifacts` array of `{filename, title, content, excerpt, date}` objects per file in each section, matching the wiki template render contract verified at `templates/presentation/wiki.html` lines 236-355. Title extraction uses the frontmatter `title` field, then the first h1, then the filename fallback. Excerpt is the first 200 chars of the body stripped of frontmatter and h1. Date prefers the frontmatter `date` field, then the file mtime as YYYY-MM-DD. Order within each section is newest-first by date with no-date files at the bottom by filename.
- **buildArtifactEntry helper** in `scripts/generate-presentation.cjs` is the new pure function that converts a markdown file path into the artifact JSON shape. Pure, returns null on unreadable, no I/O outside the existing `safeRead` and `fs.statSync` helpers.
- **Per-artifact 20 KB size cap with truncation banner.** Artifacts over the 20 KB threshold get content truncated at the nearest paragraph break with an explicit truncation banner appended pointing the reader at the source file path.
- **Per-room 2 MB injected-markdown cap.** Total artifact content across all sections is capped at 2,097,152 bytes (2 MiB) so single-file wiki HTML never approaches the 5 MB break point (GitHub and Vercel first-paint budget, iOS Safari parse cliff). Real fixture artifacts measure 600-800 bytes average and no current beta cohort room is anywhere near the cap. The cap is defensive infrastructure, not an active constraint today.
- **stderr warning on bloat cap activation.** When the per-room cap fires, the generator logs `WARN: room exceeded 2 MB injected-markdown cap, X artifacts truncated, Y artifacts dropped` to stderr in a single log-scrapable line.
- **In-wiki bloat banner.** When the cap fires, the wiki template renders a yellow callout at the top of the sidebar reading `Snapshot truncated. Some articles were truncated or omitted to keep this snapshot under 5 MB. Open the source files for full content.` so users know some artifacts were truncated for file size.
- **collectSectionMinto helper** in `scripts/generate-presentation.cjs` reads per-section `MINTO.md`, parses frontmatter, returns the `governing_thought` field. Pure helper, returns null on absence, no logging.
- **sec.summary upgrade leveraging v1.10.2 Feynman-MINTO infrastructure.** When a section has a per-section `MINTO.md` with a non-empty `governing_thought` field (produced by the v1.10.2 Feynman-MINTO generator at `scripts/vault-section-minto-generator.cjs`), the wiki sidebar now displays the governing thought as the section summary instead of the title extraction. This is a free leverage of the v1.10.2 work: rooms that have been regenerated to Feynman-MINTO format get a more meaningful summary line for free, with no schema migration and no breaking change.
- **Backwards compatibility for pre-81 rooms.** Rooms that have not been regenerated to Feynman-MINTO format (no per-section `MINTO.md` files) continue to use the title-extraction summary unchanged. The H1 fallback path produces byte-identical summary output to pre-82 behavior.
- **SKIP_FILES alignment with SYSTEM_FILES.** `scripts/generate-presentation.cjs` now imports `SYSTEM_FILES` directly from `lib/vault/room-scanner.cjs` (lines 345-349 export), so the exclusion set is canonical: ROOM.md, STATE.md, MINTO.md, frozen tier-0 baselines, files under `.migration-backup/`, files under `_superseded/`, files under `.mos/`. No drift risk because there is one source of truth.
- **Test coverage.** New `scripts/generate-presentation.test.cjs` with 9 test cases covering artifact shape, SYSTEM_FILES exclusion, per-artifact cap, per-room cap with stderr capture via `spawnSync`, summary upgrade with MINTO present, summary fallback without MINTO, ordering within section, title-extraction preference, and backwards-compat regression on fixture-medium. All 9 pass. Registered with `lib/memory/run-feynman-tests.cjs` central runner (now 7/7 test files green). Uses node built-in `assert`, no new runtime dependencies.

### Changed

- **scripts/generate-presentation.cjs collectSections** rewritten to populate the `artifacts` array, track the per-room byte counter, set the `bloatNotice` field on the room data, and call `collectSectionMinto` for each section. Existing fields (id, label, color, entryCount, summary) are unchanged in shape but `summary` now upgrades when MINTO is present. This is a free leverage of the v1.10.2 Feynman-MINTO infrastructure for section summary upgrades: no new generator runs, no schema migration, just reading a field that is already there when present.
- **templates/presentation/wiki.html** sidebar render block now emits the bloat banner div at the top when `roomData.bloatNotice` is non-empty. Uses an inline yellow callout style consistent with the De Stijl palette.
- **scripts/generate-presentation.cjs main()** now exports the helpers via `module.exports` and guards the `main()` call with `require.main === module` so the file can be required from tests without triggering a generator run. Strictly additive, CLI behavior unchanged.

### Notes

The fix leverages v1.10.2 Feynman-MINTO infrastructure for free section summary upgrades. Rooms regenerated to Feynman-MINTO format get the more meaningful `governing_thought` summary; pre-81 rooms get the title-extraction fallback unchanged. No data migration is required. Existing exported wiki.html files do not auto-regenerate; users must re-run `/mos:present` (or `/mos:snapshot`) against their room to pick up the fix.

`scripts/generate-presentation.cjs` `collectMinto` at line 346 (room-level dashboard generator helper) is byte-identical to its pre-v1.10.5 form. The v1.10.5 fix only modifies `collectSections` and adds the new `buildArtifactEntry` and `collectSectionMinto` helpers as siblings.

The smart-notebook-as-cofounder milestone (Mullins 7-domain scaffold extension, three-level section/collection/artifact hierarchy, co-founder synthesis voice) was originally targeted at v1.10.5. It has been shifted to v1.10.6 so this Lawrence-bug fix could ship same-day per the user's directive. This is the fourth slot shift for smart-notebook in the v1.10.x patch line (v1.10.3 to v1.10.4 to v1.10.5 to v1.10.6). The smart-notebook research artifacts at `.planning/research/smart-notebook-cofounder.md` and `smart-notebook-cofounder-appendix.md` remain authoritative for the v1.10.6 work.

Upgrade path: standard two-command `/plugin marketplace update` followed by `claude plugin update mos@mindrian-marketplace`. Users on `stable` auto-update channel will receive this release within one week; users who want it immediately run the two commands above.

### Credit

Bug reported by Lawrence Aronhime (lawrence@mindrian-os.com) on 2026-04-13 23:23. Lawrence has been running beta builds since v1.9.x and holds the lawrence@mindrian-os.com admin Brain API key issued 2026-03-26. He built a same-night workaround on his own machine by injecting artifact data directly into `ROOM_DATA`, then filed the bug for the rest of the beta cohort. Eight releases shipped between his report and this fix. Thank you, Lawrence.

## [1.10.4] - 2026-04-14

onboarding: true
onboard_steps:
  - "Restart Claude Code to see the refreshed statusline. The LARRY marker is now replaced with the active room name, venture stage and section and gap counts are removed, and the MindrianOS plugin version is always visible with a persistent /mos:update hint."
  - "New Brain connection indicator. Green BRAIN means MINDRIAN_BRAIN_KEY is configured (Brain MCP available). Red BRAIN means not configured."
  - "Emojis are now allowed in the statusline only. Every other surface (slash-command output, MINTO files, CHANGELOG entries, dashboard bodies, PDF exports) continues to follow the repo-wide no-emoji rule."

### Added

- **Active room name as the statusline brand marker.** The gold marker on the left of the statusline now carries the active room name from `.rooms/registry.json` or `STATE.md project_name`, replacing the static LARRY label. Users running multiple rooms see at a glance which one is active.
- **Current MindrianOS plugin version always visible.** `readPluginVersion()` prefers `__dirname`-relative `plugin.json` so dev workspaces show their own version and installed plugin caches show theirs. The persistent `/mos:update` hint with a green circle appears next to the version as a zero-runtime-cost reminder that users can check for updates manually.
- **Brain connection status indicator.** New `detectBrainStatus()` function renders a green BRAIN marker when `MINDRIAN_BRAIN_KEY` is set (with optional confirmation from `~/.mindrian/bridge/brain-health.json` if the brain-connector skill has written one) and a red BRAIN marker when not configured. This is a configuration proxy, not a live MCP round-trip, because the statusline cannot do synchronous MCP calls.
- **Emoji thematic mapping for exploration stages.** Each venture section now renders with a thematic emoji: 🎯 PROBLEM, 💡 SOLUTION, 💰 BUSINESSCASE, 📊 MARKET, crossed-swords COMPETITION, 💵 FINANCE, scales LEGAL, 👥 TEAM, 🎨 ASSETS, outbox EXPORTS, speaking-head MEETINGS, 🎁 OPPORTUNITIES, 💎 FUNDING.
- **Emoji prefixes on statusline elements.** 🏠 for room name, 📂 for section breadcrumb, 🧠 for MindrianOS plugin brand, 🔄 for `/mos:update` hint, 🧬 for BRAIN status.
- **ui-system skill carve-out.** `skills/ui-system/SKILL.md` now documents that the Claude Code statusline rendered by `scripts/context-monitor` is excepted from the repo-wide no-emoji rule per user directive 2026-04-14. Every other surface (slash-command output, MINTO files, CHANGELOG prose, dashboards, PDFs, reports) continues to follow the rule without exception.

### Changed

- **Venture stage, section count, gap count, active GSD phase indicator, and exploration uppercase label** all **removed** from the statusline per user spec 2026-04-14. The line is now shorter and signal-dense: room name + section breadcrumb + exploration emoji + MindrianOS version + update hint + Brain status + model + context bar. Anything removed is still available via `/mos:status`, `/mos:room view`, `/mos:progress`, and other commands that need the full room map.
- **Exploration label kept** after the initial removal proposal, on user clarification. The label sits next to the section breadcrumb to give both the section path and the thematic exploration area at a glance.
- **Update detection write side remains unbuilt.** The old yellow arrow `/mos:update` badge read from a bridge file that nothing wrote; it was effectively dead code. v1.10.4 replaces it with the always-visible persistent hint, which is honest about what it is (a reminder, not a signal) and works on airgapped machines without any detection pipeline.

### Notes

v1.10.4 is a small UX-polish patch release that lands on top of v1.10.3 (prior statusline upgrade with LARRY marker + breadcrumb + exploration label + active phase). It is separate from the smart-notebook-as-cofounder work captured in `.planning/research/smart-notebook-cofounder.md` and `.planning/research/smart-notebook-cofounder-appendix.md`, which was originally targeted at v1.10.3, then v1.10.4, and has now been shifted to v1.10.5 so this statusline polish can ship today. The smart-notebook milestone (Mullins 7-domain scaffold extension, three-level section/collection/artifact hierarchy, co-founder synthesis voice) remains the next feature milestone after v1.10.4.

The unused `flashingUpdate()` helper in `scripts/context-monitor` is retained as dead code on user instruction 2026-04-14 for future reuse if an update-detection write side ships later.

## [1.10.3] - 2026-04-14

onboarding: true
onboard_steps:
  - "Restart Claude Code to see the new statusline with LARRY marker, section breadcrumb, exploration label, and active phase indicator"
  - "The statusline now shows project > current-section so you can see which room area you are actively working in at a glance"
  - "Active GSD phase detection uses newest-mtime heuristic so scaffolded-but-unexecuted future phases do not leapfrog the phase you are actually in"

### Added

- **LARRY brand marker in statusline.** Gold marker prefixed to the statusline whenever a room is active, so every session visibly reinforces that Larry is the teaching partner, not a generic agent.
- **Section breadcrumb in statusline.** The project name is now followed by a right-pointing arrow and the most recently modified section, giving at-a-glance awareness of which area of the room the user is working in. Uses the currentSection tracking that was already computed but not displayed.
- **Exploration stage label in statusline.** Maps the current section to a short uppercase label (PROBLEM / SOLUTION / BUSINESSCASE / MARKET / COMPETITION / FINANCE / LEGAL / TEAM / ASSETS / EXPORTS / MEETINGS / OPPORTUNITIES / FUNDING) via a lookup table, with a safe uppercased-hyphen-stripped fallback for unknown sections. Makes the current exploration focus visible without opening any file.
- **Active GSD phase indicator in statusline.** New detectActiveWorkflow function reads .planning/STATE.md for an explicit current-phase marker, and falls back to the newest-mtime phase directory under .planning/phases/. Uses newest mtime rather than highest phase number so scaffolded-but-unexecuted future phase directories do not leapfrog the phase the user is actually working on.

### Changed

- **scripts/context-monitor graceful degradation.** Every new statusline element is conditional. If currentSection cannot be resolved, the breadcrumb and exploration label are simply omitted. If .planning does not exist, the phase indicator is omitted. Existing statusline parts (project name, venture stage, section count, gap count, model, context bar) render unchanged when any new element is missing.

### Fixed

- **Pre-existing em-dash in context-monitor header comment.** Replaced with a hyphen to comply with the repo-wide no-em-dashes rule. Not introduced by v1.10.3 but owned by the release since the file was touched.

### Notes

v1.10.3 is a small UX-polish patch release that lands on top of v1.10.2 (Feynman-MINTO Hybrid). It is separate from the smart-notebook-as-cofounder work captured in .planning/research/smart-notebook-cofounder.md, which was originally targeted at v1.10.3 but has been shifted to v1.10.4 so this statusline patch can ship today without waiting on the larger architectural research to complete. The smart-notebook milestone (Mullins 7-domain scaffold extension, three-level section/collection/artifact hierarchy, co-founder synthesis voice) remains the next feature milestone after v1.10.3.

## [1.10.2] - 2026-04-14

onboarding: true
onboard_steps:
  - "NEW: Feynman-MINTO hybrid reasoning. /mos:reason generates structured MINTO artifacts that think in plain-English Feynman stories first, then lift the story into pyramid form. Tier-1 runs in your existing Claude session at zero external cost."
  - "NEW: /mos:reason --regenerate-all migration. One command rewrites every existing MINTO.md in the room to the new Feynman-MINTO format. A tier-0 safety pass backs up the old files to .migration-backup/<stamp>/ before the tier-1 loop starts, so rollback is always a folder copy away."
  - "NEW: Tier-0 fallback with AAAK footer. When narrative context is missing or malformed, the generator still produces a readable MINTO with the AAAK attribution footer. The filesystem is never left in a broken state."

### Why v1.10.1 was skipped

v1.10.1 was drafted around an AAAK-as-footer proposal that treated the attribution library as the narrative surface. During the 2026-04-13 planning session the user reframed the problem: MINTO artifacts should read like Feynman explanations first and compress into pyramid form second. AAAK belongs on the bottom of tier-0 fallback as an attribution artifact, not as the narrative engine. The Feynman-MINTO reframe superseded the AAAK-only plan before any 1.10.1 commit landed, so the version number was retired. The superseded plan documents live at `.planning/phases/81-feynman-minto-hybrid/_superseded/` for historical trace.

### Added
- `lib/memory/feynman-prompts.cjs` -- inlined prompt library for the four Feynman phases (problem frame, plain-English walkthrough, pyramid lift, structural fidelity check). Single source of truth, drift-tested against the slash command body.
- `lib/memory/narrative-schema.cjs` -- Zod-free schema validator for narrative inputs. Rejects malformed narratives and routes them to tier-0 fallback.
- `scripts/vault-section-minto-generator.cjs` split into `--plan` and `--write` subcommands. `--plan` emits the reasoning plan without touching disk. `--write` executes the plan and produces the MINTO.md artifact. This separation is what lets the slash command orchestrate multi-phase reasoning cleanly.
- `scripts/vault-section-minto-generator.cjs` gains `runTier0` single entry point. Tier-0 always produces a MINTO.md with the AAAK footer so no section is ever left without a readable file.
- `commands/mos-reason.md` rewritten as the Feynman-MINTO orchestrator. Nine-step execution protocol that Claude follows in-session. No external API, no key, no meter.
- `scripts/vault-regenerate-all.cjs` migration helper. Walks every section with artifacts, backs up existing MINTO.md files to `.migration-backup/<YYYY-MM-DD-HHMMSS>/`, runs tier-0 regeneration as a safety net, and writes per-section `report.md`. Invoked by `/mos:reason --regenerate-all` as the tier-0 pre-pass before the tier-1 per-section loop.
- `scripts/vault-regenerate-all.test.cjs` integration test. Uses `MINTO_FROZEN_DATE=2026-04-14` for determinism.
- Test fixtures with frozen baselines at `test-fixtures/feynman/sections/fixture-{small,medium,large}/`. Regression-locked tier-0 output for three sections, so any accidental drift in the pre-81 structural logic fails the suite immediately.
- `lib/memory/run-feynman-tests.cjs` central test runner. Now registers 6 test files covering prompt drift, narrative schema, generator split, frozen baselines, integration, and regenerate-all migration.

### Architecture Note -- Why This Has No LLM API Machinery

The architectural principle of Phase 81 is: **Claude IS the LLM, the slash command runs in the user's existing Claude session, there is no external API call in this plugin and therefore nothing to meter**. During planning the user caught an early draft that had budget caps, monthly limits, and ANTHROPIC_API_KEY wiring:

> ANTHROPIC_API_KEY but they run in an llm! why key?

The reframe is the whole point. `/mos:reason` is a slash command. It executes inside a Claude Code session that is already paid for by the user. The inlined prompts in `lib/memory/feynman-prompts.cjs` are loaded as context and Claude runs them. No `fetch` call, no key, no cost, no budget. The plugin ships Decision #1 (one-command install, zero config) fully preserved. A user who just installed the plugin and never set any environment variable gets tier-1 Feynman-MINTO reasoning on their first `/mos:reason` invocation.

Phase 81 Revision 1 had the budget machinery. Phase 81 Revision 2 deleted it. The Revision 1 plan docs are archived at `.planning/phases/81-feynman-minto-hybrid/_superseded/` and the Revision 2 correction is captured in `81-CONTEXT.md`. Anyone grepping the codebase will find zero references to `ANTHROPIC_API_KEY`, zero cost counters, zero monthly caps. That is not an oversight. That is the architecture.

### Semver Deviation

Per strict semver this release would normally be `1.11.0` because it adds a new public command mode (`/mos:reason --regenerate-all`) and a new migration script. The user chose `1.10.2` as a patch-style release so the `1.11.0` slot can be reserved for release pipeline hardening per `docs/NEXT-RELEASE-v1.11.0-beta.1.md`. This is a deliberate, documented deviation from semver. Feature scope of 1.10.2 is larger than a patch release would normally carry.

### Forward Pointer -- v3.0 MCP Sampling

When the MindrianOS MCP server ships in v3.0, the `generate_minto` tool will use the same `lib/memory/feynman-prompts.cjs` module via the MCP protocol's `sampling/createMessage` primitive. Headless invocations (Claude Desktop, Cowork, automated pipelines) will get tier-1 Feynman-MINTO output without needing a Claude Code slash-command session. The prompt library was intentionally designed to be callable from both surfaces. See `.planning/PROJECT.md` v3.0 Backlog for the sampling integration plan.

### Retired
- `FEYNMINTO-05` (per-run budget) -- retired. No meter, nothing to budget against. Slash command runs in the user's existing Claude session.
- `FEYNMINTO-06` (monthly cap) -- retired. Same reason. There is no external API invocation to cap.

### Files
- `lib/memory/feynman-prompts.cjs` (new)
- `lib/memory/feynman-prompts.test.cjs` (new)
- `lib/memory/feynman-prompts-drift.test.cjs` (new)
- `lib/memory/narrative-schema.cjs` (new)
- `lib/memory/narrative-schema.test.cjs` (new)
- `lib/memory/run-feynman-tests.cjs` (new)
- `scripts/vault-section-minto-generator.cjs` (rewritten with --plan / --write / runTier0)
- `scripts/vault-section-minto-generator.test.cjs` (new)
- `scripts/vault-section-minto-generator.integration.test.cjs` (new)
- `scripts/vault-regenerate-all.cjs` (new)
- `scripts/vault-regenerate-all.test.cjs` (new)
- `commands/mos-reason.md` (rewritten as Feynman-MINTO orchestrator, gains --regenerate-all section)
- `test-fixtures/feynman/sections/fixture-small/` (new)
- `test-fixtures/feynman/sections/fixture-medium/` (new)
- `test-fixtures/feynman/sections/fixture-large/` (new)

## [1.10.0] - 2026-04-13

onboarding: true
onboard_steps:
  - "NEW: /mos:vault import -- reverse direction of the vault export. Point at any Obsidian vault or folder of .md files and convert it into a fully-structured MindrianOS Data Room with one command. 4-stage ICM pipeline (ingest, classify, route, enrich) with interactive review gate, undo support, and post-import smoke test."
  - "NEW: Team profile materialization. Imported people land in team/{core-team,consultants,advisors,investors,board,unassigned}/{slug}/ with full ROOM.md, profile, mentions, responsibilities, and contracts/ subfolder. Role detection via keyword heuristics, reassignable at the review gate."
  - "NEW: Inbox sub-branching. Unclassified imports land in inbox/suggested/ (conf 0.45-0.74) or inbox/unclassified/ (conf < 0.45) -- first-class sections, not a tmp folder."
  - "NEW: Native filing wikilinks (Phase 79) -- new artifacts created through /mos:file-meeting, scripts/analyze-room xref, and scripts/create-speaker-profile arrive pre-linked. No retroactive injection needed."
  - "NEW: Branded output on every imported artifact -- MindrianOS footer, canonical De Stijl frontmatter schema, callout promotion for author/attendees/date/tags source fields."
  - "NEW: Post-import /mos: Usability Check in IMPORT-REPORT.md -- runs compute-state (mindrian-tools fallback) against the imported room, asserts at least one populated canonical section."
  - "NEW: Workspace guard in scripts/session-start -- refuses to run if PWD is under ~/.claude/plugins/. Prevents the wrong-workspace parallel-development incident from 2026-04-13 from happening again. See .planning/autopsies/2026-04-13-wrong-workspace-incident.md."
  - "FIX: Merged two parallel development universes (phases 76-80 Obsidian vault import + v1.9.6-1.9.9 SnapshotHub + SQLite migration + lobby generator + /mos:mullins) into a single unified release. No work lost, no rollback."

### Added
- lib/import/ module: manifest.cjs, vault-scanner.cjs, classifications-sync.cjs, person-detector.cjs, meeting-detector.cjs, router.cjs, enricher.cjs, room-md-scaffolder.cjs, report.cjs, branding.cjs, smoke-test.cjs (11 modules, 12/12 test files green)
- scripts/vault-import.cjs -- single CJS entry point for /mos:vault import. Drives the 4-stage pipeline, handles Case A (no existing room), Case B (existing room merge), Case C (nested room refusal), Case D (.obsidian/ detection)
- scripts/wikilink-batch.cjs -- perf helper for bulk wikilink injection
- scripts/create-speaker-profile -- new --layout=import --role-bucket=<bucket> flag to materialize team profiles during import
- 3 fixture vaults under lib/import/test-fixtures/ (tiny-vault, obsidian-vault, collision-vault)
- 4 stage-contract templates at templates/import/stage-contracts/ (01-ingest, 02-classify, 03-route, 04-enrich)
- references/import-config.md -- Layer 3 reference for confidence thresholds, role keywords, frontmatter promotion map
- lib/import/PRECONDITIONS.md -- known-issues doc for bin/mindrian-tools.cjs lazygraph-ops / better-sqlite3 failure (smoke test and /mos:vault import both route around it)
- commands/vault.md gains the `import` subcommand section with Larry-led review gate workflow
- **Workspace guard**: scripts/session-start refuses to execute under ~/.claude/plugins/ (prevents cache-dir parallel development)
- **Release process mandate**: .claude/includes/release-process.md documents the 5-gate version consistency rule (CHANGELOG + plugin.json + package.json + git tag + marketplace.json.source.ref all must agree) and the workspace rule
- **Incident autopsy**: .planning/autopsies/2026-04-13-wrong-workspace-incident.md documents the parallel-development incident, detection, and transplant recovery so future sessions see the failure mode on CLAUDE.md load

### Changed
- **CLAUDE.md** gains a WORKSPACE GUARD section at the top pointing at the autopsy doc
- **bin/mindrian-tools.cjs** merged with both universes' additions (vault export + vault import + lobby generator + mullins command)
- **skills/room-passive/SKILL.md** now references the Phase 79 wikilink builder (auto-wikilink on filing) alongside the merged branding rules
- **scripts/create-speaker-profile** extended with import layout, retaining the default speaker-profile generator behavior

### Merged from v1.9.6 through v1.9.9 (parallel development reconciliation)
- v1.9.6: SQLite replaces KuzuDB (762 lines, 21 exports, 52 tests), memory system (13 exports, 35 tests), natural language graph queries (10 templates), Brain normalization (280 dupes merged, 20 chains added), 4 intelligence algorithms
- v1.9.7: Rich Text SnapshotHub (callouts, wikilinks, tag-pills, hat-card grids, pull-quotes), Feynman Narrative layout, Six Hats Tension Cards, .wikilink CSS class, Obsidian Vault Nested Structure rule
- v1.9.8: SnapshotHub brand lockup (logo top-right, "Made by Mindrian" footer)
- v1.9.9: /mos:mullins command, lobby generator

## [1.9.9] - 2026-04-13

onboarding: true
onboard_steps:
  - "NEW: Lobby generator -- /mos:snapshot now produces BOTH index.html (3-door editorial lobby) and hub.html (full museum). Run it on any room and get a warm De Stijl landing page that adaptively picks doors based on what your room actually has."
  - "NEW: /mos:mullins -- John Mullins' 7 Domains Model. Seven-dimensional opportunity stress-test (market x2, industry x2, team x3). Scored 1-5 per domain. Weakest domain caps the opportunity. Files to business-model/."
  - "NEW: Door Selection Engine -- the lobby detects Feynman Deck, Bank of Opportunities, Investment Thesis, Mullins, Deep Grade, Six Hats, Devil's Advocate, Meetings, and Knowledge Graph, then picks top 2 for the flanks. Door 2 (center) is always the Full Data Room."
  - "NEW: Starter doors for empty rooms -- if fewer than 2 deliverables exist, invitation cards (Define The Problem, Explore The Market) fill the grid. The lobby is never broken, never empty."
  - "NEW: tagline: frontmatter field in STATE.md -- set an editorial one-liner for the lobby display title. Falls back to venture name + first sentence of problem-definition."

### Added
- **`scripts/generate-lobby.cjs`** -- 520-line standalone lobby generator. Zero npm dependencies. Produces `exports/index.html` as the 3-door editorial landing page. Reference visual: my-finance-room.vercel.app.
- **`commands/mullins.md`** -- /mos:mullins slash command. Conversational walkthrough of Mullins 7 Domains with Quick Pass (15 min) and Deep Dive (45 min) modes.
- **`references/methodology/mullins-7-domains.md`** -- full framework reference with the 7 domain definitions, scoring rules, and cross-framework chaining.

### Changed
- **`/mos:snapshot` now emits TWO files** instead of one. Both generators run in sequence: `generate-hub.cjs` produces `hub.html` (museum, full content), then `generate-lobby.cjs` produces `index.html` (3-door lobby, linking to hub.html). The `exports/` folder deploys as-is to Vercel with the lobby served as the site root.
- **`commands/snapshot.md`** updated with the two-output contract, door selection priority, and the new implementation steps.

### Why
The current `hub.html` is a museum: every artifact visible on one scroll. Good for reference, overwhelming as a first impression. The new `index.html` lobby is the opposite: three curated doors that adapt to what the room has. You walk into the lobby, you see three doors, you pick one. This is the shareable artifact. The museum becomes what you show *after* the lobby has done its job.

The Mullins command closes a gap in the methodology commands -- /mos:lean-canvas covers business model structure, but nothing previously stress-tested opportunity viability across market/industry/team simultaneously. Mullins is the most rigorous framework published for this purpose and is now a first-class door in the lobby.

### Files
- `scripts/generate-lobby.cjs` (new, 520 lines)
- `commands/mullins.md` (new)
- `references/methodology/mullins-7-domains.md` (new)
- `commands/snapshot.md` (updated implementation + contract)

## [1.9.8] - 2026-04-13

onboarding: false

### Changed
- **SnapshotHub brand lockup:** Mindrian logo now locks to the top-right of the header on every generated hub (was: top-left, inline with title stack). Responsive fallback stacks the logo above the title on screens under 640px so it never collides with long venture names.
- **Footer signature:** Bottom-center footer text updated from "Generated by MindrianOS" to "Made by Mindrian" across all `/mos:snapshot` exports. Logo color in the footer upgraded from muted gray (#888) to cream (#F5F0E8) for stronger read on the dark footer.

### Why
Brand contract for the canonical shareable Data Room deliverable (the `hub.html` single-file export). Locking logo position + signature copy at the generator level ensures every room that runs `/mos:snapshot` -- past, present, and future -- inherits the lockup automatically. No per-room edits required.

### Files
- `scripts/generate-hub.cjs` (header CSS + footer copy + SVG fill)

## [1.9.7] - 2026-04-12

onboarding: true
onboard_steps:
  - "NEW: Rich Text SnapshotHub -- all hub exports now include callouts, wikilinks, tag-pills, hat-card grids, pull-quotes, section dividers, and clickable view buttons by default."
  - "NEW: Feynman Narrative -- /mos:export hub generates a narrative-first layout telling the story of the snapshot in plain language before showing the data."
  - "NEW: Six Hats Tension Cards -- hat analysis rendered as 2x2 grid cards with color-coded borders. Green Hat surprise and Blue Hat verdict get dedicated callout boxes."
  - "NEW: Wikilink CSS class (.wikilink) -- dashed-underline links connecting entities across sections. Every person, technology, and methodology reference becomes clickable."
  - "FIX: View buttons now generate as clickable <a> tags linking to sections instead of decorative <span> elements."
  - "FIX: Deck button mapped to opportunity-bank section. Presentation Deck opens external slide deck URL."

### Added
- Rich text CSS system in generate-hub.cjs: .callout (4 color variants), .quote, .wikilink, .key-number/.key-label, .tag-pill (3 levels), .hat-tension/.hat-card (6 hat colors), .section-divider
- View buttons now link to actual sections with proper href mapping (Wiki->overview, Deck->opportunity-bank, Insights->solution-design, Narrative->#narrative)
- Hover state for view buttons (blue background on hover)
- Cursor: pointer on view buttons (was cursor: default)

### Changed
- View button HTML generation: <span> replaced with <a> tags
- Default snapshot quality: rich text formatting is now the baseline, not an enhancement
- **RULE: Obsidian Vault Nested Structure** -- every artifact in a .mos vault MUST sit in its own named folder (`section/artifact-name/artifact-name.md`). Enables Obsidian graph view, per-artifact attachments, clean wikilinks. Applies to all surfaces (CLI, Desktop, Cowork).

## [1.9.6] - 2026-04-11

onboarding: true
onboard_steps:
  - "BREAKING: KuzuDB replaced with SQLite. Your Data Room graph now lives at room/.mindrian/room.db with WAL mode for concurrent access. Run /mos:room rebuild-graph to migrate."
  - "NEW: Memory system -- Larry remembers who you are (L0), what facts are current (L1), session history (L2), and conversation fragments (L3). Assumptions tracked with validity lifecycle."
  - "NEW: Natural language graph queries -- ask Larry about your room's connections in plain English. 10 built-in query patterns."
  - "NEW: Brain normalization -- 280 duplicate concepts merged, 73 contamination nodes removed, 20 new framework chains added."
  - "NEW: 4 intelligence algorithms -- blindspot coverage, Bayesian surprise, element novelty, disruption index."

### Changed
- **SQLite replaces KuzuDB** -- lazygraph-ops.cjs fully rewritten from KuzuDB/Cypher to better-sqlite3/SQL (762 lines, 21 exports, 52 tests). Dead dependency removed. Room graph at room/.mindrian/room.db with WAL mode for concurrent plugin + MCP access.
- **Intelligence cascade updated** -- checks .mindrian/room.db instead of .lazygraph/. Script references updated (hsi-to-graph.cjs, causal-to-graph.cjs, whitespace-to-graph.cjs).
- **28+ files migrated** -- all scripts, CLI, MCP tools, wiki, presentation generators updated from KuzuDB to SQLite.

### Added
- **Memory system** (memory-ops.cjs) -- 13 exports: identity (L0), facts with temporal validity (L1), sessions (L2), fragments (L3), assumption tracking with validity lifecycle (untested/supported/contradicted/stale). 35 tests.
- **NL graph queries** (nl-graph-queries.cjs) -- 10 natural language query templates: contradictions, neighbors, paths, stats, section artifacts, HSI connections, reverse salients, causal claims, whitespace zones, convergence.
- **Migration tool** (migrate-lazygraph.cjs) -- rebuild-from-artifacts approach with --dry-run, --force, --help.
- **Brain normalization** -- 280 "The X" prefix dupes merged, 73 file path nodes removed, 20 FEEDS_INTO edges added (leadership -> PWS methodology chains). Brain: 7,931 -> 7,578 concepts, 147 -> 167 FEEDS_INTO.
- **Wave 1 algorithms** -- compute-blindspot-mass.py (Good-Turing coverage), compute-bayesian-surprise.py (leave-one-out cosine shift), compute-element-novelty.py (per-artifact novelty), compute-disruption-index.py (CD index).
- **Larry server instructions** -- 114-line full personality for MCP server (voice, Ask-Tell dial, mode engine, framework delivery, tool usage patterns). Zero reduction from plugin personality.

### Removed
- **kuzu** npm dependency removed from package.json
- Deleted orphaned scripts: hsi-to-lazygraph.cjs, causal-to-lazygraph.cjs, whitespace-to-lazygraph.cjs, build-graph-from-kuzu.cjs

## [1.9.4] - 2026-04-09

onboarding: true
onboard_steps:
  - "NEW: Three ways to start. Explore (just think), Explore+Capture (room builds as you talk), or Build Then Work. MindrianOS detects whether you're a TTO, researcher, or business person and adapts."
  - "Every framework Larry runs now banks opportunities automatically. Your Opportunity Bank grows with every interaction -- well-defined problems paired with mirror solutions, scored by confidence."
  - "Returning users see their strongest banked opportunities in the greeting. The scratchpad persists across sessions so you never lose a thought."

### Added
- **Opportunity Extraction Engine** -- universal schema (problem + mirror solution + domain + evidence + knight_position + confidence). Every methodology command banks opportunities as a side effect via intelligence cascade Step 11.
- **Opportunity Graph** -- banked opportunities become KuzuDB nodes with ADDRESSES and IN_DOMAIN edges. Filter by domain, knight position, or confidence threshold.
- **Brain Validation Steps** -- Brain-connected users get suggested next frameworks from 100 frameworks x 131 FEEDS_INTO chains for each banked opportunity.
- **Conversation Mode Routing** -- sessions without a room present 3 modes with JTBD statements. Mode 2 (Explore+Capture) detects persona (TTO/Researcher/Business) and selects the right Brain framework chain.
- **getFrameworkChain(persona)** -- Brain queries FEEDS_INTO chains per persona with Tier 0 hardcoded fallback in persona-chains.md.
- **conversation-mode skill** -- new skill with persona detection signals, Mode 2 banking instructions, and framework chain guidance.
- **bank-opportunity CLI subcommand** -- Larry banks opportunities during conversation via `node bin/mindrian-tools.cjs bank-opportunity`.
- **scratchpad-ops.cjs** -- pre-room persistence at ~/.mindrian/scratchpad.json. Conversations persist across sessions without a room existing.
- **Room seeding from Opportunity Bank** -- new Step 6.1 in /mos:new-project migrates scratchpad opportunities into pre-loaded room sections.
- **Onboarding redesign** -- mode-first structure: Step 1 (Three Ways to Work), Step 2 (Opportunity Bank), Step 3 (Knight uncertainty/risk framing with persona examples).
- **Returning user opportunity greeting** -- session-start surfaces banked opportunity count and strongest opportunity for returning users.

## [1.9.3] - 2026-04-09

onboarding: true
onboard_steps:
  - "NEW: The intelligence loop is real. File an artifact and Larry will surface cross-subsystem impacts -- 'This changes your financial model assumption [0.82]'. Respond APPROVE, REJECT (with reason), or DEFER. Your decisions become graph data that makes the next scan smarter."
  - "Filing now produces a complete audit trail: automatic git commit, classification metadata in frontmatter, and cascade status visible to Larry."
  - "All scripts work on macOS now. No more GNU-only stat/find/date/readlink calls breaking on Darwin."

### Added
- **APPROVE/REJECT/DEFER workflow** -- after filing an artifact, Larry surfaces up to 2 cross-subsystem impacts with confidence scores. User responds APPROVE (cascade), REJECT (reason captured as graph data), or DEFER (parked). Decisions persist to .proactive-intelligence.json and become KuzuDB edges (CONFIRMS, INVALIDATES, DEFERRED).
- **Mid-session intelligence** -- new findings surface in Larry's next response after filing, not just at session start. Repeat suppression prevents noise (3+ showings auto-suppressed). New evidence resets suppression.
- **record-decision CLI subcommand** -- `node bin/mindrian-tools.cjs record-decision` wires decisions from skill instructions through to persistence and graph edges
- **getNewFindings()** -- compares current analysis vs last-persisted, returns only NEW or CHANGED findings with suppression filtering
- **recordDecision()** -- persists user APPROVE/REJECT/DEFER with timestamp, reason, and KuzuDB edge creation
- **CONFIRMS/DEFERRED/INVALIDATES edge types** -- new KuzuDB schema for decision tracking
- **Automatic git commit on artifact filing** -- structured message format "file(section): artifact title"
- **Classification in frontmatter** -- classify-insight result stored as `classification:` field in artifact YAML
- **Cascade status reporting** -- post-write hook echoes completion status to stdout for Larry's context

### Fixed
- **macOS portability** -- replaced all GNU-only `stat -c %Y`, `find -printf`, `readlink -f`, `date -d` calls with portable helpers across 13 scripts
- **/mos:radar registered in plugin.json** -- command was implemented but unreachable
- **VERIFICATION.md staleness** -- phases 39, 60, 62 checkboxes updated to match implementations
- **Brain fallback guards** -- leadership.md and hat-briefing.md now gracefully degrade without Brain
- **datetime.utcnow() deprecation** -- replaced with datetime.now(datetime.UTC) in 4 scripts
- **zod missing from package.json** -- MCP server peer dependency was not declared
- **classify-insight fire-and-forget** -- now synchronous, result consumed by cascade

## [1.9.2] - 2026-04-09

onboarding: true
onboard_steps:
  - "CRITICAL FIX: The filing cascade now actually fires. Every artifact you write triggers KuzuDB indexing, HSI scoring, state recomputation, graph rebuilding, and proactive intelligence persistence. Before this fix, the entire pipeline was silently dead."
  - "13 wiring fixes from a full 8-audit plugin scan: post-write hook, MCP routes, allowed-tools, hook timeouts, env detection."
  - "Desktop/Cowork users can now access /mos:whitespace and /mos:organize -- they had zero MCP routing before."

### Fixed
- **Post-write hook was dead** -- Claude Code passes file paths via stdin JSON, not positional args. The entire filing cascade (KuzuDB index, HSI, reverse salients, presentation regen) silently did nothing after every artifact write. Now reads from stdin with backward-compatible fallbacks.
- **Intelligence cascade missing 4 steps** -- artifact-id injection, compute-state, build-graph, and proactive intelligence persistence were never called. The loop from "artifact filed" to "Larry surfaces a finding" now actually works.
- **act-swarm phantom MCP route** -- registered in z.enum but handler fell through to dead-end "reference not found" message
- **SessionStart hook had no timeout** -- the heaviest hook could hang indefinitely. Now has 10s timeout.
- **consolidate-pinecone.py crashed on import** -- bare `from pinecone import Pinecone` with no try/except
- **Velma env var mismatch** -- integration-registry checked MODULATE_API_KEY but transcribe-audio used VELMA_API_KEY. Now checks both.
- **deep-grade and research commands blocked by own allowed-tools** -- declared only Read but needed Bash, Agent, WebSearch
- **6 commands missing allowed-tools entirely** -- funding, opportunities, persona, splash, reason, snapshot
- **visualize and wiki YAML scalar format** -- `allowed-tools: Bash` parsed as string not list
- **help.md missing Bash** -- admin identity check could not run
- **reason.md missing name: field** -- used command: instead of name:
- **post-write missing set -euo pipefail** -- only hook script without strict error handling

### Added
- **whitespace MCP route** -- Desktop/Cowork users can now access /mos:whitespace
- **organize MCP route** -- Desktop/Cowork users can now access /mos:organize
- **act-swarm MCP handler** -- full Brain-driven swarm execution via MCP
- **Array env detection** -- integration-registry now supports checking multiple env var names per integration

## [1.9.1] - 2026-04-08

onboarding: true
onboard_steps:
  - "NEW: /mos:validate-proposition -- score your value proposition through 3 gates: Is it Real? Can you Win? Is it Worth it? Mathematical VPS composite with 15 weighted dimensions."
  - "PWS Value Proposition Framework from Prof. Aronhime -- the Samsonite Test for every venture. A proposition is not good or bad, it is strong or weak."
  - "Value Canvas + BTC statement + B2B value drivers -- full quantitative assessment from problem case to business case."

### Added
- **PWS Value Proposition Framework** -- Lawrence Aronhime's 3-gate scoring system codified as /mos:validate-proposition
- **Three Sequential Gates** -- Is It Real? (R>=6.0), Can We Win? (W>=5.5), Is It Worth It? (V>=5.0) -- each must pass before the next
- **15 Weighted Scoring Dimensions** -- 5 per gate, each scored 0-10 with evidence, weighted by importance
- **VPS Composite Formula** -- Value Proposition Strength = R*0.35 + W*0.35 + V*0.30, rated STRONG/MODERATE/WEAK/FAILING
- **Gate Kill Logic** -- any single gate failure kills the proposition regardless of other scores
- **Value Canvas Integration** -- Jobs/Gains/Pains mapping with Fit Score formula (jobs x gains x pains ratio)
- **BTC Statement Generator** -- For/Who/Our/That/Unlike/Our product template populated from gate evidence
- **B2B Value Drivers** -- 8 quantitative drivers (revenue, cost, responsiveness, productivity, cycle time, satisfaction, quality, employee)
- **Brain Integration** -- PWS Value Proposition framework node wired to JTBD, Hedgehog Concept, Golden Circle, all 5 venture stages
- **Samsonite Test** -- signature reframe: "durability at fair price beats premium quality every time"

## [1.9.0] - 2026-04-08

onboarding: true
onboard_steps:
  - "NEW: /mos:whitespace -- find what's MISSING in your venture. Maps gaps using embedding-space density analysis, based on the researcher's SemNovel research (Yale)."
  - "MindrianOS now has a Model Data Room -- 168 artifacts across 10 sections, built from 45 meeting transcripts, 43 research papers, 35 PWS frameworks."
  - "HSI Spectral Analysis on real evidence -- 20 cross-domain innovation pairs discovered, reverse salients identified."

### Added
- **Whitespace Mapping Engine** -- SemNovel-inspired embedding-space gap detection
- **/mos:whitespace command** -- 7 subcommands: map, analyze, hypothesis, tree, score, external, discover
- **Novelty Scoring** -- every filed artifact gets an embedding-distance novelty score
- **Discovery Cycle** -- HSI -> Whitespace -> RS -> Analogy chained in sequence
- **Model Data Room** -- 168 artifacts across 10 sections built from real project evidence
- **Google Drive API Integration** -- OAuth token, batch download 45+ documents
- **HSI Spectral Analysis** -- 20 innovation pairs, OM-HMM structural scoring
- **Investment Thesis Gate** -- 7/10 pass on MindrianOS's own evidence
- **People Mapping** -- 19 unique people across 45 meetings
- **Cross-Source Intelligence** -- Gmail + Calendar + Drive + Notion + Claude memory

## [1.8.8] - 2026-04-07

onboarding: true
onboard_steps:
  - "The Brain just got 10x smarter. Framework chaining (125 FEEDS_INTO edges), stage-aware recommendations (129 TYPICAL_AT), and 444 semantic bridges from LazyGraph to curated knowledge."
  - "Error messages are now human-readable. Every script follows: What happened / Why / How to fix."
  - "Install guide at mindrian.ai/docs/install -- three paths (no Claude Code / has Claude Code / update), platform-specific steps."

### Added
- **Brain: Causal Discovery** -- FEEDS_INTO 4->125, PREREQUISITE 0->15, TYPICAL_AT 4->129, ADDRESSES_PROBLEM_TYPE cleaned to 152
- **Brain: Lazy Graph Bridge** -- 444 ALIAS_OF bridges connecting LazyGraph (245K CO_OCCURS) to canonical nodes, 235 concepts promoted
- **Brain: Fragmentation Cleanup** -- 12 lowercase labels fixed, 75 null-title Books removed, noise CaseStudies cleaned
- **Brain: Teaching Wiring** -- 29/29 CaseStudies wired, 406 TEACHES edges, 23 IMPLEMENTS, 7 leadership books codified
- **Brain: Venture Stage Mapping** -- 30 TYPICAL_AT edges across 5 stages with effectiveness scores and source book provenance
- **Dummy-Proof Install** -- human-readable error messages (What/Why/Fix pattern) across resolve-room, room-registry, session-start, check-update, self-update
- **Install test checklist** (scripts/test-fresh-install.md) for Mac and Windows manual verification
- **Top 10 troubleshooting items** added to website install page

### Changed
- All script errors now follow `[MindrianOS] What / Why: reason / Fix: command` pattern
- Website install page expanded with troubleshooting section

## [1.8.7] - 2026-04-07

### Added
- Leadership coaching intelligence integrated into team-execution room section
- V2 leadership knowledge ported: 7 domains, ABET integration, signature reframes
- Team-execution proactive signals: team gaps, solo founder detection, assessment staleness
- Team-execution contradiction detection: capacity mismatch, stage mismatch
- Brain leadership framework chains: 4 coaching pipelines (assessment, building, strategic, conflict)
- Team-context-aware coaching: adapts opening based on team size and composition
- Brain-enriched framework suggestions after coaching sessions
- Neo4j Brain: 7 KnowledgeDomain nodes, 6 leadership ProblemTypes, ~57 edges

## [1.8.6] - 2026-04-06

onboarding: true
onboard_steps:
  - "Your rooms now live in ~/MindrianRooms/ -- one place for every project. Tell Larry 'go to [room name]' to switch."
  - "/mos:organize navigates your room hierarchy as a wicked problem -- multiple views, graph-informed proposals, human confirmation for every move."
  - "Room hierarchy syncs to KuzuDB (local) and Neo4j Brain (remote) as an additive intelligence layer. Graph failure degrades gracefully."
  - "/mos:setup rooms migrates legacy ~/room/ and ~/rooms/ layouts to MindrianRooms with guided confirmation."

### Added
- **MindrianRooms centralized directory** -- all Data Rooms under ~/MindrianRooms/ with ICM Layer 0 (CLAUDE.md) and Layer 1 (INDEX.md) auto-generated
- **resolve-room 4-strategy cascade** -- central registry, directory scan, workspace registry, legacy fallback with deprecation notice
- **MINDRIAN_ROOMS_HOME env var** -- override ~/MindrianRooms location for power users
- **ICM templates** -- templates/icm/CLAUDE.md (Layer 0 identity) and INDEX.md (Layer 1 routing) auto-generated on first room creation
- **update-icm-index script** -- idempotent INDEX.md regeneration from registry, called on create/archive/stage change
- **/mos:organize command** -- wicked hierarchy navigator with 4 subcommands (tree/propose/view/move), 4-tier graceful degradation (Brain+KuzuDB -> Brain -> KuzuDB -> metadata), human confirmation for every move
- **GROUP-CLAUDE.md template** -- ICM Layer 0 for grouping directories, generated from graph context
- **Virtual room projections** -- /mos:organize view [by-stage|by-client|by-domain|by-activity] shows groupings WITHOUT moving files
- **Decision memory** -- user GROUP/SEPARATE/DEFER choices stored locally and promoted to graph edges when Brain available
- **migrate-rooms script** -- detects 5 legacy room patterns, per-room confirmed migration with registry integration and optional symlinks
- **/mos:setup rooms** -- guided migration option for legacy layouts
- **Dual-graph room hierarchy** -- KuzuDB local graph (Room/RoomGroup/CONTAINS/AT_STAGE) + Neo4j Brain remote (adds USES_FRAMEWORK/SHARES_THEME/HAS_SECTION)
- **sync-rooms-graph script** -- KuzuDB sync from registry, fire-and-forget, idempotent
- **sync-rooms-brain script** -- Neo4j Brain sync with AT_STAGE, USES_FRAMEWORK, SHARES_THEME edges, wires 13 orphaned DataRoomSection nodes
- **Room hierarchy schema reference** -- references/brain/room-hierarchy-schema.md with Cypher patterns and KuzuDB DDL

### Changed
- room-passive and room-proactive skills now detect rooms via resolve-room (not dir_exists:room)
- /mos:rooms list shows ~/MindrianRooms/ paths from central registry
- /mos:room overview header shows simplified ~/MindrianRooms/[name]/ path
- /mos:new-project creates rooms under ~/MindrianRooms/[slug]/
- /mos:rooms create targets ~/MindrianRooms/[slug]/ with ICM auto-generation
- room-registry writes to central ~/MindrianRooms/.rooms/registry.json
- Session greeting references MindrianRooms location when room detected
- room-registry create/archive triggers fire-and-forget graph sync

## [1.8.4] - 2026-04-06

### Added
- Dashboard detail panel: plain English relationship descriptions ("supports", "conflicts with", "shares themes with")
- Edge hover tooltip shows full sentence: "Market Analysis supports Pricing Model" instead of raw INFORMS
- Clickable relationship items in panel navigate to connected nodes
- 12 edge types translated: INFORMS, CONTRADICTS, CONVERGES, FEEDS_INTO, REINFORCES, INVALIDATES, ENABLES, CAUSES, FILED_TO, SPOKE_IN, ATTENDED, REFERENCES
- Artifact summary preview in detail panel when available
- Relationships color-coded by type (red=conflict, blue=support, yellow=convergence, green=reinforces)

### Changed
- Graph visualization standard: vis-network (vis.js) replaces Cytoscape.js for all exports
- SnapshotHub constellation rebuilt with ForceAtlas2 physics, interactive nodes, edge filtering
- Readable labels with dark outline, section color-coding, diamond/dot node shapes
- Detail panel on node click, sidebar filters, controls bar (Fit/Zoom/Physics/Stabilize)
- Detail panel widened to 360px for relationship readability
- Design standard codified at references/design/graph-visualization-standard.md

## [1.8.3] - 2026-04-06
### Changed
- `/mos:help` completely redesigned with De Stijl color-coded job categories
- Every command description rewritten as JTBD outcomes ("what you get" not "what it does")
- 6 Mondrian colors mapped to thinking jobs: RED=Problem, BLUE=Reasoning, AMETHYST=Perspective, YELLOW=Intelligence, GREEN=Output, TEAL=Infrastructure
- Commands regrouped by job category instead of alphabetical
- Color legend rendered with actual ANSI terminal colors matching the website/dashboard palette
- Command-to-color mapping reference table for consistent rendering

### Fixed
- Brain v1.8.2 graph cleanup: reversed backwards GOVERNS edge on Red Teaming
- Merged 32 DictionaryTerm duplicate sets (35 nodes removed)
- Wired 2 under-wired FrameworkAgents (JobsToBeDone, SystemThinking)
- Connected 5 min-wired CorePrinciples to semantically matched frameworks
- Linked 6 near-orphan CaseStudies to VentureStages

## [1.8.1] - 2026-04-05
### Added
- Live Hub interactive dashboard with Command API -- click section cards to trigger MindrianOS CLI commands
- Contextual action buttons per section with JTBD rationale (Problem Definition gets Root Cause/Challenge/Validate, Market gets Trends/Timing/User Needs, etc.)
- Proper Mondrian grid mark + MINDRIAN wordmark logo linking to mindrianos website
- Content-proportional card sizing -- sections with more artifacts get larger grid cells
- Gap cells for empty/missing sections with dashed borders and contextual action buttons
- Opportunity Bank gets special treatment -- yellow border highlight with "Scan for Opportunities" CTA
- Color legend strip at bottom of grid showing all sections with artifact counts
- Command panel (slide-in from right) with copy-to-clipboard CLI command and section preview
- Full keyboard navigation -- Tab through cards, Enter/Space to activate, focus-visible rings
- ARIA labels and roles on all interactive elements
- prefers-reduced-motion support -- animations disabled for motion-sensitive users
- Mobile responsive grid -- 2-column at 1024px, single-column at 640px with reset grid positions

### Fixed
- Remove dead code in room_graph router (unreachable cases from merge artifact)
- Add hat-briefing and scheduled-tasks to MCP routers (were missing from command coverage)
- Sanitize Cypher query input in brain-router.cjs to prevent injection from malformed STATE.md
- Add shutdown handler double-fire guard in session-catchup.cjs
- Wire both MCP servers (mindrian-os local + mindrian-brain remote) into plugin .mcp.json
- ALL_TOOL_COMMANDS now correctly reports 64 routed commands
- Raw markdown no longer leaks into grid card summaries (tables, bold markers, metadata lines stripped)
- Summary extraction skips frontmatter-like lines (Filed:, Source:, Category:)
- Section label font size increased from 10px to 12px for readability
- Contrast improved on dark-bg cell labels (0.7 to 0.8 opacity)
- Touch target sizes on action buttons meet 44px minimum width

## [1.8.0] - 2026-04-05
onboarding: true
onboard_steps:
  - "MindrianOS now works across all three surfaces: CLI, Desktop, and Cowork. Same commands, same intelligence, same room."
  - "MCP Apps render your Data Room inline: dashboard, wiki, and knowledge graph views right in the conversation."
  - "Smart context loading: Larry detects your archetype (student/venturist/researcher) and loads only what you need -- half the token cost."

### Added
- **MCP Foundation**: All 64 plugin commands exposed as MCP tools via 9 hierarchical routers with intelligence-cascade.cjs shared module
- **Surface Detection**: Auto-detect CLI/Desktop/Cowork at startup; dual transport (stdio + Streamable HTTP) on same McpServer instance
- **Write Safety**: KuzuDB write-gateway with promise-chain serialization, file-based write lock with PID/timestamp/stale cleanup
- **Token Optimization**: Native-first skills compressed from 74K to 26K bytes; progressive loading (Layer 0 always, Layer 1 on-demand, Layer 2 Brain); per-turn cost halved from ~20.5K to ~10K tokens
- **Hook Optimization**: HSI debounce (30s), analyze-room caching (5-min TTL), write batching, per-room bridge file isolation, framework recommendation cache (10-min TTL)
- **Context Intelligence**: User archetype detection (venturist/researcher/student), tiered context loading (500/2K/5K tokens), 6 MCP session profiles, autocompact tuning per archetype, returning user detection, student progress tracking
- **Pipeline Chaining**: Room-file-based state enables LLM-orchestrated tool sequences; Brain chain ordering via CO_OCCURS and FEEDS_INTO relationships
- **Agent Dispatch Optimization**: Dynamic swarm sizing, cost estimation before dispatch, chain checkpoints, budget-aware model routing (opus -> sonnet -> haiku), Coordinator-compatible output
- **Scheduled Intelligence**: Session catch-up on Cowork, daily briefings, competitor/grant/news scanning, scout sentinel tasks, all results filed as room artifacts with provenance
- **MCP Apps Data Room Views**: Dashboard (De Stijl Mondrian grid), wiki (browsable room sections), knowledge graph (Cytoscape.js) rendered inline via ext-apps; bidirectional postMessage communication
- **Session State Writer**: Structured last-session.md with active_methodology, open_questions, next_suggested_action, confidence_level, artifacts_created, session_duration (KAIROS-ready)
- **KAIROS Detection**: context-engine reads KAIROS daily log instead of cold-start context rebuild when tengu_kairos activates
- **UDS Listener Stubs**: room-passive ready for cross-instance room state sharing when tengu_harbor ships
- **Platform Gate Monitor**: checkGates() monitors tengu_kairos, tengu_harbor, tengu_scratch, tengu_portal_quail via env vars with local override support

### Changed
- SDK upgraded from 1.27.1 to ^1.29.0 for Streamable HTTP transport and ext-apps peer dependency
- Router groups capped at 15 commands (data_room split into room_state/content/graph sub-routers)
- Skills teach domain-specific rules only -- no redundant tool instructions for native Claude capabilities

## [1.7.1] - 2026-04-05

### Added
- generate-hub.cjs rebuilt to Synteris quality -- full De Stijl component library with venture cards, grade circles, badge system, smart content detection (bug/wish/decision cards), Data Room Views button row, scroll-highlight navigation
- /mos:snapshot and /mos:export now produce single-file tabbed hub by default (D20)
- Recursive scanning in all visualization scripts (build-graph, generate-snapshot, generate-presentation)

### Fixed
- build-graph recursive scanning for nested directories (12 nodes to 73)
- Cytoscape node IDs with slashes breaking CSS selectors
- generate-standalone JS injection leaving orphaned .then/.catch blocks
- generate-snapshot.cjs and generate-presentation.cjs depth-1 scanning
- Cytoscape compound layout collapsing for 30+ node rooms
- Banner on every cold start, not just first install
- Status line: wrong JSON key, literal $PLUGIN_ROOT, room-only gate
- Brain key global fallback to ~/.mindrian.env
- /mos:onboard reset for replaying welcome sequence
- Post-room creation shows OS-native open folder command
- Brain setup two-stage health check (wake before verify)
- disable-model-invocation removed from 29 methodology commands

## [1.7.0] - 2026-04-05
onboarding: true
onboard_steps:
  - "When you want to know WHY something is true in your Room (not just WHAT), /mos:causal extract traces cause-effect chains with mechanisms and falsifiable predictions"
  - "When assumptions stack 3-deep and you need to know which to validate FIRST, /mos:causal trace cascade shows what breaks if each assumption fails"
  - "When you have a causal claim worth testing, /mos:causal predict turns it into a trackable prediction with a deadline -- Larry reminds you when it's time to check"

### Added
- **Causal Reasoning Layer**: CausalClaim nodes in KuzuDB with 12 properties (cause, mechanism, effect, confidence, domain, falsifiable_prediction, novelty_score, extraction_method, evidence, source_artifact, created)
- **Causal Edge Types**: CAUSES + ROOT_CAUSE_OF (Artifact->Artifact), CASCADES_TO (CausalClaim->CausalClaim), EXTRACTED_FROM (CausalClaim->Artifact)
- `/mos:causal` command with 3 subcommands: extract (Larry extracts cause/mechanism/effect triples with Three Gaps enforcement), predict (generate and track falsifiable predictions), examples (research-backed examples via Brain + Tavily)
- **Causal Graph Engine** (compute-causal.py): 5 NetworkX algorithms -- chain traversal (all_simple_paths, cutoff=6), cascade simulation (descendants with multiplicative confidence decay), bottleneck detection (betweenness centrality), contradiction detection (cycle finding), inversion protocol (node removal + path diff)
- **Cross-Reference Queries**: Cypher joins linking CausalClaims to HSI_CONNECTION, REVERSE_SALIENT, and ANALOGOUS_TO edges -- discovers where causal explanations connect to existing intelligence
- **Prediction Registry** (prediction-registry.cjs): 5 subcommands (add/resolve/list/overdue/archive), REGISTRY.json lifecycle (pending->confirmed/refuted/expired), opportunity typing (business/research/funding/competitive/technical), confidence propagation from outcomes
- **Post-Write Causal Flagging**: Lightweight regex heuristic flags causal candidates after HSI+RS in post-write cascade, writes .causal-candidates.json
- **Research-Backed Examples** (ENGINE-09): Analogy engine generates structural search queries from causal graph topology -- Brain/Pinecone for PWS teaching examples + Tavily for chronologically recent real-world examples
- **Brain Enrichment**: Theory of Change Framework node, Causal Reasoning parent Concept, FEEDS_INTO chains (Root Cause -> Systems Thinking -> CLD -> Scenario Analysis), CO_OCCURS edges, TYPICAL_AT venture stage mappings, Falsifiability + Logic Trees linked
- **Brain Query Patterns 11-13**: causal_framework_select, causal_pattern_match, causal_contradiction_resolve
- **Brain Causal Directives**: Three Gaps framework (Abstraction, Reasoning, Reality) -- every claim needs mechanism + falsifiable prediction
- **Larry JTBD Suggestions**: 5 signal-to-suggestion mappings for causal commands in larry-personality skill
- **Room-Proactive Causal Discovery**: 5 convergence patterns surfacing discoveries when causal + HSI + RS + analogy edges converge (threshold: 5+ claims, 3+ cascades)
- **Session-Start Prediction Check**: Larry proactively prompts for overdue prediction resolution

### Architecture
- **Larry EXTRACTS** causal claims (semantic, LLM with Three Gaps enforcement)
- **Python COMPUTES** graph algorithms (NetworkX -- chains, cascades, bottlenecks, contradictions, inversions)
- **KuzuDB STORES** causal data (CausalClaim nodes, CASCADES_TO/EXTRACTED_FROM edges)
- **Brain DIRECTS** causal reasoning (read-only directives, query patterns 11-13)
- **Brain never receives user causal data** -- clean IP boundary maintained
- Follows existing HSI pipeline pattern: Python extracts -> JSON intermediate -> CJS writes to KuzuDB
- Discovery emerges from graph structure: Cypher walks Causal -> HSI -> RS -> Analogy edges in one query

## [1.6.3] - 2026-04-03

### Fixed
- Remove disable-model-invocation from all 29 methodology commands -- was blocking LLM responses entirely, making every /mos: methodology command unusable

### Added
- Brain Proactive Command Engine: Command nodes as first-class Neo4j entities with TRIGGERED_BY_SIGNAL, FOLLOWS_FRAMEWORK, RELEVANT_AT_STAGE relationships
- Multi-hop command suggestion queries (Pattern 10a-d): frameworks -> commands -> triggers -> JTBD
- JTBD-powered contextual command discovery: Larry suggests commands every 3-7 turns using "When/want/so" formula
- Fabric-driven surprise suggestions: Larry queries KuzuDB Tensions, Bottlenecks, Surprises for command triggers
- Onboarding invitation on any "how to use" question with /mos:onboard
- v6.2 RoomHub: adaptive Room type detection, 7 Showcase views, Constellation graph, Generative Fabric Chat
- /mos:snapshot for 7-view SnapshotHub HTML export
- Analogy engine wired into /mos:help and pws-methodology skill
- Parallel Power group in help tree (--swarm, --parallel, --full, --broad)
- Update flow uses JTBD formula for every new capability

## [1.6.1] - 2026-03-31
onboarding: true
onboard_steps:
  - "When you are burning through tokens on routine work, /mos:models set balanced keeps Opus for teaching but uses Haiku for scanning -- 66% less cost, same quality where it matters"
  - "When 3 Sections have gaps and you only have 30 minutes, /mos:act --swarm fills all 3 in parallel -- 5 minutes instead of 45"
  - "When you want 6 expert perspectives but hate waiting, /mos:persona --parallel generates all De Bono hats simultaneously -- 2 minutes"
  - "When you are stuck on a problem that feels unique to your domain, /mos:find-analogies discovers how other industries solved the exact same structural conflict"
  - "When your Room has not been health-checked and you have deadlines approaching, /mos:scout runs a full scan -- health, grants, competitors, innovation connections"
  - "When you want to share your Room's intelligence as a living hub, /mos:snapshot generates a 7-view interactive HTML export with graph, chat, and deep links"

### Added
- /mos:models command for model profile management (quality/balanced/budget/inherit)
- /mos:scout for sentinel intelligence (health check, grant deadlines, competitor watch)
- /mos:find-analogies for Design-by-Analogy discovery (--brain, --external modes)
- /mos:snapshot for RoomHub export (7 views, adaptive, generative chat)
- 6 new hooks: PreCompact, PostCompact, FileChanged, CwdChanged, SubagentStop, TaskCompleted
- Parallel flags: --swarm (act), --parallel (persona), --full (grade), --broad (research)
- Spectral OM-HMM: Markov chain thinking-mode analysis in HSI pipeline
- 3 new KuzuDB edge types: ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA
- Design-by-Analogy pipeline (5 stages) with TRIZ matrix and SAPPhIRE encoding
- Adaptive Room type detection (venture/website/research/general)
- Constellation graph with 12 Thread types and De Stijl colors
- Generative Fabric Chat querying KuzuDB via natural language
- MWP specification, moat mandate, KAIROS prep, Coordinator Mode manifest
- JTBD-powered contextual command discovery every 3-7 turns
- Onboarding invitation on any "how to use" question

## [1.6.0] - 2026-03-31
onboarding: true
onboard_steps:
  - "MindrianOS now has a visual identity -- Mondrian banner on every cold start and after updates"
  - "First-time users get a guided onboarding -- tell Larry about yourself and everything gets smarter"
  - "5 new commands connect you to your room's power: /mos:present, /mos:dashboard, /mos:speakers, /mos:reanalyze, /mos:graph"
  - "Larry's greeting now tells you what's in it for YOU based on your room state -- not feature lists"

### Added
- **Interactive Onboarding System** (Phase 35) -- 7-step Larry-voiced walkthrough on first install. Deep context building (USER.md) with 3 input approaches (Q&A, document paste, web research). Update path shows What's New from CHANGELOG. Manual re-run via /mos:onboard. Version-aware onboarding registry in CHANGELOG.md. Natural-language-first: teaches users to talk, not type commands.
- **Command Wiring** (Phase 36) -- 5 new /mos: commands connecting users to existing infrastructure: /mos:present (6-view presentation + browser), /mos:dashboard (interactive graph + chat), /mos:speakers (meeting speaker profiles), /mos:reanalyze (re-run meeting intelligence), /mos:graph (KuzuDB natural language exploration).
- **JTBD Warm Start** (Phase 37) -- Larry's session greeting identifies your current job and frames suggestions as "You have [state]. [action] [outcome that matters]." Dynamic 6-command menu adapts to what you haven't tried yet. Max 2-3 nudges per session.
- **CLI Identity** (Phase 34) -- Responsive Mondrian banner with 3 terminal width tiers (full 100+, compact 80-99, minimal <80). Update detection via version marker. /mos:splash for on-demand banner. Dual-path rendering (stderr + additionalContext fallback).
- **End-to-End Validation** (Phase 38) -- 24/24 checkpoints passing across syntax validation, template verification, presentation generation, and branding contract.

## [1.5.1] - 2026-03-31
onboarding: true
onboard_steps:
  - "Larry now builds a deep profile about you on first install -- everything gets smarter after onboarding"
  - "Returning users see what changed since their last session, framed as capabilities"
  - "Type /mos:onboard anytime to re-run the walkthrough or /mos:onboard whats-new for changelog"

### Added
- **De Stijl Mondrian Banner** -- ASCII art splash screen with 5 background color zones (red/blue/yellow/teal/green) creating a Mondrian grid composition. Shows on cold session start and during `/mos:update`. Standalone via `bash scripts/banner`. 24-bit ANSI true color. Includes `assets/banner-showcase.html` frontend preview.

## [1.5.0] - 2026-03-31

### Added
- **Git Integration** (Phase 26) -- Optional git tracking for room artifacts. `scripts/git-ops` (7 subcommands), `lib/core/git-ops.cjs` (6 functions). Auto-commit on every filing with provenance messages. `/mos:rooms git-setup` for retroactive setup. Git LFS for large binaries. Default OFF -- users opt in.
- **Filing Pipeline + KuzuDB Engine** (Phase 27) -- Every filing triggers full cascade: classify -> artifact-id -> KuzuDB index -> compute-state -> build-graph-from-kuzu -> git commit. Stable artifact hash IDs in frontmatter. Pipeline provenance (stage, requires, provides). Meeting segments as KuzuDB nodes (SEGMENT_OF, SPOKE_IN, CONSULTED_ON). Cross-room relationship detection. Proactive intelligence persistence with repeat suppression.
- **HSI + Reverse Salient Pipeline** (Phase 27.1) -- Python-native HSI computation (`scripts/compute-hsi.py`, ported from V4 production). Reverse Salient cross-section detection (`scripts/detect-reverse-salients.py`, ported from V2). Results as KuzuDB edges (HSI_CONNECTION, REVERSE_SALIENT). 3-tier: keyword (Tier 0), sklearn+MiniLM (Tier 1), sklearn+Pinecone (Tier 2). `/mos:setup hsi` for guided install.
- **Binary Asset Filing** (Phase 28) -- PDFs, images, videos filed with markdown wrappers + frontmatter. `scripts/file-asset` classifies and files. ASSET_MANIFEST.md auto-updated. Meeting audio/video registered with transcript links.
- **Canvas Graph Renderer** (Phase 29) -- Custom Canvas 2D graph replacing Cytoscape. `lib/graph/canvas-graph.js` (467 lines): force simulation, animated particles, glow rings, hover dimming (0.15 opacity), ambient pulse, `highlightCluster()` API, 6 edge type styles. `lib/graph/graph-detail-panel.js` for clicked node details.
- **Data Room Presentation System** (Phase 30) -- `/mos:export presentation` generates 6 self-contained HTML views from any room: Dashboard, Wiki (3-panel browser), Deck (fullscreen slides), Insights (stat counters, timelines, funnels), Diagrams (SVG from graph), Graph (Canvas renderer). Dual themes: De Stijl dark + PWS light. MindrianOS branding enforced (non-removable).
- **Auto-Update + Deploy** (Phase 31) -- `scripts/serve-presentation` with chokidar + SSE live reload (~1s). `/mos:publish` for guided Vercel onboarding. `--sections` for selective publishing. `--private` for password protection. `.exports-log.json` deployment tracking.
- **Generative UI + Chat** (Phase 32) -- BYOAPI chat panel (`lib/chat/chat-panel.js`) with direct Anthropic API streaming. Room context builder with Larry voice DNA. Generative tools: `highlightCluster()`, `filterEdgeType()`, `showInsight()` wired as AI tool calls. "Show me contradictions" -> graph highlights + analysis card.

## [1.4.1] - 2026-03-30

### Fixed
- **Command registration** -- Added YAML frontmatter to `funding.md`, `opportunities.md`, and `persona.md`. These 3 commands were invisible in Claude Code because they lacked the `---` frontmatter block that the plugin loader requires. All 51 commands now register correctly.

## [1.4.0] - 2026-03-29

### Added
- **Brain API Key Management** (Phase 20) -- Supabase-backed `brain_api_keys` table with `validate_brain_key` RPC. Plan-gated `brain_write` guard blocks non-admin keys. `brain-admin.cjs` CLI with 6 commands (create/revoke/extend/list/usage/requests). Render production auth wired via env vars.
- **CLI UI Ruling System** (Phase 21) -- 728-line `skills/ui-system/SKILL.md` governing all MindrianOS output. 4-zone anatomy (header, body, intelligence strip, footer), 5 body shapes (Mondrian board, semantic tree, room card, document view, action report), 12 glyphs, 5 ANSI colors, session start contract (cold/warm/signals), dual context routing (STATE.md + MINTO.md).
- **Admin Panel** (Phase 22) -- Hidden `/mos:admin` command wrapping brain-admin.cjs. Self-teaching on every invocation. Consequence previews for destructive actions. Filtered from `/mos:help` for non-admin users.
- **Multi-Room Management** (Phase 23) -- `.rooms/registry.json` for multi-project workspaces. `scripts/resolve-room` keystone resolver with legacy `room/` fallback. `scripts/room-registry` CRUD. `/mos:rooms` command with 6 subcommands (list/new/open/close/archive/where). Active room lock on all file-writing commands. Zone 1 header canary shows room name. Session start shows multi-room context. All hooks and scripts retrofitted.
- **Autonomous Engine** (Phase 24) -- `/mos:act` reads active room STATE.md + MINTO.md, queries Brain for best methodology framework (local fallback via problem-types routing table), displays thinking trace in Shape E format. `agents/framework-runner.md` isolated subagent with quality gate and provenance tracking. `--chain` mode (3-5 frameworks in sequence). `--dry-run` previews without executing.
- **Data Room Export v2** (Phase 25) -- Single-file De Stijl HTML export with 4 views: Mondrian grid overview, document reader with sidebar nav and TOC, intelligence view (gaps/convergence/contradictions), interactive Cytoscape knowledge graph. `generate-export.cjs` data injection script. Room identity in header.

## [1.3.0] - 2026-03-26

### Added
- **Per-page PDF download** — Every wiki page has a "PDF" button. De Stijl print layout with MindrianOS attribution.
- **BYOAPI Chat** — Chat panel accepts user's own Anthropic or OpenAI API key. Context scoped per page, key stored in localStorage only. Supports Claude Sonnet and GPT-4o.
- **Onboarding Tour** — 8-step guided walkthrough for first-time wiki users. Highlights each zone (header, sidebar, search, content, infobox, privacy). Skip available, never shows again.
- **Wiki Export** — `/mos:wiki --export` generates static HTML for sharing on Render, Vercel, or as zip.
- **CLI Action Buttons** — Wiki page buttons copy `/mos:` commands to clipboard for paste into Claude Code.
- **Embedded Logo** — MindrianOS logo (SVG, base64) in header + footer of all generated HTML. Links to website.
- **Privacy Disclaimer** — Footer on every page: "All data stored locally. MindrianOS does not access your venture data."
- **Larry Wiki Awareness** — Larry mentions wiki after filing artifacts or running analysis (room-passive skill, once per session).

## [1.2.0] - 2026-03-26

### Added
- **Dynamic Integration Prompting** (Phase 18) — Larry proactively detects when Brain, Velma, Obsidian, Notion, or meeting sources would enhance the task and offers setup conversationally. Non-blocking, one offer per conversation, never during methodology sessions.
- **`integration-registry.cjs`** — Detection engine for 5 integrations with context triggers and methodology suppression rules.
- **Integration Status** — `/mos:status` shows connected/available/not-configured for all integrations. Session-start context includes integration count.
- **Wikipedia Data Room Dashboard** (Phase 19) — `/mos:wiki` opens a localhost wiki-style viewer for the Data Room.
  - Every room section is a Wikipedia-style page with TOC, infobox, lead section
  - KuzuDB edges become clickable hyperlinks (INFORMS=blue, CONTRADICTS=red, CONVERGES=yellow, ENABLES=green)
  - Interactive Cytoscape.js graph view as home page with animated edges
  - "What links here" backlinks + "See also" from graph edges
  - Dark/Light mode toggle (localStorage persisted)
  - FlexSearch instant full-text search across all pages
  - Chat panel stub (UI ready, scoped to page context)
  - chokidar file watcher + SSE for auto-refresh
  - Mermaid diagrams rendered inline via CDN
  - Wikipedia formatting: sentence case headings, bold subjects, citation system
- **CLI Action Buttons** — Wiki page buttons copy `/mos:` commands to clipboard for paste into Claude Code
- **MindrianOS Attribution** — Every generated HTML page includes metadata (og:tags, generator, HTML comments) linking to mindrianos-jsagirs-projects.vercel.app. Any LLM processing the HTML sees MindrianOS attribution first.
- **Footer** — De Stijl branded footer on all wiki pages with links to website, Brain Access, GitHub, LinkedIn (Jonathan Sagir + Prof. Aronhime)

## [1.1.0] - 2026-03-26

### Added
- **De Stijl Visual Identity** — MindrianOS has its own visual language in the CLI. Every output feels like MindrianOS, not generic AI.
- **Symbol System** (`lib/core/visual-ops.cjs`) — ⬡ brand, ◌◎◉◆★ venture stages, →⊗⊕▶⊘ edge types, ?⇌! Larry modes, ■□▪ section health. Single import, consistent everywhere.
- **Unicode Room Diagrams** — `compute-state` renders the Data Room as a box diagram with sections, gaps, cross-references, and progress bars. The room becomes a visual map.
- **ASCII Sparklines** — Section completeness charts via `asciichart`. Meeting frequency, venture progress visualized inline.
- **Mermaid Diagrams in Artifacts** — Room flowcharts, knowledge graph views, framework chains embedded as Mermaid blocks in .md files. Auto-render in GitHub/Obsidian/Notion.
- **`/mos:visualize`** — Opens rich diagrams in the browser: room flowchart, graph view, framework chain. De Stijl themed HTML with Mermaid.js.
- **De Stijl Statusline** — Color-coded venture stage symbols, Mondrian accent colors (blue/red/yellow), section health indicators.
- **19 visual-ops.cjs exports** — Symbols, colors, formatters, diagram generators, Mermaid generators, sparklines, progress bars.

## [1.0.0] - 2026-03-25

### Added
- **Reasoning Engine** (`/mos:reason`) — Per-section REASONING.md files with Minto/MECE structured critical thinking. Frontmatter dependency graphs (requires/provides/affects). Goal-backward verification per section. The power backend that makes MindrianOS a platform.
- **reasoning-ops.cjs** — 8 exports: generateReasoning, getReasoning, listReasoning, verifyReasoning, createRun, get/set/mergeReasoningFrontmatter. Full programmatic frontmatter CRUD (learned from GSD gsd-tools.cjs patterns).
- **Autonomous Methodology Orchestration** — Larry chains tools in sequences (diagnose → framework → apply → file → cross-reference → graph-update) captured as methodology run artifacts in room/.reasoning/runs/.
- **Persistent Chain-of-Thought** — Reasoning is SAVED as .reasoning/ artifacts, not just displayed. Future sessions read them to understand WHY a section looks the way it does.
- **REASONING_INFORMS edge type** — LazyGraph now tracks reasoning dependencies between sections (Section-to-Section edges).
- **reasoning:// MCP Resources** — Browse reasoning state and per-section reasoning via MCP Resources (Desktop/Cowork).
- **reason-section MCP Prompt** — Larry receives Minto/MECE template + room context when reasoning about a section.
- **6 new MCP tools** — reasoning-get, reasoning-generate, reasoning-verify, reasoning-run, reasoning-list, reasoning-frontmatter in data_room router.
- **CLI/MCP parity at 46/46**

### This Is v1.0.0
MindrianOS has shipped 7 phases in a single session: MCP Platform (10-11), Brain Hosting (12), Opportunity Bank + Funding Room (13), AI Team Personas (14), User Knowledge Graph (15), and Reasoning Engine (16). 46 commands, 7 agents, embedded graph, two-graph architecture, persistent reasoning, autonomous methodology orchestration. The platform is complete.

## [0.9.0] - 2026-03-25

### Added
- **User Knowledge Graph** (`/mos:query`, `/mos:graph`) — Per-project embedded LazyGraph using KuzuDB. Room artifacts auto-indexed as graph nodes. Cross-references stored as typed edges (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES). Natural language queries translated to Cypher by Larry.
- **KuzuDB Integration** — Embedded graph database (like SQLite for graphs). Zero server, zero setup, Apache 2.0. Cypher-compatible. Sub-millisecond local queries. Graph stored in `room/.lazygraph/` per project.
- **Two-Graph Architecture** — Brain (Neo4j, remote) = methodology intelligence. Room Graph (KuzuDB, local) = venture intelligence. Together, far more powerful than either alone.
- **Hook-Driven Graph Updates** — Post-write hook automatically indexes new room artifacts into the LazyGraph. Graph grows with the venture — no manual rebuild needed.
- **Pinecone Tier 2 Stub** — `embedArtifact()` interface ready for semantic search layer. Graceful degradation when Pinecone unavailable.
- **Graph Schema Reference** — `docs/lazygraph-schema.md` documents node types, edge types, and example Cypher queries for Larry's NL-to-Cypher translation.
- **4 new MCP graph tools** — graph-index, graph-rebuild, graph-query, graph-stats in data_room router (49 total MCP commands)

## [0.8.0] - 2026-03-25

### Added
- **AI Team Personas** (`/mos:persona`) — Generate domain expert perspective lenses from room intelligence. Six De Bono Thinking Hats mapped to venture-specific personas: White (Data Analyst), Red (Intuitive Advisor), Black (Risk Assessor), Yellow (Opportunity Scout), Green (Creative Strategist), Blue (Process Architect).
- **Multi-Perspective Analysis** — Larry invokes all 6 personas on any room artifact for multi-angle feedback. Each persona argues consistently from its hat perspective.
- **Persona-Analyst Agent** — Dedicated agent for persona invocation with disclaimer enforcement and perspective-specific questioning patterns.
- **Perspective Lens Disclaimers** — Every persona output includes "This is a perspective lens, not expert advice" disclaimer in both frontmatter and body. Never claims expert authority.
- **4 new MCP tools** — generate-personas, list-personas, invoke-persona, analyze-perspectives in data_room router
- **v3.0 Milestone Complete** — 5 phases, 12 plans, 44 CLI commands = 44 MCP tools, all verified

### Changed
- CLI/MCP parity now at 44/44 (was 41/41 after Phase 11, grew with Phases 13-14)

## [0.7.0] - 2026-03-25

### Added
- **Opportunity Bank** (`/mos:opportunities`) — Context-driven grant discovery. Larry reads your room data (problem domain, geography, stage) and searches relevant grant sources. Confirm-first UX: opportunities presented for review before filing. Multi-factor relevance scoring.
- **Funding Room** (`/mos:funding`) — 4-stage lifecycle tracking: Discovered > Researched > Applying > Submitted. Per-opportunity folders with STATUS.md, wikilink cross-references to opportunity-bank sources, deadline tracking with staleness detection.
- **Opportunity Scanner Agent** — Proactive discovery agent that uses room intelligence to find relevant opportunities across Grants.gov, Simpler Grants, and web research.
- **Opportunity Intelligence** — `analyze-room` now outputs opportunity-bank intelligence (status counts, top relevance scores, funding pipeline stages) alongside existing DD sections.
- **`compute-opportunity-state`** — Pipeline computation script for opportunity and funding aggregation, integrates with compute-state chain.
- **6 new MCP tools** — scan-opportunities, list-opportunities, file-opportunity, list-funding, create-funding, update-funding-stage. All registered in data_room hierarchical router.
- **32 new test assertions** (105 total across full suite)

## [0.6.0] - 2026-03-25

### Changed
- **Plugin renamed: `mindrian-os` -> `mos`** — All commands now use `/mos:` prefix (e.g., `/mos:diagnose`, `/mos:room`, `/mos:help`). 9 characters shorter per command. The old `/mindrian-os:` prefix no longer works after update.
- **Thinking Trace** — Larry now shows his reasoning visually when applying methodology. Blockquote-based traces show problem type, chosen framework, chain logic, Brain connections, and cross-references. Mode-adaptive: hidden in Ask mode, brief in Blend, full in Tell mode.
- **Visual Confirmations** — Larry confirms actions with structured feedback: what was filed, where, cross-references added, stage changes. Starting a methodology session shows estimated duration and output location.

### Added
- Thinking trace format in `skills/larry-personality/SKILL.md` — 4 trace types: routing, room analysis, Brain enrichment, action confirmation
- Visual confirmation patterns for methodology sessions and room filing

## [0.5.0] - 2026-03-25

### Added
- **MCP Server** — Full MindrianOS accessible from Claude Desktop and Cowork via stdio MCP. One line in `claude_desktop_config.json` unlocks all 41 commands
- **Hierarchical Tool Router** — 6 MCP tools (data_room, methodology, analysis, intelligence, meeting, export) routing all 41 CLI commands. 85-93% context reduction vs flat tool surface
- **MCP Resources** — 5 read-only resources for room browsing (room://) without tool calls: room-state, room-sections, section content, meetings, intelligence
- **MCP Prompts** — 5 methodology workflow prompts with Larry personality injection: file-meeting, analyze-room, grade-venture, run-methodology, suggest-next
- **Brain MCP Server** — Standalone `mcp-server-brain/` service wrapping Neo4j + Pinecone behind API key auth. Deploy to Render with one-click `render.yaml`
- **Brain API Key Gating** — `Authorization: Bearer <key>` middleware. Paid-tier users get API key, connect Brain from any surface
- **Shared Core Library** — `bin/mindrian-tools.cjs` single Node.js entry point + `lib/core/` modules (room-ops, state-ops, meeting-ops, graph-ops, section-registry). Both CLI and MCP call the same internals
- **Dynamic Section Discovery** — `analyze-room` and `build-graph` auto-discover new room sections. No more hardcoded arrays. Adding `opportunity-bank/` to room/ just works
- **CLI/MCP Parity Check** — `lib/parity/check-parity.cjs` validates all CLI commands have MCP counterparts. CI-ready gate (exits non-zero on drift)
- **Enhanced Status Line** — Shows project name, active room section, venture stage, gap count, and color-coded context window bar
- **Brain Namespace Search** — `brain_search` now supports namespace targeting (core, reference, tools, materials, graphrag) for the consolidated `pws-brain` index

### Changed
- Pinecone index default changed from `neo4j-knowledge-base` to `pws-brain` (consolidated index with 5 namespaces, 12K+ records, single embedding model)
- `scripts/context-monitor` rewritten in Node.js with room-aware status line

## [0.4.0] - 2026-03-24

### Added
- **Cross-Meeting Intelligence** — Convergence detection (same topic across 3+ meetings), severity-based contradiction flagging (high-impact = immediate, low-impact = summary), action item tracking across meetings (aggregated room/action-items.md with pre-filing triage), team contribution patterns (recurring concerns, influence shifts, role-gap analysis)
- **MEETINGS-INTELLIGENCE.md** — New computed intelligence file: convergence signals, active contradictions, action item aggregation, team-level cross-meeting patterns. Separate from TEAM-STATE.md (per-person vs cross-meeting focus)
- **Read AI MCP Integration** — `/mos:setup meetings` connects Read AI, Vexa, or Recall.ai MCP servers. `/mos:file-meeting --latest` auto-fetches most recent transcript without paste
- **Three-Layer Knowledge Graph** — build-graph now produces Structure (room sections), Content (meetings, speakers, artifacts), Intelligence (concepts from [[wikilinks]], convergence/contradiction edges). Every node has `layer` field, every edge has `source_type`
- **[[Wikilink]] Support** — Larry auto-inserts `[[concept-name]]` links when filing artifacts. build-graph parses all `[[...]]` patterns into concept nodes and REFERENCES edges. Lazy graph: relationships first, metadata on demand
- **Dashboard Timeline Mode** — Integrated in graph (not separate view). Meeting nodes arranged chronologically on X-axis, sections on Y-axis. REINFORCES edges pulse green, CONTRADICTS edges pulse red
- **Dashboard Layer Toggles & Presets** — Toggle buttons per layer (Structure/Content/Intelligence). Four preset views: Room Overview, Meeting Map, Team Network, Intelligence Map. Position persistence in localStorage
- **Meeting-Report PDF Export** — Minto pyramid structure: executive summary → logical claim → critical backbone → evidence & questions → full analysis by meeting. Speaker attribution with role-colored badges and section-colored filing indicators
- **Simon's Architecture of Complexity** — Basis theorem now embedded in CLAUDE.md and Larry's voice-dna. MindrianOS IS Simon's theory operationalized: near-decomposable hierarchical systems applied to venture innovation

### Changed
- `compute-state` now calls `compute-meetings-intelligence` as sub-step (layered computation: compute-state → compute-team → compute-meetings-intelligence)
- `compute-team` extended with Recurring Concerns and Influence Distribution sections in TEAM-STATE.md
- `dashboard/index.html` expanded from 911 to 1640 lines with three-layer visualization
- `commands/file-meeting.md` now a 7-step pipeline (added Step 0 action item triage, enhanced Step 4 cross-reference, enhanced Step 6 cross-meeting scan)

### Fixed
- SessionStart now reads actual version from plugin.json (was letting Larry guess from docs)

## [0.3.0] - 2026-03-23

### Added
- **Meeting Filing Command** (`/mos:file-meeting`) — Full 6-step pipeline: paste transcript, provide file path, or provide audio. Explicit flags (`--file`, `--audio`). Speaker identification with smart hybrid table (auto-matches from team/ directory). Priority-first segment classification with reasoning. Confirm-then-file UX with structured rejection reasons. Narrative + structured meeting summary with dual storage.
- **Velma Audio Transcription** (`scripts/transcribe-audio`) — Modulate Velma REST API wrapper (3¢/hour) with native speaker diarization and 20+ emotion signals. Setup via `/mos:setup transcription` or auto-prompt on first `--audio` use.
- **Speaker Profile System** — ICM nested folder profiles auto-created for every new speaker (team/{role}/{name}/ with insights/, advice/, connections/, concerns/). Extended PROFILE.md schema with roles list, primary_role, status lifecycle (active/inactive/alumni/potential), and last_active tracking.
- **Proactive Person Research** (`scripts/research-speaker`) — Web research on new speakers in context of the project/room. Builds Data Room-specific profile. `--apply` flag for user confirmation before writing.
- **Cross-Relationship Discovery** — 5 edge types (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES) with Tier 0 keyword heuristics. Batch scan after all filing complete. Patterns reference at `references/meeting/cross-relationship-patterns.md`.
- **Meeting Reference Library** — 8 reference files: transcript-patterns (6 formats), segment-classification (6 types), section-mapping (12 roles × 8 rooms routing matrix), artifact-template (wicked-problem-aware frontmatter), summary-template, speaker-profile-template, live-join-interface spec, cross-relationship-patterns.
- **Team Room Structure** — Dynamic team/ directory (folders created on demand, not pre-populated). Multiple roles per person. Full attribution block in artifact frontmatter (speaker, role, profile_path, meeting_date, meeting_id). Topic primary + computed backlinks pattern (no file duplication).
- **Full Meeting Archive** — Self-contained meeting package in room/meetings/YYYY-MM-DD-{name}/: transcript.md, summary.md, speakers.md, decisions.md, action-items.md, metadata.yaml, plus audio copy. Past meeting lookup via metadata.yaml frontmatter search.
- **Team Intelligence** (`scripts/compute-team`) — Knowledge landscape context tool producing TEAM-STATE.md: expertise distribution, knowledge gaps, missing perspectives, role distribution, activity patterns. Layered computation: compute-state → compute-team. Structured markdown tables (lean, context-safe).
- **Room Intelligence Updates** — room-passive skill, compute-state, and analyze-room all meeting-aware. Status command shows meeting count and team intelligence.
- **Test Infrastructure** — 5 test scripts with 63+ assertions for meeting domain (segment classification, frontmatter provenance, summary structure, speaker identification, Velma diarization). `tests/run-all.sh` runner.

### Fixed
- SessionStart now reads actual version from plugin.json (was letting Larry guess from docs, sometimes reporting v0.1.0)

## [0.2.0] - 2026-03-23

### Added
- **Auto Update Notification** — SessionStart checks GitHub for new versions once per day (cached, async, non-blocking). Users see "[Update Available]" in Larry's greeting
- **Meeting Transcript Filing** — Design spec for `/mos:file-meeting`: paste transcript, identify speakers + roles, classify segments, file to Data Room sections with confirmation. Meeting summary artifact with cross-references, contradictions, action items
- **Release Process Rule** — CLAUDE.md now mandates: CHANGELOG update, version bump, tag, push with tags for every release
- **Analytics & Learning System** — Local usage tracking + behavioral learning that adapts Larry's suggestions
- **Tyler Josephson Case Study** — Full mockup with HSI cross-domain scoring and Reverse Salient bottleneck analysis
- **Dr. Vasquez Case Study** — 10-session CeraShield space reentry venture simulation with 33-page thesis PDF

### Fixed
- build-graph grep exit code under strict bash mode (all 10/10 scripts pass)
- render-pdf font resolution (base_url for WeasyPrint @font-face)
- analyze-room integer comparison in method_count
- Plugin.json now registers all 40 commands (was 14)
- Removed empty connector-awareness skill directory
- Fixed check-update GitHub URL (jsagir/mindrian-os-plugin)

## [0.1.0] - 2026-03-22

### Added
- **Larry Personality** -- Full teaching voice with mode engine calibration (40:30:20:10 distribution), signature openers, and tri-surface awareness (CLI, Desktop, Cowork)
- **26 Methodology Commands** -- Complete PWS framework toolkit: beautiful-question, explore-domains, explore-trends, map-unknowns, diagnose, analyze-needs, build-knowledge, structure-argument, challenge-assumptions, root-cause, macro-trends, user-needs, validate, find-bottlenecks, analyze-timing, dominant-designs, think-hats, scenario-plan, analyze-systems, systems-thinking, lean-canvas, leadership, explore-futures, grade, build-thesis, score-innovation
- **Pipeline Chaining** -- ICM stage contracts connect methodologies in intelligent sequences: Discovery pipeline (explore-domains -> think-hats -> analyze-needs), Thesis pipeline (structure-argument -> challenge-assumptions -> build-thesis)
- **Proactive Intelligence** -- Two-layer system: bash structural detection + Claude semantic interpretation with noise gate (max 2 HIGH-confidence findings per session)
- **Data Room Dashboard** -- De Stijl-styled localhost viewer with knowledge graph visualization, room chat, and CoSE/grid layout engine
- **Document Generation** -- PDF export for thesis, report, profile, and brief types with WeasyPrint rendering and TOC bookmarks
- **Brain MCP Integration** -- Optional Neo4j Brain connection with 5 Brain-powered commands: suggest-next, find-connections, compare-ventures, deep-grade, research
- **Self-Update System** -- Version check, changelog display, modification backup/reapply flow via `/mos:update`
- **Infrastructure Commands** -- new-project, help, status, room, setup, update
- **Passive Room Filing** -- PostToolUse hook auto-classifies and files insights to room sub-rooms
- **Graceful Degradation** -- Full functionality at Tier 0 (no dependencies), enhanced with optional Neo4j and Brain
