The Groups dummy workspace reproduces the inspected desktop folder navigation and makes the settings available for practice. Open **Navigator → Administrator → RTX5 Server → Groups**, then choose **Dummy data** in the data-source selector. Every sample value and count is marked **(Dummy)**.

Expand **Admin → contest, demo, or real → 4540**. The contest and demo folders each contain four example groups; real contains one. A full sample group name is `Admin\demo\4540\Grp01`. The text before each backslash creates a folder branch; the final part names the trading group.

- Click a Navigator arrow to expand or collapse its children. This does not change the selected folder's table.
- Click a Navigator folder to display its contents. Double-click a folder row in the table to enter it.
- Click a group row to select it. Double-click it, press Enter, or choose **Settings** to open group properties. Groups open settings, rather than an account branch.
- Use the breadcrumbs or **Up one folder** to return to a parent. **All Groups** displays every example group together; **Groups** returns to the folder view. Search filters the current list.

The folder table shows Group, Risk Management, Margin, and Currency. Folder rows show descendant-group counts. Group rows show their full path and sample settings. All Groups additionally shows Type and Floating Leverage Profile.

| Group properties tab | Information and controls |
| --- | --- |
| Common | Full group path, trade server, authentication, one-time passwords, notifications, currency/digits, connection and login options. |
| Statistics | Illustrative account and position counts, volume, exposure, balance, equity, used margin, and free margin. These figures are not calculated from accounts. |
| Company | Sample company identity, description, contact details, deposit/withdrawal and support URLs, and template folder. |
| News & Mail | News delivery, categories, languages, and internal mail. |
| Permissions | Symbol/position/order limits, history, default deposit and leverage, interest, signals, fund transfers, trading permissions, and inactivity period. |
| Margin | Risk calculation mode, margin call/stop-out levels and units, balance compensation, floating leverage, profit/loss treatment, and virtual credit. |
| Symbols | Ordered symbol/path rules with margin columns; Add, Edit, Delete, Up, and Down. |
| Commissions | Ordered commission rules, symbol masks, type, range, charge timing, and tiers; Add, Edit, Delete, Up, and Down. |
| Reports | Report-data generation, statements, email delivery, and archiving settings. |

Right-click a Symbols row for **Add** (Insert), **Edit** (Enter), **Delete** (Delete), **Move Up**, **Move Down**, **Select All** (Ctrl+A), **Copy** (Ctrl+C), **Find** (Ctrl+F), **Find Next** (F3), and **Find Previous** (Shift+F3). Ctrl-click toggles individual selections; Shift-click selects a range. Copy places the selected rows and their dummy labels on the clipboard. Find searches symbol paths without case sensitivity and wraps between matches. These actions update the open draft; save the group with OK to persist them.

Double-click a Symbols row to open its nested editor:

- **Common:** symbol path/mask, default spread, spread difference, and bid/ask balance.
- **Margin:** default inheritance, initial/hedged/maintenance margin, margin flags, and additional checks.
- **Margin Rates:** liquidity/currency and buy/sell rates for market, limit, stop, and stop-limit orders, for initial and maintenance margin.
- **Swaps:** calculation type, long/short values, year/holiday settings, and daily multipliers/presets.

Double-click a Commissions row to open its rule editor. Configure the name, description, symbol mask, commission type, volume/turnover range, charge timing, deal filters, and turnover currency. Add a tier or select one and choose Edit to edit the table cells inline: From, To, Commission, Minimal, Maximal, Mode, Currency, and Type. These tier changes remain in the commission draft until you choose OK.

**Add group** opens a new group draft. **Add subgroup** asks for a folder path, then opens the first group draft inside it; the branch appears when that group is saved. **Duplicate** opens an independent copy with an unused name. Rename a subgroup through its row/context menu, or change a group's full name in Common to rename or move it. Renaming a subgroup updates all descendant paths. **Delete** confirms removal of a group or an entire subgroup; Admin itself cannot be renamed or deleted.

**OK** in a nested editor updates the open group draft. **OK** in group properties saves the whole group. **Cancel** discards the current editor's unsaved changes; cancelling the parent group also discards nested changes. Saved dummy edits persist in this browser across reloads. **Reset dummy data** confirms replacement with the original nine examples.

Dummy data uses a separate browser-storage key and makes no group API requests. It does not change broker groups, accounts, symbols, or commissions. Switching to **Server data** returns to the existing backend workflow; saved dummy examples remain separate.

The connected desktop Manager login exposed **Margin, Symbols, and Commissions** in group properties. Group Add/Delete were unavailable under that login. The other administrator tabs and local group-management actions are retained practice functionality; they are not claimed as observed desktop screens.

Reference evidence: [recorded desktop walkthrough](../../artifacts/mt5-groups-reference/mt5-groups-walkthrough.webm), [expanded folders](../../artifacts/mt5-groups-reference/02-expanded.png), [group properties](../../artifacts/mt5-groups-reference/05-properties.png), [symbol editor](../../artifacts/mt5-groups-reference/07-symbol-editor.png), and [commission editor](../../artifacts/mt5-groups-reference/13-commission-editor.png). The implementation uses fictitious sample values instead of copying connected broker records.

Verification: the full unit suite passes (375 tests), the production build succeeds, and browser checks cover folder navigation, all nine tabs, nested settings, save/cancel, persistence, group/subgroup actions, and a 1280 × 800 viewport. Dummy workflows made no Groups API requests. See the [browser results](../../artifacts/mt5-groups-reference/admin-verification/qa-result.json), [symbol context-menu checks](../../artifacts/mt5-groups-reference/admin-verification/symbol-context-menu-qa-result.json), [implemented UI walkthrough](../../artifacts/mt5-groups-reference/admin-verification/dummy-groups-walkthrough.webm), and [expanded UI screenshot](../../artifacts/mt5-groups-reference/admin-verification/01-hierarchy.png).
