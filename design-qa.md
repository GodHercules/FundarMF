# Design QA — sessão expirada no operador

## Source visual truth

- Source screenshot: `C:\Users\PC\AppData\Local\Temp\codex-clipboard-30fe5771-8c53-4881-ac2a-8d4b0b16d628.png`
- Source pixels: 1920 × 1080, including browser chrome; the source state is the operator dashboard with repeated “Forbidden resource” toasts.

## Implementation evidence

- Implementation screenshot: `C:\Users\PC\AppData\Local\Temp\fundarmf-session-expired-login.png`
- Local URL: `http://localhost:3014/?reason=session-expired`
- Viewport: 500 × 900 CSS px, device scale factor 1.
- State: login screen after revoked operator session; message “Sessão expirada. Faça login novamente.” visible below the form.

## Comparison

The source shows a protected operator workspace failing in place with a technical error toast. The implementation replaces that dead-end state with the branded login screen and a plain-language recovery message, preserving the existing FundarMF login hierarchy and responsive composition.

Focused region comparison was required for the login recovery state. The implementation screenshot confirms the error is attached to the login form, is readable, and does not cover the primary action.

Required fidelity surfaces:

- Fonts and typography: existing Work Sans hierarchy is preserved; the recovery message uses the same form text scale.
- Spacing and layout rhythm: the login card, fields, primary action, and message remain aligned at the mobile viewport.
- Colors and visual tokens: the existing FundarMF blue, ink, panel, and error text tokens are preserved.
- Image quality and asset fidelity: the existing FundarMF logo is rendered from the project asset; no placeholder asset was introduced.
- Copy and content: technical “Forbidden resource” is replaced by “Sessão expirada. Faça login novamente.”

## Findings

No actionable P0/P1/P2 visual differences remain for the recovery state. The source and implementation intentionally represent different states: failure in the protected dashboard versus the destination login state.

## Primary interactions tested

- Opened the login route with `reason=session-expired`.
- Confirmed the message renders inside the login form.
- Confirmed the URL is cleaned after the message is consumed.
- Automated API test confirmed revoked access calls logout once and redirects to `/?reason=session-expired`.

## Comparison history

- Initial source state: repeated technical error toasts in the operator dashboard.
- Fix: backend distinguishes missing sessions with HTTP 401; frontend calls logout, redirects to login, and presents the human-readable message.
- Post-fix evidence: `fundarmf-session-expired-login.png` at 500 × 900 CSS px.

## Final result

passed
