# UX audit — Phase 0 shell (P8, 2026-11-26)

Scope: the Application Shell from P2–P7 (sidebar, toolbar, Spotlight, Control Center, Activity Shelf, sheets). Module screens are empty states, so this audit does not cover module content.

## How to run

```bash
pnpm --filter @devhub/web test:e2e
```

`apps/web/e2e/audit.spec.ts` builds the app, serves it with `vite preview` and drives the installed Chrome (`channel: 'chrome'`, no browser download). For each theme (`dark`, `light`) and material (`balanced`, `clear`, `opaque`) it:

- runs axe (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on all 12 module routes, Spotlight, Control Center, Activity Shelf, a 500px window and the sidebar sheet, and fails on any violation;
- checks the glass budget (below);
- writes screenshots to `apps/web/audit-screens/` (gitignored), 30 images.

Overlays run with `reducedMotion: 'reduce'`, so axe sees settled states. The same run therefore checks that reduced motion still opens and closes every overlay.

Token contrast (text, controls, focus ring in both themes and all materials) stays in `pnpm test` (`packages/design-tokens/test/contrast.test.ts`).

## Results

18 of 18 audit tests pass. Axe reports no violations.

| Check                    | Result                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| axe WCAG 2.2 AA          | 0 violations after one fix (below)                                                                   |
| axe "incomplete"         | 2 nodes, only with Spotlight open in dark: text under the modal scrim (inert content). Not an issue. |
| Glass surfaces           | 4 at rest, at most 6 with the shelf pill and one overlay. 0 with `opaque`.                           |
| Nested glass             | 0                                                                                                    |
| Screenshots, both themes | Reviewed: hierarchy, density and materials read consistently. No clipped text.                       |

### Fixed in P8

- **Activity Shelf pill, WCAG 2.5.3 Label in Name** (axe `label-content-name-mismatch`, serious). The pill had `aria-label="Atividades"`, which hid its visible text ("Deploy do protótipo 4%") from assistive tech and voice control. It now has a visually hidden "Atividades: " prefix, so the accessible name contains the visible text.

## Glass budget

At rest the shell has 4 glass surfaces: the sidebar and the 3 toolbar groups (navigation, search, actions). The Activity Shelf pill adds 1 while operations exist. One overlay (Spotlight, Control Center, shelf popover or sheet) adds 1. The test enforces at most 6, no glass inside glass, and none when transparency is reduced.

## Known gaps

- **Performance:** one JS chunk of 488 kB (154 kB gzip), no route code splitting. Acceptable while modules are empty states; split per module route when module screens land.
- **Not covered by axe:** focus order, focus return and keyboard-only flows. These were checked by hand while building P2–P6; an automated keyboard pass is worth adding with the first module screen.
- `prefers-reduced-transparency` cannot be emulated by Playwright. The `opaque` material runs cover the same token path.
- Light theme screenshots run with `colorScheme: 'light'`; Windows high contrast (`forced-colors`) was not audited.
