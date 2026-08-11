import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { POSForceOpenConfirmModal } from "./POSForceOpenConfirmModal";

describe("POSForceOpenConfirmModal", () => {
  it("speaks in singular for a single pending day", () => {
    render(<POSForceOpenConfirmModal count={1} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByTestId("pos-force-confirm-title")).toHaveTextContent(/día anterior\?$/);
  });

  it("speaks in plural for several pending days", () => {
    render(<POSForceOpenConfirmModal count={3} onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByTestId("pos-force-confirm-title")).toHaveTextContent(/días anteriores\?$/);
  });

  it("confirms via onConfirm and cancels via onCancel", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<POSForceOpenConfirmModal count={2} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("pos-force-confirm-cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("pos-force-confirm-ok"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("disables both actions while a force-open is in flight", () => {
    render(<POSForceOpenConfirmModal count={1} busy onCancel={() => {}} onConfirm={() => {}} />);
    expect(screen.getByTestId("pos-force-confirm-ok")).toBeDisabled();
    expect(screen.getByTestId("pos-force-confirm-cancel")).toBeDisabled();
  });
});
