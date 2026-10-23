---
name: EcoBat
description: "Una batería. Más de una vida." A night-lit miniature diorama the camera flies through, one lime trace as the story's thread.
colors:
  graphite: "#161819"
  graphite-2: "#1d2022"
  graphite-3: "#272b2e"
  ivory: "#f1eee6"
  ivory-dim: "rgba(241, 238, 230, 0.72)"
  ivory-faint: "rgba(241, 238, 230, 0.2)"
  hairline: "rgba(241, 238, 230, 0.1)"
  lime: "#c2f230"
  lime-hover: "#d3ff4a"
  amber: "#e5ae50"
typography:
  display:
    fontFamily: "'Archivo Variable', 'Archivo', system-ui, sans-serif"
    fontSize: "clamp(4rem, 2rem + 8vw, 9rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "'Archivo Variable', 'Archivo', system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 1.1rem + 4.2vw, 5.75rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "'Archivo Variable', 'Archivo', system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 0.9rem + 1.8vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 112"
  numeral:
    fontFamily: "'Archivo Variable', 'Archivo', system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.2rem + 2vw, 3.25rem)"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 125"
  body-lead:
    fontFamily: "'Archivo Variable', 'Archivo', system-ui, sans-serif"
    fontSize: "clamp(1.15rem, 0.75rem + 1vw, 1.75rem)"
    fontWeight: 400
    lineHeight: 1.32
  body:
    fontFamily: "'Archivo Variable', 'Archivo', system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.6rem + 0.7vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Archivo Variable', 'Archivo', system-ui, sans-serif"
    fontSize: "clamp(0.85rem, 0.6rem + 0.45vw, 1.05rem)"
    fontWeight: 600
rounded:
  sm: "4px"
  focus: "6px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  pill: "999px"
spacing:
  gutter: "clamp(1rem, 3.6vw, 3.5rem)"
  dock-h: "5.25rem"
  dock-h-compact: "4.5rem"
  panel-x: "1.75rem"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.pill}"
    padding: "0 1.4rem"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.lime-hover}"
    textColor: "{colors.graphite}"
  icon-button:
    backgroundColor: "rgba(29, 32, 34, 0.9)"
    textColor: "{colors.ivory}"
    rounded: "{rounded.lg}"
    size: "3rem"
  rail-item:
    backgroundColor: "transparent"
    textColor: "{colors.ivory-dim}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "3rem"
  rail-item-current:
    backgroundColor: "rgba(29, 32, 34, 0.9)"
    textColor: "{colors.ivory}"
  annex-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ivory-dim}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "2.6rem"
  annex-tab-selected:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.graphite}"
  tag:
    backgroundColor: "rgba(22, 24, 25, 0.7)"
    textColor: "{colors.ivory-dim}"
    rounded: "{rounded.pill}"
    padding: "0.35em 0.8em"
  annex-panel:
    backgroundColor: "{colors.graphite-2}"
    textColor: "{colors.ivory}"
    width: "min(46rem, 100vw)"
---

# Design System: EcoBat

## Overview

**Creative North Star: "The Night Diorama"**

EcoBat is one continuous, night-lit miniature world: a premium industrial toy model floating in a graphite void, seen from a 3/4 aerial camera that rises, sweeps and dives between stations. Each stage of the battery's life is a real place on its own rock-edged island, not a slide. The HTML layer is subordinate to the world: large expanded headlines sit lower-left in a functional shadow, and the controls are drawn as thin graphite instruments that only light up in lime when they carry state.

Light is the hierarchy. Graphite holds the night, warm ivory cutaway interiors glow under amber lamps, and a single lime trace is the only saturated light in the scene and the story's thread. The same rule governs the interface: lime marks the current, the done, the selected and the actionable; amber marks the hypothetical and the second-life route; everything else is ivory at full or reduced strength. Density is low and paced by the presenter: one idea per frame, held still for speaking.

The system is projector-first: high contrast on graphite, display sizes that read from the back of a classroom, full keyboard control, and a static fallback that keeps the same palette and type when motion or WebGL is unavailable.

