---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
reviewed: 2026-11-24T00:00:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - services/decision-relay/config.cjs
  - services/decision-relay/verify-caller.cjs
  - services/decision-relay/limits.cjs
  - services/decision-relay/relay.cjs
  - services/decision-relay/server.cjs
  - services/decision-relay/render.yaml
  - services/decision-relay/README.md
  - lib/core/decision-advisor/labels-only.cjs
  - lib/core/decision-advisor/adapter.cjs
  - lib/core/decision-advisor/domain.cjs
  - lib/core/decision-advisor/shortlist.cjs
  - lib/core/decision-advisor/present.cjs
  - lib/core/navigation/cause-effect.cjs
  - lib/core/navigation/selection-log.cjs
  - lib/core/cause-effect-card.cjs
  - lib/core/memory-ops.cjs
  - lib/core/problem-axes.cjs
  - lib/core/feyminto/next-move.cjs
  - lib/workflow/command-resolver.cjs
  - lib/mcp/tools/gate.cjs
  - lib/mcp/tools/sensors.cjs
  - scripts/decision-advisor-transport.cjs
findings:
  critical: 0
  warning: 10
  info: 8
  total: 18
status: issues_found
fix_status:
  fixed_at: 2026-11-24
  fixed: 17
  skipped: 1
  skipped_ids: [IN-04]
  requires_human_verification: [WR-04, WR-09]
  relay_code_commits: [49b6bd5dc, 839017ad7, 336c4c3ee, 218d2a9a5]
---

# Phase 400: Code Review Report

**Reviewed:** 2026-11-24
**Depth:** deep
**Files Reviewed:** 22 (focus set; skills/commands/agents frontmatter and the generated registry were not read line by line)
**Status:** issues_found
**Range:** c1e496ae8..e1d18fe23 (branch work/400-job-sentences-cynefin-layer)

## Summary

The review covered the decision relay (services/decision-relay/), the domain-aware decision advisor, the cause and effect store, the cause and effect card in gate_render and gate_answer, the selection_observations migration, and the operator release run in scripts/decision-advisor-transport.cjs.

Facts about the live relay:
- PROVEN: `git diff --stat 757b6a95e..HEAD` changes only `.planning/ROADMAP.md`, `400-15-SUMMARY.md` and `tests/test-400-review-lists.cjs`. The relay deployed from 757b6a95e therefore has the same code and the same `catalogFingerprint()` as HEAD. Current clients do not get `catalog_skew`.
- PROVEN: the caller check is sound. The operator compare hashes the token and runs `crypto.timingSafeEqual` over every listed 32-byte hash. A wrong Bearer is refused without a fallback to the install id. User traffic is refused until `RELAY_USER_TRAFFIC=on`.
- PROVEN: the body cap is enforced while the body is read, after the caller check. No body byte is read for a refused caller. The upstream POST uses `redirect: 'error'`, a timeout, and no retry. The upstream text is not passed back. No log line holds a key, a token, an install id or an address.
- PROVEN: labels-only refusals return the reason only (`detail: v.reason`), never the path or the value.
- PROVEN: an unknown domain gives the 399 shortlist, because `cleanDomain` returns null and `applyDomainTo` returns the input object. The shipped table has the 3-part `key_order`, so `key_used` also stays 399.
- PROVEN: the reorder moves only strong-band items (`fitFirst` keeps possible and weak items in the tail).
- PROVEN: the `cause_effect_domain` migration handles the duplicate-column race (re-check after a failed ALTER). No finding.
- PROVEN: `bash tests/run-all-400.sh` exits 0.

The live risk is on the operator path. It has a daily question cap only, with no per-minute rate and no token cap (WR-02). The documented operator command puts the token into the shell history (WR-03). The install path is off, but its caps let one address use the full global budget (WR-01). Fix WR-01 before `RELAY_USER_TRAFFIC=on`.

On the plugin side, the domain reorder turns non-top ties into a strict preference (WR-04). The chaotic public shape lists `band: strong` options under `no_strong_pick` and repeats the domain sentence (WR-05). The stored domain claims `source: navigator` for answers the model relayed (WR-06).

