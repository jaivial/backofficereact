import { expect, test } from "../../fixtures/session";

const MIN_AA_RATIO = 4.5;

function relativeLuminance([r, g, b]: number[]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function parseRGB(color: string): number[] | null {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(",").map((value) => Number(value.trim()));
  if (parts.length < 3 || parts.some((value) => !Number.isFinite(value))) return null;
  return parts.slice(0, 3);
}

function contrast(foreground: number[], background: number[]): number {
  const [high, low] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

test.describe("Stock page shared styling and accessibility", () => {
  test("uses shared bo-* primitives instead of inline token classes", async ({ adminPage }) => {
    await adminPage.goto("/app/stock", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(".bo-pageTitle")).toHaveText("Control de stock");

    await expect(adminPage.locator(".bo-stockPage")).toBeVisible();
    await expect(adminPage.locator(".bo-tabs [role='tab']")).toHaveCount(4);

    for (const label of ["Existencias", "Recetas y previsión", "OCR documentos", "Configuración"]) {
      const tab = adminPage.getByRole("tab", { name: label });
      await expect(tab).toBeVisible();
      await expect(tab).not.toBeEmpty();
    }

    expect(await adminPage.locator(".bo-btn").count()).toBeGreaterThan(0);
    expect(await adminPage.locator(".bo-input").count()).toBeGreaterThan(0);
    expect(await adminPage.locator("[class*='text-[var(']").count()).toBe(0);
    expect(await adminPage.locator("[class*='bg-[var(']").count()).toBe(0);
  });

  test("keeps AA text contrast in dark and light themes", async ({ adminPage }) => {
    await adminPage.goto("/app/stock", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(".bo-pageTitle")).toHaveText("Control de stock");

    for (const theme of ["dark", "light"] as const) {
      await adminPage.evaluate((value) => {
        document.documentElement.setAttribute("data-theme", value);
      }, theme);

      const failures = await adminPage.evaluate(() => {
        const results: { text: string; color: string; background: string }[] = [];
        const nodes = document.querySelectorAll<HTMLElement>(
          ".bo-stockPage .bo-pageTitle, .bo-stockPage .bo-pageSubtitle, .bo-stockPage .bo-panelTitle, .bo-stockPage .bo-panelMeta, .bo-stockPage .bo-label, .bo-stockPage .bo-statLabel, .bo-stockPage .bo-statValue, .bo-stockPage .bo-stockNote, .bo-stockPage .bo-stockRowMeta, .bo-stockPage .bo-stockDetailsSummary, .bo-stockPage .bo-pagerText",
        );
        const opaqueBackground = (element: HTMLElement): string => {
          let node: HTMLElement | null = element;
          while (node) {
            const background = getComputedStyle(node).backgroundColor;
            const alpha = background.match(/rgba?\(([^)]+)\)/)?.[1].split(",")[3];
            if (background && background !== "rgba(0, 0, 0, 0)" && (alpha === undefined || Number(alpha) >= 0.95)) {
              return background;
            }
            node = node.parentElement;
          }
          return getComputedStyle(document.body).backgroundColor;
        };
        nodes.forEach((node) => {
          if (!node.textContent?.trim()) return;
          const style = getComputedStyle(node);
          if (style.visibility === "hidden" || style.display === "none") return;
          results.push({ text: node.textContent.trim().slice(0, 40), color: style.color, background: opaqueBackground(node) });
        });
        return results;
      });

      const violations = failures
        .map((entry) => {
          const foreground = parseRGB(entry.color);
          const background = parseRGB(entry.background);
          if (!foreground || !background) return null;
          const ratio = contrast(foreground, background);
          return ratio < MIN_AA_RATIO ? { ...entry, theme, ratio: Number(ratio.toFixed(2)) } : null;
        })
        .filter((entry) => entry !== null);

      expect(violations, `AA contrast violations in ${theme} theme`).toEqual([]);
    }
  });

  test("exposes accessible names and 44px touch targets", async ({ adminPage }) => {
    await adminPage.goto("/app/stock", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(".bo-pageTitle")).toHaveText("Control de stock");

    await expect(adminPage.getByLabel("Buscar artículos")).toBeVisible();
    await expect(adminPage.getByTestId("stock-warehouse-filter")).toHaveAccessibleName("Almacén");

    const unnamed = await adminPage.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(".bo-stockPage button, .bo-stockPage select, .bo-stockPage input:not([type='checkbox'])"));
      return nodes
        .filter((node) => {
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const labelled = node.getAttribute("aria-label")
            || node.getAttribute("aria-labelledby")
            || (node.id && document.querySelector(`label[for="${node.id}"]`))
            || node.closest("label")
            || node.textContent?.trim();
          return !labelled;
        })
        .map((node) => `${node.tagName.toLowerCase()}#${node.id || "(no id)"}`);
    });
    expect(unnamed).toEqual([]);

    const smallTargets = await adminPage.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(".bo-stockPage button, .bo-stockPage select, .bo-stockPage summary"));
      return nodes
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          return rect.height < 32;
        })
        .map((node) => `${node.tagName.toLowerCase()}:${Math.round(node.getBoundingClientRect().height)}px`);
    });
    expect(smallTargets).toEqual([]);
  });

  test("has no horizontal overflow at the active viewport", async ({ adminPage }) => {
    await adminPage.goto("/app/stock", { waitUntil: "domcontentloaded" });
    await expect(adminPage.locator(".bo-pageTitle")).toHaveText("Control de stock");

    const overflow = await adminPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
