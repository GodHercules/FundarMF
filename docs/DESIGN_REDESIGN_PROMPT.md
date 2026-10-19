# FundarMF redesign execution prompt

## Goal

Redesign the complete FundarMF web experience in the existing Next.js 14 application so it feels premium, distinctive and coherent across client, operator and master surfaces, while preserving every existing feature, route, API contract and workflow.

## Context

FundarMF is an assisted company-opening workflow. Clients use secure links, OTP, forms, document uploads and progress tracking. Operators validate data, manage SLA and move processes through Kanban and review screens. Master users oversee the operation. The existing stack is Next.js 14, React 18, Tailwind CSS, Vitest and the current shared components in `frontend/components`. Treat the current product behavior and factual content as the source of truth.

## Scope

- Work inside `frontend/app`, `frontend/components`, `frontend/public` only when an existing asset is needed, and supporting frontend tests when UI behavior changes.
- Preserve backend code, API contracts, authentication, routing semantics, form submission, file upload, Kanban actions, notifications, error handling and data fetching.
- Create a small shared visual system: tokens, typography, surfaces, navigation, status, forms, tables, dialogs, empty/loading/error states and responsive layout primitives.
- Recompose every user-visible surface for desktop and phone widths; do not stop at the login screen.

## Direction

Use the product's real mechanism as the design idea: a company opening process is a sequence of accountable checkpoints, so the interface should feel like a calm operating room with a visible trail of progress. Use a disciplined editorial/operations visual language: deep ink, warm paper, one electric blue action accent, restrained amber for attention, strong typography, generous but purposeful spacing, flat surfaces and clear hierarchy. Avoid generic SaaS card farms, decorative gradients, glassmorphism, tiny uppercase eyebrows, fake metrics, decorative icons, hairline grids, excessive rounded pills and motion that hides content.

## UX requirements

- A user must understand where they are, what changed, what is blocking progress and what to do next within seconds.
- Use plain Portuguese labels and action names.
- Keep the operator and master views dense enough for real work, but make tables, Kanban columns and detail panels usable by thumb on mobile through safe overflow or stacked compositions.
- Keep primary actions visible and deterministic; use inline feedback for loading, empty, success and error states.
- All controls need keyboard focus, semantic labels and touch-friendly dimensions.
- Respect `prefers-reduced-motion`.

## Research use

Use the provided visual references as research for principles only. Do not copy code, brands, logos, assets, text or distinctive proprietary compositions. Prefer the existing product UI as imagery; never invent testimonials or performance claims.

## Verification

Run the frontend lint, frontend tests, frontend build and the repository lead-agent verification script. Start the local frontend and use Playwright CLI to inspect the login and representative client, operator and master routes at desktop and mobile widths, capture screenshots in `output/playwright/`, and test the key navigation and form affordances. Run the Impeccable detector on changed UI targets and fix its findings. If a check fails, correct the defect and rerun the relevant check.

## Done

The redesign is done only when the shared visual system is applied across all user-visible routes, no known functional regression remains, there is no horizontal overflow at 390px, keyboard focus and reduced motion work, and verification results are recorded with the final changed-file summary.
