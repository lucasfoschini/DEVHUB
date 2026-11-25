# Apple-inspired guidelines

What Apple's HIG actually says (read 2026-11-25), and how DevHub adapts it. DevHub uses CSS approximations; none of this is native Liquid Glass.

Sources:

- HIG Materials: https://developer.apple.com/design/human-interface-guidelines/materials (changelog: Liquid Glass guidance updated 2025-09-09)
- HIG Sidebars: https://developer.apple.com/design/human-interface-guidelines/sidebars (updated 2026-06-08)
- Adopting Liquid Glass: https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
- What's New: iOS/iPadOS/macOS 27 Figma UI kits (2026-09-17)

## Documented by Apple

### Materials

- Liquid Glass is a functional layer for controls and navigation (tab bars, sidebars, toolbars) floating above content.
- Do not use Liquid Glass in the content layer. Exception: transient interaction (a slider or toggle knob while it is being dragged).
- Use it sparingly, only on the most important functional elements.
- Two variants: **regular** (blurs and adjusts luminosity; for text-heavy parts like sidebars, popovers, alerts) and **clear** (highly translucent; only over visually rich media). With clear over bright content, Apple suggests a ~35% dark dimming layer.
- Standard materials (ultra-thin, thin, regular, thick) structure the content layer. Thicker = more opaque = better contrast for fine text.
- Pick materials by semantic role, not by the colour they produce. Use vibrant/contrasting label colours on materials.
- Do not stack glass elements on top of each other. Combine adjacent glass shapes (performance and morphing).
- Users can change the glass look, reduce transparency, increase contrast, and reduce motion. Custom elements must be tested with each.

### Sidebars

- A sidebar floats in the glass layer. Content may extend beneath it.
- Show at most two levels of hierarchy. Group labels are short and title-case.
- Let people hide the sidebar, but do not hide it by default.
- macOS: consider auto-collapsing the sidebar when the window narrows.
- Do not put critical actions at the bottom of a sidebar.
- Sidebar icons use the accent colour by default. Fixed colours only when they carry meaning.

### Toolbars, menus, controls

- Group toolbar items by function. Do not mix text and icons inside one group.
- Every icon needs an accessibility label.
- Hide a whole toolbar item, never leave an empty slot.
- Content scrolling under a bar gets a scroll edge effect for legibility.
- Rounded shapes should be concentric with their container.
- Custom colours in controls need light, dark and increased-contrast variants.
- Section headers use title case, not all caps.

### Windows and modals

- Support arbitrary window sizes; reflow content continuously.
- Sheets and popovers: no extra custom background effect over the system one.
- Action sheets originate from the control that triggered them.

## DevHub adaptations (our decisions, not Apple's)

| Apple concept        | DevHub token / behaviour                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Liquid Glass regular | `material.glass.regular`: sidebar, toolbar groups, Spotlight, Control Center, Activity Shelf      |
| Liquid Glass clear   | `material.glass.clear`: only over the ambient canvas, never over data                             |
| Standard materials   | `material.solid` / `material.subtle`: content surfaces, tables, logs, charts                      |
| Reduce Transparency  | `material.opaque`: opaque surfaces, triggered by `prefers-reduced-transparency` or Control Center |
| Increase Contrast    | `prefers-contrast: more` swaps to stronger borders and text tokens                                |
| Reduce Motion        | `prefers-reduced-motion`: springs replaced by instant or fade transitions                         |
| Concentric corners   | `radius.*` derived from the container radius minus its padding                                    |

Rules that follow:

- Glass only in the functional and transient layers. Never on charts, tables, logs or code.
- No glass on top of glass. Popovers opened from the toolbar use `elevated` with its own opaque-enough fill.
- No faked macOS window controls. Tauri uses native window decorations per OS.
- Section labels in the sidebar use title case (overrides the prototype's uppercase groups).
- No SF Pro and no SF Symbols. Geist, JetBrains Mono and Lucide only.

## Reference inputs reviewed

- `references/prototypes/devhub-liquid-glass-27.html`: vanilla prototype. Reuse its light-theme values (`--accent:#4d722d`, `--text:#252b27`, `--muted:#626d65`) as P1 candidates, pending a contrast check. Drop its fake traffic lights and uppercase section labels.
- `C:\Users\lucas\Downloads\video sistema.mp4`: a phone recording of an unrelated Java Swing app in NetBeans. Not a DevHub design reference.
- Design Intelligence: the `frontend-ui` skill reference `ui-ux-pro-max.md`. The 12 videos were absorbed into that skill and no longer exist as files.
