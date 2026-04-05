'use strict';

/**
 * MindrianOS Plugin -- Daily Briefing Generator (SCHED-02)
 *
 * Generates a daily briefing from room state:
 *   - Approaching prediction deadlines (from .predictions/REGISTRY.json)
 *   - New contradictions detected by intelligence-cascade
 *   - Stale sections (no updates in 7+ days)
 *   - Room health summary (section coverage, artifact counts)
 *   - Recent intelligence findings
 *
 * Output: room/intelligence/briefing-YYYY-MM-DD.md
 * Idempotent: running twice on the same day overwrites with same content.
 *
 * @module daily-briefing
 */

const fs = require('fs');
const path = require('path');

const MS_PER_DAY = 86400000;
const STALE_THRESHOLD_DAYS = 7;

/**
 * Recursively collect .md files with mtimes.
 * @param {string} dir
 * @param {string} baseDir
 * @returns {Array<{relPath: string, mtime: number}>}
 */
function collectMdFiles(dir, baseDir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectMdFiles(fullPath, baseDir));
      } else if (entry.name.endsWith('.md') && entry.name !== 'STATE.md' && entry.name !== 'ROOM.md') {
        try {
          const stat = fs.statSync(fullPath);
          results.push({ relPath: path.relative(baseDir, fullPath), mtime: stat.mtimeMs });
        } catch (_e) { /* skip */ }
      }
    }
  } catch (_e) { /* skip */ }
  return results;
}

/**
 * Get prediction deadlines from REGISTRY.json.
 * @param {string} roomDir
 * @returns {Array<{title: string, deadline: string, daysRemaining: number, status: string}>}
 */
function getPredictionDeadlines(roomDir) {
  const registryPath = path.join(roomDir, '.predictions', 'REGISTRY.json');
  if (!fs.existsSync(registryPath)) return [];

  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    const registry = JSON.parse(raw);
    const predictions = registry.predictions || registry.entries || [];
    const now = Date.now();
    const results = [];

    for (const pred of predictions) {
      const deadline = pred.deadline || pred.due_date;
      if (!deadline) continue;
      const deadlineMs = new Date(deadline).getTime();
      if (isNaN(deadlineMs)) continue;

      const daysRemaining = Math.floor((deadlineMs - now) / MS_PER_DAY);
      results.push({
        title: pred.title || pred.description || pred.id || 'Untitled',
        deadline,
        daysRemaining,
        status: daysRemaining < 0 ? 'OVERDUE' : daysRemaining <= 3 ? 'URGENT' : daysRemaining <= 14 ? 'APPROACHING' : 'OK',
      });
    }

    results.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return results;
  } catch (_e) {
    return [];
  }
}

/**
 * Detect contradictions from recent intelligence files.
 * Scans room/.intelligence/ for contradiction mentions in recent files.
 * @param {string} roomDir
 * @returns {Array<{file: string, excerpt: string}>}
 */
function getRecentContradictions(roomDir) {
  const intelDir = path.join(roomDir, '.intelligence');
  const contradictions = [];

  // Also check room/intelligence/ (some tools write there)
  const dirs = [intelDir, path.join(roomDir, 'intelligence')];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      const now = Date.now();

      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.statSync(fullPath);
          // Only recent files (last 7 days)
          if ((now - stat.mtimeMs) > 7 * MS_PER_DAY) continue;

          const content = fs.readFileSync(fullPath, 'utf8');
          // Look for contradiction markers
          const lines = content.split('\n');
          for (const line of lines) {
            if (/contradict|CONTRADICTS|conflict|inconsisten/i.test(line) && line.trim().length > 10) {
              contradictions.push({
                file: path.relative(roomDir, fullPath),
                excerpt: line.trim().slice(0, 200),
              });
              break; // One per file
            }
          }
        } catch (_e) { /* skip */ }
      }
    } catch (_e) { /* skip */ }
  }

  return contradictions;
}

/**
 * Get stale sections (no updates in 7+ days).
 * @param {string} roomDir
 * @returns {Array<{section: string, daysSinceUpdate: number, fileCount: number}>}
 */
