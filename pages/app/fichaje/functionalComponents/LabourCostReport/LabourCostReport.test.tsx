import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LabourCostReport } from "./LabourCostReport";

describe("LabourCostReport", () => {
  it("renders actual worked labour cost", () => {
    render(<LabourCostReport report={{from:"2026-01-01",to:"2026-01-31",totalMinutes:600,totalCost:150,missingCompensationMembers:[],members:[{memberId:1,name:"Ana",minutesWorked:600,cost:150,missingCompensation:false}]}} loading={false} onRangeChange={()=>undefined} />);
    expect(screen.getByText("150,00 €")).toBeInTheDocument();
    expect(screen.getByText("10,00 h")).toBeInTheDocument();
  });
});
