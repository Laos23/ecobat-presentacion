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

EcoBat's value is information, not physical recycling: it keeps each battery's history from collection to documented destination, inspired by the EU digital battery passport (Regulation (EU) 2023/1542, passport from 18 Feb 2027 for certain categories) but scoped as a simplified academic prototype.

## Operating Context

Six stages: collection, identification at the workshop (QR + digital record), diagnosis, classification into three routes (continue in service / specialised second-life evaluation / authorised recycling), authorised recycling with documented delivery, and an overview of traceability and indicators. Proposed prototype stack (explained, not built here): HTML/CSS/JS, Python Flask, SQLite, QR codes, Chart.js. Eight-week plan, indicative budget 20–120 €. Related SDGs 9, 12, 13.

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
- Only hypothetical figures exist: 10 batteries → 2 continue / 1 specialised evaluation / 7 recycling, and a 90 % traceability example. Both must be labelled as hypothetical simulations. No measured results, no emissions or contamination reductions, no real customers or partners exist; none may be invented.

## Product Principles

1. Classification is suggested by software and validated by competent technicians; the app never decides safety alone.
2. Second life is conditional on specific tests; never imply any battery is reusable.
3. Reuse, specialised evaluation and recycling are distinct routes and are never counted twice.
4. Activity is not impact: traceability is not presented as an environmental reduction.
5. The presenter sets the pace; motion supports the explanation and never advances content by itself.

## Accessibility & Inclusion

Projector legibility (large type, high contrast on graphite), full keyboard control, visible focus, `prefers-reduced-motion` and no-WebGL static fallback.
