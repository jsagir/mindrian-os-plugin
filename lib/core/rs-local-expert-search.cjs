'use strict';

// Search only the Paper/Author/Institution records already stored in one
// MindrianOS room. This is a literal local-corpus lookup, not a directory
// search, expertise assessment, or external retrieval service.

const MAX_PAPERS_SCANNED = 2000;
const STOP_WORDS = new Set(['about', 'after', 'against', 'along', 'among', 'and', 'are', 'for', 'from', 'into', 'near', 'over', 'the', 'this', 'that', 'through', 'using', 'with']);

function parseProperties(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function topicTerms(topic) {
  const matches = String(topic || '').toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [];
  return [...new Set(matches.filter((term) => !STOP_WORDS.has(term)))];
}

function searchLocalExperts(db, topic, limit) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('a read-only room database handle is required');
  const terms = topicTerms(topic);
  if (!terms.length) return { ok: false, reason: 'topic_too_broad', message: 'Provide at least one specific topic term.' };

  const totalPaperRow = db.prepare("SELECT COUNT(*) AS count FROM nodes WHERE type = 'Paper'").get();
  const totalPapers = Number(totalPaperRow && totalPaperRow.count) || 0;
  const scanLimit = Math.min(totalPapers, MAX_PAPERS_SCANNED);
  const rows = db.prepare(
    "WITH selected_papers AS (SELECT id, properties FROM nodes WHERE type = 'Paper' ORDER BY id LIMIT ?) " +
    "SELECT p.id AS paper_id, p.properties AS paper_properties, " +
    "pa.target AS author_ref, " +
    "a.id AS author_id, a.properties AS author_properties, " +
    "ai.target AS institution_ref, " +
    "i.id AS institution_id, i.properties AS institution_properties " +
    "FROM selected_papers p " +
    "LEFT JOIN edges pa ON pa.source = p.id AND pa.type = 'AUTHORED_BY' " +
    "LEFT JOIN nodes a ON a.id = pa.target AND a.type = 'Author' " +
    "LEFT JOIN edges ai ON ai.source = a.id AND ai.type = 'AFFILIATED_WITH' " +
    "LEFT JOIN nodes i ON i.id = ai.target AND i.type = 'Institution' " +
    "ORDER BY p.id, a.id, i.id"
  ).all(scanLimit);

  const matchedPapers = new Map();
  const authorMap = new Map();
  const malformedPaperIds = new Set();
  const malformedAuthorRefs = new Set();
  const malformedInstitutionRefs = new Set();
  for (const row of rows) {
    let paper = matchedPapers.get(row.paper_id);
    if (!paper) {
      const props = parseProperties(row.paper_properties);
      if (!props) {
        malformedPaperIds.add(row.paper_id);
        continue;
      }
      const title = typeof props.title === 'string' ? props.title : '';
      const abstract = typeof props.abstract === 'string' ? props.abstract : '';
      const searchable = (title + ' ' + abstract).toLocaleLowerCase();
      const matchedTerms = terms.filter((term) => searchable.includes(term));
      if (!matchedTerms.length) continue;
      paper = {
        id: row.paper_id,
        title: title || null,
        source: typeof props.source === 'string' ? props.source : null,
        matched_terms: matchedTerms,
        author_ids: new Set(),
      };
      matchedPapers.set(row.paper_id, paper);
    }
    if (!row.author_ref) continue;
    if (!row.author_id) {
      malformedAuthorRefs.add(row.author_ref);
      continue;
    }
    const authorProps = parseProperties(row.author_properties);
    if (!authorProps || typeof authorProps.name !== 'string' || !authorProps.name.trim()) {
      malformedAuthorRefs.add(row.author_id);
      continue;
    }
    paper.author_ids.add(row.author_id);
    let author = authorMap.get(row.author_id);
    if (!author) {
      author = { id: row.author_id, name: authorProps.name, paper_ids: new Set(), institutions: new Set() };
      authorMap.set(row.author_id, author);
    }
    author.paper_ids.add(row.paper_id);
    if (row.institution_ref && !row.institution_id) malformedInstitutionRefs.add(row.institution_ref);
    if (row.institution_id) {
      const institution = parseProperties(row.institution_properties);
      if (institution && typeof institution.name === 'string' && institution.name.trim()) {
        author.institutions.add(institution.name);
      } else malformedInstitutionRefs.add(row.institution_id);
    }
  }

  const sortedPapers = [...matchedPapers.values()].sort((a, b) => a.id.localeCompare(b.id));
  const authors = [...authorMap.values()].map((author) => ({
    author_id: author.id,
    name: author.name,
    institutions: [...author.institutions].sort(),
    matched_paper_count: author.paper_ids.size,
    papers: [...author.paper_ids].map((id) => matchedPapers.get(id)).filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, title, source, matched_terms }) => ({ id, title, source, matched_terms })),
  })).sort((a, b) => b.matched_paper_count - a.matched_paper_count || a.name.localeCompare(b.name) || a.author_id.localeCompare(b.author_id));

  const resultLimit = Math.max(1, Math.min(100, Number.isInteger(limit) ? limit : 25));
  const malformedPaperCount = malformedPaperIds.size;
  const malformedAuthorCount = malformedAuthorRefs.size;
  const malformedInstitutionCount = malformedInstitutionRefs.size;
  const partial = totalPapers > scanLimit || malformedPaperCount > 0 || malformedAuthorCount > 0 || malformedInstitutionCount > 0;
  const omissions = [];
  if (totalPapers > scanLimit) omissions.push({ reason: 'paper_scan_cap', omitted_paper_count: totalPapers - scanLimit });
  if (malformedPaperCount) omissions.push({ reason: 'invalid_paper_properties', omitted_paper_count: malformedPaperCount });
  if (malformedAuthorCount) omissions.push({ reason: 'missing_or_invalid_author_records', omitted_author_count: malformedAuthorCount });
  if (malformedInstitutionCount) omissions.push({ reason: 'missing_or_invalid_institution_records', omitted_institution_count: malformedInstitutionCount });
  if (authors.length > resultLimit) omissions.push({ reason: 'author_result_limit', omitted_author_count: authors.length - resultLimit });

  return {
    ok: true,
    match_count: authors.length,
    authors: authors.slice(0, resultLimit),
    matched_paper_count: sortedPapers.length,
    search: {
      terms,
      fields: ['Paper.title', 'Paper.abstract when present'],
      papers_scanned: scanLimit,
      papers_in_room: totalPapers,
    },
    partial: partial || authors.length > resultLimit,
    omissions,
    limitations: [
      'Matches stored room papers by literal topic terms; does not search an external expert directory.',
      'Matched publications do not establish current expertise, availability, or willingness to engage.',
    ],
    persistence: 'none',
  };
}

module.exports = { searchLocalExperts, topicTerms, MAX_PAPERS_SCANNED };
