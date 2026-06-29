import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  assessJobDescriptionQuality,
  countWords,
  estimateBulletLineCount,
  estimatePageUsage,
} from "./layoutEstimation.js";

const PRIMARY_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_MODELS = ["gemini-2.5-flash-lite"];
const ALL_MODELS = [PRIMARY_MODEL, ...FALLBACK_MODELS];

// Pricing per 1M tokens (Gemini 2.0 Flash)
const PRICING = {
  inputPerMillion: 0.1,
  outputPerMillion: 0.4,
};

// Max validation retry attempts
const MAX_RETRIES = 2;
const MAX_ENTRY_BULLETS = 3;
const MIN_ENTRY_BULLETS = 2;
const FEATURED_ENTRY_BULLET_COUNT = 3;
const FEATURED_ENTRY_MULTILINE_BULLETS = 2;
const TARGET_PAGE_USAGE_MIN = 95;
const TARGET_PAGE_USAGE_MAX = 99;
const MAX_ENTRY_MULTILINE_BULLETS = 2;
const RESUME_LINE_CHAR_LIMIT = 110;
const SINGLE_LINE_BULLET_CHAR_LIMIT = 100;
const TARGET_EXPERIENCE_ENTRIES = 3;
const TARGET_PROJECT_ENTRIES = 3;
const MIN_PRIMARY_BULLET_WORDS = 16;
const MIN_SUPPORTING_BULLET_WORDS = 10;
const MAX_BULLET_WORDS = 38;
const MAX_REPEATED_OPENING_VERB = 2;
const STRONG_OPENING_VERBS = new Set([
  "achieved",
  "architected",
  "automated",
  "built",
  "collaborated",
  "conducted",
  "created",
  "delivered",
  "deployed",
  "designed",
  "developed",
  "engineered",
  "enhanced",
  "implemented",
  "improved",
  "integrated",
  "led",
  "leveraged",
  "managed",
  "optimized",
  "orchestrated",
  "scaled",
  "spearheaded",
]);
const WEAK_OPENING_VERBS = new Set([
  "worked",
  "helped",
  "was",
  "did",
  "made",
  "used",
  "assisted",
  "participated",
  "responsible",
  "tasked",
]);
const TECHNICAL_SIGNAL_PATTERN =
  /\b(ai|api|apis|auth|aws|azure|backend|c\+\+|crm|css|dashboard|database|django|docker|erp|express|fastapi|firebase|flask|frontend|gcp|github|graphql|html|javascript|jwt|kubernetes|llm|mern|ml|mongodb|mysql|next\.?js|nginx|nlp|node\.?js|postgres|python|pytorch|rbac|react|redis|rest|rust|selenium|session|solana|sql|tailwind|tensorflow|three\.?js|typescript|ui|vps|web3)\b/i;
const IMPLEMENTATION_SIGNAL_PATTERN =
  /\b(analytics|architecture|authentication|automation|backend|billing|classification|crawler|dashboard|database|deployment|engine|frontend|invoicing|integration|interface|modules|optimization|order execution|parsing|pipeline|platform|portal|profiling|ranking|scoring|scraping|service|system|visualization|workflow)\b/i;
const PURPOSE_OUTCOME_SIGNAL_PATTERN =
  /\b(achiev(?:e|ed|ing)|business|client|clients|efficien(?:cy|t)|enabl(?:e|ed|ing)|enterprise|for|grading|manual|operational|paper-based|performance|production|real-time|reduc(?:e|ed|ing)|replac(?:e|ed|ing)|reporting|scal(?:able|e|ed|ing)|secur(?:e|ed|ing)|support(?:ed|ing)?|to|user|users|utilized)\b/i;
const METRIC_SIGNAL_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:%|percent|x|k|m|ms|sec|seconds?|minutes?|hours?|users?|clients?|representatives?|participants?|projects?|workflows?|events?|orders?|transactions?|queries?)?\b/i;

const TAILORED_RESUME_GENERATION_CONFIG = {
  temperature: 0,
  topP: 1,
  topK: 1,
  candidateCount: 1,
  responseMimeType: "application/json",
};

function isServiceUnavailable(error) {
  return (
    error?.status === 503 ||
    (error?.message || "").includes("503") ||
    (error?.message || "").includes("Service Unavailable") ||
    (error?.message || "").includes("high demand")
  );
}

function enforceEntryBulletLimit(cvData) {
  const capEntries = (entries = []) =>
    entries.map((entry) => ({
      ...entry,
      points: Array.isArray(entry.points)
        ? entry.points.slice(0, MAX_ENTRY_BULLETS)
        : [],
    }));

  return {
    ...cvData,
    experience: capEntries(cvData.experience),
    projects: capEntries(cvData.projects),
  };
}

function getEntryBulletMinimumIssues(cvData) {
  const issues = [];
  const sections = [
    ["experience", cvData.experience || []],
    ["project", cvData.projects || []],
  ];

  for (const [sectionName, entries] of sections) {
    for (const entry of entries) {
      const points = Array.isArray(entry.points) ? entry.points : [];
      if (points.length < MIN_ENTRY_BULLETS) {
        const label = entry.role || entry.name || entry.company || "entry";
        issues.push(
          `${sectionName} "${label}" has only ${points.length} bullet point${points.length === 1 ? "" : "s"}. ` +
            `Every selected ${sectionName} entry must have at least ${MIN_ENTRY_BULLETS} grounded bullet points; split or add source-backed facts from the matching Master CV entry without inventing details.`,
        );
      }
    }
  }

  return issues;
}
function getEntryBulletLimitIssues(cvData) {
  const issues = [];
  const sections = [
    ["experience", cvData.experience || []],
    ["project", cvData.projects || []],
  ];

  for (const [sectionName, entries] of sections) {
    for (const entry of entries) {
      const points = Array.isArray(entry.points) ? entry.points : [];
      if (points.length > MAX_ENTRY_BULLETS) {
        const label = entry.role || entry.name || entry.company || "entry";
        issues.push(
          `${sectionName} "${label}" has ${points.length} bullet points. ` +
            `Select the strongest ${MAX_ENTRY_BULLETS} bullets for this job description; ` +
            `they may be copied from the Master CV or rewritten, but do not output more than ${MAX_ENTRY_BULLETS}.`,
        );
      }
    }
  }

  return issues;
}

function getResumeBulletLineCount(point) {
  const text = String(point || "").trim();
  if (!text) return 1;
  return Math.max(
    estimateBulletLineCount(text),
    Math.ceil(text.length / SINGLE_LINE_BULLET_CHAR_LIMIT),
  );
}
function getMultilineBulletInfo(points = []) {
  return points
    .map((point, index) => ({
      index,
      lines: getResumeBulletLineCount(point),
    }))
    .filter(({ lines }) => lines > 1);
}
function getEntryMultilineBulletIssues(cvData) {
  const issues = [];
  const sections = [
    ["experience", cvData.experience || []],
    ["project", cvData.projects || []],
  ];

  for (const [sectionName, entries] of sections) {
    for (const entry of entries) {
      const points = Array.isArray(entry.points) ? entry.points : [];
      const multilineBullets = getMultilineBulletInfo(points);

      if (multilineBullets.length > MAX_ENTRY_MULTILINE_BULLETS) {
        const label = entry.role || entry.name || entry.company || "entry";
        const oneBasedIndexes = multilineBullets
          .map(({ index }) => index + 1)
          .join(", ");
        issues.push(
          `${sectionName} "${label}" has ${multilineBullets.length} bullets estimated to wrap across multiple lines ` +
            `(bullets ${oneBasedIndexes}); max is ${MAX_ENTRY_MULTILINE_BULLETS}. ` +
            `Keep only the strongest ${MAX_ENTRY_MULTILINE_BULLETS} bullets as multi-line bullets, and shorten the remaining supporting bullets to about ${SINGLE_LINE_BULLET_CHAR_LIMIT} characters so they fit on one line.`,
        );
      }
    }
  }

  return issues;
}

function getFeaturedEntryIssues(cvData) {
  const issues = [];
  const sections = [
    ["experience", cvData.experience || []],
    ["project", cvData.projects || []],
  ];

  for (const [sectionName, entries] of sections) {
    if (entries.length === 0) continue;

    const entry = entries[0];
    const label = entry.role || entry.name || entry.company || "featured entry";
    const points = Array.isArray(entry.points) ? entry.points : [];
    const multilineBullets = getMultilineBulletInfo(points);

    if (points.length !== FEATURED_ENTRY_BULLET_COUNT) {
      issues.push(
        `${sectionName} "${label}" is the featured/most important ${sectionName} entry and must have exactly ${FEATURED_ENTRY_BULLET_COUNT} bullet points. ` +
          `Use the strongest grounded source facts for this entry before giving bullets to supporting entries.`,
      );
    }

    if (multilineBullets.length !== FEATURED_ENTRY_MULTILINE_BULLETS) {
      const oneBasedIndexes = multilineBullets
        .map(({ index }) => index + 1)
        .join(", ") || "none";
      issues.push(
        `${sectionName} "${label}" is the featured/most important ${sectionName} entry and must have exactly ${FEATURED_ENTRY_MULTILINE_BULLETS} multi-line bullets ` +
          `(currently ${multilineBullets.length}; bullets ${oneBasedIndexes}). Make exactly two bullets exceed about ${SINGLE_LINE_BULLET_CHAR_LIMIT} characters and keep one supporting bullet near ${SINGLE_LINE_BULLET_CHAR_LIMIT} characters or less.`,
      );
    }
  }

  return issues;
}
function enforceEntryMultilineBulletLimit(cvData, jobProfile = null) {
  const fallbackProfile = jobProfile || { terms: new Set(), offTopicTerms: new Set() };
  const capEntries = (entries = []) =>
    entries.map((entry, entryIndex) => {
      const points = Array.isArray(entry.points) ? entry.points : [];
      if (entryIndex === 0) return entry;
      const multilineBullets = points
        .map((point, index) => ({
          index,
          score: scoreBulletForJob(point, fallbackProfile),
          lines: getResumeBulletLineCount(point),
        }))
        .filter(({ lines }) => lines > 1);

      if (multilineBullets.length <= MAX_ENTRY_MULTILINE_BULLETS) {
        return entry;
      }

      const keptMultilineIndexes = new Set(
        multilineBullets
          .sort((a, b) => b.score - a.score || a.index - b.index)
          .slice(0, MAX_ENTRY_MULTILINE_BULLETS)
          .map(({ index }) => index),
      );
      const multilineIndexes = new Set(
        multilineBullets.map(({ index }) => index),
      );

      return {
        ...entry,
        points: points.filter(
          (_point, index) =>
            !multilineIndexes.has(index) || keptMultilineIndexes.has(index),
        ),
      };
    });

  return {
    ...cvData,
    experience: capEntries(cvData.experience),
    projects: capEntries(cvData.projects),
  };
}
function getBulletOpeningVerb(point) {
  const match = String(point || "")
    .trim()
    .match(/^[a-zA-Z]+/);
  return match ? match[0].toLowerCase() : "";
}

