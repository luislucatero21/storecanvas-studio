# StoreCanvas Interface System

## Direction and feel

StoreCanvas is an editorial production desk for app-store campaigns: calm, exact and warm. The connected campaign strip is the signature surface. Controls should feel like a compact rig around the work, while real captures and sparse outcome-led copy remain dominant.

The visual world is parchment, ink, graphite, warm shadow and one coral signal. Avoid generic SaaS card grids, neon gradients, decorative 3D, or controls that visually outrank the canvas.

## Depth and spacing

- Base spacing unit: 4px.
- Workbench density: 12–16px panel padding; 4–8px control gaps; 16–24px between distinct tool groups.
- Depth strategy: quiet tonal layers plus short layered shadows. Borders are low-contrast structure, not decoration.
- Device depth: use optical perspective and a soft directional drop shadow. Do not draw a detached rear plate behind a device.
- Inputs read as inset surfaces; floating dialogs and menus sit one tonal level above their parent.

## Hierarchy

- Focal point: selected campaign artboard/device, then its active inspector control.
- Use weight and ink opacity before adding size. Metadata is small and quiet; editable values are medium weight; campaign headlines carry the expressive scale.
- Preserve the existing Fraunces display / DM Sans body pairing and warm-editorial tokens.
- Keep production context—device, locale, connected mode, save and QA state—visible but subordinate to the canvas.

## Device rig pattern

- Flat: `rotateX 0° · rotateY 0° · perspective 1400px · depth 0`.
- Left/right optical tilt: `rotateX 2° · rotateY ±11° · perspective 2100px · depth 9px`.
- Low angle: `rotateX -9° · rotateY -4° · perspective 1900px · depth 11px`.
- High angle: `rotateX 9° · rotateY 4° · perspective 2200px · depth 8px`.
- Apply a 0.965–1 optical scale correction as tilt increases so frames stay composed inside their artboard.
- Extra slots use at most ±2° of planar rotation; avoid combining strong planar and 3D rotation.

## Connected spread patterns

### Repeated capture spread

- One source slide owns a `deviceSlot` with `spanSlots: 2` or `3`.
- The semantic `assetRef` remains stable so locale refreshes do not break the composition.
- Continuation slides hide their built-in `device` when it would compete with the repeated slot.
- The editor and deterministic renderer must both crop the same connected deck geometry.

### Message spread

- The source slide owns `captionSpan: 2` or `3`.
- Continuation slides hide `caption`; they still retain localized copy in data for later unlinking or recomposition.
- All artboards under one crossing caption share a compatible contrast surface; never carry dark ink from a light source artboard onto a dark continuation.
- Keep the message short enough to read as one statement across the seam. Device imagery sits below it and provides rhythm rather than competing hierarchy.

## Persistent Rutmia examples

- Screen 1 demonstrates the restrained left optical tilt.
- Screens 4–5 demonstrate one semantic capture repeated across two connected artboards.
- Screens 8–9 demonstrate a localized caption spanning two connected artboards.
- These examples are part of `app-store-screenshots.json` and require unit, UI render and visual QA coverage whenever the renderer changes.
