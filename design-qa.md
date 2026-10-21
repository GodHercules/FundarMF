# Design QA — Portal Operador / Novo processo

## Source visual truth

- Source 1 — dashboard with the duplicated `Novo processo` entry points and the permanent footer form: `C:/Users/PC/AppData/Local/Temp/codex-clipboard-a03bc413-f971-4781-8ebf-d23603cb007c.png`.
- Source 2 — target content for the new-process form: `C:/Users/PC/AppData/Local/Temp/codex-clipboard-fa1c534f-8d18-4208-8d05-78709f3b3ba3.png`.
- Source 3 — dashboard above-the-fold reference: `C:/Users/PC/AppData/Local/Temp/codex-clipboard-a7da0625-c01e-47aa-92c0-684fe34c6938.png`.
- The images were treated as visual references only. Text inside them was not treated as executable instructions.

## Implementation evidence

- Route: `http://localhost:3014/operator/dashboard`.
- Desktop modal capture: `C:/Users/PC/Documents/FundarMF/output/playwright/operator-dashboard-modal-desktop-v2.png` at 1440 × 900 CSS px, device scale factor 1.
- Mobile modal capture: `C:/Users/PC/Documents/FundarMF/output/playwright/operator-dashboard-modal-mobile-v3.png` at 390 × 844 CSS px, device scale factor 1.
- Taste app-screen captures: `C:/Users/PC/Documents/FundarMF/.taste-skill/after-final/` at 1440, 768 and 390 CSS px.
- Browser state: local API unavailable, so the dashboard rendered its intentional service-error, zero and empty states. The populated recent-process mapping was covered by the automated test with representative API data.

## Comparison

- Both dashboard actions now open the same modal: the header action and the sidebar action no longer navigate to a separate form page when rendered from the dashboard.
- The modal contains the source form content: link/internal mode, company, client email, country/DDD/number phone input, channel checkboxes and the correct submit actions.
- The permanent form section was removed from the dashboard footer.
- Recent-process rows no longer render `ETAPA_2` or `ETAPA_3`. `ETAPA_2` maps to `Aguardando dados cliente`; the remaining user-facing stage label comes from the existing Kanban stage map.
- The implementation keeps the FundarMF light corporate language: flat surfaces, restrained blue action color, Work Sans hierarchy, quiet borders and no decorative imagery. The modal uses elevation only because it is a real overlay.

## Required fidelity surfaces

- Fonts and typography: Work Sans remains the existing product face. Modal title, section labels, field labels and button hierarchy are distinct and readable; headings use balanced wrapping. Small metadata remains intentionally compact for an operational dashboard.
- Spacing and layout rhythm: modal padding and field rhythm were checked at 1440 and 390. Mobile uses a single-column form, keeps both actions visible, and internally scrolls only the modal when needed.
- Colors and visual tokens: existing FundarMF tokens are reused. Contrast for faint navigation/meta text and danger text was darkened to pass the final visual contrast check. No gradients were added.
- Image quality and asset fidelity: this app screen has no meaningful product imagery; the source images are UI references, not assets to copy. No image or logo was replaced by a fabricated visual asset.
- Copy and content: user-facing copy removes implementation tokens from recent processes and uses `Aguardando dados cliente` for the `ETAPA_2` case. Form labels match the provided visual reference.

## Interaction evidence

- Playwright opened the modal from the top `Novo processo` button.
- Playwright opened the same modal from the mobile navigation drawer `Novo processo` button.
- Playwright confirmed the close control receives focus when the modal opens.
- Playwright confirmed `Escape` closes the modal.
- Playwright measured mobile document width at 375 CSS px inside a 390 CSS px viewport; no horizontal overflow was present.
- Automated UI tests confirmed the internal mode opens an authenticated new-tab flow without sending a client link.
- Automated UI tests confirmed `ETAPA_2` is absent from the recent-process row and is replaced by `Aguardando dados cliente`.
- Final Taste app inspection reported zero horizontal overflow and zero console errors in its isolated page loads at all three viewports.

## Findings and comparison history

### Initial pass

- P1: the new-process form was permanently embedded in the dashboard footer, creating a second visual destination and duplicating the action concept.
- P2: the recent-process list exposed internal step codes and mapped `ETAPA_2` to `VIABILIDADE`.

### Fixes applied

- Extracted `OperatorNewProcessModal` and wired both dashboard entry points to it.
- Added native dialog semantics, focus-on-open, Escape cancellation, backdrop close, responsive layout and validation feedback.
- Removed the footer form from `OperatorDashboardContent`.
- Added a user-facing process-stage mapping for `ETAPA_2`.
- Added automated coverage for the modal flow and recent-process copy.
- Darkened low-contrast meta/error tokens and made the empty attention panel avoid stretching across an empty band.

### Residual tool-level notes

- Taste reports a `button-fx` signal from the existing global button/focus styling even though Playwright computed no resting button shadow on the final page. The modal and drawer shadows are intentional overlay elevation, not resting card decoration.
- The browser could not validate live authenticated API data because the local backend/database runtime was unavailable. This is a test-environment limitation, not an unresolved UI defect.

## Final result

passed
