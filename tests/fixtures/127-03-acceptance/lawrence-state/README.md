# Fixture: lawrence-state (acceptance gate 3)

Hermetic state: fresh `HOME=$TMPDIR`, no `~/.mindrian.env`, but a synthesized legacy user-scope HTTP-transport `mindrian-brain` entry exists (synthesized via a tmp `claude` shim binary in PATH that returns the synthetic legacy-entry JSON on `claude mcp get mindrian-brain --scope user`).

Expected behavior: running `scripts/migrate-brain-mcp-from-http-to-stdio.cjs` removes the legacy entry (via the mocked `claude mcp remove`), writes the snapshot, appends the idempotency log. Subsequent shim spawn succeeds. A second migration run is a no-op (SG-4 idempotency).

This represents the existing tester cohort (pseudonymized) who wired the Brain manually before v1.13.0-beta.20.
