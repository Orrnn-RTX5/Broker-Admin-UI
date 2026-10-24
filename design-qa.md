# Symbol Management visual review

final result: passed

## LP Routing equal column spacing - 2026-10-08

Follow-up live verification: signed in to localhost with the supplied account and inspected all 12 routes. At a 1920px viewport, each data column measured approximately 147.33px with 14px left/right padding; all headers aligned with their values and the edit column measured 44px. LP Routing is accessible in this live session. Screenshot and measurements: `../artifacts/lp-routing-live-review-20261008/`. No route changes were made.

The nine data columns now share equal widths and consistent 14px horizontal padding, with matching header/value alignment and a compact 44px edit column. A 1200px table minimum keeps headings readable; narrower workspaces scroll within the table. Inspected the desktop screenshot and verified column geometry in dark/light desktop and 1366px/900px windows. Component lint, production build, diff whitespace, status filtering and route selection checks passed. Browser verification used intercepted sample responses in an isolated session, with no backend writes or browser errors. Captures, recording and measurements: `../artifacts/lp-routing-equal-columns-20261008/`.

## LP Routing Clients status blue — 2026-10-08

Active status and all Mode values now use the same `--info-500` color as Clients status text: `#66b8ed` in the dark theme, with the shared light-theme equivalent. Production build, diff whitespace and isolated browser checks passed for both theme colors, all routing modes, removed markers, filtering and selected-route details. Evidence: `../artifacts/lp-routing-clients-blue-20261008/`.

## LP Routing matched to Clients — 2026-10-08

final result: passed

Compared Clients and LP Routing in a separate browser session using sample data. Matched the Clients directory's full-width workspace layout, 40px heading, row-count badge, 33px uppercase column headings, 37px rows, 12px body text, 14px cell insets, subtle alternating backgrounds and short header-only dividers. Removed the inset card frame and widened Priority/Max volume to keep every heading readable. The footer now uses the same section tab and compact row range/page controls, with functional local pagination of fetched routes at 50/100/250 rows per page. Filtering resets to the first page, and refresh clamps the page when the result shrinks.

Reference captures and recording: `../artifacts/lp-routing-clients-reference-20261008/`. Final captures, `checks.json` and recording: `../artifacts/lp-routing-clients-match-20261008/`. Inspected dark/light desktop and narrow views. Browser checks passed for exact row dimensions, typography, backgrounds, header visibility and containment; all page buttons and page input Enter/blur/Escape; page-size changes; filters; dataset shrink; empty/error/retry states; selected-route details and centered Create form. Tests exercised 123 sample routes without writes or uncaught errors. Component lint, production build and diff whitespace checks passed. Verification used intercepted responses in an isolated authorized session; existing live permissions remain in force.

## LP Routing row markers and blue values — 2026-10-08

Removed the icons beside route IDs and the dots preceding status text. Numeric IDs remain aligned with the ID heading. Active status and all mode values now use the application's `--accent-500` blue, including theme switching; Off remains muted. Build, component lint, diff whitespace and isolated browser checks passed. Verified B-Book, A-Book and Hybrid colors, marker removal, status filtering and selected-route details without writes. Captures, computed colors, checks and recording: `../artifacts/lp-routing-row-style-20261008/`.

## LP Routing centered form — 2026-10-08

final result: passed

Opened Create Group and the original LP Routing form in a separate browser session and captured both before implementation. Replaced the right-side routing drawer with a centered Radix dialog matching Create Group: 800px desktop width, 560px maximum height, existing theme border/radius/overlay, compact heading and actions, consistent 32px controls and 20px horizontal insets. Longer tabs scroll inside the dialog; the footer stays visible. Create/Edit retain their fields, provider choices and existing request logic. Field labels are associated with controls, focus stays inside the dialog, and Escape/Cancel/Close return focus to the opener. Outside clicks preserve the draft.

Reference captures and recording: `../artifacts/lp-routing-form-reference-20261008/`. Final captures, `checks.json` and `synthetic-walkthrough.webm`: `../artifacts/lp-routing-form-dialog-20261008/`. All three tabs passed containment checks in dark/light desktop, 1366px, 900px, 375px and short-height windows. Verified draft retention, provider options, missing-group validation, edit prefilling, keyboard focus and cancellation without writes. Production build, component lint and diff whitespace checks passed. Browser comparison and verification used intercepted responses in a separate authorized preview session because the live account's LP Routing permission restriction remains in place.

