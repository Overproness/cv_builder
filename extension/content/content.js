// Orchestrates job-description detection and the in-page "Create tailored
// resume" button. Runs at document_idle. Network calls never happen here —
// only chrome.runtime.sendMessage to the background service worker, per the
// extension's message-passing architecture (see extension/README.md).

const BUTTON_ID = "cvbuilder-inject-button";
const STATUS_ID = "cvbuilder-inject-status";
const LABEL_CLASS = "cvbuilder-label";
const RESCAN_INTERVAL_MS = 1500;

// Lucide "sparkles" glyph — matches the AI-action icon (LuSparkles) used
// throughout the website's own UI (e.g. the login/tailor pages).
const SPARKLES_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`;

let lastDetectionKey = null;
let rescanTimer = null;

// MV3 content scripts keep running after the extension itself is reloaded
// (e.g. during development) or uninstalled, but chrome.runtime.id becomes
// undefined once that happens — any further chrome.runtime.* call then
// throws/fails with an "Extension context invalidated" style error. Without
// this guard, a page left open across a reload spams the console forever
// (this is what "chrome-extension://invalid" fetch errors usually mean).
function isExtensionContextAlive() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function safeSendMessage(message, callback) {
  if (!isExtensionContextAlive()) {
    stopRescanLoop();
    return;
  }
  try {
    chrome.runtime.sendMessage(message, callback);
  } catch {
    stopRescanLoop();
  }
}

function detectSiteMethod() {
  const url = location.href;
  for (const detector of self.CVBuilderSiteDetectors || []) {
    if (detector.urlPattern.test(url)) {
      try {
        const result = detector.extract();
        if (result?.jobDescription) {
          return { ...result, detectionMethod: detector.id };
        }
      } catch {
        // Detector threw (unexpected DOM shape) — fall through to generic.
      }
      // Matched a known site's URL but couldn't extract anything on this
      // specific page yet (selectors drifted, this is a list/search view,
      // or — most commonly — the SPA just hasn't finished rendering the
      // description pane). Returning null here lets the caller fall back
      // to the generic heuristic, and the rescan loop below retries this
      // site-specific extraction again shortly after.
      return null;
    }
  }
  return null;
}

function detectGeneric() {
  try {
    const result = self.CVBuilderGenericHeuristic?.detect();
    if (result?.jobDescription) {
      return { ...result, detectionMethod: "generic_heuristic" };
    }
  } catch {
    // ignore
  }
  return null;
}

function removeButton() {
  document.getElementById(BUTTON_ID)?.remove();
}

function injectButton(detection) {
  removeButton();

  const wrapper = document.createElement("div");
  wrapper.id = BUTTON_ID;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cvbuilder-btn";
  button.innerHTML = `${SPARKLES_SVG}<span class="${LABEL_CLASS}">Create tailored resume</span>`;

  const status = document.createElement("span");
  status.id = STATUS_ID;
  status.className = "cvbuilder-status";

  wrapper.append(button, status);
  document.body.appendChild(wrapper);

  button.addEventListener("click", () => handleButtonClick(button, status, detection));
}

function setButtonLabel(button, text) {
  const label = button.querySelector(`.${LABEL_CLASS}`);
  if (label) label.textContent = text;
}

function handleButtonClick(button, status, detection) {
  if (!isExtensionContextAlive()) {
    status.classList.add("cvbuilder-status-error");
    status.textContent = "Extension was updated — please refresh this page and try again.";
    return;
  }

  button.disabled = true;
  setButtonLabel(button, "Generating...");
  status.textContent = "";
  status.classList.remove("cvbuilder-status-error");

  safeSendMessage(
    {
      action: "DISPATCH_FROM_PAGE",
      payload: {
        jobDescription: detection.jobDescription,
        company: detection.company || "",
        position: detection.position || "",
        sourceUrl: location.href,
        detectionMethod: detection.detectionMethod,
      },
    },
    (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        button.disabled = false;
        setButtonLabel(button, "Create tailored resume");
        status.classList.add("cvbuilder-status-error");
        status.textContent =
          response?.message ||
          chrome.runtime.lastError?.message ||
          "Something went wrong — try the extension popup instead.";
        return;
      }
      setButtonLabel(button, "Dispatched ✓");
      status.textContent = "Check the extension popup for progress.";
    },
  );
}

function notifyDetection(detection) {
  safeSendMessage({
    action: "JD_DETECTED",
    payload: {
      jobDescription: detection.jobDescription,
      company: detection.company || "",
      position: detection.position || "",
      sourceUrl: location.href,
      detectionMethod: detection.detectionMethod,
    },
  });
}

function runDetection() {
  const detection = detectSiteMethod() || detectGeneric();

  if (!detection) {
    removeButton();
    lastDetectionKey = null;
    return;
  }

  // Avoid re-injecting/re-notifying on every rescan tick when nothing
  // meaningful changed.
  const key = `${detection.detectionMethod}:${detection.jobDescription.length}`;
  if (key === lastDetectionKey && document.getElementById(BUTTON_ID)) {
    return;
  }
  lastDetectionKey = key;

  injectButton(detection);
  notifyDetection(detection);
}

// A one-shot run at document_idle isn't enough: heavy SPA job boards (most
// notably LinkedIn) fetch and render the job-description pane well after
// document_idle fires, and update it in place — sometimes without changing
// the URL at all (clicking a different card in a results list) — so a
// URL-change watcher alone misses it. Unconditionally rescanning on a short
// interval instead catches both late-rendering content and same-URL panel
// swaps; runDetection()'s lastDetectionKey check keeps this cheap by
// skipping re-injection when nothing changed.
function startRescanLoop() {
  stopRescanLoop();
  rescanTimer = setInterval(() => {
    if (!isExtensionContextAlive()) {
      stopRescanLoop();
      return;
    }
    runDetection();
  }, RESCAN_INTERVAL_MS);
}

function stopRescanLoop() {
  if (rescanTimer) {
    clearInterval(rescanTimer);
    rescanTimer = null;
  }
}

runDetection();
startRescanLoop();
