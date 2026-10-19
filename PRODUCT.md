# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 14 App Router, React 18, Tailwind CSS, Vitest, NestJS, Prisma and PostgreSQL. Existing stack is preserved.

## Users

- Clients who open or manage a company process through a secure link, OTP, documents and status updates.
- Operators who validate client data, request corrections, manage SLA and move processes through a Kanban workflow.
- Master administrators who oversee the operation, users and organization-level controls.

## Product Purpose

FundarMF turns company-opening work into a traceable assisted workflow. It brings client intake, validation, documents, operational queues, notifications and audit history into one place. Success means that each person can understand what is expected next, complete it without rework and see trustworthy progress.

## Positioning

The product combines a client-facing secure link with an internal assisted operation: clients complete the right step at the right time while the team retains validation, SLA, audit and Kanban control.

## Operating Context

The product is used in browser sessions on desktop and mobile. Clients may use a phone to complete forms and upload documents; internal users work through dense queues, process detail, review and dashboard surfaces.

## Capabilities and Constraints

- Preserve all existing routes, API contracts, authentication, OTP, process, document, Kanban, review, notification and audit behavior.
- Preserve the roles and terminology already encoded in the application: cliente, operador and master.
- The current snapshot does not contain a first-class standalone worker package; queue behavior is validated through the API runtime.
- The redesign must be responsive at phone widths without making desktop operational screens less efficient.
- Never fabricate customer proof, metrics, testimonials or business claims.

## Brand Commitments

The FundarMF name and existing logo asset remain recognizable. The user explicitly requested a premium, original redesign inspired by visual research from Refero, Cult UI, Shader Gradient, React Bits, 21st.dev, UIverse, Three.js, GSAP, Anime.js and Motion.

## Evidence on Hand

- Existing routes and UI components in `frontend/app` and `frontend/components`.
- Existing logo at `frontend/public/logo.png`.
- Existing automated frontend tests and the repository verification script.
- No confirmed product photography or licensed editorial image set; the redesign should use the actual product UI and restrained original visual treatments instead of invented proof imagery.

## Product Principles

- Make the next action obvious.
- Keep progress and ownership visible.
- Reduce operational noise without hiding detail.
- Treat mobile as a first-class working surface.
- Preserve trust through clear states, accessible controls and honest feedback.

## Accessibility & Inclusion

Use semantic HTML, keyboard-visible focus, readable contrast, clear labels, touch targets suitable for mobile, reduced-motion support and explicit loading, empty and error states.

## Assumptions

These are inferred from the repository and the user's brief because no structured interview tool was available in this session: the product's primary job is operational clarity across client and internal workflows; existing factual copy and behavior outrank visual invention; the requested visual direction should be premium and distinctive without sacrificing scanability for high-frequency operator work.