function getBulletMinimumWordCount(index) {
  return index === 0 ? MIN_PRIMARY_BULLET_WORDS : MIN_SUPPORTING_BULLET_WORDS;
}

function getEntrySpecificTerms(entry, sourceEntry) {
  const ignoredTerms = new Set([
    "and",
    "app",
    "application",
    "for",
    "platform",
    "project",
    "stack",
    "system",
    "the",
    "tool",
    "tools",
    "using",
    "web",
    "with",
  ]);
  const tags = [
    ...(Array.isArray(entry?.tags) ? entry.tags : [entry?.tags].filter(Boolean)),
    ...(Array.isArray(sourceEntry?.tags)
      ? sourceEntry.tags
      : [sourceEntry?.tags].filter(Boolean)),
  ];
  const termSource = [
    entry?.technologies,
    sourceEntry?.technologies,
    ...tags,
  ]
    .filter(Boolean)
    .join(" ");

  return new Set(
    normalizeSourceText(termSource)
      .split(/\s+/)
      .filter((term) => term.length > 1 && !ignoredTerms.has(term)),
  );
}

function pointIncludesEntryTerm(point, terms) {
  const normalized = normalizeSourceText(point);
  for (const term of terms) {
    if (normalized.includes(term)) return true;
  }
  return false;
}

function getBulletQualitySignals(point, entry, sourceEntry, jobProfile) {
  const verb = getBulletOpeningVerb(point);
  const normalizedPoint = normalizeSourceText(point);
  const entryTerms = getEntrySpecificTerms(entry, sourceEntry);
  const hasEntryTerm = pointIncludesEntryTerm(point, entryTerms);
  const hasJobKeyword = jobProfile
    ? [...jobProfile.terms].some(
        (term) => term.length > 2 && normalizedPoint.includes(term),
      )
    : false;

  const hasTechnology = TECHNICAL_SIGNAL_PATTERN.test(point) || hasEntryTerm;
  const hasImplementation = IMPLEMENTATION_SIGNAL_PATTERN.test(point);
  const hasPurposeOrOutcome = PURPOSE_OUTCOME_SIGNAL_PATTERN.test(point);
  const hasMetric = METRIC_SIGNAL_PATTERN.test(point);
  const opensStrong = STRONG_OPENING_VERBS.has(verb);

  return {
    hasImplementation,
    hasJobKeyword,
    hasMetric,
    hasPurposeOrOutcome,
    hasTechnology,
    opensStrong,
    verb,
    densityScore: [
      opensStrong,
      hasTechnology,
      hasImplementation,
      hasPurposeOrOutcome,
      hasMetric || hasJobKeyword,
    ].filter(Boolean).length,
  };
}

function getSourceEntryForQuality(entry, sourceEntries, sectionKey) {
  return findMatchingSourceEntryMatch(entry, sourceEntries, sectionKey)?.entry || null;
}

