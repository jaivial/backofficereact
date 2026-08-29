import { describe, expect, it } from "vitest";

import { appVersionAtLeast, hasAppCapability, isSupportedAppVersion } from "./app-version";

describe("app version 0.0.1", () => {
  it("is a supported user version and enables ordered mobile navigation", () => {
    expect(isSupportedAppVersion("0.0.1")).toBe(true);
    expect(hasAppCapability("0.0.1", "mobileNavOrder")).toBe(true);
  });

  it("sorts patch versions below 0.1 while keeping later versions compatible", () => {
    expect(appVersionAtLeast("0.0.1", "0.1")).toBe(false);
    expect(appVersionAtLeast("0.1", "0.0.1")).toBe(true);
  });
});
