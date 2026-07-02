import {
  downloadJobPdf,
  fetchCoverLetter,
  fetchCvs,
  fetchJobStatus,
  fetchJobs,
  dispatchJob,
  openJobPdf,
  pollPendingJobs,
} from "./api.js";
import { getValidAccessToken, logout, startLogin } from "./auth.js";
import { flashFailureBadge, refreshBadge } from "./badge.js";
import { ensureBackgroundPollAlarm, registerAlarmListener } from "./polling.js";
import {
  clearUnseenJobIds,
  getUserProfile,
  isLoggedIn,
} from "./storage.js";

// Soft, in-memory cache of the last job-description detection per tab, used
// to warm the popup's "we found a job description on this page" banner.
// Intentionally not persisted: MV3 service workers can be terminated and
// restarted at any time, and losing this cache just means the banner
// doesn't show until the content script detects again — a fine tradeoff
// for a non-critical UX nicety.
const tabDetections = new Map();

chrome.runtime.onInstalled.addListener(() => {
  ensureBackgroundPollAlarm();
});
chrome.runtime.onStartup.addListener(() => {
  ensureBackgroundPollAlarm();
});
registerAlarmListener();

chrome.tabs.onRemoved.addListener((tabId) => {
  tabDetections.delete(tabId);
});

const handlers = {
  async START_LOGIN() {
    const profile = await startLogin();
    await refreshBadge();
    return { loggedIn: true, profile };
  },

  async LOGOUT() {
    await logout();
    return { loggedIn: false };
  },

  async GET_AUTH_STATE() {
    const loggedIn = await isLoggedIn();
    return { loggedIn, profile: loggedIn ? await getUserProfile() : null };
  },

  async GET_CVS() {
    await getValidAccessToken();
    return fetchCvs();
  },

  async DISPATCH_FROM_PAGE(payload) {
    return dispatchJob({ ...payload, wantCoverLetter: false });
  },

  async DISPATCH_FROM_POPUP(payload) {
    const { fake, ...rest } = payload || {};
    return dispatchJob(rest, { fake: Boolean(fake) });
  },

  async JD_DETECTED(payload, sender) {
    const tabId = sender?.tab?.id;
    if (tabId != null) tabDetections.set(tabId, payload);
    return {};
  },

  async GET_TAB_DETECTION(payload) {
    return tabDetections.get(payload?.tabId) || null;
  },

  async GET_JOBS(payload) {
    return fetchJobs(payload?.cursor);
  },

  async GET_JOB_STATUS(payload) {
    return fetchJobStatus(payload.jobId);
  },

  async POLL_NOW() {
    await pollPendingJobs();
    return {};
  },

  async DOWNLOAD_PDF(payload) {
    await downloadJobPdf(payload.jobId);
    return {};
  },

  async OPEN_PDF(payload) {
    await openJobPdf(payload.jobId);
    return {};
  },

  async GET_COVER_LETTER(payload) {
    return fetchCoverLetter(payload.jobId);
  },

  async MARK_JOBS_SEEN(payload) {
    await clearUnseenJobIds(payload?.jobIds);
    await refreshBadge();
    return {};
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message?.action];
  if (!handler) {
    sendResponse({
      ok: false,
      error: "UNKNOWN_ACTION",
      message: `No handler for action "${message?.action}"`,
    });
    return false;
  }

  handler(message.payload, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch(async (error) => {
      if (error.message === "SESSION_EXPIRED") {
        sendResponse({
          ok: false,
          error: "SESSION_EXPIRED",
          message: "Your session expired — please log in again.",
        });
        await flashFailureBadge().catch(() => {});
        return;
      }
      sendResponse({
        ok: false,
        error: error.code || "ERROR",
        message: error.message || "Something went wrong.",
        deepLink: error.deepLink,
      });
    });

  return true; // keep the message channel open for the async sendResponse
});