S6 judgement: fix the test, do not keep the built-path require (WR-08).

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: One client address can use the full global user budget (DoS of all installs)

**Fix status:** fixed in 839017ad7 (with IN-08). limits.cjs checks address_rate (RELAY_ADDRESS_PER_MINUTE 20) and address_daily_requests (RELAY_ADDRESS_DAILY_REQUESTS 500, below the global 5000) before every install check; a refused call is not counted. Legs C4 WR-01 in tests/test-400-relay.cjs repeat the rotating-install probe. Relay code: the deployed copy must be refreshed.

**File:** `services/decision-relay/limits.cjs:222-262` (defaults in `config.cjs:17-21`)
**Issue:** The install id is self-minted (any 32 hex), so `installPerMinute` and `installDailyQuestions` do not bound one attacker. The only per-source bound is `addressDailyQuestions` (20000 questions). That is larger than `globalDailyRequests` (5000 requests). The address cap also counts questions, not requests. PROVEN with a probe: one address that rotates install ids got 5000 accepted requests at 1 question each. After that, a different address got `global_daily_requests`. The address has no per-minute rate. Not live today (`RELAY_USER_TRAFFIC=off`), but this blocks turning user traffic on.
**Fix:** Add a per-address request window and a per-address daily request cap below the global cap. Check both before the install checks:
```js
// config: addressPerMinute: 20, addressDailyRequests: 500
let aw = addressMinute.get(addr);
if (aw && aw.resetAt <= t) aw = undefined;
if (aw && aw.count + 1 > c.addressPerMinute) return refuse('address_rate', (aw.resetAt - t) / 1000);
const usedAddrReq = addressDailyReq.get(addr) || 0;
if (usedAddrReq + 1 > c.addressDailyRequests) return refuse('address_daily_requests', toMidnightS(t));
```
Also measure the Render X-Forwarded-For shape first (see IN-08). Without a correct address, every address cap is void.

### WR-02: The operator caller has no rate limit and no token cap (live)

**Fix status:** fixed in 49b6bd5dc. operator_rate (RELAY_OPERATOR_PER_MINUTE 30), operator_token_cap (RELAY_OPERATOR_DAILY_INPUT_TOKENS 40000000) in limits.cjs, relay_busy (RELAY_MAX_IN_FLIGHT 4 open upstream calls, 503, Retry-After 1, not counted) in relay.cjs; the transport reason copy follows. The Gemini budget alert stays an owner step (README). Relay code: the deployed copy must be refreshed.

**File:** `services/decision-relay/limits.cjs:227-232`, `265-270`
**Issue:** The operator is today the only caller the deployed relay accepts. Its only bound is `operatorDailyQuestions` (200000 questions per UTC day). It has no per-minute window and no in-flight bound. `operatorInputTokens` is counted but no check reads it. With a leaked token, an attacker can send 200 parallel requests of 1000 questions each at once. The paid Gemini spend is then bounded only by the question count and the prompt size. The counters are in memory, so each restart or deploy gives a fresh daily budget.
**Fix:** Add `RELAY_OPERATOR_PER_MINUTE` (for example 30) and `RELAY_OPERATOR_DAILY_INPUT_TOKENS`. Check both in the operator branch before `operatorQuestions += n`. Add a small in-flight cap (for example 4 concurrent upstream calls) in `relay.cjs` around step 10. Set a budget alert on the Gemini project.

### WR-03: The documented operator command writes the token into the shell history; the token goes to any --base

**Fix status:** fixed in d1a4838cf. The client reads the token from ~/.mindrian/decision-relay-operator-token (O_NOFOLLOW; a symlink, a mode wider than 0600 or another owner is refused) or from one no-echo prompt on a terminal; the env name is never read. An operator run sends the token only to https://mindrian-decision-relay.onrender.com or loopback (OPERATOR_ORIGINS); any other --base is endpoint_unconfirmed before the token is read. Documented commands hold no inline env. The TTY prompt itself is UNVERIFIED (no pty in tests; the tokenPrompt seam is tested).

