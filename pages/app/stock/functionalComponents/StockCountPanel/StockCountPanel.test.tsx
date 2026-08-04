import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StockCountPanel } from "./StockCountPanel";

describe("StockCountPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url=String(input);
      if(url.endsWith("/counts")) return new Response(JSON.stringify({success:true,id:5}),{status:201});
      if(url.endsWith("/counts/5")) return new Response(JSON.stringify({success:true,id:5,warehouseId:7,warehouseName:"Principal",status:"OPEN",lines:[{itemId:1,name:"Harina",expectedQuantityBase:1000,unitId:2,unitLabel:"kg",factorToBase:1000}]}));
      if(url.endsWith("/counts/5/close")) return new Response(JSON.stringify({success:true}));
      return new Response(JSON.stringify({success:false}),{status:404});
    }));
  });
  it("opens and closes physical count", async () => {
    const onClosed=vi.fn();
    render(<StockCountPanel warehouses={[{id:7,name:"Principal",isDefault:true}]} onClosed={onClosed} />);
    fireEvent.click(screen.getByText("Abrir recuento"));
    expect(await screen.findByText("Harina")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cerrar y ajustar stock"));
    await waitFor(()=>expect(onClosed).toHaveBeenCalledWith());
  });
});
