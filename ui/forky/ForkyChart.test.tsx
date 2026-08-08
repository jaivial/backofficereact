import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ForkyChart,
  parseForkyChart,
  stripForkyChartBlocks,
  ForkyChartView,
  chartSeries,
  toCsv,
} from "./ForkyChart";

const VALID = `Aquí el resumen\n\`\`\`forky-chart
{"title":"Reservas por día","type":"bar","data":[{"label":"Lun","value":12},{"label":"Mar","value":18}]}
\`\`\``;

describe("parseForkyChart", () => {
  it("parses a valid fenced block", () => {
    const spec = parseForkyChart(VALID);
    expect(spec).not.toBeNull();
    expect(spec?.title).toBe("Reservas por día");
    expect(spec?.type).toBe("bar");
    expect(spec?.data).toHaveLength(2);
  });

  it("returns null for malformed JSON", () => {
    expect(parseForkyChart("```forky-chart\n{not json}\n```")).toBeNull();
  });

  it("returns null for empty data", () => {
    expect(parseForkyChart("```forky-chart\n{\"title\":\"x\",\"data\":[]}\n```")).toBeNull();
  });

  it("returns null when no block is present", () => {
    expect(parseForkyChart("respuesta normal, sin gráfico")).toBeNull();
  });

  it("normalises unknown type to undefined (defaults to bar)", () => {
    const spec = parseForkyChart("```forky-chart\n{\"type\":\"monkey\",\"data\":[{\"label\":\"a\",\"value\":1}]}\n```");
    expect(spec?.type).toBeUndefined();
  });
});

describe("stripForkyChartBlocks", () => {
  it("removes the fenced block and keeps prose", () => {
    expect(stripForkyChartBlocks(VALID)).not.toContain("forky-chart");
    expect(stripForkyChartBlocks(VALID)).toContain("Aquí el resumen");
  });
});

describe("ForkyChart", () => {
  it("renders null when no chart block", () => {
    const { container } = render(<ForkyChart text="sin gráfico" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a chart view when a block is present", () => {
    render(<ForkyChart text={VALID} />);
    expect(screen.getByTestId("forky-chart")).toBeInTheDocument();
    expect(screen.getByTestId("forky-chart-title")).toHaveTextContent("Reservas por día");
  });

  it("shows accessible data table via details", () => {
    render(<ForkyChart text={VALID} />);
    expect(screen.getByTestId("forky-chart-details")).toBeInTheDocument();
    expect(screen.getByTestId("forky-chart-table")).toBeInTheDocument();
  });
});

describe("ForkyChartView", () => {
  it("renders a donut chart for type donut", () => {
    const spec = {
      title: "Distribución",
      type: "donut" as const,
      data: [{ label: "A", value: 5 }],
    };
    render(<ForkyChartView spec={spec} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});

describe("chartSeries", () => {
  it("derives a single series from value columns", () => {
    const series = chartSeries({ data: [{ label: "A", value: 1 }] });
    expect(series.map((s) => s.key)).toEqual(["value"]);
  });

  it("derives multiple series from extra numeric columns", () => {
    const series = chartSeries({ data: [{ label: "A", servidos: 1, reservas: 2 }] });
    expect(series.map((s) => s.key).sort()).toEqual(["reservas", "servidos"]);
  });

  it("uses explicit series with stack flags", () => {
    const series = chartSeries({
      data: [{ label: "A", a: 1, b: 2 }],
      series: [
        { key: "a", stack: true },
        { key: "b", stack: true },
      ],
    });
    expect(series.every((s) => s.stack)).toBe(true);
  });

  it("honours the stacked flag", () => {
    const series = chartSeries({ stacked: true, data: [{ label: "A", a: 1, b: 2 }] });
    expect(series.every((s) => s.stack)).toBe(true);
  });
});

describe("toCsv", () => {
  it("builds a CSV with header and rows", () => {
    const csv = toCsv({ data: [{ label: "Lun", value: 12 }, { label: "Mar", value: 18 }] });
    expect(csv).toContain("label,value");
    expect(csv).toContain("Lun,12");
  });

  it("escapes commas in labels", () => {
    const csv = toCsv({ data: [{ label: "A, B", value: 1 }] });
    expect(csv).toContain('"A, B"');
  });

  it("includes every series column", () => {
    const csv = toCsv({ data: [{ label: "Lun", servidos: 10, reservas: 5 }] });
    expect(csv).toContain("label,servidos,reservas");
  });
});

describe("ForkyChartView multi-series", () => {
  const spec = {
    title: "Comparativa",
    type: "bar" as const,
    data: [
      { label: "Lun", servidos: 10, reservas: 5 },
      { label: "Mar", servidos: 8, reservas: 7 },
    ],
  };

  it("renders both series labels", () => {
    render(<ForkyChartView spec={spec} />);
    expect(screen.getByText("servidos")).toBeInTheDocument();
    expect(screen.getByText("reservas")).toBeInTheDocument();
  });

  it("renders stacked spec without crashing", () => {
    render(<ForkyChartView spec={{ ...spec, stacked: true }} />);
    expect(screen.getByTestId("forky-chart")).toBeInTheDocument();
  });
});

describe("ForkyChart states", () => {
  it("shows an empty state when a block exists but has no usable data", () => {
    render(<ForkyChart text={"```forky-chart\n{\"data\":[]}\n```"} />);
    expect(screen.getByTestId("forky-chart-empty")).toBeInTheDocument();
  });

  it("shows a loading state while loading", () => {
    render(<ForkyChart text={VALID} loading />);
    expect(screen.getByTestId("forky-chart-loading")).toBeInTheDocument();
  });

  it("shows an error state with message", () => {
    render(<ForkyChart text={VALID} error="no se pudo dibujar" />);
    expect(screen.getByTestId("forky-chart-error")).toHaveTextContent("no se pudo dibujar");
  });
});

describe("ForkyChartView csv export", () => {
  it("renders a CSV export button", () => {
    render(<ForkyChartView spec={{ title: "x", data: [{ label: "A", value: 1 }] }} />);
    expect(screen.getByTestId("forky-chart-csv")).toBeInTheDocument();
    expect(screen.getByTestId("forky-chart-csv")).toHaveAttribute("aria-label");
  });
});
