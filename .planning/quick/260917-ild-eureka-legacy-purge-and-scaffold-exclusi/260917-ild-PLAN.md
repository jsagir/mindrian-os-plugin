---
phase: quick-260917-ild
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/test-260917-dgf-part8-hook-disposition.cjs
  - lib/core/brain-response-sanitize.cjs
  - scripts/part8-egress-guard-hook.cjs
  - tests/test-eureka-scaffold-entity-noise.cjs
  - lib/core/navigation/typed-entity.cjs
  - scripts/entity-extract.cjs
  - lib/core/eureka/scaffold-template-index.cjs
  - lib/core/navigation/room-birth.cjs
  - lib/core/feynman/feynman-seed-writer.cjs
  - tests/run-all-218.sh
autonomous: true
requirements: [ILD-F1, ILD-F2, ILD-F3, ILD-F4]
canon_parts: [8, 9, 6, 7]

must_haves:
  truths:
    - "An ambiguous freeform_unmatched payload on mcp__pws-brain-mcp__brain_search exits 2 from the PreToolUse hook (direct HTTPS connector, the shim's second classification never runs there)"
    - "The same payload on mcp__mindrian-brain__brain_search and on mcp__plugin_mos_mindrian-brain__brain_search exits 0 (both provably route through bin/mindrian-brain-mcp-client.cjs into brain-client.cjs::callTool)"
    - "isBrainTool and BRAIN_TOOL_MATCHER and BRAIN_SHAPED_TOOL_MATCHER and hooks/hooks.json are byte-unchanged"
    - "A legacy self-referential entity row whose DESCRIBES edges do not ALL land on scaffold-kind memory_artifact anchors survives a full run and is counted in legacy_entities_kept"
    - "A legacy self-referential entity row with review_status other than proposed or NULL (rejected, confirmed, superseded, anything) survives a full run with its review_status unchanged, even when its name appears in an extraction input"
    - "A scoped run (options.paths present) purges nothing: legacy_entities_purged is 0 and every legacy row remains"
    - "A failure inside the entity write loop leaves every legacy row in place (the purge runs only after the replacement writes commit)"
    - "A scaffold file whose body matches the shipped template is excluded from extraction only on that content test, not on its basename, and is still carried through the frontmatter metadata pass"
    - "A scaffold file that differs from its shipped template has the template text stripped and the authored remainder extracted; scaffold_files_extracted counts it and scaffold_files_skipped counts only template-identical files"
  artifacts:
    - path: "lib/core/brain-response-sanitize.cjs"
      provides: "isShimBackedBrainTool, the narrow shim-backed-route predicate beside the byte-unchanged isBrainTool trust predicate"
      contains: "isShimBackedBrainTool"
    - path: "scripts/part8-egress-guard-hook.cjs"
      provides: "Ambiguous-verdict allow narrowed to shim-backed scopes only"
      contains: "isShimBackedBrainTool"
    - path: "lib/core/navigation/typed-entity.cjs"
      provides: "Purge signature bound to proposed-or-NULL rows whose every DESCRIBES edge lands on a scaffold-kind memory_artifact, with a kept count"
      contains: "scaffoldKinds"
    - path: "lib/core/eureka/scaffold-template-index.cjs"
      provides: "Load-time index of the shipped scaffold templates, plus isTemplateIdentical and stripTemplate"
      min_lines: 80
    - path: "scripts/entity-extract.cjs"
      provides: "Purge moved after the committed write loop and guarded to full-room runs; content-based scaffold exclusion; metadata pass over every artifact-backed file"
      contains: "legacyEntitiesKept"
    - path: "tests/test-eureka-scaffold-entity-noise.cjs"
      provides: "Legs 5 to 9: authored scaffold, mixed-edge legacy row, rejected row, scoped run, ordering"
      contains: "legacy_entities_kept"
    - path: "tests/test-260917-dgf-part8-hook-disposition.cjs"
      provides: "Cases G and H: direct connector blocks, project-scope shim allows"
      contains: "mcp__pws-brain-mcp__brain_search"
  key_links:
    - from: "scripts/part8-egress-guard-hook.cjs"
      to: "lib/core/brain-response-sanitize.cjs isShimBackedBrainTool"
      via: "the ambiguous branch consults the shim-backed predicate instead of the trust predicate"
      pattern: "isShimBackedBrainTool\\(toolName\\)"
    - from: "scripts/entity-extract.cjs"
      to: "lib/core/navigation.cjs purgeLegacySelfReferentialEntities"
      via: "single call after db.exec('COMMIT') succeeds, guarded by the absence of options.paths, carrying the scaffold-kind vocabulary"
      pattern: "purgeLegacySelfReferentialEntities\\(db, \\{"
    - from: "scripts/entity-extract.cjs collectArtifacts"
      to: "lib/core/eureka/scaffold-template-index.cjs"
      via: "content test replacing the kind-plus-basename exclusion"
      pattern: "isTemplateIdentical"
    - from: "lib/core/eureka/scaffold-template-index.cjs"
      to: "templates/room-skeleton"
      via: "readdirSync at load time, kind derived from the template filename, never a hand-typed body"
      pattern: "room-skeleton"
