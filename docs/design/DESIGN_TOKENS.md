# Design tokens

Source of truth: `packages/design-tokens/src/tokens.ts`. Do not duplicate values here or in components.

## Pipeline

```text
tokens.ts ──node src/build.ts──▶ dist/tokens.css (--dh-* custom properties + .dh-material-* classes)
     │                                   │
     │                                   └─▶ apps/web/src/index.css maps them into Tailwind @theme
     └─▶ test/contrast.test.ts (WCAG checks)    └─▶ (Phase 8) Expo imports tokens.ts directly
```

Tailwind's default palette, fonts, radii, shadows and breakpoints are cleared, so only DevHub tokens exist as utilities (`bg-surface`, `text-secondary`, `border-control`, `rounded-popover`, `shadow-overlay`, `text-title2`…).

## Runtime switches (on `<html>`)

| Attribute       | Values                                  | Without the attribute                                                                   |
| --------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `data-theme`    | `dark`, `light`                         | follows `prefers-color-scheme` (dark is the default)                                    |
| `data-material` | `clear`, `balanced`, `tinted`, `opaque` | `balanced`, or `opaque` when `prefers-reduced-transparency` or `prefers-contrast: more` |

`prefers-reduced-motion` sets every `--dh-duration-*` to 1ms. `prefers-contrast: more` also raises divider borders to the control border colour.

Preferences persist in `localStorage` (`dh.theme`, `dh.material`) via `apps/web/src/appearance.ts`.

## Materials

| Class                  | Use                                                 | Layer      |
| ---------------------- | --------------------------------------------------- | ---------- |
| `dh-material-solid`    | content, tables, logs, charts                       | content    |
| `dh-material-subtle`   | quiet controls on solid surfaces                    | content    |
| `dh-material-regular`  | sidebar, toolbar groups                             | functional |
| `dh-material-clear`    | floating controls over the ambient canvas only      | functional |
| `dh-material-tinted`   | functional surfaces that need more legibility       | functional |
| `dh-material-elevated` | popovers, Spotlight, Control Center, Activity Shelf | transient  |
| `dh-material-opaque`   | explicit opaque surface                             | any        |

Rules: no glass on content, no glass on glass, at most a few glass surfaces on screen at once.

## Contrast gate

`pnpm test` fails when any of these drops below WCAG AA, in both themes:

- primary, secondary, accent and the 8 status colours vs canvas, surface and raised: 4.5:1
- primary action label vs its fill and hover fill: 4.5:1
- control borders and focus ring vs canvas, surface and raised: 3:1
- primary and secondary text on regular, tinted and elevated glass, in every appearance, over canvas, surface, raised and a 25% lime region: 4.5:1

Glass is modelled as an sRGB alpha blend over a flat underlay, which ignores blur. `textTertiary` is for disabled and decorative text only.

## Decisions taken in P1

- Light mode action colour is `#4D722D` with white text: `#C6EF91` on white is 1.30:1. Signature lime stays the `brand` colour (logo, indicators) in both themes.
- Control borders: `#71757D` dark, `#7C8087` light. The plan's `#2C2F34` stays as the divider colour (1.40:1, decorative).
- Status colours differ from the brand lime, so success never reads as "brand".
- Body text is 13px for desktop density. Revisit for touch layouts in P8.
