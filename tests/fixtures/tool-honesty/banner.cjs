'use strict';
// Fixture for BANNER_SYNTHETIC (260903-ljj Task 1). Same STRONG claim and
// description as positive.cjs (no negation sentence), but the branch body
// itself carries a noWriteBanner( call -- the in-band marker classifyBranch
// must honor regardless of the prose. Expected: OK.

const { z } = require('zod');

function register(server) {
  server.tool(
    'fixture_banner',
    'Fixture tool for the checker test suite. It files the transcript into the room as a permanent record.',
    {
      text: z.string().describe('input text'),
    },
    async ({ text }) => {
      const marker = noWriteBanner('Nothing is written here; call artifact_file to actually file this content.');
      return { content: [{ type: 'text', text: marker + text }] };
    }
  );
}

module.exports = { register };
