import { WEB_APP_ORIGIN } from "../background/config.js";

function callBackground(action, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error("No response from the extension background."));
        return;
      }
      if (!response.ok) {
        const err = new Error(
          response.message || response.error || "Unknown error",
        );
        err.code = response.error;
        err.deepLink = response.deepLink;
        reject(err);
        return;
      }
      resolve(response.data);
    });
  });
}

const el = (id) => document.getElementById(id);

const loggedOutView = el("logged-out-view");
const loggedInView = el("logged-in-view");
const accountArea = el("account-area");
const loginBtn = el("login-btn");
const loginError = el("login-error");
const bannerDetected = el("banner-detected");
const bannerGenerateBtn = el("banner-generate-btn");
const bannerGenerateBtnLabel = el("banner-generate-btn-label");
const deepLinkNotice = el("deep-link-notice");
const deepLinkText = el("deep-link-text");
const deepLinkBtn = el("deep-link-btn");
const pasteForm = el("paste-form");
const jdTextarea = el("jd-textarea");
const companyInput = el("company-input");
const positionInput = el("position-input");
const cvSelect = el("cv-select");
const coverLetterCheckbox = el("cover-letter-checkbox");
const fakeModeRow = el("fake-mode-row");
const fakeModeCheckbox = el("fake-mode-checkbox");
const generateBtn = el("generate-btn");
const generateBtnLabel = el("generate-btn-label");
const dispatchError = el("dispatch-error");
const jobList = el("job-list");
const jobListEmpty = el("job-list-empty");
const viewAllBtn = el("view-all-btn");

let pollTimer = null;
let currentDetection = null;

function statusLabel(status) {
  switch (status) {
    case "queued":
      return "Queued";
    case "processing":
      return "Generating";
    case "compiling":
      return "Compiling PDF";
    case "complete":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function showNotice(message, isSuccess = false) {
  dispatchError.classList.remove("hidden");
  dispatchError.classList.toggle("is-success", isSuccess);
  dispatchError.textContent = message;
}

function hideNotice() {
  dispatchError.classList.add("hidden");
}

function showDeepLinkNotice(message, path, label) {
  deepLinkText.textContent = message;
  deepLinkBtn.textContent = label;
  deepLinkBtn.onclick = () =>
    chrome.tabs.create({ url: `${WEB_APP_ORIGIN}${path}` });
  deepLinkNotice.classList.remove("hidden");
}

function hideDeepLinkNotice() {
  deepLinkNotice.classList.add("hidden");
}

function handleBackgroundError(err) {
  if (err.code === "SESSION_EXPIRED") {
    showLoggedOut();
    return;
  }
  showNotice(err.message || "Something went wrong.");
  if (err.deepLink) {
    showDeepLinkNotice(err.message, err.deepLink, "Open");
  }
}

function renderAccountArea(profile) {
  accountArea.innerHTML = "";
  if (!profile) return;

  const emailSpan = document.createElement("span");
  emailSpan.className = "account-email";
  emailSpan.textContent = profile.email || "";
  emailSpan.title = profile.email || "";

  const settingsBtn = document.createElement("button");
  settingsBtn.className = "link-btn";
  settingsBtn.textContent = "Settings";
  settingsBtn.onclick = () =>
    chrome.tabs.create({ url: `${WEB_APP_ORIGIN}/settings` });

  const logoutBtn = document.createElement("button");
  logoutBtn.className = "link-btn";
  logoutBtn.textContent = "Log out";
  logoutBtn.onclick = handleLogout;

  accountArea.append(emailSpan, settingsBtn, logoutBtn);
}

async function handleLogout() {
  await callBackground("LOGOUT").catch(() => {});
  showLoggedOut();
}

function showLoggedOut() {
  loggedOutView.classList.remove("hidden");
  loggedInView.classList.add("hidden");
  accountArea.innerHTML = "";
  stopPolling();
}

async function showLoggedIn(profile) {
  loggedOutView.classList.add("hidden");
  loggedInView.classList.remove("hidden");
  renderAccountArea(profile);
  await Promise.all([loadCvs(), loadDetectionBanner(), refreshJobs()]);
  startPolling();
}

async function loadCvs() {
  try {
    const { cvs, primaryCVId } = await callBackground("GET_CVS");
    cvSelect.innerHTML = "";
    if (cvs.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No Master CV yet";
      opt.value = "";
      cvSelect.appendChild(opt);
      cvSelect.disabled = true;
      generateBtn.disabled = true;
      showDeepLinkNotice(
        "You need to create a Master CV before generating a tailored resume.",
        "/cv",
        "Create Master CV",
      );
      return;
    }
    cvSelect.disabled = false;
    generateBtn.disabled = false;
    for (const cv of cvs) {
      const opt = document.createElement("option");
      opt.value = cv.id;
      opt.textContent = cv.name;
      if (cv.id === primaryCVId) opt.selected = true;
      cvSelect.appendChild(opt);
    }
  } catch (err) {
    handleBackgroundError(err);
  }
}

async function loadDetectionBanner() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;
    const detection = await callBackground("GET_TAB_DETECTION", {
      tabId: tab.id,
    });
    if (detection && detection.jobDescription) {
      currentDetection = detection;
      bannerDetected.classList.remove("hidden");
    } else {
      bannerDetected.classList.add("hidden");
    }
  } catch {
    bannerDetected.classList.add("hidden");
  }
}

