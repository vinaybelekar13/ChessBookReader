# Chessify PDF Scanner public audit

**Date:** 2026-10-15
**Target:** https://chessify.me/analysis/chess-pdf-scanner
**Scope:** unauthenticated, publicly accessible page only. No access controls were bypassed.

## Evidence

- **VERIFIED:** A raw public fetch returned an HTML single-page application shell with `#root`, a Vite module asset, React vendor asset, chess vendor asset, stylesheet, and PWA manifest registration.
- **VERIFIED:** The browser navigation timed out twice; the browser page did not yield the initialized scanner interface. No screenshot of the scanner workflow could therefore be captured.
- **UNKNOWN:** How a PDF is uploaded or loaded; whether PDF/image inputs are supported; how pages render or navigate; whether detection is automatic; whether multiple diagrams are detected; how selection works; whether overlays appear; whether positions are recognized; whether correction/orientation controls exist; loading/failure states; responsive behavior; and any public integration API, model, or accuracy measurements.
- **INFERRED:** The HTML shell and vendor names indicate a client-rendered application using React and chess-related code. They do not establish the scanner's internal pipeline, API, storage, model, or UX.

## Practical consequence

This audit cannot establish the desired click-a-diagram-to-analysis workflow from the live public UI. The implementation will use that interaction as a product requirement supplied by the user, not claim it was independently observed on Chessify. No private endpoint, source code, credentials, proprietary asset, or model was accessed or reused.

## Failed attempts

1. Browser open/navigation to the scanner URL: timed out.
2. Second browser open/navigation: timed out.
3. Public HTML fetch: succeeded for the SPA shell only.
4. REA: source/docs were inspected, but no local CDP endpoint was available to attach; no REA capture of the site was produced.

No site action screenshots are attached because the rendered scanner was inaccessible. The provided public HTML is not enough to infer its user-facing behavior.
