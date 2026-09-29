# Admin UI: Hardcoded Values & UI-only Functionality Checklist

**Scope:** `rtx5-broker-admin-ui` only (the React/Vite/Electron source, and the config files in this repo). Backend work is out of scope.
**Source:** [HARDCODED_VALUES_AUDIT.md](HARDCODED_VALUES_AUDIT.md). That file has the full evidence for every item.
**How to use:**
- Work top to bottom. Each phase builds on the one before it.
- Tick `[ ]` → `[x]` as items are done.
- "UI fix" says what to change in the frontend.
- Where a value has to come from data, use the existing service/API if there is one. If there isn't, hide or remove the UI rather than keep fake values.

**Priority legend:** 🔴 P0 must fix now · 🟠 P1 wrong or fake data · 🟡 P2 platform foundations · 🔵 P3 per-module lists and defaults · ⚪ P4 polish

---

## 🔴 Phase 0: Secrets & credentials in UI code
*Why first: anyone who has the app bundle or the git repo can read these.*

- [ ] **Remove the committed GitHub token.** `.env.electron:3` has `GH_TOKEN=ghp_***` and is tracked in git despite `.gitignore`.
  - UI fix: remove the token from the file, `git rm --cached .env.electron`, and purge it from history. Publish releases with a CI secret instead. Rotate the token.
- [ ] **Remove the hardcoded feed tokens.** `src/utils/wsAuth.js:78-82` has `nexa: 'cf9a***'` and `test`/`test-broker: '28c2***'`, and they take priority over the user's JWT.
  - UI fix: delete `BROKER_FEED_TOKEN_MAP`, and use the per-session WS ticket flow that `adminMarketFeed` already uses.
- [ ] **Remove the fallback broker `'Nexa'`.** `src/utils/wsAuth.js:102` falls back to it when no broker is known.
  - UI fix: no fallback. If the broker ID is missing, don't open the feed.
- [ ] **Remove the password literal.** `src/components/RIGHTCLICKJPOPUPS/ServerPropertiesPopup.jsx:49` has `type="password" defaultValue="pass***"`.
  - UI fix: remove it. Password fields are never prefilled.
- [ ] **Stop tracking `brokers.json`.** It holds server IPs, SSH user `root` and port 40111.
  - UI fix: `git rm --cached brokers.json`, add it to `.gitignore`, and make `deploy-brokers.sh:4-7` fail instead of falling back to it.
- [ ] **Remove the committed prod host.** `public/runtime-config.js:3-5` is committed with `SUPER_ADMIN_API_HOST` set to prod, and it overrides `.env` in every non-Docker build.
  - UI fix: ship an empty template and let deploy tooling fill it in.
- [ ] **Clear the prefilled Super Admin username.** `src/components/organisms/SuperAdminAuthScreen.jsx:24,147` prefills `admin`.
  - UI fix: start empty.
- [ ] **Remove the demo IPs.** `ManagerPropertiesPopup.jsx:289-294` shows `81.29.145.69` as every manager's whitelist, and `NetworkCluster.jsx:9-18` and `ServerStatusPanel.jsx:346-360` list real-looking public IPs and management ports.
  - UI fix: remove them.
- [ ] **Revert the Dockerfile `HOST` change.** `Dockerfile:16` has an uncommitted `HOST=127.0.0.1`.
  - UI fix: revert to `0.0.0.0`.

---

## 🟠 Phase 1: UI sends invented values to the backend
*Why next: these silently corrupt real data on save.*

- [ ] **Create Group sends hidden risk limits.** `CreateGroupPopup.jsx:31-32` sends `maxLotPerTrade: 100` and `maxTotalLots: 500` with no input for them; lines 29 and 36-38 also send hidden `lotDivisor`, `swapMultiplier` and `symbolsBlocked`.
  - UI fix: show these as fields, or leave them out of the payload.
- [ ] **Group Properties writes defaults back on every OK.** `GroupPropertiesPopup.jsx:91-109` fills missing fields (leverage 100, lots 100/500, margin call 100, stop-out 50, `USD`, `standard`, `b`, `market`) and saves the whole form.
  - UI fix: keep the original record and send only the fields the user changed. Show "—" when a field is missing.
- [ ] **Edit forms fill missing fields and save them.** This happens in:
  - `RiskLimitsView.jsx:52-58`: `'max_drawdown'`, `enabled ?? true`, which can re-enable a limit.
  - `ComplaintsView.jsx:84-86`: `'finance'`, `'medium'`.

  UI fix: no silent defaults.
- [ ] **A missing ID becomes the row's position in the list, and actions are sent with it.**
  - `symbolManagementData.js:117,154,172,189,204,218` (deletes)
  - `CommissionSwapTab.jsx:40-45` (delete)
  - `PaymentGatewayView.jsx:22` (toggle)
  - `PaymentReconciliationView.jsx:22` (match)
  - `ChargebacksView.jsx:15` (resolve)

  UI fix: require a real ID, and disable the action when it's missing.
