# Campanas page - text editor library swap: work, PRs and worktrees

Audit of how the change of the text editor library on the Campanas
(`pages/app/campanas`) page was carried out: which PRs landed, in what
order, how the branches/worktrees were handled, and what was left pending.

## Verdict

The swap is **done, merged and verified**. The old markdown editor
(`@uiw/react-md-editor` rendered by `ui/inputs/MarkdownEditor.tsx`) was
replaced by **`react-native-enriched-html@1.1.1`** (`EnrichedTextInput`,
TipTap on web) behind `ui/inputs/RichTextEditor.tsx`.

The only outstanding item was the dead dependency left behind on purpose,
which is now cleaned up (see [Cleanup applied](#cleanup-applied)).

## The library swap: PR #249

| Field | Value |
|---|---|
| PR | [#249](https://github.com/jaivial/backofficereact/pull/249) |
| Title | feat(campanas): editor enriquecido, preview centrado con altura automatica y chrome de booking confirmation |
| Head / base | `feat/campanas-enriched-editor` - `dev` |
| Author / merged by | `jaivial` |
| Opened | 2026-09-08 12:56 UTC |
| Merged | 2026-09-08 13:17 UTC (21 min later) |
| Merge method | **squash** - single-parent commit `e14c51b` on `dev` |

Commits on the branch, in order:

1. `60d836a` chore(campanas): add react-native-enriched-html + react-native type stub
2. `6a6a80c` feat(campanas): rich text editor, auto-height centered preview and booking chrome
3. `62bcc17` refactor(campanas): drop the markdown editor replaced by the rich text one

Squashed onto `dev` as `e14c51b` (11 files: `bun.lock`, `package.json`,
`tsconfig.json`, `lib/richText/markdownHtml.ts`,
`types/react-native.d.ts`, `ui/inputs/RichTextEditor.tsx`,
`ui/inputs/index.ts`, `ui/inputs/MarkdownEditor.tsx` (deleted),
`CampaignEditor.tsx`, `CampaignPreview.tsx`, `campaignEmailChrome.ts`).

### Design decisions recorded in the PR

- **Imperative/uncontrolled editor.** Seeded with `defaultValue`, updated
  via `ref.setValue()`, read back through `onChangeHtml`.
- **SSR safety.** The library asserts a browser environment and imports its
  own CSS, so it is pulled with a dynamic `import()` after mount. Verified:
  the built server entries `pages_app_campanas*.mjs` contain **0** static
  references to the package, while the client chunk `chunk-BKYE-07Z.js`
  contains the editor.
- **Markdown stays the source of truth.** `body_markdown` is untouched; the
  HTML<->markdown bridge lives in `lib/richText/markdownHtml.ts` and only
  converts the subset `internal/api/campaign_markdown.go` can render, so no
  marker leaks as literal text into a delivered email.
- **Formatting restricted to what the backend can express.** bold, italic,
  inline code, h1/h2/h3, unordered list, blockquote, link, divider, CDN
  image. A `<textarea>` fallback renders while the library loads.
- Commit `62bcc17` deleted `MarkdownEditor.tsx` (140 lines) and *explicitly
  deferred* removing `@uiw/react-md-editor` from `package.json` "to avoid
  lockfile churn in this PR".

## The PR chain that led there

Every PR below is **MERGED** into `dev`, all squash-merged. The campaign
section went from nothing to the enriched editor in 3 days, one small PR at
a time.

| PR | Merged (UTC) | Branch | Scope |
|---|---|---|---|
| #240 | 09-06 16:10 | `feat/campanas` | Campaigns section with mobile-friendly **markdown** editor (the library now replaced) |
| #241 | 09-06 20:47 | `fix/campanas-app-version` | Show the campaigns entry in navigation |
| #242 | 09-06 21:04 | `feat/campanas-preview` | Live preview seeded with the reference email template |
| #243 | 09-06 21:19 | `feat/campanas-counters` | Reusable plus/minus counters for send rate |
| #244 | 09-06 21:26 | `fix/campanas-email-shell` | Preview renders the real email document |
| #245 | 09-07 13:53 | `feat/campanas-nueva-tabs` | Tabs for editor / preview / settings |
| #246 | 09-07 14:13 | `feat/tabs-mobile-fit-center` | fit-content tabs, centered strip < 769px |
| #247 | 09-07 18:34 | `feat/campaign-rate-ceilings-ui` | Cap ritmo de envio counters at provider limits |
| #248 | 09-07 20:23 | `fix/cdn-image-insert` | "Insertar imagen (CDN)" always lands the image in the markdown |
| **#249** | **09-08 13:17** | **`feat/campanas-enriched-editor`** | **The editor library swap** |

#248 is the only one recorded in `.agents/tasks.db`
(`task_title` = "Fix CDN image button in markdown editor", status
`completado`, tmux session `mini-cdn-image`). The library swap itself has no
entry there.

## Worktrees

**No worktree was used or kept for this work.** Evidence:

- `git worktree list` in `backoffice` reports only the main checkout on
  `dev`. `git worktree prune --dry-run -v` reports nothing stale.
- The convention directories are all **empty placeholders**:
  `/var/www/newvillacarmen/.worktree`, `/var/www/newvillacarmen/.worktrees`,
  `backoffice/.worktree`, `backoffice/.worktrees` (plus `backend/.worktrees`
  and `preactvillacarmen/.worktrees`).
- The worktree-looking paths elsewhere on disk belong to unrelated projects
  (`/var/www/wt-backend` -> `kraken/MythKraken.Backend`;
  `/var/www/dashboard-wt` -> a dangling gitdir).
- The library was evaluated outside any worktree: `/tmp/rne/` holds the
  unpacked `react-native-enriched-html-1.1.1.tgz`, timestamped 2026-09-08
  12:33 - 23 minutes before PR #249 was opened.

So the workflow was: single branch per PR off `dev`, squash-merged back,
branch kept (not deleted) afterwards. No long-lived worktree at any point.

## Branch hygiene

Because every PR is **squash-merged**, none of the branches are ancestors of
`dev`, so `git branch -d` refuses them even where the content already landed.

| Branch | Content vs `dev` |
|---|---|
| `feat/campanas-enriched-editor` | **identical** - the swap, fully landed; safely deletable |
| `feat/campanas` | differs (superseded by the swap) |
| `feat/campanas-counters` | differs (superseded) |
| `feat/campanas-preview` | differs (superseded) |
| `fix/campanas-app-version` | differs (superseded) |

`feat/campanas-enriched-editor` also still exists on `origin`. They are the
only record of the pre-squash history, so they were **not** deleted here.

## Cleanup applied

1. Removed the dead `@uiw/react-md-editor` dependency from `package.json`
   and regenerated `bun.lock`. The diff is deletions only: the direct
   dependency plus its transitive tree (`@uiw/react-markdown-preview`,
   `@uiw/copy-to-clipboard`, `@types/prismjs`, `rehype*`, `remark-*`, ...).
   No source file referenced it any more, and no `react-md-editor` artifact
   ends up in `dist/`.
2. Restored `node_modules`, which was stale and had **neither** editor
   package physically installed, so `react-native-enriched-html` could not
   resolve at runtime. Installed with `bun install --frozen-lockfile` (the
   lockfile was not modified by that step).

## Verification

- `bun run typecheck` (`tsc -p tsconfig.json --noEmit`) - passes.
- `bun run build` (`vike build`) - passes.
- `require.resolve("react-native-enriched-html")` resolves;
  `require.resolve("@uiw/react-md-editor")` no longer does.
- Server bundle for the campanas pages imports the library dynamically only
  (SSR stays alive); the client chunk carries the editor.
