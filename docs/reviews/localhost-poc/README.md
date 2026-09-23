# MindrianOS localhost workspace POC

This is a separate proof of concept for the proposed workspace. It demonstrates:

- a plain-textarea working file with local save/reload (lossless -- no HTML<->Markdown round trip);
- a `Local graph` tab with a relationship view, refreshed automatically after every save;
- `Graph lookup (deterministic, no model)`, which searches the local graph and returns matching
  nodes, edges and references -- a labelled local lookup, never a model call;
- external-edit detection (polls the working file's revision every 2 seconds; a clean editor
  reloads silently, a dirty editor shows a conflict banner and never loses either version);
- task, evidence, decision, and activity surfaces in one workspace.

## Running it

Fixture mode (safe, uses `data/graph.json` and `data/workspace.md`, no room required):

```bash
node docs/reviews/localhost-poc/server.cjs 3196
```

Room mode, bound to a real MindrianOS room (the room must already exist -- an existing
`<room dir>/.mindrian/room.db` -- the server explicitly refuses to start against an unbound
directory rather than silently falling back to fixture behavior):

```bash
node docs/reviews/localhost-poc/server.cjs 3196 --room <room dir> [--section <slug>]
```

`--section` defaults to `workspace` and is validated against the same `[a-z0-9-]+` gate the
`artifact_file` MCP tool uses; a malformed section refuses to start before the server ever
listens.

Open <http://localhost:3196>.

## Where the working file goes

In room mode the working file is filed at `<room dir>/<section>/workspace-poc.md` through the
SAME governed door the `artifact_file` MCP tool uses (`lib/mcp/tools/views.cjs`'s
`_internal.fileArtifact`): section containment (realpath-checked), a stable `artifact_id`, a
`memory_event` row, and a `claim:artifact:<id>` node in the room's local graph. It is never
written raw into the room root, and a GET never writes anything (a missing file simply reads
back empty). In fixture mode the same content lands at `data/workspace.md` through a local
atomic temp-file-then-rename writer.

## Origin and capability model

Every route enforces a Host allowlist bound to the port this process actually listens on
(closes a DNS-rebinding path); every POST additionally requires an exact-Origin match, a
`Content-Type: application/json` body, and a per-launch capability token
(`X-Mindrian-Poc-Token`) delivered only via a same-origin `<meta>` tag a foreign page can never
read. Saves are optimistic-concurrency revisioned (`sha256` of the file's exact bytes); a stale
`base_revision` returns `409` instead of silently overwriting a concurrent editor's work.

## Journey test

The full browser-to-room-to-graph journey (bind, edit/save/reopen, governed index, inspect,
grounded ask with references, external edit clean and dirty) is an executable Playwright test
on a temporary room:

```bash
node tests/test-354-poc-room-journey.cjs
```

The origin/capability/save-format regression for both modes:

```bash
node tests/test-354-poc-save-origin.cjs
```

## What this POC does not do

No model conversation of any kind, no Claude session bridge, and no multi-user locking beyond
the revision-conflict detection described above (two tabs editing the same file will each see
their own conflict banner, but nothing merges their edits). It makes no remote calls -- the
graph lookup is a deterministic local search over the room's own graph, never a network round
trip. It is deliberately separate from the legacy `localhost:3131` dashboard.
