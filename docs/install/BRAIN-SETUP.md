# Brain Setup (v1.13.0-beta.20+)

MindrianOS connects to a remote Brain (a Neo4j + Pinecone methodology graph) for framework chaining, semantic search, and orchestration. The Brain is optional; without a key the plugin still works at Tier-0 (Local: Larry + room context, no methodology orchestration).

## One-step onboarding

1. Drop your Brain API key in `~/.mindrian.env`:
   ```
   echo "MINDRIAN_BRAIN_KEY=<your-key>" > ~/.mindrian.env
   chmod 600 ~/.mindrian.env
   ```
2. Restart Claude Code. The plugin's bundled stdio shim auto-loads on every session.

That's it. Two steps total: install plugin, drop key.

Don't have a key? Request one at https://mindrian-os.com/brain-access. Without a key, methodology consults are visibly refused (a structured "Brain unavailable" response, DIRECTOR_NOT_AVAILABLE) with a one-line path to a key; conversation and room context remain available.

## What changed in v1.13.0-beta.20

Before beta.20, you had to run:
```
claude mcp add -t http -s user -H "Authorization: Bearer $KEY" \
  -- mindrian-brain https://mindrian-brain.onrender.com/mcp
```
and restart, and hope nothing fell through.

From beta.20 onward, the plugin bundles its own stdio shim via `.mcp.json`. No manual `claude mcp add` is required. The bundled stdio entry replaces the legacy user-scope HTTP-transport registration on first launch via auto-migration.

## Migration for existing testers

If you wired the Brain manually before beta.20 (the legacy user-scope HTTP-transport `mindrian-brain` registration), the plugin auto-migrates you on first launch. The legacy entry is removed via the supported `claude mcp remove --scope user mindrian-brain` CLI; the plugin-bundled stdio entry takes over.

Safety guards (all enforced by the migration script):
- **SG-1**: the migration script NEVER writes to `~/.claude.json` directly under any code path. All mutations route through the supported `claude mcp <add|remove>` CLI.
- **SG-2**: before any state-changing CLI call, a pre-migration snapshot lands at `~/.mindrian/pre-migration-snapshots/<ISO>.json`.
- **SG-3**: dry-run mode prints planned actions without state changes:
  ```
  node scripts/migrate-brain-mcp-from-http-to-stdio.cjs --dry-run
  ```
- **SG-4**: idempotency log at `~/.mindrian/migrations.jsonl` uses sha256 fingerprints (no raw identifiers). Re-running the migration is a deterministic no-op.

Two-key conflict: if your legacy user-scope entry has a different Bearer token than `~/.mindrian.env`, the migration REFUSES to auto-migrate and surfaces a one-line warning instructing you to rotate keys first.

## Diagnostics

`/mos:doctor --brain-smoke` runs a 5-layer end-to-end probe:
1. Plugin root resolver
2. Brain key resolver
3. HTTPS schema probe
4. MCP stdio handshake against the bundled shim
5. End-to-end brain_schema call through the MCP path

Reports the exact failing layer if anything is wrong. Use `--json` for machine-readable output.

## Tier-0 (Local Only) behavior

Without a key, every Brain command returns a Tier-0 sentinel:
```json
{
  "status": "DIRECTOR_NOT_AVAILABLE",
  "reason": "MINDRIAN_BRAIN_KEY not set",
  "command_context": "<command name>",
  "upgrade_hint": "Request a Brain key at https://mindrian-os.com/brain-access",
  "fallback_advice": "Larry can still talk with you and reflect on your room context. Methodology orchestration requires Brain."
}
```

Larry's prose surface reads this and surfaces a Larry-voiced one-line upgrade hint, never an opaque error.

## Three-tier release plan

| Track | Audience | Path |
|---|---|---|
| A | Existing testers wired pre-beta.20 | Auto-migration removes legacy entry on first launch |
| B | New installs (beta.20+) | Two steps: install plugin, drop key |
| C | Existing users on earlier versions who never wired Brain | Auto-lights-up the moment a key is dropped in `~/.mindrian.env` |

## Where the key is read from

`lib/core/resolve-brain-key.cjs` (Phase 123 Plan-07) is the single source of truth. Lookup order:

1. `MINDRIAN_BRAIN_KEY` env var (explicit operator intent, highest priority)
2. `~/.mindrian.env` containing `MINDRIAN_BRAIN_KEY=<key>` (global backup, persists across CWDs)
3. `<cwd>/.env` containing `MINDRIAN_BRAIN_KEY=<key>` (project-local override)
4. not-found

On POSIX, both `.env`-style files MUST be `chmod 600`. The resolver refuses to load a key from a group/world-readable file (SEC-02).

## References

- `.planning/phases/127-brain-mcp-local-stdio-shim/127-CONTEXT.md` (design contract for this milestone)
- `docs/CAPABILITY-MAP.md` (Brain / plugin capability contract; DirectiveEnvelope spec)
- `data/capability-map-registry.json` (machine-readable capability map mirror)
- `bin/mindrian-brain-mcp-client.cjs` (the bundled stdio shim)
- `lib/core/brain-client.cjs` (the HTTPS path the shim wraps; the sole network surface per Canon Part 8)
- `scripts/migrate-brain-mcp-from-http-to-stdio.cjs` (the auto-migration script)
