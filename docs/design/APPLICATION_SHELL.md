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

## Toolbar

```text
( ▤ ‹ › )  Pessoal › Projetos                                ( ▥ ⋯ )
 Navegação  breadcrumbs (nav "Trilha")                       Ações
```

- Two glass capsules (`dh-material-regular`, fully rounded) group related controls. Breadcrumbs are plain text, not capsules.
- Back/forward use the Navigation API where available (Chromium, WebView2) to disable at the ends of history. Elsewhere, back uses React Router's history index and forward stays enabled.
- Below 560px of toolbar width (measured with ResizeObserver, not the window), back/forward move into the "Mais ações" menu and the trail shows only the current page.
- "Mais ações" (Radix DropdownMenu, `elevated` material) always holds secondary actions. Today: "Copiar link da página", with a check icon and a `role="status"` announcement.
- Scroll edge: the bottom separator appears only after the main content scrolls.
- A search capsule opens Spotlight: field-like button with the shortcut on wide toolbars, icon only when narrow.
- The Control Center trigger is the last button of the actions capsule.

## Spotlight (`shell/Spotlight.tsx`)

- `Ctrl/⌘ + K` toggles it; the toolbar search button opens it. Built on cmdk inside a Radix Dialog (`elevated` material, `floating` radius, top 12vh).
- Empty query: Recentes, Navegação (12 modules), Ações (sidebar, inspector when the page has one, Central de controle, copy link), Aparência (theme and material, current choice checked).
- Typed query: one flat "Resultados" list ranked by cmdk's score. Groups are dropped while typing because cmdk ranks items inside a group but keeps groups in render order.
- The query lives in cmdk, so every open starts empty and in the default order.
- Recents: last 5 command ids in `localStorage` (`dh.spotlight.recent`). Ids that no longer resolve on the current page are skipped.
- No match: says so, and that projects, repositories and documents join the search when those modules exist. Nothing is invented.
- Focus: input on open; on close it returns to whatever opened it, unless navigation already moved focus to the new page title.
- Commands are built in `AppShell` from real state. Destructive or remote operations must never be added as direct Spotlight commands without confirmation (MASTER_PLAN §21).

## Control Center (`shell/ControlCenter.tsx`)

Radix Popover from the toolbar (or the "Central de controle" Spotlight command), `elevated` material, 340px max. Tiles inside use a solid `hover` fill: no glass on glass. Only controls that work today:

| Tile        | Controls                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aparência   | Tema: Sistema, Escuro, Claro (radio group)                                                                                                       |
| Material    | Intensity: Translúcido, Equilibrado, Tonalizado. "Reduzir transparência" switch (on = `opaque`, off = the current intensity, chosen explicitly). |
| Local Agent | Status only: "Indisponível na Web", arrives with the Desktop app (Phase 3)                                                                       |

- With no stored choice, the switch reflects the OS (`prefers-reduced-transparency` or `prefers-contrast: more`, the same conditions `tokens.css` uses) and the note says so. Any manual choice shows a "Seguir o sistema" button that clears it.
- The intensity control is disabled while transparency is reduced.
- Not included until they exist: notifications, sync, Docker, monitoring, devices. Operations in progress arrive with the Activity Shelf (P6).

## Activity Shelf (`shell/ActivityShelf.tsx`, `activity/store.ts`)

- `activity` store: producers call `start` / `update` / `dismiss`; the shelf only renders. `progress` (0..1) is set only when the source reports it; otherwise the bar is indeterminate and no percentage is shown.
- States: running, paused, completed, failed, cancelled (+ indeterminate when running without progress). Final states freeze the item, stamp `endedAt` and drop controls.
- Completed and cancelled items leave after 8s. Failed items stay until removed.
- Compact: a floating `elevated` pill at the bottom of the main column (main gets bottom padding while it is visible). One active item shows its title and % or elapsed time; several show a count. Failures are always visible in the pill.
- Expanded: Radix Popover above the pill with one row per operation: status icon + label (never colour alone), project, step or error, % and elapsed time, progress bar, and the controls the source supports (Pausar/Retomar, Cancelar, Detalhes, Remover).
- Start, completion, failure and cancellation are announced through a polite live region.
- Keyboard: pause/resume is one toggle button, so focus survives. When Cancelar or Remover makes the control disappear, focus moves to the next control in the list, or to the main content.
- Prototype data: `mocks/activitySimulator.ts` (Spotlight group "Demonstração": deploy with steps, indexing without progress, build that fails). Every simulated item carries a "Simulado" badge. No real service is called.
- No camera cut-outs, fake status bars or Dynamic Island copy (MASTER_PLAN §23).

## Materials in the shell

- Sidebar: `dh-material-regular` (functional layer).
- Overlay sheets and menus: `dh-material-elevated` (transient layer); sheets sit over a `scrim`.
- Toolbar bar, main content, inspector, status bar: solid. Only the toolbar control groups use glass.

## Navigation behaviour

- Each route sets `document.title` to `<Module> · DevHub`.
- On navigation, main scroll resets and focus moves to the page `h1`. Initial load keeps focus at the top.
- A "Pular para o conteúdo" skip link is the first tab stop.
- Modules without a screen show an empty state with the roadmap phase from `MASTER_PLAN.md` §38. Nothing is simulated.
- `/dev/tokens` is a token specimen page outside the shell.

## Motion

- Overlays animate with CSS keyframes driven by Radix `data-state` (`--animate-*` in `apps/web/src/index.css`). Radix keeps closed content mounted until the exit animation ends.
- Spotlight, Control Center and Activity Shelf: fade + scale from 0.96 (popovers grow from their trigger via `--radix-popover-content-transform-origin`). Sheets slide in from their edge. Scrims fade.
- Enter uses `ease-emphasized`; exit is shorter and uses `ease-exit`. Exits have their own `to` keyframes, because `reverse` would also flip the easing curve.
- Sidebar width (docked) and theme colours use CSS transitions with the same tokens.
- `prefers-reduced-motion: reduce` sets every `--dh-duration-*` to 1ms, so all of the above become instant. Spinners and the indeterminate bar use `motion-safe:`/`motion-reduce:`.

## Not built yet

- Searching projects, repositories, documents and integrations: each joins Spotlight with its module.
- Module-specific toolbar actions: added with each module screen.
- A workspace selector: there is only one personal workspace, so the sidebar shows a static label.
- A mobile bottom tab bar: native mobile is the Expo app (Phase 8). The web uses the overlay sidebar on phones.
