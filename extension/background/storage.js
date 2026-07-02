import { STORAGE_KEYS, TERMINAL_STATUSES } from "./config.js";

// Local job cache is only used to decide what to poll (see
// background/api.js's pollPendingJobs) — the popup's visible history list
// always comes fresh from the server, capped there. But without a local
// cap too, this cache would grow by one entry per dispatch forever across
// months of use. Non-terminal (still in-flight) jobs are never pruned,
// since they still need polling regardless of count; only the terminal
// (complete/failed) backlog is capped, keeping the most recently initiated.
const MAX_CACHED_TERMINAL_JOBS = 50;

function pruneCachedJobs(jobs) {
  const entries = Object.entries(jobs);
  const terminal = entries.filter(([, j]) => TERMINAL_STATUSES.includes(j.status));
  if (terminal.length <= MAX_CACHED_TERMINAL_JOBS) return jobs;

  terminal.sort(
    (a, b) => new Date(b[1].initiatedAt || 0) - new Date(a[1].initiatedAt || 0),
  );
  const dropIds = new Set(
    terminal.slice(MAX_CACHED_TERMINAL_JOBS).map(([id]) => id),
  );

  const pruned = {};
  for (const [id, job] of entries) {
    if (!dropIds.has(id)) pruned[id] = job;
  }
  return pruned;
}

export async function getAuthTokens() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_TOKENS);
  return result[STORAGE_KEYS.AUTH_TOKENS] || null;
}

export async function setAuthTokens(tokens) {
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TOKENS]: tokens });
}

export async function clearAuthTokens() {
  await chrome.storage.local.remove([
    STORAGE_KEYS.AUTH_TOKENS,
    STORAGE_KEYS.USER_PROFILE,
  ]);
}

export async function getUserProfile() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROFILE);
  return result[STORAGE_KEYS.USER_PROFILE] || null;
}

export async function setUserProfile(profile) {
  await chrome.storage.local.set({ [STORAGE_KEYS.USER_PROFILE]: profile });
}

export async function isLoggedIn() {
  const tokens = await getAuthTokens();
  return Boolean(tokens?.refreshToken);
}

export async function getCachedJobs() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.JOBS);
  return result[STORAGE_KEYS.JOBS] || {};
}

export async function setCachedJob(jobId, job) {
  const jobs = await getCachedJobs();
  jobs[jobId] = { ...jobs[jobId], ...job };
  const pruned = pruneCachedJobs(jobs);
  await chrome.storage.local.set({ [STORAGE_KEYS.JOBS]: pruned });
  return pruned[jobId];
}

export async function getUnseenJobIds() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.UNSEEN_JOB_IDS);
  return result[STORAGE_KEYS.UNSEEN_JOB_IDS] || [];
}

export async function addUnseenJobId(jobId) {
  const ids = new Set(await getUnseenJobIds());
  ids.add(jobId);
  await chrome.storage.local.set({
    [STORAGE_KEYS.UNSEEN_JOB_IDS]: Array.from(ids),
  });
}

export async function clearUnseenJobIds(jobIds) {
  if (!jobIds) {
    await chrome.storage.local.set({ [STORAGE_KEYS.UNSEEN_JOB_IDS]: [] });
    return;
  }
  const toClear = new Set(jobIds);
  const remaining = (await getUnseenJobIds()).filter((id) => !toClear.has(id));
  await chrome.storage.local.set({ [STORAGE_KEYS.UNSEEN_JOB_IDS]: remaining });
}