- [ ] **Create forms are prefilled with demo data:**
  - `CreateHolidayPopup.jsx:10-13`: 2026-12-25 "Christmas Day", EURUSD/GBPUSD
  - `CreateLeveragePopup.jsx:11-17`: `std_ecn`, 1:500, EURUSD
  - `CreateSpreadSchedulePopup.jsx:20-25`: EURUSD, `default`, 20
  - `CreateManagerPopup.jsx:17-18`: `std_ecn`, `192.168.1.0/24`
  - `GroupPropertiesPopup.jsx:125-135`: "EURUSD Standard", 7
  - `AuthenticatedApp.jsx:569`: `'New Group\\Demo'`
  - `AccountEditPopup.jsx:60`: prefilled reason

  UI fix: start with empty forms.
- [ ] **LP route defaults are applied to every new route.** `LPRouteFormPopup.jsx:30-59` sets 100 ms delay, 30-point markups, priority 100 and volume caps; `validateLpRouteForm` sends them all.
  - UI fix: leave the fields empty or `null` unless the user sets them.
- [ ] **Session overrides use a hardcoded group.** `SessionOverridesView.jsx:170,197,199,320` uses `'default'` for both the query and creation.
  - UI fix: add a group picker with an "All" option.
- [ ] **Leverage schedule passes the wrong ID (bug).** `LeveragesView.jsx:50` sends a rule ID as the `group` parameter.
  - UI fix: pass `group_name`.
- [ ] **Market depth saves defaults over real config.** `SymbolManagement/AdvancedTab.jsx:44` shows defaults after *any* error and keeps Save enabled.
  - UI fix: use defaults only on 404; otherwise disable the form.
- [ ] **Clone form assumes forex specs.** `SymbolsTab.jsx:94-98` uses contract size 100000 and 0.01–100 lots for any source symbol.
  - UI fix: copy the specs from the source symbol.
- [ ] **Invalid JSON is saved as `{}`.** `FeatureFlagsView.jsx:61` and `TradingTerminalConfigView.jsx:59`.
  - UI fix: validate, and block Save.
- [ ] **Feature flag toggle matches by name only.** `FeatureFlagsView.jsx:40,48` also flips the same flag in other groups.
  - UI fix: match on ID, or on name + group.
- [ ] **Terminal config treats any error as "no config".** `TradingTerminalConfigView.jsx:40` treats any `retcode` that way, so saving overwrites the existing config.
  - UI fix: match only the specific "not found" code.
- [ ] **The user can edit the audit author.** `SecurityAccessView.jsx:74,110-111` has an editable `created_by: 'admin'`.
  - UI fix: remove the field and use the logged-in user.
- [ ] **Blank numbers are sent as 0.** `FeedTenantsView.jsx:261-262` (`|| 0`) and `feedConfigPayload.js:333` (port 0).
  - UI fix: leave the field out when it's blank, and validate.
- [ ] **Allocations pretend to save.** `AllocationsView.jsx:52-61,105` only saves "for this session".
  - UI fix: say plainly that nothing is saved, or hide the save actions.
- [ ] **Import validates but uploads nothing.** `AuthenticatedApp.jsx:656-679` says "Import validated".
  - UI fix: label it "Validate only", or hide it.

---

## 🟠 Phase 2: Fake data shown as if it were real
*Why: operators make decisions from these screens.*

### Whole screens with no API (fully static)
- [ ] **`ServerStatusPanel.jsx`** shows CPU/memory legends, build, OS, hardware, DB counts, pings, threads, firewall, devices and "performance index". Its charts come from `deterministicChart.js`, and the Restart button does nothing.
  - UI fix: add a clear "Preview / not connected" state, or hide the screen via `viewCapabilities`.
- [ ] **`NetworkCluster.jsx`** shows 8 fake nodes, "23 online", a London map marker, fixed countries and a fixed time axis. The Add Server button does nothing, and the map loads from a jsdelivr CDN.
  - UI fix: same as above; bundle the map file locally.
- [ ] **`AllocationsView.jsx:8-19`** shows `https://broker.com/*` URLs, fake groups ("Flexy Markets") and a fixed blank-group template.
  - UI fix: same as above.
- [ ] **`IntegrationsView.jsx:24-129`** shows a static catalogue, "Connected" Mail/SMS, "Balance 11 USD", "51 successful / 510 failed" and VPS/KYC numbers.
  - UI fix: same as above.
- [ ] **`SupportCenterView.jsx`** has a login form that doesn't work, dead links, and Orrnn branding.
  - UI fix: replace it with one external link, or hide it.
- [ ] **`AntiDDoSView.jsx`** has a static vendor list and "Add Proxy Server" / "Send request" buttons that do nothing.
  - UI fix: hide the actions, or mark the screen as informational.
- [ ] **`AdminDataTable.jsx:1633-1640`** shows a fake "Time" view: `GMT+01:00`, fixed NTP servers, and every weekday 00:00-24:00.
  - UI fix: hide it, or show "not available".
- [ ] **Popups that are pure mockups:**
  - `ServerPropertiesPopup.jsx` (whole file; its OK button has no handler)
  - `AccountAllocationPopup.jsx` (OK only closes)
  - most of `ManagerPropertiesPopup.jsx` (L77 `'900546'`, L93-97 `demo\Propfirm`, L150-202 static permission tree, L238-254)
  - most of `SymbolPropertiesPopup.jsx` (margin, swaps and trade tabs full of `0`; OK only closes)

  UI fix: show only the fields that load real data, and mark or remove the rest.
- [ ] **Unreachable group tabs.** `GroupPropertiesPopup.jsx:213` renders only 3 tabs; the other 6 are dead code full of hardcoded lists (RUR, Flexy Markets, mql5.com, `$0.00`).
  - UI fix: delete the dead tabs.

