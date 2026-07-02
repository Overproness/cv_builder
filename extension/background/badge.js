import { getUnseenJobIds } from "./storage.js";

export async function refreshBadge() {
  const unseen = await getUnseenJobIds();
  if (unseen.length === 0) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  await chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
  await chrome.action.setBadgeText({
    text: unseen.length > 9 ? "9+" : String(unseen.length),
  });
}

export async function flashFailureBadge() {
  await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  const unseen = await getUnseenJobIds();
  await chrome.action.setBadgeText({
    text: unseen.length > 9 ? "9+" : String(unseen.length || "!"),
  });
}