async function refreshJobs() {
  try {
    const { jobs, nextCursor } = await callBackground("GET_JOBS");
    renderJobs(jobs);
    // The popup only ever shows the most recent 20 (server-side default) —
    // a non-null nextCursor means there's older history beyond that, so
    // point to the website's full, searchable history instead of building
    // pagination into a 380px popup.
    viewAllBtn.classList.toggle("hidden", !nextCursor);
    const seenNow = jobs
      .filter((j) => j.status === "complete" || j.status === "failed")
      .map((j) => j.id);
    if (seenNow.length > 0) {
      await callBackground("MARK_JOBS_SEEN", { jobIds: seenNow });
    }
  } catch (err) {
    handleBackgroundError(err);
  }
}

function renderJobs(jobs) {
  jobList.innerHTML = "";
  if (!jobs || jobs.length === 0) {
    jobListEmpty.classList.remove("hidden");
    return;
  }
  jobListEmpty.classList.add("hidden");

  for (const job of jobs) {
    jobList.appendChild(renderJobItem(job));
  }
}

function renderJobItem(job) {
  const li = document.createElement("li");
  li.className = "job-item";

  const top = document.createElement("div");
  top.className = "job-item-top";

  const title = document.createElement("span");
  title.className = "job-title";
  title.textContent =
    job.position && job.company
      ? `${job.position} at ${job.company}`
      : job.position || job.company || "Untitled";
  title.title = title.textContent;

  const pill = document.createElement("span");
  pill.className = `status-pill status-${job.status}`;
  pill.textContent = statusLabel(job.status);

  top.append(title, pill);

  const meta = document.createElement("div");
  meta.className = "job-meta";
  meta.textContent = `Initiated ${relativeTime(job.initiatedAt)}`;

  li.append(top, meta);

  if (job.status === "failed" && job.error) {
    const errorP = document.createElement("p");
    errorP.className = "job-error";
    errorP.textContent = job.error;
    li.appendChild(errorP);
  }

  const actions = document.createElement("div");
  actions.className = "job-actions";

  if (job.status === "complete") {
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "btn btn-outline btn-sm";
    downloadBtn.textContent = "Download";
    downloadBtn.onclick = () =>
      callBackground("DOWNLOAD_PDF", { jobId: job.id }).catch(
        handleBackgroundError,
      );

    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-outline btn-sm";
    openBtn.textContent = "Open in tab";
    openBtn.onclick = () =>
      callBackground("OPEN_PDF", { jobId: job.id }).catch(
        handleBackgroundError,
      );

    actions.append(downloadBtn, openBtn);

    if (job.wantCoverLetter) {
      const clBtn = document.createElement("button");
      clBtn.className = "btn btn-outline btn-sm";
      clBtn.textContent = "Cover letter";
      clBtn.onclick = () => showCoverLetter(job.id);
      actions.appendChild(clBtn);
    }
  } else if (job.status === "failed") {
    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn-outline btn-sm";
    retryBtn.textContent = "Retry";
    retryBtn.onclick = retryJob;
    actions.appendChild(retryBtn);
  }

  if (actions.childElementCount > 0) li.appendChild(actions);
  return li;
}

