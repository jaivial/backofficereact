import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { POSKeypad } from "./POSKeypad";

vi.mock("lucide-react", async () => {
  const { createElement } = await import("react");
  return { Delete: () => createElement("span", { "data-testid": "delete-icon" }) };
});

function Harness({ onConfirm = () => {} }: { onConfirm?: () => void }) {
  const [value, setValue] = React.useState("");
  return <POSKeypad value={value} onChange={setValue} contextLabel="Cantidad" onConfirm={onConfirm} confirmLabel="OK" />;
}

describe("POSKeypad", () => {
  it("clears the buffer when an operator starts a formula", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("pos-key-5"));
    fireEvent.click(screen.getByTestId("pos-key-op-add"));
    fireEvent.click(screen.getByTestId("pos-key-3"));
    expect(screen.getByTestId("pos-keypad-value")).toHaveTextContent("3");
    expect(screen.getByTestId("pos-keypad-expr")).toHaveTextContent("5 +");
  });

  it("evaluates the formula with the next number when confirming", () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("pos-key-5"));
    fireEvent.click(screen.getByTestId("pos-key-op-add"));
    fireEvent.click(screen.getByTestId("pos-key-3"));
    fireEvent.click(screen.getByTestId("pos-keypad-confirm"));
    expect(screen.getByTestId("pos-keypad-value")).toHaveTextContent("8");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("evaluates subtraction, multiplication and division operators", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("pos-key-9"));
    fireEvent.click(screen.getByTestId("pos-key-op-sub"));
    fireEvent.click(screen.getByTestId("pos-key-4"));
    fireEvent.click(screen.getByTestId("pos-keypad-confirm"));
    expect(screen.getByTestId("pos-keypad-value")).toHaveTextContent("5");

    fireEvent.click(screen.getByTestId("pos-key-op-mul"));
    fireEvent.click(screen.getByTestId("pos-key-3"));
    fireEvent.click(screen.getByTestId("pos-keypad-confirm"));
    expect(screen.getByTestId("pos-keypad-value")).toHaveTextContent("15");

    fireEvent.click(screen.getByTestId("pos-key-op-div"));
    fireEvent.click(screen.getByTestId("pos-key-5"));
    fireEvent.click(screen.getByTestId("pos-keypad-confirm"));
    expect(screen.getByTestId("pos-keypad-value")).toHaveTextContent("3");
  });

  it("chains operators by folding the pending number into the expression", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("pos-key-2"));
    fireEvent.click(screen.getByTestId("pos-key-op-add"));
    fireEvent.click(screen.getByTestId("pos-key-3"));
    fireEvent.click(screen.getByTestId("pos-key-op-add"));
    fireEvent.click(screen.getByTestId("pos-key-4"));
    fireEvent.click(screen.getByTestId("pos-keypad-confirm"));
    expect(screen.getByTestId("pos-keypad-value")).toHaveTextContent("9");
  });

  it("removes the pending operator with backspace when no digits are typed", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("pos-key-7"));
    fireEvent.click(screen.getByTestId("pos-key-op-mul"));
    fireEvent.click(screen.getByTestId("pos-key-back"));
    expect(screen.queryByTestId("pos-keypad-expr")).not.toBeInTheDocument();
    expect(screen.getByTestId("pos-keypad-value")).toHaveTextContent("7");
  });

  it("confirms normally when no formula is pending", () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId("pos-key-4"));
    fireEvent.click(screen.getByTestId("pos-keypad-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  describe("multiplier callback", () => {
    function MultiplierHarness({ onMultiplier = () => {} }: { onMultiplier?: (qty: number) => void }) {
      const [value, setValue] = React.useState("");
      const [multiplierQty, setMultiplierQty] = React.useState<number | null>(null);
      const handleMultiplier = (qty: number) => { setMultiplierQty(qty); onMultiplier(qty); };
      const handleClearMultiplier = () => { setMultiplierQty(null); };
      return (
        <>
          <POSKeypad value={value} onChange={setValue} contextLabel="Cantidad" onConfirm={() => {}} confirmLabel="OK" onMultiplier={handleMultiplier} multiplierQty={multiplierQty} onClearMultiplier={handleClearMultiplier} />
          <span data-testid="captured-multiplier">{multiplierQty ?? "none"}</span>
        </>
      );
    }

    it("calls onMultiplier with qty when × is pressed with a value", () => {
      const onMultiplier = vi.fn();
      render(<MultiplierHarness onMultiplier={onMultiplier} />);
      fireEvent.click(screen.getByTestId("pos-key-3"));
      fireEvent.click(screen.getByTestId("pos-key-op-mul"));
      expect(onMultiplier).toHaveBeenCalledWith(3);
      expect(screen.getByTestId("pos-keypad-value")).toHaveTextContent("0");
    });

    it("shows multiplier indicator when multiplierQty is set", () => {
      render(<MultiplierHarness />);
      fireEvent.click(screen.getByTestId("pos-key-5"));
      fireEvent.click(screen.getByTestId("pos-key-op-mul"));
      expect(screen.getByTestId("pos-keypad-multiplier")).toHaveTextContent("5 ×");
    });

    it("does not call onMultiplier for other operators", () => {
      const onMultiplier = vi.fn();
      render(<MultiplierHarness onMultiplier={onMultiplier} />);
      fireEvent.click(screen.getByTestId("pos-key-3"));
      fireEvent.click(screen.getByTestId("pos-key-op-add"));
      expect(onMultiplier).not.toHaveBeenCalled();
    });

    it("clears multiplier indicator after backspace when no value is typed", () => {
      render(<MultiplierHarness />);
      fireEvent.click(screen.getByTestId("pos-key-3"));
      fireEvent.click(screen.getByTestId("pos-key-op-mul"));
      expect(screen.getByTestId("pos-keypad-multiplier")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("pos-key-back"));
      expect(screen.queryByTestId("pos-keypad-multiplier")).not.toBeInTheDocument();
    });
  });
});
