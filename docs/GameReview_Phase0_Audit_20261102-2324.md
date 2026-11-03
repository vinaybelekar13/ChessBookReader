# ChessBook Reader - Game Review Phase 0 Audit

Audit date: 2026-11-02 (Asia/Kolkata)  
Project audited: `D:\chess\BookChess\ChessBookReader`  
Scope: read-only source audit, official web research, and measurement of the four supplied visual references.  
Phase 0 made no source-code changes; this report is the audit deliverable.

## Executive summary and approval gates

The project already has a working React/TypeScript application shell, a Game Review route, chess.js, PGN import/replay, a Stockfish 19 Lite Web Worker, move evaluation/classification code, a separate interactive analysis board, a Lichess opening explorer integration, and Lichess OAuth support. Reuse these systems rather than replacing the app shell, board, or chess rules.

The Game Review menu failure had two source-level causes: Review CSS hid the library/navigation panel, and the hamburger both opened the panel on pointer-enter and toggled it on click. Phase 1 removed the competing pointer-enter handler and added a contained overlay layout for the library in the single-column Review workspace.

The four screenshots were subsequently located at `C:\Users\Asus\Downloads\img1.png` through `img4.png`; their original dimensions, board bounds, major surface colors, and visible layout measurements are documented in Section 6. The references contain both dark Analysis panels and light Review panels, and do not establish exact source fonts or every antialiased marker color.

The target repository was already dirty before this audit, including changes to `src/App.tsx`, `src/GameReview.tsx`, `src/styles.css`, and other source files plus many untracked audit artifacts. Phase 1 made only the scoped Game Review/menu changes described below in those files and added the reference-token stylesheet; unrelated pre-existing changes were preserved.

## 1. Project and worktree context

- Requested repo exists at `D:\chess\BookChess\ChessBookReader`; its `ChessBookReader.bat` starts that path through `scripts\Run-ChessBookReader.ps1`.
- The active chat working directory is a different path, `D:\chess\book-reader`; the named target repo was inspected directly. No workspace switch was performed.
- `git status --short` showed pre-existing edits in `backend/app/lichess_oauth.py`, `src/App.tsx`, `src/CoordinateTraining.tsx`, `src/GameReview.tsx`, `src/coordinate-training.css`, `src/opening-explorer-api.ts`, `src/styles.css`, and `tsconfig.app.json`; it also showed numerous untracked audit text files, backups, and component files.
- Do not overwrite or revert these changes. Before any later edits, re-read each affected file and make a timestamped backup as requested.
- No code, tests, build, or app server were run during this read-only audit. `npm run dev` was not run. The BAT launcher was not run during Phase 0.

## 2. Source files discovered