function getBulletQualityIssues(cvData, masterCV = {}, jobProfile = null) {
  const issues = [];
  const sections = [
    {
      label: "experience",
      key: "experience",
      sourceEntries: masterCV.experience || [],
      requiredDensity: 3,
    },
    {
      label: "project",
      key: "projects",
      sourceEntries: masterCV.projects || [],
      requiredDensity: 4,
    },
  ];

  const openingVerbCounts = new Map();
  for (const { key } of sections) {
    for (const entry of cvData[key] || []) {
      for (const point of Array.isArray(entry.points) ? entry.points : []) {
        const verb = getBulletOpeningVerb(point);
        if (!verb) continue;
        openingVerbCounts.set(verb, (openingVerbCounts.get(verb) || 0) + 1);
      }
    }
  }

  for (const { label, key, sourceEntries, requiredDensity } of sections) {
    for (const entry of cvData[key] || []) {
      const sourceEntry = getSourceEntryForQuality(entry, sourceEntries, key);
      const entryLabel = entry.role || entry.name || entry.company || "entry";
      const points = Array.isArray(entry.points) ? entry.points : [];

      points.forEach((point, index) => {
        const wordTotal = countWords(point);
        const minimumWords = getBulletMinimumWordCount(index);
        const signals = getBulletQualitySignals(
          point,
          entry,
          sourceEntry,
          jobProfile,
        );

        if (WEAK_OPENING_VERBS.has(signals.verb)) {
          issues.push(
            `${label} "${entryLabel}" bullet ${index + 1} opens with a weak/generic verb ("${signals.verb}"). ` +
              `Rewrite it with a stronger engineering verb and the formula: Action Verb + Technology + Implementation Detail + Business Purpose + Measurable Impact.`,
          );
        }

        if (wordTotal < minimumWords) {
          issues.push(
            `${label} "${entryLabel}" bullet ${index + 1} is too thin (${wordTotal} words, minimum ${minimumWords}). ` +
              `Expand it with grounded technology, implementation detail, business purpose, or measurable impact from the matching Master CV entry.`,
          );
        } else if (wordTotal > MAX_BULLET_WORDS) {
          issues.push(
            `${label} "${entryLabel}" bullet ${index + 1} is too long (${wordTotal} words, max ${MAX_BULLET_WORDS}). ` +
              `Tighten it while preserving the technology, implementation detail, purpose, and impact.`,
          );
        }

        if (!signals.hasPurposeOrOutcome) {
          issues.push(
            `${label} "${entryLabel}" bullet ${index + 1} lacks business/user context. ` +
              `Explain why the work mattered, who used it, what process it improved, or what outcome it produced, without inventing new facts.`,
          );
        }

        if (label === "project" && !signals.hasTechnology) {
          issues.push(
            `${label} "${entryLabel}" bullet ${index + 1} does not mention a specific technology or stack inside the sentence. ` +
              `Integrate a source-backed technology naturally into the bullet instead of relying only on the project heading.`,
          );
        }

        if (signals.densityScore < requiredDensity) {
          issues.push(
            `${label} "${entryLabel}" bullet ${index + 1} has low information density. ` +
              `It should include a strong verb, source-backed technology, implementation detail, business purpose, and metric or job-relevant keyword where supported.`,
          );
        }
      });
    }
  }

  for (const [verb, count] of openingVerbCounts.entries()) {
    if (count > MAX_REPEATED_OPENING_VERB) {
      issues.push(
        `The opening verb "${verb}" is reused ${count} times across bullets. ` +
          `Vary opening verbs across the resume (e.g. Engineered, Designed, Optimized, Conducted, Integrated, Leveraged, Automated) so no verb opens more than ${MAX_REPEATED_OPENING_VERB} bullets.`,
      );
    }
  }

  return issues;
}
function normalizeSourceText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSourceUrl(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function compactSourceText(value) {
  return normalizeSourceText(value).replace(/\s+/g, "");
}

function getProjectCoreName(name) {
  return String(name || "")
    .split(/\s+[|:–—-]\s+|\s+\|\s+|\|/)[0]
    .trim();
}

function sourceSimilarity(a, b) {
  const normalizedA = normalizeSourceText(a);
  const normalizedB = normalizeSourceText(b);
  if (!normalizedA || !normalizedB) return 0;

  const compactA = compactSourceText(normalizedA);
  const compactB = compactSourceText(normalizedB);
  if (
    compactA.length >= 4 &&
    compactB.length >= 4 &&
    (compactA.includes(compactB) || compactB.includes(compactA))
  ) {
    return 1;
  }

  const tokensA = new Set(normalizedA.split(/\s+/).filter((token) => token.length > 2));
  const tokensB = new Set(normalizedB.split(/\s+/).filter((token) => token.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap++;
  }

  return overlap / Math.min(tokensA.size, tokensB.size);
}

function findMatchingSourceEntryMatch(entry, sourceEntries = [], sectionName) {
  let bestMatch = null;
  let bestIndex = -1;
  let bestScore = 0;

  for (const [index, source] of sourceEntries.entries()) {
    let score;
    if (sectionName === "projects") {
      score = Math.max(
        sourceSimilarity(entry.name, source.name),
        sourceSimilarity(getProjectCoreName(entry.name), getProjectCoreName(source.name)),
      );
      const generatedLink = normalizeSourceUrl(entry.demo_link);
      const sourceLink = normalizeSourceUrl(source.demo_link);
      if (generatedLink && sourceLink && generatedLink === sourceLink) {
        score = Math.max(score, 1);
      }
    } else {
      const roleScore = sourceSimilarity(entry.role, source.role);
      const companyScore = sourceSimilarity(entry.company, source.company);
      const combinedScore = sourceSimilarity(
        `${entry.role || ""} ${entry.company || ""}`,
        `${source.role || ""} ${source.company || ""}`,
      );

      score = Math.max(
        combinedScore,
        roleScore && companyScore ? roleScore * 0.6 + companyScore * 0.4 : 0,
      );

      if (companyScore >= 0.9 && roleScore < 0.35) {
        score = Math.min(score, 0.55);
      }

      if (roleScore >= 0.75 && companyScore >= 0.5) {
        score = Math.max(score, 0.9);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = source;
      bestIndex = index;
    }
  }

  return bestScore >= 0.65
    ? { entry: bestMatch, index: bestIndex, score: bestScore }
    : null;
}

function findMatchingSourceEntry(entry, sourceEntries = [], sectionName) {
  return findMatchingSourceEntryMatch(entry, sourceEntries, sectionName)?.entry || null;
}

function findMatchingQualificationMatch(entry, sourceEntries = []) {
  let bestMatch = null;
  let bestIndex = -1;
  let bestScore = 0;

  for (const [index, source] of sourceEntries.entries()) {
    let score = Math.max(
      sourceSimilarity(entry.title, source.title),
      sourceSimilarity(
        `${entry.title || ""} ${entry.organization || ""}`,
        `${source.title || ""} ${source.organization || ""}`,
      ),
    );

    const generatedLink = normalizeSourceUrl(entry.link);
    const sourceLink = normalizeSourceUrl(source.link);
    if (generatedLink && sourceLink && generatedLink === sourceLink) {
      score = Math.max(score, 1);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = source;
      bestIndex = index;
    }
  }

  return bestScore >= 0.65
    ? { entry: bestMatch, index: bestIndex, score: bestScore }
    : null;
}

function copySourceFields(target, source, fields) {
  const reconciled = { ...target };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      reconciled[field] = source[field];
    } else {
      delete reconciled[field];
    }
  }
  return reconciled;
}

function reconcileSourceLockedEntry(generatedEntry, sourceEntry, lockedFields) {
  const selectedPoints = Array.isArray(generatedEntry.points)
    ? generatedEntry.points
    : sourceEntry.points || [];

  return {
    ...copySourceFields(generatedEntry, sourceEntry, lockedFields),
    points: selectedPoints,
  };
}

function getQualificationSourceSelectionIssues(cvData, masterCV) {
  const issues = [];

  for (const qualification of cvData.additional_qualifications || []) {
    if (!findMatchingQualificationMatch(
      qualification,
      masterCV.additional_qualifications || [],
    )) {
      issues.push(
        `Additional qualification "${qualification.title || ""}" does not match any source certification, publication, or achievement in the Master CV. Select only from the allowed source entries.`,
      );
    }
  }

  return issues;
}

function reconcileTailoredCVWithMaster(cvData, masterCV) {
  const seenExperience = new Set();
  const experience = [];
  for (const entry of cvData.experience || []) {
    const match = findMatchingSourceEntryMatch(
      entry,
      masterCV.experience || [],
      "experience",
    );
    if (!match || seenExperience.has(match.index)) continue;
    seenExperience.add(match.index);
    experience.push(
      reconcileSourceLockedEntry(entry, match.entry, [
        "role",
        "company",
        "location",
        "dates",
        "tags",
        "important",
      ]),
    );
  }

  const seenProjects = new Set();
  const projects = [];
  for (const entry of cvData.projects || []) {
    const match = findMatchingSourceEntryMatch(
      entry,
      masterCV.projects || [],
      "projects",
    );
    if (!match || seenProjects.has(match.index)) continue;
    seenProjects.add(match.index);
    projects.push(
      reconcileSourceLockedEntry(entry, match.entry, [
        "name",
        "technologies",
        "dates",
        "demo_link",
        "tags",
        "important",
      ]),
    );
  }

  const seenQualifications = new Set();
  const additionalQualifications = [];
  for (const entry of cvData.additional_qualifications || []) {
    const match = findMatchingQualificationMatch(
      entry,
      masterCV.additional_qualifications || [],
    );
    if (!match || seenQualifications.has(match.index)) continue;
    seenQualifications.add(match.index);
    additionalQualifications.push(
      copySourceFields(entry, match.entry, [
        "type",
        "title",
        "organization",
        "date",
        "link",
        "tags",
        "important",
      ]),
    );
  }

  return {
    ...cvData,
    personal_info: masterCV.personal_info || cvData.personal_info || {},
    education: masterCV.education || [],
    experience,
    projects,
    additional_qualifications: additionalQualifications,
  };
}

function formatAdditionalQualificationEntries(masterCV) {
  return (masterCV.additional_qualifications || [])
    .filter((entry) => entry.title?.trim())
    .map((entry, index) => {
      const organization = entry.organization ? ` | ${entry.organization}` : "";
      const date = entry.date ? ` | ${entry.date}` : "";
      const link = entry.link ? ` | link: ${entry.link}` : "";
      return `${index + 1}. ${entry.title}${organization}${date}${link}`;
    })
    .join("\n");
}

function formatAllowedSourceEntries(masterCV) {
  const experience = (masterCV.experience || [])
    .map((entry, index) => `${index + 1}. ${entry.role || "Role"} at ${entry.company || "Company"}`)
    .join("\n");
  const projects = (masterCV.projects || [])
    .map((entry, index) => {
      const link = entry.demo_link ? ` | link: ${entry.demo_link}` : " | no source link";
      return `${index + 1}. ${entry.name || "Project"}${link}`;
    })
    .join("\n");
  const qualifications = formatAdditionalQualificationEntries(masterCV);

  return `Allowed experience entries:\n${experience || "(none)"}\n\nAllowed project entries:\n${projects || "(none)"}\n\nAllowed certification/publication/achievement entries:\n${qualifications || "(none)"}`;
}

function getSourceSelectionIssues(cvData, masterCV) {
  const issues = [];

  for (const exp of cvData.experience || []) {
    if (!findMatchingSourceEntry(exp, masterCV.experience || [], "experience")) {
      issues.push(
        `Experience "${exp.role || ""}" at "${exp.company || ""}" does not match any source experience entry in the Master CV. Select only from the allowed source entries.`,
      );
    }
  }

  for (const project of cvData.projects || []) {
    const sourceProject = findMatchingSourceEntry(project, masterCV.projects || [], "projects");
    if (!sourceProject) {
      issues.push(
        `Project "${project.name || ""}" does not match any source project in the Master CV. Remove it and replace it only with a real Master CV project if space allows.`,
      );
      continue;
    }

    const generatedLink = normalizeSourceUrl(project.demo_link);
    const sourceLink = normalizeSourceUrl(sourceProject.demo_link);
    if (generatedLink && generatedLink !== sourceLink) {
      issues.push(
        `Project "${project.name || ""}" uses a link that is not in the Master CV. Preserve the source demo_link exactly when it exists; otherwise omit demo_link.`,
      );
    }
  }

  issues.push(...getQualificationSourceSelectionIssues(cvData, masterCV));

  return issues;
}

const ROLE_TERM_EXPANSIONS = [
  {
    test: /\b(web\s*dev|web\s*developer|frontend|front\s*end|full\s*stack|fullstack|mern|react|next\.?js)\b/i,
    terms: [
      "web",
      "website",
      "frontend",
      "backend",
      "fullstack",
      "full",
      "stack",
      "javascript",
      "typescript",
      "react",
      "next",
      "node",
      "express",
      "html",
      "css",
      "tailwind",
      "api",
      "rest",
      "mern",
      "mongodb",
      "database",
      "ui",
      "responsive",
      "dashboard",
      "portal",
      "crm",
      "erp",
      "auth",
      "authentication",
      "deployment",
    ],
    offTopicTerms: [
      "nlp",
      "machine",
      "learning",
      "deep",
      "pytorch",
      "tensorflow",
      "classification",
      "sentiment",
      "entity",
      "bias",
      "eeg",
      "research",
      "academic",
      "llm",
    ],
  },
  {
    test: /\b(data\s*science|machine\s*learning|ml\b|ai\b|nlp|deep\s*learning)\b/i,
    terms: [
      "data",
      "science",
      "machine",
      "learning",
      "ml",
      "ai",
      "nlp",
      "python",
      "pytorch",
      "tensorflow",
      "model",
      "classification",
      "analytics",
      "sentiment",
      "llm",
    ],
    offTopicTerms: [],
  },
];

function getEntryText(entry) {
  const tags = Array.isArray(entry.tags) ? entry.tags : [entry.tags].filter(Boolean);
  const points = Array.isArray(entry.points)
    ? entry.points
    : [entry.points].filter(Boolean);

  return [
    entry.name,
    entry.title,
    entry.role,
    entry.company,
    entry.organization,
    entry.technologies,
    ...tags,
    ...points,
  ]
    .filter(Boolean)
    .join(" ");
}

function getJobProfile(jobDescription, position) {
  const source = `${position || ""} ${jobDescription || ""}`;
  const normalized = normalizeSourceText(source);
  const terms = new Set(
    normalized.split(/\s+/).filter((token) => token.length > 2 && token !== "resume"),
  );
  const offTopicTerms = new Set();
  let roleSpecific = false;

  for (const expansion of ROLE_TERM_EXPANSIONS) {
    if (expansion.test.test(source)) {
      roleSpecific = true;
      for (const term of expansion.terms) terms.add(term);
      for (const term of expansion.offTopicTerms) offTopicTerms.add(term);
    }
  }

  return { terms, offTopicTerms, roleSpecific };
}

function scoreEntryForJob(entry, jobProfile) {
  const normalized = normalizeSourceText(getEntryText(entry));
  if (!normalized) return 0;

  const entryTokens = new Set(normalized.split(/\s+/).filter(Boolean));
  let score = 0;
  for (const term of jobProfile.terms) {
    if (entryTokens.has(term) || normalized.includes(term)) score += 2;
  }

  let offTopicHits = 0;
  for (const term of jobProfile.offTopicTerms) {
    if (entryTokens.has(term) || normalized.includes(term)) offTopicHits++;
  }

  const hasDirectWebSignal = [
    "web",
    "frontend",
    "backend",
    "fullstack",
    "react",
    "next",
    "javascript",
    "typescript",
    "node",
    "mern",
    "api",
    "html",
    "css",
    "tailwind",
    "portal",
    "crm",
    "erp",
  ].some((term) => entryTokens.has(term) || normalized.includes(term));

  if (jobProfile.roleSpecific && hasDirectWebSignal) score += 8;
  if (jobProfile.roleSpecific && offTopicHits > 0) {
    score -= offTopicHits * (hasDirectWebSignal ? 2 : 4);
  }
  if (entry.important) score += 3;

  return score;
}

const MONTH_RANKS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function getDateRankValue(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return 0;
  if (/\b(present|current|ongoing|now)\b/.test(text)) return 999999;

  const yearMatches = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)];
  if (yearMatches.length === 0) return 0;

  const monthMatches = [
    ...text.matchAll(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/g,
    ),
  ];
  const year = Number(yearMatches[yearMatches.length - 1][1]);
  const month = monthMatches.length
    ? MONTH_RANKS[monthMatches[monthMatches.length - 1][1].slice(0, 3)] || 12
    : 12;

  return year * 12 + month;
}

function compareRankedEntries(a, b) {
  if (a.important !== b.important) return Number(b.important) - Number(a.important);
  if (a.score !== b.score) return b.score - a.score;
  if (a.recency !== b.recency) return b.recency - a.recency;
  return a.index - b.index;
}

function rankEntriesForJob(entries = [], jobProfile, options = {}) {
  const { filter = () => true, scoreAdjustment = 0 } = options;

  return entries
    .map((entry, index) => ({
      entry,
      index,
      important: Boolean(entry.important),
      recency: getDateRankValue(entry.dates || entry.date),
      score: scoreEntryForJob(entry, jobProfile) + scoreAdjustment,
    }))
    .filter((candidate) => filter(candidate.entry))
    .sort(compareRankedEntries);
}

function hasMinimumSourceBulletFacts(entry) {
  return (
    Array.isArray(entry?.points) &&
    entry.points.filter((point) => String(point || "").trim()).length >=
      MIN_ENTRY_BULLETS
  );
}

function selectRankedEntries(
  rankedEntries,
  targetCount,
  { preferMinimumBullets = false } = {},
) {
  const limit = Math.max(0, targetCount);
  if (!preferMinimumBullets || limit === 0) {
    return rankedEntries.slice(0, limit);
  }

  const entriesWithMinimumFacts = rankedEntries.filter((candidate) =>
    hasMinimumSourceBulletFacts(candidate.entry),
  );
  if (entriesWithMinimumFacts.length >= limit) {
    return entriesWithMinimumFacts.slice(0, limit);
  }

  const selectedIndexes = new Set(
    entriesWithMinimumFacts.map((candidate) => candidate.index),
  );
  return [
    ...entriesWithMinimumFacts,
    ...rankedEntries.filter((candidate) => !selectedIndexes.has(candidate.index)),
  ].slice(0, limit);
}

function formatPlannedEntry(candidate, sectionName) {
  const entry = candidate.entry;
  let label;

  if (sectionName === "experience") {
    label = `${entry.role || "Role"} at ${entry.company || "Company"}`;
  } else if (sectionName === "projects") {
    label = entry.name || "Project";
  } else {
    label = [entry.title, entry.organization].filter(Boolean).join(" | ") || "Qualification";
  }

  return `- source #${candidate.index + 1}: ${label} (score ${candidate.score})`;
}

