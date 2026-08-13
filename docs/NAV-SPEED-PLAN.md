# Navigation Data Fetch & Content Load Speed Plan

## Goal
Increase perceived and real speed of data fetch + content load on every page navigation and tab change. Layout stays mounted (no flash/reload); only content area reloads.

## Analysis — Current State
- **Backoffice** (`backoffice/`, vike SSR): Navigation links are plain `<a href>` (NavLink.tsx). Each click triggers a full page reload (server SSR round-trip). No client-side prefetching. Layout (Sidebar/Topbar) re-renders from scratch on every navigation.
- **Preact frontend** (`preactvillacarmen/`, wouter SPA): Client-side routing (no full reload). Layout stays mounted. But each route fetches data in `useEffect` on mount with no prefetching on hover/link-intent.

## Plan

### Backoffice (repo: `backofficereact`)
- [ ] **BO-1**: Create a `<Link>` component with hover prefetch — on mouseenter/touchstart, fetch the page's JSON data ahead of time.
- [ ] **BO-2**: Enable vike `prefetchStaticFiles` so JS/CSS chunks for linked pages are prefetched on hover.
- [ ] **BO-3**: Add a navigation cache (in-memory Map) keyed by URL+params so back/forward and repeated navigations show cached data instantly while revalidating (stale-while-revalidate).
- [ ] **BO-4**: Replace `<a href>` in NavLink.tsx and Sidebar with the new `<Link>` that does client-side navigation + prefetch.
- [ ] **BO-5**: Add a content-area loading transition (skeleton/fade) so content swap is smooth — Layout must NOT remount.

### Preact frontend (repo: `preactvillacarmen`)
- [ ] **PR-1**: Add a hover-prefetch helper — on link hover/focus, pre-fetch the route's API data and cache it so navigation is instant.
- [ ] **PR-2**: Add a lightweight request cache (Map keyed by URL) for `apiGetJson` with TTL — reuse on rapid navigation/repeated visits.
- [ ] **PR-3**: Wire the prefetch cache into route components (Vinos, Postres, MenuCatalogRoute, etc.) so they read from cache first, then revalidate.

### Cleanup
- [ ] **CL**: Merge PRs, pull base branches, remove worktrees and feature branches.
