'use strict';
/**
 * wiki-chat.cjs — Chat interface for wiki pages (stub)
 *
 * Provides the API contract for page-scoped chat with Larry.
 * Current implementation is a stub — returns helpful placeholder.
 * Future: connect via MCP transport or Claude API.
 */

/**
 * Build context string from page data for chat scoping.
 * @param {object} pageData - Page object { title, content, frontmatter, section }
 * @param {Array} graphLinks - Outgoing graph links for this page
 * @param {Array} backlinks - Incoming backlinks for this page
 * @returns {string} Context string for Larry
 */
function buildPageContext(pageData, graphLinks, backlinks) {
  const parts = [];

  // Section header
  parts.push(`== Page: ${pageData.title} (${pageData.section}) ==`);

  // Frontmatter summary
  if (pageData.frontmatter && Object.keys(pageData.frontmatter).length > 0) {
    const fm = Object.entries(pageData.frontmatter)
      .filter(([k]) => k !== 'title')
      .map(([k, v]) => `  ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n');
    if (fm) {
      parts.push(`\nProperties:\n${fm}`);
    }
  }

  // Content (first 2000 chars)
  const content = (pageData.content || '')
    .replace(/^---[\s\S]*?---/, '')
    .trim();
  const trimmed = content.slice(0, 2000);
  if (trimmed) {
    parts.push(`\nContent:\n${trimmed}${content.length > 2000 ? '\n[...truncated]' : ''}`);
  }

  // Connected pages
  if (graphLinks && graphLinks.length > 0) {
    const linkList = graphLinks.map(l =>
      `  - ${l.type}: ${l.targetTitle || l.targetId}`
    ).join('\n');
    parts.push(`\nConnected pages:\n${linkList}`);
  }

  // Backlinks
  if (backlinks && backlinks.length > 0) {
    const blList = backlinks.map(bl =>
      `  - ${bl.type} from: ${bl.sourceTitle || bl.sourceId}`
    ).join('\n');
    parts.push(`\nReferenced by:\n${blList}`);
  }

  return parts.join('\n');
}

/**
 * Handle a chat message scoped to a wiki page.
 * STUB: Returns placeholder response with context readiness info.
 *
 * @param {string} roomDir - Path to room directory
 * @param {string} pageId - Current page ID (e.g., "problem-definition/market-trends")
 * @param {string} userMessage - User's chat message
 * @param {string} pageContext - Pre-built context from buildPageContext()
 * @returns {Promise<{reply: string, sources: Array}>}
 */
async function handleChatMessage(roomDir, pageId, userMessage, pageContext) {
  const contextLength = pageContext ? pageContext.length : 0;

  return {
    reply: `Chat with Larry is not yet connected. Page context for '${pageId}' is ready (${contextLength} chars). Connect Larry via MCP or CLI to enable wiki chat.`,
    sources: []
  };
}

module.exports = { buildPageContext, handleChatMessage };
