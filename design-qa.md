# Design QA — área de documentos

## Source visual truth

- Source screenshot: `C:\Users\PC\AppData\Local\Temp\codex-clipboard-0a73c9d8-82cb-447e-8867-b8784387e818.png`
- Source pixels: 1920 × 1040, including browser chrome; comparison used the page content region.

## Implementation evidence

- Implementation screenshot: `C:\Users\PC\AppData\Local\Temp\fundarmf-design-qa-documents.png`
- Local URL: `http://localhost:3014/client/process/visual-process`
- Viewport: 1920 × 1040 CSS px, device scale factor 1.
- State: Documentos expanded, empty upload state, PDF/JPG/PNG helper copy visible.

## Comparison

Full-view comparison confirmed that the existing FundarMF hierarchy, blue grid background, two-column document cards, dashed upload surfaces, helper copy, and footer action remain aligned with the supplied screenshot.

Focused region comparison confirmed that the native text button was visually replaced by a compact upload icon control. The empty state still communicates “Nenhum arquivo selecionado”, while the supported formats remain explicit above the cards. The source contains two socios and the QA fixture contains one; this is data-state variation, not a layout mismatch.

Required fidelity surfaces:

- Fonts and typography: existing FundarMF type hierarchy and readable helper text preserved.
- Spacing and layout rhythm: document cards retain the same two-column rhythm and responsive stacking behavior.
- Colors and visual tokens: existing navy/blue/pale surfaces preserved; upload icon uses the existing blue accent.
- Image quality and asset fidelity: no source image asset is used in this control; the upload mark is a functional UI icon.
- Copy and content: PDF, JPG and PNG restrictions are stated in the section and invalid files receive an error before upload.

## Findings

No actionable P0/P1/P2 visual differences remain. The only source/fixture difference is the number of socios displayed.

## Primary interactions tested

- Expanded the Documentos accordion.
- Checked the empty upload state at desktop and mobile widths.
- Verified the file input exposes only PDF/JPG/PNG in its accept contract.
- Verified invalid extensions are rejected before upload.

## Final result

passed
