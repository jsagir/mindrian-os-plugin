# Feynman-MINTO Guardian Validators

Phase 88-13 ships the guardian at `scripts/feynman-minto-guardian.cjs` with a
plugin registry that loads every `.cjs` file dropped into this directory.
Adding a new validator means dropping a file here. The guardian does not
need to change.

## Contract

Every validator must export the following shape:

```cjs
module.exports = {
  id:           'my-validator',             // unique, sortable, snake or kebab
  severity_map: { critical: 3, error: 2, warning: 1, info: 0 },
  scope:        'section',                  // 'section' | 'room' (default: 'section')
  validate:     function (path, ctx) {      // path is sectionDir OR roomDir
    // ctx = { roomDir, kind, now, validators } -- optional but guardian provides
    return {
      severity:   'warning' | 'error' | 'critical' | 'info' | null,
      violations: [                         // zero or more
        {
          validator:   'my-validator',
          category:    'string key',
          severity:    'warning',
          message:     'human-readable explanation',
          action_hint: 'optional_slug_like_this',  // optional
          section:     'market-analysis',          // optional
          field:       'governing_thought',        // optional
        },
      ],
    };
  },
};
```

### Scope modes

- `'section'` (default): guardian invokes `validate(sectionDir, ctx)` once per
  section directory that holds ROOM.md. Use this for per-section content
  invariants (MINTO content checks, cross-ref presence, local graph edges).
- `'room'`: guardian invokes `validate(roomDir, ctx)` once per room. Use this
  for room-wide invariants that do not partition cleanly by section. The
  three lifecycle validators shipped in Phase 88 (snapshot-integrity,
  queue-health, stale-lifecycle) are all room-scoped because the file they
  inspect lives at `.mindrian/*.json`, not per-section.

### Severity semantics

The guardian aggregates violations into `.mindrian/invariant-report.json`
during `on-stop` mode and writes them as `systemMessage` during
`session-start`. Severity has two distinct enforcement points:

- **Runtime (session-start + on-stop):** advisory only. No exit code
  indicates blocking. The user sees a TRIPLE_CONTEXT footer that surfaces
  violations, but the session continues.
- **pre-commit:** blocking. Any violation whose severity is `critical` or
  `error` causes the guardian to exit 2 and the commit to fail. Warnings
  and info are visible but never block.

### Fail-open

If your validator's `validate` function throws, the guardian catches it,
logs to stderr, and continues with the remaining validators. If the module
itself throws at require time (syntax error, missing import), the guardian
skips the file with a stderr warning and keeps loading the rest. One
broken validator never breaks the whole registry.

### Id collision

If two validators declare the same `id`, the first one loaded wins
(alphabetical by filename). The second is logged as a collision and
skipped. This lets downstream phases override a shipped validator simply
by ordering their file before it (e.g. `00-custom-minto-invariants.cjs`
shadows `01-minto-invariants.cjs`).

### Testing registration

Your validator is automatically loaded the next time
`scripts/feynman-minto-guardian.cjs` runs in any mode. To test the loader
without spawning the hook, set `GUARDIAN_VALIDATORS_DIR=/abs/path/to/my/validators`
in the environment and point at a fresh directory containing only the
file under test.

## Seed validators (reference implementations)

### 1. `minto-invariants.cjs` (core)

Wraps `lib/core/feynman-minto-invariants.cjs` (88-00-B). Flags schema,
freshness, coherence, and atomicity violations in the section's MINTO.md.
This is the first-in validator that proves the registry pattern; the
guardian does not require the invariants module directly, it goes through
this adapter.

### 2. `snapshot-integrity.cjs` (MEM-GUARDIAN-SNAPSHOT-01)

Reads `.mindrian/session-snapshot.json` and cross-checks its `sections[]`
array against the sections discovered on disk (via ROOM.md presence).

- Partial snapshot (disk section missing from snapshot) -> `warning`
  `partial_snapshot_detected` per missing section.
- Empty snapshot with non-empty room -> `error` `snapshot_empty` with
  `action_hint: rerun_on_stop`.
- Missing snapshot file -> silent (healthy first-session state).
- Unparseable snapshot -> `error` `snapshot_unparseable`.

Converts "on-stop crashed mid-walk, nobody notices for 20 sessions" into
"visible at the very next session-start footer."

### 3. `queue-health.cjs` (MEM-GUARDIAN-QUEUE-01)

Reads `.mindrian/minto-queue.json` (written by 88-02 debouncer). Enforces
size ceilings:

- `< 500 entries` -> healthy (no violation).
- `500-999 entries` -> `warning` `queue_approaching_ceiling`.
- `>= 1000 entries` -> `error` `queue_ceiling_exceeded` with
  `action_hint: halt_enqueue_until_drained`.

Emits at most ONE aggregate violation per invocation, not N per entry.
Converts "debouncer drain never fires, queue grows unbounded" into a
visible health signal.

### 4. `stale-lifecycle.cjs` (MEM-GUARDIAN-STALE-01)

Re-validates `.mindrian/minto-stale.json` entries against the current
MINTO state. A stale entry whose section now has an invariant-clean
MINTO is a GHOST: the ledger lies. Emits `warning` `stale_ghost` with
`action_hint: prune_stale_entry` and `section: <name>`. The guardian
`on-stop` mode consumes these signals and atomically rewrites
`minto-stale.json` with ghost sections removed (tmp + rename).

Converts "stale entries never clear, footer shows phantom staleness
forever" into self-pruning behavior.

## Downstream extension points

Phase 88.3 (Brain cognitive-loop contract) will drop
`cognitive-loop-contract.cjs` here. Phase 90 (Navigation Engine) will drop
`navigation-invariants.cjs`. Neither modifies the guardian. The registry
is the integration point.

## Authoring checklist

- [ ] `id` is unique and stable (shipped IDs appear in telemetry and
      reports; renaming breaks downstream consumers)
- [ ] `severity_map` is present even if unused (guardian validates the
      shape at load time)
- [ ] `validate` returns the documented shape in all paths, including
      error paths
- [ ] Your validator is fail-safe: throwing is acceptable (guardian
      catches), but infinite loops are not (cap every loop)
- [ ] Every violation carries `{validator: '<your id>'}` even though the
      guardian also tags them (belt + suspenders for report traceability)
- [ ] README entry above (add yours after a shipping commit)

_Three-surface by construction: CJS, Node built-ins, zero new deps._
