'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 199-04 (AS-03 / AS-04) -- the AgentShield surface adapters + run orchestrator.
 * ==========================================================================
 * This is the I/O layer that sits ABOVE the pure 199-03 engine
 * (lib/core/security/agentshield-scanner.cjs). It separates "what to scan"
 * (these 5 gatherers) from "how to classify" (scanSurface). The engine stays
 * surface-agnostic and pure; the gatherers own all filesystem reads.
 *
 * Five gatherers, each reading a REAL plugin-local surface and returning an
 * array of { surface, id, target } entries -- no gatherer makes a scanning
 * decision, it only produces targets for scanSurface():
 *   1. gatherMcpToolDescriptions -> .mcp.json mcpServers + each server's
 *      entry-point source (STATIC description-string extraction, never a live
 *      MCP handshake; this file NEVER starts a server).
 *   2. gatherHookCommands        -> hooks/hooks.json (command STRING only, never
 *      executed -- T-199-04-02 mitigate).
 *   3. gatherSkillFiles          -> .claude/skills SKILL.md + skills SKILL.md.
 *   4. gatherClaudeMdPermissions -> CLAUDE.md + .claude/rules .md files.
 *   5. gatherSupplyChainTargets  -> package.json dependencies.
 *
 * runAgentShieldScan(opts) calls scanSurface() once per gathered target across
 * all 5 NON-Brain surfaces and aggregates into one report shaped for a Shape E
 * Action Report render. brain_egress is NOT gathered/scanned here -- that surface
 * is already exercised at the classify()/PreToolUse-hook layer shipped by Phase
 * 196; AgentShield's orchestrator covers the 5 NEW surfaces only (this phase's
 * own scope).
 *
 * Part 7 (reuse before build): the classification logic is NOT reimplemented --
 * every target flows through scanSurface() from 199-03. Part 8 (LOCAL): every
 * read is a plugin-local, repo-tracked file; NO network wire opens here. Every
 * gatherer opens files READ-ONLY (T-199-04-01 mitigate-by-construction).
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 * Pure CJS, zero npm deps.
 *
 * License: BSL 1.1.
 */

const fs = require('fs');
const path = require('path');
const { scanSurface } = require('./agentshield-scanner.cjs');

// Repo root = three levels up from lib/core/security/.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function _root(opts) {
  return (opts && opts.root) ? opts.root : REPO_ROOT;
}

function _readTextOrNull(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function _readJsonOrNull(p) {
  const txt = _readTextOrNull(p);
  if (txt === null) return null;
  try {
    return JSON.parse(txt);
  } catch (_e) {
    return null;
  }
}

// Strip a ${CLAUDE_PLUGIN_ROOT}/ (or any ${VAR}/) prefix from a configured path
// so it resolves against the local repo root for a STATIC read.
function _stripPluginRootPrefix(s) {
  return String(s || '').replace(/\$\{[^}]+\}\/?/g, '');
}

