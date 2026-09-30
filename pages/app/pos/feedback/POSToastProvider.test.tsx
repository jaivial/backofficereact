import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { POSToastProvider, usePOSToast } from "./POSToastProvider";

vi.mock("lucide-react", async () => {
  const { createElement } = await import("react");
  const icon = (name: string) => (props: Record<string, unknown>) => createElement("span", { "data-icon": name, ...props });
  return { AlertCircle: icon("alert"), CheckCircle2: icon("check"), Info: icon("info"), X: icon("x") };
});

function Harness() {
  const toast = usePOSToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success("Mesa abierta", "4 comensales")}>ok</button>
      <button type="button" onClick={() => toast.error("No se pudo cobrar", "El terminal rechazó la operación")}>fail</button>
      <button type="button" onClick={() => toast.info("Cargando cocina")}>info</button>
      <button type="button" onClick={() => { toast.success("Enviado"); toast.success("Cobrado"); }}>two-ok</button>
      <button type="button" onClick={() => { toast.error("Visa rechazada"); toast.error("Sin fondos"); }}>two-err</button>
    </div>
  );
}

const renderToast = () => render(<POSToastProvider><Harness /></POSToastProvider>);
const toasts = () => screen.queryAllByTestId(/^pos-toast-pos_/);

afterEach(() => vi.useRealTimers());

describe("POSToastProvider", () => {
  it("renders a success toast with its title and message", () => {
    renderToast();
    fireEvent.click(screen.getByText("ok"));
    expect(screen.getByText("Mesa abierta")).toBeInTheDocument();
    expect(screen.getByText("4 comensales")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("marks an error toast as an alert", () => {
    renderToast();
    fireEvent.click(screen.getByText("fail"));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cobrar");
    expect(alert).toHaveTextContent("El terminal rechazó la operación");
    expect(alert).toHaveAttribute("data-kind", "error");
  });

  it("keeps a success and an error on screen at the same time", () => {
    renderToast();
    fireEvent.click(screen.getByText("ok"));
    fireEvent.click(screen.getByText("fail"));
    expect(screen.getByText("Mesa abierta")).toBeInTheDocument();
    expect(screen.getByText("No se pudo cobrar")).toBeInTheDocument();
  });

  it("replaces the previous toast of the same kind", () => {
    renderToast();
    fireEvent.click(screen.getByText("two-ok"));
    expect(screen.getByText("Cobrado")).toBeInTheDocument();
    expect(screen.queryByText("Enviado")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("two-err"));
    expect(screen.getByText("Sin fondos")).toBeInTheDocument();
    expect(screen.queryByText("Visa rechazada")).not.toBeInTheDocument();
  });

  it("dismisses a toast with its close button", () => {
    renderToast();
    fireEvent.click(screen.getByText("ok"));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText("Mesa abierta")).not.toBeInTheDocument();
  });

  it("auto-dismisses on a timer, later for errors than for success", () => {
    vi.useFakeTimers();
    renderToast();
    fireEvent.click(screen.getByText("ok"));
    fireEvent.click(screen.getByText("fail"));

    act(() => { vi.advanceTimersByTime(2700); });
    expect(screen.queryByText("Mesa abierta")).not.toBeInTheDocument();
    expect(screen.getByText("No se pudo cobrar")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText("No se pudo cobrar")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no feedback", () => {
    renderToast();
    expect(screen.queryByTestId("pos-toast-wrap")).not.toBeInTheDocument();
  });

  it("throws a clear error when used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/POSToastProvider/);
    spy.mockRestore();
  });
});
