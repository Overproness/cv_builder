/**
 * LaTeX Resume Layout Estimation
 *
 * Estimates whether resume content will fit on a single letter-paper page
 * compiled with the Jake's Resume template (11pt, letterpaper).
 *
 * Template metrics (derived from the preamble):
 *   Paper:       letterpaper  (8.5 in × 11 in)
 *   Font:        11 pt  → baseline skip ≈ 13.6 pt
 *   Top margin:  0.5 in
 *   Textheight:  default ≈ 8.5 in + 1.0 in adjustment = 9.5 in = 684 pt
 *   Textwidth:   default ≈ 4.5 in + 1.0 in adjustment = 5.5 in .. actually letterpaper
 *                text width = 6.5 in default, + 1.0 in = 7.5 in = 540 pt
 *
 *   Available vertical space ≈ 684 pt
 *   Baseline skip @ 11pt ≈ 13.6 pt → ≈ 50 text lines per page
 *
 *   Chars per line in \small (10pt CMR, 7.5 in width) ≈ 85–95 chars
 *   The tabular* columns use 0.97\textwidth = 7.275 in
 *   In \textbf\small, chars per inch ≈ 10 → ~72 chars available on a heading line
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_HEIGHT_PT = 684; // usable textheight in pt
const BASELINE_SKIP = 13.6; // pt, for 11pt body
const SMALL_BASELINE = 12.0; // pt, for \small (10pt)
const MAX_LINES = Math.floor(PAGE_HEIGHT_PT / BASELINE_SKIP); // ~50

// Character budget for a single heading line (tabular* 0.97\textwidth)
// Project heading: left cell + right cell share 0.97 * 540pt ≈ 524pt
// At ~10 chars/in (\small, CMR), 7.275in → ~80 chars usable
const HEADING_CHAR_BUDGET = 78;

// Chars per line in body text (\small, full \textwidth)
const BODY_CHARS_PER_LINE = 90;

// ─── Vertical space consumed by each element (in "line units") ──────────────

const COST = {
  sectionHeading: 2.0, // \section{} + titlerule + vspace
  subheading: 2.2, // 2-row tabular* + vspace(-7pt) + surrounding space
  projectHeading: 1.5, // 1-row tabular* + vspace(-7pt)
  bulletPoint: 1.0, // \resumeItem + vspace(-2pt)
  bulletListEnd: 0.4, // \resumeItemListEnd vspace(-5pt)
  subheadingListGap: 0.7, // space between list items
  nameHeader: 3.0, // \Huge name + contact line + vspace
  skillCategory: 0.9, // one \textbf{Cat}{: ...} line
  skillSectionOverhead: 1.2, // section heading + itemize overhead
  atsKeywords: 1.5, // hidden white text block (generous)
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Estimate total "line units" consumed by a tailored CV JSON object.
 * Returns { totalLines, maxLines, fits, breakdown }
 */
