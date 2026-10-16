# REA audit

**Inspection date:** 2026-10-15. Source obtained from the official `morluto/rea` GitHub repository into `research/rea`; the checked-out package metadata reports `rea-agents` 6.5.0. Repository license: MIT (`research/rea/LICENSE`). This clone is kept as research material, not imported as an application dependency.

## What it actually does

REA is a reverse-engineering toolkit exposed through a CLI and MCP. Its documented website provider attaches to an already-running Chrome-family browser over CDP. The source exposes browser target discovery, passive page inspection, selected script/bundle analysis, time-bounded observation of externally triggered activity, and screenshots. The implementation is under `research/rea/src/browser` (`CdpBrowserProvider`, `CdpPageCapture`, `CdpScreenshot`, and related capture modules) and `research/rea/src/application/BrowserObservationService.ts`.

The `docs/browser-observation.md` contract explicitly distinguishes passive CDP capture from Playwright scenarios: passive CDP does not launch, drive, evaluate, or mutate a page. It captures evidence such as DOM/accessibility structure, scripts/resources, safe network metadata, console/lifecycle metadata, optional selected storage metadata, workers, and viewport screenshots. It is not OCR, chess recognition, a page-operation automation API, or a mechanism for recovering private server code.

## Installation and execution

The checked-out `package.json` declares Node.js `^22.19.0 || ^24.11.0 || >=26.0.0`, npm 11.16.0, CLI names `rea` and `rea-agents`, and `npm start` as the MCP entry. Official setup is `npx rea-agents setup`; installation/setup is documented in `research/rea/docs/installation.md`. For web observation, start a separate Chrome-family browser with `--remote-debugging-port=9222` and a dedicated user-data directory, bound to loopback, then use REA's `list-browser-targets`, `inspect-web-page`, and `capture-web-screenshot` CLI/MCP workflows. The browser is owned/started by the user, and its debugging port must not be exposed to a network.

REA was not installed or attached to this session's browser: the browser tool here did not expose a local CDP endpoint, and launching a separate debug browser would not provide the browser session used for this inspection. The inspected Node version is 24.18.0, which meets REA's declared Node 24.x minimum (24.11.0). REA's documented browser workflow is technically applicable with a suitable separately launched Chrome profile, but not available through this session's browser attachment.

## Suitable and unsupported for this project

**Suitable:** observing a public page's visible DOM, accessibility tree, scripts/resources and limited network metadata; capturing a viewport screenshot; passively observing navigation/reload events; analyzing captured JavaScript without claiming source access.

**Not supported:** OCR or visual chessboard detection, FEN extraction, automated interaction with the website via passive CDP, private backend/API discovery, authenticated access without authorization, source recovery from arbitrary hosted assets, or guarantees that response bodies are available. Public page inspection does not establish server architecture.

## Chessify inspection workflow and outcome

The available browser tool was used to request the scanner URL. Browser navigation timed out twice. A public HTML fetch succeeded and showed a Vite/React single-page shell (`#root`), module script and stylesheet, but does not expose the initialized application workflow. No authentication or bypass was attempted. Since a local CDP browser endpoint was unavailable, REA could not be connected to this inspection.

If rerun with REA: start an isolated Chrome profile with loopback CDP, open only the public Chessify URL, use target listing and passive inspection, capture the visible viewport, and (where permissible) arm observation before the user manually triggers public page actions. Treat captured requests and assets as evidence, not authorization to replay private calls or redistribute proprietary code.

## Limitations and reuse

Browser capture is bounded and may omit/truncate data; REA reports exclusions/completeness rather than proving absence. SPA source maps, inaccessible network bodies, server behavior and gated states may remain unknown. REA is MIT-licensed, but its bundled third-party components retain their own licenses. No REA implementation code or assets were copied into the application. The audit describes public source documentation and actual tool availability, not successful REA capture of Chessify.
