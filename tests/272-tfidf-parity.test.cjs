/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 272 Wave 0 -- pins sklearn TfidfVectorizer parity, RED by design.
 *
 * PYPORT-01. Gates lib/core/numeric/tfidf.cjs (272-05), which does not exist
 * yet. Fixture and expected values regenerated live this session via:
 *
 *   TfidfVectorizer(stop_words='english', max_features=10, max_df=0.5,
 *                    smooth_idf=True).fit_transform(corpus)
 *
 * against the fixed 4-document corpus below (independently confirmed by
 * running python3 this session, not transcribed from memory).
 *
 * SKLEARN_ENGLISH_STOPWORDS_v1 below is the full frozen sklearn
 * ENGLISH_STOP_WORDS list (318 words), regenerated this session via:
 *
 *   python3 -c "from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS; \
 *       print(sorted(ENGLISH_STOP_WORDS))"
 *
 * This constant is later IMPORTED (not redefined) by lib/core/numeric/tfidf.cjs
 * in 272-05, matching lexical-overlap.cjs's frozen-list discipline. It is
 * duplicated (not required from another test file) per this task's own
 * independent-RED-runnable requirement.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TFIDF_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'numeric', 'tfidf.cjs');

let tfidfModule;
try {
  // eslint-disable-next-line global-require
  tfidfModule = require(TFIDF_MODULE_PATH);
} catch (_e) {
  tfidfModule = null;
}

// Frozen sklearn ENGLISH_STOP_WORDS (318 words), regenerated live this
// session against the installed sklearn 1.8.0. Sorted ascending, matching
// python's sorted(ENGLISH_STOP_WORDS) exactly.
const SKLEARN_ENGLISH_STOPWORDS_v1 = [
  'a', 'about', 'above', 'across', 'after', 'afterwards', 'again', 'against',
  'all', 'almost', 'alone', 'along', 'already', 'also', 'although', 'always',
  'am', 'among', 'amongst', 'amoungst', 'amount', 'an', 'and', 'another',
  'any', 'anyhow', 'anyone', 'anything', 'anyway', 'anywhere', 'are', 'around',
  'as', 'at', 'back', 'be', 'became', 'because', 'become', 'becomes',
  'becoming', 'been', 'before', 'beforehand', 'behind', 'being', 'below', 'beside',
  'besides', 'between', 'beyond', 'bill', 'both', 'bottom', 'but', 'by',
  'call', 'can', 'cannot', 'cant', 'co', 'con', 'could', 'couldnt',
  'cry', 'de', 'describe', 'detail', 'do', 'done', 'down', 'due',
  'during', 'each', 'eg', 'eight', 'either', 'eleven', 'else', 'elsewhere',
  'empty', 'enough', 'etc', 'even', 'ever', 'every', 'everyone', 'everything',
  'everywhere', 'except', 'few', 'fifteen', 'fifty', 'fill', 'find', 'fire',
  'first', 'five', 'for', 'former', 'formerly', 'forty', 'found', 'four',
  'from', 'front', 'full', 'further', 'get', 'give', 'go', 'had',
  'has', 'hasnt', 'have', 'he', 'hence', 'her', 'here', 'hereafter',
  'hereby', 'herein', 'hereupon', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'however', 'hundred', 'i', 'ie', 'if', 'in', 'inc',
  'indeed', 'interest', 'into', 'is', 'it', 'its', 'itself', 'keep',
  'last', 'latter', 'latterly', 'least', 'less', 'ltd', 'made', 'many',
  'may', 'me', 'meanwhile', 'might', 'mill', 'mine', 'more', 'moreover',
  'most', 'mostly', 'move', 'much', 'must', 'my', 'myself', 'name',
  'namely', 'neither', 'never', 'nevertheless', 'next', 'nine', 'no', 'nobody',
  'none', 'noone', 'nor', 'not', 'nothing', 'now', 'nowhere', 'of',
  'off', 'often', 'on', 'once', 'one', 'only', 'onto', 'or',
  'other', 'others', 'otherwise', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'part', 'per', 'perhaps', 'please', 'put', 'rather', 're',
  'same', 'see', 'seem', 'seemed', 'seeming', 'seems', 'serious', 'several',
  'she', 'should', 'show', 'side', 'since', 'sincere', 'six', 'sixty',
  'so', 'some', 'somehow', 'someone', 'something', 'sometime', 'sometimes', 'somewhere',
  'still', 'such', 'system', 'take', 'ten', 'than', 'that', 'the',
  'their', 'them', 'themselves', 'then', 'thence', 'there', 'thereafter', 'thereby',
  'therefore', 'therein', 'thereupon', 'these', 'they', 'thick', 'thin', 'third',
  'this', 'those', 'though', 'three', 'through', 'throughout', 'thru', 'thus',
  'to', 'together', 'too', 'top', 'toward', 'towards', 'twelve', 'twenty',
  'two', 'un', 'under', 'until', 'up', 'upon', 'us', 'very',
  'via', 'was', 'we', 'well', 'were', 'what', 'whatever', 'when',
  'whence', 'whenever', 'where', 'whereafter', 'whereas', 'whereby', 'wherein', 'whereupon',
  'wherever', 'whether', 'which', 'while', 'whither', 'who', 'whoever', 'whole',
  'whom', 'whose', 'why', 'will', 'with', 'within', 'without', 'would',
  'yet', 'you', 'your', 'yours', 'yourself', 'yourselves',
];

