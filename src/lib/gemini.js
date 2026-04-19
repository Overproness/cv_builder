import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  assessJobDescriptionQuality,
  checkProjectHeadingFit,
  countWords,
  estimatePageUsage,
  estimateRoomForMoreProjects,
} from "./layoutEstimation.js";

const MODEL_NAME = "gemini-3.1-flash-lite-preview";

// Pricing per 1M tokens (Gemini 2.0 Flash)
const PRICING = {
  inputPerMillion: 0.1,
  outputPerMillion: 0.4,
};

// Max validation retry attempts
const MAX_RETRIES = 2;

/**
 * Create a Gemini model instance from a user-provided API key
 */
function getModel(apiKey) {
  if (!apiKey) {
    throw new Error(
      "Gemini API key is required. Please add your API key in Settings.",
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: MODEL_NAME });
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
      "dates": "string"
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
  const model = getModel(apiKey);

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
    const result = await model.generateContent(prompt);
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
  const model = getModel(apiKey);

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
    const result = await model.generateContent(prompt);
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
  const model = getModel(apiKey);
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

    const result = await model.generateContent({
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

      const fixResult = await model.generateContent({
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
  const model = getModel(apiKey);
  const allTokenUsages = [];

  // Assess JD quality to determine keyword strategy
  const jdQuality = assessJobDescriptionQuality(jobDescription, position);

  // Count blocks in master CV for validation
  const totalBlocks =
    (masterCV.education?.length || 0) +
    (masterCV.experience?.length || 0) +
    (masterCV.projects?.length || 0);

  const { additionalProjects } = estimateRoomForMoreProjects({
    ...masterCV,
    experience: (masterCV.experience || []).slice(0, 3),
    projects: (masterCV.projects || []).slice(0, 2),
  });

  // Determine project count based on available space
  const targetProjects = Math.min(
    masterCV.projects?.length || 0,
    Math.max(2, 2 + additionalProjects),
  );

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
- Aim for MAXIMUM 400 words total (strict 1-page letter paper at 11pt)
- Be EXTREMELY selective — choose only the most impactful content
- Limit to 2-3 experience entries with MAXIMUM 2 bullet points each
- Include ${targetProjects} project entries with MAXIMUM 2 bullet points each
- Include ALL education entries (usually 1-2)
- Fewer, stronger bullet points are always better than more, weaker ones

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
- You must select the MOST RELEVANT blocks for this job
- Use CONSISTENT CRITERIA: relevance score based on keyword matches, required skills, and recency

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON, no markdown code blocks or explanations
2. Use a deterministic selection process:
   a. Score each experience/project block by counting keyword matches with job description
   b. Prioritize blocks with highest relevance scores
   c. Include ALL education blocks (always relevant)
   d. Include 2-3 experience blocks (select highest scoring)
   e. Include ${targetProjects} project blocks (select highest scoring)
3. For selected blocks, tailor bullet points to emphasize job-relevant keywords
4. LIMIT each experience/project to 2-3 most impactful bullet points only
5. Keep personal_info identical to Master CV
6. Preserve demo_link field for projects if present in Master CV
7. Use exact same JSON structure as Master CV PLUS add "ats_keywords" array and "jd_quality" field
8. Ensure professional language and quantified achievements

SELECTION CONSISTENCY RULES:
- Always select the SAME blocks when given identical input
- Base selection purely on keyword overlap and skill matches
- If two blocks have equal scores, prefer the more recent one
- Never randomly select - use deterministic scoring

OUTPUT JSON STRUCTURE:
{
  "personal_info": { ... },
  "education": [ ... ],
  "experience": [ ... ],
  "projects": [ ... ],
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

    const result = await model.generateContent({
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

      // 1. Check page fit
      const pageEstimate = estimatePageUsage(parsed);
      if (!pageEstimate.fits) {
        issues.push(
          `Resume exceeds 1 page (${pageEstimate.usagePercent}% full, ${pageEstimate.overflow} lines over). ` +
            `Reduce content: remove the least relevant bullet point from each experience/project, ` +
            `or remove the least relevant project entirely.`,
        );
      }

      // 2. Check project heading widths
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

      // 3. If JD is not bad, ensure ats_keywords is empty
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

Here is the current JSON:
${JSON.stringify(parsed, null, 2)}

Fix ALL issues above and return the corrected JSON. Output ONLY valid JSON, no explanations.
Remember: combined project name + technologies must be ≤ 78 characters each.
${jdQuality !== "bad" ? "ats_keywords MUST be an empty array []." : "ats_keywords must have at most 15 short keywords."}`;

      const fixResult = await model.generateContent({
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
      if (!parsed.ats_keywords) parsed.ats_keywords = [];
    }

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
  const model = getModel(apiKey);

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

    const result = await model.generateContent({
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
  const model = getModel(apiKey);
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
    const result = await model.generateContent({
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
  const model = getModel(apiKey);

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
    const result = await model.generateContent({
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