**Key Characteristics:**
- Graphite night void, warm ivory interiors, amber lamps, one lime trace.
- Archivo Variable at expanded width (125) and weight 800 for every headline and numeral; regular-width Archivo for reading.
- Matte, toy-like hard-surface 3D: rounded boxes, low-poly flat-shaded rocks and foliage, emissive light strips.
- Pill-shaped controls, hairline ivory borders, translucent graphite backplates.
- Motion grammar: rise, sweep, settle into a still frame.

## Colors

A night palette of one dark, one warm white and two lights: lime for the thread and state, amber for warmth and hypotheticals.

### Primary
- **Trace Lime** (`lime`): the only saturated light. The diorama's trace, battery handle stripe and hub glow in 3D; in the UI the primary button, the current chapter number, the selected annex tab, the progress fill, focus rings, links, the "Bat" in the wordmark, list markers and completed-step dots. Brighter **Lime Flare** (`lime-hover`) is its hover state only.

### Secondary
- **Lamp Amber** (`amber`): workshop lamps and terminals in 3D; in the UI the "simulación" swatch on hypothetical tags, the second-life route, the tinted hypothetical-example box (8% fill, 35% border) and the static-view reason line.

### Neutral
- **Night Graphite** (`graphite`): page, void, fog colour (`FogExp2`, density 0.0052) and the base of every scrim and text shadow.
- **Panel Graphite** (`graphite-2`): the annex panel and translucent control backplates (at 0.9 alpha).
- **Scrollbar Graphite** (`graphite-3`): scrollbar thumb; the quietest raised tone.
- **Warm Ivory** (`ivory`): headlines, body on scenes, cutaway walls (`#d4c6ad` lit material in 3D), QR plate background.
- **Dim Ivory** (`ivory-dim`): secondary copy, inactive rail labels, table heads, captions.
- **Faint Ivory** (`ivory-faint`): outlines on tags, panels, kbd and inactive passport track.
- **Hairline** (`hairline`): row dividers in tables, routes, calendars and annex section rules.

### Named Rules
**The One Saturated Light Rule.** Lime is the only saturated light on screen, in the world and in the chrome; amber is lamp warmth, not a second accent. It marks state (current, done, selected, focus) or the single primary action; it is never decoration.

**The Labelled Hypothesis Rule.** Amber in the interface means "simulación": any hypothetical figure carries the amber-swatch tag. Amber is never used to decorate a real fact.

## Typography

**Display Font:** Archivo Variable at width 125 (with Archivo, system-ui)
**Body Font:** Archivo Variable at default width (same family)

**Character:** One family, two widths. Expanded heavy Archivo gives the headlines an engineered, industrial-signage weight; default-width Archivo keeps reading copy calm and legible on a projector.

### Hierarchy
- **Display** (800, wdth 125, `clamp(4rem, 2rem + 8vw, 9rem)`, 0.9): the EcoBat wordmark on the intro and the loading veil only.
- **Headline** (800, wdth 125, `clamp(2.4rem, 1.1rem + 4.2vw, 5.75rem)`, 0.98, max 13ch, balanced): one per scene; closing headline steps down to max 5rem and 20ch.
- **Title** (600, wdth 112, `clamp(1.5rem, 0.9rem + 1.8vw, 2.75rem)`, 1.1): the tagline under the wordmark.
- **Numeral** (800, wdth 125, tabular): route counts, static-view step numbers, calendar and goal keys (at wdth 115), always lime, amber or ivory by route.
- **Body lead** (400, `clamp(1.15rem, 0.75rem + 1vw, 1.75rem)`, 1.32, max 34ch): the one supporting sentence per scene.
- **Body** (400, `clamp(1rem, 0.6rem + 0.7vw, 1.25rem)`, 1.45; annex prose 1.05rem, max 65ch).
- **Label** (600, `clamp(0.85rem, 0.6rem + 0.45vw, 1.05rem)`): rail labels, tags, passport steps, cue. Sentence case, no tracking.

