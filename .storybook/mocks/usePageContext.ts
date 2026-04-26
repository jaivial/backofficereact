import type { PageContext } from "vike/types";

let currentPageContext: Partial<PageContext> = {};

export function setPageContext(ctx: Partial<PageContext>) {
  currentPageContext = ctx;
}

export function usePageContext(): PageContext {
  return {
    urlPathname: currentPageContext.urlPathname ?? "/app/dashboard",
    urlParsed: currentPageContext.urlParsed ?? { search: {} },
    data: currentPageContext.data ?? {},
    bo: currentPageContext.bo,
    boRequest: currentPageContext.boRequest,
    // vike-react uses these internally
    is404: false,
    abortStatusCode: undefined,
    abortReason: undefined,
    routeParams: currentPageContext.routeParams ?? {},
    config: currentPageContext.config ?? {},
    Page: currentPageContext.Page,
    pageExports: currentPageContext.pageExports ?? {},
    exports: currentPageContext.exports ?? {},
  } as PageContext;
}