## LP Routing search focus — 2026-10-08

Removed the input's nested focus outline, border and shadow; the search container retains one outer focus border for mouse and keyboard. The dark-theme placeholder is opaque white, with a readable theme color in light mode. Isolated browser checks passed for computed focus styles, keyboard focus, search filtering and clear/refocus. Evidence: `../artifacts/lp-routing-search-focus-20261008/checks.json`, `focused-dark.png`, `focused-light.png`, and `synthetic-walkthrough.webm`. No writes or uncaught browser errors.

## LP Routing toolbar simplification — 2026-10-08

final result: passed

Removed the marked Available providers strip, including its counts, refresh and expansion controls. Provider choices still load in Create/Edit route forms. Replaced the counted status tabs with a native status dropdown and ordered the header controls as search, status, Add Route. All three controls use 26px heights, 8px gaps, compact borders and existing theme tokens; the table footer retains route counts. Narrow workspaces wrap the controls without page overflow.

Evidence: `../artifacts/lp-routing-controls-20261008/` contains dark/light desktop and narrow captures, `checks.json`, and `synthetic-walkthrough.webm`. Browser checks passed for strip removal, equal control heights, non-overlapping layouts, status filtering, search/clear focus, main-toolbar refresh, provider choices in the form, create/edit cancellation and selected-route details. No writes or uncaught browser errors. Production build, component lint and diff whitespace checks passed. Verification used intercepted responses in a separate authorized preview session; the live account's LP Routing access restriction remains unchanged.

## LP Routing heading controls — 2026-10-08

final result: passed

Moved Add Route, All/Active/Off filters, and route search to the right of the LP Routing heading, replacing the separate toolbar row. Removed the marked route-refresh button and redundant top route count; the footer retains the filtered count. The main toolbar's Refresh view action now propagates its refresh trigger to the routes component and reloads routes without resetting filters. The separate provider refresh remains available. Smaller workspaces wrap the header controls, with table scrolling contained below.

Evidence: the user's annotated screenshot is the placement reference; final captures `1920-dark.png`, `1920-light.png`, `1366-dark.png`, `900-dark.png`, `checks.json`, and `synthetic-walkthrough.webm` are in `../artifacts/lp-routing-header-20261008/`. Inspected dark/light and narrow screenshots. The title and controls share one centerline on desktop; all tested viewports have no header/page overflow. Full-shell isolated browser checks passed for heading uniqueness, removed refresh, filters/search/clear, create/edit dialogs, selected-route details, providers, and refresh-trigger propagation. No writes or uncaught browser errors. Production build and diff whitespace checks pass; changed production files have no lint errors (AuthenticatedApp retains its existing hook-dependency warning).

Live verification limitation: the authenticated account currently receives access denied for LP Routing (view_groups permission). Existing authorization remains in force; verification used intercepted responses and a synthetic authorized user in a separate browser context.

## Server health spacing refinement — 2026-10-08

final result: passed

Scoped the spacing changes to Server Status: 28px top inset, 24px side inset, 24px below the heading and between summary/detail groups, 16px between cards, and consistent 20px card/panel content padding. Metric rows use 36px height with more padding around their lists. At smaller windows, the content container changes the summary to two or one columns and stacks the detail panels, preventing clipped uptime values. Smaller viewport padding drops to 16px inside cards and panels. The earlier requested removal of summary icons, Overview, description, snapshot, and Refresh row remains in place.

Evidence: `../artifacts/server-status-spacing-20261008/before.png`, `after-dark.png`, `desktop-light.png`, `1366-dark.png`, `900-dark.png`, `760-dark.png`, and `layouts.json`. Inspected desktop dark/light and narrow captures. All five viewport/theme checks pass without page/content overflow or clipped metric values. The desktop layout preserves four equal cards and two aligned detail panels; narrow layouts scroll vertically within the workspace. Production build, component lint, and diff whitespace checks passed. The live preview remains open at Server Status.

## Server Settings simplification — 2026-10-08

final result: passed