---

<objective>
Close the four findings of the 2026-09-17 Codex adversarial review of c54747df6..HEAD.
Beta.43 is already on npm at latest; this work becomes 2.0.0-beta.45.

Purpose: three shipped changes overreach. (F1) The Part 8 hook's new ambiguous allow
keys on isBrainTool, which also trusts mcp__pws-brain-mcp__*, a direct HTTPS connector
with no local plugin code in its path, so the shim's second classification that
justifies the allow never runs on that route. (F2 plus F3) The legacy entity purge runs
room-wide before scoping, before the replacement writes, with a signature that matches
every legacy row including rows extracted from real artifacts, and it protects only
confirmed rows, so a human rejection is erased and recreated as proposed. (F4) Scaffold
files are excluded from extraction by kind plus basename, which drops authored MINTO and
FEYNMAN content and skips the frontmatter metadata pass for those files.

The canon argument, stated once for the whole plan:
- Part 8. Task 1 NARROWS an allow and widens nothing. Every scope that blocks today keeps
  blocking; two scopes that route through bin/mindrian-brain-mcp-client.cjs keep the
  allow the shim's own egress_disclosure already justifies; mcp__pws-brain-mcp__* and
  mcp__theo__* return to exit 2 on ambiguity. The classifier
  (lib/core/part8-egress-guard.cjs) and the trust predicate (isBrainTool) are
  byte-unchanged. Nothing new crosses to the Brain in any task: Tasks 2 and 3 are pure
  LOCAL SQLite and local file reads, zero network surface.
- Part 9. Only a human confirms a truth-claim node and only a human closes one. The
  narrowed purge deletes only machine-authored rows still in the machine state
  (review_status proposed or NULL) whose provenance is entirely scaffold anchors. Any
  other review state, any row with a real content provenance edge, and any row with no
  DESCRIBES edge at all, survives and is counted. Deletion is bounded by proof, not by
  pattern.

Output: one narrower hook predicate, one narrower purge with an honest kept count, one
content-based scaffold exclusion, and the test legs that pin all three.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md

Hook and predicates:
@scripts/part8-egress-guard-hook.cjs
@lib/core/brain-response-sanitize.cjs
@lib/mcp/brain-composition-census.cjs
@tests/test-260917-dgf-part8-hook-disposition.cjs

Purge and extraction:
@lib/core/navigation/typed-entity.cjs
@scripts/entity-extract.cjs
@lib/core/eureka/research-filing.cjs
@tests/test-eureka-scaffold-entity-noise.cjs

Interfaces the executor needs and should not rediscover:
- .mcp.json registers exactly one Brain server key, "mindrian-brain", whose command is
  bin/mindrian-brain-mcp-client.cjs; that shim requires lib/core/brain-client.cjs and every
  handler delegates to callTool. So mcp__mindrian-brain__* (project scope) and
  mcp__plugin_mos_mindrian-brain__* (plugin scope) are the ONLY shim-backed shapes.
  mcp__pws-brain-mcp__* is an externally registered direct HTTPS connector.
- lib/core/navigation.cjs line 365 re-exports typed-entity.purgeLegacySelfReferentialEntities
  as a bare function reference, so an added second parameter passes through with no edit
  to navigation.cjs. Refresh the comment block above that line only.
