# Feature 05 — Juntar mesas (merge tables)

**Rail button:** `Juntar mesas` · **Class:** NEW · **Perms:** `pos.visit.manage`

## Purpose / UX
Combine two or more occupied tables into a single comanda/visit (a large party spread
over joined tables), keeping all lines and covers, and marking the merged tables as
one group.

## UX behaviour
- `Juntar mesas` -> pick a primary visit + one or more secondary tables/visits ->
  confirm -> lines/covers consolidate into the primary; secondaries become part of the group.
- Floor shows merged tables linked; total is unified. Optional later "separar mesas" to undo.

## Backend mapping
- None today. Split (move lines between tickets) exists and informs the reverse operation.

## Gaps / changes (NEW)
- Migration: `pos_table_groups` (or `mergedIntoVisitId` on visit) to record membership.
- Endpoint `POST /pos/visits/{id}/merge` body `{ sourceVisitIds:[...], idempotencyKey }`:
  in one transaction move all lines to target ticket(s), sum covers, mark sources MERGED,
  free/link tables, append `pos_audit_events`. Must reject closed/paid sources.
- Consider `POST /pos/visits/{id}/unmerge` in a later iteration.

## TDD
- Backend integration: merge consolidates lines/covers, sources become MERGED, idempotent,
  permission-gated, rejects paid/closed sources.
- Unit (FE): merge selection model.
- Component: merge modal selection + confirm dispatch.

## E2E (dev)
Open Mesa 1 and Mesa 2 with lines -> `Juntar mesas` merge into Mesa 1 -> Mesa 1 holds all
lines, Mesa 2 freed/linked, single total.

## Milestone
Part of **M3** (depends on new merge endpoint).
