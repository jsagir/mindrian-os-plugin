'use strict';
// Fixture for POSITIVE_SYNTHETIC (260903-ljj Task 1). A single-purpose tool
// whose description makes a STRONG persistence claim ("files ... into the
// room") over a handler body that contains no write primitive anywhere,
// directly or through a resolvable one-hop call. Expected: HIGH RISK.

const { z } = require('zod');

function register(server) {
  server.tool(
    'fixture_positive',
    'Fixture tool for the checker test suite. It files the transcript into the room as a permanent record.',
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
