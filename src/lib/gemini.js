import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  assessJobDescriptionQuality,
  checkProjectHeadingFit,
  countWords,
  estimateBulletLineCount,
  estimatePageUsage,
  estimateRoomForMoreProjects,
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
const TARGET_PAGE_USAGE_MIN = 95;
const TARGET_PAGE_USAGE_MAX = 99;
const MAX_ENTRY_MULTILINE_BULLETS = 2;

function isServiceUnavailable(error) {
  return (
    error?.status === 503 ||
    (error?.message || "").includes("503") ||
    (error?.message || "").includes("Service Unavailable") ||
    (error?.message || "").includes("high demand")
  );
}

function capEntriesForPlanning(entries = []) {
  return entries.map((entry) => ({
    ...entry,
    points: Array.isArray(entry.points)
      ? entry.points.slice(0, MAX_ENTRY_BULLETS)
      : [],
  }));
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

function getEntryMultilineBulletIssues(cvData) {
  const issues = [];
  const sections = [
    ["experience", cvData.experience || []],
    ["project", cvData.projects || []],
  ];

  for (const [sectionName, entries] of sections) {
    for (const entry of entries) {
      const points = Array.isArray(entry.points) ? entry.points : [];
      const multilineBullets = points
        .map((point, index) => ({
          index,
          lines: estimateBulletLineCount(point),
        }))
        .filter(({ lines }) => lines > 1);

      if (multilineBullets.length > MAX_ENTRY_MULTILINE_BULLETS) {
        const label = entry.role || entry.name || entry.company || "entry";
        const oneBasedIndexes = multilineBullets
          .map(({ index }) => index + 1)
          .join(", ");
        issues.push(
          `${sectionName} "${label}" has ${multilineBullets.length} bullets estimated to wrap across multiple lines ` +
            `(bullets ${oneBasedIndexes}); max is ${MAX_ENTRY_MULTILINE_BULLETS}. ` +
            `Keep only the strongest ${MAX_ENTRY_MULTILINE_BULLETS} bullets as multi-line bullets, and shorten the remaining supporting bullets so they fit on one line.`,
        );
      }
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

function findMatchingSourceEntry(entry, sourceEntries = [], sectionName) {
  let bestMatch = null;
  let bestScore = 0;

  for (const source of sourceEntries) {
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
      score = Math.max(
        sourceSimilarity(`${entry.role || ""} ${entry.company || ""}`, `${source.role || ""} ${source.company || ""}`),
        sourceSimilarity(entry.company, source.company),
      );
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = source;
    }
  }

  return bestScore >= 0.65 ? bestMatch : null;
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

  return `Allowed experience entries:\n${experience || "(none)"}\n\nAllowed project entries:\n${projects || "(none)"}`;
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

  return issues;
}

function enforceSourceSelection(cvData, masterCV) {
  const experience = (cvData.experience || []).filter((entry) =>
    findMatchingSourceEntry(entry, masterCV.experience || [], "experience"),
  );

  const projects = [];
  for (const project of cvData.projects || []) {
    const sourceProject = findMatchingSourceEntry(
      project,
      masterCV.projects || [],
      "projects",
    );
    if (!sourceProject) continue;

    const reconciledProject = { ...project };
    if (sourceProject.demo_link) {
      reconciledProject.demo_link = sourceProject.demo_link;
    } else {
      delete reconciledProject.demo_link;
    }
    projects.push(reconciledProject);
  }

  return {
    ...cvData,
    experience,
    projects,
  };
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
  return [
    entry.name,
    entry.role,
    entry.company,
    entry.technologies,
    ...(entry.tags || []),
    ...(entry.points || []),
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

function compactResumeToTarget(cvData, masterCV, jobDescription, position) {
  const targetMaxLines = estimatePageUsage(cvData).maxLines * (TARGET_PAGE_USAGE_MAX / 100);
  let compacted = { ...cvData };
  const jobProfile = getJobProfile(jobDescription, position);

  function scoreSelectedEntry(entry, sectionName) {
    const source = findMatchingSourceEntry(
      entry,
      masterCV[sectionName] || [],
      sectionName,
    );
    return scoreEntryForJob(source || entry, jobProfile);
  }

  while (estimatePageUsage(compacted).layoutLines > targetMaxLines) {
    const candidates = [];
    if ((compacted.projects || []).length > 1) {
      compacted.projects.forEach((entry, index) => {
        candidates.push({
          section: "projects",
          index,
          score: scoreSelectedEntry(entry, "projects"),
        });
      });
    }
    if ((compacted.experience || []).length > 1) {
      compacted.experience.forEach((entry, index) => {
        candidates.push({
          section: "experience",
          index,
          score: scoreSelectedEntry(entry, "experience"),
        });
      });
    }
    if ((compacted.additional_qualifications || []).length > 0) {
      compacted.additional_qualifications.forEach((entry, index) => {
        candidates.push({
          section: "additional_qualifications",
          index,
          score: scoreEntryForJob(entry, jobProfile) - 2,
        });
      });
    }

    if (candidates.length === 0) break;

    candidates.sort((a, b) => a.score - b.score);
    const remove = candidates[0];
    compacted = {
      ...compacted,
      [remove.section]: (compacted[remove.section] || []).filter(
        (_entry, index) => index !== remove.index,
      ),
    };
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

  const { additionalProjects, additionalExperience } =
    estimateRoomForMoreProjects({
      ...masterCV,
      experience: capEntriesForPlanning(masterCV.experience || []).slice(0, 2),
      projects: capEntriesForPlanning(masterCV.projects || []).slice(0, 2),
    });

  // Determine experience and project counts based on available space (target 99%).
  const targetExperience = Math.min(
    masterCV.experience?.length || 0,
    Math.max(2, 2 + additionalExperience),
  );

  // Determine project count based on available space
  const targetProjects = Math.min(
    masterCV.projects?.length || 0,
    Math.max(2, 2 + additionalProjects),
  );

  const targetQualifications = Math.min(
    qualificationEntries.length,
    3,
  );

  const allowedSourceEntries = formatAllowedSourceEntries(masterCV);

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
- Be selective but aim to MAXIMIZE relevant content within the 1-page limit
- Start with at least ${targetExperience} experience entries and ${targetProjects} project entries when available, with each entry capped at ${MAX_ENTRY_BULLETS} bullet points
- If the resume would land below ${TARGET_PAGE_USAGE_MIN}% page usage and more relevant source entries exist, add the next strongest experience/project/qualification entry before making existing bullets longer
- Include ALL education entries (usually 1-2)
- Include ${targetQualifications} relevant certification, publication, or achievement entries from additional_qualifications when available
- Adding more high-quality, job-relevant entries is better than leaving blank space, but relevance and one-page fit are more important than filling every possible line

BULLET LENGTH AND NATURALNESS:
- Do NOT compress every bullet into a short fragment just to keep it on one line
- Prefer natural, complete resume sentences with action, scope, method/tooling, and measurable result
- Strong/high-relevance bullets should often be 18-28 words; supporting bullets can be 12-18 words
- It is acceptable for the strongest bullets to wrap to a second line, but do not make every bullet long
- If the resume feels sparse, prefer adding another relevant source entry; expand selected bullets only after entry diversity is already strong

THREE-BULLET ENTRY CAP:
- For every selected experience and project, review ALL original Master CV bullet points plus the job description
- Choose the strongest ${MAX_ENTRY_BULLETS} resume bullets for that entry based on job relevance, measurable impact, recency, and keyword coverage
- These bullets may be copied exactly from the Master CV or rewritten/combined to better fit the job description
- If an original entry has fewer than ${MAX_ENTRY_BULLETS} meaningful source facts, use only the available meaningful bullets
- Never output more than ${MAX_ENTRY_BULLETS} bullet points for any single experience or project entry

MULTI-LINE BULLET CAP:
- For every selected experience and project entry, at most ${MAX_ENTRY_MULTILINE_BULLETS} bullets may wrap across multiple lines
- If an entry has ${MAX_ENTRY_BULLETS} bullets, keep at least one supporting bullet concise enough to fit on one line
- Use multi-line bullets only for the strongest, most relevant facts; keep supporting bullets direct so the resume can include more entries

PROJECT HEADING LINE-WIDTH CONSTRAINT:
- Each project has a "name" and "technologies" field displayed on the SAME LINE
- The combined character count of name + technologies MUST NOT exceed 78 characters
- If the project name is long, use FEWER technologies (pick only the 3-4 most relevant)
- If technologies are many, abbreviate the project name
- Example: "AbuBeast - Web3 Trading Platform" (33 chars) + "Next.js, React, Ethers.js" (25 chars) = 58 chars ✓
- Example BAD: "AbuBeast - Comprehensive Web3 Trading Platform" (47 chars) + "Next.js 15, React, Shadcn UI, TradingView, Ethers.js, Solana Web3.js" (68 chars) = 115 chars ✗ OVERFLOW!

ATS KEYWORD STRATEGY:
${whiteTextInstructions}
- Extract ALL key technical skills, tools, frameworks from the job description
- Add these keywords to the appropriate skills subcategory (languages, frameworks, tools, libraries)
- Incorporate keywords naturally into bullet points where applicable

BLOCK-BASED SELECTION APPROACH:
- The Master CV contains ${totalBlocks} total blocks:
  * ${masterCV.education?.length || 0} education blocks
  * ${masterCV.experience?.length || 0} experience blocks
  * ${masterCV.projects?.length || 0} project blocks
  * ${qualificationEntries.length} certification, publication, or achievement blocks
- You must select the MOST RELEVANT blocks for this job
- Use CONSISTENT CRITERIA: relevance score based on keyword matches, required skills, role/domain fit, recency, and tags
- If the job description is brief or generic, infer the intended role literally from it; for "web dev" or web developer resumes, prioritize web, frontend, backend, full-stack, React/Next.js, API, database, UI, dashboard, portal, CRM, ERP, and automation work
- Do NOT include data-science, ML, NLP, research, EEG, or media-bias entries for a web-dev resume unless the job description explicitly asks for those areas
- A dashboard or visualization mention alone is not enough to make an ML/NLP/data-science project relevant to web development
- IMPORTANT entries (important: true) MUST always be included regardless of relevance score

SOURCE LOCK - NO HALLUCINATED ENTRIES:
- Experience and project entries MUST come from the allowed source entries below; do not invent new roles, projects, repositories, links, tools, metrics, or product claims
- You may rewrite bullet wording for relevance, but every rewritten bullet must be grounded in facts from that source entry in the Master CV
- Project names may be lightly shortened for layout, but the project identity must clearly match a real Master CV project
- Preserve demo_link exactly from the Master CV when it exists; if the source project has no demo_link, omit demo_link entirely
- Never create GitHub/demo links that are not present in the source project
${allowedSourceEntries}

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON, no markdown code blocks or explanations
2. Use a deterministic selection process:
   a. Score each experience/project/additional qualification block by counting keyword matches with job description; use the entry's "tags" field as additional relevance signals
   b. IMPORTANT entries (important: true) always score highest — include them unconditionally
   c. Fill remaining slots with highest-scoring non-important blocks
   d. Include ALL education blocks (always relevant)
   e. Include at least ${targetExperience} experience blocks when available, then add more if needed to reach the page target without exceeding one page
   f. Include at least ${targetProjects} project blocks when available, then add more if needed to reach the page target without exceeding one page
   g. Include ${targetQualifications} additional_qualifications blocks total when available (important entries first)
3. For selected experience/project blocks, choose or rewrite the best ${MAX_ENTRY_BULLETS} bullets for the job description using complete, natural sentences
4. CAP every experience/project entry at ${MAX_ENTRY_BULLETS} bullet points and at most ${MAX_ENTRY_MULTILINE_BULLETS} multi-line bullets; do not preserve extra low-relevance bullets just because they exist in the Master CV
5. Keep personal_info identical to Master CV
6. Preserve demo_link field exactly from the matching Master CV project; do not invent or modify links
7. Use exact same JSON structure as Master CV PLUS add "ats_keywords" array and "jd_quality" field
8. Ensure professional language, quantified achievements, and varied sentence lengths without inventing facts not present in the Master CV
9. PROJECT TECH DUPLICATION: If a project's name already contains technology names as a subtitle (e.g. "ERP.js - MERN, Three.js, Tailwind"), do NOT repeat those same technologies in the technologies field. List only technologies that are NOT already visible in the project name.

SELECTION CONSISTENCY RULES:
- Always select the SAME blocks when given identical input
- Base selection purely on keyword overlap, tags, and skill matches
- IMPORTANT entries override scoring — always include them
- If two non-important blocks have equal scores, prefer the more recent one
- Never randomly select - use deterministic scoring

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
    const generationConfig = {
      temperature: 0.3,
      topP: 0.8,
      topK: 20,
    };

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

    // ── Validation Loop ──────────────────────────────────────────────────
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const issues = [];

      // 1. Enforce source selection and per-entry bullet cap
      issues.push(...getSourceSelectionIssues(parsed, masterCV));
      issues.push(...getEntryBulletLimitIssues(parsed));
      issues.push(...getEntryMultilineBulletIssues(parsed));

      // 2. Check page fit
      const pageEstimate = estimatePageUsage(parsed);
      if (!pageEstimate.fits) {
        issues.push(
          `Resume exceeds 1 page (${pageEstimate.layoutUsagePercent || pageEstimate.usagePercent}% layout usage, ${pageEstimate.overflow} lines over). ` +
            `Remove the least job-relevant project, experience, or qualification entry first; ` +
            `then shorten the longest low-relevance bullets while keeping each entry at no more than ${MAX_ENTRY_BULLETS} bullets.`,
        );
      } else if (pageEstimate.usagePercent > TARGET_PAGE_USAGE_MAX) {
        issues.push(
          `Resume is too close to the page limit at ${pageEstimate.usagePercent}% full (${pageEstimate.totalLines}/${pageEstimate.maxLines} lines). ` +
            `Target is ${TARGET_PAGE_USAGE_MIN}–${TARGET_PAGE_USAGE_MAX}% page usage. Remove the least job-relevant entry first, then slightly shorten the longest low-relevance bullets or reduce low-value skills while preserving source accuracy.`,
        );
      } else if (pageEstimate.usagePercent < TARGET_PAGE_USAGE_MIN) {
        const expCount = parsed.experience?.length || 0;
        const projCount = parsed.projects?.length || 0;
        const qualificationCount = parsed.additional_qualifications?.length || 0;
        const availableExperience = masterCV.experience?.length || 0;
        const availableProjects = masterCV.projects?.length || 0;
        const canAddExp = expCount < availableExperience;
        const canAddProj = projCount < availableProjects;
        const canAddQualifications =
          qualificationCount < targetQualifications;
        const suggestions = [];
        if (canAddExp) {
          const additionalExpCount = Math.min(
            Math.max(1, targetExperience - expCount),
            availableExperience - expCount,
          );
          suggestions.push(
            `add ${additionalExpCount} more high-relevance experience entry/entries from the Master CV if they keep the resume within ${TARGET_PAGE_USAGE_MAX}% usage`,
          );
        }
        if (canAddProj) {
          const additionalProjectCount = Math.min(
            Math.max(1, targetProjects - projCount),
            availableProjects - projCount,
          );
          suggestions.push(
            `add ${additionalProjectCount} more high-relevance project entry/entries from the Master CV if they keep the resume within ${TARGET_PAGE_USAGE_MAX}% usage`,
          );
        }
        if (canAddQualifications)
          suggestions.push(
            `add ${targetQualifications - qualificationCount} more relevant certification, publication, or achievement entry/entries from the Master CV`,
          );
        suggestions.push(
          `prefer adding another source entry before expanding existing bullets; if every relevant source entry is already included, expand only selected high-value bullets while keeping at most ${MAX_ENTRY_MULTILINE_BULLETS} multi-line bullets per entry`,
        );
        issues.push(
          `Resume is only ${pageEstimate.usagePercent}% full (${pageEstimate.totalLines}/${pageEstimate.maxLines} lines). ` +
            `Target is ${TARGET_PAGE_USAGE_MIN}–${TARGET_PAGE_USAGE_MAX}% page usage. To fill the page: ${suggestions.join("; ")}.`,
        );
      }

      // 3. Check project heading widths
      for (const proj of parsed.projects) {
        const headingCheck = checkProjectHeadingFit(
          proj.name,
          proj.technologies,
        );
        if (!headingCheck.fits) {
          issues.push(
            `Project "${proj.name}" heading overflows by ${headingCheck.overflow} chars ` +
              `(name: ${headingCheck.nameLen} + tech: ${headingCheck.techLen} = ${headingCheck.totalLen}, max ${headingCheck.budget}). ` +
              `Shorten the project name and/or reduce technologies to the 3-4 most relevant ones.`,
          );
        }
      }

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

Here is the current JSON:
${JSON.stringify(parsed, null, 2)}

Fix ALL issues above and return the corrected JSON. Output ONLY valid JSON, no explanations.
Remember: every experience/project entry must come from the allowed Master CV source entries, every project link must be preserved exactly from its source or omitted, every experience/project entry must have at most ${MAX_ENTRY_BULLETS} bullets and at most ${MAX_ENTRY_MULTILINE_BULLETS} multi-line bullets, choose the best grounded bullets for the job description, and keep combined project name + technologies ≤ 78 characters each.
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
    }

    parsed = enforceSourceSelection(parsed, masterCV);
    parsed = enforceEntryBulletLimit(parsed);
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
