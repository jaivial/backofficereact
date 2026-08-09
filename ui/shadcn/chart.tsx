import React, { createContext, useContext, useId } from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "./utils";

const THEMES = { light: ":root", dark: '[data-theme="dark"]' } as const;

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    color?: string;
    theme?: Partial<Record<keyof typeof THEMES, string>>;
  }
>;

type ChartContextValue = { config: ChartConfig };
const ChartContext = createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
  const context = useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within ChartContainer");
  return context;
}

function ChartStyle({ id, config, "data-ui": dataUi }: { id: string; config: ChartConfig; "data-ui"?: string }) {
  const entries = Object.entries(config).filter(([, value]) => value.color || value.theme);
  if (!entries.length) return null;

  const css = entries
    .flatMap(([key, value]) => {
      const variables = value.color ? [`[data-chart="${id}"] { --color-${key}: ${value.color}; }`] : [];
      const themeVariables = Object.entries(value.theme ?? {}).map(
        ([theme, color]) => `${THEMES[theme as keyof typeof THEMES]} [data-chart="${id}"] { --color-${key}: ${color}; }`,
      );
      return [...variables, ...themeVariables];
    })
    .join("\n");

  return <style data-testid={`chart-container-style-${id}`} data-ui={dataUi ?? `chart-style-${id}`} dangerouslySetInnerHTML={{ __html: css }} />;
}

export type ChartContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  config: ChartConfig;
  "data-testid"?: string;
  /** Accessible name announced for the chart. */
  "aria-label"?: string;
  /** Optional description id referenced by the chart. */
  "aria-describedby"?: string;
};

export const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(function ChartContainer(
  { id, className, children, config, "data-testid": dataTestId, "aria-label": ariaLabel, "aria-describedby": ariaDescribedBy, ...props },
  ref,
) {
  const generatedId = useId().replace(/:/g, "");
  const chartId = id ?? `chart-${generatedId}`;
  return (
    <ChartProvider value={{ config }} data-ui="chart-context-provider">
      <div
        ref={ref}
        className={cn("relative flex w-full min-w-0 flex-col justify-center", className)}
        data-chart={chartId}
        data-testid={dataTestId ?? "chart-container"}
        data-ui="chart-container"
        role="img"
        aria-label={ariaLabel ?? "Gráfico"}
        aria-describedby={ariaDescribedBy}
        {...props}
      >
        <ChartStyle id={chartId} config={config} data-ui={`chart-style-${chartId}`} />
        <ResponsiveContainerPrimitive width="100%" height="100%" data-ui="chart-responsive-container">
          {children}
        </ResponsiveContainerPrimitive>
      </div>
    </ChartProvider>
  );
});

const ChartProvider = ChartContext.Provider as React.ComponentType<any>;
const ResponsiveContainerPrimitive = RechartsPrimitive.ResponsiveContainer as React.ComponentType<any>;
const TooltipPrimitive = RechartsPrimitive.Tooltip as React.ComponentType<any>;
const LegendPrimitive = RechartsPrimitive.Legend as React.ComponentType<any>;

export function ChartTooltip(props: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) {
  return <TooltipPrimitive {...props} data-ui="chart-tooltip" />;
}

type TooltipPayloadItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: unknown;
  color?: string;
  payload?: Record<string, unknown>;
};

export type ChartTooltipContentProps = React.HTMLAttributes<HTMLDivElement> & {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelFormatter?: (label: React.ReactNode, payload: TooltipPayloadItem[]) => React.ReactNode;
  formatter?: (value: unknown, name: string, item: TooltipPayloadItem) => React.ReactNode;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  hideIndicator = false,
  indicator = "dot",
  nameKey,
  labelFormatter,
  formatter,
  className,
  ...props
}: ChartTooltipContentProps) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  const formattedLabel = labelFormatter ? labelFormatter(label, payload) : label;

  return (
    <div role="tooltip" aria-live="polite" className={cn("grid min-w-[9rem] gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs text-card-foreground shadow-xl", className)} data-ui="chart-tooltip-content" {...props}>
      {!hideLabel && formattedLabel ? <div className="font-medium" data-ui="chart-tooltip-label">{formattedLabel}</div> : null}
      <div className="grid gap-1.5" data-ui="chart-tooltip-items">
        {payload.map((item, index) => {
          const configKey = String(nameKey ? item.payload?.[nameKey] ?? item.dataKey ?? item.name ?? "" : item.dataKey ?? item.name ?? "");
          const itemConfig = config[configKey];
          const name = String(itemConfig?.label ?? item.name ?? configKey);
          const value = formatter ? formatter(item.value, name, item) : String(item.value ?? "");
          return (
            <div className="flex items-center gap-2" key={`${configKey}-${index}`} data-ui={`chart-tooltip-item-${index}`}>
              {!hideIndicator ? (
                <span
                  className={cn("inline-block shrink-0", indicator === "line" && "h-0.5 w-3", indicator === "dashed" && "h-0.5 w-3 border-t border-dashed", indicator === "dot" && "h-2 w-2 rounded-full")}
                  style={{ backgroundColor: item.color ?? `var(--color-${configKey})` }}
                  data-ui={`chart-tooltip-indicator-${index}`}
                />
              ) : null}
              <span className="text-muted-foreground" data-ui={`chart-tooltip-name-${index}`}>{name}</span>
              <span className="ml-auto font-mono font-medium tabular-nums" data-ui={`chart-tooltip-value-${index}`}>{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegend(props: React.ComponentProps<typeof RechartsPrimitive.Legend>) {
  return <LegendPrimitive {...props} data-ui="chart-legend" />;
}

type LegendPayloadItem = { dataKey?: string | number; value?: React.ReactNode; color?: string };

export type ChartLegendContentProps = React.HTMLAttributes<HTMLDivElement> & {
  payload?: LegendPayloadItem[];
  verticalAlign?: "top" | "bottom" | "middle";
  nameKey?: string;
};

// Recharts injects internal props into the Legend `content` render prop. They are
// not valid DOM attributes and React logs "does not recognize the prop" errors
// if they reach the DOM node, so they must be stripped before spreading.
const RECHARTS_LEGEND_PROPS = [
  "iconSize",
  "inactiveColor",
  "itemSorter",
  "chartWidth",
  "chartHeight",
  "payload",
  "verticalAlign",
] as const;

export function ChartLegendContent({ payload, verticalAlign = "bottom", nameKey, className, ...props }: ChartLegendContentProps) {
  const { config } = useChart();
  if (!payload?.length) return null;

  const domProps = Object.fromEntries(
    Object.entries(props).filter(([key]) => !(RECHARTS_LEGEND_PROPS as readonly string[]).includes(key)),
  );

  return (
    <div role="list" aria-label="Leyenda del gráfico" className={cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className)} data-ui="chart-legend-content" {...domProps}>
      {payload.map((item, index) => {
        const key = String(nameKey ? item[nameKey as keyof LegendPayloadItem] ?? item.dataKey ?? "" : item.dataKey ?? "");
        const itemConfig = config[key];
        return (
          <div role="listitem" className="flex items-center gap-1.5 text-xs text-muted-foreground" key={`${key}-${index}`} data-ui={`chart-legend-item-${index}`}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? `var(--color-${key})` }} data-ui={`chart-legend-indicator-${index}`} />
            <span data-ui={`chart-legend-label-${index}`}>{itemConfig?.label ?? item.value ?? key}</span>
          </div>
        );
      })}
    </div>
  );
}
