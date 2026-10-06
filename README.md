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

