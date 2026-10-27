import { createContext, useContext } from "react";

/**
 * Prefix of every data-testid the HTML builder renders (html_builder_shared_v1):
 * "email-builder" for campaigns, "ad-builder" for web ads. One builder per page,
 * so the ids stay unique while each profile keeps its own namespace.
 */
export const BuilderTestIdContext = createContext("email-builder");

export function useBuilderTestId(): string {
  return useContext(BuilderTestIdContext);
}