Removed the repeated Server Settings heading, explanatory sentence, duplicate record badge, and visible lookup label. The selected tab identifies the section; the lookup remains labeled for assistive technology and retains its exact-key server request. Added a clear control, balanced the two data columns, aligned row actions to the right, reduced heavy grid borders, and matched existing 14px insets, 34px headers/rows/footer and theme tokens. Refinements are scoped to Server Settings; the shared Swap Rates heading and layout remain intact.

Source and final visual evidence: `../artifacts/server-settings-polish-20261008/before.png`, `after-live-dark.png`, and `live-table-detail.png`. Inspected the live screen before and after, plus the simulated dark/light desktop and smaller-window captures (`1920-dark.png`, `1920-light.png`, `1366-dark.png`, `900-dark.png`, `760-dark.png`, `table-detail.png`). The desktop captures use 1920 × 920 CSS/image pixels at device scale factor 1. The live configuration values remain unchanged; simulated captures include a changed timezone value solely to exercise Save. No remaining actionable P0/P1/P2 visual issues; the condensed header and lighter row dividers are intentional requested changes.

Verification: live exact-key lookup returned HTTP 200; live edit cancellation preserved UTC. Isolated browser checks passed for keys absent from the list, missing-key feedback, lookup clearing, edit autofocus, Escape/Cancel without writes, Enter save, save failure and successful retry, Refresh failure and Retry, and containment at five viewport/theme combinations. Equal data columns measured 615px/615px on desktop. Smaller windows wrap the toolbar and contain horizontal table scrolling. No uncaught browser errors. Saves used intercepted responses only. Production build, targeted ESLint, and diff whitespace checks passed. Evidence and recording: `checks.json` and `synthetic-walkthrough.webm` in the same artifact directory. The authenticated preview remains open at Server Settings.

## Bug Reports navigation and workspace — 2026-10-08

final result: passed

Added Support Center → Bug Reports, retaining the existing toolbar shortcut and submission dialog. Support Center is an expandable navigation group; its unfinished children remain disabled. The workspace follows the existing full-width Navigator grids with a compact toolbar, consistent 14px insets, shared typography and theme tokens, aligned columns, contained scrolling, and a fixed count footer.

Visual references: the live Symbols/Orders screenshots listed below and `../artifacts/symbol-management-polish-20261008/bug-report-reference-dialog.png` (existing dialog). Inspected the authenticated live empty state and dialog, then compared the populated desktop view and focused workspace capture against those references. Desktop captures are 1920 × 920 CSS/image pixels at device scale factor 1; dark and light themes use identical content and cleared filters. Table/header typography, border colors, spacing, action sizing, and alignment were checked visually. No remaining actionable P0/P1/P2 visual differences. The introductory submission guidance and empty state are intentional additions for this workflow.

Evidence in `../artifacts/bug-reports-navigation-20261008/`:

- `live-empty-dark.png`, `live-report-dialog.png`: authenticated local site inspection without submitting a test report.
- `1920-dark.png`, `1920-light.png`, `reports-workspace-detail.png`: populated view and focused capture; test data is confined to an isolated browser context with intercepted responses.
- `1366-dark.png`, `900-dark.png`: narrower layouts; toolbar wraps and table overflow remains inside its scroll region.
- `checks.json`, `synthetic-walkthrough.webm`: recorded simulated submission, error/retry, clipboard reference, attachment warning, search, filters, clear filters, keyboard focus restoration, and refresh persistence. No browser exceptions or toolbar/page overflow.

Validation: production build passed; 14 targeted tests passed (history isolation, metadata whitelist, invalid/duplicate confirmations, blocked storage, refresh restoration, limit, navigation capabilities, and existing branding). Changed production files pass ESLint; AuthenticatedApp retains one existing hook-dependency warning. Diff whitespace checks passed. The live preview remains open at Bug Reports.

Server limitation: options and submission endpoints work, but GET report history returns 405. This view shows confirmed receipts from the current browser tab/session, scoped by broker and reporter and limited to 100 entries; it does not invent platform review statuses. Descriptions, files, and authentication data are not retained in receipt history. Copy explicitly explains that Submitted confirms receipt; support follow-up uses the report reference.

Reviewed 2026-10-08 against the live application's Navigator views. This is an existing-product styling update; the Symbols, Groups, and Orders screens provide the visual reference, with Symbols the primary grid reference. Their columns and content differ intentionally from the management screen.

