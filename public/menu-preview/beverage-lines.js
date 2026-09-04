/**
 * Pure helpers for the menu-preview iframe (runtime.js).
 *
 * Exposed two ways:
 *   - As CommonJS exports (vitest in jsdom can `require()` this).
 *   - As a `window.VillaCarmenPreviewBeverage` global so runtime.js (vanilla
 *     browser IIFE) can consume it without a build step.
 *
 * Source of truth for the parenthetical beverage list rendered in the
 * configuracion tab preview. The previous version of runtime.js hardcoded the
 * 4 default beverages, so any custom beverage added in the backoffice never
 * showed up in the live preview until the iframe was reloaded with a cached
 * payload that included `menu.settings.beverage_options`.
 */

function formatEuro(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0 €";
  const fixed = n.toFixed(2);
  // strip trailing zeros after the decimal point, but keep at least 2 digits
  const trimmed = fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  return trimmed + " €";
}

function selectedBeverageNames(menu) {
  const raw = (menu && menu.settings && menu.settings.beverage_options) || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(function (option) {
      // Treat undefined/missing as "selected" (matches the public API shape
      // where the backend only emits {name} for selected entries).
      return option && option.selected !== false;
    })
    .map(function (option) { return String(option && option.name || "").trim(); })
    .filter(Boolean);
}

/**
 * Returns the four-line summary used in the configuracion tab preview
 * (closed_group / a_la_carte_group). When the menu carries an explicit
 * `beverage_options` list, the parenthetical line is built from the selected
 * beverages so custom additions show up live. Otherwise the legacy 4-default
 * fallback is kept for menus that haven't been re-saved since the feature
 * shipped.
 */
function groupBeverageLines(menu) {
  const beverage = (menu && menu.settings && menu.settings.beverage) || {};
  const t = String(beverage.type || "no_incluida").toLowerCase();
  const pricePerPax = Number(beverage.price_per_person || 8);
  const priceTag = "+" + formatEuro(Number.isFinite(pricePerPax) ? pricePerPax : 8) + " pax";

  const names = selectedBeverageNames(menu);
  const hasExplicit = names.length > 0;
  const parenLine = hasExplicit
    ? "(Incluye " + names.join(", ") + ")"
    : "(Incluye agua, refrescos, cerveza de barril y vinos valencianos)";

  if (t === "ilimitada") {
    return [
      "Bebida ilimitada " + priceTag,
      "(A mesa completa)",
      "Incluye bebidas desde el entrante hasta servir el postre.",
      parenLine,
    ];
  }
  if (t === "opcion") {
    return [
      "Opción a bebida ilimitada " + priceTag,
      "(A mesa completa)",
      "Incluye bebidas desde el entrante hasta servir el postre.",
      parenLine,
    ];
  }
  return ["Bebida a parte"];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { groupBeverageLines, formatEuro, selectedBeverageNames };
}
if (typeof globalThis !== "undefined") {
  globalThis.VillaCarmenPreviewBeverage = {
    groupBeverageLines,
    formatEuro,
    selectedBeverageNames,
  };
}