function getStaleSections(roomDir) {
  const stale = [];
  const now = Date.now();

  try {
    const entries = fs.readdirSync(roomDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'exports' || entry.name === 'intelligence') continue;

      const sectionDir = path.join(roomDir, entry.name);
      const files = collectMdFiles(sectionDir, sectionDir);
      if (files.length === 0) continue;

      const latestMtime = Math.max(...files.map(f => f.mtime));
      const daysSince = Math.floor((now - latestMtime) / MS_PER_DAY);

      if (daysSince >= STALE_THRESHOLD_DAYS) {
        stale.push({
          section: entry.name,
          daysSinceUpdate: daysSince,
          fileCount: files.length,
        });
      }
    }
  } catch (_e) { /* skip */ }

  stale.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
  return stale;
}

/**
 * Get room health summary.
 * @param {string} roomDir
 * @returns {{ totalSections: number, totalArtifacts: number, sectionsWithContent: number, emptyRatio: number }}
 */
function getRoomHealth(roomDir) {
  let totalSections = 0;
  let sectionsWithContent = 0;
  let totalArtifacts = 0;

  try {
    const entries = fs.readdirSync(roomDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'exports' || entry.name === 'intelligence') continue;

      totalSections++;
      const files = collectMdFiles(path.join(roomDir, entry.name), roomDir);
      totalArtifacts += files.length;
      if (files.length > 0) sectionsWithContent++;
    }
  } catch (_e) { /* skip */ }

  return {
    totalSections,
    totalArtifacts,
    sectionsWithContent,
    emptyRatio: totalSections > 0 ? Math.round((1 - sectionsWithContent / totalSections) * 100) : 0,
  };
}

/**
 * Get recent intelligence summaries.
 * @param {string} roomDir
 * @returns {Array<{file: string, date: string, type: string}>}
 */
function getRecentIntelligence(roomDir) {
  const results = [];
  const dirs = [
    path.join(roomDir, '.intelligence'),
    path.join(roomDir, 'intelligence'),
  ];

  const now = Date.now();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.statSync(fullPath);
          if ((now - stat.mtimeMs) > 3 * MS_PER_DAY) continue; // Last 3 days only

          // Detect type from filename
          let type = 'general';
          if (file.includes('competitor')) type = 'competitor-watch';
          else if (file.includes('briefing')) type = 'briefing';
          else if (file.includes('grant') || file.includes('opportunity')) type = 'grant-discovery';
          else if (file.includes('news')) type = 'news';

          results.push({
            file: path.relative(roomDir, fullPath),
            date: new Date(stat.mtimeMs).toISOString().slice(0, 10),
            type,
          });
        } catch (_e) { /* skip */ }
      }
    } catch (_e) { /* skip */ }
  }

  return results;
}

/**
 * Generate the daily briefing as markdown content.
 *
 * @param {string} roomDir - Absolute path to room directory
 * @returns {{ content: string, outputPath: string, stats: { predictions: number, contradictions: number, staleSections: number } }}
 */
