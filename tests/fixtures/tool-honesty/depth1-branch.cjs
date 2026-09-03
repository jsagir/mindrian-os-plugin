'use strict';
// Fixture for DEPTH1_NO_FALSE_POSITIVE (260903-ljj Task 1). The branch's own
// text contains no write primitive directly; it calls ops.persist(), a
// sibling module required by a repo-local relative path. Expected: OK, via
// one-hop resolution into depth1-ops.cjs's persist() body.

const { z } = require('zod');
const ops = require('./depth1-ops.cjs');

function register(server) {
  server.tool(
    'fixture_depth1',
    'Fixture tool for the checker test suite. It will persist the given payload into the room as a stored record.',
    {
      payload: z.string().describe('payload to persist'),
    },
    async ({ payload }) => {
      const result = ops.persist(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}

module.exports = { register };
