import { authedFetch } from "./auth.js";
import { flashFailureBadge, refreshBadge } from "./badge.js";
import { TERMINAL_STATUSES } from "./config.js";
import { addUnseenJobId, getCachedJobs, setCachedJob } from "./storage.js";

export async function dispatchJob(payload, { fake = false } = {}) {
  const qs = fake ? "?fake=true" : "";
  const res = await authedFetch(`/api/extension/dispatch${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Failed to dispatch job");
    err.code = data.code;
    err.deepLink = data.deepLink;
    throw err;
  }

  await setCachedJob(data.jobId, {
    id: data.jobId,
    status: data.status,
    initiatedAt: data.initiatedAt,
    company: payload.company || "",
    position: payload.position || "",
    wantCoverLetter: Boolean(payload.wantCoverLetter),
  });

  return data;
}

export async function fetchJobStatus(jobId) {
  const res = await authedFetch(`/api/extension/jobs/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch job status");
  return res.json();
}

export async function fetchJobs(cursor) {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const res = await authedFetch(`/api/extension/jobs${qs}`);
  if (!res.ok) throw new Error("Failed to fetch job history");
  return res.json();
}

export async function fetchCoverLetter(jobId) {
  const res = await authedFetch(
    `/api/extension/jobs/${jobId}/download?type=coverletter`,
  );
  if (!res.ok) throw new Error("Failed to fetch cover letter");
  return res.json();
}

export async function fetchCvs() {
  const res = await authedFetch("/api/extension/cvs");
  if (!res.ok) throw new Error("Failed to fetch Master CVs");
  return res.json();
}

function extractFilename(contentDisposition) {
  if (!contentDisposition) return null;
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match ? match[1] : null;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read PDF data"));
    reader.readAsDataURL(blob);
  });
}

async function fetchJobPdfAsDataUrl(jobId) {
  const res = await authedFetch(
    `/api/extension/jobs/${jobId}/download?type=pdf`,
  );
  if (!res.ok) throw new Error("Failed to fetch the compiled PDF");
  const blob = await res.blob();
  const filename =
    extractFilename(res.headers.get("content-disposition")) ||
    `resume-${jobId}.pdf`;
  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, filename };
}

// chrome.downloads.download and chrome.tabs.create both accept data: URLs
// for PDFs — Chrome's built-in viewer renders them natively when opened in
// a tab. This avoids the unreliable Blob-across-contexts message-passing
// that a naive sendResponse(blob) approach would run into in MV3.
export async function downloadJobPdf(jobId) {
  const { dataUrl, filename } = await fetchJobPdfAsDataUrl(jobId);
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
}

export async function openJobPdf(jobId) {
  const { dataUrl } = await fetchJobPdfAsDataUrl(jobId);
  await chrome.tabs.create({ url: dataUrl });
}

/**
 * Polls every non-terminal job in the local cache. Called both by the
 * recurring background alarm (popup closed) and directly by the popup's own
 * fast poll loop while it's open (see popup/popup.js).
 */
export async function pollPendingJobs() {
  const jobs = await getCachedJobs();
  const pendingIds = Object.values(jobs)
    .filter((j) => !TERMINAL_STATUSES.includes(j.status))
    .map((j) => j.id);

  if (pendingIds.length === 0) return;

  let anyFailed = false;
  await Promise.all(
    pendingIds.map(async (jobId) => {
      try {
        const status = await fetchJobStatus(jobId);
        const wasTerminal = TERMINAL_STATUSES.includes(jobs[jobId]?.status);
        await setCachedJob(jobId, status);
        if (!wasTerminal && TERMINAL_STATUSES.includes(status.status)) {
          await addUnseenJobId(jobId);
          if (status.status === "failed") anyFailed = true;
        }
      } catch {
        // Transient network error — leave cached status as-is, next poll retries.
      }
    }),
  );

  if (anyFailed) {
    await flashFailureBadge();
  } else {
    await refreshBadge();
  }
}