function generateBriefing(roomDir) {
  const today = new Date().toISOString().slice(0, 10);
  const predictions = getPredictionDeadlines(roomDir);
  const contradictions = getRecentContradictions(roomDir);
  const staleSections = getStaleSections(roomDir);
  const health = getRoomHealth(roomDir);
  const recentIntel = getRecentIntelligence(roomDir);

  // Read room name from STATE.md
  let roomName = path.basename(roomDir);
  const statePath = path.join(roomDir, 'STATE.md');
  if (fs.existsSync(statePath)) {
    try {
      const stateContent = fs.readFileSync(statePath, 'utf8');
      const nameMatch = stateContent.match(/^name:\s*(.+)$/m) || stateContent.match(/^room_name:\s*(.+)$/m);
      if (nameMatch) roomName = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    } catch (_e) { /* skip */ }
  }

  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`type: daily-briefing`);
  lines.push(`date: ${today}`);
  lines.push(`room: ${roomName}`);
  lines.push(`predictions_tracked: ${predictions.length}`);
  lines.push(`contradictions_found: ${contradictions.length}`);
  lines.push(`stale_sections: ${staleSections.length}`);
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('---');
  lines.push('');
  lines.push(`# Daily Briefing - ${today}`);
  lines.push('');

  // Room health
  lines.push('## Room Health');
  lines.push('');
  lines.push(`- **Sections:** ${health.sectionsWithContent}/${health.totalSections} with content`);
  lines.push(`- **Total artifacts:** ${health.totalArtifacts}`);
  if (health.emptyRatio > 30) {
    lines.push(`- **Warning:** ${health.emptyRatio}% of sections are empty`);
  }
  lines.push('');

  // Prediction deadlines
  lines.push('## Prediction Deadlines');
  lines.push('');
  if (predictions.length === 0) {
    lines.push('No predictions being tracked. Consider adding predictions with /mos:scenario-plan.');
    lines.push('');
  } else {
    const overdue = predictions.filter(p => p.status === 'OVERDUE');
    const urgent = predictions.filter(p => p.status === 'URGENT');
    const approaching = predictions.filter(p => p.status === 'APPROACHING');

    if (overdue.length > 0) {
      lines.push('### OVERDUE');
      lines.push('');
      for (const p of overdue) {
        lines.push(`- **${p.title}** - was due ${p.deadline} (${Math.abs(p.daysRemaining)} days ago)`);
      }
      lines.push('');
    }

    if (urgent.length > 0) {
      lines.push('### Urgent (0-3 days)');
      lines.push('');
      for (const p of urgent) {
        lines.push(`- **${p.title}** - due ${p.deadline} (${p.daysRemaining} day(s) remaining)`);
      }
      lines.push('');
    }

    if (approaching.length > 0) {
      lines.push('### Approaching (4-14 days)');
      lines.push('');
      for (const p of approaching) {
        lines.push(`- **${p.title}** - due ${p.deadline} (${p.daysRemaining} days remaining)`);
      }
      lines.push('');
    }
  }

  // Contradictions
  lines.push('## Contradictions & Conflicts');
  lines.push('');
  if (contradictions.length === 0) {
    lines.push('No contradictions detected in recent intelligence.');
    lines.push('');
  } else {
    for (const c of contradictions) {
      lines.push(`- **${c.file}**: ${c.excerpt}`);
    }
    lines.push('');
    lines.push('Consider running /mos:challenge-assumptions to resolve these.');
    lines.push('');
  }

  // Stale sections
  lines.push('## Stale Sections');
  lines.push('');
  if (staleSections.length === 0) {
    lines.push('All sections have been updated within the last 7 days.');
    lines.push('');
  } else {
    for (const s of staleSections) {
      lines.push(`- **${s.section}** - ${s.daysSinceUpdate} days since last update (${s.fileCount} artifact(s))`);
    }
    lines.push('');
    lines.push('Stale sections may contain outdated assumptions. Consider running /mos:scout to refresh.');
    lines.push('');
  }

  // Recent intelligence
  if (recentIntel.length > 0) {
    lines.push('## Recent Intelligence');
    lines.push('');
    for (const intel of recentIntel) {
      lines.push(`- [${intel.type}] ${intel.file} (${intel.date})`);
    }
    lines.push('');
  }

  // Suggested actions
  lines.push('## Suggested Actions');
  lines.push('');

  const overdue = predictions.filter(p => p.status === 'OVERDUE');
  if (overdue.length > 0) {
    lines.push('1. Review overdue predictions and update their status');
  }
  if (contradictions.length > 0) {
    lines.push(`${overdue.length > 0 ? '2' : '1'}. Resolve contradictions with /mos:challenge-assumptions`);
  }
  if (staleSections.length > 0) {
    lines.push(`- Refresh stale sections: ${staleSections.map(s => s.section).join(', ')}`);
  }
  if (health.emptyRatio > 30) {
    lines.push('- Fill empty room sections to improve intelligence coverage');
  }
  lines.push('');

  const content = lines.join('\n');

  // Determine output path
  const intelDir = path.join(roomDir, 'intelligence');
  const outputPath = path.join(intelDir, `briefing-${today}.md`);

  return {
    content,
    outputPath,
    stats: {
      predictions: predictions.length,
      contradictions: contradictions.length,
      staleSections: staleSections.length,
    },
  };
}

/**
 * Generate and write the daily briefing to room/intelligence/.
 *
 * @param {string} roomDir - Absolute path to room directory
 * @returns {{ outputPath: string, stats: object, written: boolean }}
 */
function writeBriefing(roomDir) {
  const { content, outputPath, stats } = generateBriefing(roomDir);

  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, content);
    return { outputPath, stats, written: true };
  } catch (e) {
    return { outputPath, stats, written: false, error: e.message };
  }
}

module.exports = {
  generateBriefing,
  writeBriefing,
  getPredictionDeadlines,
  getRecentContradictions,
  getStaleSections,
  getRoomHealth,
};
