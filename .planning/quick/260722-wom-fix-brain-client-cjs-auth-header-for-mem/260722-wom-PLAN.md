---
phase: quick-260722-wom
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/resolve-brain-key.cjs
  - tests/test-resolve-brain-key.cjs
autonomous: true
requirements: [MEMGRAPH-MIG-STEP1]

must_haves:
  truths:
    - "Setting MINDRIAN_BRAIN_KEY to 'Bearer <token>' resolves to the bare token, so the client wire header carries exactly one Bearer prefix"
    - "Setting MINDRIAN_BRAIN_KEY to 'Authorization: Bearer <token>' (any letter case) also resolves to the bare token"
    - "A bare token resolves byte-unchanged, and a token merely containing the letters 'bearer' mid-string is never mangled (no regression for existing valid installs)"
    - "MINDRIAN_BRAIN_URL env override still redirects both brain-client fetch call sites; the default fallback string is byte-unchanged (dark-ship, no endpoint flip)"
    - "resolve-brain-key.cjs still reads only local files and env vars (zero network markers, Canon Part 8)"
  artifacts:
    - path: "lib/core/resolve-brain-key.cjs"
      provides: "Prefix normalization at the single key-resolution chokepoint"
      contains: "_normalizeKey"
    - path: "tests/test-resolve-brain-key.cjs"
      provides: "Hermetic scenarios rbk.10+ covering prefixed-key normalization"
      contains: "rbk.10"
    - path: ".planning/quick/260722-wom-fix-brain-client-cjs-auth-header-for-mem/260722-wom-SUMMARY.md"
      provides: "Findings record: URL override path confirmed clean, double-Bearer fix landed at the resolver"
  key_links:
    - from: "lib/core/brain-client.cjs"
      to: "lib/core/resolve-brain-key.cjs"
      via: "getApiKey() delegation (unchanged this task, inherits the fix)"
      pattern: "resolve-brain-key"
    - from: "lib/core/resolve-brain-key.cjs"
      to: "every available:true return"
      via: "_normalizeKey applied before the key is handed to any consumer"
      pattern: "_normalizeKey"
    - from: "tests/test-resolve-brain-key.cjs"
      to: "lib/core/resolve-brain-key.cjs"
      via: "freshResolver() hermetic require"
      pattern: "freshResolver"
---

<objective>
Memgraph brain migration step 1 (dark-ship prep): make the Brain auth header immune to a pre-prefixed MINDRIAN_BRAIN_KEY value, and confirm on the record that the MINDRIAN_BRAIN_URL override path is already clean.

Investigation is DONE (by the planner, against real source): resolveBrainKey() returns the raw trimmed env/file value with no prefix normalization, and brain-client.cjs wraps it as a Bearer header at both fetch call sites (lines ~220 and ~289). The migration brief attests at least one live env stores the entire wire header ('Authorization: Bearer <uuid>') in the var, which today produces a double prefix and a misleading 401 on a valid key. RESEARCH.md condition 4 is met, so the fix IS warranted - this is not a "no change needed" outcome.

Fix location: lib/core/resolve-brain-key.cjs, NOT brain-client.cjs. The resolver is the documented single key-resolution chokepoint (its own header: "the ONE resolver"), so normalizing there repairs every consumer at once - brain-client's getApiKey(), scripts/session-start's CLI shell-out, doctor's class-M brain smoke, tier0-messaging, the two-gauge meter. brain-client.cjs needs zero changes and MUST stay byte-unchanged.