function formatDeterministicSelectionPlan(selectionPlan) {
  const formatList = (entries, sectionName) =>
    entries.length
      ? entries
          .map((candidate, index) => {
            const suffix =
              index === 0 && ["experience", "projects"].includes(sectionName)
                ? " (FEATURED / most important)"
                : "";
            return `${formatPlannedEntry(candidate, sectionName)}${suffix}`;
          })
          .join("\n")
      : "- none";
  return `Experience entries, in this exact order:\n${formatList(selectionPlan.experience, "experience")}\n\nProject entries, in this exact order:\n${formatList(selectionPlan.projects, "projects")}\n\nCertification/publication/achievement entries, in this exact order:\n${formatList(selectionPlan.additional_qualifications, "additional_qualifications")}`;
}

function scoreBulletForJob(point, jobProfile) {
  const normalized = normalizeSourceText(point);
  if (!normalized) return 0;

  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  let score = 0;
  for (const term of jobProfile.terms) {
    if (tokens.has(term) || normalized.includes(term)) score += 2;
  }
  for (const term of jobProfile.offTopicTerms) {
    if (tokens.has(term) || normalized.includes(term)) score -= 2;
  }
  if (/\d/.test(point)) score += 1;

  const wordTotal = countWords(point);
  if (wordTotal >= 12 && wordTotal <= 28) score += 1;
  if (wordTotal > 36) score -= 1;

  return score;
}

