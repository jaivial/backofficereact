import React, { useRef } from "react";
import { useIsPresent } from "motion/react";
import { usePageContext, VikeReactProviderPageContext } from "vike-react/usePageContext";

/**
 * Coordination id: route_exit_page_context_v1. While AnimatePresence plays the
 * exit of the previous route, the global pageContext already belongs to the
 * next one; without this the leaving page re-renders with foreign `data`
 * (e.g. a food-type list reading the /app/comida hub) and fires bogus loads
 * and error toasts. Exiting pages keep the last context they rendered with.
 */
export function PresencePageContext({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const present = useIsPresent();
  const lastRef = useRef(pageContext);
  if (present) lastRef.current = pageContext;
  else if (lastRef.current !== pageContext) console.info("[route_exit_page_context_v1] exit_context_frozen", lastRef.current.urlPathname);
  return <VikeReactProviderPageContext pageContext={lastRef.current}>{children}</VikeReactProviderPageContext>;
}