### Fake values inside real screens
- [ ] `AuthenticatedApp.jsx:898` always says "Connected to RTX5-PROD-01", and says Connected for any status other than `error`. → Use `connectionStore` and the real server name.
- [ ] `AuthenticatedApp.jsx:424-425` gives the server popup a random ID (`Math.random()*10+1`). → Pass the real ID.
- [ ] `ActionToolBar.jsx:211` "Connected to RTX5 Trade Server"; `ActionToolBar.jsx:57` defaults `connStatus = 'connected'`. → Use `connectionStore`, with `'unknown'` as the default.
- [ ] `AdminDataTable.jsx:227,230` shows every group as `'Main Trade Server'` / auth `'Normal'`. → Show the group's own fields, or "—".
- [ ] `AdminDataTable.jsx:1524` gives every server the ID `'SRV-001'`.
- [ ] `AdminDataTable.jsx:556-557` defaults symbols to `'Enabled'` / `'GTC'`; `544-547` defaults balance and equity to 0 and status to active. → Show "—".
- [ ] `MarketWatchDock.jsx:468-471` shows the same Contract Size / Trade Mode / Expiration / Margin Profile text for every symbol; line 442 falls back to `'Trading Contract'`. → Use the symbol's metadata, or hide the rows.
- [ ] **SuperAdminConsole fallbacks:**
  - L1814 login `'10001'`
  - L1559 gateway `{state:'ready'}` (and the tab never loads its status)
  - L1325 central LP `{status:'idle'}`
  - L1501 candle storage `{status:'fleet_idle'}`
  - L711 KPI `'Active'`
  - L942 any status that isn't "suspended" shows green
  - L698-701 broker count falls back to the list length
  - L947/952/1107/1157-1160/1243/1249/1353 made-up plan, server count, expiry, port, role and protocol
  - L675 always says "200 OK"
  - L1822/1914 placeholder password and licence key

  UI fix: show "—" / "not available", and load `lp-gateway.status` when the tab opens.
- [ ] `services/brokerAuth.js:105-120, 354-356, 467-469, 518-520` adds a hardcoded Nexa broker record to **every** discovery list. → Remove it; discovery is the only source.
- [ ] `services/brokerAuth.js:736` marks a manually added broker `status: 'active'` without checking it. → Show "unverified".
- [ ] `services/api.js:83` `leverage || 100`, `:56-57,85` `'Individual'`/`'Active'`, `:62,77-90` money `: 0`. → No invented defaults.
- [ ] `services/api.js:106,198` guesses the volume unit (`volume >= 100 → /10000`). → Remove the guess and use the API's own unit.
- [ ] `services/api.js:140` treats every non-buy `cmd` as "sell". → Map the full order-type list.
- [ ] `utils/sessionUser.js:19-27` makes up `id:'admin'`, a role and wildcard permissions; `superAdmin.service.js:130` makes up `role:'super_admin'`. → Don't invent identity or permissions.
- [ ] `services/instruments.service.js:72` and `SymbolsTab.jsx:36,52` treat a missing `enabled` as true; `symbolManagementData.js:33…236` do the same for `normalizeBool(…, true)`. → Show "unknown".
- [ ] `hooks/usePositions.js:44-50`: `useExposure` / `useTopAccounts` always return `[]`. → Connect them to `PositionsService` or delete them.
- [ ] `data/terminalData.jsx:192-210` shows a fixed server cluster with a fixed red/green health icon ("TradeProcessor SQL_E" is always red). → Remove the colours, or connect them to real status.
- [ ] `AboutModal.jsx:6` falls back to version `'1.0.0'`. → Use the Electron version from the build, or "unknown".
- [ ] `MenuBar.jsx:170-182` has a placeholder Notifications panel. → Hide it.
- [ ] `BrokerAuthScreens.jsx:826-834` has "Remember me" (always checked, does nothing) and "Forgot password?" (does nothing). → Remove them, or make them work.
- [ ] `ActionToolBar.jsx:88,193,202,252` has placeholder buttons that run unrelated actions ("Cascade Windows" → Groups, "System Alerts" → refresh). → Remove them.
- [ ] `AdminContextMenu.jsx:69-93` has 14 items, of which only Add/Edit/Delete work; "Auto Arrange" is always checked. → Hide the items that don't work.
- [ ] `AdminDataTable.jsx:1813` has a "Current database" dropdown whose value is never used. → Remove it.
- [ ] `SuperAdminConsole` "Create License Plan" button opens nothing. → Hide it.

---

## 🟠 Phase 3: Errors shown as "no data"
*Why: a failing backend looks like an empty, healthy system.*