- lib/core/memory/reconcile-memory-runner.cjs BASENAME_TO_KIND is the only place a real
  room assigns a memory kind, and every entry has the shape "<KIND>.md" -> "<KIND>".
  That shape, not a copied list, is the derivation rule for a kind basename.
- lib/core/room-skeleton-scaffold.cjs reads templates/room-skeleton by explicit filename
  and substitutes {{TOKEN}} through renderTemplate. Templates on disk today:
  ROOM.md.identity.tmpl, ROOM.md.section.tmpl, STATE.md.tmpl, MINTO.md.tmpl, USER.md.tmpl.
  BRAIN.md and FEYNMAN.md have no template file: the BRAIN stub body is the in-code string
  in lib/core/navigation/room-birth.cjs::_writeBrainStub and the FEYNMAN default seed is the
  fallback string in lib/core/feynman/feynman-seed-writer.cjs::seedSection.
- runExtraction already carries test seams on opts: classifyImpl, embedClassifyImpl,
  _forceNoLlm. The new failure seam joins that family.
- Both test files are ALREADY registered: tests/run-all-196.sh line 86 and
  tests/run-all-218.sh line 183. No new registration is required; refresh the registration
  comment in run-all-218.sh in Task 3 so it describes the content-based contract.

House rules that bind every task: CJS only, zero new dependencies, no em-dashes and no
en-dashes anywhere, fixed SQL text with bound parameters only (scripts/check-substrate.cjs
rule m4 refuses assembled SQL or Cypher), every graph write and the one sanctioned deletion
through the navigation door. Do NOT touch lib/core/brain-client.cjs,
lib/core/part8-egress-guard.cjs, hooks/hooks.json, or the definition of isBrainTool.
Shared tree: two other sessions commit here. Stage by explicit path only, never git add -A,
and never revert or restage a diff this executor did not create.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Narrow the ambiguous allow to shim-backed Brain scopes (F1)</name>
  <files>tests/test-260917-dgf-part8-hook-disposition.cjs, lib/core/brain-response-sanitize.cjs, scripts/part8-egress-guard-hook.cjs</files>
  <behavior>
    - Case G: brain_search with tool_input {query:"effectuation"} on mcp__pws-brain-mcp__brain_search with PART8_FORCE_BRAIN_AVAILABLE=1 exits 2 with non-empty stderr. RED today (exits 0).
    - Case H: the same payload on mcp__mindrian-brain__brain_search exits 0 with no Part 8 text on stderr. Green today, pinned so the narrowing does not overshoot into the project scope.
    - LEG 0 addition: both new tool names still classify as verdict ambiguous, class freeform_unmatched, so case G's exit 2 is proven to come from the disposition and not from a different classification.
    - LEG 2 additions: isBrainTool on the direct connector stays true (the trust predicate is unchanged); isShimBackedBrainTool is false on the direct connector and on mcp__theo__brain_search, and true on both the plugin scope and the project scope.
    - Cases A1 to A4, B, C, D, E, F stay exactly as they are.
  </behavior>
  <action>
Write the test additions FIRST and record the RED run (case G failing, everything else
green) in the summary.

Add to the hand-typed literal block in tests/test-260917-dgf-part8-hook-disposition.cjs:
DIRECT_SEARCH set to mcp__pws-brain-mcp__brain_search and PROJECT_SEARCH set to
mcp__mindrian-brain__brain_search. Extend LEG 0 with those two names over the
{query:"effectuation"} payload. Extend leg1HookDisposition with case G and case H as
described in the behavior block, using the existing runHook and envelope helpers. Extend
leg2PredicateSelfValidation with the four isShimBackedBrainTool assertions plus the
isBrainTool-on-direct-connector assertion. Update the file docblock to name this Codex
finding F1, to state that isBrainTool remains the trust predicate for other consumers and
is untouched, and to state why the direct connector cannot carry the allow: no local
plugin code sits in its path, so brain-client.cjs::callTool never re-classifies there.

