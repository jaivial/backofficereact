import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WineDetailEditor } from "./WineDetailEditor";

const mockCreate = vi.fn();
const mockPatch = vi.fn();
const mockGet = vi.fn();

vi.mock("../../../../../../../api/client", () => ({
  createClient: () => ({
    comida: {
      vinos: {
        create: (...args: any[]) => mockCreate(...args),
        patch: (...args: any[]) => mockPatch(...args),
        get: (...args: any[]) => mockGet(...args),
      },
    },
  }),
}));

const SAMPLE_VINO = {
  num: 42,
  tipo: "TINTO",
  nombre: "Rioja Reserva",
  precio: 18.5,
  descripcion: "Un vino excelente",
  bodega: "Bodega Test",
  denominacion_origen: "Rioja",
  graduacion: 13.5,
  anyo: "2018",
  active: true,
  has_foto: false,
};

describe("WineDetailEditor", () => {
  const assignSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).location;
    (window as any).location = { assign: assignSpy };
  });

  it("renders all wine fields pre-filled in edit mode", () => {
    render(<WineDetailEditor vino={SAMPLE_VINO} isNew={false} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue("Rioja Reserva")).toBeTruthy();
    expect(screen.getByDisplayValue("Bodega Test")).toBeTruthy();
    expect(screen.getByDisplayValue("Rioja")).toBeTruthy();
    expect(screen.getByDisplayValue("13.5")).toBeTruthy();
    expect(screen.getByDisplayValue("2018")).toBeTruthy();
    expect(screen.getByDisplayValue("Un vino excelente")).toBeTruthy();
  });

  it("renders empty fields and 'Nuevo vino' title for new wine", () => {
    const { container } = render(<WineDetailEditor vino={null} isNew={true} onSave={vi.fn()} />);
    expect(container.querySelector("[data-role='wine-detail-editor']")).toBeTruthy();
    expect(screen.getByText("Nuevo vino")).toBeTruthy();
  });

  it("shows dirty badge when fields change", () => {
    render(<WineDetailEditor vino={SAMPLE_VINO} isNew={false} onSave={vi.fn()} />);
    expect(screen.getByText("Sin cambios")).toBeTruthy();
    const nameInput = screen.getByDisplayValue("Rioja Reserva");
    fireEvent.change(nameInput, { target: { value: "Rioja Gran Reserva" } });
    expect(screen.getByText("Cambios sin guardar")).toBeTruthy();
  });

  it("calls api.vinos.patch on save for existing wine", async () => {
    mockPatch.mockResolvedValue({ success: true });
    mockGet.mockResolvedValue({ success: true, vino: { ...SAMPLE_VINO, nombre: "Updated" } });
    const onSave = vi.fn();
    render(<WineDetailEditor vino={SAMPLE_VINO} isNew={false} onSave={onSave} />);

    const nameInput = screen.getByDisplayValue("Rioja Reserva");
    fireEvent.change(nameInput, { target: { value: "Rioja Gran Reserva" } });

    const saveBtn = screen.getByRole("button", { name: /guardar vino/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(42, expect.objectContaining({ nombre: "Rioja Gran Reserva" }));
    });
  });

  it("calls api.vinos.create on save for new wine", async () => {
    mockCreate.mockResolvedValue({ success: true, num: 99 });
    mockGet.mockResolvedValue({ success: true, vino: { ...SAMPLE_VINO, num: 99 } });
    const onSave = vi.fn();
    render(<WineDetailEditor vino={null} isNew={true} onSave={onSave} />);

    const nameInputs = screen.getAllByRole("textbox");
    const emptyInput = nameInputs.find((el) => (el as HTMLInputElement).value === "");
    fireEvent.change(emptyInput!, { target: { value: "Nuevo Vino" } });

    const saveBtn = screen.getByRole("button", { name: /guardar vino/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ nombre: "Nuevo Vino" }));
    });
  });

  it("all HTML elements have semantic data-* attributes", () => {
    const { container } = render(<WineDetailEditor vino={SAMPLE_VINO} isNew={false} onSave={vi.fn()} />);
    const editor = container.querySelector("[data-role='wine-detail-editor']") || container;
    const all = (editor as HTMLElement).querySelectorAll("*");
    const skipped = new Set([
      "style", "script", "svg", "path", "circle", "line", "g", "defs", "use",
    ]);
    const missing: HTMLElement[] = [];
    all.forEach((node) => {
      const el = node as HTMLElement;
      if (skipped.has(el.tagName)) return;
      let parent = el.parentElement;
      let inSvg = false;
      while (parent) {
        if (parent.tagName === "svg") { inSvg = true; break; }
        parent = parent.parentElement;
      }
      if (inSvg) return;
      const hasData = Array.from(el.attributes).some(
        (a) => a.name.startsWith("data-") && a.name !== "data-testid",
      );
      if (!hasData) missing.push(el);
    });
    if (missing.length > 0) {
      const list = missing
        .map((el, i) => `  ${i + 1}. <${el.tagName.toLowerCase()}>`)
        .join("\n");
      expect.fail(`Found ${missing.length} element(s) without data-*:\n${list}`);
    }
  });
});
