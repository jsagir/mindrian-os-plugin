# services/

ICM Layer 0 identity for this folder.

services/ holds code that is served, not shipped. Nothing here is in package.json files. Each service has its own ROOM.md and README.

What this folder is: the home of small hosted services that run on a server the owner controls. A plugin install never loads a file from here. The npm package allowlist (package.json `files`) has no `services` entry, so no file here reaches a user machine.

What this folder is not: plugin code, a hook, an MCP tool, or a shared library. Shared library code stays in `lib/core/`; a service requires it by relative path and never copies it.

Contents:
- `decision-relay/` - Phase 400 (S4, O-07, O-08, O-09): the labels-only decision relay in front of Gemini Decision.

Canon: Part 8 (only closed labels leave the machine), Part 7 (reuse before build: one validator, one source of truth).