**File:** `scripts/decision-advisor-transport.cjs:44-45`, `329-334`, `338`, `376-377`
**Issue:** The header of the script documents the run as `MINDRIAN_DECISION_RELAY_OPERATOR_TOKEN=<token> node scripts/decision-advisor-transport.cjs ...`. An inline env assignment stays in `~/.bash_history`. Also, the Bearer token goes to whatever https origin `--base` names. The audit record names that origin only after the token has left the machine. A typo or a pasted wrong URL leaks the token to a third-party host.
**Fix:** Read the token from a 0600 file or from stdin (`--token-file <path>`, refuse it when the mode is wider than 0600). Change the documented step to `read -rs MINDRIAN_DECISION_RELAY_OPERATOR_TOKEN; export MINDRIAN_DECISION_RELAY_OPERATOR_TOKEN`. Pin the operator run to an expected origin with `MINDRIAN_DECISION_RELAY_ORIGIN` or a constant, and refuse `endpoint_unconfirmed` when `base.origin` differs.

### WR-04: The domain reorder turns non-top ties into a strict preference

**Fix status:** fixed in 15c544194 (logic change: requires human verification). next-move uses a fit bonus of 1 plus the calibrated value; composeWorkflow sorts by (fit desc, value desc, registry index asc) from the fit set of the one lookup. Leg X7 of tests/test-400-advisor-consumers.cjs fails on the old code and passes now.

**File:** `lib/core/feyminto/next-move.cjs:288-293`; `lib/workflow/command-resolver.cjs:212-217`, `245-256`; `lib/core/decision-advisor/domain.cjs:104-114`
**Issue:** The Plan 07 guard says that order inside a tie is alphabetical, not a preference. Equal calibrated values must keep the order that the other keys give. Rule 4 keeps a TOP tie only. Take strong options A 1.0, B 0.9, C 0.9 (fit), D 0.9. With `effect: 'reordered'`, next-move gives the values 4, 3, 2, 1 (C, A, B, D). B now strictly outranks D, but in 399 they were equal and the other sort keys decided. command-resolver does the same: it orders by the index in `strongOrder`. The domain therefore adds a fake alphabetical preference among non-fit equals, and among fit equals.
**Fix:** Order by fit first, then keep the calibrated value, so equal values stay equal:
```js
// next-move.cjs
const fits = new Set((shortlist.domain && shortlist.domain.fits) || []);
strong.forEach((o) => {
  const name = stripCmd(o.command);
  if (!done.has(name)) advisorValue.set(name, (reordered && fits.has(o.command) ? 1 : 0) + o.calibrated);
});
```
In command-resolver, sort by `(fit desc, value desc, idx asc)` and not by the position in `domainOrder`.

### WR-05: The chaotic public shape lists `band: "strong"` under no_strong_pick and repeats the domain sentence

**Fix status:** fixed in 2c9d6f81e. present.cjs gives a strong band as possible in the public options when the domain effect is no_fit (internal shortlist unchanged); the summary appends each host note without its own leading domain head; domain_note keeps the full text. Leg P3b.

**File:** `lib/core/decision-advisor/domain.cjs:120-127`; `lib/core/decision-advisor/present.cjs:93-101`, `146-151`
**Issue:** PROVEN with a probe. `publicShortlist(applyDomain(sl, 'chaotic'))` gives `state: "no_strong_pick"` together with `options: [{command:"/mos:a", band:"strong", rank:1}, ...]`. The host model reads `band: strong` beside "no strong pick". The summary also reads: "Cause and effect domain: chaotic (act, then sense, then respond). Cause and effect domain: chaotic. No command ...". `domainLine` writes the domain head, and then the host note, which starts with the same head. Disorder has the same duplicate ("Cause and effect domain: disorder.").
**Fix:** In the chaotic branch, change each strong band to `possible` in the copy. Or drop `band` from the public options when `domain.effect === 'no_fit'`. In `domainLine`, leave out the head when a note is present, or remove the leading "Cause and effect domain: <id>." from the two `host_notes.text` values in `data/cynefin-domains.json`.

### WR-06: The stored domain claims `source: "navigator"` for an answer the model relayed (Part 9 provenance)

