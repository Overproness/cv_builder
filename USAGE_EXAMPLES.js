/**
 * EXAMPLE: How to use the new features
 */

// Example 1: CV with demo links
const cvWithDemoLinks = {
  personal_info: {
    name: "John Doe",
    email: "john@example.com",
    github: "github.com/johndoe",
  },
  projects: [
    {
      name: "E-commerce Platform",
      technologies: "React, Node.js, PostgreSQL",
      dates: "2024",
      demo_link: "https://myshop.com", // ← NEW: Demo link field
      points: [
        "Built full-stack shopping platform with payment integration",
        "Implemented real-time inventory management",
      ],
    },
  ],
  experience: [],
  education: [],
  skills: {
    languages: ["JavaScript", "Python"],
    frameworks: ["React", "Node.js"],
    tools: ["Git", "Docker"],
    libraries: [],
  },
};

// Example 2: Add new experience to existing CV
const newExperience = `
Senior Software Engineer at Microsoft (Jan 2025 - Present)
Seattle, WA
- Led team of 5 engineers building cloud infrastructure
- Reduced deployment time by 40% using Kubernetes
- Implemented CI/CD pipeline serving 100K+ requests/day
`;

// API call to add this to existing CV
// POST /api/resume/add
// Body: { existingCV: cv, newContent: newExperience, contentType: 'auto' }

// Example 3: Job description for tailoring (with ATS keywords)
const jobDescription = `
We are looking for a Senior Backend Engineer with experience in:
- Kubernetes and container orchestration
- Microservices architecture  
- AWS cloud infrastructure
- Python and Go
- CI/CD pipelines
- High-scale distributed systems (10M+ users)
`;

// The AI will:
// 1. Extract keywords: Kubernetes, microservices, AWS, Python, Go, CI/CD, distributed systems
// 2. Select 2-3 most relevant experiences
// 3. Select 2-3 most relevant projects
// 4. Limit each to 2-3 bullet points
// 5. Incorporate keywords naturally into bullet points
// 6. Add keywords to skills section if applicable
// 7. Keep only content that fits on 1 page (~400-450 words)

// Example 4: Resulting LaTeX with demo link
const latexOutput = `
\\section{Projects}
    \\resumeSubHeadingListStart
      \\resumeProjectHeading
          {\\textbf{\\href{https://myshop.com}{E-commerce Platform}}}{2024}
          \\small{\\emph{React, Node.js, PostgreSQL}}
          \\resumeItemListStart
            \\resumeItem{Built full-stack shopping platform with payment integration}
            \\resumeItem{Implemented real-time inventory management}
          \\resumeItemListEnd
    \\resumeSubHeadingListEnd
`;

// Note:
// - Project name is now a hyperlink (clickable in PDF)
// - No \vspace{-7pt} between project heading and technologies
// - Only 2 bullet points (enforcing 1-page limit)