- [ ] 🔥 `RiskEventsView.jsx:26-27` → "No events found" on error.
- [ ] 🔥 `SuspiciousActivityView.jsx:29,41` → "No suspicious activity found" on error.
- [ ] `RiskReportsView.jsx:20,115-116` → "No toxic flow detected" before loading, or after an error.
- [ ] `SecurityAccessView.jsx:60-61,182-183,437-447,632-633,327` → all 5 tabs.
- [ ] `CommunicationsView.jsx:47-48,179-180,318,546-547`
- [ ] `LPRoutingView.jsx:343-351` → "Create First Route" shown during an outage.
- [ ] `PaymentMethodsView.jsx:108-109`, `TransactionHistoryView.jsx:24-25`, `ComplaintsView.jsx:49-50`
- [ ] `SwapFreeGroupsView.jsx:23-26`, `LeveragesView.jsx:29-38,52-55`, `LeverageScheduleView.jsx:141-145`, `SpreadsView.jsx:24-26`, `SessionOverridesView.jsx:186-188`, `HolidaysView.jsx:370-372`
- [ ] `services/api.js:282-291` and `instruments.service.js:188-190` return `.catch(() => [])` / `null`.
- [ ] `hooks/useCachedTabRequest.js:74-77` sets data to `[]` on error. → Use `null`.
- [ ] `FixRelayConfigPanel.jsx:17-23` uses `Promise.all`, so one failure hides both panels. → Use `Promise.allSettled`.
- [ ] `GatewaysView.jsx:20,27,124-128`: when loading fails, the default form can still be saved. → Block Save.

**Standard UI fix:** use the existing `buildActionableErrorState` / `ActionableErrorState`, as `RiskLimitsView` already does. Keep three separate states: loading, error and empty.

---

## 🟡 Phase 4: Broker-specific & infrastructure values in UI code
*Why: the same build must work for every broker.*

- [ ] `src/config/backendTarget.js:73-108, 258-315` has the GTA / FXTrust IPs, domains and name lists, and matches them by searching `JSON.stringify(env)`. → Delete the special cases.
- [ ] `backendTarget.js:437-439` hardcodes the FXTrust WS URL with no override; `:473-474` checks the FXTrust host directly. → Use broker `ws_url` / `direct_manager_paths`.
- [ ] `services/brokerAuth.js:25-31, 319-321, 340` forces GTA's login server to `broker-server-2`; `:368` falls back to test-broker IP `100.120.168.28`. → Remove both.
- [ ] `services/brokerAuth.js:122-152` ships a mock broker list with real hosts in the production bundle; `.env.example:10` enables it by default (`VITE_USE_MOCK_DISCOVERY=true`). → Make it dev-only, and set the default to `false`.
- [ ] `services/brokerAuth.js:71` rejects URLs matching a company domain regex. → Move the pattern into runtime config.
- [ ] **Port 8091 is assumed to mean plain HTTP** in `backendTarget.js:4,199,366-371,483-486`, `endpoints.js:80-114`, and `brokerAuth.js:18,245,437-456,724-730,776-779`. → Use the broker record's port and protocol.
- [ ] **Hardcoded fallback hosts:**
  - `vite.config.js:28-31` (includes the typo `fxtrustsuperbackned`)
  - `superAdmin.service.js:10,17-21` (same typo)
  - `brokerAuth.js:19-23`
  - `docker-entrypoint.sh:14,19`
  - `electron/main.js:33-50`: plain-HTTP IP `69.197.178.27`

  → Require config and fail clearly. Keep **one** Super Admin host value.
- [ ] `.env.electron:4-8` builds one broker (Nexa) and an internal IP into the desktop installer. → Pick the broker at login instead.
- [ ] `docker-entrypoint.sh:33-45` doesn't write `FEED_WS_URL`, `FEED_STATUS_URL`, `FEED_BROKER_ID`, `DIRECT_MANAGER_ORIGINS` or `FIX_RELAY_ENABLED`. → Add them.
- [ ] `GatewaysView.jsx:239` reads `VITE_FIX_RELAY_ENABLED` (a build-time flag only). → Read it from runtime config, or from the relay `feature_enabled` value.
- [ ] `utils/lpRouting.js:3` checks `=== 'ORRNN'` to find the internal route. → Use the `routing_mode` / `is_internal_route` field only.
- [ ] `src/lib/api.js:140-144` has no request timeout; `:196-224` logs every request and response in production. → Add a timeout, and gate logging with a log-level setting.
- [ ] `src/App.jsx:69` saves the access token as the refresh token when none comes back. → Fix.
- [ ] **Tokens and the user profile are kept in localStorage:** `authStore.js:146-147,303-311`, `brokerAuth.js:700-710`, `wsAuth.js:118-128` (token in the WS URL). → Re-check the user with `/auth/me` on startup, and stop putting tokens in URLs.

---

## 🟡 Phase 5: Permissions, navigation & feature switches decided in the UI
*Why: access policy lives in the frontend, and some checks can be bypassed.*

