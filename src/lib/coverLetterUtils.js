/**
 * Cover Letter Document Generation Utilities
 * Generates DOCX files from plain text cover letters using the docx package
 */

/**
 * Generate and download a DOCX version of the cover letter
 * @param {string} content - Plain text cover letter content
 * @param {string} filename - Output filename (without extension)
 */
export async function downloadCoverLetterAsDocx(content, filename = 'cover-letter') {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, convertInchesToTwip } =
    await import('docx');

  // Split content into paragraphs by double newlines or single newlines
  const rawParagraphs = content.split(/\n/).map((p) => p.trim());

  const docParagraphs = rawParagraphs.map((text) => {
    if (text === '') {
      // Empty paragraph as spacer
      return new Paragraph({ text: '', spacing: { after: 120 } });
    }

    return new Paragraph({
      children: [
        new TextRun({
          text,
          size: 24, // 12pt
          font: 'Calibri',
        }),
      ],
      spacing: { after: 120, line: 276 }, // 1.15 line spacing
    });
  });

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
          run: {
            font: 'Calibri',
            size: 24,
          },
          paragraph: {
            spacing: { after: 120 },
          },
        },
      },
    },
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download cover letter as plain text (.txt)
 */
export function downloadCoverLetterAsTxt(content, filename = 'cover-letter') {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Print / save as PDF via browser print dialog
 */
export function printCoverLetterAsPdf(content, applicantName = '') {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const htmlContent = content
    .split('\n')
    .map((line) =>
      line.trim() === '' ? '<br/>' : `<p style="margin:0 0 6px 0;">${escapeHtml(line)}</p>`
    )
    .join('');

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Cover Letter${applicantName ? ' - ' + applicantName : ''}</title>
  <style>
    body {
      font-family: Calibri, Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.4;
      margin: 1in 1.25in;
      color: #000;
    }
    p { margin: 0 0 8px 0; }
    @media print {
      body { margin: 0; padding: 1in 1.25in; }
    }
  </style>
</head>
<body>
  ${htmlContent}
  <script>window.onload = function() { window.print(); window.close(); }</script>
</body>
</html>`);
  printWindow.document.close();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
