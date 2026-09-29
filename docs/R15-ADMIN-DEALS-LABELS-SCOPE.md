# R15 Admin Deals display labels

The real account 200004 closing deal 446759 is displayed in Admin Deals with API enum values `deal_sell` and `entry_out` in the Action and Entry cells. The visible labels should read `Sell` and `Out`, matching the existing Buy/Sell table convention. The same display mapping covers `deal_buy` and `entry_in`.

This change is confined to Deals cell rendering. The API response and `getDealRow` data, including `raw`, remain unchanged; toolbar JSON/CSV exports continue to use the mapped raw enum fields, while the visible-table export continues to reflect visible cell text. Ticket sorting, search, prices, fees, and profit are unchanged. Unknown enums remain visible verbatim rather than being guessed.

Verify the pure label mapping with focused cases and run the existing Positions/Deals test and UI build. No broker action, backend change, or runtime process change belongs to this chunk.

Actual Admin UI readback at 2026-09-27 23:51:13.165 UTC passed: the unique closing deal 446759 for account 200004 displayed `Sell` and `Out`, with balance 995.83 and closing profit -4.17. The protected receipt is `ui-close8-account-deals-readonly-v2-1790553073165.json`. This readback establishes the customer UI result; it does not establish raw LP fee accounting.