| Concern | Existing source | Audit result |
|---|---|---|
| App shell and mode navigation | `src/App.tsx` | Global topbar, hamburger, library panel, `workspaceMode` routing for books, Coordinate Training, Analysis Board, and Game Review. |
| Game Review UI | `src/GameReview.tsx` | Manual PGN file/paste import; board replay; previous/next navigation; two tabs; engine launch/cancel; simple key-moment list and move filters. |
| Game Review layout/styles | `src/styles.css`, `src/game-review-reference-tokens.css` | Existing global theme plus measured, scoped screenshot tokens and Review-only layout overrides. The active component uses the `.gr-live` namespace. |
| PGN parsing | `src/pgn-import.ts`, `src/review-pgn.ts` | Uses `chess.js`; validates/replays mainline moves and starting FEN; Review positions retain SAN/UCI-square data and FENs. Current Review wrapper retains headers/mainline, not a full editable tree of comments/NAGs/RAVs. |
| Analysis/classifications | `src/review-analysis.ts` | White-perspective evaluation and centipawn-loss tiers for Best/Excellent/Good/Inaccuracy/Mistake/Blunder only. The footer calls these provisional, not Chess.com ratings. |
| Review engine | `src/review-engine.ts` | Own Stockfish worker; UCI initialization; sequential `position fen` / `go depth`; handles `info`, `bestmove`, progress and cancellation. The score array is position-ordered but individual result records do not carry the FEN key. |
| General engine | `src/stockfish.ts` | Existing live engine can queue a new FEN, sends `stop` for an active search, and parses scores as White-positive. It is used by the book analysis workspace. |
| Lichess analysis engine | `src/components/LichessAnalysis/stockfishWorkerClient.ts` | Has FEN-aware callbacks, worker search/cancellation, lines and an analysis UI. It also contains fixed cached positions and a heuristic fallback; do not present those fallback outputs as genuine Stockfish analysis. |
| Analysis board | `src/components/LichessAnalysis/LichessAnalysisBoard.tsx`, `ChessboardView.tsx`, `EvaluationBar.tsx`, `EnginePanel.tsx`, `MoveListPanel.tsx`, `BoardControlsBar.tsx` | Existing interactive board, navigation, evaluation bar, engine panel, opening/explorer controls, flip and board annotations are reusable after inspecting each behavior. This is a separate workspace, not the current Review board. |
| Openings | `src/components/LichessAnalysis/openingDatabase.ts`, `openingWikiData.ts`, `src/opening-explorer.ts`, `src/opening-explorer-api.ts` | Existing local opening recognition, Lichess explorer service and opening/article integration. Not wired into current Game Review statistics. |
| Lichess backend | `backend/app/lichess_oauth.py`, `backend/app/main.py` | OAuth and authenticated/public Lichess Opening Explorer routes exist. No username-based game archive importer was found. |
| Local persistence | `src/storage.ts` | IndexedDB stores books, book sessions, and settings. There is no review-game/analysis store in the current schema. |
| Existing Stockfish assets | `public/stockfish/stockfish-19-lite-single.js`, `public/stockfish/stockfish-19-lite-single.wasm` | Stockfish 19 Lite is already bundled; no new engine dependency is needed. |
| Existing tests | `src/review-pgn.test.ts`, `src/review-analysis.test.ts`, `src/review-engine.test.ts`, `src/stockfish.test.ts`, `src/App.test.tsx`, plus PGN/opening/storage/chess-state tests | Unit coverage exists for core review PGN, scoring, UCI sequencing, mate, cancellation and related modules. No dedicated hamburger navigation test exists; Phase 1 navigation was browser-tested manually. |
| Package and launcher | `package.json`, `ChessBookReader.bat` | React 19, Vite, TypeScript, Vitest; `chess.js` and `lucide-react` already installed. No extra chessboard dependency is indicated. |

### Current component dependency map

```text
App.tsx
  ├─ topbar / hamburger / library navigation
  ├─ workspaceMode === "game-review" -> GameReview.tsx
  │    ├─ review-pgn.ts -> pgn-import.ts -> chess.js
  │    ├─ review-engine.ts -> public/stockfish/stockfish-19-lite-single.js/.wasm
  │    └─ review-analysis.ts -> ReviewEngine + EngineScore
  ├─ workspaceMode === "analysis" -> LichessAnalysisBoard
  │    ├─ ChessboardView / EvaluationBar / EnginePanel / MoveListPanel / controls
  │    ├─ stockfishWorkerClient.ts -> same Stockfish assets
  │    ├─ openingDatabase / openingWikiData / opening-explorer-api.ts
  │    └─ backend/app/lichess_oauth.py -> Lichess explorer/OAuth
  ├─ workspaceMode === "coordinate-training" -> CoordinateTraining.tsx
  └─ existing PDF/book reader + storage.ts (IndexedDB books/sessions/settings)
```

## 3. Menu bug: source-level root cause

1. `src/App.tsx` owns `libraryOpen`; the navigation `<aside>` is rendered only when this state is true.
2. Before Phase 1, the hamburger used both `onMouseEnter={() => setLibraryOpen(true)}` and a click toggle. Pointer-enter therefore queued an open before the click toggle, which closed the panel. This affected all workspaces.
3. Review mode also had two CSS rules that hid `.library-panel`; its one-column grid meant removing the hide rule alone would have displaced or overlaid Review content unpredictably.
4. Phase 1 removed the competing pointer-enter handler, exposed `aria-expanded`/`aria-controls`, closes the menu on entry to Game Review, and positions the existing library panel as an absolute overlay within the Review workspace. The selector does not change other workspace grids.
5. Browser checks verified open/close in Review, navigation to All Books and Coordinate Training, return to Review, and that the overlay stays within the workspace bounds.

