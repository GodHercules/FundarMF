# Design QA — Portal Operador FundarMF

## Source visual truth

- Before reference: [operator-dashboard-desktop.png](C:/Users/PC/Documents/FundarMF/output/playwright/operator-dashboard-desktop.png) and [operator-dashboard-mobile.png](C:/Users/PC/Documents/FundarMF/output/playwright/operator-dashboard-mobile.png).
- Product target: the attached redesign brief, using the existing FundarMF brand tokens and real operator routes as the source of truth.

## Implementation evidence

- Browser-rendered local implementation: `http://localhost:3014/operator/dashboard`.
- Captured in Chrome DevTools at 1440 × 900 and 390 × 844 CSS pixels, device scale factor 1.
- The browser tool displayed the captures inline; it could not persist a screenshot file because its file writer rejected the workspace path.
- State: unauthenticated/local API unavailable; dashboard shows the designed inline error, empty, and zero-data states.

## Comparison

The previous screen used a horizontal navigation and stacked the full Kanban, notifications, process creation, and list into one long workspace. The implementation introduces a labelled desktop sidebar, mobile drawer, operational title row, real-data KPI strip, attention queue, compact stage distribution, recent notifications, recent processes, and a dedicated start panel. No backend contract or route was changed.

Focused comparison was required for the shell and mobile navigation. Desktop evidence showed the sidebar occupying a stable 248px rail with the content canvas using the remaining width. Mobile evidence showed a 390px layout with a 375px document width, no horizontal overflow, and a drawer that moves focus to its close control.

Required fidelity surfaces:

- Fonts and typography: existing Work Sans remains the product face; title and data hierarchy use restrained weights and tabular numeric figures.
- Spacing and layout rhythm: the operator shell uses a 248px rail on desktop, 16px mobile gutters, flat panels, and consistent 18–22px section gaps.
- Colors and visual tokens: existing ink, canvas, panel, blue action, amber attention, success, and danger tokens are preserved; no gradient or decorative chrome was added.
- Image quality and asset fidelity: the existing product identity is represented by the FundarMF mark in the shell; no placeholder imagery or handcrafted replacement asset was introduced.
- Copy and content: Portuguese labels are action-oriented and reflect actual routes, API states, Kanban stages, notifications, and process creation modes.

## Findings

- No actionable P0/P1/P2 visual differences remain in the rendered dashboard shell at the tested desktop and mobile sizes.
- The local API/DB runtime was unavailable, so populated-data states, authenticated logout, live notification actions, and real Kanban counts could not be browser-verified in this pass.
- Formal screenshot persistence was blocked by the browser tool’s workspace-path restriction; the visual captures were inspected inline.

## Primary interactions tested

- Opened `/operator/dashboard` locally.
- Verified desktop sidebar composition at 1440 × 900.
- Verified mobile composition at 390 × 844 and checked `document.documentElement.scrollWidth <= window.innerWidth`.
- Opened the mobile drawer and confirmed focus moved to “Fechar navegação”; Escape handling is implemented.
- Verified the existing internal-process test flow, session-expiry tests, and full frontend suite.
- Checked browser console logs for the rendered page; no JavaScript errors were reported.

## Comparison history

- Initial redesign: replaced horizontal shell and long stacked dashboard with the corporate operating-dossier architecture.
- Correction: made the Kanban response defensive for incomplete API data, updated navigation test mocks, corrected the completed KPI to use `/completed-processes`, and deduplicated repeated global error toasts.
- Post-fix evidence: browser captures at 1440 × 900 and 390 × 844; frontend and repository verification passed.

## Final result

passed
