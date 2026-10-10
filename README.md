<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6c7988c0-7d9f-46ff-aa88-d1c0cbf74980

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`





## Readability in both themes

Every screen was measured in dark and light mode against WCAG contrast — home, records, asset
library, all five settings tabs, the document editor and all five Pricing Desk tools, 28 screens in
all — using the site's own Tailwind build. 97 pieces of text fell below 3:1 (effectively
unreadable); none do now.

What changed: small grey captions on dark surfaces moved from gray-600/700/800 to gray-400, and
small red text on dark surfaces from red-700 to red-500. So the same class reads well in light mode
too, three helpers in `index.html` give `text-gray-300`, `text-gray-400` and `text-red-500` their
dark counterparts when `html.light-mode` is on (anything inside `.force-dark`, the hero glass over
the photo, keeps its dark-theme colour). The "View History" link no longer rests at 40% opacity.
In the Pricing Desk, the costing tool's footnotes (cream text that vanished in light mode) and its
red section tags now follow the theme.

Also checked: no JavaScript errors and no sideways scrolling on any page, in either theme, on a
desktop or a phone-sized screen. The link to a non-existent `/index.css` was removed.

A second pass measured what the first could not: the text typed inside input boxes and their
placeholders. It found the costing tool's number boxes (SL prefix, rate, driver + C&F) white on
white in dark mode — the tool's own stylesheet painted them `#fff` — and several faint
placeholders, including the car-name search box in light mode. All input text and placeholders now
read in both themes, and the home page's moving road line is drawn in dark ink on a light page.

## SL prefix in the costing workbook

The SL prefix is optional. With a value, the workbook opens with RAITA SL NO. (prefix & SL) exactly
as before — verified cell for cell against the previous build. Left empty, that column is not
written: SL NO. becomes column A, every later column and formula moves one to the left, the title
rows span the narrower table, and the rate and driver inputs follow it. Recalculated, both versions
give identical figures (1,188 values compared, no formula errors).

## Price calculator on the home page

Between the performance metrics and Business Intelligence, the home page carries the calculator
itself — vehicle and duty, rate and charges, and the costing price — over a quiet animated
backdrop of a car crossing a road. The box lines up with the document cards above it and leaves
the same breathing room below as above.

Duty month, car year and car name use the Pricing Desk's own dropdowns, including the search that
matches a chassis code. Choosing a car on this page does not push a list down the section: the
panel stays open and shows that car's duty amounts in place, with a row back to the car list. Uploading duty sheets stays in the Pricing Desk; the arrow in
the card's top corner opens the desk with the Price Calculator already selected, and the
"Pricing Desk" button on the hero card scrolls down to this section instead of leaving the page.

The two calculators are one. `pricing/price/priceStore.ts` holds the duty sheets, the rate and
charges (saved in this browser) and the car being priced right now (for the session), and both
views read and write it, so a month, a car, a rate or a profit set in one appears in the other
immediately.

## Start-up

The home page now paints from the local copy first and refreshes from the cloud behind it, and the
four initial reads run together rather than one after another. With an unreachable cloud the app
used to sit behind the loader for about 29 seconds; it is now usable in under a second when there
is data on the device, and under 8 seconds on a first run. Cloud reads give up after 5 seconds,
writes after 12, and the address in the bar follows the view immediately.

## Records list and search

The table shows Category · Document / ID · Recipient · **Chassis No** · Valuation · Operations.
The vehicle name no longer appears under the recipient — the chassis number replaced it as its own
column, with an em dash where a document has none.

Search now looks at everything on the document: number, client, phone, address, vehicle title,
chassis and engine number, brand, model, year, colour, garage number, price and date. Each typed
word must appear somewhere, and separators are ignored on a second pass, so:

- `noah` or `vezel` — finds by vehicle
- `ZWR80`, `nke165` — finds by chassis, any fragment
- `inv 1` — finds INV-000001 (spaces and hyphens do not matter)
- `september`, `সেপ্টেম্বর`, `09-2026`, `2026-08` — finds by date, in English or Bangla


## Drafts and auto-save

Every editor — the four document editors and the product-invoice editor — has **Save as Draft**
beside the main button. A draft may be unfinished (it skips the buyer-name check); opening it again
and pressing the main button makes it final. A document carries `status: 'draft' | 'final'`; one
without a status is final, so every document saved before this feature stays final. Drafts are
stored on the server like any document, so every computer sees them.

- **Records**: drafts carry an amber DRAFT mark, a **Drafts** chip lists only drafts, and typing
  "draft" in search finds them. **All Records** clears the filter.
