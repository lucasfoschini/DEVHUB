# Application Shell

Code: `apps/web/src/shell/`. Navigation config: `apps/web/src/nav.ts`.

## Layout by window size

Tiers come from `breakpoints` in `@devhub/design-tokens` (`useTier`).

| Tier     | Width     | Sidebar                                      | Inspector            |
| -------- | --------- | -------------------------------------------- | -------------------- |
| compact  | < 600     | none docked; toolbar button opens overlay    | sheet from the right |
| medium   | 600–1023  | 56px icon rail; toolbar button opens overlay | sheet from the right |
| expanded | 1024–1439 | docked: expanded, compact rail or hidden     | sheet from the right |
| large    | ≥ 1440    | docked: expanded, compact rail or hidden     | docked 300px pane    |

```text
┌──────────┬──────────────────────────────────────┐
│ Sidebar  │ Toolbar                              │
│ (glass   ├───────────────────────┬──────────────┤
│ regular) │ Main (solid content)  │ Inspector    │
│          │                       │ (large only) │
│          ├───────────────────────┴──────────────┤
│          │ Status bar                           │
└──────────┴──────────────────────────────────────┘
```

## Sidebar

- Docked width 200–320px (default 232). Drag the right edge to resize; dragging below 150px snaps to the 56px rail. Double-click resets to 232px.
- The resize handle is a focusable `separator`: ←/→ (16px, Shift 48px), Home = rail, End = max.
- `Ctrl/⌘ + \` and the toolbar button show and hide it. Hidden is never the default (HIG).
- ↑/↓/Home/End move between links. The rail shows a tooltip per item.
- Overlay (compact and medium tiers): modal sheet with `elevated` material and 44px rows. It opens focused on the current page and closes on navigation or Esc, returning focus to the toggle.
- Group labels use title case. Settings sits in the last group, not pinned to the bottom edge.
- State persists in `localStorage`: `dh.sidebar` (`expanded | compact | hidden`), `dh.sidebarWidth`, `dh.inspector`.

## Materials in the shell

- Sidebar: `dh-material-regular` (functional layer).
- Overlay sheets: `dh-material-elevated` (transient layer) over a `scrim`.
- Toolbar, main content, inspector, status bar: solid. The toolbar gets its scroll-edge treatment in P3.

## Navigation behaviour

- Each route sets `document.title` to `<Module> · DevHub`.
- On navigation, main scroll resets and focus moves to the page `h1`. Initial load keeps focus at the top.
- A "Pular para o conteúdo" skip link is the first tab stop.
- Modules without a screen show an empty state with the roadmap phase from `MASTER_PLAN.md` §38. Nothing is simulated.
- `/dev/tokens` is a token specimen page outside the shell.

## Not in P2

- Breadcrumbs, back/forward, search and toolbar actions (P3).
- Enter/exit motion for sheets (P7).
- A workspace selector: there is only one personal workspace, so the sidebar shows a static label.
- A mobile bottom tab bar: native mobile is the Expo app (Phase 8). The web uses the overlay sidebar on phones.
