import React from "react";
import { usePageContext } from "vike-react/usePageContext";

export default function Head() {
  const pageContext = usePageContext();
  const theme = pageContext.bo?.theme === "light" ? "light" : "dark";
  const dev = import.meta.env.DEV;

  // Apply theme before first paint (SSR + hydration), without relying on a global CSS file.
  const boot = `document.documentElement.dataset.theme=${JSON.stringify(theme)};(() => {
    if (typeof MutationObserver !== "function" || !document.documentElement) return;
    const attrNames = ["bis_skin_checked", "data-new-gr-c-s-check-loaded", "data-gr-ext-installed"];
    const clean = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
      for (const name of attrNames) node.removeAttribute(name);
      if (typeof node.querySelectorAll !== "function") return;
      for (const name of attrNames) {
        for (const el of node.querySelectorAll("[" + name + "]")) {
          el.removeAttribute(name);
        }
      }
    };
    clean(document.documentElement);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const name = mutation.attributeName;
          if (name && attrNames.includes(name)) mutation.target.removeAttribute(name);
          continue;
        }
        for (const node of mutation.addedNodes) clean(node);
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: attrNames,
    });
  })();`;

  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      {/* CSS is loaded via import in +Layout.tsx; Vite resolves @import from the aggregator */}
      <script dangerouslySetInnerHTML={{ __html: boot }} />
    </>
  );
}
