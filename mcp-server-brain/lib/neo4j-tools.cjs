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
 */
function registerNeo4jTools(server) {
  // Placeholder — full implementation in Task 2
}

module.exports = { registerNeo4jTools };
