'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');
const { z } = require('zod');

let client = null;

function getClient() {
  if (!client) {
    client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return client;
}

/**
 * Register Pinecone Brain tools on an McpServer instance.
 * Tools: brain_search, brain_stats
 *
 * brain_search tries searchRecords (integrated inference) first.
 * If the index uses external embeddings, it returns a clear error
 * explaining that external embedding is needed.
 */
function registerPineconeTools(server) {
  const indexName = process.env.PINECONE_INDEX || 'pws-brain';

  // 1. brain_search — semantic search across Brain embeddings
  server.tool(
    'brain_search',
    'Semantic search across Brain knowledge (12K+ PWS vectors). Namespaces: core (course material), reference (books/papers), tools (JTBD/grading/Bono), materials (graph exports), graphrag (relationship summaries). Omit namespace to search all.',
    {
      query: z.string().describe('Natural language search query'),
      namespace: z.string().optional().describe('Namespace to search: core, reference, tools, materials, graphrag (omit for all)'),
      topK: z.number().optional().describe('Number of results (default 5)'),
      filter: z.record(z.any()).optional().describe('Metadata filter'),
    },
    async ({ query, namespace, topK, filter }) => {
      try {
        const index = namespace
          ? getClient().index(indexName).namespace(namespace)
          : getClient().index(indexName);
        const searchParams = {
          query: { topK: topK || 5, inputs: { text: query } },
        };
        if (filter) {
          searchParams.query.filter = filter;
        }
        const results = await index.searchRecords(searchParams);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        // Detect integrated inference error and provide clear guidance
        const msg = err.message || '';
        if (msg.includes('integrated') || msg.includes('inference') || msg.includes('searchRecords')) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Index does not support integrated inference. ' +
                    'The brain_search tool requires an index with integrated embedding. ' +
                    'To search with external embeddings, use brain_query with a vector. ' +
                    'Original error: ' + msg
            }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: 'Error: ' + msg }], isError: true };
      }
    }
  );

  // 2. brain_stats — index statistics
  server.tool(
    'brain_stats',
    'Get Brain index statistics (record count, dimensions, namespaces)',
    {},
    async () => {
      try {
        const index = getClient().index(indexName);
        const stats = await index.describeIndexStats();
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );
}

module.exports = { registerPineconeTools };
