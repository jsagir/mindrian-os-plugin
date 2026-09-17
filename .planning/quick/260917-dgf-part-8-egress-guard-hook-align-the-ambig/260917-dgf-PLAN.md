---
phase: quick-260917-dgf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/test-260917-dgf-part8-hook-disposition.cjs
  - scripts/part8-egress-guard-hook.cjs
  - tests/part8-egress-guard-hook.test.cjs
  - tests/test-245-egress-contentless.cjs
  - tests/test-260906-fda-known-tool-shapes.cjs
  - tests/run-all-196.sh
autonomous: true
requirements: [DGF-01]
canon_parts: [8, 6, 7]

must_haves:
  truths:
    - "A plugin-scoped brain_search / brain_query / brain_ask call whose free-form string CLEARS the Canon default-deny scan but matches no METHODOLOGY_VOCAB token exits 0 from the PreToolUse hook, so the call reaches the shim and carries the shim's egress_disclosure"
    - "A content-carrying free-form payload on the same trusted plugin scope still exits 2 with Part 8 text on stderr"
    - "An ambiguous free-form payload on an UNTRUSTED Brain-shaped key (mcp__theo__brain_search) still exits 2 with the F.1 gate text on stderr"
    - "An unproven typed packet (class unproven_packet) still exits 2 on the trusted plugin scope"
    - "lib/core/part8-egress-guard.cjs is byte-unchanged: the same four payloads still classify as verdict ambiguous, class freeform_unmatched"
    - "The Brain-less path (PART8_FORCE_BRAIN_AVAILABLE=0) and the proven MOVE-SET path are byte-identical in behavior to today"
    - "bestEffortRecord still runs for every verdict, before the exit branch"
  artifacts:
    - path: "tests/test-260917-dgf-part8-hook-disposition.cjs"
      provides: "Child-process exit-code contract for the ambiguous-verdict disposition (cases A1-A4, B, C, D, E, F) plus a classifier-unchanged leg"
      min_lines: 150
    - path: "scripts/part8-egress-guard-hook.cjs"
      provides: "Ambiguous-verdict disposition aligned with the brain-client shim on trusted Brain scopes"
      contains: "isBrainTool"
    - path: "tests/run-all-196.sh"
      provides: "Registration of the new disposition test in the suite that owns this hook"
      contains: "test-260917-dgf-part8-hook-disposition.cjs"
  key_links:
    - from: "scripts/part8-egress-guard-hook.cjs"
      to: "lib/core/brain-response-sanitize.cjs isBrainTool"
      via: "the TRUST predicate now consulted inside the ambiguous branch (isBrainShapedTool keeps deciding INSPECTION scope)"
      pattern: "isBrainTool\\(toolName\\)"
    - from: "scripts/part8-egress-guard-hook.cjs"
      to: "lib/core/brain-client.cjs callTool egress_disclosure"
      via: "header docblock naming the shim as where the ambiguous disclosure lives once the hook allows the call through"
      pattern: "egress_disclosure"
    - from: "tests/test-260917-dgf-part8-hook-disposition.cjs"
      to: "scripts/part8-egress-guard-hook.cjs"
      via: "spawnSync child process with a synthetic PreToolUse envelope on stdin, PART8_FORCE_BRAIN_AVAILABLE seam"
      pattern: "spawnSync"
---

<objective>
Align the PreToolUse egress hook's ambiguous-verdict disposition with the shim that
already sits behind it.

