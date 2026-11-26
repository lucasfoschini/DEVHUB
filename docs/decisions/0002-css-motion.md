# ADR 0002 — Motion with CSS, not the `motion` library (2026-11-26)

## Context

P1 added spring presets to `tokens.ts` for the `motion` library, planned for P7. The P7 scope is enter/exit for four Radix overlays, the docked sidebar width and theme colours.

## Decision

- Use CSS keyframes and transitions driven by Radix `data-state`. Radix `Presence` already waits for the exit animation before unmounting.
- Do not add `motion`. Remove the unused `motion.spring` tokens.
- Reduced motion stays a single rule: `prefers-reduced-motion` sets every `--dh-duration-*` to 1ms.

## Consequences

- No new dependency and no JS animation cost.
- No real springs: curves come from `--dh-ease-*`.

## Revisit

- When a gesture needs interruptible or velocity-based motion (drag-to-dismiss, the Tauri app in Phase 3).