### Named Rules
**The Expanded-Is-Loud Rule.** Width 125 is reserved for weight-800 headlines, the wordmark and numerals. Reading text never uses expanded width.

**The One Sentence Rule.** A scene carries one headline and one body-lead sentence at most, plus a tag when a figure is hypothetical.

## Layout

Full-bleed fixed canvas with a fixed HTML stage on top; a tall invisible scroll space drives the camera. Scene copy is anchored bottom-left inside the `gutter`, lifted above the dock by `dock-h` plus `clamp(1.25rem, 4vh, 3rem)` and the safe-area inset; the intro anchors top-left instead. Copy width caps at `min(46rem, 58vw)`; an optional aside (the routes panel, max 30rem) sits bottom-right. Brand top-left and key hints top-right are hidden or faded on the intro.

The dock runs full width at the bottom (`dock-h`): a 2px progress hairline on its top edge, the chapter rail left, prev/next/fullscreen right. The annex is a right-side sheet `min(46rem, 100vw)` wide with `panel-x` horizontal padding. The static view is a single 78rem column with numbered steps on a `4rem 1fr` grid.

Below 900px scenes stack to a single bottom-anchored column, rail labels and key hints drop, and the scrim becomes a bottom gradient. Below 560px `dock-h` shrinks to `dock-h-compact`, the fullscreen control drops, and two-column lists collapse.

## Elevation & Depth

Depth belongs to the 3D world: ACES filmic tone mapping (exposure 1.05), a light exponential graphite fog (0.0045) for distance only, a cool hemisphere fill, a warm key and cool rim light, warm spot lights inside each cutaway, and a tight bloom (strength 0.2, radius 0.12, threshold 2.2) that only lamp heads and light strips reach; graphite, concrete and screens never pick up a haze. There is no tilt-shift or depth-of-field pass: geometry and materials must hold up sharp, and neither bloom, fog nor blur may hide a defect. Every shot is layered as foreground, mid-ground and background, and transitions pass close to real props for parallax. The HTML layer is flat; it separates from the world with translucent graphite backplates, a radial scrim and text shadows, all functional for projector legibility.

World material tints (albedos in `src/world/kit.js` and the station modules, such as warm concrete, brushed steel, lead or rubber) describe physical surfaces, not interface colour; they sit outside the UI palette on purpose and never introduce a new accent light.

### Shadow Vocabulary
- **Scene headline shadow** (`text-shadow: 0 2px 24px rgba(22, 24, 25, 0.9), 0 0 2px rgba(22, 24, 25, 0.6)`): headlines over the diorama.
- **Scene body shadow** (`text-shadow: 0 1px 14px rgba(22, 24, 25, 0.95), 0 0 2px rgba(22, 24, 25, 0.7)`): body lead over the diorama.
- **Annex sheet** (`box-shadow: -24px 0 60px rgba(0, 0, 0, 0.45)`): the only lifted surface.
- **Lime state glow** (`box-shadow: 0 0 14px rgba(194, 242, 48, 0.55)`): an active passport dot; the UI echo of the emissive trace.

### Named Rules
**The Scrim Serves Reading Rule.** Graphite scrims and text shadows exist only to keep copy legible over the world. They follow the copy's anchor (bottom-left on chapters, top-left on intro) and never become decorative vignettes.

**The Glow Means Lit Rule.** Glow is reserved for things that are lit in the world's logic: emissive lime, amber and lamp materials, and the lime state indicator. Nothing else glows.

## Shapes

Soft-industrial. Controls are pills (`pill`) or soft squares (`lg`); contained panels use `xl`; small inline marks use `sm`. Borders are 1px hairlines in ivory at low alpha, never solid ivory. Circles mark sequence: rail numbers and passport dots. In 3D, the same language holds: rounded boxes for batteries, cars and battery lids; leafy shrubs and trees with alpha-cut leaf cards; islands extruded from rounded rectangles and circles over layered rock strata, edged with segmented stone kerbs, square bollard lights and a thick flanged graphite handrail.

## Components