Then add the predicate in lib/core/brain-response-sanitize.cjs, immediately after
isBrainTool, never inside it. Add SHIM_BACKED_BRAIN_TOOL_MATCHER with the value
mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.* , a module-scope anchored RegExp built
the same way _BRAIN_TOOL_RE is built, and isShimBackedBrainTool(toolName) returning a
boolean with the same defensive typeof guard the sibling predicates use. Export both.
BRAIN_TOOL_MATCHER, BRAIN_SHAPED_TOOL_MATCHER, isBrainTool, isBrainShapedTool and
hooks/hooks.json stay byte-unchanged. Write a docblock stating: there are now three
predicates answering three different questions, trust (isBrainTool), inspection scope
(isBrainShapedTool), and route (isShimBackedBrainTool: does this scope provably reach
bin/mindrian-brain-mcp-client.cjs, so brain-client.cjs::callTool's second classification
and its egress_disclosure actually run); cite the Codex F1 finding and
lib/mcp/brain-composition-census.cjs's ruling that pws-brain-mcp is direct HTTPS with no
local plugin code in the path; name .mcp.json's single mindrian-brain server key as the
reason the pattern drops the pws-brain-mcp alternation; keep the same bounded
[a-z0-9_-]+ plugin-prefix class and the same anti-impersonation reasoning as
_BRAIN_TOOL_RE.

Then edit scripts/part8-egress-guard-hook.cjs. In the ambiguous branch, replace the
isBrainTool call with isShimBackedBrainTool and rename the local variable from trusted to
shimBacked. Rename TRUSTED_AMBIGUOUS_ALLOW_CLASSES to SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES
with the same two members, freeform_unmatched and unknown. Keep the defensive wrap
exactly as it is: a predicate throw degrades to false, which keeps the block, never the
allow. Update the header docblock paragraphs that quick task 260917-dgf added so they
state the narrowed policy and cite F1: the allow now covers only scopes with a second
enforcement point behind them, every other Brain-shaped name including
mcp__pws-brain-mcp__* and mcp__theo__* keeps exit 2 on ambiguity, and the Tri-Polar note
is corrected to say Desktop resolves the plugin scope through the same shim.

Commit code and tests only, staging by explicit path, with the message
"fix(part8): narrow the ambiguous-verdict allow to shim-backed Brain scopes" and the
trailer line "Co-Authored-By: Claude Fable 5.1 &lt;noreply@anthropic.com&gt;".
  </action>
  <verify>
    <automated>node tests/test-260917-dgf-part8-hook-disposition.cjs &amp;&amp; node tests/test-brain-response-sanitize.cjs &amp;&amp; node tests/test-260906-gr1-brain-shaped-tool-gate.cjs &amp;&amp; node tests/test-213-part8-boundary.cjs &amp;&amp; bash tests/run-all-196.sh</automated>
  </verify>
  <done>Case G exits 2 and case H exits 0; every pre-existing case and leg is green; git diff shows no change inside isBrainTool, BRAIN_TOOL_MATCHER, BRAIN_SHAPED_TOOL_MATCHER, hooks/hooks.json, lib/core/brain-client.cjs or lib/core/part8-egress-guard.cjs.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Bound the legacy purge by provenance, review state, scope and ordering (F2, F3)</name>
  <files>tests/test-eureka-scaffold-entity-noise.cjs, lib/core/navigation/typed-entity.cjs, scripts/entity-extract.cjs</files>
  <behavior>
    - Leg 6, mixed-edge legacy row: a self-referential row with one DESCRIBES edge to a scaffold anchor and one DESCRIBES edge to a non-scaffold memory_artifact survives a full run, and status.json legacy_entities_kept counts it.
    - Leg 7, rejected row: a self-referential row with review_status rejected, whose name also appears in a content artifact, survives a full run with review_status still rejected.
    - Leg 8, scoped run: runExtraction called with an options.paths subset on a room holding template-only legacy rows returns legacyEntitiesPurged 0 and leaves every row in place.
    - Leg 9, ordering: a full run with the injected write-loop failure seam rejects, and every legacy row is still present afterwards.
    - Leg 4 keeps its existing assertions: the three template-only rows purge, Keeper Corp and Confirmed Co survive, purged edge count 3.
  </behavior>
  <action>
Write the four new legs FIRST, in tests/test-eureka-scaffold-entity-noise.cjs, following
the existing checkAsync and mkFixtureRoom idioms, and record the RED run.

