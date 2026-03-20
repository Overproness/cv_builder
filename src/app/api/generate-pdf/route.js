import mongoose from "mongoose";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { generateCoverLetter, tailorCVForJob } from "@/lib/gemini";
import { generateLatex } from "@/lib/latex";
import CV from "@/models/CV";

function normalizeJobDescription(text) {
	return String(text || "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

function makeJobToken({ userId, jobDescription }) {
	const normalized = normalizeJobDescription(jobDescription);
	const base = `${String(userId)}|${normalized}`;
	let hash = 0;
	for (let i = 0; i < base.length; i += 1) {
		hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
	}
	return hash.toString(36);
}

function buildFilename({ kind, jobToken }) {
	return `${kind}-${jobToken}.pdf`;
}

function escapeLatex(text) {
	if (!text) return "";
	return String(text)
		.replace(/\\/g, "\\textbackslash{}")
		.replace(/&/g, "\\&")
		.replace(/%/g, "\\%")
		.replace(/\$/g, "\\$")
		.replace(/#/g, "\\#")
		.replace(/_/g, "\\_")
		.replace(/{/g, "\\{")
		.replace(/}/g, "\\}")
		.replace(/~/g, "\\textasciitilde{}")
		.replace(/\^/g, "\\textasciicircum{}");
}

function toParagraphs(text) {
	return String(text || "")
		.split(/\n\s*\n/g)
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => escapeLatex(p).replace(/\n/g, " "));
}

function buildCoverLetterSection({ body, personalInfo, company }) {
	const name = escapeLatex(personalInfo?.name || "Applicant");
	const email = escapeLatex(personalInfo?.email || "");
	const phone = escapeLatex(personalInfo?.phone || "");
	const org = escapeLatex(company || "Hiring Company");
	const lines = toParagraphs(body);
	const contactLine = [email, phone].filter(Boolean).join(" $|$ ");

	return `
\\newpage
\\section{Cover Letter}
\\noindent \\textbf{${name}}\\\\
${contactLine ? `\\small ${contactLine}\\\\` : ""}
\\vspace{1em}

\\noindent \\today\\\\
\\vspace{0.75em}

\\noindent Hiring Manager\\\\
\\noindent ${org}
\\vspace{1em}

\\noindent Dear Hiring Manager,
\\vspace{0.75em}

${lines.map((line) => `\\noindent ${line}\\par\\vspace{0.75em}`).join("\n")}

\\vspace{1em}
\\noindent Sincerely,\\\\
${name}
`;
}

function appendBeforeEndDocument(latex, section) {
	const marker = "\\end{document}";
	const idx = latex.lastIndexOf(marker);
	if (idx === -1) {
		throw new Error("Invalid LaTeX template: missing \\end{document}");
	}
	return `${latex.slice(0, idx)}${section}\n${marker}`;
}

function toBase64(arrayBuffer) {
	return Buffer.from(arrayBuffer).toString("base64");
}

function buildMultipartPdfResponse(parts) {
	const boundary = `pdf-boundary-${Date.now()}`;
	let body = "";

	for (const part of parts) {
		body += `--${boundary}\r\n`;
		body += "Content-Type: application/pdf\r\n";
		body += "Content-Transfer-Encoding: base64\r\n";
		body += `Content-Disposition: attachment; filename=\"${part.filename}\"\r\n\r\n`;
		body += `${toBase64(part.pdf)}\r\n`;
	}

	body += `--${boundary}--\r\n`;

	return new NextResponse(body, {
		status: 200,
		headers: {
			"Content-Type": `multipart/mixed; boundary=${boundary}`,
		},
	});
}

async function compileLatexToPdf(latex) {
	const serverUrl = process.env.LATEX_SERVER_URL;
	const apiKey = process.env.LATEX_SERVER_API_KEY;

	if (!serverUrl || !apiKey) {
		throw new Error(
			"LaTeX server is not configured. Set LATEX_SERVER_URL and LATEX_SERVER_API_KEY.",
		);
	}

	const response = await fetch(`${serverUrl}/compile`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-API-Key": apiKey,
		},
		body: JSON.stringify({ latex, compiler: "pdflatex" }),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error || `Compilation failed: ${response.status}`);
	}

	return await response.arrayBuffer();
}

