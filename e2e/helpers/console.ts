/**
 * Console monitoring helpers for E2E tests.
 */
import type { Page } from "@playwright/test";

export interface ConsoleCapture {
  logs: string[];
  warnings: string[];
  errors: string[];
  pageErrors: Error[];
  networkErrors: { url: string; status: number; statusText: string }[];
}

/**
 * Capture all console and network activity on a page.
 */
export function captureConsole(page: Page): ConsoleCapture {
  const capture: ConsoleCapture = {
    logs: [],
    warnings: [],
    errors: [],
    pageErrors: [],
    networkErrors: [],
  };

  page.on("console", (msg) => {
    const text = msg.text();
    switch (msg.type()) {
      case "log":
        capture.logs.push(text);
        break;
      case "warning":
        capture.warnings.push(text);
        break;
      case "error":
        capture.errors.push(text);
        break;
    }
  });

  page.on("pageerror", (err) => {
    capture.pageErrors.push(err);
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      capture.networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    }
  });

  return capture;
}

/**
 * Assert that no critical console errors occurred.
 * Filters out known acceptable errors.
 */
export function assertNoCriticalErrors(capture: ConsoleCapture) {
  const acceptablePatterns = [
    /favicon\.ico/, // Missing favicon is OK in dev
    /devtools/, // DevTools protocol messages
    /Download the React DevTools/, // React dev tools message
  ];

  const criticalErrors = capture.errors.filter(
    (err) =>
      !acceptablePatterns.some((pattern) => pattern.test(err))
  );

  const criticalPageErrors = capture.pageErrors.filter(
    (err) =>
      !acceptablePatterns.some((pattern) => pattern.test(err.message))
  );

  return {
    hasErrors: criticalErrors.length > 0 || criticalPageErrors.length > 0,
    criticalErrors,
    criticalPageErrors,
    networkErrors: capture.networkErrors,
    summary: {
      totalLogs: capture.logs.length,
      totalWarnings: capture.warnings.length,
      totalErrors: capture.errors.length,
      totalPageErrors: capture.pageErrors.length,
      totalNetworkErrors: capture.networkErrors.length,
    },
  };
}