Leg 6 seeds a fresh fixture room, seeds the scaffold nodes, then seeds one NON-scaffold
memory_artifact node for an existing content file (properties carrying section and path,
no kind key, source_path a real room-relative path, epistemic_type observation) and one
legacy entity row with the self-referential source_path shape plus two DESCRIBES edges,
one to memory_artifact:business-model:ROOM and one to the non-scaffold node. Run through
entityExtract.main([room, 'run']) and assert the row is still present and that status.json
legacy_entities_kept counts it.

Leg 7 seeds a legacy row with review_status rejected and a DESCRIBES edge only to a
scaffold anchor, and writes a content file naming that row's two-word name so the name is
present in an extraction input. After a full run assert the row is present and its
review_status column still reads rejected. Note in a comment that the freshly extracted
entity lands under a different node id, minted from the run's own sessionId, so survival
is not an artifact of an UPSERT collision.

Leg 8 seeds template-only legacy rows, opens the db directly and calls runExtraction with
{ paths: ['business-model/pricing-notes.md'], _forceNoLlm: true, embedClassifyImpl:
forceEmbedFail }, then asserts result.legacyEntitiesPurged is 0 and every seeded row is
still in the nodes table. This is the leg that proves research-filing's scoped caller can
never trigger a room-wide deletion.

Leg 9 seeds template-only legacy rows and calls runExtraction with the new failure seam
plus the same offline options, asserts the call rejects (assert.rejects), then asserts
every legacy row is still present. Comment that this is the ordering proof: the purge runs
only after the replacement writes commit.

Then rewrite the purge in lib/core/navigation/typed-entity.cjs. Change the signature to
purgeLegacySelfReferentialEntities(db, opts) where opts.scaffoldKinds is an array or Set of
memory kinds that count as scaffold anchors. Behaviour:
(1) Candidate selection SQL keeps the id LIKE and source_path LIKE and type IN filters and
    changes the review_status filter from "not confirmed" to "proposed or NULL": any other
    value, including rejected and superseded and any future value, is not a candidate. Cite
    Codex F3 and Canon Part 9 in the comment: code never overrides a human review state,
    and a rejection erased and recreated as proposed is exactly the harm the UPSERT already
    protects against.
(2) For each candidate, read its DESCRIBES edges with the fixed statement
    SELECT target FROM edges WHERE source = ? AND edge_type = 'DESCRIBES', and for each
    target read the node with SELECT id, type, properties FROM nodes WHERE id = ?. The row
    is DELETABLE only when it has at least one DESCRIBES edge and EVERY target resolves to
    a node of type memory_artifact whose parsed properties.kind is a member of
    scaffoldKinds. Any unresolved target, any non-memory_artifact target, any target whose
    kind is absent or outside scaffoldKinds, and the zero-DESCRIBES-edge case, all make the
    row KEPT. State the zero-edge ruling explicitly in the comment: a row whose boilerplate
    provenance cannot be PROVEN is kept, because this primitive deletes on proof, not on
    pattern.
(3) When scaffoldKinds is missing or empty, delete nothing and return ok true with
    purgedNodes 0, keptNodes equal to the candidate count, and reason no_scaffold_kinds.
    A caller that forgets the anchor vocabulary must get a no-op, never a room-wide sweep.
(4) Deletions stay inside one transaction of their own, per-id prepared statements, fixed
    SQL text, no assembled IN list. Return { ok, purgedNodes, purgedEdges, keptNodes }.
Update the docblock to name Codex findings F2 and F3, to record the measurement that
motivated the change (528 legacy rows on the reporting room, 526 scaffold-only, 2 with a
non-scaffold edge that the old signature would have wrongly deleted), and to restate the
Part 9 argument.

Then edit scripts/entity-extract.cjs:
(a) Delete the purge block at the top of runExtraction. Move it to immediately AFTER the
    batch db.exec('COMMIT') returns and BEFORE the triModal.indexNodes call, wrapped in a
    guard on the absence of options.paths. Pass the scaffold-kind vocabulary from the one
    in-file source of scaffold kinds, the keys of SCAFFOLD_KIND_BASENAME today, so Task 3
    can re-source that map without touching this call site. Keep the existing best-effort
    logMemoryEvent and the stderr disclosure on a skipped or failed purge.
