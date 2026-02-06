import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY not set. AI features will not work.');
}

const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const model = genAI?.getGenerativeModel({ model: 'gemini-flash-latest' });

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
    throw new Error('Gemini API not configured. Please set GEMINI_API_KEY.');
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
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse and validate JSON
    const parsed = JSON.parse(text);
    
    // Validate that we have the expected structure
    if (!parsed.education) parsed.education = [];
    if (!parsed.experience) parsed.experience = [];
    if (!parsed.projects) parsed.projects = [];
    if (!parsed.skills) parsed.skills = { languages: [], frameworks: [], tools: [], libraries: [] };
    if (!parsed.personal_info) parsed.personal_info = {};
    
    return parsed;
  } catch (error) {
    console.error('Error parsing CV with Gemini:', error);
    throw new Error('Failed to parse CV. Please try again.');
  }
}

/**
 * Tailor a Master CV for a specific job description using block-based selection
 * This ensures consistent and deterministic results across multiple runs
 */
export async function tailorCVForJob(masterCV, jobDescription) {
  if (!model) {
    throw new Error('Gemini API not configured. Please set GEMINI_API_KEY.');
  }

  // Count blocks in master CV for validation
  const totalBlocks = (
    (masterCV.education?.length || 0) +
    (masterCV.experience?.length || 0) +
    (masterCV.projects?.length || 0)
  );

  const prompt = `You are an expert resume consultant. Analyze the provided Master CV JSON against the Job Description and create a tailored resume that maximizes relevance.

BLOCK-BASED SELECTION APPROACH:
- The Master CV contains ${totalBlocks} total blocks:
  * ${masterCV.education?.length || 0} education blocks
  * ${masterCV.experience?.length || 0} experience blocks
  * ${masterCV.projects?.length || 0} project blocks
- You must select the MOST RELEVANT blocks for this job
- Use CONSISTENT CRITERIA: relevance score based on keyword matches, required skills, and recency
- When given the same Master CV and Job Description, always select the same blocks

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON, no markdown code blocks or explanations
2. Use a deterministic selection process:
   a. Score each experience/project block by counting keyword matches with job description
   b. Prioritize blocks with highest relevance scores
   c. Include ALL education blocks (always relevant)
   d. Include 2-4 experience blocks (select highest scoring)
   e. Include 2-4 project blocks (select highest scoring)
3. For selected blocks, tailor bullet points to emphasize job-relevant keywords
4. Keep personal_info identical to Master CV
5. Maintain all bullet points for selected entries - do NOT truncate
6. Tailor skills section to highlight job-relevant skills while keeping all that match
7. Use exact same JSON structure as Master CV
8. Ensure professional language and quantified achievements

SELECTION CONSISTENCY RULES:
- Always select the SAME blocks when given identical input
- Base selection purely on keyword overlap and skill matches
- If two blocks have equal scores, prefer the more recent one
- Never randomly select - use deterministic scoring

MASTER CV JSON:
${JSON.stringify(masterCV, null, 2)}

JOB DESCRIPTION:
${jobDescription}

OUTPUT (tailored resume as valid JSON only with consistently selected blocks):`;

  try {
    // Use generation config for more deterministic output
    const generationConfig = {
      temperature: 0.3, // Lower temperature for more consistent results
      topP: 0.8,
      topK: 20,
    };
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });
    
    const response = await result.response;
    let text = response.text();
    
    // Clean up the response
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsed = JSON.parse(text);
    
    // Validate structure
    if (!parsed.education) parsed.education = [];
    if (!parsed.experience) parsed.experience = [];
    if (!parsed.projects) parsed.projects = [];
    if (!parsed.skills) parsed.skills = masterCV.skills || { languages: [], frameworks: [], tools: [], libraries: [] };
    if (!parsed.personal_info) parsed.personal_info = masterCV.personal_info;
    
    return parsed;
  } catch (error) {
    console.error('Error tailoring CV with Gemini:', error);
    throw new Error('Failed to tailor CV. Please try again.');
  }
}
