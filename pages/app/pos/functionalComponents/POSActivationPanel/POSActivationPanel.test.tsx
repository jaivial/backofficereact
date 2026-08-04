import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { POSActivationPanel } from "./POSActivationPanel";

describe("POSActivationPanel", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(async (input:RequestInfo|URL,init?:RequestInit) => {
    if(String(input).endsWith("/activation-readiness")) return new Response(JSON.stringify({success:true,activeProducts:4,mappedProducts:4,unmappedProducts:0,invalidMappings:0,activeServicePeriods:2,openStockExceptions:0,stockLedgerDifferences:0,coverDifferences:0,stockLiveReady:true,coversLiveReady:true}));
    if(String(input).endsWith("/activation-acceptances")&&init?.method==="POST") return new Response(JSON.stringify({success:true,id:1}),{status:201});
    return new Response(JSON.stringify({success:true}));
  })));
  it("records stock live acceptance", async () => {
    render(<POSActivationPanel/>);
    expect(await screen.findByText("Stock preparado")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Evidencia activación"),{target:{value:"Shadow revisado 14 días"}});
    fireEvent.click(screen.getByTestId("accept-stock-live"));
    await waitFor(()=>expect(fetch).toHaveBeenCalledWith("/api/admin/pos/activation-acceptances",expect.objectContaining({body:JSON.stringify({type:"STOCK_LIVE",evidenceNote:"Shadow revisado 14 días"})})));
  });
});