async function showCoverLetter(jobId) {
  try {
    const { content } = await callBackground("GET_COVER_LETTER", { jobId });
    // Minimal v1 viewer: copy to clipboard rather than a dedicated modal.
    await navigator.clipboard.writeText(content || "");
    showNotice("Cover letter copied to clipboard.", true);
    setTimeout(hideNotice, 2500);
  } catch (err) {
    handleBackgroundError(err);
  }
}

// Job history entries don't include the original jobDescription (excluded
// from the list response to keep it light), so retrying re-opens the paste
// form for the user to paste again rather than silently resubmitting.
function retryJob() {
  showNotice("Please paste the job description again to retry.", true);
  jdTextarea.focus();
}

async function handleGenerate(event) {
  event.preventDefault();
  hideNotice();
  hideDeepLinkNotice();

  const jobDescription = jdTextarea.value.trim();
  if (jobDescription.length < 50) {
    showNotice(
      "Please paste the full job description (at least 50 characters).",
    );
    return;
  }

  generateBtn.disabled = true;
  generateBtnLabel.textContent = "Dispatching...";
  try {
    await callBackground("DISPATCH_FROM_POPUP", {
      jobDescription,
      company: companyInput.value.trim(),
      position: positionInput.value.trim(),
      wantCoverLetter: coverLetterCheckbox.checked,
      masterCVId: cvSelect.value || undefined,
      detectionMethod: "manual_paste",
      sourceUrl: "",
      fake: fakeModeCheckbox.checked,
    });
    jdTextarea.value = "";
    companyInput.value = "";
    positionInput.value = "";
    coverLetterCheckbox.checked = false;
    await refreshJobs();
  } catch (err) {
    handleBackgroundError(err);
  } finally {
    generateBtn.disabled = false;
    generateBtnLabel.textContent = "Generate";
  }
}

async function handleBannerGenerate() {
  if (!currentDetection) return;
  bannerGenerateBtn.disabled = true;
  bannerGenerateBtnLabel.textContent = "Dispatching...";
  try {
    await callBackground("DISPATCH_FROM_PAGE", currentDetection);
    bannerDetected.classList.add("hidden");
    await refreshJobs();
  } catch (err) {
    handleBackgroundError(err);
  } finally {
    bannerGenerateBtn.disabled = false;
    bannerGenerateBtnLabel.textContent = "Generate resume";
  }
}

async function handleLogin() {
  loginError.classList.add("hidden");
  loginBtn.disabled = true;
  loginBtn.textContent = "Opening login...";
  try {
    const { profile } = await callBackground("START_LOGIN");
    await showLoggedIn(profile);
  } catch (err) {
    loginError.classList.remove("hidden");
    loginError.textContent = err.message || "Login failed.";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Log in to CV Builder";
  }
}

// Fast poll loop while the popup is open — the popup's page context stays
// alive for as long as it's visible, unlike the background service worker,
// which can only poll at chrome.alarms' ~1-minute floor (see
// background/config.js). Cleared automatically when the popup closes.
function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    await callBackground("POLL_NOW").catch(() => {});
    await refreshJobs();
  }, 3000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

loginBtn.addEventListener("click", handleLogin);
pasteForm.addEventListener("submit", handleGenerate);
bannerGenerateBtn.addEventListener("click", handleBannerGenerate);
viewAllBtn.addEventListener("click", () =>
  chrome.tabs.create({ url: `${WEB_APP_ORIGIN}/documents` }),
);

// Dev/testing aid — always rendered (harmless in production since the
// server hard-gates ?fake=true to non-production regardless of what the
// client sends), but only meaningfully useful against a local dev server.
fakeModeRow.classList.remove("hidden");

(async function init() {
  try {
    const { loggedIn, profile } = await callBackground("GET_AUTH_STATE");
    if (loggedIn) {
      await showLoggedIn(profile);
    } else {
      showLoggedOut();
    }
  } catch {
    showLoggedOut();
  }
})();
