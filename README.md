# Finn finder

Firefox/Zen extension that adds a panel to every listing in the finn.no real-estate search (`/realestate/*/search.html`):

- **Travel times** from the listing to your own destinations by public transport, car, walking and bike, using [Entur](https://developer.entur.org/). Hover a time for details, such as the transit lines used.
- **Monthly cost**: the loan payment plus fellesutgifter, with an optional split ("63 %: 26 699 kr/mnd") shown next to the total.

## Setup

```sh
pnpm install
pnpm build        # → dist/
pnpm test         # unit tests
pnpm lint         # typecheck + web-ext lint
```

### Run during development

```sh
pnpm dev
```

This rebuilds on change and starts Zen with the extension loaded as a temporary add-on, opened on a finn.no search. To use Firefox instead, set `FIREFOX_BIN=/Applications/Firefox.app/Contents/MacOS/firefox`.

You can also load `dist/manifest.json` as a temporary add-on from `about:debugging#/runtime/this-firefox`.

### Install permanently

Firefox and Zen only keep signed extensions installed. Sign it as an unlisted (self-distributed) add-on with your [AMO API credentials](https://addons.mozilla.org/developers/addon/api/key/):

```sh
WEB_EXT_API_KEY=... WEB_EXT_API_SECRET=... pnpm sign
```

Then install the `.xpi` from `web-ext-artifacts/` via `about:addons` → ⚙ → *Install Add-on From File…*.

## Settings

Click the toolbar icon to open the settings. If the extension asks for access to finn.no and api.entur.io, click **Gi tilgang**.

- **Reisemål**: search for an address and pick a result, then choose which travel modes to show. Pick a street address where you can: stations and car-free squares often have no car route.
- **Reisetidspunkt**: public transport times are for arriving by this time on the next weekday. Car, walk and bike times assume no traffic.
- **Lån**: egenkapital, interest rate, loan term, annuity or serial loan, termingebyr, and two optional adjustments:
  - add 2.5 % dokumentavgift to the loan for selveier listings
  - subtract the 22 % interest tax deduction
- **Fordeling**: your share in percent. Below 100 %, your share is shown next to the total.

The loan is based on **prisantydning**, not totalpris. Totalpris includes fellesgjeld, which fellesutgifter already pays for:

```
lånebeløp     = prisantydning (+ dokumentavgift) − egenkapital
månedskostnad = terminbeløp (+ termingebyr − rentefradrag) + fellesutgifter
```

New-build projects that only list a price range use the lowest price, shown as "fra".

## How it works

- `src/content.ts` watches the search results and fetches the page's data from finn.no's own `…/search.html.data?<query>` endpoint. That data is React Router's turbo-stream format, decoded in `src/lib/turbo-stream.ts`, and gives each listing's coordinates and prices. It then adds a panel to each `article.sf-search-ad`. If the data can't be loaded, it reads prices from the card text and geocodes the address instead.
- `src/background.ts` asks Entur's journey planner for all destinations and modes of a listing in one GraphQL request, with at most 3 requests running at once. Results are cached in `storage.local` for 14 days.
- Settings live in `storage.sync`, and open finn.no tabs update right away when they change.

The extension depends on finn.no's internal data endpoint and CSS class names, so a finn.no redesign may break it.
