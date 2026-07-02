// Per-site job-description detectors. Best-effort CSS selectors against each
// site's current DOM structure — job boards change markup periodically, so
// treat this file as a maintenance surface, not a permanent contract.
// Last verified: 2026-07 (see extension/README.md for how to fix a broken
// selector — each entry fails closed, falling through to the generic
// heuristic in content.js if extract() returns null).

function textOf(selector, root = document) {
  const node = root.querySelector(selector);
  const text = node?.innerText || node?.textContent || "";
  return text.trim();
}

function firstMatch(selectors, root = document) {
  for (const selector of selectors) {
    const text = textOf(selector, root);
    if (text) return text;
  }
  return "";
}

self.CVBuilderSiteDetectors = [
  {
    id: "linkedin",
    urlPattern: /linkedin\.com\/jobs\//,
    extract() {
      // LinkedIn's exact class names change often (and differ between the
      // logged-in unified view, the logged-out public view, and A/B
      // variants), so exact classes are tried first, then broad
      // attribute-contains selectors as a resilience net — those keep
      // matching even when a class gets a new suffix appended, at the cost
      // of being slightly less precise.
      const jobDescription = firstMatch([
        ".jobs-description__content",
        ".jobs-box__html-content",
        ".jobs-description-content__text",
        ".jobs-description-content",
        ".jobs-description",
        "#job-details",
        "article.jobs-description__container",
        '[class*="jobs-description"]',
        '[class*="job-details"]',
      ]);
      if (!jobDescription || jobDescription.length < 50) return null;
      return {
        jobDescription,
        position: firstMatch([
          ".job-details-jobs-unified-top-card__job-title",
          ".jobs-unified-top-card__job-title",
          '[class*="job-title"]',
          "h1",
        ]),
        company: firstMatch([
          ".job-details-jobs-unified-top-card__company-name",
          ".jobs-unified-top-card__company-name",
          '[class*="company-name"]',
        ]),
      };
    },
  },
  {
    id: "indeed",
    urlPattern: /indeed\.com\//,
    extract() {
      const jobDescription = firstMatch(["#jobDescriptionText"]);
      if (!jobDescription || jobDescription.length < 50) return null;
      return {
        jobDescription,
        position: firstMatch([
          ".jobsearch-JobInfoHeader-title",
          "h1.jobsearch-JobInfoHeader-title",
        ]),
        company: firstMatch([
          '[data-testid="inlineHeader-companyName"]',
          ".jobsearch-InlineCompanyRating > div",
        ]),
      };
    },
  },
  {
    id: "greenhouse",
    urlPattern: /(boards|job-boards)\.greenhouse\.io\//,
    extract() {
      const jobDescription = firstMatch([
        "#content",
        '[data-mapped="true"]',
        ".job__description",
      ]);
      if (!jobDescription || jobDescription.length < 50) return null;
      return {
        jobDescription,
        position: firstMatch(["h1", ".app-title"]),
        company: firstMatch([".company-name", ".app-title + div"]),
      };
    },
  },
  {
    id: "lever",
    urlPattern: /jobs\.lever\.co\//,
    extract() {
      const jobDescription = firstMatch([
        ".posting-page .section-wrapper .content",
        ".posting-page .content",
      ]);
      if (!jobDescription || jobDescription.length < 50) return null;
      return {
        jobDescription,
        position: firstMatch([".posting-headline h2", "h2"]),
        company:
          document.querySelector(".main-header-logo img")?.alt?.trim() || "",
      };
    },
  },
  {
    id: "workday",
    urlPattern: /myworkdayjobs\.com\//,
    extract() {
      const jobDescription = firstMatch([
        '[data-automation-id="jobPostingDescription"]',
      ]);
      if (!jobDescription || jobDescription.length < 50) return null;
      return {
        jobDescription,
        position: firstMatch(['[data-automation-id="jobPostingHeader"]']),
        company: "",
      };
    },
  },
];
