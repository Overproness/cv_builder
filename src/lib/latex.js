/**
 * Jake's Resume LaTeX Template Generator
 * Converts CV JSON to LaTeX format
 */

// Escape special LaTeX characters
function escapeLatex(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

// Generate the LaTeX preamble with Jake's Resume macros
function generatePreamble() {
  return `\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}

%----------FONT OPTIONS----------
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Adjust margins
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Sections formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\\pdfgentounicode=1

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------
`;
}

// Generate heading section
function generateHeading(personalInfo) {
  const { name, phone, email, linkedin, github, website } = personalInfo || {};
  
  let contacts = [];
  if (phone) contacts.push(escapeLatex(phone));
  if (email) contacts.push(`\\href{mailto:${email}}{\\underline{${escapeLatex(email)}}}`);
  if (linkedin) {
    const linkedinUrl = linkedin.startsWith('http') ? linkedin : `https://${linkedin}`;
    const linkedinDisplay = linkedin.replace(/^https?:\/\//, '');
    contacts.push(`\\href{${linkedinUrl}}{\\underline{${escapeLatex(linkedinDisplay)}}}`);
  }
  if (github) {
    const githubUrl = github.startsWith('http') ? github : `https://${github}`;
    const githubDisplay = github.replace(/^https?:\/\//, '');
    contacts.push(`\\href{${githubUrl}}{\\underline{${escapeLatex(githubDisplay)}}}`);
  }
  if (website) {
    const websiteUrl = website.startsWith('http') ? website : `https://${website}`;
    contacts.push(`\\href{${websiteUrl}}{\\underline{${escapeLatex(website.replace(/^https?:\/\//, ''))}}}`);
  }

  return `\\begin{document}

%----------HEADING----------
\\begin{center}
    \\textbf{\\Huge \\scshape ${escapeLatex(name || 'Your Name')}} \\\\ \\vspace{1pt}
    \\small ${contacts.join(' $|$ ')}
\\end{center}

`;
}

// Generate education section
function generateEducation(education) {
  if (!education || education.length === 0) return '';

  let section = `%-----------EDUCATION-----------
\\section{Education}
  \\resumeSubHeadingListStart
`;

  for (const edu of education) {
    section += `    \\resumeSubheading
      {${escapeLatex(edu.institution || '')}}{${escapeLatex(edu.location || '')}}
      {${escapeLatex(edu.degree || '')}}{${escapeLatex(edu.dates || '')}}
`;
  }

  section += `  \\resumeSubHeadingListEnd

`;
  return section;
}

// Generate experience section
function generateExperience(experience) {
  if (!experience || experience.length === 0) return '';

  let section = `%-----------EXPERIENCE-----------
\\section{Experience}
  \\resumeSubHeadingListStart
`;

  for (const exp of experience) {
    section += `
    \\resumeSubheading
      {${escapeLatex(exp.role || '')}}{${escapeLatex(exp.dates || '')}}
      {${escapeLatex(exp.company || '')}}{${escapeLatex(exp.location || '')}}
      \\resumeItemListStart
`;
    
    for (const point of (exp.points || [])) {
      section += `        \\resumeItem{${escapeLatex(point)}}
`;
    }
    
    section += `      \\resumeItemListEnd
`;
  }

  section += `
  \\resumeSubHeadingListEnd

`;
  return section;
}

// Generate projects section
function generateProjects(projects) {
  if (!projects || projects.length === 0) return '';

  let section = `%-----------PROJECTS-----------
\\section{Projects}
    \\resumeSubHeadingListStart
`;

  for (const proj of projects) {
    section += `      \\resumeProjectHeading
          {\\textbf{${escapeLatex(proj.name || '')}} $|$ \\emph{${escapeLatex(proj.technologies || '')}}}{${escapeLatex(proj.dates || '')}}
          \\resumeItemListStart
`;
    
    for (const point of (proj.points || [])) {
      section += `            \\resumeItem{${escapeLatex(point)}}
`;
    }
    
    section += `          \\resumeItemListEnd
`;
  }

  section += `    \\resumeSubHeadingListEnd

`;
  return section;
}

// Generate skills section
function generateSkills(skills) {
  if (!skills) return '';

  const { languages, frameworks, tools, libraries } = skills;
  
  let skillLines = [];
  if (languages?.length) skillLines.push(`\\textbf{Languages}{: ${escapeLatex(languages.join(', '))}}`);
  if (frameworks?.length) skillLines.push(`\\textbf{Frameworks}{: ${escapeLatex(frameworks.join(', '))}}`);
  if (tools?.length) skillLines.push(`\\textbf{Developer Tools}{: ${escapeLatex(tools.join(', '))}}`);
  if (libraries?.length) skillLines.push(`\\textbf{Libraries}{: ${escapeLatex(libraries.join(', '))}}`);

  if (skillLines.length === 0) return '';

  return `%-----------TECHNICAL SKILLS-----------
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
     ${skillLines.join(' \\\\\n     ')}
    }}
 \\end{itemize}

`;
}

/**
 * Convert CV JSON to complete LaTeX document
 */
export function generateLatex(cvData) {
  let latex = generatePreamble();
  latex += generateHeading(cvData.personal_info);
  latex += generateEducation(cvData.education);
  latex += generateExperience(cvData.experience);
  latex += generateProjects(cvData.projects);
  latex += generateSkills(cvData.skills);
  latex += `%-------------------------------------------
\\end{document}`;

  return latex;
}

/**
 * Get an empty CV template
 */
export function getEmptyCVTemplate() {
  return {
    personal_info: {
      name: '',
      phone: '',
      email: '',
      linkedin: '',
      github: '',
      website: ''
    },
    education: [],
    experience: [],
    projects: [],
    skills: {
      languages: [],
      frameworks: [],
      tools: [],
      libraries: []
    }
  };
}