(b) Thread legacyEntitiesKept through tier2Result and out to status.json as
    legacy_entities_kept, alongside the existing legacy_entities_purged and
    legacy_edges_purged. On a scoped run, add the honest key legacy_purge_skipped with the
    value scoped_run and leave the three counts at 0.
(c) Add the test-only failure seam: when options._failWriteLoop is true, throw inside the
    batch try block after the entity and edge writes and before db.exec('COMMIT'), so the
    existing ROLLBACK path runs and the error propagates out of runExtraction. Comment that
    this seam exists for leg 9 and names the ordering contract it proves.
Refresh the comment above lib/core/navigation.cjs line 365 so the door's description
matches the narrowed signature; do not change the re-export itself.

Commit code and tests only, staging by explicit path, with the message
"fix(eureka): bound the legacy entity purge by provenance, review state and run scope" and
the trailer line "Co-Authored-By: Claude Fable 5.1 &lt;noreply@anthropic.com&gt;".
  </action>
  <verify>
    <automated>node tests/test-eureka-scaffold-entity-noise.cjs &amp;&amp; node scripts/check-substrate.cjs &amp;&amp; node tests/test-216-room-substrate.cjs &amp;&amp; node tests/test-213-sensor-eureka.cjs &amp;&amp; bash tests/run-all-218.sh</automated>
  </verify>
  <done>Legs 1 through 9 green (the nine pre-existing epistemic_type reds in run-all-218 are known and unchanged); status.json carries legacy_entities_kept; the purge call site sits after the COMMIT and inside the full-room guard; no assembled SQL anywhere in the diff.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Exclude a scaffold file on template match, never on basename (F4)</name>
  <files>lib/core/eureka/scaffold-template-index.cjs, lib/core/navigation/room-birth.cjs, lib/core/feynman/feynman-seed-writer.cjs, scripts/entity-extract.cjs, tests/test-eureka-scaffold-entity-noise.cjs, tests/run-all-218.sh</files>
  <behavior>
    - Leg 5, authored scaffold: a MINTO.md carrying the shipped template body PLUS an authored governing thought naming a two-word concept (no figures anywhere, Part 8 figure guard) yields that concept as an entity after a full run, status.json scaffold_files_extracted is at least 1, and the metadata pass ran for that file (its memory_artifact node carries the frontmatter scalar the fixture put there).
    - Leg 1 keeps its counts: the fixture's template-identical scaffold files are skipped as extraction input and collectArtifacts still returns exactly the content artifacts.
    - Leg 2 keeps its claim: no template vocabulary surfaces as an entity name, now measured against vocabulary drawn from the shipped template bodies rather than hand-written fixture prose.
    - A template-identical scaffold file still reaches applyArtifactMetadata: assert one such file's memory_artifact node picked up a frontmatter scalar key.
  </behavior>
  <action>
Create lib/core/eureka/scaffold-template-index.cjs, a pure-local zero-dependency CJS
module that builds its index once at load time and never throws.

Derivation, never a hand-typed body or list:
- Read templates/room-skeleton with readdirSync and take every entry matching a filename
  of the shape KIND.md optionally followed by a variant segment and ending in .tmpl. The
  kind is the leading segment before .md, so ROOM.md.identity.tmpl and
  ROOM.md.section.tmpl both feed kind ROOM, and STATE.md.tmpl, MINTO.md.tmpl and
  USER.md.tmpl feed their own kinds. Multiple template files for one kind merge into one
  matcher set.
- BRAIN and FEYNMAN have no template file. Source their bodies from the modules that write
  them: require lib/core/navigation/room-birth.cjs and lib/core/feynman/feynman-seed-writer.cjs
  lazily inside the build step, each in its own try and catch, and read an exported seed
  constant. Add those exports in this task: in room-birth.cjs extract the BRAIN stub body
  out of _writeBrainStub into a module-scope template constant using the same {{TOKEN}}
  convention the room-skeleton templates use for the room slug, have _writeBrainStub render
  from it, and export it additively; in feynman-seed-writer.cjs extract the default seed
  sentence in seedSection into a module-scope constant, use it there, and export it
  additively. Neither module's behaviour changes. If a require or an export is missing, that
  kind simply has no template and is therefore NEVER excluded: extraction wins over
  exclusion, because losing authored content is the failure this finding is about.