- **Home**: Total Files and the total value count finished documents only; drafts are shown on
  their own as "+ n drafts".
- **Printing**: a draft prints exactly like a finished document (no watermark, by choice).
- **Spreadsheet export**: a Status column says Draft or Final.

**Auto-save.** While an editor is open, its form is copied to this browser about a second after
each change (`gd_autosave_v1`), starting from how the form settled when it opened, so a form that
was only opened is never saved. Saving — as a draft or final — clears the copy. If the tab is closed,
the browser stops, or the login runs out (or Log Out is pressed) with a form open, the next visit
after logging in shows "Unsaved work found" with **Resume**. Pressing **Discard** on an edited form
offers **Undo** for ten seconds; resumed work counts as edited, so it gets the same Undo. The copy
never enters Records by itself.

Also fixed: the product-invoice editor crashed when a document's payment list was empty
(`payments?.[0].amount`); it now reads `payments?.[0]?.amount`.

## Undo after a delete

Deleting a document (Records) or an asset (Asset Library) still asks for confirmation and still
removes the item at once — locally and in the cloud — so nothing is left half-done if the page is
closed. A toast then offers **Undo** for ten seconds; pressing it saves the removed copy again
under the same id, with the same number, chassis and dates, and confirms "Restored".

## Duty sheets on every computer

The Pricing Desk's duty sheets, the chosen month, and the rate, C&F and drive figures are kept in
the Hostinger database as well as in the browser (`utils/priceCloud.ts`), in the existing `preferences` table —
`price_desk` for the data and `price_pdf:<id>` for each original PDF, which the server stores as a
file in `/var/www/portal/uploads` — so no new table is needed. Every change is stamped with a time and sent up a moment later; on start-up and
whenever the window regains focus the cloud copy is fetched and taken if it is newer. A computer
that has never seen a sheet gets it on first load, and the PDF preview fetches the file from the
cloud on demand. Reset clears the cloud copy too. Sheets loaded on a computer before this existed
are merged into the cloud copy rather than replaced by it. The car being priced at the moment stays
on each device.

## Saving, syncing and backups

Everything is written to this browser first and then to the Hostinger database, so the app keeps working with
no connection. What happens when the cloud copy fails is now visible and recoverable:

- **A badge appears only when something is wrong** — amber with a count when writes are waiting,
  red when the browser is offline; nothing at all when everything reached the cloud. It sits beside
  the "Garir Dokan Pro" wordmark, and floats in the top-right corner whenever a full-screen panel
  (editor, preview, pro generator, settings) covers the navigation. Clicking it retries at once,
  hovering explains the state, and the document editor also shows a matching amber banner.
- **Nothing is lost.** A failed write is queued in `gd_pending_sync` and replayed automatically
  when the connection returns, on an interval, and on demand. Repeated edits of one record collapse
  into a single queued entry, and the replay always sends the newest local copy.
- **A refresh never wipes a waiting change** (fixed Oct 2026). Lists and settings read from the
  server are merged with the retry queue in `utils/storage.ts`: a record whose save is waiting keeps
  its local version, one whose delete is waiting stays out, and a waiting setting is not replaced by
  the server's older copy. Before this, saving the next document re-read the list from the server
  and dropped the waiting one, so its retry found nothing to send.
- **No hanging.** Every cloud call is time-bounded (12s); a blocked or flaky connection can no
  longer freeze saving, deleting or restoring — it falls into the queue instead.
- **Backup & Restore** lives in Global Settings. The backup is one JSON file holding every
  document, asset and setting; restoring adds and updates and never deletes anything that only
  exists on this device. A CSV of the document list is available for spreadsheets.
- **Crash guard.** An error boundary wraps the whole app and the Pricing Desk separately, so a bad
  record shows a readable message with a way back instead of a blank white page.
- **Direct links work on a cold load.** Opening /records, /assets, /settings or /pricing-desk
  straight from the address bar now lands on that page (previously the view could fall back to the
  landing page when data loaded instantly).

## Pricing Desk

The Garir Dokan Operations Desk is built into this site as the **Pricing Desk** page.

- Reachable from the top navigation (between Records and the settings gear), from the mobile
  sidebar, and from the "Pricing Desk" button on the home hero card.
- Its own address is `/pricing-desk`, and it opens with the same fade-in the other pages use.
- The page lives in `pricing/`: `PricingDesk.tsx` (the left panel and the five tools),
  `pricing/price`, `pricing/costing`, `pricing/stock`, and `pricing/pricing-desk.css`.
- That stylesheet is scoped to the page's `.gd-app` wrapper, so nothing on the rest of the site
  changes. The tools use the site's existing Tailwind build for utility classes.
