'use strict';

const neo4j = require('neo4j-driver');
const { z } = require('zod');

let driver = null;

function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD)
    );
  }
  return driver;
}

/**
 * Register Neo4j Brain tools on an McpServer instance.
 * Tools: brain_schema, brain_query, brain_write
 *
 * Uses db.labels() + db.relationshipTypes() + db.propertyKeys() instead of
 * apoc.meta.schema() which may not be available on Aura free tier.
 */
function registerNeo4jTools(server, options = {}) {
  const { plan } = options;
  // 1. brain_schema — returns labels, relationship types, property keys
  server.tool(
    'brain_schema',
    'Get the Brain knowledge graph schema (node labels, relationship types, property keys)',
    {},
    async () => {
      const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });
      try {
        const labelsResult = await session.run('CALL db.labels()');
        const relTypesResult = await session.run('CALL db.relationshipTypes()');
        const propKeysResult = await session.run('CALL db.propertyKeys()');

        const schema = {
          labels: labelsResult.records.map(r => r.get('label')),
          relationshipTypes: relTypesResult.records.map(r => r.get('relationshipType')),
          propertyKeys: propKeysResult.records.map(r => r.get('propertyKey')),
        };

        return { content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      } finally {
        await session.close();
      }
    }
  );

  // 2. brain_query — read-only Cypher
  server.tool(
    'brain_query',
    'Run a read-only Cypher query on the Brain knowledge graph',
    {
      cypher: z.string().describe('Read-only Cypher query'),
      params: z.record(z.any()).optional().describe('Query parameters'),
    },
    async ({ cypher, params }) => {
      const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });
      try {
        const result = await session.run(cypher, params || {});
        const records = result.records.map(r => r.toObject());
        return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      } finally {
        await session.close();
      }
    }
  );

  // 3. brain_write — write Cypher
  server.tool(
    'brain_write',
    'Write data to the Brain knowledge graph (creates/updates nodes and relationships)',
    {
      cypher: z.string().describe('Write Cypher query'),
      params: z.record(z.any()).optional().describe('Query parameters'),
    },
    async ({ cypher, params }) => {
      if (plan !== 'admin') {
        return {
          content: [{ type: 'text', text: 'Write access requires admin key. Contact Jonathan for elevated access.' }],
          isError: true,
        };
      }
      const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
      try {
        const result = await session.run(cypher, params || {});
        const counters = result.summary.counters.updates();
        return { content: [{ type: 'text', text: 'Written. Stats: ' + JSON.stringify(counters) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      } finally {
        await session.close();
      }
    }
  );
}

module.exports = { registerNeo4jTools };
