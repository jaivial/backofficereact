/**
 * Semantic HTML Attribute Helpers
 *
 * Provides type-safe helper functions for generating semantic HTML attributes.
 * These attributes describe the purpose/role of elements without using data-* prefix.
 *
 * Usage:
 *   <div {...containerIs("invoice-wrapper")}>
 *   <table {...tableFor("invoice-list")}>
 *   <button {...buttonAction("save-invoice")}>
 */

// =============================================================================
// Element Type Helpers
// =============================================================================

/**
 * Container element - wrapper or layout role
 * @example <div {...containerIs("page-wrapper")}>
 */
export function containerIs(role: string): { "container-is": string } {
  return { "container-is": role };
}

/**
 * Table element - data display purpose
 * @example <table {...tableFor("invoice-list")}>
 */
export function tableFor(purpose: string): { "table-for": string } {
  return { "table-for": purpose };
}

/**
 * Table section - header, body, footer
 * @example <thead {...tableSection("header")}>
 */
export function tableSection(section: "header" | "body" | "footer"): { "table-section": string } {
  return { "table-section": section };
}

/**
 * Table row type
 * @example <tr {...tableRowIs("header")}>
 */
export function tableRowIs(type: "header" | "data" | "summary"): { "table-row-is": string } {
  return { "table-row-is": type };
}

/**
 * Table column purpose
 * @example <th {...tableColumnFor("invoice-number")}>
 */
export function tableColumnFor(purpose: string): { "table-column-for": string } {
  return { "table-column-for": purpose };
}

/**
 * Form element - data collection purpose
 * @example <form {...formFor("invoice-creation")}>
 */
export function formFor(purpose: string): { "form-for": string } {
  return { "form-for": purpose };
}

/**
 * Form section - logical grouping
 * @example <fieldset {...formSection("customer-details")}>
 */
export function formSection(section: string): { "form-section": string } {
  return { "form-section": section };
}

/**
 * Button element - action purpose
 * @example <button {...buttonAction("save-invoice")}>
 */
export function buttonAction(action: string): { "button-action": string } {
  return { "button-action": action };
}

/**
 * Input element - field purpose
 * @example <input {...inputFor("customer-name")}>
 */
export function inputFor(field: string): { "input-for": string } {
  return { "input-for": field };
}

/**
 * Select element - field purpose
 * @example <select {...selectFor("status-filter")}>
 */
export function selectFor(field: string): { "select-for": string } {
  return { "select-for": field };
}

/**
 * Section element - logical area purpose
 * @example <section {...sectionIs("filters-panel")}>
 */
export function sectionIs(purpose: string): { "section-is": string } {
  return { "section-is": purpose };
}

/**
 * Modal element - dialog purpose
 * @example <div {...modalFor("send-email")}>
 */
export function modalFor(purpose: string): { "modal-for": string } {
  return { "modal-for": purpose };
}

/**
 * List element - items type
 * @example <ul {...listOf("invoices")}>
 */
export function listOf(items: string): { "list-of": string } {
  return { "list-of": items };
}

/**
 * List item role
 * @example <li {...listItemIs("invoice-row")}>
 */
export function listItemIs(role: string): { "list-item-is": string } {
  return { "list-item-is": role };
}

/**
 * Card element - entity purpose
 * @example <div {...cardFor("invoice-summary")}>
 */
export function cardFor(entity: string): { "card-for": string } {
  return { "card-for": entity };
}

/**
 * Navigation element - area purpose
 * @example <nav {...navFor("sidebar")}>
 */
export function navFor(area: string): { "nav-for": string } {
  return { "nav-for": area };
}

/**
 * Nav item role
 * @example <a {...navItemIs("menu-link")}>
 */
export function navItemIs(role: string): { "nav-item-is": string } {
  return { "nav-item-is": role };
}

/**
 * Tabs element - content type
 * @example <div {...tabsFor("invoice-views")}>
 */
export function tabsFor(content: string): { "tabs-for": string } {
  return { "tabs-for": content };
}

/**
 * Tab item role
 * @example <button {...tabIs("active-tab")}>
 */
export function tabIs(role: string): { "tab-is": string } {
  return { "tab-is": role };
}

/**
 * Icon element - representation
 * @example <svg {...iconRepresents("success")}>
 */
export function iconRepresents(meaning: string): { "icon-represents": string } {
  return { "icon-represents": meaning };
}

/**
 * Badge/Chip element - status type
 * @example <span {...badgeIs("status-active")}>
 */
export function badgeIs(type: string): { "badge-is": string } {
  return { "badge-is": type };
}

/**
 * Panel element - purpose
 * @example <div {...panelIs("details-panel")}>
 */
export function panelIs(purpose: string): { "panel-is": string } {
  return { "panel-is": purpose };
}

/**
 * Header element - context
 * @example <header {...headerIs("page-header")}>
 */
export function headerIs(context: string): { "header-is": string } {
  return { "header-is": context };
}

/**
 * Footer element - context
 * @example <footer {...footerIs("table-footer")}>
 */
export function footerIs(context: string): { "footer-is": string } {
  return { "footer-is": context };
}

/**
 * Overlay/Backdrop element
 * @example <div {...overlayIs("modal-backdrop")}>
 */
export function overlayIs(type: string): { "overlay-is": string } {
  return { "overlay-is": type };
}

/**
 * Toolbar element - actions context
 * @example <div {...toolbarFor("table-actions")}>
 */
export function toolbarFor(context: string): { "toolbar-for": string } {
  return { "toolbar-for": context };
}

/**
 * Grid element - layout purpose
 * @example <div {...gridFor("card-layout")}>
 */
export function gridFor(purpose: string): { "grid-for": string } {
  return { "grid-for": purpose };
}

/**
 * Cell element - grid position
 * @example <div {...cellIs("summary-cell")}>
 */
export function cellIs(role: string): { "cell-is": string } {
  return { "cell-is": role };
}

// =============================================================================
// Composite Helpers (Common Patterns)
// =============================================================================

/**
 * Attributes for a data table with header and body
 */
export const dataTable = {
  container: containerIs("data-table-wrapper"),
  table: tableFor("data-list"),
  header: tableSection("header"),
  body: tableSection("body"),
  headerRow: tableRowIs("header"),
  dataRow: tableRowIs("data"),
};

/**
 * Attributes for a filter panel
 */
export const filterPanel = {
  section: sectionIs("filters-panel"),
  container: containerIs("filters-wrapper"),
  form: formFor("filters"),
};

/**
 * Attributes for a modal dialog
 */
export const modalDialog = {
  overlay: overlayIs("modal-backdrop"),
  container: modalFor("dialog"),
  header: headerIs("modal-header"),
  body: containerIs("modal-body"),
  footer: footerIs("modal-footer"),
  closeButton: buttonAction("close-modal"),
};

/**
 * Attributes for a form with submit
 */
export const formWithSubmit = (purpose: string) => ({
  form: formFor(purpose),
  submitButton: buttonAction(`submit-${purpose}`),
  cancelButton: buttonAction(`cancel-${purpose}`),
});