The earlier Market Watch color review is retained separately at `../artifacts/symbol-management-polish-20261008/previous-market-color-design-qa.md`.

## Evidence

- Source visual truth: `../artifacts/symbol-management-polish-20261008/01-reference-symbols.png`; supporting references `02-reference-groups.png` and `03-reference-orders.png`.
- Previous implementation: `04-management-before.png` in the same folder.
- Final implementation after the user's tab-strip refinement: `tabs-polish-dark.png`; light theme: `tabs-polish-light.png`; narrow viewport: `tabs-polish-small.png`. Equal-column correction: `equal-columns-final.png`; previous visual review: `09-management-final.png`.
- Full-view comparison: primary reference and updated implementation opened together at 1920 × 920 CSS pixels and image pixels, device scale factor 1. No density normalization required. Authenticated desktop, dark theme, first table rows, filters cleared.
- Focused comparison: `11-reference-grid-detail.png` and `10-management-grid-detail.png`, both 1370 × 210 pixels. Captured from the browser and inspected together to check header typography, row height, cell padding, dividers, striping, and status treatments.
- Additional states: `07-management-scrolled.png`, `08-management-help.png`, and `width-1280.png`, `width-560.png`, `width-360.png`.
- Interaction results: `checks.json` in the evidence folder.

## Comparison history

The initial comparison found three actionable visual differences:

- P1: Inset rounded table card diverged from the existing full-width Navigator grids. Removed the card and Symbol-tab content padding. The final grid aligns with the workspace edges.
- P2: Pill badges and mixed symbol/feed text reduced consistency and scanability. Applied the reference's compact status styling, used the existing monospace font for numbers, and separated feed state into a column.
- P2: A long explanatory paragraph pushed the table down and crowded the screen. Retained its content behind the keyboard-accessible Trading requirements disclosure in the fixed footer.

The final comparison found no remaining actionable P0/P1/P2 differences. Additional management columns, filters, actions, and subtabs are intentional product differences from the reference.

The user's subsequent spacing annotation requested equal gaps across columns. Removed the unequal percentage column widths, gave each of the ten columns 10% width, and aligned all content to the same 14px left inset. Browser measurements confirmed ten 135.5px columns at the desktop viewport and ten 128px columns at narrow viewports. The table's 1280px minimum width preserves labels and actions with contained horizontal scrolling. Evidence: `equal-column-checks.json`, `equal-column-alignment.json`, and the inspected `equal-columns-final.png`. This explicit user correction supersedes numeric right alignment from the first styling pass.

The next annotation scoped the refinement to the tab strip. All six tabs now use equal 148px widths, centered labels, a 40px row height, short subtle dividers, and an accent-tinted selected state with an underline. The strip aligns to the header's 14px inset and scrolls horizontally on narrow screens. Dark, light, and 360px screenshots were inspected; all panels and Arrow/Home/End navigation passed. Evidence: `tabs-polish-checks.json`. No remaining actionable visual issues were found in this scoped pass.

## Required fidelity surfaces

- Typography: Existing font tokens; 10px uppercase table headers, 11px table content, monospace instrument codes and numerical values, 13px page title. Matches the instrument reference hierarchy.
- Spacing and layout: Full-width grid, 34px headers and rows, 14px cell padding, subtle header column dividers, fixed 40px footer, contained horizontal scrolling at smaller widths.
- Colors and tokens: Existing app/toolbar surfaces, borders, hover colors, and semantic status colors. Dark and light themes inspected.
- Assets: Existing application logo and Lucide controls retained. No new raster assets required by this data-grid update.
- Copy: Instrument specifications and status meanings preserved. Base/derived type labels remain visible; feed state is separate from trading enablement; complete trading requirements remain available on demand.

## Verification and limits

Live browser checks passed for search, an empty search result, category/type/status filters, all six subtabs, Add/Clone/Edit/Configure dialogs, keyboard tab navigation, keyboard help disclosure, sticky column headers while scrolling, and viewport containment at 1920/1280/560/360px. No uncaught browser errors occurred during the verification pass. Symbol/trading writes were not submitted. Production build and 23 relevant existing tests passed.

This review confirms visible consistency and the exercised interactions; it does not assert complete accessibility compliance. Small viewports intentionally scroll the dense grid horizontally.

