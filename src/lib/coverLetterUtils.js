/**
 * Cover Letter Document Generation Utilities
 *
 * The cover letter content is stored as a plain-text assembled letter with a
 * recognisable structure (see assembleCoverLetter). These utilities parse that
 * structure and produce nicely-formatted DOCX and HTML/PDF outputs.
 */

// ─── Date helper (no AI, always accurate) ───────────────────────────────────

/**
 * Returns today's date formatted as "Month DD, YYYY" using the browser's JS engine.
 */
export function getTodayFormatted() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Assembly ────────────────────────────────────────────────────────────────

/**
 * Assemble a full cover letter from its constituent parts.
 *
 * @param {Object} params
 * @param {string} params.name    - Applicant's full name
 * @param {string} params.email   - Applicant's email
 * @param {string} params.phone   - Applicant's phone
 * @param {string} params.company - Target company name
 * @param {string} params.body    - AI-generated body paragraphs (plain text, paragraphs separated by \n\n)
 * @returns {string} Full assembled plain-text cover letter
 */
export function assembleCoverLetter({ name, email, phone, company, body }) {
  const date = getTodayFormatted();

  const contactLines = [];
  if (email) contactLines.push(`Email: ${email}`);
  if (phone) contactLines.push(`Phone: ${phone}`);

  const parts = [
    name || "Applicant",
    "",
    contactLines.join("\n"),
    "",
    date,
    "",
    company || "",
    "",
    "Dear Hiring Manager,",
    "",
    body.trim(),
    "",
    "Sincerely,",
    name || "Applicant",
  ];

  return parts.join("\n");
}

// ─── DOCX Generation ─────────────────────────────────────────────────────────

/**
 * Generate and download a DOCX version of the assembled cover letter.
 * @param {string} content  - Full assembled plain-text cover letter
 * @param {string} filename - Output filename without extension
 */
export async function downloadCoverLetterAsDocx(
  content,
  filename = "cover-letter",
) {
  const { Document, Packer, Paragraph, TextRun, convertInchesToTwip } =
    await import("docx");

  const lines = content.split("\n");
  const docParagraphs = [];

  let zone = "header-name";
  let seenContactBlock = false;
  let seenDear = false;
  let seenSincerely = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Detect zone transitions
    if (/^Dear Hiring Manager/i.test(trimmed)) {
      zone = "body";
      seenDear = true;
    } else if (/^Sincerely[,.]?$/i.test(trimmed)) {
      seenSincerely = true;
      zone = "footer";
    }

    // ── Applicant name (first non-blank line) ──────────────────────────────
    if (zone === "header-name") {
      if (trimmed === "") {
        docParagraphs.push(new Paragraph({ text: "", spacing: { after: 40 } }));
      } else {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                bold: true,
                size: 36,
                font: "Calibri",
              }),
            ],
            spacing: { after: 60 },
          }),
        );
        zone = "header-contact";
      }
      continue;
    }

    // ── Contact info + date + company ────────────────────────────────────
    if (zone === "header-contact") {
      if (trimmed === "") {
        docParagraphs.push(new Paragraph({ text: "", spacing: { after: 80 } }));
      } else {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                size: 22,
                font: "Calibri",
                color: "555555",
              }),
            ],
            spacing: { after: 60 },
          }),
        );
      }
      continue;
    }

    // ── Letter body ───────────────────────────────────────────────────────
    if (zone === "body") {
      if (trimmed === "") {
        docParagraphs.push(new Paragraph({ text: "", spacing: { after: 80 } }));
      } else {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: trimmed, size: 24, font: "Calibri" }),
            ],
            spacing: { after: 100, line: 276 },
          }),
        );
      }
      continue;
    }

    // ── Footer (Sincerely + name) ─────────────────────────────────────────
    if (zone === "footer") {
      if (trimmed === "") {
        docParagraphs.push(new Paragraph({ text: "", spacing: { after: 60 } }));
      } else {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: trimmed, size: 24, font: "Calibri" }),
            ],
            spacing: { after: 80 },
          }),
        );
      }
      continue;
    }

    // Fallback
    docParagraphs.push(
      trimmed === ""
        ? new Paragraph({ text: "", spacing: { after: 80 } })
        : new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                size: 22,
                font: "Calibri",
                color: "555555",
              }),
            ],
            spacing: { after: 60 },
          }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
              right: convertInchesToTwip(1.25),
            },
          },
        },
        children: docParagraphs,
      },
    ],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 24 },
          paragraph: { spacing: { after: 80 } },
        },
      },
    },
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── HTML Rendering ──────────────────────────────────────────────────────────

