import {
  BACKGROUND_POLL_ALARM_NAME,
  BACKGROUND_POLL_PERIOD_MINUTES,
} from "./config.js";
import { pollPendingJobs } from "./api.js";

export async function ensureBackgroundPollAlarm() {
  const existing = await chrome.alarms.get(BACKGROUND_POLL_ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(BACKGROUND_POLL_ALARM_NAME, {
      periodInMinutes: BACKGROUND_POLL_PERIOD_MINUTES,
    });
  }
}

export function registerAlarmListener() {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === BACKGROUND_POLL_ALARM_NAME) {
      pollPendingJobs();
    }
  });
}