- [ ] **Permission check bypass (bug).** The toolbar opens `'Server Configuration'` (`ActionToolBar.jsx:74,140`), but the permission map key is `'Server Config'`, so the SERVER_ADMIN check never applies. → Use stable view IDs.
- [ ] **Views not in the permission map are allowed by default.** `hasPermission(user, null)` returns true, and `viewCapabilities.js:19,275` defaults to `WORKING`. → Deny by default.
- [ ] **7 Window-menu items have no permission mapping.** `MenuBar.jsx:129-159`: Accounts, Online Users, Server Reports, Dealer, Leverages, Plugins, Journal. → Map them, or remove them.
- [ ] `utils/permissions.js:161-232` hardcodes a map of 60+ views to permissions keyed by label; `:46-76` hardcodes the permission list; `:125-128` gives the `admin` / `super_admin` role names everything. → Use one registry keyed by view ID, and prefer the permissions the backend returns.
- [ ] `CreateRolePopup.jsx:5,10,87` uses only the static `ROLE_PERMISSION_OPTIONS`, while ManagersView already gets them from the backend (`getRoleDefaults`). → Reuse that list.
- [ ] `config/viewCapabilities.js:28-271` hardcodes the working/locked/static status of 45 views. → Keep one registry.
- [ ] `SidebarNavTree.jsx:4,11-40` builds the static `sidebarData` and **never filters it by permission**. → Filter with `canAccessView`, and recompute when the user changes.
- [ ] `SidebarNavTree.jsx:7` hardcodes 7 locked modules (`LOCKED_DROPDOWN_LABELS`). → Take them from the same registry.
- [ ] `AuthenticatedApp.jsx:784-786` enables `canAdd`/`canImport` by view name, ignoring permissions. → Check the actual permission.
- [ ] `AdminContextMenu.jsx:72-73`: Edit and Delete have no permission check.
- [ ] **"Platform Super Admin" is reachable from every broker UI:** `MenuBar.jsx:136`, `AuthenticatedApp.jsx:392-395`, the routes in `App.jsx:87-113`, and the link on every login page (`BrokerAuthScreens.jsx:874-889`). → Put it behind a runtime flag.
- [ ] `ManagersView.jsx:613` decides edit rights in the UI (`!row.is_admin && login !== me`), and `:266` / `adminValidation.js:5` use `role === 'admin'`.
- [ ] **Allowed actions are decided by status in the UI:**
  - `DepositsView.jsx:221,244`
  - `WithdrawalsView.jsx:223-240,254-259` (the menu and the buttons disagree for `on_hold`)
  - `ChargebacksView.jsx:231,250`
- [ ] **Text says a permission is required, but nothing checks it:** `SecurityAccessView.jsx:808` and `CommunicationsView.jsx:708`. → Actually check it.
- [ ] **Views are routed by English label strings:** `AdminDataTable.jsx:107-221` (the view sets), `:1914-1931` (cells picked by column label), and `AuthenticatedApp.jsx:80-89,973-990`. → Use IDs and keys.
- [ ] `src/main.jsx:5,9` controls the Sandbox with `SHOW_SANDBOX = false`, so the Sandbox and its mocks still ship. → Use `import.meta.env.DEV` with a lazy import.

---

## 🔵 Phase 6: Business option lists & policy defaults, by module
*UI fix for all of these: move each list into one place (e.g. `src/config/enums.js`), then load it from data where a service exists. Replace free-text fields with pickers that use the existing services (`useGroups`, `getGroupList`, instruments).*

### 6.1 Groups
- [ ] `CreateGroupPopup.jsx`:
  - L115-118 account types `standard/cent/micro/pro`
  - L124-125 B/A-Book only (no hybrid)
  - L155-156 commission types
  - L162-163 execution modes
  - L25,28,30,35 defaults `USD` / 100 / 100 / 50
  - L130-142 no min/max checks (stop-out ≤ margin call not checked)
- [ ] `GroupPropertiesPopup.jsx`:
  - L446 execution mode shown under the label "Risk management"
  - L461 leverage profiles `Crypto/Forex/Stock`, never saved
  - L452-471 margin controls that aren't connected
  - L556-557 every commission row shows the literal text `volume` / `instant`
  - L217-218 commission list not filtered by group
  - L761-762 commission types
- [ ] `AllocationsView.jsx:107` `Hedged/Netted`, with currency, server and country as free text.
- [ ] `AccountEditPopup.jsx:173,176`: group and currency are free text.
- [ ] `AccountAllocationPopup.jsx:90-125`: companies, groups, leverages, countries, confirmation methods and mail servers.

### 6.2 Symbols & instruments
- [ ] **Market categories are defined in 4 places:** `useSymbolStore.js:40-68`, `marketCatalogue.js:4-36`, `instrumentForm.js:5`, `categoryAssignment.js:18`. They guess categories with regexes and about 100 tickers. → Use `SymbolCategoryList` / the instrument's `category` field.
- [ ] `instrumentForm.js`:
  - L2,104 `calcModes`
  - L9-16,43-45 starter specs, `USD`, `UTC`, 24/7 sessions
  - L25 currency list
  - L91 symbol-name regex (at most 20 characters)
- [ ] `SymbolFormModal.jsx:22-29,120-127`: categories merged with the backend's, calc-mode labels, timezone as free text, currency as free text, session templates.
- [ ] `marketWatch.js:109-160`: hardcoded symbol descriptions (including specific stocks). → Use the `description` field.
- [ ] **Price decimals are guessed:** `marketWatch.js:98-104`, `useSymbolStore.js:123-124,313-314`, `MarketWatchDock.jsx:58-59,454-467`, and `LPRouteFormPopup.jsx:172,216,304` (`0.00001`). → Use the symbol's `digits`.
- [ ] `SymbolPropertiesPopup.jsx:315-325` falls back to digits 5, spread 10, contract size 100000 and tick size 0.00001; `:329` reads market depth from `trade_allowed`.
- [ ] `SessionsTab.jsx:12,19-48,56`: a fixed 7-row grid, and `type="time"` can't hold `24:00`.
- [ ] `CommissionSwapTab.jsx:131-135,186,238,376-379`: commission types, 1:500 prefilled, swap-free modes.
- [ ] `LpMappingsTab.jsx:374,382`: LP name and internal symbol are free text.
- [ ] `MarketDepthView.jsx:50-57,172-189` and `symbolManagementData.js:234-237`: depth defaults, and aggregation is free text.
- [ ] **Validation limits:**
  - `symbolManagementContracts.js:37,40,47,61`: max volume 999999, `per_lot`, leverage 1–10000, depth 1–50
  - `SymbolManagement` pages: `5000` row cap (`symbolManagementData.js:4`, `SymbolsTab.jsx:13,302`)