## 4. Existing Game Review behavior and missing capability

| Feature | Current state |
|---|---|
| PGN input | Local file and paste supported. No username import. |
| Board | Replays FEN positions with `chess.js`; squares are rendered as static divs, no move input or board-flip control in Game Review. |
| Engine | Whole-game sequential evaluation at a chosen depth. A cancelled review worker is terminated. No review-specific MultiPV, Threads, Hash, go movetime, variation animation, or engine settings UI was found. |
| Position correctness | `review-engine.ts` starts each request with the corresponding FEN, parses side-to-move scores into White perspective, and resets its latest score between positions. UI uses a run token to ignore late callbacks. Persisted evaluation records are not keyed with FEN/depth/engine version. |
| Move classification | Six ordinary tiers only; centipawn thresholds are fixed at 10/30/80/150/300. No Brilliant, Great, Book, Miss, tactical/missed-win logic, opening-book boundary or player filter. These are explicitly provisional thresholds, not Chess.com-equivalent output. |
| Critical moments | A fixed `>80 cp` loss list. No detection of defensive resources, missed wins, missed tactics, evaluation swing/critical moments, or last book move. |
| Graph | No evaluation graph in current Game Review UI. |
| Statistics | Shows moves analysed and counts of Best, Inaccuracy, and Mistake/Blunder. No accuracy, performance/game rating, phase statistics, opening performance or engine-derived result summary. Phase 1 corrected the combined Mistake/Blunder count grouping and added a clickable summary for the six existing classification tiers. |
| Retry / Show / Best | Not implemented in current Game Review. |
| Self Analysis | Exists separately as the Lichess Analysis Board with interactive exploration, engine, arrows, eval bar, board flip, PGN draft, opening/explorer and practice-mode UI. It is not integrated into a saved Game Review state. |
| Opening analysis | Separate opening database/explorer code exists; no Review-specific games-played, record, performance, alternatives, or master comparison integration. |
| Persistence/archive | Current IndexedDB schema stores books/sessions/settings only; no imported games, review analysis, retries, comments, or game archive. |
| PGN rich annotations | `chess.js` is the appropriate existing chess rules/parser dependency, but the current wrapper reduces the parsed game to headers and mainline SAN moves. Variations, NAGs, comments and clock annotations are not exposed in the Review model. |

## 5. Official web research and findings

Bing web searches were used to discover official help/API material, followed by direct reading of official support pages, API references, and the official Lichess OpenAPI endpoint file. The support documentation was updated as of the current audit date; proprietary behavior is not inferred beyond what the sources state.