function normalizeCV(cvDoc) {
	const cv = cvDoc?.toObject?.() || cvDoc;
	return {
		personal_info: cv.personal_info || {},
		education: cv.education || [],
		experience: cv.experience || [],
		projects: cv.projects || [],
		skills: cv.skills || {
			languages: [],
			frameworks: [],
			tools: [],
			libraries: [],
		},
	};
}

// POST /api/generate-pdf
// Body: {
//   userId | accountId,
//   output | type: "resume" | "both",
//   jobDescription,
//   tailorResume? (default: true)
// }
export async function POST(request) {
	try {
		const payload = await request.json();
		const {
			userId,
			accountId,
			output = "resume",
			type,
			jobDescription = "",
			tailorResume = true,
		} = payload || {};

		const resolvedUserId = userId || accountId;
		const resolvedOutput = type || output;

		if (!resolvedUserId) {
			return NextResponse.json(
				{ error: "userId (or accountId) is required" },
				{ status: 400 },
			);
		}

		if (!mongoose.Types.ObjectId.isValid(resolvedUserId)) {
			return NextResponse.json(
				{ error: "Invalid MongoDB userId" },
				{ status: 400 },
			);
		}

		if (!["resume", "both"].includes(resolvedOutput)) {
			return NextResponse.json(
				{ error: 'output must be either "resume" or "both"' },
				{ status: 400 },
			);
		}

		if (!jobDescription.trim()) {
			return NextResponse.json(
				{ error: "jobDescription is required" },
				{ status: 400 },
			);
		}

		await dbConnect();

		const cvDoc = await CV.findOne({ userId: resolvedUserId }).sort({
			updatedAt: -1,
		});
		if (!cvDoc) {
			return NextResponse.json(
				{ error: "No CV found for this userId" },
				{ status: 404 },
			);
		}

		const masterCV = normalizeCV(cvDoc);
		let resumeCV = masterCV;

		if (tailorResume && jobDescription.trim()) {
			try {
				resumeCV = await tailorCVForJob(masterCV, jobDescription);
			} catch (error) {
				console.warn("Tailoring failed, using master CV", error);
			}
		}

		const jobToken = makeJobToken({
			userId: resolvedUserId,
			jobDescription,
		});
		const resumeFileName = buildFilename({
			kind: "resume",
			jobToken,
		});

		const resumeLatex = generateLatex(resumeCV);
		const resumePdf = await compileLatexToPdf(resumeLatex);

		if (resolvedOutput === "both") {
			const coverBody = await generateCoverLetter(
				masterCV,
				jobDescription,
				"",
				"",
			);

			const coverSection = buildCoverLetterSection({
				body: coverBody,
				personalInfo: masterCV.personal_info,
				company: "",
			});

			const coverLetterLatex = appendBeforeEndDocument(
				generateLatex({
					personal_info: masterCV.personal_info,
					education: [],
					experience: [],
					projects: [],
					skills: {
						languages: [],
						frameworks: [],
						tools: [],
						libraries: [],
					},
				}),
				coverSection,
			);

			const coverLetterPdf = await compileLatexToPdf(coverLetterLatex);
			const coverLetterFileName = buildFilename({
				kind: "cover-letter",
				jobToken,
			});

			return buildMultipartPdfResponse([
				{ filename: resumeFileName, pdf: resumePdf },
				{ filename: coverLetterFileName, pdf: coverLetterPdf },
			]);
		}

		return new NextResponse(resumePdf, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${resumeFileName}"`,
			},
		});
	} catch (error) {
		console.error("generate-pdf API error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to generate PDF" },
			{ status: 500 },
		);
	}
}
    