- [ ] **Group and symbol typed as free text** in:
  - `SessionsTab.jsx:87`, `CommissionSwapTab.jsx:372`, `AdvancedTab.jsx:174`
  - `SymbolVisibilityView.jsx:42-173`, `LeverageScheduleView.jsx:73`
  - `SpreadsView.jsx:73`, `SessionOverridesView.jsx:239`
  - `CreateLeveragePopup.jsx:82-117`, `CreateSpreadSchedulePopup.jsx:83-89`, `CreateHolidayPopup.jsx:108-116`

### 6.3 Managers & security
- [ ] Password policy `12–72` (`ManagersView.jsx:457`, `adminValidation.js:147-149`); `6–64` in `DummyGroupPropertiesPopup.jsx:313`; minimum 8 in `GroupPropertiesPopup.jsx`. → Keep one policy constant.
- [ ] `SecurityAccessView.jsx`:
  - L94-100 rule types and scopes
  - L196 throttle defaults 100/60/10
  - L223,245 scopes and actions
  - L310 `LOG_LEVELS`
  - L467 backup defaults (`0 2 * * *`, `/backups/daily`, 30 days)
  - L495 backup types
  - L685-689 plugin types, and a maximum of 1000
- [ ] `SuperAdminConsole.jsx`:
  - L1968-1970,1910 plan list `standard/enterprise/pro` (`licensePlans` is already fetched but not used)
  - L1112 extension default 30 days
  - L591,634,1575,1594 counts written as "91" and "10". → Use `CATALOG.length`.

### 6.4 Payments
- [ ] `PaymentMethodsView.jsx:20,61,66,158`: method types; `USD` default and free-text currency.
- [ ] `DepositsView.jsx:29,71-72,194`, `WithdrawalsView.jsx:30,70-73,196`, `ChargebacksView.jsx:82,97,128-129,204`, `TransactionHistoryView.jsx:55`, `PaymentGatewayView.jsx:152`: statuses, types, reasons, and method or gateway entered as a raw ID.
- [ ] `PaymentReconciliationView.jsx:61`: gateway ID entered by hand.

### 6.5 Risk & compliance
- [ ] `RiskLimitsView.jsx:8-13`: scope types, limit types and actions.
- [ ] `RiskEventsView.jsx:5`, `SuspiciousActivityView.jsx:5-6`: severities, pattern types, review actions.
- [ ] `RiskReportsView.jsx:124`: toxic-flow colour thresholds 80/70; `:84-86` only 3 PnL parts shown, the rest dropped.
- [ ] `RegulatoryReportsView.jsx:5,173-175`: EMIR/MiFID/AML only.
- [ ] `ComplaintsView.jsx:5-7,253,272-274`: categories, statuses, priorities; the assignee is entered as a raw login.
- [ ] `DataExportsView.jsx:55,83-94,136,189-190`: report list, the rule for which reports need dates, the audit export is unfiltered and always CSV, and KYC is only yes/no.

### 6.6 Platform & integrations
- [ ] `GatewaysView.jsx:12-19` and `feedConfigPayload.js:39-53,329`: providers `rtxmd/t4b/equinix`, defaulting to `rtxmd`.
- [ ] `CommunicationsView.jsx:90,95,98,232,366`: channels, event types, templates, segments and message types (some as free text).
- [ ] `CustomFieldsView.jsx:6-7`: entity types and field types.
- [ ] `TradingTerminalConfigView.jsx:6-8,17-22,33-35,42`: chart types, timeframes, themes; defaults repeated 3 times.
- [ ] `FeatureFlagsView.jsx:165-181`: flag name and group are free text.
- [ ] `FeedTenantsView.jsx:226-227`: quota 50 and 100 msg/s; `:290,668` "FIX 4.4" fixed.
- [ ] `ServerConfigView.jsx:162-171,326-388`: settings values have no type, and the halt symbol is free text; `:383` shows the internal Redis key.
- [ ] `LPRoutingView.jsx:8-24,130-131`: mode and fallback labels; a null value crashes the page.
- [ ] `LPRouteFormPopup.jsx:13-23,45,567-569,607-609,625-629`: modes, policies, rounding "Trader's worst", markup mode, empty BBI pool list, order types.
- [ ] `AntiDDoSView.jsx:188-218`: vendor list.

### 6.7 Tables & data views
- [ ] `AdminDataTable.jsx:608-687` has fixed column sets, and `:118-119` fixed page sizes `100 / [50,100,250]`.
- [ ] `AdminDataTable.jsx:416-424` keeps the closed-order status list in the UI; `:340-349` maps MT5 buy/sell as 0/1.
- [ ] `AdminDataTable.jsx:869-875`: Deals is fixed to the last 30 days, with no control to change it.
- [ ] `AdminDataTable.jsx:1146,474-476`: the symbol filter only lists symbols from the current page.
- [ ] **Only the first 100 orders and deals ever load:** `services/api.js:188,222` (`limit=100&offset=0`). → Add paging.
- [ ] `ExposureView.jsx:11,198-206,229`: `toFixed(2)`, no currency, `side === 'buy'`.

