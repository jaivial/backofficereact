import React from "react";
import { usePageContext } from "vike-react/usePageContext";

export default function Head() {
  const pageContext = usePageContext();
  const theme = pageContext.bo?.theme === "light" ? "light" : "dark";
  const dev = import.meta.env.DEV;

  // Apply theme before first paint (SSR + hydration), without relying on a global CSS file.
  const boot = `document.documentElement.dataset.theme=${JSON.stringify(theme)};`;

  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      {dev ? <link rel="stylesheet" href="/components/bo.css" /> : null}
      <script dangerouslySetInnerHTML={{ __html: boot }} />
    </>
  );
}
