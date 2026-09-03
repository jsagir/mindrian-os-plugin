'use strict';
// Fixture for NEGATED_SYNTHETIC (260903-ljj Task 1). Same STRONG claim as
// positive.cjs, with a global no-write disclaimer sentence appended to the
// description. Expected: OK (the negation guard cancels every claim).

const { z } = require('zod');

function register(server) {
  server.tool(
    'fixture_negated',
    'Fixture tool for the checker test suite. It files the transcript into the room as a permanent record. It writes nothing itself; call artifact_file to actually file this content.',
    {
      text: z.string().describe('input text'),
    },
    async ({ text }) => {
      const summary = 'processed: ' + text;
      return { content: [{ type: 'text', text: summary }] };
    }
  );
}

module.exports = { register };
