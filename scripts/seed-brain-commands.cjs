#!/usr/bin/env node
'use strict';

/**
 * seed-brain-commands.cjs -- Populate Neo4j Brain with Command nodes
 * ===================================================================
 * Reads all commands/*.md files, extracts metadata, generates Cypher
 * CREATE statements for Command nodes + trigger relationships.
 *
 * ADMIN ONLY: Requires brain_write access (plan-gated in Supabase).
 * Users never run this. Only Jonathan seeds the Brain.
 *
 * Usage:
 *   node scripts/seed-brain-commands.cjs --dry-run    # Preview Cypher
 *   node scripts/seed-brain-commands.cjs --execute     # Run against Brain
 *
 * The --execute flag requires MINDRIAN_BRAIN_KEY with brain_write plan.
 */

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(PLUGIN_ROOT, 'commands');

// ── JTBD mappings: command -> when/want/so ──

const JTBD_MAP = {
  'find-analogies': {
    when: 'stuck on a problem that feels unique to your domain',
    want: 'discover that other industries already solved the same structural conflict',
    so: 'adapt their approach instead of inventing from scratch',
    time: '5 minutes',
    category: 'intelligence',
    flags: ['--brain', '--external'],
    min_sections: 2,
    triggers: [
      { signal: 'TENSION', priority: 1, condition: 'contradicts_count >= 1' },
      { signal: 'BOTTLENECK', priority: 2, condition: 'reverse_salient_count >= 1' },
    ],
    follows: ['Jobs-to-Be-Done', 'Competitive Analysis', 'Blue Ocean Strategy'],
    stages: { Discovery: 'high', Design: 'high', Validation: 'medium' },
  },
  'act': {
    when: 'you need structured analysis but want Larry to pick the right framework',
    want: 'get a methodology session matched to your problem type',
    so: 'make progress without choosing the wrong tool',
    time: '15-45 minutes',
    category: 'methodology',
    flags: ['--swarm', '--chain', '--dry-run'],
    min_sections: 1,
    triggers: [
      { signal: 'BLIND_SPOT', priority: 1, condition: 'gap_count >= 1' },
    ],
    follows: [],
    stages: { 'Pre-Opportunity': 'high', Discovery: 'high', Design: 'high', Validation: 'medium', Investment: 'medium' },
  },
  'act --swarm': {
    when: 'three or more Sections have Blind Spots and you only have 30 minutes',
    want: 'fill all gaps at once instead of working through them one at a time',
    so: 'move to validation with a complete Room',
    time: '5 minutes',
    category: 'intelligence',
    flags: [],
    min_sections: 3,
    triggers: [
      { signal: 'BLIND_SPOT', priority: 1, condition: 'gap_count >= 3' },
    ],
    follows: ['Assessment', 'Status Review'],
    stages: { Discovery: 'high', Design: 'high', Validation: 'high' },
  },
  'grade': {
    when: 'you have content in your Room but do not know how strong it is',
    want: 'an honest assessment of where investors will push back',
    so: 'fix weak spots before they become deal-breakers',
    time: '3 minutes',
    category: 'methodology',
    flags: ['--full'],
    min_sections: 3,
    triggers: [],
    follows: ['Jobs-to-Be-Done', 'Lean Canvas', 'Structure Argument'],
    stages: { Validation: 'high', Design: 'high', Investment: 'critical' },
  },
  'grade --full': {
    when: 'you have 3+ Sections populated and need a comprehensive assessment',
    want: 'every Section stress-tested in parallel',
    so: 'know exactly where you rank and what to fix before pitching',
    time: '2 minutes',
    category: 'intelligence',
    flags: [],
    min_sections: 3,
    triggers: [],
    follows: ['Assessment'],
    stages: { Validation: 'high', Investment: 'critical' },
  },
  'persona --parallel': {
    when: 'you have been thinking from one angle for too many sessions',
    want: 'see your venture through 6 different expert eyes simultaneously',
    so: 'catch what a skeptic, creative, or data analyst would see',
    time: '2 minutes',
    category: 'intelligence',
    flags: [],
    min_sections: 2,
    triggers: [],
    follows: ['Six Thinking Hats', 'Challenge Assumptions'],
    stages: { Discovery: 'high', Design: 'high', Validation: 'medium' },
  },
  'research --broad': {
    when: 'you need market intelligence but from multiple angles at once',
    want: 'academic, market data, and competitor intelligence gathered simultaneously',
    so: 'make decisions based on comprehensive evidence, not one data source',
    time: '5 minutes',
    category: 'intelligence',
    flags: [],
    min_sections: 1,
    triggers: [
      { signal: 'BLIND_SPOT', priority: 2, condition: 'market_analysis_empty' },
    ],
    follows: ['Explore Trends', 'Analyze Needs'],
    stages: { 'Pre-Opportunity': 'high', Discovery: 'high' },
  },
  'scout': {
    when: 'your Room has not been health-checked and deadlines are approaching',
    want: 'make sure nothing fell through the cracks',
    so: 'focus on what matters without worrying about what you missed',
    time: '30 seconds',
    category: 'intelligence',
    flags: [],
    min_sections: 1,
    triggers: [
      { signal: 'BLIND_SPOT', priority: 3, condition: 'days_since_last_scout >= 7' },
    ],
    follows: [],
    stages: { Validation: 'high', Design: 'medium', Investment: 'high' },
  },
  'snapshot': {
    when: 'you want to share your Room intelligence with someone who does not have MindrianOS',
    want: 'a standalone interactive HTML hub they can open in any browser',
    so: 'communicate the depth of your thinking without requiring tool access',
    time: '1 minute',
    category: 'export',
    flags: ['--offline', '--open'],
    min_sections: 3,
    triggers: [],
    follows: ['Assessment', 'Status Review'],
    stages: { Design: 'medium', Investment: 'high' },
  },
  'models': {
    when: 'you are burning through tokens on routine agent work',
    want: 'control cost without sacrificing teaching quality',
    so: 'keep Opus for what matters and use Haiku for scanning',
    time: '10 seconds',
    category: 'infrastructure',
    flags: [],
    min_sections: 0,
    triggers: [],
    follows: [],
    stages: { 'Pre-Opportunity': 'medium', Discovery: 'medium', Design: 'medium', Validation: 'medium', Investment: 'medium' },
  },
  'analyze-needs': {
    when: 'you do not know what job your customer hires your product to do',
    want: 'discover the struggling moment that triggers switching behavior',
    so: 'build something people actually hire instead of something they ignore',
    time: '15-30 minutes',
    category: 'methodology',
    flags: [],
    min_sections: 1,
    triggers: [
      { signal: 'BLIND_SPOT', priority: 2, condition: 'market_analysis_thin' },
    ],
    follows: [],
    stages: { 'Pre-Opportunity': 'high', Discovery: 'critical' },
  },
  'challenge-assumptions': {
    when: 'your Room has claims that nobody has stress-tested',
    want: 'find out which assumptions are load-bearing and which are wishful thinking',
    so: 'de-risk before you invest time building on a false foundation',
    time: '10-20 minutes',
    category: 'methodology',
    flags: [],
    min_sections: 2,
    triggers: [
      { signal: 'PATTERN', priority: 2, condition: 'converge_count >= 3' },
    ],
    follows: ['Jobs-to-Be-Done', 'Explore Trends', 'Build Thesis'],
    stages: { Discovery: 'high', Validation: 'critical' },
  },
  'validate': {
    when: 'you have a thesis but no proof it holds up under scrutiny',
    want: 'stress-test your core claims against real evidence',
    so: 'know what is validated versus what is hoped',
    time: '15 minutes',
    category: 'methodology',
    flags: [],
    min_sections: 2,
    triggers: [],
    follows: ['Challenge Assumptions', 'Design-by-Analogy', 'Build Thesis'],
    stages: { Validation: 'critical', Investment: 'high' },
  },
  'file-meeting': {
    when: 'you just had a meeting and the insights are about to evaporate',
    want: 'capture who said what, file it to the right Sections, track action items',
    so: 'the conversation becomes permanent Room intelligence instead of forgotten notes',
    time: '3 minutes',
    category: 'meeting',
    flags: ['--file', '--audio', '--latest'],
    min_sections: 0,
    triggers: [],
    follows: [],
    stages: { 'Pre-Opportunity': 'high', Discovery: 'high', Design: 'high', Validation: 'high', Investment: 'high' },
  },
  'opportunities': {
    when: 'you are building something fundable but have not explored non-dilutive money',
    want: 'discover grants matched to your domain, stage, and geography',
    so: 'fund development without giving up equity',
    time: '2 minutes',
    category: 'funding',
    flags: [],
    min_sections: 2,
    triggers: [
      { signal: 'BLIND_SPOT', priority: 3, condition: 'opportunity_bank_empty' },
    ],
    follows: ['Lean Canvas', 'Build Thesis'],
    stages: { Discovery: 'medium', Validation: 'high', Design: 'high', Investment: 'high' },
  },
};