Purpose: step 1 of the approved phased cutover to pws-brain-mcp.onrender.com. No endpoint flip, no version bump.
Output: normalized resolver + extended hermetic test + SUMMARY.md documenting both findings.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260722-wom-fix-brain-client-cjs-auth-header-for-mem/260722-wom-RESEARCH.md
@lib/core/resolve-brain-key.cjs
@lib/core/brain-client.cjs
@tests/test-resolve-brain-key.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Normalize pre-prefixed Brain keys at the resolver chokepoint (RED then GREEN)</name>
  <files>tests/test-resolve-brain-key.cjs, lib/core/resolve-brain-key.cjs</files>
  <behavior>
    Extend tests/test-resolve-brain-key.cjs with five hermetic scenarios, reusing the existing withEnv / makeTmpHome / freshResolver helpers and the existing pass/failTest counters (new scenarios feed the same final exit code):
    - rbk.10: MINDRIAN_BRAIN_KEY env value 'Bearer test-token-123' resolves to key 'test-token-123', source 'env', available true.
    - rbk.11: env value 'Authorization: Bearer test-token-456' resolves to key 'test-token-456'; also assert the all-lowercase form 'authorization: bearer test-token-789' resolves to 'test-token-789' (case-insensitive stripping).
    - rbk.12: a ~/.mindrian.env file (mode 0600) containing 'MINDRIAN_BRAIN_KEY=Bearer test-file-token' resolves to key 'test-file-token', source 'mindrian-env-file' (the file path normalizes too, not just the env path).
    - rbk.13: regression guard - env value 'xbearerx-mid-string' resolves byte-unchanged (stripping is anchored to the START of the value only, never mid-string), and a plain bare token still resolves unchanged (rbk.1 already covers trim; this pins no-mangling).
    - rbk.14: env value 'Bearer' alone (nothing left after stripping) never yields an empty or whitespace key - the resolver falls through to the file chain / not-found exactly as if the env var were unset.
  </behavior>
  <action>
    RED first: add the five scenarios above to tests/test-resolve-brain-key.cjs, run the file, and confirm rbk.10/11/12/14 FAIL against the current resolver (rbk.13 may already pass; that is fine - it is a pin, not a probe). Then GREEN: in lib/core/resolve-brain-key.cjs add a small pure helper _normalizeKey(v) that (a) returns null for non-string or empty input, (b) strips one leading 'Authorization:' plus trailing whitespace (case-insensitive, anchored with ^), (c) then strips one leading 'Bearer' anchored with ^ (case-insensitive) followed by EITHER at least one whitespace char OR end-of-string (so the bare literal 'Bearer' with nothing after it also strips, matching rbk.14 - a plan-checker-caught inconsistency, fixed here before execution: the original "plus at least one whitespace char" wording would leave 'Bearer' alone unstripped since there is no trailing whitespace to match), (d) trims, and (e) returns null if nothing remains. Apply it at all three success paths: the env branch (replace the current trim-then-length check so a null normalization falls through to the file chain) and both file branches (wrap the _parseKey result; the existing 'if (v)' guards already give the correct fall-through when normalization returns null). Do not change the returned source labels, the SEC-02 permission gate, the reason strings, or the CLI entry point.

    Comment discipline (two hard constraints): (1) the short rationale comment above _normalizeKey must reference quick task 260722-wom and the 2026-07-22 Memgraph migration brief, and explain in one or two lines that at least one live env stored the full wire header in the var while the client re-wraps with a Bearer prefix, turning a valid key into a misleading 401. (2) rbk.6 greps this file's source case-sensitively for the pattern 'fetch|http|curl|brain.mindrian|tavily' as the Canon Part 8 zero-network gate - the new comment and code must not contain any of those lowercase substrings (say 'wire header' or 'auth header', never 'http header'; avoid URLs entirely). No em-dashes anywhere in either file (repo hard rule); hyphens only.

    Scope guard: do NOT touch lib/core/brain-client.cjs (its 'Bearer ${key}' construction is now correct by the resolver's bare-token contract, and rbk.7/rbk.8 pin its delegation and preconditions), do NOT touch bin/mindrian-brain-mcp-client.cjs (RESEARCH.md: the brief's target file was wrong - it has no BRAIN_URL constant), and do NOT alter the BRAIN_URL default (dark-ship).
  </action>
  <verify>
    <automated>node tests/test-resolve-brain-key.cjs</automated>
  </verify>
  <done>All rbk scenarios (rbk.1 through rbk.14) pass with exit 0; rbk.6 (zero-network grep) and rbk.9 (env-aware home) still pass, proving the edit added no forbidden substrings and left the resolution chain intact; a prefixed key in either env or file form resolves to the bare token; 'Bearer' alone falls through instead of producing an empty key.</done>
</task>

