import { useEffect, type RefObject } from "react";

/**
 * Gives a unique `data-testid` to every element a third-party widget renders
 * inside `ref` when the library offers no prop for it (React Flow panes,
 * renderers, edge layers, controls...). The id is `${prefix}-${name}`, where the
 * name comes from the element's library class (`react-flow__pane` -> `pane`) or
 * its first class / tag, numbered when it repeats. Elements that already carry
 * an id keep it, and SVG internals (path, circle...) are left alone.
 */
export function useTestIdBackfill(ref: RefObject<HTMLElement | null>, prefix: string): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const free = (base: string) => {
      let id = base;
      for (let n = 2; root.querySelector(`[data-testid="${CSS.escape(id)}"]`); n++) id = `${base}-${n}`;
      return id;
    };
    const fill = () => {
      for (const el of Array.from(root.querySelectorAll("*:not([data-testid])"))) {
        if (el.tagName.toLowerCase() !== "svg" && el.closest("svg")) continue;
        const cls = Array.from(el.classList).find((c) => c.startsWith("react-flow__")) ?? el.classList[0] ?? el.tagName.toLowerCase();
        const name = cls.replace(/^react-flow__/, "").replace(/[^a-zA-Z0-9-]+/g, "-");
        el.setAttribute("data-testid", free(`${prefix}-${name}`));
      }
    };
    fill();
    const observer = new MutationObserver(fill);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref, prefix]);
}
