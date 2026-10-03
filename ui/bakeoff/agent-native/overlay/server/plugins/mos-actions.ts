// Candidate B: mount the slice actions WITHOUT agent-native's chat plugin
// (Phase 369 D-14, SEED-067). The scaffold mounts action routes from inside its
// agent-chat plugin, which needs a hosted database in production (spike 007,
// trail 7) and runs a model loop this shell does not use. This plugin mounts the
// same HTTP action routes from the same static registry and nothing else: no
// chat, no agent tool list, no MCP endpoint. serve.sh refuses the framework's
// own agent-chat, integrations, terminal, onboarding, observational-memory and
// context-xray default plugins (AGENT_NATIVE_DISABLED_PLUGINS).
import { defineNitroPlugin, getSession, loadActionsFromStaticRegistry, mountActionRoutes } from "@agent-native/core/server";
import { mountUiActionCapabilityRoute } from "@agent-native/core/server/edge";

import actionsRegistry from "../../.generated/actions-registry.js";

export default defineNitroPlugin((nitroApp) => {
  // The human-only actions (uiOnly) need the signed-in UI capability cookie; the
  // framework mounts its route from the core-routes plugin, which does not
  // finish booting without a hosted database, so it is mounted here.
  mountUiActionCapabilityRoute(nitroApp);
  mountActionRoutes(nitroApp, loadActionsFromStaticRegistry(actionsRegistry), {
    appId: "mindrian-shell",
    // The framework's session owner (the local account when auth is off). The
    // slice's own door is the browser session cookie (actions/*.ts authorize).
    getOwnerFromEvent: async (event: unknown) => {
      const session = await getSession(event as never);
      return session && session.email ? session.email : "local";
    },
  });
});