Purpose: today the hook converts an ambiguity into a hard block (exit 2) on trusted
Brain scopes, while `lib/core/brain-client.cjs::callTool` classifies the SAME args and
PROCEEDS with an additive `egress_disclosure { ..., disposition: 'proceeded' }`. The two
enforcement points were supposed to diverge by a stated decision (COMP-02's wording), but
the divergence landed backwards: the hook is stricter than the policy the shim states,
and a PreToolUse hook cannot render the Shape F.1 card anyway, so the card JSON lands on
stderr as an error string ("part 8 -- this may leak freeform_unmatched"). A plain-English
`brain_ask` that carries zero user bytes gets refused with an unreadable card.

Output: a hook that, on a tool name the TRUST predicate `isBrainTool()` accepts (plugin
scope, project scope, canonical custom connector), exits 0 for an ambiguous verdict of
class `freeform_unmatched` or `unknown`, and keeps exit 2 for everything else it blocks
today. Plus the failing-first test that pins it.
</objective>

<canon_argument>
Stated in this plan's own words, because the executor must be able to defend it without
re-deriving it:

- **Step 1 is byte-unchanged.** The real Canon Part 8 boundary is `classify()` step 1, the
  default-deny `scanForContent` scan against the Canon FORBIDDEN_PATTERNS set. It runs
  FIRST on every single call. Nothing in this plan touches it, touches its ordering, or
  touches `lib/core/part8-egress-guard.cjs` at all. An email address, a funding-round
  string, a money figure, an SSN: still `verdict: 'block'`, still exit 2, on every scope.
- **The thing being relaxed protects nothing on its own.** Step 3's `METHODOLOGY_VOCAB`
  test is a bare substring presence check. The guard's own docblock records the measured
  proof: a real user-content Cypher string with a trailing `// framework` comment classifies
  as `allow`. A gate a trailing comment defeats is not what holds the line. Refusing a clean
  "effectuation" search while passing a content-carrying string that happens to say
  "framework" is the inverse of a boundary.
- **The shim still classifies every call.** Allowing the hook's exit does not make the call
  silent. `brain-client.cjs::callTool` runs `classify()` again at the single dispatch seam
  every one of the 16 wrappers flows through, refuses a `block` verdict with the
  `egress_blocked` sentinel, and attaches the typed `egress_disclosure` on `ambiguous`. The
  disclosure names the verdict class and the tool and carries no payload bytes.
- **Untrusted keys keep the block.** A foreign connector key such as `mcp__theo__brain_ask`
  is Brain-SHAPED (so it gets INSPECTED) but is not Brain-TRUSTED, and it does not flow
  through the shim, so there is no second classification and no disclosure behind it. For
  that class of name the hook is the only enforcement point, so its ambiguous block stays.
  This is the 260906-gr1 contract, preserved exactly.
- **Tri-Polar note.** Claude Desktop already behaves this way: no PreToolUse hook fires
  there, every plugin-scoped `brain_*` call goes straight to the shim, and the shim
  discloses and proceeds. This change aligns the CLI to the behavior Desktop has been
  shipping, rather than inventing a third policy. Cowork follows the CLI hook path and is
  aligned by the same edit.
</canon_argument>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md

@scripts/part8-egress-guard-hook.cjs
@lib/core/part8-egress-guard.cjs
@lib/core/brain-response-sanitize.cjs
@tests/test-260906-fda-known-tool-shapes.cjs
@tests/test-245-egress-contentless.cjs
@tests/part8-egress-guard-hook.test.cjs
@tests/test-260906-gr1-brain-shaped-tool-gate.cjs
@tests/run-all-196.sh
</context>

<interfaces>
Contracts the executor needs and must NOT rediscover by exploration.

**The two predicates (`lib/core/brain-response-sanitize.cjs`, do NOT edit this file):**

- `isBrainTool(toolName) -> boolean` is the TRUST predicate. Anchored on
  `mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*`. True for
  `mcp__plugin_mos_mindrian-brain__brain_search`, `mcp__mindrian-brain__brain_ask`,
  `mcp__pws-brain-mcp__brain_query`. FALSE for `mcp__theo__brain_ask`.
- `isBrainShapedTool(toolName) -> boolean` is the wider INSPECTION predicate. Adds the
  alternation `[a-z0-9_-]+__brain_[a-z0-9_]+`, so `mcp__theo__brain_search` is true here
  and false in `isBrainTool`. This is the predicate the hook already uses for its scope
  gate; that line does NOT change.

**Verdict shape (`lib/core/part8-egress-guard.cjs::classify(payload, { toolName })`, do
NOT edit this file):** `{ verdict, class, reason }`, with these five classes in play:

| verdict | class | hook today | hook after this plan |
|---------|-------|------------|----------------------|
| block | content_set | exit 2 | exit 2 (unchanged, any scope) |
| allow | move_set / empty_payload / known_tool_shape | exit 0 | exit 0 (unchanged) |
| ambiguous | freeform_unmatched | exit 2 when Brain available | exit 0 on a TRUSTED name, exit 2 on an untrusted Brain-shaped name |
| ambiguous | unknown | exit 2 when Brain available | exit 0 on a TRUSTED name, exit 2 on an untrusted Brain-shaped name |
| ambiguous | unproven_packet | exit 2 when Brain available | exit 2 (UNCHANGED, deliberately not widened: a packet is a typed structure that failed proof, not a free-form string) |

**Measured fixture classes (verified 2026-09-17 by running `classify()` against the dev
tree; the executor does not need to re-run this, it is the reason the case list is what it
is):**

| Fixture | tool name | verdict / class |
|---------|-----------|-----------------|
| `{query:"effectuation"}` | plugin `brain_search` | ambiguous / freeform_unmatched |
| `{query:"dual-use"}` | plugin `brain_search` | ambiguous / freeform_unmatched |
| `{cypher:"MATCH (c:Chapter) WHERE c.id IN [\"ch-12\",\"ch-27\"] RETURN c.id, c.title"}` | plugin `brain_query` | ambiguous / freeform_unmatched |
| `{question:"what comes after customer interviews when the market is unproven"}` | plugin `brain_ask` | ambiguous / freeform_unmatched |
| `{question:"our Series A closed at $4M ARR with jane.doe@example.com"}` | plugin `brain_ask` | block / content_set |
| `{query:"effectuation"}` | `mcp__theo__brain_search` | ambiguous / freeform_unmatched |
| `{query:"effectuation framework"}` | plugin `brain_search` | allow / move_set |
| `{packet_version:"1.0", job:"not_a_shipped_job", summary:"raw prose"}` | plugin `brain_ask` | ambiguous / unproven_packet |

**Hook envelope on stdin:** `{ tool_name, tool_input, session_id }`. Exit 0 = ALLOW, exit 2
= BLOCK with the reason on stderr. Test seam: `PART8_FORCE_BRAIN_AVAILABLE` ('1' available,
'0' Brain-less).

**runHook helper to reuse verbatim (tests/test-260906-fda-known-tool-shapes.cjs:239):**

`spawnSync(process.execPath, [HOOK], { input: stdin, env: Object.assign({}, process.env, extraEnv), encoding: 'utf8' })`, returning `{ status, stderr }`.
</interfaces>

<pre_identified_conflicts>
Three EXISTING assertions pin exit 2 for a trusted-scope ambiguous case and will go red the
moment Task 2 lands. All three were located and their fixture classes measured during
planning. Task 2 updates all three IN PLACE with a one-line comment citing quick task
260917-dgf. NONE of the three may be deleted.

| File | Assertion | Fixture | Class | Today | After |
|------|-----------|---------|-------|-------|-------|
| `tests/part8-egress-guard-hook.test.cjs` | `pb8_07_gate` (approx. line 216) | `AMBIGUOUS` = plugin-scoped `brain_ask` `{question:'opaque blob with no clear content and no proven move-set shape'}` | freeform_unmatched | 2 | 0 |
| `tests/test-245-egress-contentless.cjs` | HOOK C (approx. line 246) | plugin-scoped `brain_stats` `{a:1}` | unknown | 2 | 0 |
| `tests/test-260906-fda-known-tool-shapes.cjs` | HOOK C (approx. line 307) | plugin-scoped `brain_query` `{from:'Design Thinking', to:'SWOT'}` | unknown | 2 | 0 |

Two notes so the executor does not over-correct:

1. The fda HOOK C claim ("the shape must not travel across tool names") does NOT weaken.
   That claim is really a CLASSIFIER claim and it still lives in LEG 1 of the same file,
   where `expectNotAllow` asserts the verdict is not `allow` and the class is not
   `known_tool_shape`. Only the HOOK-leg exit code moves; the LEG 1 assertions stay as-is.
2. `test-245`'s HOOK C comment says "catch-all untouched". That is still true at the
   classifier: step 4 still returns `ambiguous` / `unknown`. What changed is the hook's
   DISPOSITION of that verdict. Rewrite the assertion message to say exactly that.

Confirmed UNAFFECTED (verified during planning, do not edit):
`tests/test-260906-gr1-brain-shaped-tool-gate.cjs` (every pre-hook leg drives a CONTENT-SET
fixture, so all its exit-2 pins are `block` / `content_set`, untouched by this change),
`tests/test-246-census-guard.cjs`, `tests/test-252-guard-census.cjs`,
`tests/test-239-pii-sanitizer-liveness.cjs` (drives the PostToolUse sanitize hook, not this
one), `tests/part8-egress-e2e-smoke.test.cjs` (classifier + gate renderer only, never
spawns this hook).
</pre_identified_conflicts>

<do_not_touch_hashes>
These five files are OUT OF SCOPE for this plan. Their sha256 was taken from a clean
working tree at planning time (2026-09-17) and is pinned here so the guard survives a
commit, which a plain `git diff` check would not. Verified with `sha256sum` from the repo
root.

```
c80658aad40377938a04ff46fb8d3a9f692db29f379be3e87a9a5fa07b593ea8  lib/core/part8-egress-guard.cjs
838eafda7f2a057dcde403f26bb17a86ad4f1ae0bcc4fd383e0ae533d14dcfa6  lib/core/brain-response-sanitize.cjs
fa5cea9560158ae25f3e99cb08676f0c1e1a276d8c77db1a67c94568bcc2874b  lib/core/brain-client.cjs
fa11ac90e16ea0d042f6afb05237b78dd474237bfe6440143593b9a6020d26cb  hooks/hooks.json
3265d90c9adba164717b61dee02201cef4e2fe3d756ff7400a947b8618488522  tests/test-260906-gr1-brain-shaped-tool-gate.cjs
```

Write that block verbatim to `/tmp/260917-dgf-donottouch.sha256` and check it with
`sha256sum -c`. If a hash does not match, the change went to the wrong file: revert it
before continuing. If one of these files legitimately changed on `main` between planning
and execution, say so in the SUMMARY with the diff, and do not silently re-pin.
</do_not_touch_hashes>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Failing-first disposition test (RED)</name>
  <files>tests/test-260917-dgf-part8-hook-disposition.cjs</files>
  <behavior>
    LEG 0 (classifier unchanged, the mutation guard): call
    `lib/core/part8-egress-guard.cjs::classify()` directly on the four A-payloads and
    assert each returns `{ verdict: 'ambiguous', class: 'freeform_unmatched' }`. This leg
    must pass BOTH before and after Task 2. Its job is to make it impossible to "fix" this
    defect by widening METHODOLOGY_VOCAB or otherwise editing the classifier: if someone
    does, this leg goes red and names the file that must not have changed.

    LEG 1 (hook exit codes, child process, `runHook` helper copied from
    tests/test-260906-fda-known-tool-shapes.cjs:239):

    - A1 (exit 0 expected): `mcp__plugin_mos_mindrian-brain__brain_search`,
      `{query:"effectuation"}`, PART8_FORCE_BRAIN_AVAILABLE=1.
    - A2 (exit 0 expected): same tool, `{query:"dual-use"}`.
    - A3 (exit 0 expected): `mcp__plugin_mos_mindrian-brain__brain_query`,
      `{cypher:"MATCH (c:Chapter) WHERE c.id IN [\"ch-12\",\"ch-27\"] RETURN c.id, c.title"}`.
    - A4 (exit 0 expected): `mcp__plugin_mos_mindrian-brain__brain_ask`,
      `{question:"what comes after customer interviews when the market is unproven"}`.
      Each A case also asserts stderr carries no `/part 8/i` text.
    - B (exit 2 expected, passes today and after):
      `mcp__plugin_mos_mindrian-brain__brain_ask`,
      `{question:"our Series A closed at $4M ARR with jane.doe@example.com"}`. Assert
      stderr is non-empty and cites Part 8. This is the step-1 default-deny proof.
    - C (exit 2 expected, passes today and after): `mcp__theo__brain_search`,
      `{query:"effectuation"}`. Assert stderr non-empty. Untrusted key keeps the block,
      and this is also where the F.1 gate render coverage now lives.
    - D (exit 2 expected, passes today and after):
      `mcp__plugin_mos_mindrian-brain__brain_ask`,
      `{packet_version:"1.0", job:"not_a_shipped_job", summary:"raw prose"}` (class
      unproven_packet, deliberately not widened).
    - E (exit 0 expected, passes today and after): A1's payload with
      PART8_FORCE_BRAIN_AVAILABLE=0. Brain-less path unchanged.
    - F (exit 0 expected, passes today and after): `{query:"effectuation framework"}` on
      the plugin-scoped `brain_search`. Proven MOVE-SET unchanged.

    LEG 2 (predicate self-validation, 3 assertions): assert
    `isBrainTool('mcp__plugin_mos_mindrian-brain__brain_search') === true`,
    `isBrainTool('mcp__theo__brain_search') === false`, and
    `isBrainShapedTool('mcp__theo__brain_search') === true`. Without this, a future change
    to the matchers could silently turn every hand-typed name in this file into a
    vacuous fixture.

    Failure reporting: do NOT throw on the first failure. Accumulate failures and print one
    `FAIL: <case-id> <message>` line per failure, then `process.exit(1)` if any failed. The
    RED run must therefore print exactly four FAIL lines (A1, A2, A3, A4) and nothing else,
    which is the evidence that B/C/D/E/F already hold and only the disposition is wrong.
  </behavior>
  <action>
    Create `tests/test-260917-dgf-part8-hook-disposition.cjs`, zero-dep CJS
    (`node:assert`, `node:path`, `node:child_process` only), executable-style shebang and
    `'use strict'` to match the sibling test files.

    Tool names are hand-typed literals, NOT derived from
    `scripts/check-brain-tool-liveness.cjs`. State the reason in the header docblock: the
    contract under test is the hook's TRUST predicate keyed on the tool-name SHAPE, so the
    test must stay deterministic and runnable with no live Brain handshake; live-name
    parity is already owned by test-245 / test-260906-fda / test-239-brain-tool-liveness,
    and LEG 2 above pins the shapes so the literals cannot go vacuous. The same
    hand-typed-fixture precedent is already set by the FOREIGN_SERVER fixture in
    tests/part8-egress-guard-hook.test.cjs.

    Header docblock states the defect in one paragraph (the hook blocks what the shim
    discloses-and-proceeds on, and a PreToolUse hook cannot render the F.1 card so the card
    JSON lands on stderr as an error string), cites quick task 260917-dgf, and names
    `lib/core/brain-client.cjs::callTool` as the second enforcement point.

    Do NOT edit any other file in this task. NO em-dashes, NO en-dashes, hyphens only.

    Run the test and capture the RED evidence, then commit test-only:
    `test(260917-dgf): pin the Part 8 hook ambiguous-verdict disposition (RED)`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-260917-dgf-part8-hook-disposition.cjs > /tmp/260917-dgf-red.log 2>&1 || true; grep -q 'FAIL: A1' /tmp/260917-dgf-red.log && grep -q 'FAIL: A4' /tmp/260917-dgf-red.log && ! grep -qE 'FAIL: (B|C|D|E|F)\b' /tmp/260917-dgf-red.log</automated>
  </verify>
  <done>
    The new test file exists, exits non-zero, and its output names A1, A2, A3 and A4 as the
    only failures. B, C, D, E, F and both the LEG 0 classifier leg and the LEG 2 predicate
    leg pass against the UNMODIFIED hook. One commit, test file only.
  </done>
</task>

<task type="auto">
  <name>Task 2: Align the hook disposition and rewrite its header docblock (GREEN)</name>
  <files>scripts/part8-egress-guard-hook.cjs, tests/part8-egress-guard-hook.test.cjs, tests/test-245-egress-contentless.cjs, tests/test-260906-fda-known-tool-shapes.cjs</files>
  <action>
    **2a. `scripts/part8-egress-guard-hook.cjs` (the only production file this plan
    touches).**

    Hoist the sanitizer module out of the scope-gate try block so the TRUST predicate is
    reachable later in `main()`: declare `let sanitizer = null;` before the existing
    `try`, assign `sanitizer = require(SANITIZER_PATH);` inside it, and leave the
    `if (!sanitizer.isBrainShapedTool(toolName)) return allow();` scope gate and its
    fail-OPEN catch exactly as they are. The INSPECTION scope does not change.

    Add a module-level frozen constant near the other path constants:
    `const TRUSTED_AMBIGUOUS_ALLOW_CLASSES = Object.freeze(new Set(['freeform_unmatched', 'unknown']));`
    with a short docblock naming `unproven_packet` as the class DELIBERATELY excluded (a
    typed packet that failed proof is a structure, not a free-form string; widening to it
    would be a different decision with a different argument) and pointing at
    `lib/core/part8-egress-guard.cjs::classify()` as where the classes are minted.

    In the `verdict === 'ambiguous'` branch, BEFORE the existing `brainAvailable()` test,
    add the trusted-scope allow:

    - compute the trust bit defensively (`let trusted = false; try { trusted = !!(sanitizer && sanitizer.isBrainTool(toolName)); } catch (_) { trusted = false; }`)
      so a predicate throw degrades to UNTRUSTED, which keeps the block, not the allow;
    - `if (trusted && TRUSTED_AMBIGUOUS_ALLOW_CLASSES.has(klass)) return allow();`

    Placement is load-bearing and must be commented as such: it sits before the
    availability test so the policy reads as "trusted scope, free-form ambiguity, hand it to
    the shim", not as an accident of the Brain-less branch; and it sits after
    `bestEffortRecord`, which stays exactly where it is so telemetry still records every
    verdict including the newly-allowed ones. Everything below it is byte-unchanged: the
    `block` branch, the F.1 gate render attempt, the minimal-notice fallback, the Brain-less
    allow, the final allow, the fail-OPEN wraps.

    **2b. Header docblock (same file).** Rewrite two sections, in the file's existing voice:

    - *Signaling:* add that on a tool name `isBrainTool()` TRUSTS (plugin scope, project
      scope, canonical custom connector), an ambiguous verdict of class
      `freeform_unmatched` or `unknown` exits 0 and the call proceeds to the shim, which
      re-classifies the same args and attaches the additive
      `egress_disclosure { verdict:'ambiguous', egress_class, reason, tool, disposition:'proceeded' }`
      at `lib/core/brain-client.cjs::callTool`. Nothing becomes silent; the disclosure moves
      to where it can actually be rendered.
    - *Fail posture:* state plainly that the hook no longer converts a proven-harmless
      ambiguity into a block on trusted scopes, and that it still does for untrusted
      Brain-shaped keys (`mcp__theo__brain_ask` and friends), which bypass the shim entirely
      and therefore have no second enforcement point. Keep fail-CLOSED for: `content_set` on
      any scope, `unproven_packet` on any scope, and any ambiguous verdict on an untrusted
      Brain-shaped key.

    Add a short third paragraph carrying this plan's `<canon_argument>` in compressed form:
    step 1 default-deny is byte-unchanged, the step 3 vocabulary test protects nothing on
    its own (trailing-comment proof, already documented at
    `lib/core/part8-egress-guard.cjs::_isFreeFormTool`), the shim still classifies every
    call, untrusted keys keep the block. Add the Tri-Polar line: Claude Desktop already
    behaves this way because no PreToolUse hook fires there, so this aligns the CLI to
    shipped Desktop behavior rather than inventing a third policy. Cite quick task
    260917-dgf.

    **2c. Update the three pre-identified conflicting assertions** listed in this plan's
    `<pre_identified_conflicts>` table. For each: flip the expected status from 2 to 0,
    rewrite the assertion message to state the new contract, and add ONE comment line above
    it citing quick task 260917-dgf and the reason. Do not delete any case. Also update the
    contract-summary comment lines at the top of `tests/part8-egress-guard-hook.test.cjs`
    (the "ambiguous + Brain available -> exit 2" line) to match, and rename the
    `pb8_07_gate` IIFE's message so it no longer claims a gate was rendered. In
    `tests/test-245-egress-contentless.cjs` HOOK C, keep the `A1 EVIDENCE` stderr print but
    guard it so it does not crash on empty stderr.

    **What NOT to touch:** `lib/core/part8-egress-guard.cjs` (no edits at all, no
    METHODOLOGY_VOCAB widening), `lib/core/brain-response-sanitize.cjs`,
    `lib/core/brain-client.cjs`, `hooks/hooks.json` matchers,
    `tests/test-260906-gr1-brain-shaped-tool-gate.cjs`. NO em-dashes, NO en-dashes.

    Commit code only: `fix(260917-dgf): align hook ambiguous disposition with the shim on trusted Brain scopes`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && sha256sum -c /tmp/260917-dgf-donottouch.sha256 && node tests/test-260917-dgf-part8-hook-disposition.cjs && node tests/part8-egress-guard-hook.test.cjs && node tests/test-245-egress-contentless.cjs && node tests/test-260906-fda-known-tool-shapes.cjs && node tests/test-260906-gr1-brain-shaped-tool-gate.cjs</automated>
  </verify>
  <done>
    `tests/test-260917-dgf-part8-hook-disposition.cjs` exits 0 with zero FAIL lines. The
    three updated sibling tests pass. `test-260906-gr1` passes untouched. `sha256sum -c`
    is green for all five do-not-touch files. The hook's header docblock names the shim, the
    trusted/untrusted split, and quick task 260917-dgf. One commit, code only.
  </done>
</task>

<task type="auto">
  <name>Task 3: Register the test in the 196 suite and run the full green sweep</name>
  <files>tests/run-all-196.sh</files>
  <action>
    Add a `run_if` leg to `tests/run-all-196.sh`, guarded on the RUNTIME module
    (`scripts/part8-egress-guard-hook.cjs`, matching the file's stated Wave 0 contract that
    legs guard on the module under test and not on the test file), placed immediately after
    the existing "PB8-04/05/07/08 hook + F.1 gate + degrade" leg:

    label `260917-dgf hook ambiguous disposition (trusted scope allows, untrusted blocks)`,
    command `node tests/test-260917-dgf-part8-hook-disposition.cjs`.

    Add a short comment block above it in the runner's existing voice: what the leg pins
    (the hook's disposition of an ambiguous verdict, split by the TRUST predicate), why it
    lives in the 196 suite (196 owns this hook), and the citation to quick task 260917-dgf.

    Then run the full sweep named in this task's verify block and record each result in the
    SUMMARY. If any leg SKIPs because
    `scripts/check-brain-tool-liveness.cjs` cannot complete its live stdio handshake in the
    execution environment, record the SKIP verbatim as a pre-existing environmental
    condition and do NOT try to remove that dependency; the new test is deliberately
    independent of it. Do not "fix" any unrelated pre-existing failure found by the sweep;
    record it in the SUMMARY instead.

    NO em-dashes, NO en-dashes. Commit runner only:
    `test(260917-dgf): register the hook disposition test in the 196 suite`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && grep -vE '^[[:space:]]*#' tests/run-all-196.sh | grep -q 'test-260917-dgf-part8-hook-disposition.cjs' && bash tests/run-all-196.sh && node tests/test-260906-fda-known-tool-shapes.cjs && node tests/test-245-egress-contentless.cjs && node tests/test-260906-gr1-brain-shaped-tool-gate.cjs && node tests/test-246-census-guard.cjs</automated>
  </verify>
  <done>
    `tests/run-all-196.sh` carries the new leg as live (non-comment) shell, the suite exits
    0 with `Failed: 0`, and the four named sibling tests are green. One commit, runner only.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Agent -> PreToolUse hook | The hook is the only enforcement point for a tool call that does NOT flow through the plugin's own shim. This is the boundary the untrusted-key block defends. |
| Agent -> `brain-client.cjs::callTool` (the shim) | Every plugin-scoped `brain_*` call flows through here, gets re-classified, and carries the `egress_disclosure`. This is the second enforcement point the hook is being aligned with. |
| LOCAL room content -> remote Brain | Canon Part 8: LOCAL to BRAIN is NO. Enforced by `classify()` step 1, default-deny, byte-unchanged by this plan. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-dgf-01 | Information disclosure | `scripts/part8-egress-guard-hook.cjs` ambiguous branch | mitigate | Scope the new allow to `isBrainTool()` TRUE only, and only for classes `freeform_unmatched` / `unknown`. `content_set` (the actual Canon boundary) and `unproven_packet` keep exit 2 on every scope. Pinned by cases B and D in Task 1. |
| T-dgf-02 | Information disclosure | Foreign connector key (`mcp__theo__brain_ask`) | mitigate | The trust predicate is consulted, not the inspection predicate. A Brain-shaped but untrusted key bypasses the shim and therefore keeps the hook's block. Pinned by case C in Task 1 and by the untouched `test-260906-gr1` suite. |
| T-dgf-03 | Tampering | `lib/core/part8-egress-guard.cjs` | mitigate | The classifier is out of scope for this plan. Task 2's verify asserts its pinned sha256 (see `<do_not_touch_hashes>`, which survives a commit where a plain `git diff` would not), and Task 1's LEG 0 asserts the four fixtures still classify as `ambiguous` / `freeform_unmatched`, so a later "fix" that widens METHODOLOGY_VOCAB instead goes red. |
| T-dgf-04 | Elevation of privilege | `sanitizer.isBrainTool` throwing or the module being unloadable | mitigate | The trust bit is computed in a try/catch that degrades to `trusted = false`, which KEEPS the block. The pre-existing fail-OPEN on the scope gate (A3 accepted risk) is unchanged and not widened. |
| T-dgf-05 | Repudiation | Telemetry | mitigate | `bestEffortRecord` stays where it is, before the exit branch, so a newly-allowed ambiguous verdict is still LOCAL-logged with its class. Stated in Task 2's action and asserted by leaving the call site untouched. |
| T-dgf-06 | Denial of service | Legitimate methodology queries | mitigate | This plan's entire purpose: a clean plain-English `brain_ask` stops being refused with an unrenderable card. Cases A1-A4 pin it. |
| T-dgf-SC | Tampering | npm/pip/cargo installs | n/a | This plan installs no packages. Node built-ins only, zero npm dependencies added. No legitimacy gate required. |
</threat_model>

<verification>
1. `bash tests/run-all-196.sh` exits 0 with `Failed: 0`.
2. `node tests/test-260917-dgf-part8-hook-disposition.cjs` exits 0, zero FAIL lines.
3. `node tests/test-260906-fda-known-tool-shapes.cjs`, `node tests/test-245-egress-contentless.cjs`,
   `node tests/test-260906-gr1-brain-shaped-tool-gate.cjs`, `node tests/test-246-census-guard.cjs`
   all exit 0.
4. `sha256sum -c` passes for all five files pinned in `<do_not_touch_hashes>`
   (`lib/core/part8-egress-guard.cjs`, `lib/core/brain-response-sanitize.cjs`,
   `lib/core/brain-client.cjs`, `hooks/hooks.json`,
   `tests/test-260906-gr1-brain-shaped-tool-gate.cjs`).
5. `grep -rn '\xe2\x80\x94\|\xe2\x80\x93' scripts/part8-egress-guard-hook.cjs tests/test-260917-dgf-part8-hook-disposition.cjs tests/run-all-196.sh` returns nothing (no em-dashes, no en-dashes).
6. Three commits, one per task, code and tests only. No `.planning/` file in any of them.
</verification>

<success_criteria>
- The mentor's three blocked payloads plus the plain-English `brain_ask` exit 0 from the
  hook on the plugin scope with Brain available.
- A content-carrying payload on the same scope still exits 2 with Part 8 text on stderr.
- `mcp__theo__brain_search` with the identical clean string still exits 2.
- An unproven typed packet still exits 2.
- The Brain-less path and the proven MOVE-SET path are unchanged.
- `lib/core/part8-egress-guard.cjs` is byte-unchanged and the classifier still returns
  `ambiguous` / `freeform_unmatched` for the four fixtures.
- The hook's header docblock states the new disposition, names the shim as where the
  ambiguous disclosure lives, and carries the Tri-Polar note.
- The new test is registered in `tests/run-all-196.sh` and the suite is green.
</success_criteria>

<output>
Create `.planning/quick/260917-dgf-part-8-egress-guard-hook-align-the-ambig/260917-dgf-SUMMARY.md` when done.
Record in it: the RED evidence from Task 1 (the four FAIL lines verbatim), the three
sibling assertions updated and their new expected exit codes, the final suite output tail,
and any SKIP encountered with its stated cause.
</output>