- The kind basename is kind plus .md, the shape every entry of BASENAME_TO_KIND in
  lib/core/memory/reconcile-memory-runner.cjs already has. Derive it, do not copy a list.

Matching, normalised and token-aware:
- Normalise a body by dropping a leading YAML frontmatter block, lowercasing, trimming each
  line, collapsing internal whitespace runs to one space, and dropping empty lines.
- Turn each normalised template line into an anchored RegExp by escaping the literal text
  and replacing each {{TOKEN}} with a permissive wildcard, so a rendered section name or
  statement still matches its template line.
- Export isTemplateIdentical(kind, body): true when the kind has at least one matcher and
  every normalised line of the body matches at least one matcher for that kind.
- Export stripTemplate(kind, body): the original lines whose normalised form matches no
  matcher, joined back together; that is the authored remainder.
- Export SCAFFOLD_KINDS (the derived Set) and a kind-to-basename accessor.

Then edit scripts/entity-extract.cjs collectArtifacts:
- Replace the SCAFFOLD_KIND_BASENAME plus isScaffoldArtifact kind-and-basename exclusion.
  A memory_artifact row is a scaffold CANDIDATE when its kind is in SCAFFOLD_KINDS and its
  basename equals that kind's basename (the same protection the current comment describes
  for fixtures that tag a scaffold kind on an arbitrary path stays intact). For a candidate,
  READ the file off disk, then branch on content: template-identical means excluded from
  extraction input and scaffoldFilesSkipped incremented; different means run stripTemplate
  and, when the authored remainder is non-empty, push it as an ordinary exact artifact with
  the real relPath and increment scaffoldFilesExtracted; an empty remainder counts as
  template-identical.
- Keep EVERY artifact-backed file in the metadata pass. Do not push template-identical files
  into the returned artifact array, because that array is the extraction-input contract leg
  1 pins. Instead carry them on an additive property in the same style as
  scaffoldFilesSkipped, for example artifacts.metadataOnly, each entry holding artifactId,
  text, relPath and exact true; runExtraction's metadata loop then iterates the exact
  artifacts followed by that list, so applyArtifactMetadata runs for template-identical
  scaffold files too.
- Thread scaffoldFilesExtracted through tier2Result to status.json as
  scaffold_files_extracted, and keep scaffold_files_skipped meaning template-identical files
  only. Update the module comment to cite Codex F4 and state the new rule in one sentence.

Then update tests/test-eureka-scaffold-entity-noise.cjs:
- The fixture's five hand-written SCAFFOLD_BODY strings are no longer a valid stand-in for a
  shipped scaffold once the test is content-based. Build the fixture's scaffold bodies from
  the shipped sources instead: render the room-skeleton templates through
  lib/core/room-skeleton-scaffold.cjs renderTemplate with per-section substitutions, and use
  the exported BRAIN and FEYNMAN seed constants. Keep the fixture byte-identical per kind
  across sections where the template has no per-section token, exactly as the Decision-15
  shape it models.
- Re-derive SCAFFOLD_VOCAB from those rendered bodies rather than from the retired
  hand-written prose, so leg 2 still proves template vocabulary never surfaces.
- Add leg 5 as described in the behaviour block: one section's MINTO.md carries the rendered
  template PLUS an authored governing thought naming a two-word concept and a frontmatter
  scalar the metadata pass can lift; assert the concept is an entity, assert
  scaffold_files_extracted is at least 1, assert the MINTO memory_artifact node carries the
  frontmatter scalar, and assert a template-identical scaffold file's node also carries its
  own frontmatter scalar so the metadata pass is proven for both branches.
- Refresh the file docblock and the run-all-218.sh registration comment so both describe the
  content-based contract instead of the retired kind-plus-basename one.