---

## ⚪ Phase 7: Currency, locale, timezone & number formatting
*UI fix: one shared formatter module (`formatMoney`, `formatPrice`, `formatDateTime`) that takes its currency, digits, timezone and locale from settings.*

- [ ] **`$` hardcoded:** `DepositsView.jsx:164` (in the approve confirmation), `GroupPropertiesPopup.jsx:401,409,415`.
- [ ] **`'USD'` hardcoded 36 times in JSX.** Top files: `terminalData.jsx`, `DummyGroupPropertiesPopup.jsx`, `IntegrationsView.jsx`, `AllocationsView.jsx`, the form defaults in `DepositsView.jsx:29` and `PaymentMethodsView.jsx:20`, and `ActionToolBar.jsx:277-280` (Demo/Real/USD quick filters).
- [ ] **Money rounding assumes 2 decimals:** `adminValidation.js:79`. The 1e9 cap is at `:55,74`.
- [ ] **`toLocaleString()` / `toLocaleTimeString()` use the browser timezone** in about 12 views, including `AdminDataTable.jsx:331-335`, `MarketWatchDock.jsx:473,534`, `ManagersView.jsx:25-28`, `SecurityAccessView.jsx:16`, `FeedTenantsView.jsx:31` and `LeverageScheduleView.jsx:6-9`.
- [ ] **Dates are computed in UTC, so "yesterday" and the "to" date can be off by a day:** `RegulatoryReportsView.jsx:7-8`, `DataExportsView.jsx:9-10`, `RiskReportsView.jsx:8-13`, `reports.service.js:4`.
- [ ] **Local time is sent with no offset:** `LeverageScheduleView.jsx:38-39,102,105`, `CommunicationsView.jsx:214,233` (`scheduled_at`), `PaymentReconciliationView.jsx:48,65`.
- [ ] **Session and spread times are shown with no timezone label:** `SessionsTab.jsx`, `SpreadsView.jsx:122-123`, `SessionOverridesView.jsx:296-299`, `CreateSessionOverridePopup.jsx:22-26`.
- [ ] **`toFixed(4)` on every number** in `RegulatoryReportsView.jsx:9`, so a login shows as `12345.0000`.
- [ ] **Epoch seconds assumed** (`v * 1000`) in about 12 files, and seconds vs milliseconds is guessed at `AdminDataTable.jsx:306-329`.
- [ ] **Day names in English only,** repeated in 4 files. → Use `Intl`.
- [ ] **Status clock uses the client's local time:** `AuthenticatedApp.jsx:47-58`.

---

## ⚪ Phase 8: Timers, limits & paging
*UI fix: collect them into `src/config/tunables.js`, which can be overridden from `runtime-config.js`.*

- [ ] Auto-refresh every 15 s: `AuthenticatedApp.jsx:684-693`, with "15s" also repeated in text (`ActionToolBar.jsx:238`).
- [ ] Positions poll every 2 s: `usePositions.js:5` and `AdminDataTable.jsx:843`.
- [ ] Feed: status poll 15 s, reconnect 500 ms with no backoff, sync 10 s (`useSymbolStore.js:7-10,197,249`); quote freshness 30 s (`marketWatch.js:107`).
- [ ] Feed retries with no backoff: `sessionMarketFeed.js:23`, `sessionStateFeed.js:4`.
- [ ] Timeouts of 5/7/8/10/15/30 s across the services, plus `useCachedTabRequest.js:4` (5 s for every tab).
- [ ] Cache lifetimes: accounts 2 min (`accounts.service.js:18`), 15 s and 30 s in hooks; the clone-symbol cache has no expiry.
- [ ] Page sizes 20/50/100 in hooks and services; 25 and `[10,25,50,100]` in Allocations; transaction limit `200` written 3 times (`TransactionHistoryView.jsx:15,20,35`).
- [ ] Audit log cut to 20 rows (`SuperAdminConsole.jsx:807`); backup history `limit: 20` (`SecurityAccessView.jsx:444`).
- [ ] `SymbolsTab.jsx:128-141` waits a magic 3000 ms for the feed.
- [ ] Recent brokers capped at 5 (`brokerAuth.js:666,674`).
- [ ] Views that don't refresh themselves: Exposure, Risk Events, Suspicious Activity, the Managers online list, Super Admin health.

---

## ⚪ Phase 9: Branding & theme
*UI fix: one `branding` object (from `runtime-config.js`) used for the title, logo, favicon, About box, login screens and Support Center; plus a real light theme.*

- [ ] **The product name is spelled 5 ways:**
  - `index.html:7`
  - `AuthenticatedApp.jsx:258,579,630,708,829,1104`
  - `MenuBar.jsx:62,72-74,166`
  - `AboutModal.jsx:26-27,43,48`
  - `BrokerAuthScreens.jsx:377,412,793-820`
  - `SuperAdminAuthScreen.jsx:91-93`
  - `SuperAdminConsole.jsx:504`
  - `electron/main.js:20`, `package.json` build section, `scripts/apply-win-icon.js`
