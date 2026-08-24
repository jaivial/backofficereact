import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  `${process.cwd()}/components/styles/features/settings/widget-preview.css`,
  "utf8",
);

describe("reservation details modal scrolling", () => {
  it("lets the details ScrollArea shrink and own vertical scrolling", () => {
    expect(css).toMatch(
      /\.bo-reservasModal--details\s+\.bo-scrollArea\s*\{[^}]*flex:\s*1\s+1\s+auto;[^}]*min-height:\s*0;[^}]*height:\s*auto;/s,
    );
    expect(css).toMatch(
      /\.bo-reservasModal--details\s+\.bo-scrollAreaViewport\s*\{[^}]*overflow-y:\s*auto;[^}]*height:\s*auto;[^}]*-webkit-overflow-scrolling:\s*touch;/s,
    );
  });
});
