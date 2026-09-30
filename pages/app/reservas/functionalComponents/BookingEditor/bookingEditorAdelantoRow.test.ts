import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(`${process.cwd()}/components/styles/features/settings/widget-preview.css`, "utf8");

// Coordination id: booking_editor_special_adelanto_ui_v2 - the label and the
// unit price share one row: the label truncates inside the shared area, the
// unit keeps its natural width and never wraps. Both use the same font size.
describe("booking editor special adelanto row", () => {
  it("puts the label text and the unit on one line with a truncating label", () => {
    expect(css).toMatch(
      /\.bo-specialAdelantoRowLabel\s*\{[^}]*display:\s*flex;[^}]*min-width:\s*0;/s,
    );
    expect(css).toMatch(
      /\.bo-specialAdelantoRowLabelText\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s,
    );
  });

  it("gives the unit its natural width and the label's font size", () => {
    expect(css).toMatch(
      /\.bo-specialAdelantoRowLabel \.bo-mutedText\s*\{[^}]*width:\s*fit-content;[^}]*white-space:\s*nowrap;/s,
    );
    expect(css).toMatch(
      /\.bo-specialAdelantoRowLabel \.bo-mutedText\s*\{[^}]*font-size:\s*13px;/s,
    );
    expect(css).toMatch(
      /\.bo-specialAdelantoRowLabelText\s*\{[^}]*font-size:\s*13px;/s,
    );
  });
});