const CORPUS = [
  'the cat sat on the mat',
  'the dog sat on the log',
  'cats and dogs are great pets',
  'quantum physics is hard',
];

// Ground truth: python3 TfidfVectorizer(stop_words='english', max_features=10,
// max_df=0.5, smooth_idf=True).fit_transform(CORPUS) -- vocabulary is sorted
// alphabetically by sklearn (get_feature_names_out()).
const EXPECTED_VOCAB = ['cat', 'cats', 'dog', 'dogs', 'great', 'hard', 'log', 'mat', 'pets', 'sat'];

// idf_ per vocab term, in vocab order. 'sat' (index 9) is the only term
// appearing in >1 document among the surviving vocabulary, so it has the
// lower idf; every other term is document-unique.
const EXPECTED_IDF = [
  1.916290731874155, 1.916290731874155, 1.916290731874155, 1.916290731874155,
  1.916290731874155, 1.916290731874155, 1.916290731874155, 1.916290731874155,
  1.916290731874155, 1.5108256237659907,
];

// L2-normalized TF-IDF weight matrix, rows in CORPUS order, columns in
// EXPECTED_VOCAB order. Rounded to 6 decimal places.
const EXPECTED_WEIGHTS = [
  [0.617614, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.617614, 0.0, 0.486934],
  [0.0, 0.0, 0.617614, 0.0, 0.0, 0.0, 0.617614, 0.0, 0.0, 0.486934],
  [0.0, 0.5, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 0.5, 0.0],
  [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
];

const TOL = 1e-4;

async function main() {
  assert.ok(
    tfidfModule !== null,
    'lib/core/numeric/tfidf.cjs does not exist yet (expected until plan 272-05 lands) -- ' +
      'this test is RED by design for Phase 272 Wave 0'
  );
  assert.ok(
    Array.isArray(SKLEARN_ENGLISH_STOPWORDS_v1) && SKLEARN_ENGLISH_STOPWORDS_v1.length >= 300,
    'frozen sklearn stopword constant must carry close to the real 318-word list'
  );
  assert.ok(
    typeof tfidfModule.fitTfidf === 'function',
    'lib/core/numeric/tfidf.cjs MUST export a function named fitTfidf(texts, opts)'
  );

  const result = tfidfModule.fitTfidf(CORPUS, {
    stopWords: SKLEARN_ENGLISH_STOPWORDS_v1,
    maxFeatures: 10,
    maxDf: 0.5,
    smoothIdf: true,
  });

  assert.deepEqual(result.vocabulary, EXPECTED_VOCAB, 'vocabulary must match sklearn exactly, in order');

  for (let i = 0; i < EXPECTED_IDF.length; i += 1) {
    assert.ok(
      Math.abs(result.idf[i] - EXPECTED_IDF[i]) < TOL,
      `idf[${i}]: expected ${EXPECTED_IDF[i]}, got ${result.idf[i]}`
    );
  }

  for (let r = 0; r < EXPECTED_WEIGHTS.length; r += 1) {
    for (let c = 0; c < EXPECTED_WEIGHTS[r].length; c += 1) {
      assert.ok(
        Math.abs(result.weights[r][c] - EXPECTED_WEIGHTS[r][c]) < TOL,
        `weights[${r}][${c}]: expected ${EXPECTED_WEIGHTS[r][c]}, got ${result.weights[r][c]}`
      );
    }
  }

  // Token pattern behavior: sklearn's default token_pattern is (?u)\b\w\w+\b
  // (word-boundary, length >= 2), so single-char tokens never enter the
  // vocabulary even before stopword removal. Verified live this session:
  // TfidfVectorizer(stop_words='english').fit(['x y z ab cd zz']) yields
  // vocabulary ['ab', 'cd', 'zz'] -- the single-char tokens x, y, z are
  // excluded by the token pattern, not by the stopword list (none of them
  // are stopwords).
  const singleCharResult = tfidfModule.fitTfidf(['x y z ab cd zz'], {
    stopWords: SKLEARN_ENGLISH_STOPWORDS_v1,
  });
  assert.deepEqual(
    singleCharResult.vocabulary,
    ['ab', 'cd', 'zz'],
    'single-character tokens (x, y, z) must be excluded by the token pattern ' +
      '(word length >= 2), independent of stopword removal'
  );

  console.log('PASS 272-tfidf-parity');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
