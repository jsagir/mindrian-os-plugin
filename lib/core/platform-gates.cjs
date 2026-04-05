'use strict';

/**
 * platform-gates.cjs -- GrowthBook feature gate monitor
 *
 * Monitors Anthropic platform feature gates via environment variables.
 * Returns boolean status for each gate so MindrianOS can auto-activate
 * features when they go live.
 *
 * Gates are GrowthBook feature flags injected into the Claude runtime
 * environment when Anthropic ships new platform capabilities.
 *
 * Requirement: READY-04
 */

const fs = require('fs');
const path = require('path');

/**
 * Known platform gates and their MindrianOS feature mappings
 */
const GATE_MAP = {
  tengu_kairos: {
    envVar: 'tengu_kairos',
    description: 'KAIROS background memory - daily log consolidation, overnight context processing',
    mindrianFeature: 'kairos-daily-log',
    skillAffected: 'context-engine',
  },
  tengu_harbor: {
    envVar: 'tengu_harbor',
    description: 'UDS cross-instance state sharing - multi-user room sync',
    mindrianFeature: 'uds-listener',
    skillAffected: 'room-passive',
  },
  tengu_scratch: {
    envVar: 'tengu_scratch',
    description: 'Scratch persistent workspace - file persistence across sessions',
    mindrianFeature: 'persistent-workspace',
    skillAffected: 'room-passive',
  },
  tengu_portal_quail: {
    envVar: 'tengu_portal_quail',
    description: 'Portal - enhanced MCP App rendering and interaction capabilities',
    mindrianFeature: 'enhanced-mcp-apps',
    skillAffected: 'app-views',
  },
};

/**
 * Check all known platform gates
 *
 * @returns {{ kairos: boolean, harbor: boolean, scratch: boolean, portal: boolean }}
 */
function checkGates() {
  return {
    kairos: isGateActive('tengu_kairos'),
    harbor: isGateActive('tengu_harbor'),
    scratch: isGateActive('tengu_scratch'),
    portal: isGateActive('tengu_portal_quail'),
  };
}

/**
 * Check if a specific gate is active
 *
 * A gate is active when:
 * 1. The corresponding env var is set to 'true' or '1', OR
 * 2. A local override file exists at room/.mindrian/{gate}-active
 *
 * @param {string} gateName - Gate key from GATE_MAP
 * @param {string} [roomPath] - Optional room path for local override check
 * @returns {boolean}
 */
function isGateActive(gateName, roomPath) {
  const gate = GATE_MAP[gateName];
  if (!gate) return false;

  // Check environment variable
  const envVal = process.env[gate.envVar];
  if (envVal === 'true' || envVal === '1') return true;

  // Check local override file (allows testing without env var)
  if (roomPath) {
    const overridePath = path.join(roomPath, '.mindrian', `${gateName}-active`);
    if (fs.existsSync(overridePath)) return true;
  }

  return false;
}

/**
 * Get a summary of all gates for session-start display
 *
 * @param {string} [roomPath] - Optional room path for local override check
 * @returns {object} Summary with active gates and their features
 */
function getGateSummary(roomPath) {
  const gates = checkGates();
  const active = [];
  const inactive = [];

  for (const [key, isActive] of Object.entries(gates)) {
    const fullKey = key === 'portal' ? 'tengu_portal_quail' : `tengu_${key}`;
    const gate = GATE_MAP[fullKey];
    if (isActive) {
      active.push({ gate: fullKey, feature: gate.mindrianFeature, skill: gate.skillAffected });
    } else {
      inactive.push(fullKey);
    }
  }

  return {
    anyActive: active.length > 0,
    active,
    inactive,
    total: Object.keys(GATE_MAP).length,
  };
}

module.exports = { checkGates, isGateActive, getGateSummary, GATE_MAP };