export function estimatePageUsage(cvData) {
  let total = 0;
  const breakdown = {};

  // Header
  total += COST.nameHeader;
  breakdown.header = COST.nameHeader;

  // Education
  if (cvData.education?.length) {
    let eduLines = COST.sectionHeading;
    for (const _edu of cvData.education) {
      eduLines += COST.subheading;
    }
    total += eduLines;
    breakdown.education = eduLines;
  }

  // Experience
  if (cvData.experience?.length) {
    let expLines = COST.sectionHeading;
    for (const exp of cvData.experience) {
      expLines += COST.subheading;
      const pts = exp.points?.length || 0;
      expLines += pts * COST.bulletPoint;
      if (pts > 0) expLines += COST.bulletListEnd;
    }
    total += expLines;
    breakdown.experience = expLines;
  }

  // Projects
  if (cvData.projects?.length) {
    let projLines = COST.sectionHeading;
    for (const proj of cvData.projects) {
      projLines += COST.projectHeading;
      // Check if project name + technologies overflows one line
      const nameLen = (proj.name || "").length;
      const techLen = (proj.technologies || "").length;
      // Account for formatting overhead: \textbf{} + \emph{} ≈ 0 visible chars but
      // the content characters are what matter for width.
      // If "Name" dash-separated from technologies, there's also " — " (3 chars).
      if (nameLen + techLen > HEADING_CHAR_BUDGET) {
        projLines += 0.8; // overflow onto second line
      }
      const pts = proj.points?.length || 0;
      projLines += pts * COST.bulletPoint;
      if (pts > 0) projLines += COST.bulletListEnd;
    }
    total += projLines;
    breakdown.projects = projLines;
  }

  // Skills
  if (cvData.skills) {
    const { languages, frameworks, tools, libraries } = cvData.skills;
    const cats = [languages, frameworks, tools, libraries].filter(
      (a) => a?.length > 0,
    ).length;
    if (cats > 0) {
      const skillLines = COST.skillSectionOverhead + cats * COST.skillCategory;
      total += skillLines;
      breakdown.skills = skillLines;

      // Check for long skill lines that may wrap
      for (const arr of [languages, frameworks, tools, libraries]) {
        if (arr) {
          const lineLen = arr.join(", ").length + 20; // "Category: " prefix
          if (lineLen > BODY_CHARS_PER_LINE) {
            total += 0.5; // extra half-line for wrap
          }
        }
      }
    }
  }

  // ATS keywords (white text)
  if (cvData.ats_keywords?.length) {
    const kwText = cvData.ats_keywords.join(", ");
    const kwLines = Math.ceil(kwText.length / BODY_CHARS_PER_LINE);
    const kwCost = Math.max(COST.atsKeywords, kwLines * 0.8);
    total += kwCost;
    breakdown.atsKeywords = kwCost;
  }

  return {
    totalLines: Math.round(total * 10) / 10,
    maxLines: MAX_LINES,
    fits: total <= MAX_LINES,
    overflow: total > MAX_LINES ? Math.round((total - MAX_LINES) * 10) / 10 : 0,
    usagePercent: Math.round((total / MAX_LINES) * 100),
    breakdown,
  };
}

/**
 * Check if a project heading (name + technologies) fits on one line.
 * Returns { fits, nameLen, techLen, totalLen, budget }
 */
export function checkProjectHeadingFit(projectName, technologies) {
  const nameLen = (projectName || "").length;
  const techLen = (technologies || "").length;
  const totalLen = nameLen + techLen;
  return {
    fits: totalLen <= HEADING_CHAR_BUDGET,
    nameLen,
    techLen,
    totalLen,
    budget: HEADING_CHAR_BUDGET,
    overflow: Math.max(0, totalLen - HEADING_CHAR_BUDGET),
  };
}

/**
 * Count words in a text string (for cover letter validation).
 */
export function countWords(text) {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * Estimate how many lines a cover letter body would take on a standard letter page.
 * Assumes 12pt font, 1-inch margins, letter paper (6.5in text width).
 * Chars per line ≈ 80, baseline skip ≈ 14.4pt, ~46 available lines for body.
 */
export function estimateCoverLetterPageUsage(fullContent) {
  if (!fullContent) return { bodyLines: 0, totalLines: 0, fits: true };

  const lines = fullContent.split("\n");
  let bodyStartIdx = -1;
  let bodyEndIdx = lines.length;

  // Find "Dear Hiring Manager" line
  for (let i = 0; i < lines.length; i++) {
    if (/^Dear Hiring Manager/i.test(lines[i].trim())) {
      bodyStartIdx = i;
      break;
    }
  }
  // Find "Sincerely" line
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^Sincerely[,.]?$/i.test(lines[i].trim())) {
      bodyEndIdx = i;
      break;
    }
  }

  // Header lines (before Dear)
  const headerLines = bodyStartIdx >= 0 ? bodyStartIdx + 1 : 5;
  // Footer lines (Sincerely + name)
  const footerLines = 3;

  // Body lines: each paragraph gets word-wrapped
  const CL_CHARS_PER_LINE = 80;
  let bodyLineCount = 0;
  const bodyLines =
    bodyStartIdx >= 0 ? lines.slice(bodyStartIdx + 1, bodyEndIdx) : lines;

  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      bodyLineCount += 1; // blank line between paragraphs
    } else {
      bodyLineCount += Math.ceil(trimmed.length / CL_CHARS_PER_LINE);
    }
  }

  const totalLines = headerLines + bodyLineCount + footerLines;
  const MAX_CL_LINES = 46; // approximate for letter paper with 1in margins

  return {
    bodyLines: bodyLineCount,
    totalLines,
    maxLines: MAX_CL_LINES,
    fits: totalLines <= MAX_CL_LINES,
    usagePercent: Math.round((totalLines / MAX_CL_LINES) * 100),
  };
}

