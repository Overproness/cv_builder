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
 * Parse raw text (resume/CV dump) into structured JSON
 */
export async function parseRawTextToCV(rawText) {
  if (!model) {
    throw new Error('Gemini API not configured. Please set GEMINI_API_KEY.');
  }

  const prompt = `You are an expert resume parser. Extract the user's professional information from the following raw text and structure it into a clean JSON format.

IMPORTANT RULES:
1. Output ONLY valid JSON, no markdown code blocks or explanations
2. Clean up grammar and phrasing to be professional
3. Use action verbs at the start of bullet points (e.g., "Developed", "Implemented", "Led")
4. Quantify achievements where possible
5. If a field is not found in the text, use an empty string or empty array
6. For skills, categorize them appropriately into languages, frameworks, tools, and libraries

OUTPUT JSON SCHEMA:
${CV_SCHEMA}

RAW TEXT TO PARSE:
${rawText}

OUTPUT (valid JSON only):`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up the response - remove markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse and validate JSON
    const parsed = JSON.parse(text);
    return parsed;
  } catch (error) {
    console.error('Error parsing CV with Gemini:', error);
    throw new Error('Failed to parse CV. Please try again.');
  }
}

/**
 * Tailor a Master CV for a specific job description
 */
export async function tailorCVForJob(masterCV, jobDescription) {
  if (!model) {
    throw new Error('Gemini API not configured. Please set GEMINI_API_KEY.');
  }

  const prompt = `You are an expert resume consultant. Analyze the provided Master CV JSON against the Job Description and create a tailored resume that maximizes relevance.

IMPORTANT RULES:
1. Output ONLY valid JSON, no markdown code blocks or explanations
2. Select ONLY the most relevant experiences, projects, and skills for this specific job
3. Rephrase bullet points to highlight keywords found in the job description
4. Keep the same JSON structure as the input
5. Prioritize recent and relevant experience
6. Include 2-4 experience entries maximum
7. Include 2-3 project entries maximum
8. Tailor skills to match job requirements while remaining truthful
9. Maintain professional language and quantified achievements

MASTER CV JSON:
${JSON.stringify(masterCV, null, 2)}

JOB DESCRIPTION:
${jobDescription}

OUTPUT (tailored resume as valid JSON only):`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up the response
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsed = JSON.parse(text);
    return parsed;
  } catch (error) {
    console.error('Error tailoring CV with Gemini:', error);
    throw new Error('Failed to tailor CV. Please try again.');
  }
}