- **The page follows the site's design language**: near-black surfaces with soft white overlays,
  the red accent, Plus Jakarta Sans headings, Courier Prime for codes and figures, rounded cards
  with blur, and the same fade-in entrance. All of it is driven by CSS variables declared on
  `.gd-app`, with a matching set under `html.light-mode .gd-app`, so the site's own dark/light
  switch re-themes the whole desk — the left panel, all five tools, tables, dropdowns, dialogs and
  the PDF preview included.
- The dropdowns render their panel at the page root and flip above the field when there is not
  enough room below, so a list is never clipped by a card or by the bottom of the window.
- The page reads the site navigation's height at runtime and offsets itself by that amount, so it
  stays clear of the bar at every breakpoint.
- Extra dependencies for the tools: `exceljs`, `jszip`, `xlsx`, `motion`.
- `jspdf` and `html2canvas` were removed (Oct 2026): no code imported them — documents are printed
  through the browser — so the built JavaScript is byte-for-byte the same without them. The same
  `npm uninstall` also pruned leftover `@supabase/*` entries from `package-lock.json`; Supabase was
  already gone from `package.json` and those entries were never installed.


## Excel design of the stock workbooks

BD Stock, Japan Stock and BD + Japan Combine each have a **⚙ Excel design** button in the
Workbooks header. It opens a panel with two choices, each shown as a small drawing:

- **Classic** — the look the sheets have today (teal header, red title bar). This is the default.
- **Brand Black & Red** — black title band with "GARIR DOKAN **OFFER LIST**", deep red header,
  light zebra rows and grid, bold car names, green IN STOCK / red STOCK OUT, prices with thousands
  separators and a dash for an uncosted car, black group separators, and a full-width red
  stock-out title. Header words are written in capitals (MILEAGE, SUPPLIER).

Only the look of the output file changes. Values, formulas, notes, row order, serials and column
widths stay exactly as the tool writes them, and so do the colours that carry a meaning: the
chassis fill (green confirmed, blue pending), red stock-out names, red transferred rows, prices
flagged red for manual entry, and link text.

- Each tool keeps its own choice. It is saved in the browser and in the `preferences` table as
  `stock_design` (newest change wins, read when a tool opens and when the window regains focus),
  so every computer uses the same design; a failed save goes through the normal retry queue.
- A workbook made in either design can be uploaded next month: separators are recognised in both
  colours and the header in both spellings. Choosing Classic for a Brand workbook puts the classic
  look back (title, header, rows and stock-out title); a classic workbook is left exactly as written.
- The design is applied as the last step (`pricing/stock/utils/sheetDesign.ts`), after the usual
  layout. The setting lives in `pricing/stock/utils/designSetting.ts` and the button and panel in
  `pricing/stock/components/DesignPicker.tsx`.
- Fixed at the same time: the combined sheet's stock-out title is now merged like the BD and
  Japan sheets. Unmerged, the centred title was cut off on the left ("ED STOCK OUT …").

## Column order of the stock workbooks (October 2026)

BD Stock, Japan Stock and BD + Japan Combine write their columns in this order:

`SL NO · CAR NAME · GRADE · YEAR · COLOR · POINT · MILEAGE · DESCRIPTION · CHASSIS ·
PRICE (DOLLAR) · PRICE (BDT) · DUTY · DRIVER + CNF · ADDITIONAL COST · COSTING PRICE · PRICE ·
LONG DESCRIPTION · LOCATION · STATUS · SUPPLIER · PICTURE(DRIVE LINK) · UPLOADED LINK · IMAGE ·
SOURCE SHEET` (A–X). Japan has no IMAGE column, so it ends at W.

- A master in the earlier order (PRICE in I, CHASSIS in J, costs in O–T) can still be uploaded:
  every column is found by its header text, and the output always comes out in the new order.
  Values, notes, links and each cell's look move with their column.
- Formulas follow their cells: the Japan costing chain is now `K = J*127`, `O = SUM(K:M)`,
  `P = SUM(O+N)` (PRICE (BDT), COSTING PRICE, PRICE).
- The three title rows and the stock-out title are merged from A to the PRICE column (P), in both
  designs.
- A chassis cell that has lost its colour (for example after columns were moved by hand) is marked
  blue — pending — like a newly added car. A coloured chassis keeps its colour.
- The thin BD/Japan divider in the combined sheet is white in the Brand design too, so the
  column grid lines no longer show through it.
- Old notes are now removed completely when rows are rewritten; before, a cell that had a note in
  the uploaded master could keep an empty note box.
- The order is defined in `pricing/stock/utils/columnLayout.ts`.
