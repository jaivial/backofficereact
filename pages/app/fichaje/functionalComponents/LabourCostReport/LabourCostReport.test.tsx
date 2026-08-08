import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LabourCostReport } from "./LabourCostReport";

describe("LabourCostReport", () => {
  it("renders actual worked labour cost", () => {
    const { container } = render(<LabourCostReport report={{from:"2026-01-01",to:"2026-01-31",totalMinutes:600,totalCost:150,missingCompensationMembers:[],members:[{memberId:1,name:"Ana",minutesWorked:600,cost:150,missingCompensation:false}]}} loading={false} onRangeChange={()=>undefined} />);
    expect(container.querySelector('[data-ui="labour-report-hours-value"]')).toHaveTextContent("10,00 h");
    expect(container.querySelector('[data-ui="labour-report-cost-value"]')).toHaveTextContent("150,00 €");
    expect(container.querySelector('[data-ui="labour-report-member-cost"]')).toHaveTextContent("150,00 €");
  });

  it("shows empty state and warns about missing compensation", () => {
    render(<LabourCostReport report={{from:"2026-01-01",to:"2026-01-31",totalMinutes:0,totalCost:0,missingCompensationMembers:["Pedro"],members:[{memberId:2,name:"Pedro",minutesWorked:0,cost:0,missingCompensation:true}]}} loading={false} onRangeChange={()=>undefined} />);
    expect(screen.getByTestId("labour-report-panel")).toBeInTheDocument();
    expect(screen.getByText("sin salario")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Falta salario: Pedro");
  });
});
