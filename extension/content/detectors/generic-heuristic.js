// Fallback detector for job boards without a dedicated entry in
// site-detectors.js. Scores candidate DOM text blocks by keyword density and
// length, and fails closed (returns null, no button shown) below a
// confidence threshold rather than guessing on an unrelated page.

const JD_KEYWORDS = [
  "responsibilities",
  "requirements",
  "qualifications",
  "we are looking for",
  "you will",
  "what you'll do",
  "about the role",
  "job description",
  "preferred qualifications",
  "minimum qualifications",
];

const MIN_LENGTH = 200;
const MAX_LENGTH = 20000;
const MIN_KEYWORD_HITS = 2;

function scoreBlock(text) {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const keyword of JD_KEYWORDS) {
    if (lower.includes(keyword)) hits += 1;
  }
  return hits;
}

self.CVBuilderGenericHeuristic = {
  detect() {
    const candidates = document.querySelectorAll("article, main, div, section");
    let best = null;
    let bestScore = 0;

    for (const node of candidates) {
      const text = (node.innerText || "").trim();
      if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) continue;

      const score = scoreBlock(text);
      if (score < MIN_KEYWORD_HITS) continue;

      // Prefer the smallest qualifying container with the highest score —
      // avoids matching a huge ancestor (e.g. <body>-ish wrappers) that
      // happens to contain the real JD somewhere inside it.
      if (
        score > bestScore ||
        (score === bestScore && (!best || text.length < best.length))
      ) {
        best = text;
        bestScore = score;
      }
    }

    if (!best) return null;

    return {
      jobDescription: best.slice(0, MAX_LENGTH),
      position: "",
      company: "",
    };
  },
};