### Buttons
Confident and few: one lime pill per surface.
- **Shape:** full pill (`pill`), min height 3.25rem.
- **Primary:** lime fill, graphite text, weight 700 at 1.05rem, with icon gap 0.6rem.
- **Hover / Active:** Lime Flare fill and a 1px lift; 1px press on active; 0.25s `--ease-out`.
- **Icon button:** 3rem soft square (`lg`), translucent panel-graphite backplate, 1px ivory border at 0.16 alpha; hover turns border and icon lime; disabled drops to 0.35 opacity.

### Chips (Tags)
- **Style:** pill, faint-ivory outline, graphite backplate at 0.7 alpha, dim-ivory label at weight 600.
- **Simulation variant:** a 0.55em amber square swatch before the label; mandatory on every hypothetical figure.

### Cards / Containers
- **Routes panel:** `xl` corners, graphite at 0.82 alpha, faint-ivory outline, rows divided by hairlines; each row is a large numeral plus title and detail, coloured by route (lime service, amber second life, ivory recycling).
- **Hypothetical example box:** `lg` corners, amber at 8% fill with a 35% amber border.
- **Annex sheet:** panel graphite, hairline left border, the annex shadow, slides in from the right over 0.55s.

### Navigation
- **Chapter rail:** pill items with a circular numeral (2rem, 1px ivory border at 0.28 alpha) and a dim label. Hover brightens the label and turns the circle border lime. Current: label to ivory on a graphite backplate; numeral filled lime with graphite text. Done: lime-tinted circle border and lime numeral. Labels drop below 900px.
- **Progress:** 2px hairline track, lime fill scaled on X.
- **Annex tabs:** outlined pills; selected tab is lime-filled with graphite text.

### Passport Track (signature)
A horizontal stepper of hollow circles joined by a 2px faint-ivory line. Steps light lime in sequence with the lime state glow as the 3D connections draw, echoing the trace.

### Scene Overlay (signature)
Scene copy fades with scroll progress, rising 24px and un-blurring from 6px as it arrives; under reduced motion it cuts with no transform or blur. The camera rides one continuous spline whose scroll length is shared out by visual effort (metres travelled plus gaze rotation), so speed changes continuously and never brakes between chapters. It follows the scroll through a critically damped spring (0.26s, capped at 0.32 of the route per second) and settles still. Chapter navigation moves the scroll target through its own damped spring (0.5s, at most 1.5 screens per second): a second press only moves the target, so chained presses keep their speed; wheel input cancels the flight. Jumps of two or more chapters fade the veil for 320ms and cut. The horizon stays level; the subject is composed to the right third so copy keeps the left, and in portrait each key lifts the subject above the copy. Under reduced motion the scene cuts once the scroll settles (at most twice a second), keys cut at once, ambient motion holds its final state and the canvas only redraws when the shot changes.

## Do's and Don'ts

### Do:
- **Do** keep lime as the only saturated light, and spend it on state, the trace and the single primary action.
- **Do** tag every hypothetical figure with the amber-swatch "simulación" tag.
- **Do** set headlines and numerals in Archivo weight 800 at width 125, and reading text at default width.
- **Do** anchor scene copy to a corner over a graphite scrim, with the scene text shadows, so it reads on a projector.
- **Do** draw controls as thin graphite instruments: translucent graphite backplate, 1px low-alpha ivory hairline, lime only for state.
- **Do** build 3D props from the shared material grammar: graphite, ivory, procedural concrete and brushed steel, layered rock and leafy foliage, emissive lime, amber and warm-lamp strips.
- **Do** let the camera settle into a still frame before the presenter speaks; motion never advances content by itself.
- **Do** keep a 2px lime focus ring (offset 3px) on every interactive element.

### Don't:
- **Don't** introduce a new accent hue beyond lime and amber, or a lime gradient; the world has one trace.
- **Don't** use amber to decorate real facts; it means hypothetical, warmth or the second-life route.
- **Don't** use solid ivory borders or heavy drop shadows on chrome; the annex sheet is the only lifted surface.
- **Don't** set reading copy in expanded width or headlines below weight 800.
- **Don't** add glow to anything that is not lit in the world's logic.