/**
 * Render the cover letter as a styled HTML document.
 * Parses the plain-text assembled letter and applies proper visual structure.
 *
 * @param {string} content  - Full assembled plain-text cover letter
 * @param {boolean} isDark  - Use dark background
 * @returns {string} Full HTML document string
 */
export function renderCoverLetterHtml(content, isDark = false) {
  const lines = content.split("\n");

  let nameHtml = "";
  let contactHtml = [];
  let preDateLines = [];
  let letterBodyLines = [];
  let footerLines = [];

  let zone = "name";
  let seenContactBlock = false;

  for (const line of lines) {
    const t = line.trim();

    if (zone === "name") {
      if (t) {
        nameHtml = escapeHtml(t);
        zone = "contact";
      }
      continue;
    }

    if (zone === "contact") {
      if (/^Dear Hiring Manager/i.test(t)) {
        zone = "letter";
        letterBodyLines.push(t);
        continue;
      }
      if (t.startsWith("Email:") || t.startsWith("Phone:")) {
        contactHtml.push(escapeHtml(t));
        seenContactBlock = true;
        continue;
      }
      if (t !== "") {
        preDateLines.push(escapeHtml(t));
      }
      continue;
    }

    if (zone === "letter") {
      if (/^Sincerely[,.]?$/i.test(t)) {
        zone = "footer";
        footerLines.push(t);
        continue;
      }
      letterBodyLines.push(t);
      continue;
    }

    if (zone === "footer") {
      footerLines.push(t);
    }
  }

  // Build letter body HTML
  const letterHtml = letterBodyLines
    .join("\n")
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      return `<p>${escapeHtml(trimmed).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");

  const footerHtml = footerLines
    .map((l) => (l.trim() ? `<p class="footer-line">${escapeHtml(l)}</p>` : ""))
    .join("");

  const bg = isDark ? "#1a1a2e" : "#ffffff";
  const textColor = isDark ? "#e2e2e2" : "#1a1a1a";
  const subColor = isDark ? "#aaaaaa" : "#555555";
  const dividerColor = isDark ? "#444444" : "#cccccc";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Cover Letter</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.55;
      color: ${textColor};
      background: ${bg};
    }
    .page { max-width: 720px; margin: 0 auto; padding: 1in 1.25in; }
    .cl-name { font-size: 20pt; font-weight: 700; margin-bottom: 5px; }
    .cl-contact { font-size: 10.5pt; color: ${subColor}; line-height: 1.7; }
    .cl-divider { border: none; border-top: 1.5px solid ${dividerColor}; margin: 12px 0 18px; }
    .pre-body p { margin-bottom: 4px; font-size: 11pt; }
    .letter-body { margin-top: 16px; }
    .letter-body p { margin-bottom: 12px; text-align: justify; }
    .cl-footer { margin-top: 28px; }
    .cl-footer .footer-line { margin-bottom: 2px; }
    @media print {
      html, body { background: #fff; color: #000; }
      .page { padding: 0.75in 1in; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="cl-name">${nameHtml}</div>
    ${contactHtml.map((c) => `<div class="cl-contact">${c}</div>`).join("")}
    <hr class="cl-divider" />
    <div class="pre-body">
      ${preDateLines.map((l) => `<p>${l}</p>`).join("")}
    </div>
    <div class="letter-body">
      ${letterHtml}
    </div>
    <div class="cl-footer">
      ${footerHtml}
    </div>
  </div>
</body>
</html>`;
}

// ─── Print / PDF ─────────────────────────────────────────────────────────────

/**
 * Print / save as PDF via browser print dialog.
 */
export function printCoverLetterAsPdf(content) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(renderCoverLetterHtml(content, false));
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}

// ─── Plain text download ─────────────────────────────────────────────────────

export function downloadCoverLetterAsTxt(content, filename = "cover-letter") {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
