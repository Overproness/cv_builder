// Base origin of the CV Builder web app. Change to the production domain
// before packaging for distribution — must match manifest.json's
// host_permissions (so this module's fetch()es bypass CORS entirely) and
// the EXTENSION_ID the server validates against in /extension/authorize.
export const WEB_APP_ORIGIN = "http://localhost:3000";

export const STORAGE_KEYS = {
  AUTH_TOKENS: "authTokens", // { accessToken, refreshToken, expiresAt }
  USER_PROFILE: "userProfile", // { email, name }
  JOBS: "jobs", // { [jobId]: <cached status fields> }
  UNSEEN_JOB_IDS: "unseenJobIds", // string[]
};

// chrome.alarms cannot fire more often than every ~1 minute in a packed
// extension (Chrome enforces this floor), so background polling — used to
// keep the toolbar badge accurate while the popup is closed — runs on a
// single recurring alarm at that floor rather than the tighter interval a
// naive setInterval-in-the-service-worker would suggest (MV3 service
// workers are suspended after ~30s idle, so long-lived timers don't survive
// anyway). While the popup itself is open, it polls in-flight jobs directly
// every few seconds via its own long-lived page context instead — see
// popup/popup.js — which gives snappy feedback during active use without
// depending on alarm cadence at all.
export const BACKGROUND_POLL_ALARM_NAME = "poll-pending-jobs";
export const BACKGROUND_POLL_PERIOD_MINUTES = 1;

export const TERMINAL_STATUSES = ["complete", "failed"];