<task type="auto">
  <name>Task 2: Regression gates, out-of-scope proof, and findings SUMMARY</name>
  <files>.planning/quick/260722-wom-fix-brain-client-cjs-auth-header-for-mem/260722-wom-SUMMARY.md</files>
  <action>
    Prove the blast radius is exactly two files, then write the findings record.

    Gates to run (all must hold):
    1. node tests/test-resolve-brain-key.cjs exits 0 (Task 1's suite, re-run as the roll-up).
    2. node lib/memory/security-trifecta.test.cjs - it exercises brain-client's SEC-01/SEC-02 surface which requires the resolver. If it fails, diff against a pre-change baseline (git stash the working tree, run, unstash) and accept only if every failure is pre-existing; any NEW failure traces back to the resolver edit and must be fixed before proceeding.
    3. node -e "require('/home/jsagi/dev/MindrianOS-Plugin/lib/core/brain-client.cjs')" loads without throwing (the consumer still wires up).
    4. git diff --exit-code lib/core/brain-client.cjs bin/mindrian-brain-mcp-client.cjs package.json .claude-plugin/plugin.json CHANGELOG.md returns 0 - byte-proof that the client, the shim, and every version surface are untouched (dark-ship + no-version-bump constraints).
    5. grep -n "const BRAIN_URL" lib/core/brain-client.cjs still shows the mindrian-brain.onrender.com default (belt to gate 4's suspenders).
    6. Em-dash gate: grep for the em-dash character in lib/core/resolve-brain-key.cjs and tests/test-resolve-brain-key.cjs must find nothing.

    Then write 260722-wom-SUMMARY.md with two findings sections: (1) URL override path - confirmed clean with NO code change: the env-overridable constant lives at lib/core/brain-client.cjs line 23 (not bin/mindrian-brain-mcp-client.cjs as the migration brief's section 04 claimed; the brief's target file was wrong per RESEARCH.md), and both fetch call sites derive from that single constant, so MINDRIAN_BRAIN_URL already redirects the init handshake and tool calls consistently; the default fallback remains byte-unchanged. (2) Double-Bearer fix - was REAL and is now fixed at the resolver chokepoint via _normalizeKey; name the five test scenarios and why the resolver (not brain-client) was the right home: one normalization repairs every consumer including session-start and doctor's brain smoke. Note the deferred follow-up: live Tri-Polar verification against pws-brain-mcp.onrender.com is step 2 of the brief's sequence, out of scope here. No em-dashes in the SUMMARY.
  </action>
  <verify>
    <automated>node tests/test-resolve-brain-key.cjs && git diff --exit-code lib/core/brain-client.cjs bin/mindrian-brain-mcp-client.cjs package.json .claude-plugin/plugin.json CHANGELOG.md && ! grep -q "$(printf '\342\200\224')" lib/core/resolve-brain-key.cjs tests/test-resolve-brain-key.cjs && test -f .planning/quick/260722-wom-fix-brain-client-cjs-auth-header-for-mem/260722-wom-SUMMARY.md</automated>
  </verify>
  <done>All six gates hold; brain-client.cjs, the stdio shim, and every version surface are byte-unchanged; SUMMARY.md exists and records both findings (URL override path clean with no change needed, double-Bearer bug real and fixed at the resolver) plus the deferred live-verification follow-up.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local process -> Brain endpoint | Bearer key material crosses the wire; resolved from local env/files |
| operator env/key files -> resolver | Untrusted-format operator input (possibly pre-prefixed) enters the auth path here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-wom-01 | Spoofing | resolve-brain-key.cjs _normalizeKey | mitigate | anchored single-pass prefix strip only; never rewrites mid-string content, so a legitimate key can never be transformed into a different credential (pinned by rbk.13) |
| T-wom-02 | Information disclosure | resolver reason strings + test output | mitigate | reason strings and test assertions never echo real key material; tests use synthetic tokens only |
| T-wom-03 | Tampering | ~/.mindrian.env and CWD .env | accept | already mitigated by the existing SEC-02 0600 permission gate; byte-unchanged this task (pinned by rbk.5) |
| T-wom-SC | Tampering | npm/pip/cargo installs | accept | zero packages installed by this plan; no dependency surface touched |
</threat_model>

<verification>
- node tests/test-resolve-brain-key.cjs exits 0 (all scenarios, including the five new prefix-normalization ones)
- git diff --exit-code on lib/core/brain-client.cjs, bin/mindrian-brain-mcp-client.cjs, package.json, .claude-plugin/plugin.json, CHANGELOG.md (out-of-scope byte-proof)
- rbk.6 green proves Canon Part 8 zero-network still holds for the resolver source
- No em-dash characters in any touched or written file
</verification>

<success_criteria>
- A pre-prefixed MINDRIAN_BRAIN_KEY ('Bearer <t>' or 'Authorization: Bearer <t>', any letter case, env or file source) resolves to the bare token, so the wire header is always exactly one 'Bearer <token>'
- Bare tokens and mid-string 'bearer' substrings pass through byte-unchanged; 'Bearer' alone falls through, never an empty key
- BRAIN_URL default and both brain-client fetch call sites untouched; the MINDRIAN_BRAIN_URL override path confirmed clean and documented in SUMMARY.md
- SUMMARY.md records both findings including the migration brief's section-04 target-file correction
</success_criteria>

<output>
Create `.planning/quick/260722-wom-fix-brain-client-cjs-auth-header-for-mem/260722-wom-SUMMARY.md` when done
</output>