**Fix status:** fixed in 59ca41fed. gate_answer passes answer.answered_via through ratifyCauseEffect into the stored value; readCauseEffect returns answered_via (browser_nonce, mcp_relayed, else unrecorded, also for a value stored before the field). source stays navigator. The selection log does not yet copy answered_via (no schema change made).

**File:** `lib/core/navigation/cause-effect.cjs:44-53`; `lib/mcp/tools/gate.cjs:919-927`
**Issue:** `writeCauseEffect` always writes `source: 'navigator'`. On the text and AskUserQuestion rungs, gate_answer records `answered_via: mcp_relayed`. A host model can call gate_render with kind `cause_effect_domain` and then gate_answer with verdict approve, and the person never sees the card. The how_to says "Never guess the domain from the room", but the server cannot tell a guess from a real answer. The stored value then says that the navigator set it. The decision node keeps `answeredVia`, but the identity value that every consumer reads (next-move, composeWorkflow, selection log) does not keep it.
**Fix:** Pass `answeredVia: answer.answered_via` into `ratifyCauseEffect` and `writeCauseEffect`, and store it in the value (`answered_via`). Return it from `readCauseEffect`. Then a consumer or the selection log can tell a proven answer (`browser_nonce`) from a relayed one.

### WR-07: The cause and effect card cannot store a domain on the elicitation rung

**Fix status:** fixed in 1847a15e2. gate_render turns elicitation off for kind cause_effect_domain (an added line; G8 additive-only check holds); the how_to drops the unknown_gate and card_pending sentences. Leg G10 fails on the old code and passes now.

**File:** `lib/mcp/tools/gate.cjs:1470-1477`, `1562-1565`
**Issue:** On a host with MCP elicitation, the answer is consumed inline (`_consumeLiveGate`), and `_applyRatification` never runs. gate_answer then replies `unknown_gate`. CY-03 therefore cannot work on that rung. The how_to tells the host to "say so to the person". The plan took this as inherited strategy-card behavior. But the mirror path already shows a one-line fix: it turns elicitation off.
**Fix:**
```js
if (mirrorExtra || kind === causeEffectCard.CARD_KIND) capabilities = Object.assign({}, capabilities, { elicitation: false });
```
Then remove the `unknown_gate` sentence from `CARD_STEPS` in `cause-effect-card.cjs:138`.

### WR-08: The shortlist.cjs built-path require gets past test-399-table S6 (judge: fix the test)

**Fix status:** fixed in 45f69996b as judged. domainModule() uses require('./domain.cjs'). test-399-table S6 accepts exactly ./domain.cjs, node:fs and node:path, checks that domain.cjs requires only node:fs and node:path, and checks that a lookup with no domain leaves domain.cjs unloaded; new leg S6b times a cold lookup with causeEffect complex (measured 1.9 ms). A9 follows.

**File:** `lib/core/decision-advisor/shortlist.cjs:131-138`; `tests/test-399-table.cjs:335-338`
**Issue:** `require(path.join(__dirname, 'domain.cjs'))` exists only so that the S6 regex finds no literal. The real load closure now holds `domain.cjs`. The hook require graph test downgrades it to an "advisory dynamic site", so no static check sees the edge. The S6 timing part measures a lookup with no domain only, so the domain path (which reads the 145 KB registry) is not timed. PROVEN: the cold load with `causeEffect: 'complex'` is about 1.7 ms, so the budget is not at risk. The problem is that the test no longer checks what it claims.
**Fix:** Use the literal `require('./domain.cjs')` inside `domainModule()`. Change S6 to accept exactly `['./domain.cjs', 'node:fs', 'node:path']` and to assert that `domain.cjs` requires only `node:fs` and `node:path`. Add a timed S6 sub-leg with `causeEffect: 'complex'`.

### WR-09: The two advisor consumers apply the domain over different option sets

**Fix status:** fixed in 4f4cec793 (consumer half landed with WR-04 in 15c544194; logic change: requires human verification). Both consumers use the fit set of lookupShortlist top k; strongOrder puts first only those fits and only when the lookup effect is reordered. Leg X8 puts a fit strong entry at rank k + 1; A8 follows the single scope.