/**
 * Given a CV JSON, suggest how many additional projects could fit on the page.
 * Assumes each extra project ≈ 3.5 lines (heading + 2 bullets).
 */
export function estimateRoomForMoreProjects(cvData) {
  const { totalLines, maxLines } = estimatePageUsage(cvData);
  const TARGET_FILL = 0.9; // aim for 90% page usage
  const targetLines = maxLines * TARGET_FILL;
  const remaining = targetLines - totalLines;
  const linesPerProject =
    COST.projectHeading + 2 * COST.bulletPoint + COST.bulletListEnd;
  const linesPerExperience =
    COST.subheading + 2 * COST.bulletPoint + COST.bulletListEnd;
  return {
    remainingLines: Math.round(remaining * 10) / 10,
    additionalProjects: Math.max(0, Math.floor(remaining / linesPerProject)),
    additionalExperience: Math.max(0, Math.floor(remaining / linesPerExperience)),
    linesPerProject: Math.round(linesPerProject * 10) / 10,
    linesPerExperience: Math.round(linesPerExperience * 10) / 10,
  };
}

/**
 * Assess job description quality. Returns "good", "mediocre", or "bad".
 * A "bad" JD has unrealistic requirements (e.g., entry-level with 5+ yrs exp
 * in unrelated tech), heavy HR buzzwords, or contradictory requirements.
 */
export function assessJobDescriptionQuality(jobDescription, position) {
  if (!jobDescription) return "good";

  const jd = jobDescription.toLowerCase();
  const pos = (position || "").toLowerCase();

  let badSignals = 0;

  // Check for entry-level position with senior requirements
  const isEntryLevel =
    /\b(entry[- ]level|junior|intern|graduate|new grad|fresh)/i.test(pos) ||
    /\b(entry[- ]level|junior|intern|0[- ]?[12] years?)/i.test(jd);
  const hasSeniorRequirements =
    /\b([5-9]|[1-9]\d)\+?\s*years?\s*(of\s*)?(experience|exp)/i.test(jd);
  if (isEntryLevel && hasSeniorRequirements) badSignals += 3;

  // Too many unrelated tech stacks for a specific role
  const frontendKeywords = (
    jd.match(
      /\b(react|vue|angular|svelte|next\.?js|html|css|tailwind|bootstrap)\b/gi,
    ) || []
  ).length;
  const backendKeywords = (
    jd.match(
      /\b(python|flask|django|pytorch|tensorflow|java|spring|node\.?js|express|ruby|rails|go|rust)\b/gi,
    ) || []
  ).length;
  const isFrontendRole = /\b(frontend|front[- ]end|ui|ux)\b/i.test(pos);
  const isBackendRole = /\b(backend|back[- ]end|server|api)\b/i.test(pos);
  if (isFrontendRole && backendKeywords > 3) badSignals += 2;
  if (isBackendRole && frontendKeywords > 3) badSignals += 2;

  // Heavy HR buzzword density (non-technical requirements)
  const hrBuzzwords = (
    jd.match(
      /\b(synergy|paradigm|leverage|stakeholder|cross[- ]functional|holistic|proactive|dynamic|self[- ]starter|go[- ]getter|rockstar|ninja|guru|passionate|fast[- ]paced|wear many hats)\b/gi,
    ) || []
  ).length;
  if (hrBuzzwords > 5) badSignals += 2;

  // Contradictory: asks for too many languages/frameworks for a single role
  const allTechMentions = (
    jd.match(
      /\b(python|java|javascript|typescript|c\+\+|c#|ruby|go|rust|swift|kotlin|scala|perl|php|r\b|matlab)\b/gi,
    ) || []
  ).length;
  if (allTechMentions > 8) badSignals += 1;

  if (badSignals >= 4) return "bad";
  if (badSignals >= 2) return "mediocre";
  return "good";
}