| Official source | Findings relevant to implementation |
|---|---|
| [Chess.com: How does Game Review work](https://support.chess.com/en/articles/8584089-how-does-game-review-work) | Describes Highlights, move classes, keyboard/arrow navigation, next key moves, and Retry on a key move. First key move is usually the last book move. Special move categories include Brilliant/Great/Book/Miss in addition to the basic quality classes. |
| [Chess.com: Game Review on the app](https://support.chess.com/en/articles/10328363-how-do-i-use-game-review-on-the-app) | The bottom actions include Show, Best and Retry. Settings cover best-move visibility, eval bar location, chess engine and analysis strength. Self Analysis exposes eval bar, engine lines, arrows and move feedback; options include board flip and finish vs. bot. The mobile UI is behavioral guidance, not a substitute for the missing four desktop screenshots. |
| [Chess.com: Game Review overview](https://www.chess.com/terms/game-review) | Describes the product/feature concepts and its report card; do not copy proprietary assets or claim algorithm equivalence. |
| [Chess.com: Accuracy](https://support.chess.com/en/articles/8708970-how-is-accuracy-in-analysis-determined) | Accuracy uses CAPS2; moves are compared with engine recommendations, but the calculation is changed/proprietary and its complete formula is not published. Implement a documented local accuracy estimate and label it as such. |
| [Chess.com: Game rating](https://support.chess.com/en/articles/10773754-how-is-game-rating-calculated-in-game-review) | Game/performance rating estimates a player's level for one game using move quality versus expected play/rating. It is not the player's official rating; exact formula is not published. Any local result must be labelled as an estimate and omit when inputs are missing. |
| [Chess.com: Move classifications](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc) | Classification V2 uses expected points derived from rating and engine evaluation, rather than raw centipawn-loss cutoffs alone. Published expected-point loss bands: Best 0; Excellent 0-.02; Good .02-.05; Inaccuracy .05-.10; Mistake .10-.20; Blunder .20-1. Special classes have extra rule logic. A local model may use this public behavior as inspiration but cannot reproduce Chess.com's rating curve or proprietary special-move logic without those details. |
| [Chess.com: Why classification changes](https://support.chess.com/en/articles/11845102-why-did-my-move-classification-change-in-game-review) | Quick local review and deeper server review may differ because stronger/deeper analysis can change scores/classes. Our UI should disclose engine version, depth and analysis completeness. |
| [Chess.com: Colored arrows](https://support.chess.com/en/articles/17665907-what-do-the-colored-arrows-in-game-review-mean) | Coach arrows/highlights visualize explanations; a separate green engine-best arrow may be shown. Do not copy Chess.com glyphs; create original, accessible move indicators. |
| [Chess.com: Game Review v2 announcement](https://www.chess.com/news/view/chesscom-launches-game-review-v2) | Report card, phase grades, visual explanations, revised Miss/Blunder behavior and opening-book revision. It states a blunder should also lose material or the game; Miss represents failure to exploit a tactical opportunity, mate, or opponent error. |
| [Chess.com: Opening stats](https://support.chess.com/en/articles/8705347-how-can-i-see-my-opening-stats) | Platform opening stats are a membership feature and use player/opening/time-control data. Our equivalent should be computed only from actual imported games. |
| [Chess.com: Advanced stats](https://support.chess.com/en/articles/15451190-how-do-i-use-advanced-stats) | Platform phase/skills comparisons include peer/rating data and restricted member features. These are not available from a single PGN alone; local game-only values must be distinguished from peer benchmarks. |
| [Chess.com: Self Analysis](https://support.chess.com/en/articles/8583757-how-do-i-use-game-analysis) | Settings control analysis; analysis can be saved to a Library collection. It supports self-analysis distinct from Review. This app's existing library is PDF/book-oriented and will need an explicit game-analysis persistence design. |
| [Chess.com Published Data API](https://www.chess.com/news/view/published-data-api) and [PubAPI help](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it) | Read-only JSON-LD public data. Player profile `/pub/player/{username}`, archive list `/pub/player/{username}/games/archives`, month archives `/pub/player/{username}/games/{YYYY}/{MM}`, and PGN archive download are documented. Archive responses contain game data/PGN where available. Public/private distinction is explicit: private user data is not provided. 404 means malformed or unavailable; 429 rate limited. API docs allow browser-capable HTTP clients but actual CORS should be verified in the app. Use serial requests, ETag/Last-Modified and Cache-Control; parallel requests can receive 429. The main API article says endpoint refreshes are no more frequent than every 12 hours; the PubAPI help article also requires respecting Cache-Control and conditional-request headers. Follow response headers rather than hard-coding freshness. |
| [Chess.com archive endpoint example](https://api.chess.com/pub/player/hikaru/games/archives) | Direct request returned a JSON list of month archive URLs, confirming the archive-index response shape. This is public data only. |
| [Lichess API](https://lichess.org/api), [API reference](https://lichess-org.github.io/api/), and [official user-games OpenAPI operation](https://github.com/lichess-org/api/blob/master/doc/specs/tags/games/api-games-user-username.yaml) | User game export is `/api/games/user/{username}`; output can be PGN or NDJSON, newest games first, with `since`, `until`, `max`, `rated`, `perfType`, `color`, `moves`, `tags`, `clocks`, `evals`, `accuracy`, `opening`, `division`, `ongoing`, `finished` and other documented options. OpenAPI describes CORS `Access-Control-Allow-Origin: *`. It also declares OAuth2 security for this operation; confirm the anonymous/public username-import behavior before implementation rather than assume it. General docs say one request at a time, handle 429, and commonly wait one minute before retry; endpoint docs report stream throttling (20 games/sec anonymous, 30 authenticated, 60 for own games). Public/private visibility and OAuth scopes must be respected. |
| [Lichess Opening Explorer implementation](https://github.com/lichess-org/lila-openingexplorer) | Explorer's documented databases include master games, rated Lichess games and per-player openings; curated opening names are maintained separately. Existing app integration is useful for actual count/record/opening metadata; it is not proof every position has data. |
| [Stockfish repository](https://github.com/official-stockfish/Stockfish) and [UCI & Commands](https://github.com/official-stockfish/Stockfish/wiki/UCI-%26-Commands) | Official README identifies Stockfish as a UCI engine and links the UCI command reference. The GitHub wiki fetch returned an edit/interstitial page during this audit, so command behavior was cross-checked against the app's worker implementation and tests. Existing review code sends `uci`, `isready`, `position fen`, `go depth`; parses `info score cp|mate` and `bestmove`. General app engine clients also send `stop`. MultiPV/Threads/Hash controls were not found in the Review integration. Tie every completed score to its requested FEN, side-to-move perspective, engine/version and search settings; terminate/cancel safely and discard stale outputs. |
| [PGN Mentor files](https://www.pgnmentor.com/files.html) | Provides public downloadable PGN collections and opening files; useful for test fixtures only with provenance/licensing checks. It is not the normative parser specification. |
| [PGN Complete Specification](https://www.saremba.de/chessgml/standards/pgn/pgn-complete.htm) | Defines tags, movetext/SAN, NAGs, comments, recursive annotation variations, termination markers, supplemental tags, and FEN/setup handling. Reuse `chess.js`; do not add a second chess rules engine. Preserve supported annotations in the app model instead of silently discarding them. |

## 6. Screenshot reference measurement sheet

### Availability and measurement method

The four supplied images were located in `C:\Users\Asus\Downloads` and inspected locally. Original dimensions were read from each PNG. Board bounds were detected by scanning the sampled square-color pixels, then checked against the visible board edges; reported bounds are inclusive and can vary by approximately 1-2 px at antialiased edges. Other coordinates below are visible content bounds measured from the raster, not CSS source dimensions.

| Reference | Source image | Original dimensions | Board bounds and size | Panel bounds and size | Board squares |
|---|---|---:|---|---|---:|
| Screenshot 1 | `img1.png` | 1427 x 921 | x=82..862, y=68..848; 780 x 780 | dark analysis panel begins near x=894; approx. 485 px wide | 97.5 px |
| Screenshot 2 | `img2.png` | 1340 x 842 | x=80..750, y=86..756; 670 x 670 | dark analysis panel begins near x=788; approx. 515 px wide | 83.75 px |
| Screenshot 3 | `img3.png` | 1443 x 782 | x=82..758, y=96..772; 676 x 676 | light analysis/review panel begins near x=800; approx. 643 px wide | 84.5 px |
| Screenshot 4 | `img4.png` | 1432 x 922 | x=4..774, y=78..848; 770 x 770 | light review panel x≈812..1380, y≈21..906; approx. 568 x 885 px | 96.25 px |

These are not a single fixed layout or theme: screenshots 1-2 show dark analysis panels, while screenshots 3-4 show a white/light Review panel. The implementation should preserve these distinct views rather than force one screenshot's palette onto every tab. The board remains square in all four. Screenshot 1 shows a roughly 780 px board beside a ~485 px panel; screenshot 3 is near a 1:1 board/panel width; screenshot 4's panel is narrower than its 770 px board.

### Screenshot-sampled color tokens

Values were sampled directly from flat pixel regions or the dominant board-square colors. RGB is decimal. Board palettes differ by screenshot; retain the corresponding appearance instead of averaging them. The category-marker glyphs are small and antialiased, so their exact un-antialiased source fills cannot be inferred reliably from these PNGs.

| Token | HEX | RGB | Reference location |
|---|---|---|---|
| Review shell | `#2F2E2A` | 47, 46, 42 | Screenshot 1 (20,20), 3 (20,20), 4 (200,40) |
| Analysis shell, variant | `#2E2D29` | 46, 45, 41 | Screenshot 2 (800,20) |
| Analysis panel, dark | `#21201C` | 33, 32, 28 | Screenshot 1 (900,20) |
| Analysis panel, dark variant | `#1F1E1A` | 31, 30, 26 | Screenshot 2 (900,80) |
| Review panel, light | `#FFFFFF` | 255, 255, 255 | Screenshot 3 (900,300), 4 (900,200) |
| Review secondary surface | `#F1F1F1` | 241, 241, 241 | Screenshot 3 (1350,740) |
| Review card sample | `#EDEDEB` | 237, 237, 235 | Screenshot 4 (1065,220) |
| Review CTA green sample | `#9AB26F` | 154, 178, 111 | Screenshot 4 (1350,820) |
| Review heading text sample | `#3A3A3A` | 58, 58, 58 | Screenshot 4 title glyph core pixels |
| Review muted text sample | `#7F7F7F` | 127, 127, 127 | Screenshot 4 player-label glyph pixels |
| Review divider | `#D8D8D8` | 216, 216, 216 | Screenshot 4 horizontal divider (y=256) |
| Board light, green theme 1 | `#ECECD2` | 236, 236, 210 | Screenshot 1 dominant square color |
| Board dark, green theme 1 | `#729551` | 114, 149, 81 | Screenshot 1 dominant square color |
| Board light, brown theme | `#EBD5B0` | 235, 213, 176 | Screenshot 2 dominant square color |
| Board dark, brown theme | `#B38561` | 179, 133, 97 | Screenshot 2 dominant square color |
| Board light, green theme 2 | `#E9EDCC` | 233, 237, 204 | Screenshot 3 dominant square color |
| Board dark, green theme 2 | `#789954` | 120, 153, 84 | Screenshot 3 dominant square color |
| Board light, green theme 3 | `#EAECD5` | 234, 236, 213 | Screenshot 4 dominant square color |
| Board dark, green theme 3 | `#829263` | 130, 146, 99 | Screenshot 4 dominant square color |

The screenshots do not expose enough evidence to assign exact reference values to every hover, disabled, focus, evaluation-bar, or move-classification fill. Those values must remain explicitly unmeasured rather than being presented as sampled. Screenshot 3's red/green accuracy outlines and multicolor classification glyphs are visible; their antialiased edge pixels are not reliable source-color tokens.

### Typography, spacing, and controls

| Attribute | Screenshot measurement / observation | Implementation implication |
|---|---|---|
| Font family | Rasterized sans-serif throughout; no embedded font metadata. Exact family cannot be proven from pixels. Existing Inter stack is the closest supported local choice. | Keep Inter; do not claim a Chess.com font match. |
| Heading hierarchy | Screenshot 3 “Game Review” appears about 28-30 px; Screenshot 4 panel title about 20-22 px. | Use view-specific heading scale; avoid the current oversized 25-34 px page title in the compact review workspace. |
| Supporting text | Player labels, row labels and move metadata appear about 12-15 px; screenshot 3 category labels are about 15-16 px. | Compact sans-serif labels, regular weight and tight line height. |
| Large statistic values | Screenshot 3 accuracy values about 29-31 px bold; Screenshot 4 accuracy values about 20-22 px bold. | Keep numeric columns aligned and size by panel/view. |
| Screenshot 4 primary button | Start Review is about 514 x 74 px, with roughly 12 px corner radius and bold ~22 px label. | Large CTA only for the pre-review mobile-style summary state; do not use as a general toolbar button. |
| Screenshot 1/2 transport controls | Five adjacent controls occupy the panel bottom; each is roughly 80-90 x 45-48 px, with small gaps. | Use equal-sized controls in a compact transport row. |
| Graph | Screenshot 3 graph is approximately 580 x 84 px, inside the upper analysis panel. | Graph follows panel width and has a fixed compact height; it must share selected-ply state with the board. |
| Panel header | Screenshot 3 title and four tabs occupy about 160 px total before the graph. Screenshot 4 Game Review title bar is about 56 px tall. | Separate the Analysis-tab shell from the compact Review-summary header. |
| Panel content padding | Screenshot 3/4 panel edges to content are approximately 18-27 px. | Use measured view-specific insets; avoid the existing 30-42 px page gutters. |
| Board ratio | Every screenshot's board is square, with measured squares listed above. | Preserve 1:1 and size to available height/width. |
| Container | In this app, `.workspace` is below the persistent application topbar. Its height is the remaining viewport, not the browser viewport. | Fit the review view inside the existing workspace; do not cover the application topbar. |
| Scroll behavior | Screenshot 4's review panel has its own vertical scrollbar; the board remains stationary. | Keep the analysis panel independently scrollable and the outer workspace fixed-height at desktop. |
| Borders and radii | Screenshot 3 shows thin neutral dividers and mostly square panel surfaces; screenshot 4 uses a light panel, subtle card backgrounds and a rounded CTA. | Prefer 1 px dividers and restrained radii; avoid the current repeated 12 px dark cards. |

The visual references are raster screenshots, not browser DOM captures. Font family, source CSS values, hover/focus states, and a few small antialiased icon colors are therefore not recoverable with certainty; the report distinguishes those limitations from sampled pixels.

### Phase 1 visual comparison

The app was launched through `ChessBookReader.bat`. A loaded 40-ply PGN was inspected in the browser at the four supplied reference viewport sizes. The measured Review board and light-panel sizes were: 728 x 728 px and 601 px at 1432 x 922; 648 x 648 px and 563 px at 1340 x 842; 588 x 588 px and 606 px at 1443 x 782. The 1427 x 921 capture also retained the two-pane layout. At each desktop size, the board stayed square and the transport controls remained within the panel. At 1443 x 782, the analysis panel scrolled internally while the overall page had no horizontal or vertical overflow. The app shell's persistent 50 px topbar is retained as required, so the board is smaller than the reference's 770 px board at Screenshot 4; at 1432 x 922 the panel is 33 px wider than Screenshot 4 and close to Screenshot 3's ~643 px panel. At 800 x 900, the stacked layout had no horizontal overflow and the library remained a workspace-bounded overlay.

The measured board palette, dark shell, white panel, panel typography, compact buttons, and two-pane proportions now follow the available reference. The existing font stack remains Inter because the raster does not identify a source font. The current component intentionally does not draw a placeholder evaluation graph or display unsupported accuracy, game-rating, phase-performance, or ten-tier statistics: those need later-phase engine/data behavior. Exact screenshot identity is therefore not claimed. A short-game PGN naturally uses less vertical space than the reference's completed review; engine-backed counts appear only after analysis.

## 7. Proposed architecture (reuse-first)

Keep the app's global shell, topbar, `workspaceMode`, existing PDF/book reader, and Coordinate Training intact. Make Game Review a child workspace with its own internal board/analysis layout; do not replace the board in the other modules.

```text
App shell / existing workspace navigation
  └─ GameReview (route/view state; selected game, current ply, active mode)
      ├─ GameReviewBoard (reuse chess.js + existing interactive board patterns)
      ├─ EvaluationBar + GameEvaluationGraph (shared selected-ply/FEN state)
      ├─ ReviewPanel tabs: Overview / Moves / Retry / Analysis / Opening
      ├─ MoveClassificationList + CriticalMoments (data-only services)
      └─ GameImportPanel / GameArchive
           ├─ Chess.com Public Data API client (username -> archives -> month -> PGN)
           ├─ Lichess user-games exporter (bounded serial streaming; explicit auth/privacy handling)
           ├─ existing pgn-import.ts / review-pgn.ts / chess.js
           └─ IndexedDB review store (schema upgrade isolated from books/sessions)

Analysis services
  ├─ Stockfish review service: exact FEN/depth/MultiPV request identity, cancellation, cache
  ├─ accuracy/performance service: transparent local formulas; mark estimates and missing inputs
  ├─ classification/critical-moment service: expected-point model; documented special heuristics
  └─ Opening service: existing local database + Lichess Opening Explorer when supported
```

Do not duplicate `chess.js`, create another chessboard without inspecting `ChessboardView`, or reuse Lichess's static/heuristic fallback as engine truth. Introduce no dependency unless the existing implementation cannot satisfy a measured need.

### Proposed phases after approval and reference delivery

1. **Phase 1 - measured UI and navigation (complete):** sample the supplied images, record visible measurements/tokens, fit Review inside `.workspace`, redesign Review-only styles, and fix/test the menu without changing other workspace grids. The browser comparison and measured deviations are recorded in Section 6.
2. **Phase 2 - imports/archive:** implement Chess.com public archives and Lichess username export, serial rate-limited fetching, explicit public/private errors, paging, deduplication, and local review persistence. Keep PGN upload.
3. **Phase 3 - engine/graph:** reuse the bundled Stockfish 19 worker; carry FEN + engine settings through every result; add cancellable sequential/MultiPV analysis, white-perspective graph and board synchronization.
4. **Phase 4 - statistics:** define tested transparent accuracy/performance formulas, phase boundaries and missing-data behavior; never label a local estimate as a Chess.com score or official rating.
5. **Phase 5 - classes/theory:** add the requested classes with transparent inputs, actual opening database evidence, filters and move-level board indications.
6. **Phase 6 - critical moments/Retry:** derive key positions from engine evidence and opening boundary; provide legal retry input, hints, feedback and restore behavior.
7. **Phase 7 - analysis/openings:** integrate self-analysis and opening data with existing Lichess Analysis features; implement save/variation/bot controls only where complete end-to-end behavior exists.
8. **Phase 8 - tests/visual refinement:** use the project BAT file, capture exact reference viewport screenshots, compare pixels/layout, run `npm run build` and `npm test`, and test navigation/regression/responsive behavior.

## 8. Risks and open questions

1. **Reference variation:** screenshots 1-2 are dark analysis views; screenshots 3-4 are light Review views, with three distinct board palettes. Do not collapse these into one guessed theme.
2. **Dirty worktree:** current edits and untracked files predate this audit; preserve all of them and make timestamped backups before subsequent edits.
3. **Chess.com privacy and API:** only public published data is available. Handle 404/410/429, cache headers, archives without PGN, and large archive counts. Do not imply private-account game access.
4. **Lichess auth/rate limits:** the official user-games OpenAPI operation declares OAuth2 even though it describes games of a user; verify the supported anonymous/public route. Serialize requests; distinguish an invalid name, inaccessible/private game set, rate limiting, and network error.
5. **Proprietary metrics:** CAPS2 and performance rating equations are unpublished. Use honest local equivalents and label estimates.
6. **Engine determinism/performance:** complete-game depth 24 across every ply is expensive in a browser. Use cancellable analysis, explicit progress, stable engine settings and cache keys, without stale score display. Validate mate-score comparisons rather than relying solely on a large centipawn sentinel.
7. **Current data representation:** present review analysis assumes one score per position and mainline-only PGN. Rich comments/variations/clocks require extending the model without losing existing import behavior.
8. **Current analysis board fallback:** its fixed cached/heuristic evaluations are not equivalent to a real engine search; do not use them for accuracy/classification/game rating.
9. **Navigation layout:** the conflicting pointer-enter/click update and Review hide rules are corrected. Preserve the overlay's workspace bounds and continue regression testing menu navigation in every workspace.
10. **Visual validation:** browser comparison is complete at the fourth reference viewport. Other feature states are still incomplete; do not claim the entire rebuild is visually or functionally complete until later phases and their views are implemented and compared.

## 9. Phase 0 outcome

- Source audit and official research are documented here.
- Menu root cause is identified from source.
- Existing reusable services and missing Review capabilities are mapped.
- Screenshot dimensions, board bounds, visible layout measurements, and major surface/board colors are recorded above. Small antialiased fills and font-family identity remain uncertain.
- Phase 0 itself made no source edits; Phase 1 followed the user's conditional approval after screenshot discovery.
- Phase 1 changed `src/App.tsx`, `src/GameReview.tsx`, and `src/styles.css`, and added `src/game-review-reference-tokens.css`.
- `npm run build` succeeded; `npm test` passed 13 files / 78 tests. The production build reports the existing >500 kB chunk warning.
- The BAT launcher reused already-running local services. Browser checks covered menu/navigation, PGN loading, the 64-square board, move navigation/autoplay, Stockfish analysis and classification counts, desktop layout at 1432 x 922, and responsive layout at 800 x 900.
- **Phase 1 is complete for the measured workspace UI and navigation. Import services, full graph/statistics, all ten classifications, Retry, Show Moves, and advanced analysis remain in the later planned phases.**
