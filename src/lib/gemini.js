import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("Warning: GEMINI_API_KEY not set. AI features will not work.");
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const model = genAI?.getGenerativeModel({ model: "gemini-flash-latest" });

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
export async function parseRawTextToCV(rawText) {
  if (!model) {
    throw new Error("Gemini API not configured. Please set GEMINI_API_KEY.");
  }

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

    return parsed;
  } catch (error) {
    console.error("Error parsing CV with Gemini:", error);
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
) {
  if (!model) {
    throw new Error("Gemini API not configured. Please set GEMINI_API_KEY.");
  }

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

    return parsed;
  } catch (error) {
    console.error("Error adding content to CV with Gemini:", error);
    throw new Error("Failed to add content to CV. Please try again.");
  }
}

/**
 * Tailor a Master CV for a specific job description using block-based selection
 * This ensures consistent and deterministic results across multiple runs
 */
export async function tailorCVForJob(masterCV, jobDescription) {
  if (!model) {
    throw new Error("Gemini API not configured. Please set GEMINI_API_KEY.");
  }

  // Count blocks in master CV for validation
  const totalBlocks =
    (masterCV.education?.length || 0) +
    (masterCV.experience?.length || 0) +
    (masterCV.projects?.length || 0);

  const prompt = `You are an expert resume consultant. Analyze the provided Master CV JSON against the Job Description and create a tailored resume that maximizes relevance.

CRITICAL 1-PAGE RESUME REQUIREMENT:
- Aim for approximately 400-450 words total (typical 1-page resume length)
- Be HIGHLY selective with content - quality over quantity
- Limit to 2-3 experience entries with 2-3 bullet points each
- Limit to 2-3 project entries with 2-3 bullet points each  
- Include ALL education entries (usually 1-2)
- Prioritize most impactful and relevant content only

ATS KEYWORD OPTIMIZATION:
1. Extract key technical skills, tools, frameworks, and buzzwords from the job description
2. Incorporate these keywords naturally into bullet points where applicable
3. Add relevant keywords to the skills section even if not in original CV (if the candidate could reasonably have that skill based on their experience)
4. Maintain authenticity - don't add false claims, but optimize language to match job requirements

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
   e. Include 2-3 project blocks (select highest scoring)
3. For selected blocks, tailor bullet points to emphasize job-relevant keywords
4. LIMIT each experience/project to 2-3 most impactful bullet points only
5. Keep personal_info identical to Master CV
6. Preserve demo_link field for projects if present in Master CV
7. Tailor skills section to highlight job-relevant skills, adding keywords from job description
8. Use exact same JSON structure as Master CV
9. Ensure professional language and quantified achievements

SELECTION CONSISTENCY RULES:
- Always select the SAME blocks when given identical input
- Base selection purely on keyword overlap and skill matches
- If two blocks have equal scores, prefer the more recent one
- Never randomly select - use deterministic scoring

MASTER CV JSON:
${JSON.stringify(masterCV, null, 2)}

JOB DESCRIPTION:
${jobDescription}

OUTPUT (tailored 1-page resume as valid JSON with ATS keywords and demo links preserved):`;

  try {
    // Use generation config for more deterministic output
    const generationConfig = {
      temperature: 0.3, // Lower temperature for more consistent results
      topP: 0.8,
      topK: 20,
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    let text = response.text();

    // Clean up the response
    text = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(text);

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

    return parsed;
  } catch (error) {
    console.error("Error tailoring CV with Gemini:", error);
    throw new Error("Failed to tailor CV. Please try again.");
  }
}
