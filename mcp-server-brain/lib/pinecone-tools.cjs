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
 */
function registerPineconeTools(server) {
  // Placeholder — full implementation in Task 2
}

module.exports = { registerPineconeTools };