## Implementation checklist

- [x] Match the existing Navigator grid rather than introduce a new visual system.
- [x] Preserve symbol data, filters, and management actions.
- [x] Verify desktop, narrow screens, dark/light themes, and keyboard interaction.
- [x] Capture and inspect final evidence.

## Symbol Management spacing and blue actions — 2026-10-09

The latest annotated request replaces the earlier fixed-width tab preference: six equal tabs now fill the available strip, retaining their 148px minimum width and horizontal scrolling on narrow screens. The content and table scroll regions use a neutral keyboard focus outline rather than a blue frame. The selected tab keeps its blue underline and uses blue text.

All ten table columns retain equal widths and matching 14px header/cell insets. Removed the status dots and badge insets; Enabled is plain theme-blue text aligned with its heading. Replaced the green toggle icon with a blue Enable/Disable text action, preserving its existing service call, accessible name, disabled state while updating, and edit action. Feed state remains distinct from trading enablement.

Evidence: `../artifacts/symbol-management-spacing-blue-20261009/` contains desktop dark/light screenshots, keyboard focus capture, 1280/560/360px views, source backups, and `checks.json`. Inspected the desktop dark/light and narrow captures. Browser checks passed for equal geometry, neutral focus outlines, blue text without status/toggle icons, search, category filters, Add/Clone cancellation, tab switching, and enable/disable using synthetic data. The 12 existing contracts, targeted ESLint, production build, and whitespace checks passed.

Live sign-in was attempted but `/manager/api/v2/admin/login` returned HTTP 502; the visual checks therefore used an isolated Chrome context with synthetic responses, explicitly recorded in `checks.json`. No live management writes were made. No credentials or authentication tokens are retained in the evidence.

## Spreads workspace styling — 2026-10-09

Matched Spreads to the Clients and LP Routing workspace styling: one 40px heading with symbol lookup/Load/Add Schedule controls, theme-based colors, full-width semantic table, 33px column headings, 37px rows, 14px cell padding, subtle row/header dividers, and a fixed section/count footer. Group names have more space; start/end times and spread override units are explicit. Added visible labeled row actions using the existing delete confirmation, preserved the context menu, and connected application Refresh to the loaded symbol. Empty, loading, missing results, and request failure/retry states now use consistent styling.

The Create Spread Schedule dialog uses the existing Radix dialog pattern, theme controls and a compact centered form. Fields have associated labels, the loaded symbol is prefilled, Escape/Cancel restore focus, and outside clicks preserve the draft. Existing defaults, payload fields, numeric conversions and service endpoints are retained.

Evidence: `../artifacts/spreads-polish-20261009/` includes the original workspace capture (`before.png`), populated dark/light desktop and narrow views, the empty state, missing results, and dialog desktop/light/narrow/short-height captures. Inspected the workspace, empty state, and form screenshots against the application styling. Browser checks used intercepted sample responses in an isolated session and passed for trimmed exact-symbol lookup, zero spread values, header/value alignment, containment, creation cancellation, delete confirmation cancellation, missing results, failure/retry and application Refresh. No backend writes or browser exceptions. Production build and whitespace checks passed; targeted ESLint has no errors and retains the existing AuthenticatedApp hook-dependency warning.

## Spread Schedule symbol dropdown — 2026-10-09

Replaced the native browser datalist in Create Spread Schedule with a searchable combobox styled like the Positions symbol picker and shared Select control. The menu matches the field width, uses 30px single-line options, theme borders/backgrounds, a selection checkmark and subdued Not configured status. Category information remains in each option's title. The shared LP symbol source, manual symbol entry and existing schedule payload are retained. The dropdown is rendered inside the dialog, stays within its bounds and scrolls independently; keyboard arrows/Enter select, Escape dismisses the dropdown before the dialog, and outside clicks/Tab dismiss it.

Inspected dark/light desktop and short-height captures. Isolated browser checks passed with 49 intercepted catalogue symbols for mouse/keyboard selection, search, selected checkmark, manual input, dismissal, focus restoration, field/menu alignment and scrolling at 1920px, 375px and 340px-height layouts. No backend writes or browser errors. Targeted lint and production build passed. Evidence: `../artifacts/spread-symbol-picker-20261009/`.