function _lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// ---------------------------------------------------------------------------
// 1. gatherMcpToolDescriptions -- reads .mcp.json's mcpServers map and, for each
// server's entry-point file, STATICALLY extracts tool description string literals
// via a bounded regex over the source TEXT. This is a static read, never a live
// MCP handshake (this plan never starts a server). MindrianOS declares its MCP
// tool descriptions through the SDK's zod `.describe('...')` helper as well as
// plain `description:` object literals, so both forms are captured -- each is the
// same prompt-injection attack surface (a poisoned tool-description string).
// ---------------------------------------------------------------------------
function gatherMcpToolDescriptions(opts) {
  const root = _root(opts);
  const out = [];
  const mcp = _readJsonOrNull(path.join(root, '.mcp.json'));
  if (!mcp || !mcp.mcpServers || typeof mcp.mcpServers !== 'object') return out;

  const serverNames = Object.keys(mcp.mcpServers);
  for (let s = 0; s < serverNames.length; s++) {
    const name = serverNames[s];
    const cfg = mcp.mcpServers[name] || {};
    const args = Array.isArray(cfg.args) ? cfg.args : [];
    // The entry-point is the last .cjs/.js argument.
    let entry = null;
    for (let a = args.length - 1; a >= 0; a--) {
      const cleaned = _stripPluginRootPrefix(args[a]);
      if (/\.(c?js)$/.test(cleaned)) { entry = cleaned; break; }
    }
    if (!entry) continue;
    const src = _readTextOrNull(path.join(root, entry));
    if (src === null) continue;

    // Match `.describe('...')` / `.describe("...")` and `description: '...'` /
    // `description: "..."`. Captures the quote in group 1, the body in group 2.
    const re = /(?:\.describe\s*\(|\bdescription\s*:)\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      out.push({
        surface: 'mcp_tool_description',
        id: name + '.' + _lineOf(src, m.index),
        target: m[2],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. gatherHookCommands -- reads hooks/hooks.json, walks every hook-type array,
// and extracts each hook's `command` STRING. The command is never executed
// (T-199-04-02): only the literal string is handed to scanSurface().
// ---------------------------------------------------------------------------
function gatherHookCommands(opts) {
  const root = _root(opts);
  const out = [];
  const doc = _readJsonOrNull(path.join(root, 'hooks', 'hooks.json'));
  const hooks = doc && doc.hooks && typeof doc.hooks === 'object' ? doc.hooks : null;
  if (!hooks) return out;

  const hookTypes = Object.keys(hooks);
  for (let t = 0; t < hookTypes.length; t++) {
    const hookType = hookTypes[t];
    const groups = Array.isArray(hooks[hookType]) ? hooks[hookType] : [];
    let idx = 0;
    for (let g = 0; g < groups.length; g++) {
      const inner = groups[g] && Array.isArray(groups[g].hooks) ? groups[g].hooks : [];
      for (let h = 0; h < inner.length; h++) {
        const cmd = inner[h] && inner[h].command;
        if (typeof cmd !== 'string' || cmd.length === 0) continue;
        out.push({
          surface: 'hook_scope',
          id: hookType + '.' + idx,
          target: cmd,
        });
        idx++;
      }
    }
  }
  return out;
}

// One-level glob helper: for each parent in `parents`, list its immediate
// subdirectories and, if `child` exists inside, yield the path. Bounded to one
// directory level (T-199-04-03 accept: repo-local, plugin-sized).
function _globChildInSubdirs(root, parents, child) {
  const results = [];
  for (let p = 0; p < parents.length; p++) {
    const parentAbs = path.join(root, parents[p]);
    let names;
    try {
      names = fs.readdirSync(parentAbs, { withFileTypes: true });
    } catch (_e) {
      continue;
    }
    for (let i = 0; i < names.length; i++) {
      if (!names[i].isDirectory()) continue;
      const rel = path.join(parents[p], names[i].name, child);
      const abs = path.join(root, rel);
      try {
        if (fs.statSync(abs).isFile()) results.push(rel);
      } catch (_e) { /* not a file */ }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 3. gatherSkillFiles -- globs the SKILL.md under each .claude/skills and skills
// subdirectory, returning one entry per file with FULL file contents as target (skill
// injection can hide anywhere in the body) and the relative path as id.
// ---------------------------------------------------------------------------
function gatherSkillFiles(opts) {
  const root = _root(opts);
  const out = [];
  const rels = _globChildInSubdirs(root, ['.claude/skills', 'skills'], 'SKILL.md');
  for (let i = 0; i < rels.length; i++) {
    const body = _readTextOrNull(path.join(root, rels[i]));
    if (body === null) continue;
    out.push({
      surface: 'skill_injection',
      id: rels[i],
      target: body,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. gatherClaudeMdPermissions -- reads CLAUDE.md (project root) plus any
// .claude/rules/*.md, one entry per file with the FULL file contents as target.
// The claudemd_permission rules fire on the whole file: the attack class is "a
// permission-granting line ANYWHERE in the file", not a per-line concern.
// ---------------------------------------------------------------------------
function gatherClaudeMdPermissions(opts) {
  const root = _root(opts);
  const out = [];

  const claudeMd = _readTextOrNull(path.join(root, 'CLAUDE.md'));
  if (claudeMd !== null) {
    out.push({ surface: 'claudemd_permission', id: 'CLAUDE.md', target: claudeMd });
  }

  const rulesDir = path.join(root, '.claude', 'rules');
  let entries = [];
  try {
    entries = fs.readdirSync(rulesDir, { withFileTypes: true });
  } catch (_e) {
    entries = [];
  }
  for (let i = 0; i < entries.length; i++) {
    if (!entries[i].isFile() || !/\.md$/.test(entries[i].name)) continue;
    const rel = path.join('.claude', 'rules', entries[i].name);
    const body = _readTextOrNull(path.join(root, rel));
    if (body === null) continue;
    out.push({ surface: 'claudemd_permission', id: rel, target: body });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. gatherSupplyChainTargets -- reads package.json's `dependencies` and returns
// one { surface:'supply_chain', id:name, target:{name, version} } per dependency.
// ---------------------------------------------------------------------------
function gatherSupplyChainTargets(opts) {
  const root = _root(opts);
  const out = [];
  const pkg = _readJsonOrNull(path.join(root, 'package.json'));
  const deps = pkg && pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : null;
  if (!deps) return out;
  const names = Object.keys(deps);
  for (let i = 0; i < names.length; i++) {
    out.push({
      surface: 'supply_chain',
      id: names[i],
      target: { name: names[i], version: deps[names[i]] },
    });
  }
  return out;
}

// The 5 non-Brain gatherers, in a stable order.
const GATHERERS = [
  gatherMcpToolDescriptions,
  gatherHookCommands,
  gatherSkillFiles,
  gatherClaudeMdPermissions,
  gatherSupplyChainTargets,
];

// Verdict severity ordering for the per-surface worst-of rollup.
const _VERDICT_RANK = { clean: 0, ambiguous: 1, flagged: 2 };
function _worse(a, b) {
  return (_VERDICT_RANK[b] > _VERDICT_RANK[a]) ? b : a;
}

// ---------------------------------------------------------------------------
// runAgentShieldScan(opts) -- gathers every target across the 5 non-Brain
// surfaces, runs scanSurface() on each, and aggregates into one report:
//   {
//     scannedAt,
//     surfaces: { <surface>: { verdict (worst-of), findingCount } },
//     totalFlagged, totalAmbiguous,
//     findings: [ { surface, id, ruleId, reason } ]  (non-clean entries only)
//   }
// ---------------------------------------------------------------------------
function runAgentShieldScan(opts) {
  opts = opts || {};
  const surfaces = {};
  const findings = [];
  let totalFlagged = 0;
  let totalAmbiguous = 0;

  for (let gi = 0; gi < GATHERERS.length; gi++) {
    const entries = GATHERERS[gi](opts) || [];
    for (let e = 0; e < entries.length; e++) {
      const entry = entries[e];
      const res = scanSurface(entry.surface, entry.target, opts) || {};
      const verdict = res.verdict || 'clean';

      if (!surfaces[entry.surface]) {
        surfaces[entry.surface] = { verdict: 'clean', findingCount: 0 };
      }
      const bucket = surfaces[entry.surface];
      bucket.verdict = _worse(bucket.verdict, verdict);

      if (verdict !== 'clean') {
        bucket.findingCount++;
        if (verdict === 'flagged') totalFlagged++;
        else if (verdict === 'ambiguous') totalAmbiguous++;

        const resFindings = Array.isArray(res.findings) ? res.findings : [];
        if (resFindings.length === 0) {
          findings.push({ surface: entry.surface, id: entry.id, ruleId: null, reason: verdict });
        } else {
          for (let f = 0; f < resFindings.length; f++) {
            findings.push({
              surface: entry.surface,
              id: entry.id,
              ruleId: resFindings[f].ruleId,
              reason: resFindings[f].reason,
            });
          }
        }
      }
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    surfaces: surfaces,
    totalFlagged: totalFlagged,
    totalAmbiguous: totalAmbiguous,
    findings: findings,
  };
}

// ---------- Exports ----------
module.exports = {
  gatherMcpToolDescriptions: gatherMcpToolDescriptions,
  gatherHookCommands: gatherHookCommands,
  gatherSkillFiles: gatherSkillFiles,
  gatherClaudeMdPermissions: gatherClaudeMdPermissions,
  gatherSupplyChainTargets: gatherSupplyChainTargets,
  runAgentShieldScan: runAgentShieldScan,
};
