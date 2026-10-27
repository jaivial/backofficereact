import type { RestaurantAdDesign, RestaurantAdDesignContainer, RestaurantAdDesignKind } from "../../../../../api/types";
import type { BlockContext } from "../../../../../ui/htmlBuilder/blocks";
import { parseFragment } from "../../../../../ui/htmlBuilder/document";
import { AD_STEP_ATTR, cardHtml, cardsDesign, defaultSingleDesign, newStepId, stepDesign } from "./adBlocks";

/*
 * Editing state of an HTML ad (ads_html_editor_v1). The cards page is the
 * source of truth of a multiple ad: its cards (data-ad-step) decide which
 * steps exist and in which order, and the title of a step is the heading of
 * its card. A step whose card was removed stays in the draft (undo brings the
 * card back) and is dropped on save.
 */

export type AdStepDraft = { title: string; html: string };

export type AdDraft = {
  kind: RestaurantAdDesignKind;
  container: RestaurantAdDesignContainer;
  /** Single ad: the ad. Multiple ad: the cards page (step 1). */
  main: string;
  steps: Record<string, AdStepDraft>;
};

/** Page being edited: the main page or the detail of one step. */
export type AdPage = { kind: "main" } | { kind: "step"; id: string };

/** Same dimming as the website popover (.publicAdOverlay). */
export const AD_DEFAULT_OVERLAY = "rgba(20,24,21,0.58)";

export function defaultContainer(kind: RestaurantAdDesignKind): RestaurantAdDesignContainer {
  return { max_width: kind === "multiple" ? 760 : 560, overlay: AD_DEFAULT_OVERLAY, radius: 24, background: "#ffffff" };
}

export function defaultDraft(kind: RestaurantAdDesignKind, ctx: BlockContext): AdDraft {
  if (kind === "single") return { kind, container: defaultContainer(kind), main: defaultSingleDesign(ctx), steps: {} };
  const ids = [newStepId(), newStepId()];
  const titles = ["Primera propuesta", "Segunda propuesta"];
  return {
    kind,
    container: defaultContainer(kind),
    main: cardsDesign(ctx, ids.map((id, i) => cardHtml(ctx, id, titles[i]))),
    steps: Object.fromEntries(ids.map((id, i) => [id, { title: titles[i], html: stepDesign(ctx, titles[i]) }])),
  };
}

export function draftFromDesign(design: RestaurantAdDesign): AdDraft {
  return {
    kind: design.kind,
    container: { ...defaultContainer(design.kind), ...design.container },
    main: design.main.html,
    steps: Object.fromEntries((design.steps ?? []).map((s) => [s.id ?? "", { title: s.title ?? "", html: s.html }]).filter(([id]) => id)),
  };
}

/** Step ids of the cards of a page, in document order, without repeats. */
export function stepIdsOf(mainHtml: string): string[] {
  if (!mainHtml) return [];
  const ids: string[] = [];
  for (const el of Array.from(parseFragment(mainHtml).querySelectorAll(`[${AD_STEP_ATTR}]`))) {
    const id = (el.getAttribute(AD_STEP_ATTR) ?? "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Title of a step: the first heading of its card (its text otherwise). */
export function cardTitleOf(mainHtml: string, id: string): string {
  const card = Array.from(parseFragment(mainHtml).querySelectorAll(`[${AD_STEP_ATTR}]`)).find((el) => el.getAttribute(AD_STEP_ATTR) === id);
  if (!card) return "";
  const heading = card.querySelector("h1,h2,h3,h4,h5,h6");
  return ((heading ?? card).textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Brings the steps in line with the cards: a new card gets its step (a detail
 * page titled like the card) and every step takes the title of its card.
 */
export function syncSteps(draft: AdDraft, ctx: BlockContext): AdDraft {
  if (draft.kind !== "multiple") return draft;
  let changed = false;
  const steps = { ...draft.steps };
  for (const id of stepIdsOf(draft.main)) {
    const title = cardTitleOf(draft.main, id) || "Paso";
    const current = steps[id];
    if (!current) {
      steps[id] = { title, html: stepDesign(ctx, title) };
      changed = true;
    } else if (current.title !== title) {
      steps[id] = { ...current, title };
      changed = true;
    }
  }
  return changed ? { ...draft, steps } : draft;
}

/** Steps in the draft whose card is gone: dropped on save. */
export function orphanSteps(draft: AdDraft): string[] {
  if (draft.kind !== "multiple") return [];
  const live = new Set(stepIdsOf(draft.main));
  return Object.keys(draft.steps).filter((id) => !live.has(id));
}

/** What the backend stores (the CSS is compiled there). */
export function designFromDraft(draft: AdDraft): RestaurantAdDesign {
  return {
    version: 1,
    kind: draft.kind,
    container: draft.container,
    main: { html: draft.main },
    steps: draft.kind === "multiple" ? stepIdsOf(draft.main).filter((id) => draft.steps[id]).map((id) => ({ id, title: draft.steps[id].title, html: draft.steps[id].html })) : [],
  };
}

/**
 * Switches the kind keeping the work: a single ad becomes the first step of a
 * new cards page; a multiple ad keeps the detail of its first step.
 */
export function switchKind(draft: AdDraft, kind: RestaurantAdDesignKind, ctx: BlockContext): AdDraft {
  if (draft.kind === kind) return draft;
  if (kind === "multiple") {
    const id = newStepId();
    const title = "Primera propuesta";
    return { kind, container: { ...draft.container, max_width: Math.max(draft.container.max_width ?? 560, 760) }, main: cardsDesign(ctx, [cardHtml(ctx, id, title)]), steps: { [id]: { title, html: draft.main } } };
  }
  const first = stepIdsOf(draft.main).map((id) => draft.steps[id]).find(Boolean);
  return { kind, container: { ...draft.container, max_width: Math.min(draft.container.max_width ?? 760, 560) }, main: first?.html ?? defaultSingleDesign(ctx), steps: {} };
}

/** Removes a step and every card that opens it. */
export function removeStep(draft: AdDraft, id: string): AdDraft {
  const body = parseFragment(draft.main);
  for (const el of Array.from(body.querySelectorAll(`[${AD_STEP_ATTR}]`))) if (el.getAttribute(AD_STEP_ATTR) === id) el.remove();
  const steps = { ...draft.steps };
  delete steps[id];
  return { ...draft, main: body.innerHTML.trim(), steps };
}

/** Appends a new card (and its step) to the card grid, or to the page. */
export function addStep(draft: AdDraft, ctx: BlockContext): { draft: AdDraft; id: string } {
  const id = newStepId();
  const title = `Propuesta ${stepIdsOf(draft.main).length + 1}`;
  const body = parseFragment(draft.main);
  const firstCard = body.querySelector(`[${AD_STEP_ATTR}]`);
  const host = firstCard?.parentElement ?? body.querySelector('[data-eb-role="content"]') ?? body;
  host.insertAdjacentHTML("beforeend", cardHtml(ctx, id, title));
  return { draft: { ...draft, main: body.innerHTML.trim(), steps: { ...draft.steps, [id]: { title, html: stepDesign(ctx, title) } } }, id };
}
