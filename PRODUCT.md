# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + vanilla JavaScript, Three.js (real-time 3D diorama) and GSAP ScrollTrigger (scroll-synced camera). Static build in `dist/`, published to GitHub Pages from the public repository `Laos23/ecobat-presentacion` via GitHub Actions. Confirmed by the user on 2026-10-21.

## Users

A student team presenting orally in class. The presenter drives a laptop connected to a 16:9 classroom projector with keyboard and mouse; the audience is the teacher and classmates evaluating the project. After class the link is shared publicly.

## Product Purpose

A cinematic web presentation of EcoBat, an academic sustainability-informatics project: a web platform that identifies car batteries with a QR code, records diagnostics, suggests a management route that technicians validate, and documents traceability to an authorised destination. The presentation must make the idea understandable and memorable in a few minutes, with little text and a presenter-controlled pace. Success: the audience understands what EcoBat does and why it adds value, and can recognise the six stages.

## Positioning

EcoBat's value is information, not physical recycling: it keeps each battery's history from collection to documented destination, inspired by the EU digital battery passport (Regulation (EU) 2023/1542; passport from 18 Feb 2027 for electric-vehicle, light-means-of-transport and industrial batteries above 2 kWh) but scoped as a simplified academic prototype. Lead-acid starter batteries carry a QR code under the Regulation but no passport, so EcoBat's record is a voluntary application inspired by the passport, not the regulated passport.

## Operating Context

Six stages: collection, identification at the workshop (QR + digital record), diagnosis, classification into three routes (continue in service / specialised second-life evaluation / authorised recycling), authorised recycling with documented delivery, and an overview of traceability and indicators. Proposed prototype stack (explained, not built here): HTML/CSS/JS, Python Flask, SQLite, QR codes (Segno or qrcode), Chart.js, with versions and licences checked on 2026-10-21. Eight-week plan by the team, shown next to the verified regulatory dates of Regulation (EU) 2023/1542. Budget: the academic document gives a planning estimate of 20–120 €, explicitly not verified prices; the annex replaces it with itemised Spanish prices checked on 2026-10-21 (40.41–60.41 €, hosting optional). Related SDGs 9, 12, 13, with their official targets and indicators; how each goal links to EcoBat is the team's interpretation.

## Capabilities and Constraints

- The deliverable is a static presentation, not the EcoBat backend.
- No paid video or image generation services (Higgsfield, Monid). The scroll-world concept is rebuilt as a real-time Three.js world.
- Must work offline-capable after load from a static host; desktop landscape first, mobile legible and functional.
- Presenter controls: scroll, previous/next arrows, direct chapter navigation, fullscreen, progress indicator, static fallback for reduced motion or missing WebGL.

## Brand Commitments

- Name: EcoBat. Tagline: "Una batería. Más de una vida." Closing line: "Conocer su estado. Documentar su destino."
- Palette pinned by the brief: graphite #161819, warm white #F1EEE6, lime #C2F230, amber #E5AE50.
- Protagonist object: graphite battery with lime handle and QR label, repeated across stages.
- Art reference: `context/EcoBat-scroll-world-referencia.png` (premium miniature industrial diorama). It is a concept image, not a screenshot; its QR is decorative.
- Language: Spanish.

## Evidence on Hand

- Academic source: `context/Proyecto de sostenibilidad informática_ EcoBat.docx`.
- Plan and brief: `context/EcoBat-plan-presentacion-web.md`, `context/EcoBat-referencia-para-Claude.md`, `context/EcoBat-prompt-para-Claude.md`.
- Verified research, in `docs/investigacion/` (Spanish): 298 verified facts across 15 topics, 469 numbered sources, the consolidated report, and a map from the 121 sources cited on the web to the research. It was researched and independently verified on 21–22 October 2026, and its `README.md` lists the known gaps. Real figures on the web come from here, and the annexes cite them with numbered citations `[n]`; `node --test tests/content.test.mjs` checks the citations and sources.
- Still hypothetical: 10 batteries → 2 continue / 1 specialised evaluation / 7 recycling, and the 90 % traceability example. The research confirms that no real data exist for either (no source publishes how replaced car batteries divide between staying in service, second life and recycling); the closest real figure, Spain's official collection rate (90.85 % in 2024), measures collection, not traceability. Both must stay labelled as illustrative examples, never as data.
- Prototype examples, labelled as such: the records on the 3D screens (battery code ECB-0427, dates, batches, test readings, counters; charts without figures are illustrative). Their values stay within sourced reference ranges (for example 12.6 V at rest for a charged flooded battery, or 324 kg for 18 batteries of 18 kg), and the annexes explain them next to the real references.
- Team decisions, not research: the architecture, the eight-week plan, the budget items and the indicators proposed for a pilot. The versions, licences, regulatory dates and prices around them are cited.
- Does not exist and must not be invented: measured results from EcoBat, real customers or partners, and any emissions or contamination reduction attributed to EcoBat. Published figures about lead recycling (for example energy savings) describe the industrial process, not EcoBat results.

## Product Principles

1. Classification is suggested by software and validated by competent technicians; the app never decides safety alone.
2. Second life is conditional on specific tests; never imply any battery is reusable.
3. Reuse, specialised evaluation and recycling are distinct routes and are never counted twice.
4. Activity is not impact: traceability is not presented as an environmental reduction.
5. The presenter sets the pace; motion supports the explanation and never advances content by itself.
6. Every figure, date or proper name presented as data is backed by a verified fact and a cited source; anything without real data is a labelled example or hypothesis, never presented as real. Wording stays cautious: no absolutes such as "100 %" or "always", and "no personal data" is a design principle, not a legal guarantee.

## Accessibility & Inclusion

Projector legibility (large type, high contrast on graphite), full keyboard control, visible focus, `prefers-reduced-motion` and no-WebGL static fallback.