function selectSourcePointsForJob(entry, jobProfile) {
  const points = Array.isArray(entry.points) ? entry.points : [];

  return points
    .map((point, index) => ({
      point,
      index,
      score: scoreBulletForJob(point, jobProfile),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.index - b.index;
    })
    .slice(0, MAX_ENTRY_BULLETS)
    .map(({ point }) => point);
}

function sortSelection(selection) {
  return {
    experience: [...selection.experience].sort(compareRankedEntries),
    projects: [...selection.projects].sort(compareRankedEntries),
    additional_qualifications: [...selection.additional_qualifications].sort(
      compareRankedEntries,
    ),
  };
}

function buildDeterministicSelectionPlan(
  masterCV,
  jobDescription,
  position,
  { targetExperience, targetProjects, targetQualifications },
) {
  const jobProfile = getJobProfile(jobDescription, position);
  const rankedExperience = rankEntriesForJob(masterCV.experience || [], jobProfile);
  const rankedProjects = rankEntriesForJob(masterCV.projects || [], jobProfile);
  const rankedQualifications = rankEntriesForJob(
    masterCV.additional_qualifications || [],
    jobProfile,
    {
      filter: (entry) => Boolean(entry.title?.trim()),
      scoreAdjustment: -2,
    },
  );

  return {
    ...sortSelection({
      experience: selectRankedEntries(rankedExperience, targetExperience, {
        preferMinimumBullets: true,
      }),
      projects: selectRankedEntries(rankedProjects, targetProjects, {
        preferMinimumBullets: true,
      }),
      additional_qualifications: selectRankedEntries(
        rankedQualifications,
        targetQualifications,
      ),
    }),
    jobProfile,
  };
}

function getSourceIndexesForSection(entries, sourceEntries, sectionName) {
  const indexes = [];

  for (const entry of entries || []) {
    const match =
      sectionName === "additional_qualifications"
        ? findMatchingQualificationMatch(entry, sourceEntries)
        : findMatchingSourceEntryMatch(entry, sourceEntries, sectionName);
    if (match) indexes.push(match.index);
  }

  return indexes;
}

function getSelectionPlanIssues(cvData, masterCV, selectionPlan) {
  const issues = [];
  const sectionConfigs = [
    ["experience", masterCV.experience || [], "experience"],
    ["projects", masterCV.projects || [], "projects"],
    [
      "additional_qualifications",
      masterCV.additional_qualifications || [],
      "additional_qualifications",
    ],
  ];

  for (const [sectionName, sourceEntries, label] of sectionConfigs) {
    const expected = selectionPlan[sectionName].map((candidate) => candidate.index);
    const actual = getSourceIndexesForSection(
      cvData[sectionName] || [],
      sourceEntries,
      sectionName,
    );

    if (expected.join(",") !== actual.join(",")) {
      issues.push(
        `${label} selection/order changed. Expected source indexes [${expected
          .map((index) => index + 1)
          .join(", ") || "none"}], but received [${actual
          .map((index) => index + 1)
          .join(", ") || "none"}]. Follow the deterministic selection plan exactly.`,
      );
    }
  }

  return issues;
}

function fallbackSourceEntry(sourceEntry, sectionName, jobProfile) {
  if (sectionName === "additional_qualifications") return { ...sourceEntry };

  return {
    ...sourceEntry,
    points: selectSourcePointsForJob(sourceEntry, jobProfile),
  };
}

function buildGeneratedEntryMap(entries, sourceEntries, sectionName) {
  const generatedBySourceIndex = new Map();

  for (const entry of entries || []) {
    const match =
      sectionName === "additional_qualifications"
        ? findMatchingQualificationMatch(entry, sourceEntries)
        : findMatchingSourceEntryMatch(entry, sourceEntries, sectionName);

    if (match && !generatedBySourceIndex.has(match.index)) {
      generatedBySourceIndex.set(match.index, entry);
    }
  }

  return generatedBySourceIndex;
}

function enforceDeterministicSelectionPlan(cvData, masterCV, selectionPlan) {
  const jobProfile = selectionPlan.jobProfile;
  const experienceMap = buildGeneratedEntryMap(
    cvData.experience || [],
    masterCV.experience || [],
    "experience",
  );
  const projectMap = buildGeneratedEntryMap(
    cvData.projects || [],
    masterCV.projects || [],
    "projects",
  );
  const qualificationMap = buildGeneratedEntryMap(
    cvData.additional_qualifications || [],
    masterCV.additional_qualifications || [],
    "additional_qualifications",
  );

  const buildExperienceEntry = (candidate) => {
    const sourceEntry = (masterCV.experience || [])[candidate.index];
    const generatedEntry = experienceMap.get(candidate.index);
    const entry = generatedEntry
      ? reconcileSourceLockedEntry(generatedEntry, sourceEntry, [
          "role",
          "company",
          "location",
          "dates",
          "tags",
          "important",
        ])
      : fallbackSourceEntry(sourceEntry, "experience", jobProfile);

    if (!Array.isArray(entry.points) || entry.points.length === 0) {
      entry.points = selectSourcePointsForJob(sourceEntry, jobProfile);
    }
    return entry;
  };

  const buildProjectEntry = (candidate) => {
    const sourceEntry = (masterCV.projects || [])[candidate.index];
    const generatedEntry = projectMap.get(candidate.index);
    const entry = generatedEntry
      ? reconcileSourceLockedEntry(generatedEntry, sourceEntry, [
          "name",
          "technologies",
          "dates",
          "demo_link",
          "tags",
          "important",
        ])
      : fallbackSourceEntry(sourceEntry, "projects", jobProfile);

    if (!Array.isArray(entry.points) || entry.points.length === 0) {
      entry.points = selectSourcePointsForJob(sourceEntry, jobProfile);
    }
    return entry;
  };

  const buildQualificationEntry = (candidate) => {
    const sourceEntry = (masterCV.additional_qualifications || [])[candidate.index];
    const generatedEntry = qualificationMap.get(candidate.index);
    return generatedEntry
      ? copySourceFields(generatedEntry, sourceEntry, [
          "type",
          "title",
          "organization",
          "date",
          "link",
          "tags",
          "important",
        ])
      : fallbackSourceEntry(sourceEntry, "additional_qualifications", jobProfile);
  };

  return {
    ...cvData,
    personal_info: masterCV.personal_info || cvData.personal_info || {},
    education: masterCV.education || [],
    experience: selectionPlan.experience.map(buildExperienceEntry),
    projects: selectionPlan.projects.map(buildProjectEntry),
    additional_qualifications:
      selectionPlan.additional_qualifications.map(buildQualificationEntry),
  };
}
function hasSimilarBullet(points, candidatePoint) {
  const candidateText = normalizeSourceText(candidatePoint);
  if (!candidateText) return true;

  return points.some((point) => {
    const pointText = normalizeSourceText(point);
    return (
      pointText === candidateText ||
      sourceSimilarity(pointText, candidateText) >= 0.8
    );
  });
}

function fillEntryMinimumPoints(entry, sourceEntry, jobProfile) {
  const points = Array.isArray(entry.points)
    ? entry.points.filter((point) => String(point || "").trim())
    : [];

  if (points.length >= MIN_ENTRY_BULLETS || !sourceEntry) {
    return { ...entry, points: points.slice(0, MAX_ENTRY_BULLETS) };
  }

  for (const point of selectSourcePointsForJob(sourceEntry, jobProfile)) {
    if (points.length >= MIN_ENTRY_BULLETS) break;
    if (hasSimilarBullet(points, point)) continue;
    points.push(point);
  }

  return { ...entry, points: points.slice(0, MAX_ENTRY_BULLETS) };
}

function enforceEntryBulletMinimum(cvData, masterCV, jobProfile) {
  const fillEntries = (entries = [], sourceEntries = [], sectionName) =>
    entries.map((entry) =>
      fillEntryMinimumPoints(
        entry,
        findMatchingSourceEntry(entry, sourceEntries, sectionName),
        jobProfile,
      ),
    );

  return {
    ...cvData,
    experience: fillEntries(
      cvData.experience,
      masterCV.experience || [],
      "experience",
    ),
    projects: fillEntries(cvData.projects, masterCV.projects || [], "projects"),
  };
}
function compactResumeToTarget(cvData, masterCV, jobDescription, position) {
  let compacted = { ...cvData };
  const jobProfile = getJobProfile(jobDescription, position);

  function currentEstimate() {
    return estimatePageUsage(compacted);
  }

  function scoreSelectedEntry(entry, sectionName) {
    const source = findMatchingSourceEntry(
      entry,
      masterCV[sectionName] || [],
      sectionName,
    );
    return scoreEntryForJob(source || entry, jobProfile);
  }

  function removeItem(section, removeIndex) {
    compacted = {
      ...compacted,
      [section]: (compacted[section] || []).filter(
        (_entry, index) => index !== removeIndex,
      ),
    };
  }

  function removeBullet(section, entryIndex, pointIndex) {
    compacted = {
      ...compacted,
      [section]: (compacted[section] || []).map((entry, index) => {
        if (index !== entryIndex) return entry;
        return {
          ...entry,
          points: (entry.points || []).filter(
            (_point, currentPointIndex) => currentPointIndex !== pointIndex,
          ),
        };
      }),
    };
  }

  function getLowestValueBulletRemoval() {
    const candidates = [];
    for (const section of ["projects", "experience"]) {
      for (const [entryIndex, entry] of (compacted[section] || []).entries()) {
        if (entryIndex === 0) continue;
        const points = Array.isArray(entry.points) ? entry.points : [];
        if (points.length <= MIN_ENTRY_BULLETS) continue;

        const entryScore = scoreSelectedEntry(entry, section);
        points.forEach((point, pointIndex) => {
          candidates.push({
            section,
            entryIndex,
            pointIndex,
            isLeadBullet: pointIndex === 0,
            entryScore,
            bulletScore: scoreBulletForJob(point, jobProfile),
          });
        });
      }
    }

    candidates.sort((a, b) => {
      if (a.isLeadBullet !== b.isLeadBullet) {
        return Number(a.isLeadBullet) - Number(b.isLeadBullet);
      }
      if (a.entryScore !== b.entryScore) return a.entryScore - b.entryScore;
      if (a.bulletScore !== b.bulletScore) return a.bulletScore - b.bulletScore;
      return b.pointIndex - a.pointIndex;
    });

    return candidates[0] || null;
  }

  function getLowestValueQualificationRemoval() {
    const candidates = (compacted.additional_qualifications || []).map(
      (entry, index) => ({
        index,
        score: scoreEntryForJob(entry, jobProfile) - 2,
      }),
    );
    candidates.sort((a, b) => a.score - b.score || b.index - a.index);
    return candidates[0] || null;
  }

  function getLowestValueEntryRemoval() {
    const candidates = [];
    for (const section of ["projects", "experience"]) {
      const entries = compacted[section] || [];
      if (entries.length <= 1) continue;
      entries.forEach((entry, index) => {
        if (index === 0) return;
        candidates.push({
          section,
          index,
          score: scoreSelectedEntry(entry, section),
        });
      });
    }
    candidates.sort((a, b) => a.score - b.score || b.index - a.index);
    return candidates[0] || null;
  }

  for (let guard = 0; guard < 50; guard++) {
    const estimate = currentEstimate();
    if (estimate.layoutLines <= estimate.maxLines) break;

    const bulletRemoval = getLowestValueBulletRemoval();
    if (bulletRemoval) {
      removeBullet(
        bulletRemoval.section,
        bulletRemoval.entryIndex,
        bulletRemoval.pointIndex,
      );
      continue;
    }

    const qualificationRemoval = getLowestValueQualificationRemoval();
    if (qualificationRemoval) {
      removeItem("additional_qualifications", qualificationRemoval.index);
      continue;
    }

    const entryRemoval = getLowestValueEntryRemoval();
    if (entryRemoval) {
      removeItem(entryRemoval.section, entryRemoval.index);
      continue;
    }

    break;
  }

  return compacted;
}
/**
 * Returns a stateful generate() caller that automatically falls back to the
 * next model in ALL_MODELS when the current one returns 503.  Within a single
 * exported function call the model index only advances — so all subsequent
 * calls (e.g. validation-loop retries) reuse the already-working fallback.
 */
function createModelSelector(apiKey) {
  if (!apiKey) {
    throw new Error(
      "Gemini API key is required. Please add your API key in Settings.",
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  let modelIndex = 0;

  return async function generate(request) {
    while (modelIndex < ALL_MODELS.length) {
      try {
        const model = genAI.getGenerativeModel({
          model: ALL_MODELS[modelIndex],
        });
        return await model.generateContent(request);
      } catch (error) {
        if (isServiceUnavailable(error) && modelIndex < ALL_MODELS.length - 1) {
          console.warn(
            `Model ${ALL_MODELS[modelIndex]} unavailable (503), switching to ${ALL_MODELS[modelIndex + 1]}...`,
          );
          modelIndex++;
          continue;
        }
        throw error;
      }
    }
  };
}

/**
 * Detect invalid-API-key errors from Google Generative AI and rethrow with
 * a user-friendly message so the frontend can prompt the user to update their
 * key in Settings rather than showing a generic failure message.
 */
function rethrowIfApiKeyError(error) {
  const msg = error?.message || "";
  if (
    error?.status === 400 ||
    msg.includes("API_KEY_INVALID") ||
    msg.includes("API key not valid")
  ) {
    throw new Error(
      "Your Gemini API key is invalid. Please update it in Settings.",
    );
  }
  if (
    error?.status === 429 ||
    msg.includes("429") ||
    msg.includes("Too Many Requests") ||
    msg.includes("quota")
  ) {
    throw new Error(
      "Gemini API quota exceeded. You've hit your rate limit — please wait a moment and try again, or check your plan & billing in Google AI Studio.",
    );
  }
}

/**
 * Extract token usage from a Gemini API response and calculate cost
 */
function extractTokenUsage(response) {
  const usage = response.usageMetadata || {};
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;
  const totalTokens = usage.totalTokenCount || inputTokens + outputTokens;
  const cost =
    (inputTokens / 1_000_000) * PRICING.inputPerMillion +
    (outputTokens / 1_000_000) * PRICING.outputPerMillion;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cost: Math.round(cost * 1_000_000) / 1_000_000, // round to 6 decimals
  };
}

/**
 * Merge multiple token usage objects into one aggregate.
 */
function mergeTokenUsage(...usages) {
  const merged = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 };
  for (const u of usages) {
    if (!u) continue;
    merged.inputTokens += u.inputTokens || 0;
    merged.outputTokens += u.outputTokens || 0;
    merged.totalTokens += u.totalTokens || 0;
    merged.cost += u.cost || 0;
  }
  merged.cost = Math.round(merged.cost * 1_000_000) / 1_000_000;
  return merged;
}

/**
 * Parse JSON from an AI response, stripping markdown fences.
 */
function parseAIJson(text) {
  return JSON.parse(
    text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim(),
  );
}

// Master CV JSON Schema for reference
const CV_SCHEMA = `{
  "personal_info": {
    "name": "string",
    "phone": "string",
    "email": "string",
    "linkedin": "string (URL)",
    "github": "string (URL)",
    "website": "string (URL, optional)"
  },
  "education": [
    {
      "institution": "string",
      "location": "string",
      "degree": "string",
      "dates": "string",
      "gpa": "string (optional)",
      "relevant_coursework": "string (optional, comma-separated)"
    }
  ],
  "experience": [
    {
      "role": "string",
      "company": "string",
      "location": "string",
      "dates": "string",
      "points": ["string (bullet point describing achievement/responsibility)"]
    }
  ],
  "projects": [
    {
      "name": "string",
      "technologies": "string (comma-separated tech stack)",
      "dates": "string",
      "demo_link": "string (URL, optional - deployed project or demo)",
      "points": ["string (bullet point describing the project)"]
    }
  ],
  "additional_qualifications": [
    {
      "type": "certification | publication | achievement",
      "title": "string",
      "organization": "string (issuer, publisher, or awarding organization)",
      "date": "string (optional)",
      "link": "string (URL, optional)"
    }
  ],
  "skills": {
    "languages": ["string"],
    "frameworks": ["string"],
    "tools": ["string"],
    "libraries": ["string"]
  }
}`;

/**
 * Parse raw text (resume/CV dump) into structured JSON with block-based extraction
 * This ensures completeness and consistency by extracting individual blocks/entries
 */
export async function parseRawTextToCV(rawText, apiKey) {
  const generate = createModelSelector(apiKey);

  const prompt = `You are an expert resume parser. Extract the user's professional information from the following raw text and structure it into a clean JSON format.

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON, no markdown code blocks or explanations
2. Extract EVERY SINGLE entry/block from the CV - do not skip or omit any education, experience, or project entries
3. Each education entry, experience entry, and project entry is a separate "block" - count them carefully and include ALL of them
4. Clean up grammar and phrasing to be professional
5. Use action verbs at the start of bullet points (e.g., "Developed", "Implemented", "Led")
6. Quantify achievements where possible
7. If a field is not found, use an empty string or empty array
8. For skills, categorize them appropriately into languages, frameworks, tools, and libraries
9. Preserve ALL bullet points for each experience and project - do not truncate or summarize
10. Maintain chronological order (most recent first)
11. Extract GPA and relevant coursework when explicitly present; otherwise leave those optional education fields empty
12. Extract certifications, publications, awards, and notable achievements into additional_qualifications

BLOCK EXTRACTION RULES:
- An "education block" = one degree/institution entry
- An "experience block" = one job/role entry with ALL its bullet points
- A "project block" = one project entry with ALL its bullet points
- If the CV has 2 education entries, 3 experience entries, and 7 projects, output exactly 2+3+7=12 blocks total

OUTPUT JSON SCHEMA:
${CV_SCHEMA}

RAW TEXT TO PARSE:
${rawText}

OUTPUT (valid JSON only with ALL blocks included):`;

  try {
    const result = await generate(prompt);
    const response = await result.response;
    const tokenUsage = extractTokenUsage(response);
    let text = response.text();

    // Clean up the response - remove markdown code blocks if present
    text = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Parse and validate JSON
    const parsed = JSON.parse(text);

    // Validate that we have the expected structure
    if (!parsed.education) parsed.education = [];
    if (!parsed.experience) parsed.experience = [];
    if (!parsed.projects) parsed.projects = [];
    if (!parsed.additional_qualifications) parsed.additional_qualifications = [];
    if (!parsed.skills)
      parsed.skills = {
        languages: [],
        frameworks: [],
        tools: [],
        libraries: [],
      };
    if (!parsed.personal_info) parsed.personal_info = {};

    return { data: parsed, tokenUsage };
  } catch (error) {
    console.error("Error parsing CV with Gemini:", error);
    rethrowIfApiKeyError(error);
    throw new Error("Failed to parse CV. Please try again.");
  }
}

/**
 * Add new experience or projects to an existing CV
 * Useful for updating CV with new job or project completions
 */
export async function addToExistingCV(
  existingCV,
  newContent,
  contentType = "auto",
  apiKey,
) {
  const generate = createModelSelector(apiKey);

  const prompt = `You are an expert resume editor. The user has an existing CV and wants to add new ${contentType === "auto" ? "experience or projects" : contentType} to it.

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON, no markdown code blocks or explanations
2. Parse the new content and add it to the appropriate section(s) of the existing CV
3. If contentType is 'auto', determine whether the new content is experience or project based on context
4. Add new entries to the BEGINNING of the respective arrays (most recent first)
5. Maintain all existing entries in the CV - do NOT remove or modify them
6. Clean up the new content to match professional resume standards
7. Use action verbs and quantify achievements where possible
8. Extract demo/live links from projects if mentioned
9. Keep the exact same JSON structure as the existing CV

EXISTING CV JSON:
${JSON.stringify(existingCV, null, 2)}

NEW CONTENT TO ADD:
${newContent}

CONTENT TYPE: ${contentType}

OUTPUT (updated CV as valid JSON with new content added at the top of relevant sections):`;

  try {
    const result = await generate(prompt);
    const response = await result.response;
    const tokenUsage = extractTokenUsage(response);
    let text = response.text();

    // Clean up the response
    text = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(text);

    // Validate structure
    if (!parsed.education) parsed.education = existingCV.education || [];
    if (!parsed.experience) parsed.experience = existingCV.experience || [];
    if (!parsed.projects) parsed.projects = existingCV.projects || [];
    if (!parsed.additional_qualifications)
      parsed.additional_qualifications =
        existingCV.additional_qualifications || [];
    if (!parsed.skills)
      parsed.skills = existingCV.skills || {
        languages: [],
        frameworks: [],
        tools: [],
        libraries: [],
      };
    if (!parsed.personal_info) parsed.personal_info = existingCV.personal_info;

    return { data: parsed, tokenUsage };
  } catch (error) {
    console.error("Error adding content to CV with Gemini:", error);
    rethrowIfApiKeyError(error);
    throw new Error("Failed to add content to CV. Please try again.");
  }
}

/**
 * Generate a personalized, job-tailored cover letter body from a Master CV and Job Description.
 * Returns ONLY the body paragraphs — no header, no date, no sign-off.
 * The header/footer are assembled on the frontend.
 *
 * Uses a validation loop to enforce word count strictly.
 */
export async function generateCoverLetter(
  masterCV,
  jobDescription,
  company = "",
  position = "",
  wordCount = 250,
  apiKey,
) {
  const generate = createModelSelector(apiKey);
  const allTokenUsages = [];

  // Strict bounds — tighter than before
  const targetMin = Math.max(80, wordCount - 20);
  const targetMax = wordCount + 15;

  const prompt = `You are an expert career coach and professional writer. Generate the BODY of a compelling, highly personalized cover letter for a job application.

APPLICANT INFORMATION:
${JSON.stringify(masterCV, null, 2)}

JOB DETAILS:
Company: ${company || "the company"}
Position: ${position || "the position"}
Job Description:
${jobDescription}

COVER LETTER BODY REQUIREMENTS:
1. Write ONLY the body paragraphs — do NOT include any header, date, greeting (Dear Hiring Manager), or sign-off (Sincerely)
2. STRICT word count: Your output MUST be between ${targetMin} and ${targetMax} words. Count every word before outputting.
   - Current target: exactly ${wordCount} words for the body
   - If you write more than ${targetMax} words, you have FAILED the task
   - If you write fewer than ${targetMin} words, you have FAILED the task
3. Structure: 3 focused paragraphs (use 4 only if word count > 300)
   - Paragraph 1: Strong opening hook — why THIS specific company/role, mentioning the position title and company name naturally
   - Paragraph 2: 2–3 most relevant experiences tied to the job requirements with specifics
   - Paragraph 3: 1–2 impressive specific projects or technical achievements that match the role + brief enthusiasm/call to action
4. Use specific numbers, metrics, and keywords from both the CV and job description
5. Do NOT use generic filler phrases like "I am writing to express my interest..."
6. Be direct, confident, and specific — make it feel unique to this person and this job
7. The letter should feel natural and human-written, not AI-generated
8. Use strong action verbs and quantified achievements

IMPORTANT: Before writing your final output, mentally count your words. Trim or expand to hit ${targetMin}–${targetMax} words exactly.

OUTPUT: Plain text paragraphs only. Separate each paragraph with a blank line. No markdown, no code blocks, no headers, no greeting, no sign-off.`;

  try {
    const generationConfig = {
      temperature: 0.7,
      topP: 0.9,
    };

    const result = await generate({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    allTokenUsages.push(extractTokenUsage(response));
    let text = response.text().trim();

    // Clean up
    text = text
      .replace(/```[a-z]*\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Strip accidental greeting/sign-off
    text = text
      .replace(/^Dear Hiring Manager[,.]?\s*/im, "")
      .replace(/^Sincerely[,.]?\s*[\s\S]*$/im, "")
      .trim();

    // ── Word count validation loop ───────────────────────────────────────
    let currentWordCount = countWords(text);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (currentWordCount >= targetMin && currentWordCount <= targetMax) {
        break; // Word count is within range
      }

      const direction = currentWordCount > targetMax ? "too long" : "too short";
      const diff =
        currentWordCount > targetMax
          ? currentWordCount - wordCount
          : wordCount - currentWordCount;

      const correctionPrompt = `The cover letter body you wrote is ${direction}. It has ${currentWordCount} words but must be between ${targetMin}–${targetMax} words (target: ${wordCount}).

${
  direction === "too long"
    ? `Remove approximately ${diff} words. Cut filler phrases, reduce adjectives, tighten sentences. Do NOT remove entire paragraphs — just make each one more concise.`
    : `Add approximately ${diff} words. Expand on specific achievements, add another metric, or elaborate on a relevant project.`
}

Current text:
${text}

OUTPUT: The revised body text only (${targetMin}–${targetMax} words). Plain text paragraphs separated by blank lines. No markdown, no headers, no greeting, no sign-off. Count your words carefully before outputting.`;

      const fixResult = await generate({
        contents: [{ role: "user", parts: [{ text: correctionPrompt }] }],
        generationConfig: { temperature: 0.5, topP: 0.85 },
      });

      const fixResponse = await fixResult.response;
      allTokenUsages.push(extractTokenUsage(fixResponse));
      text = fixResponse
        .text()
        .trim()
        .replace(/```[a-z]*\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/^Dear Hiring Manager[,.]?\s*/im, "")
        .replace(/^Sincerely[,.]?\s*[\s\S]*$/im, "")
        .trim();

      currentWordCount = countWords(text);
    }

    return {
      data: text,
      tokenUsage: mergeTokenUsage(...allTokenUsages),
      wordCount: currentWordCount,
    };
  } catch (error) {
    console.error("Error generating cover letter with Gemini:", error);
    rethrowIfApiKeyError(error);
    if (error?.status === 429) {
      throw new Error(
        "Rate limit exceeded. Please wait a moment and try again.",
      );
    }
    throw new Error("Failed to generate cover letter. Please try again.");
  }
}

/**
 * Tailor a Master CV for a specific job description using block-based selection
 * with validation loops for page-fit and project heading width.
 *
 * Smart keyword strategy:
 * - ALWAYS add important ATS keywords directly into the skills section
 * - Only use white-text for "bad" job descriptions (unrealistic requirements)
 * - Validate that combined content fits on one page
 * - Validate that project name + technologies don't overflow heading lines
 */
export async function tailorCVForJob(
  masterCV,
  jobDescription,
  apiKey,
  position = "",
) {
  const generate = createModelSelector(apiKey);
  const allTokenUsages = [];

  // Assess JD quality to determine keyword strategy
  const jdQuality = assessJobDescriptionQuality(jobDescription, position);

  const qualificationEntries = (
    masterCV.additional_qualifications || []
  ).filter((qualification) => qualification.title?.trim());

  // Count blocks in master CV for validation
  const totalBlocks =
    (masterCV.education?.length || 0) +
    (masterCV.experience?.length || 0) +
    (masterCV.projects?.length || 0) +
    qualificationEntries.length;

  // Keep sections focused: max 3 experience entries and max 3 project entries.
  // Use bullet quality, not extra blocks, to fill the page.
  const targetExperience = Math.min(
    masterCV.experience?.length || 0,
    TARGET_EXPERIENCE_ENTRIES,
  );

  const targetProjects = Math.min(
    masterCV.projects?.length || 0,
    TARGET_PROJECT_ENTRIES,
  );
  const targetQualifications = Math.min(
    qualificationEntries.length,
    3,
  );

  const allowedSourceEntries = formatAllowedSourceEntries(masterCV);
  const selectionPlan = buildDeterministicSelectionPlan(
    masterCV,
    jobDescription,
    position,
    { targetExperience, targetProjects, targetQualifications },
  );
  const deterministicSelectionInstructions =
    formatDeterministicSelectionPlan(selectionPlan);

  const whiteTextInstructions =
    jdQuality === "bad"
      ? `This job description appears to be poorly written (unrealistic requirements for the role level).
   Include an "ats_keywords" array with key terms from the JD that are missing from the resume.
   Keep the ats_keywords array SHORT — maximum 15 comma-separated keywords.`
      : `This job description is reasonable. Do NOT use hidden/white-text keywords.
   Instead, ensure ALL important ATS keywords from the job description are incorporated into:
   - The skills section (add relevant skills/tools even if not in original CV, as long as plausible)
   - Bullet points (naturally weave in job description terminology)
   Set "ats_keywords" to an EMPTY array [].`;

  const prompt = `You are an expert resume consultant. Analyze the provided Master CV JSON against the Job Description and create a tailored resume that maximizes relevance.

CRITICAL 1-PAGE RESUME REQUIREMENT:
- TARGET ${TARGET_PAGE_USAGE_MIN}–${TARGET_PAGE_USAGE_MAX}% page usage — the resume MUST feel full, not sparse, while staying safely on one page
- Be selective: use at most ${TARGET_EXPERIENCE_ENTRIES} experience entries and at most ${TARGET_PROJECT_ENTRIES} project entries, then make those entries strong
- Use the deterministic selection plan below exactly; it is already capped at ${TARGET_EXPERIENCE_ENTRIES} experience entries and ${TARGET_PROJECT_ENTRIES} project entries, with each entry constrained to ${MIN_ENTRY_BULLETS}-${MAX_ENTRY_BULLETS} bullet points
- Do not add, remove, or substitute experience/project/qualification entries; improve bullet wording and skills inside the fixed plan
- Include ALL education entries (usually 1-2)
- Include ${targetQualifications} relevant certification, publication, or achievement entries from additional_qualifications when available
- Do NOT add extra experience or project entries to fill blank space; improve the selected entries with stronger, denser bullets and better skills coverage instead

BULLET WRITING RUBRIC (every bullet must follow this formula):
  Strong Action Verb + Technology/Stack Used + Technical Implementation Detail + Business/User Purpose + Measurable Impact
  Example of a WEAK bullet (do not write like this): "Developed a CRM/ERP system."
  Example of a STRONG bullet (write like this): "Engineered a comprehensive CRM and ERP system using the MERN stack, featuring modules for invoicing, project management, and recurring billing."
- Score every bullet against this quality bar: strong opening verb, source-backed technology inside the sentence, concrete implementation detail, business/user context, and metric/job-keyword signal where supported
- Open every bullet with a strong, senior-sounding engineering verb: Engineered, Architected, Designed, Optimized, Implemented, Integrated, Automated, Leveraged, Conducted, Spearheaded. NEVER open with weak/vague verbs like Worked, Helped, Was responsible for, Used, Assisted, Participated.
- Vary the opening verb across the whole resume — do not reuse the same opening verb for more than 2 bullets total; rotate verbs so the resume doesn't read repetitively
- Name the specific technology/tool/framework naturally INSIDE the sentence (not only in the heading or tech stack line), especially for project bullets
- Describe HOW it was technically implemented (architecture, approach, module, workflow, API, pipeline, dashboard, model, authentication, deployment), not just WHAT exists
- State WHY it matters — the business problem solved, the system it replaced, who used it, or the workflow/process it improved
- Include a measurable impact wherever the source facts support it (%, scale, user count, time saved) — but always with context, e.g. "75% efficiency improvement in grading and analytics" rather than a bare "75%"
- Every bullet must make the project/role read like production software built for real users, not a student assignment or feature list
- Keep lead bullets dense (${MIN_PRIMARY_BULLET_WORDS}-${MAX_BULLET_WORDS} words) and supporting bullets compact but complete (${MIN_SUPPORTING_BULLET_WORDS}-${MAX_BULLET_WORDS} words)
- Do NOT compress bullets into short fragments just to keep them on one line; prefer natural, complete resume sentences
- It is acceptable for the strongest bullets to wrap to a second line, but do not make every bullet long
- Never invent facts — only add technology names, purposes, or impacts that are grounded in this entry's Master CV source bullets
TWO-TO-THREE BULLET ENTRY RANGE:
- For every selected experience and project, review ALL original Master CV bullet points plus the job description
- Every selected experience and project entry MUST have at least ${MIN_ENTRY_BULLETS} and at most ${MAX_ENTRY_BULLETS} bullet points
- Choose the strongest ${MIN_ENTRY_BULLETS}-${MAX_ENTRY_BULLETS} resume bullets for that entry based on job relevance, measurable impact, recency, and keyword coverage
- These bullets may be copied exactly from the Master CV or rewritten/combined to better fit the job description
- Do not output a one-bullet entry; if facts are limited, create distinct bullets only from source-backed responsibilities, technologies, metadata, outcomes, or scope in that same Master CV entry
- Never output fewer than ${MIN_ENTRY_BULLETS} or more than ${MAX_ENTRY_BULLETS} bullet points for any single experience or project entry

FEATURED ENTRY REQUIREMENT:
- The first listed experience entry and first listed project entry are FEATURED / most important entries
- Each featured entry MUST have exactly ${FEATURED_ENTRY_BULLET_COUNT} bullet points
- Exactly ${FEATURED_ENTRY_MULTILINE_BULLETS} bullets in each featured entry must be multi-line bullets, meaning over about ${SINGLE_LINE_BULLET_CHAR_LIMIT} characters
- The remaining featured bullet must be a concise supporting bullet around ${SINGLE_LINE_BULLET_CHAR_LIMIT} characters or less
- Supporting/non-featured entries must still have at least ${MIN_ENTRY_BULLETS} bullets, but featured entries are required in both Experience and Projects whenever that section has selected entries
MULTI-LINE BULLET CAP:
- For every selected experience and project entry, at most ${MAX_ENTRY_MULTILINE_BULLETS} bullets may wrap across multiple lines
- A resume line fits about ${RESUME_LINE_CHAR_LIMIT} characters; because bullets are indented, treat ${SINGLE_LINE_BULLET_CHAR_LIMIT} characters as the safe single-line bullet limit
- If an entry has ${MAX_ENTRY_BULLETS} bullets, at least one bullet must be around ${SINGLE_LINE_BULLET_CHAR_LIMIT} characters or less so it stays on one line
- Use multi-line bullets only for the strongest, most relevant facts; keep supporting bullets direct and near ${SINGLE_LINE_BULLET_CHAR_LIMIT} characters

SOURCE-LOCKED PROJECT METADATA:
- Project name, technologies, dates, and demo_link are source-owned fields; copy them exactly from the Master CV for selected projects
- Do not shorten project names or alter technologies for layout. The renderer handles wrapped headings; you only select projects and choose/rewrite bullets

ATS KEYWORD STRATEGY:
${whiteTextInstructions}
- Extract ALL key technical skills, tools, frameworks from the job description
- Add these keywords to the appropriate skills subcategory (languages, frameworks, tools, libraries)
- Incorporate keywords naturally into bullet points where applicable

DETERMINISTIC SELECTION PLAN (FOLLOW EXACTLY):
${deterministicSelectionInstructions}

BLOCK-BASED SELECTION APPROACH:
- The Master CV contains ${totalBlocks} total blocks:
  * ${masterCV.education?.length || 0} education blocks
  * ${masterCV.experience?.length || 0} experience blocks
  * ${masterCV.projects?.length || 0} project blocks
  * ${qualificationEntries.length} certification, publication, or achievement blocks
- The application has already selected the most relevant blocks for this job, capped at ${TARGET_EXPERIENCE_ENTRIES} experience entries and ${TARGET_PROJECT_ENTRIES} project entries
- The deterministic plan is based on keyword matches, required skills, role/domain fit, recency, tags, and important flags
- If the job description is brief or generic, infer the intended role literally from it; for "web dev" or web developer resumes, prioritize web, frontend, backend, full-stack, React/Next.js, API, database, UI, dashboard, portal, CRM, ERP, and automation work
- Do NOT include data-science, ML, NLP, research, EEG, or media-bias entries for a web-dev resume unless the job description explicitly asks for those areas
- A dashboard or visualization mention alone is not enough to make an ML/NLP/data-science project relevant to web development
- IMPORTANT entries (important: true) are already included by the deterministic plan

SOURCE LOCK - NO HALLUCINATED STRUCTURED DATA:
- Experience, project, and additional qualification entries MUST come from the allowed source entries below
- Do not invent or modify structured metadata: experience role/company/location/dates; project name/technologies/dates/demo_link; qualification title/organization/date/link; education details; personal_info
- You may choose or rewrite bullet wording for relevance, but every rewritten bullet must be grounded in facts from that source entry in the Master CV
- The application copies source-owned metadata programmatically after generation; focus on selecting blocks, choosing bullets, rewriting bullets, and optimizing skills/keywords
${allowedSourceEntries}

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON, no markdown code blocks or explanations
2. Follow the deterministic selection plan exactly; never exceed ${TARGET_EXPERIENCE_ENTRIES} experience entries or ${TARGET_PROJECT_ENTRIES} project entries:
   a. Output exactly the listed experience, project, and additional qualification source entries
   b. Preserve the listed order within each section
   c. Do not add, remove, or substitute blocks
   d. Include ALL education blocks from the Master CV
3. For selected experience/project blocks, choose or rewrite the best ${MIN_ENTRY_BULLETS}-${MAX_ENTRY_BULLETS} bullets for the job description using complete, natural sentences
4. Keep every experience/project entry between ${MIN_ENTRY_BULLETS} and ${MAX_ENTRY_BULLETS} bullet points and at most ${MAX_ENTRY_MULTILINE_BULLETS} multi-line bullets; the first/featured experience and first/featured project must each have exactly ${FEATURED_ENTRY_BULLET_COUNT} bullets, exactly ${FEATURED_ENTRY_MULTILINE_BULLETS} of which are multi-line
5. Keep personal_info and education identical to Master CV
6. Preserve exact source metadata for selected experience, project, and additional qualification entries; do not invent or alter dates, titles, companies, locations, technologies, or links
7. Use exact same JSON structure as Master CV PLUS add "ats_keywords" array and "jd_quality" field
8. Ensure professional language, quantified achievements, and varied sentence lengths without inventing facts not present in the Master CV
9. For projects, choose based on relevance; do not change project names or technologies for layout
SELECTION CONSISTENCY RULES:
- Always use the deterministic selection plan above for identical input
- Do not improvise alternate blocks, even if another entry seems plausible
- If you need more relevance or page density, rewrite bullets within the selected source entries instead of changing the selection

OUTPUT JSON STRUCTURE:
{
  "personal_info": { ... },
  "education": [ ... ],
  "experience": [ ... ],
  "projects": [ ... ],
  "additional_qualifications": [ ... ],
  "skills": { ... },
  "ats_keywords": [...],
  "jd_quality": "${jdQuality}"
}

MASTER CV JSON:
${JSON.stringify(masterCV, null, 2)}

JOB DESCRIPTION:
${jobDescription}

OUTPUT (tailored 1-page resume as valid JSON):`;

  try {
    const generationConfig = TAILORED_RESUME_GENERATION_CONFIG;

    const result = await generate({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    allTokenUsages.push(extractTokenUsage(response));
    let text = response.text();
    let parsed = parseAIJson(text);

    // Validate structure
    if (!parsed.education) parsed.education = [];
    if (!parsed.experience) parsed.experience = [];
    if (!parsed.projects) parsed.projects = [];
    if (!parsed.additional_qualifications)
      parsed.additional_qualifications = [];
    if (!parsed.skills)
      parsed.skills = masterCV.skills || {
        languages: [],
        frameworks: [],
        tools: [],
        libraries: [],
      };
    if (!parsed.personal_info) parsed.personal_info = masterCV.personal_info;
    if (!parsed.ats_keywords) parsed.ats_keywords = [];
    parsed.jd_quality = jdQuality;
    parsed = reconcileTailoredCVWithMaster(parsed, masterCV);

    // ── Validation Loop ──────────────────────────────────────────────────
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const issues = [];

      // 1. Enforce source selection and per-entry bullet range
      issues.push(...getSourceSelectionIssues(parsed, masterCV));
      issues.push(...getSelectionPlanIssues(parsed, masterCV, selectionPlan));
      issues.push(...getEntryBulletMinimumIssues(parsed));
      issues.push(...getEntryBulletLimitIssues(parsed));
      issues.push(...getEntryMultilineBulletIssues(parsed));
      issues.push(...getFeaturedEntryIssues(parsed));
      issues.push(...getBulletQualityIssues(parsed, masterCV, selectionPlan.jobProfile));

      // 2. Check page fit
      const pageEstimate = estimatePageUsage(parsed);
      if (!pageEstimate.fits) {
        issues.push(
          `Resume exceeds 1 page (${pageEstimate.layoutUsagePercent || pageEstimate.usagePercent}% layout usage, ${pageEstimate.overflow} lines over). ` +
            `Shorten the longest lower-relevance bullets first; ` +
            `then shorten the longest low-relevance bullets while keeping each entry between ${MIN_ENTRY_BULLETS} and ${MAX_ENTRY_BULLETS} bullets.`,
        );
      } else if (pageEstimate.usagePercent > TARGET_PAGE_USAGE_MAX) {
        issues.push(
          `Resume is too close to the page limit at ${pageEstimate.usagePercent}% full (${pageEstimate.totalLines}/${pageEstimate.maxLines} lines). ` +
            `Target is ${TARGET_PAGE_USAGE_MIN}-${TARGET_PAGE_USAGE_MAX}% page usage. Shorten the longest low-relevance bullets or reduce low-value skills while preserving source accuracy and the deterministic selection plan.`,
        );
      } else if (pageEstimate.usagePercent < TARGET_PAGE_USAGE_MIN) {
        issues.push(
          `Resume is only ${pageEstimate.usagePercent}% full (${pageEstimate.totalLines}/${pageEstimate.maxLines} lines). ` +
            `Target is ${TARGET_PAGE_USAGE_MIN}-${TARGET_PAGE_USAGE_MAX}% page usage. Keep the deterministic selection plan exactly; ` +
            `expand selected high-value bullets with grounded scope, tooling, metrics, and job keywords while staying within ${TARGET_PAGE_USAGE_MAX}% usage.`,
        );
      }
      // 3. Project metadata is source-locked; page-fit estimation accounts for wrapped headings.

      // 4. If JD is not bad, ensure ats_keywords is empty
      if (jdQuality !== "bad" && parsed.ats_keywords?.length > 0) {
        issues.push(
          `This is a reasonable job description — do not use white-text keywords. ` +
            `Move ALL ats_keywords into the skills section instead, then set ats_keywords to [].`,
        );
      }

      if (issues.length === 0) break; // All good!

      // Re-prompt with correction
      const correctionPrompt = `The tailored resume JSON you generated has these issues that must be fixed:

${issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

Here are the allowed Master CV source entries:
${allowedSourceEntries}

Here is the deterministic selection plan to follow exactly:
${deterministicSelectionInstructions}

Here is the current JSON:
${JSON.stringify(parsed, null, 2)}

Fix ALL issues above and return the corrected JSON. Output ONLY valid JSON, no explanations.
Remember: follow the deterministic selection plan exactly; every experience/project/additional qualification entry must come from the allowed Master CV source entries, structured metadata is source-locked, every experience/project entry must have ${MIN_ENTRY_BULLETS}-${MAX_ENTRY_BULLETS} bullets and at most ${MAX_ENTRY_MULTILINE_BULLETS} multi-line bullets, and every chosen or rewritten bullet must be grounded in the matching source entry.
Every bullet must follow: Strong Action Verb + Technology Used + Technical Implementation + Business Purpose + Measurable Impact. Open with strong verbs (Engineered, Architected, Optimized, Implemented, Integrated, Automated, Leveraged, Conducted), never weak ones (Worked, Helped, Used, Assisted). Vary opening verbs — no verb should open more than ${MAX_REPEATED_OPENING_VERB} bullets. Primary bullets should be at least ${MIN_PRIMARY_BULLET_WORDS} words; supporting bullets should be at least ${MIN_SUPPORTING_BULLET_WORDS} words; no bullet should exceed ${MAX_BULLET_WORDS} words. A single-line supporting bullet should be around ${SINGLE_LINE_BULLET_CHAR_LIMIT} characters or less, and each entry must keep ${MIN_ENTRY_BULLETS}-${MAX_ENTRY_BULLETS} bullets with at most ${MAX_ENTRY_MULTILINE_BULLETS} bullets over that limit. The first experience and first project are featured entries and must each have exactly ${FEATURED_ENTRY_BULLET_COUNT} bullets, exactly ${FEATURED_ENTRY_MULTILINE_BULLETS} of them multi-line.
${jdQuality !== "bad" ? "ats_keywords MUST be an empty array []." : "ats_keywords must have at most 15 short keywords."}`;

      const fixResult = await generate({
        contents: [{ role: "user", parts: [{ text: correctionPrompt }] }],
        generationConfig,
      });

      const fixResponse = await fixResult.response;
      allTokenUsages.push(extractTokenUsage(fixResponse));
      const fixText = fixResponse.text();
      const fixParsed = parseAIJson(fixText);

      // Merge the fix back
      parsed = {
        ...fixParsed,
        personal_info: fixParsed.personal_info || parsed.personal_info,
        jd_quality: jdQuality,
      };
      if (!parsed.education) parsed.education = [];
      if (!parsed.experience) parsed.experience = [];
      if (!parsed.projects) parsed.projects = [];
      if (!parsed.additional_qualifications)
        parsed.additional_qualifications = [];
      if (!parsed.skills) parsed.skills = masterCV.skills || {};
      if (!parsed.ats_keywords) parsed.ats_keywords = [];
      parsed = reconcileTailoredCVWithMaster(parsed, masterCV);
    }

    parsed = reconcileTailoredCVWithMaster(parsed, masterCV);
    parsed = enforceDeterministicSelectionPlan(parsed, masterCV, selectionPlan);
    parsed = enforceEntryBulletMinimum(parsed, masterCV, selectionPlan.jobProfile);
    parsed = enforceEntryBulletLimit(parsed);
    parsed = enforceEntryMultilineBulletLimit(parsed, selectionPlan.jobProfile);
    parsed = compactResumeToTarget(parsed, masterCV, jobDescription, position);

    return { data: parsed, tokenUsage: mergeTokenUsage(...allTokenUsages) };
  } catch (error) {
    console.error("Error tailoring CV with Gemini:", error);
    rethrowIfApiKeyError(error);
    if (error?.status === 429) {
      throw new Error(
        "Rate limit exceeded. Please wait a moment and try again.",
      );
    }
    throw new Error("Failed to tailor CV. Please try again.");
  }
}

/**
 * Answer application questions using the Master CV, job description, and company info.
 * Returns an array of { question, answer } objects.
 */
export async function answerApplicationQuestions(
  masterCV,
  jobDescription,
  questions,
  companyInfo = "",
  apiKey,
) {
  const generate = createModelSelector(apiKey);

  const prompt = `You are an expert career coach helping a job applicant answer employer-specific application questions. Use the applicant's CV, the job description, and the company information to craft compelling, authentic answers.

APPLICANT CV:
${JSON.stringify(masterCV, null, 2)}

JOB DESCRIPTION:
${jobDescription}

${companyInfo ? `COMPANY INFORMATION (from their website/LinkedIn/etc):\n${companyInfo}\n` : ""}

QUESTIONS TO ANSWER:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

REQUIREMENTS:
1. Answer each question individually, drawing from the applicant's real experience and skills
2. Reference specific projects, achievements, or skills from the CV where relevant
3. If company info is provided, incorporate knowledge about the company (their mission, values, products, culture) into answers
4. Keep answers professional, concise, and specific (typically 3-6 sentences per answer)
5. Use a confident but genuine tone — avoid sounding generic or AI-generated
6. Quantify achievements where possible
7. Tailor each answer to show why this applicant is a great fit for THIS specific role at THIS company

OUTPUT FORMAT: Return ONLY a valid JSON array of objects with "question" and "answer" fields. No markdown, no code blocks.
Example: [{"question": "Why do you want to work here?", "answer": "..."}]`;

  try {
    const generationConfig = {
      temperature: 0.6,
      topP: 0.9,
    };

    const result = await generate({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    const tokenUsage = extractTokenUsage(response);
    let text = response.text().trim();

    text = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      throw new Error("Expected array of Q&A objects");
    }

    const data = parsed.map((item) => ({
      question: item.question || "",
      answer: item.answer || "",
    }));
    return { data, tokenUsage };
  } catch (error) {
    console.error("Error answering questions with Gemini:", error);
    rethrowIfApiKeyError(error);
    if (error?.status === 429) {
      throw new Error(
        "Rate limit exceeded. Please wait a moment and try again.",
      );
    }
    throw new Error("Failed to answer questions. Please try again.");
  }
}

/**
 * Quick-tailor an existing resume by ONLY editing the skills section and
 * ATS keywords for a new job description. The structure, experience, and
 * projects remain unchanged. Used for "primary" resumes that the user
 * wants to quickly adapt to a new application.
 */
export async function quickTailorKeywords(
  existingTailoredCV,
  jobDescription,
  apiKey,
  position = "",
) {
  const generate = createModelSelector(apiKey);
  const allTokenUsages = [];

  const jdQuality = assessJobDescriptionQuality(jobDescription, position);

  const whiteTextRule =
    jdQuality === "bad"
      ? `This JD has unrealistic requirements. Include up to 15 ats_keywords for white-text ATS.`
      : `This JD is reasonable. Set ats_keywords to []. Put ALL keywords in the skills section.`;

  const prompt = `You are an expert ATS optimization consultant. The user has a primary resume they are happy with.
Your ONLY job is to update the SKILLS section and ats_keywords for a new job application.

RULES:
1. Do NOT change personal_info, education, experience, or projects in ANY way
2. ONLY modify the "skills" object and "ats_keywords" array
3. Extract important technical keywords from the job description
4. Add relevant keywords to the appropriate skills subcategory (languages, frameworks, tools, libraries)
5. Keep existing skills that are relevant; you may remove ones that aren't in the JD to make room
6. ${whiteTextRule}
7. Output the COMPLETE CV JSON with only skills and ats_keywords changed

EXISTING TAILORED CV:
${JSON.stringify(existingTailoredCV, null, 2)}

NEW JOB DESCRIPTION:
${jobDescription}

OUTPUT (valid JSON only with ONLY skills and ats_keywords modified):`;

  try {
    const result = await generate({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, topP: 0.8 },
    });

    const response = await result.response;
    allTokenUsages.push(extractTokenUsage(response));
    const parsed = parseAIJson(response.text());

    // Enforce that only skills and ats_keywords changed
    const final = {
      ...existingTailoredCV,
      skills: parsed.skills || existingTailoredCV.skills,
      ats_keywords: parsed.ats_keywords || [],
      jd_quality: jdQuality,
    };

    return { data: final, tokenUsage: mergeTokenUsage(...allTokenUsages) };
  } catch (error) {
    console.error("Error quick-tailoring keywords:", error);
    rethrowIfApiKeyError(error);
    throw new Error("Failed to quick-tailor keywords. Please try again.");
  }
}

/**
 * Edit a Master CV using a natural language prompt from the user.
 * The AI modifies the specified sections based on the user's instructions.
 */
export async function editCVWithAI(existingCV, editPrompt, apiKey) {
  const generate = createModelSelector(apiKey);

  const prompt = `You are an expert resume editor. The user wants to modify their Master CV based on the following instruction.

INSTRUCTION FROM USER:
${editPrompt}

CURRENT CV JSON:
${JSON.stringify(existingCV, null, 2)}

RULES:
1. Output ONLY valid JSON, no markdown code blocks or explanations
2. Apply the user's requested changes accurately
3. Maintain the exact same JSON structure
4. Do NOT remove content unless the user explicitly asks to remove something
5. Preserve all existing entries unless the user says to change them
6. Maintain professional language and formatting standards
7. Keep the CV comprehensive — this is a Master CV, not a tailored resume

OUTPUT (updated CV as valid JSON):`;

  try {
    const result = await generate({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, topP: 0.9 },
    });

    const response = await result.response;
    const tokenUsage = extractTokenUsage(response);
    const parsed = parseAIJson(response.text());

    // Validate structure
    if (!parsed.education) parsed.education = existingCV.education || [];
    if (!parsed.experience) parsed.experience = existingCV.experience || [];
    if (!parsed.projects) parsed.projects = existingCV.projects || [];
    if (!parsed.additional_qualifications)
      parsed.additional_qualifications =
        existingCV.additional_qualifications || [];
    if (!parsed.skills)
      parsed.skills = existingCV.skills || {
        languages: [],
        frameworks: [],
        tools: [],
        libraries: [],
      };
    if (!parsed.personal_info) parsed.personal_info = existingCV.personal_info;

    return { data: parsed, tokenUsage };
  } catch (error) {
    console.error("Error editing CV with AI:", error);
    rethrowIfApiKeyError(error);
    throw new Error("Failed to edit CV. Please try again.");
  }
}
