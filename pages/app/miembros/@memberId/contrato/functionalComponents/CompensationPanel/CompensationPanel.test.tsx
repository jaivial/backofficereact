import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompensationPanel } from "./CompensationPanel";

describe("CompensationPanel", () => {
  it("creates monthly compensation", async () => {
    const onCreate=vi.fn(async()=>true);
    render(<CompensationPanel items={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Salario bruto mensual"),{target:{value:"2000"}});
    fireEvent.change(screen.getByLabelText("Horas mensuales"),{target:{value:"160"}});
    fireEvent.click(screen.getByText("Añadir salario"));
    await waitFor(()=>expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({payType:"MONTHLY",grossAmount:2000,monthlyHours:160})));
  });

  it("shows effective employer hourly cost", () => {
    render(<CompensationPanel items={[{id:1,payType:"MONTHLY",grossAmount:2000,monthlyHours:160,employerCostPct:30,effectiveHourlyCost:16.25,effectiveFrom:"2026-01-01",effectiveTo:null,notes:null}]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("16,25 €/h")).toBeInTheDocument();
  });

  it("updates existing compensation", async () => {
    const item={id:1,payType:"HOURLY" as const,grossAmount:12,monthlyHours:null,employerCostPct:25,effectiveHourlyCost:15,effectiveFrom:"2026-01-01",effectiveTo:null,notes:null};
    const onUpdate=vi.fn(async()=>true);
    render(<CompensationPanel items={[item]} onCreate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText("Editar"));
    fireEvent.change(screen.getByLabelText("Bruto por hora"),{target:{value:"13"}});
    fireEvent.click(screen.getByText("Guardar salario"));
    await waitFor(()=>expect(onUpdate).toHaveBeenCalledWith(1,expect.objectContaining({grossAmount:13})));
  });
});