- [ ] **Vendor and support details:** `AboutModal.jsx:8,56` (`support@orrnn.com`, "Orrnn"), `SupportCenterView.jsx:10-61`, `terminalData.jsx:356` ("Orrnn Leads").
- [ ] **Logos and images:** `MenuBar.jsx:73` (`admin-symbol.png`), `BrokerAuthScreens.jsx:17-20,91-137` (the logo and hero image are always the RTX5 ones, even though the broker's `logo_url` exists), `index.html:5` favicon.
- [ ] **Dead links (`href="#"`):** `IntegrationsView.jsx:192-196`, `AntiDDoSView.jsx:10,41,223`, `SupportCenterView.jsx:49-60`; plus the mql5.com URL at `GroupPropertiesPopup.jsx:437`. `HelpModal.jsx` has no docs link.
- [ ] 🔥 **The light theme is the dark palette.** `theme/tokens.css:5-7`, while the default is `'light'` (`AuthenticatedApp.jsx:122`). As a result, `MenuBar.css:36` turns the logo black on a dark bar, and `legacy-overrides.css:145` gives native inputs light styling.
- [ ] **1,673 hex colour classes in JSX, 96 of them not remapped.** Worst files: SuperAdminConsole, ServerStatusPanel, ManagersView, SecurityAccessView. `legacy-overrides.css` is an `!important` shim. → Change them to token classes, then delete the shim.
- [ ] **Screens with their own palettes:** `SuperAdminConsole.jsx` (slate/indigo, `#0b0f17`), `BrokerAuthScreens.jsx` (about 20 hex values), `SuperAdminAuthScreen.jsx`.
- [ ] **Component CSS:** `MarketWatchDock.css:8-19` has a private copy of the palette; `:350` `#04395e`; `DummyGroupsExplorer.css:172-187` blue gradient; `manager-ui.css:18-21` redefines `--accent-soft`; `TreeItem.jsx:100-130` `#04395e` / `text-white`.
- [ ] **Colour chosen by hex or string:** P&L colours in the Analytics views, the `ServerStatusPanel.jsx:7-10` logic, the status/severity colour maps copied into 6 or more views.
- [ ] **Fonts:** Manrope is bundled but unused (`index.css:1-4`); JetBrains Mono is referenced but not bundled.
- [ ] **Keyboard shortcuts are listed in 4 places that disagree** (`AuthenticatedApp.jsx:842-891`, `MenuBar.jsx`, `ActionToolBar.jsx` tooltips, `HelpModal.jsx`). Ctrl+M is advertised as one thing and actually toggles the theme. → Use one shortcut registry.
- [ ] **Theme auto-switch hours fixed at 06:00–18:00:** `AuthenticatedApp.jsx:233-236`, `MenuBar.jsx:113`.
- [ ] **i18n:** every user-facing string is inline English, including errors detected by English text (`lib/api.js:15`, `brokerAuth.js:609-629`).

---

## ⚪ Phase 10: Dead code & leftovers to delete
- [ ] `PaymentsView.jsx`: never imported, and contains 6 real vendor contacts (emails and phone numbers).
- [ ] `AnalyticsExportsView.jsx`: never imported; duplicates DataExportsView.
- [ ] `DummyGroupsExplorer.jsx`, `DummyGroupsNavigation.jsx`, `CategorySymbolsModal.jsx`, `SymbolCatalogueCells.jsx`, `TabBar.jsx`: not imported anywhere.
- [ ] Dummy-mode data: `utils/dummyGroups.js`, `store/useDummyGroupsStore.js`, `DummyGroupPropertiesPopup.jsx`, `DummySymbolList.jsx`, and the leftover wiring in `AuthenticatedApp.jsx:103,513-514,760-761,1000`; `docs/groups-dummy-workspace.md` is out of date.
- [ ] Unused mock tables in `data/terminalData.jsx:391-439`: "Flexy Markets Limited", "John Doe" and "Jane Smith", symbols, payments.
- [ ] `services/authService.js`: appears unused.
- [ ] `nginx.conf`: not used by the Dockerfile.
- [ ] `ui/Sandbox.jsx`: mock data shipped in the production bundle.
- [ ] Misspellings: `'Utency'`/`'Ultency'` duplicate keys in `viewCapabilities.js:194-205`, `MenuBar.jsx:151`, `NetworkCluster.jsx:325`; mis-encoded character at `MenuBar.jsx:197`.
- [ ] Missing `onClick` handlers: several Settings gear icons (`PaymentMethodsView.jsx:165`, `TransactionHistoryView.jsx:67`, SymbolManagement).
- [ ] `restart-admin-ui-3001.ps1:7-10` assigns to the built-in `$PID` variable (bug).

---

## Suggested sprint split

| Sprint | Phases | Outcome |
|---|---|---|
| 1 | 0 + 1 | No secrets in the repo or bundle; the UI never writes invented values |
| 2 | 2 + 3 | Nothing fake is presented as real; failures show as errors, not "no data" |
| 3 | 4 + 5 | One build works for every broker; permissions deny by default and are keyed by ID |
| 4 | 6 (6.1–6.3) | Groups, symbols and managers use central lists, pickers and no invented defaults |
| 5 | 6 (6.4–6.7) + 7 | Payments, risk, platform and tables are data-driven; currency and timezone are correct |
| 6 | 8 + 9 + 10 | Tunables centralised, branding and a real light theme, dead code removed |
