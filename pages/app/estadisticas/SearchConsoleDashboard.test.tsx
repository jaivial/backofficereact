import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchConsoleDashboard } from "./functionalComponents/SearchConsoleDashboard/SearchConsoleDashboard";
import { downloadSearchConsoleCsv, SEARCH_CSV_FILENAME, searchConsoleCsv } from "./functionalComponents/SearchConsoleDashboard/searchConsoleCsv";
import { SEARCH_SNAPSHOT } from "./functionalComponents/SearchConsoleDashboard/searchConsoleSnapshot";

describe("SearchConsoleDashboard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the private snapshot, its period and its interpretation limits", () => {
    render(<SearchConsoleDashboard />);

    expect(screen.getByTestId("search-console-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("search-console-period")).toHaveTextContent("23/04/2026 – 22/10/2026");
    expect(screen.getByTestId("search-console-clicks-value")).toHaveTextContent("285");
    expect(screen.getByTestId("search-console-impressions-value")).toHaveTextContent("5201");
    expect(screen.getByTestId("search-console-ctr-value")).toHaveTextContent("5,48 %");
    expect(screen.getByTestId("search-console-intents")).toHaveTextContent("Arroces y paellas");
    expect(screen.getByTestId("search-console-intents")).toHaveTextContent("Sin datos");
    expect(screen.getByTestId("search-console-devices")).toHaveTextContent("Móvil");
    expect(screen.getByTestId("search-console-limitations")).toHaveTextContent("Los clics no son reservas");
    expect(screen.getByTestId("search-console-limitations")).toHaveTextContent("ni incluye consultas individuales");
  });

  it("preserves every aggregate row and downloads the CSV privately in the browser", async () => {
    const csv = searchConsoleCsv();
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(12);
    expect(lines[0]).toBe("dimension,segment,source_rows,clicks,impressions,ctr,impression_weighted_average_position");
    expect(lines).toContain("intent,restaurant_catarroja,156,101,1568,0.064413265306,3.82");
    expect(lines).toContain("intent,rice,0,0,0,0.000000000000,");
    expect(lines).toContain("device,MOBILE,237,248,4563,0.054350208196,2.81");
    expect(SEARCH_CSV_FILENAME).toBe("villa-carmen-search-demand-2026-04-23_2026-10-22.csv");
    expect(SEARCH_SNAPSHOT.total.rows).toBe(471);

    let downloadedText = "";
    const OriginalBlob = globalThis.Blob;
    class InspectableBlob extends OriginalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        void this.text().then((text) => { downloadedText = text; });
      }
    }
    vi.stubGlobal("Blob", InspectableBlob);
    const createObjectURL = vi.fn(() => "blob:search-console-private");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadSearchConsoleCsv();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:search-console-private");
    await vi.waitFor(() => expect(downloadedText).toBe(csv));
  });
});