**File:** `lib/core/decision-advisor/shortlist.cjs:220-227` (top k), `248-268` (`strongOrder`, whole row); `lib/workflow/command-resolver.cjs:214-216`
**Issue:** `lookupShortlist` reorders only the top `k` options, and its `effect` decides `reordered`. command-resolver then takes the order from `strongOrder`, which reorders every strong entry of the whole row. A fit strong command at a rank above `k` therefore goes first in composeWorkflow, but next-move does not see it. Also, if the top `k` has no fit but the row has one below `k`, `effect` is `no_change`, and composeWorkflow keeps the 399 order. The two surfaces then disagree for the same room.
**Fix:** Use one scope. Either have `strongOrder` reorder only the commands in `lookupShortlist(q).options`, or apply `applyDomain` to the full strong band in both places. Add a leg with a fit strong entry at rank `k + 1`.

### WR-10: A multi-request operator run discards paid answers when a later request fails

**Fix status:** fixed in 6c9fb2f92. With --out, each answered request is saved to <out>.partial/<job>-<12 hex>.json (0600 in 0700, request sha256, no token); --resume skips a request whose saved sha256 matches; --out is written when all have answers, then .partial is removed. Leg E2b.

**File:** `scripts/decision-advisor-transport.cjs:581-601`
**Issue:** The release run sends one request per job, in order. When request k fails (for example `upstream_timeout`, `operator_daily_cap` or a network error), the function returns before `--out` is written. The answers of requests 1 to k-1 are paid for but lost. The audit keeps only hashes. A re-run pays again for the same requests. Several retries can also reach `operator_daily_cap`.
**Fix:** After each successful request, write its answers to `<out>.partial/<job>.json` (0600). Add `--resume` to skip a job whose partial file has a matching `body_sha256`. Write `--out` from the partial files at the end.

## Info

### IN-01: Every /v1/decide refusal, unauthenticated ones too, returns the catalog fingerprint

**Fix status:** fixed in 336c4c3ee. x-mindrian-catalog only when rec.kind is set. Relay code: the deployed copy must be refreshed.

**File:** `services/decision-relay/relay.cjs:58-60`
**Issue:** `finish()` adds `x-mindrian-catalog` to a 401 `no_caller` reply too. render.yaml and README say that the hash is kept off `/health` (the Theo posture). The repo is public, so the leak is minor, but the posture is not consistent.
**Fix:** Add the header only when `rec.kind !== null` (the caller passed step 1).

### IN-02: readBody depends on the deprecated `aborted` event and has no `close` listener

**Fix status:** fixed in 336c4c3ee. readBody also settles on req close. Relay code: the deployed copy must be refreshed.

**File:** `services/decision-relay/server.cjs:265-286`
**Issue:** When a socket closes with no `end`, `error` or `aborted`, the promise does not settle, and the handler stays pending.
**Fix:** Add `req.on('close', () => done({ ok: false, over: false }))` after the `end` listener (`done` is idempotent).

### IN-03: The upstream reply is read with no size bound

**Fix status:** fixed in 336c4c3ee. The upstream reply is read with a 4194304-byte cap (declared length or running count); over the cap is upstream_error. Leg R16. Relay code: the deployed copy must be refreshed.

**File:** `services/decision-relay/relay.cjs:148`
**Issue:** `await r.text()` buffers any size. The host is pinned, so the risk is low.
**Fix:** Stream with a byte cap (for example 4 MB) and return `upstream_error` when the reply is larger.

### IN-04: The egress line metadata does not list the relay provider

**Fix status:** skipped. tests/test-399-egress-line.cjs pins the providers list to gemini_decision,jev_decision, and the change is a shipped data edit to data/egress-policy.json; not small and safe under the 399-green constraint. Needs a separate owner choice.

**File:** `data/egress-policy.json:45`
**Issue:** `providers` stays `["gemini_decision", "jev_decision"]`, while the transport adds `decision_relay` (`PROVIDER_IDS.relay`). The endpoint text names the relay, but the provider list does not.
**Fix:** Add `"decision_relay"` to `providers`.

### IN-05: A malformed operator hash is dropped and the start log does not say so