// ── Generate Cypher ──

function generateCypher() {
  const statements = [];

  // Create Command nodes
  for (const [slug, cmd] of Object.entries(JTBD_MAP)) {
    const name = `/mos:${slug}`;
    const escapedName = name.replace(/'/g, "\\'");

    statements.push(`
// Command: ${name}
MERGE (cmd:Command {name: '${escapedName}'})
SET cmd.slug = '${slug}',
    cmd.category = '${cmd.category}',
    cmd.jtbd_when = '${cmd.when.replace(/'/g, "\\'")}',
    cmd.jtbd_want = '${cmd.want.replace(/'/g, "\\'")}',
    cmd.jtbd_so = '${cmd.so.replace(/'/g, "\\'")}',
    cmd.time_estimate = '${cmd.time}',
    cmd.min_sections = ${cmd.min_sections},
    cmd.powerhouse = true;`);

    // TRIGGERED_BY_SIGNAL relationships
    for (const trigger of cmd.triggers) {
      statements.push(`
MERGE (sig:SignalType {name: '${trigger.signal}'})
WITH sig
MATCH (cmd:Command {name: '${escapedName}'})
MERGE (cmd)-[:TRIGGERED_BY_SIGNAL {
  signal_type: '${trigger.signal}',
  priority: ${trigger.priority},
  condition: '${trigger.condition}'
}]->(sig);`);
    }

    // FOLLOWS_FRAMEWORK relationships
    for (const fw of cmd.follows) {
      statements.push(`
MATCH (f:Framework {name: '${fw.replace(/'/g, "\\'")}'}), (cmd:Command {name: '${escapedName}'})
MERGE (cmd)-[:FOLLOWS_FRAMEWORK {confidence: 0.80}]->(f);`);
    }

    // RELEVANT_AT_STAGE relationships
    for (const [stage, impact] of Object.entries(cmd.stages)) {
      statements.push(`
MERGE (s:VentureStage {name: '${stage}'})
WITH s
MATCH (cmd:Command {name: '${escapedName}'})
MERGE (cmd)-[:RELEVANT_AT_STAGE {impact: '${impact}'}]->(s);`);
    }
  }

  return statements;
}

// ── Main ──

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const execute = args.includes('--execute');

  if (!dryRun && !execute) {
    console.log('Usage:');
    console.log('  node scripts/seed-brain-commands.cjs --dry-run    # Preview Cypher');
    console.log('  node scripts/seed-brain-commands.cjs --execute     # Run against Brain');
    process.exit(0);
  }

  const statements = generateCypher();

  console.log(`Generated ${statements.length} Cypher statements for ${Object.keys(JTBD_MAP).length} commands`);

  if (dryRun) {
    console.log('\n--- DRY RUN: Cypher Preview ---\n');
    console.log(statements.join('\n'));
    console.log('\n--- End Preview ---');
    console.log(`\nRun with --execute to send to Brain.`);
  }

  if (execute) {
    console.log('\nExecute mode requires running each statement via:');
    console.log('  mcp__neo4j-brain__write_neo4j_cypher');
    console.log('\nPaste each statement into the MCP tool call.');
    console.log('Or run this in a Claude Code session with Brain MCP connected.\n');

    // Write all statements to a file for easy copy-paste
    const outPath = path.join(PLUGIN_ROOT, '.planning', 'brain-seed-commands.cypher');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, statements.join('\n'), 'utf8');
    console.log(`Cypher written to: ${outPath}`);
    console.log(`Statements: ${statements.length}`);
    console.log(`Commands: ${Object.keys(JTBD_MAP).length}`);
  }
}

main();
