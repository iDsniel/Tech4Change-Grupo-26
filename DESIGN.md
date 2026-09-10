# Copiloto Operacional AI — DESIGN.md

This file is the local UI/UX contract for the Tech4Change Grupo 26 MVP. Future changes should preserve the product's industrial, evidence-first character instead of adding decoration ad hoc.

## Design intent

The interface should feel like a serious operational product: dense enough for technical users, calm enough for presentation, and explicit about evidence, uncertainty and human control.

The visual system adapts ideas from three sources without copying proprietary brand assets or requiring their component libraries:

- **Carbon Design System** — dashboard hierarchy, restrained KPI count, whitespace as hierarchy, semantic status, accessible interaction states and progressive exploration.
- **awesome-design-md** — especially the Linear and VoltAgent analyses: dark canvas, stepped surfaces, hairline borders instead of heavy shadows, compact radii, scarce accent color and product-first chrome.
- **21st.dev** — selected interaction patterns only: lightweight spotlight response on cards and frosted-glass treatment for the presentation launcher. Avoid expensive refraction/WebGL effects for a dashboard.

## Core principles

1. **Decision before decoration.** The page should answer: what needs attention, why, what should the human do next, and what happened after the action.
2. **One product accent.** Cyan is the product accent. Red/orange/amber/green are semantic operational states, not decoration.
3. **Evidence remains visible.** AI explanation never replaces z-score, multivariate evidence or the human-validation message.
4. **No surveillance aesthetic.** Do not add leaderboards, punitive rankings or competitive operator scoring. Operator UX should emphasize coaching, context and improvement.
5. **Progressive density.** KPIs summarize; insight cards prioritize; the detail pane explains. Avoid repeating the same metric at every level.
6. **Motion is supportive.** Animation can indicate focus or continuity, never hide information or block interaction. Respect `prefers-reduced-motion`.
7. **Demo mode cannot change analysis.** Presentation guidance may select, scroll and highlight existing UI only.

## Visual tokens

### Surfaces

- Canvas: `#080b10`
- Surface 1: `#0d1117`
- Surface 2: `#11161d`
- Surface 3: `#151b23`
- Surface 4: `#1a212b`
- Hairline: `rgba(226, 232, 240, 0.09)`
- Strong hairline: `rgba(226, 232, 240, 0.16)`

Hierarchy should come from surface steps and 1px borders, not large soft shadows.

### Text

- Primary: `#f4f7fa`
- Muted: `#a3afbc`
- Subtle: `#748293`

Use the system sans stack already in the app. Display headings use negative tracking; body copy stays neutral and highly readable.

### Accent and semantic color

- Product accent: `#7fe7d8`
- Success: `#72dfa4`
- Attention: `#f4c978`
- High: `#ff9c6b`
- Critical: `#ff6f7d`

Use cyan for selection, focus, primary actions, live/product identity and small highlights. Do not turn entire cards cyan.

## Shape vocabulary

- Controls: 6–8px radius
- Cards: 10–12px radius
- Major panes: 12–14px radius
- Pills: only status/toggle elements that genuinely behave as pills

Avoid the previous tendency to make every surface highly rounded.

## Dashboard hierarchy

The manager view follows a presentation-dashboard reading order:

1. **Active insights** — highest-priority KPI and first visual item.
2. **Assets monitored** — fleet scope.
3. **Multivariate agreement** — confidence-support signal.
4. **History learned** — methodological context, visually smallest.
5. **Prioritized insight list** — exploration entry point.
6. **Selected insight detail** — explanation, evidence, action and feedback.

Four top-level KPIs are the current maximum. Add a fifth only if one of the existing four is removed or demoted.

## Components

### KPI card

- Flat dark surface with hairline border.
- No decorative chart unless it adds decision value.
- Numeric value uses tabular numerals.
- Primary KPI may be wider and have one accent treatment.

### Insight card

- Compact, left-aligned and scannable.
- Severity color belongs to the severity marker/badge only.
- Selected state uses cyan hairline/accent, not a filled cyan surface.

### Evidence card

- Nested surface one level above its parent.
- Technical values remain visible and readable.
- AI copy and statistical evidence must remain visually distinguishable.

### Primary action

- Cyan fill, dark text, compact radius.
- One dominant action per local context.
- Destructive or safety-critical semantics must not borrow the cyan primary-action style.

### Demo launcher

- Frosted glass is allowed here because it is presentation chrome, not operational data.
- Use blur + translucent surface + hairline border only.
- Do not add shader/refraction/WebGL dependencies.

### Spotlight surface

- Pointer position updates CSS variables.
- Visual effect is a single radial gradient with low opacity.
- It must not change layout, content or click behavior.
- Disabled for reduced-motion users.

## Interaction and accessibility

- All interactive controls need a visible `:focus-visible` state.
- Keyboard navigation must remain functional.
- Do not rely on color alone to communicate severity.
- Maintain readable muted-text contrast on the dark canvas.
- Touch layouts should not depend on hover effects.
- Dashboard and Demo Mode must remain usable when motion is reduced.

## Do

- Lead with operational priority.
- Keep semantic colors consistent across all cards.
- Use whitespace to separate decision layers.
- Prefer a single strong CTA to several competing buttons.
- Use lightweight microinteractions that survive low-powered presentation hardware.
- Keep source disclaimers and uncertainty visible.

## Don't

- Don't add neon gradients to every panel.
- Don't turn the dashboard into a marketing landing page.
- Don't add animations that compete with telemetry.
- Don't use glass blur on every data card.
- Don't copy proprietary Linear/IBM/21st visual assets or fonts.
- Don't introduce a large UI framework just for visual polish without a functional need.
- Don't hide evidence behind the generative explanation.

## Reference material

- https://21st.dev/community/components
- https://21st.dev/blog/react-spotlight-effect-components
- https://21st.dev/blog/liquid-glass-react-components
- https://carbondesignsystem.com/data-visualization/dashboards/
- https://carbondesignsystem.com/
- https://github.com/voltagent/awesome-design-md
- https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
- https://github.com/VoltAgent/voltagent/blob/main/DESIGN.md