**Fix status:** fixed in 218d2a9a5. The start record carries dropped_hashes (a count). Relay code: the deployed copy must be refreshed.

**File:** `services/decision-relay/config.cjs:71-73`; `services/decision-relay/server.cjs:376-383`
**Issue:** `droppedHashes` is computed but not logged. An operator who pastes `sha256 <hex>` gets `operator_hashes: 0` and only `bad_token` replies.
**Fix:** Add `dropped_hashes: cfg.droppedHashes` to the start record (a count, not a secret).

### IN-06: The cause and effect ratify is skipped silently when no decision node id is minted

**Fix status:** fixed in 21958abae. An approve of a cause and effect card with no minted decision node id now replies cause_effect {ok: false, reason: no_decision_node} (added lines only). Leg G11.

**File:** `lib/mcp/tools/gate.cjs:778-779`, `919-930`
**Issue:** The ratify runs only inside `if (nodeId)`. If `REASONING_NODE_ID` returns null, an approve gives no `cause_effect` key. The how_to says that only `written: true` proves a save, so the host cannot tell this case from an old server.
**Fix:** After the approve block, set `applied.causeEffectRatification = { ok: false, reason: 'no_decision_node' }` when it is still null for a cause and effect card.

### IN-07: The audit chmod follows a symlink

**Fix status:** fixed in bfd500741. writeAudit lstats the dir and refuses a symlink (audit_unwritable) before chmod. Leg O9.

**File:** `scripts/decision-advisor-transport.cjs:306-310`
**Issue:** `chmodSync(dir, 0o700)` follows a symlinked `decision-relay-audit` and changes the mode of the target. This affects the operator machine only.
**Fix:** `lstatSync` the directory and refuse `audit_unwritable` when it is a symlink.

### IN-08: RELAY_PROXY_HOPS=1 is not checked against the Render proxy chain

**Fix status:** fixed as code in 839017ad7 (with WR-01). clientAddressOf falls back to the socket peer when the chosen entry fails net.isIP; the first POST /v1/decide logs one xff_shape line with the entry count only. RELAY_PROXY_HOPS stays a config value; the live Render chain is not measured (OWNER-GATED, README). Relay code: the deployed copy must be refreshed.

**File:** `services/decision-relay/render.yaml:90-91`; `services/decision-relay/server.cjs:212-222`
**Issue:** UNVERIFIED. If Render (or a CDN in front of it) appends more than one entry, hop 1 is a proxy address, and all callers share one address bucket. The candidate is also not checked as an IP literal. With user traffic off, this is not live.
**Fix:** Before user traffic, log one test request's X-Forwarded-For entry count (a count, not the addresses) and set the hop count from it. Refuse a candidate that `net.isIP()` rejects, and fall back to the peer.

## Fix run (gsd-code-fixer, 2026-11-24)

Scope: WR-01 to WR-10 and IN-01 to IN-08. Fixed 17, skipped 1 (IN-04). WR-04 and WR-09 are logic changes and need a human check of the order rule.

Commits that change services/decision-relay/ code or a file the relay loads (the deployed copy must be refreshed from a commit that holds them): 49b6bd5dc (WR-02), 839017ad7 (WR-01, IN-08), 336c4c3ee (IN-01, IN-02, IN-03), 218d2a9a5 (IN-05). None of them changes data/command-registry.json or data/job-vocabulary.json, so catalogFingerprint() is unchanged and current clients do not get catalog_skew.

Gates (PROVEN in the fix worktree): bash tests/run-all-400.sh exit 0 (it also runs bash tests/run-all-399.sh, exit 0); bash tests/run-all-399.sh exit 0 on its own; node scripts/build-skill-mirrors.cjs --check OK; tests/test-400-relay.cjs 31 passed, test-400-relay-server.cjs 9 passed, test-400-relay-packaging.cjs 5 passed, test-400-relay-transport.cjs 22 passed, test-400-relay-fence.cjs 3 passed; tests/test-237-one-authority-fence.cjs, test-399-one-selector-fence.cjs and test-369-hook-require-graph.cjs exit 0.

---

_Reviewed: 2026-11-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