Commit code and tests only, staging by explicit path, with the message
"fix(eureka): exclude a scaffold file on template match, keep authored scaffold content" and
the trailer line "Co-Authored-By: Claude Fable 5.1 &lt;noreply@anthropic.com&gt;".
  </action>
  <verify>
    <automated>node tests/test-eureka-scaffold-entity-noise.cjs &amp;&amp; node tests/test-216-field-contract.cjs &amp;&amp; node tests/test-216-room-substrate.cjs &amp;&amp; node tests/test-213-sensor-eureka.cjs &amp;&amp; bash tests/run-all-218.sh &amp;&amp; bash tests/run-all-196.sh</automated>
  </verify>
  <done>Legs 1 through 9 green; status.json carries both scaffold_files_skipped and scaffold_files_extracted; no hand-typed template body or basename list anywhere in the diff; room-birth.cjs and feynman-seed-writer.cjs changes are additive extractions with no behaviour change.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| model-issued MCP call to a Brain scope | untrusted free-form args cross toward a remote backend; the PreToolUse hook is the first enforcement point and the shim is the second |
| room.db rows written by a human review action | a human review state is authoritative and code must never overwrite it |
| room files on disk read as extraction input | authored user content must never be silently dropped from the local graph |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ild-01 | Information disclosure | scripts/part8-egress-guard-hook.cjs ambiguous branch | mitigate | Task 1 restricts the allow to the two shim-backed scopes, so an ambiguous payload on a route with no second classification returns to exit 2; case G pins it |
| T-ild-02 | Spoofing | isShimBackedBrainTool pattern | mitigate | Anchored RegExp with the bounded [a-z0-9_-]+ plugin-prefix class, mirroring _BRAIN_TOOL_RE, so a foreign server whose name merely contains mindrian-brain cannot gain the allow |
| T-ild-03 | Denial of service (data loss) | purgeLegacySelfReferentialEntities | mitigate | Deletion requires proof: proposed-or-NULL review state, at least one DESCRIBES edge, every target a scaffold-kind memory_artifact, full-room run only, after the replacement writes commit; legs 6 to 9 pin each clause |
| T-ild-04 | Repudiation | human review states in room.db | mitigate | Task 2 protects every review state that is not proposed or NULL; leg 7 proves a rejection survives a rescan that names the row |
| T-ild-05 | Tampering (data loss) | collectArtifacts scaffold exclusion | mitigate | Task 3 excludes only on a content match against the shipped template and extracts the authored remainder otherwise; leg 5 proves an authored MINTO reaches both extraction and the metadata pass |
| T-ild-SC | Tampering | package-manager installs | accept | Zero new dependencies in this task; no npm, pip or cargo install runs, so no package legitimacy gate applies |
</threat_model>

<verification>
After every task, run the standing set and compare against the known baseline:
bash tests/run-all-196.sh, bash tests/run-all-218.sh (the nine pre-existing epistemic_type
reds are known and must stay exactly nine and the same nine),
node tests/test-213-sensor-eureka.cjs, node tests/test-213-part8-boundary.cjs,
node tests/test-216-field-contract.cjs, node tests/test-216-room-substrate.cjs,
node tests/test-260906-gr1-brain-shaped-tool-gate.cjs.

Also run node scripts/check-substrate.cjs after Task 2 and Task 3 (fixed SQL only), and
confirm with git diff that lib/core/brain-client.cjs, lib/core/part8-egress-guard.cjs,
hooks/hooks.json and the body of isBrainTool are untouched.

Record the RED run of each task's new test legs in the summary, with the failing case names
and the exit codes or counts observed, before the fix lands.
</verification>

<success_criteria>
- Case G exits 2 and case H exits 0; every pre-existing hook case and leg stays green.
- Legs 1 through 9 of the scaffold entity-noise test are green.
- status.json carries legacy_entities_purged, legacy_edges_purged, legacy_entities_kept,
  scaffold_files_skipped and scaffold_files_extracted, with legacy_purge_skipped on a
  scoped run.
- A scoped run through the research-filing entry deletes nothing.
- A write-loop failure leaves every legacy row in place.
- No new dependency, no em-dash or en-dash, no assembled SQL, no touched file outside the
  declared list, three commits with the required trailer.
</success_criteria>

<output>
Create `.planning/quick/260917-ild-eureka-legacy-purge-and-scaffold-exclusi/260917-ild-SUMMARY.md` when done
</output>
