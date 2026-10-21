# Finn finder

Firefox/Zen extension that adds a panel to every listing in the finn.no real-estate search (`/realestate/*/search.html`):

- **Travel times** from the listing to your own destinations by public transport, car, walking and bike, using [Entur](https://developer.entur.org/). Hover a time for details, such as the transit lines used.
- **Monthly cost**: the loan payment plus fellesutgifter, optionally split between several people ("Jonas 63 %: 26 699 kr · Kari 37 %: 15 680 kr"), each split shown next to the total.

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

This rebuilds on change and starts Zen in a fresh, temporary profile with the extension loaded as a temporary add-on, opened on a finn.no search.

| Script | Browser | Profile |
| --- | --- | --- |
| `pnpm dev` | Zen | new temporary profile each run |
| `pnpm dev:persist` | Zen | `.web-ext-profile/zen`, kept between runs |
| `pnpm dev:twilight` | Zen Twilight (nightly) | new temporary profile each run |
| `pnpm dev:twilight:persist` | Zen Twilight | `.web-ext-profile/twilight`, kept between runs |

The `:persist` variants keep your extension settings, the travel-time cache, finn.no logins and everything else between runs. Delete the folder to start over. For Firefox, run `node build.mjs --watch --run --browser=firefox` (add `--persist` to keep the profile).

### Use it in your everyday browser

The scripts above can't attach to a browser that is already running, so they always start a separate profile. To use the extension in the Zen or Zen Twilight you normally use:

1. Once: open `about:config` and set `xpinstall.signatures.required` to `false`. This lets the browser install the unsigned extension.
2. Run `pnpm addon:zen` or `pnpm addon:twilight`. This builds `web-ext-artifacts/finn-finder.xpi` and opens it in that browser, which asks you to add the extension.

After changing the code, run the same command again to install over the old version. Your settings and cache are kept.

For quicker iteration you can load it temporarily instead:

1. Run `pnpm watch`.
2. Open `about:debugging#/runtime/this-firefox`, click *Load Temporary Add-on…* and pick `dist/manifest.json`.
3. Click *Reload* there after each change.

A temporary add-on is removed when the browser restarts, but its settings are kept for the next time you load it.

If the `addon:` scripts can't open the browser, run `pnpm package` and install the `.xpi` from `about:addons` → ⚙ → *Install Add-on From File…*.

Regular Firefox release builds ignore that pref. There, sign the extension as an unlisted (self-distributed) add-on with your [AMO API credentials](https://addons.mozilla.org/developers/addon/api/key/):

```sh
WEB_EXT_API_KEY=... WEB_EXT_API_SECRET=... pnpm sign
```

## Settings

Click the toolbar icon to open the settings. If the extension asks for access to finn.no and api.entur.io, click **Gi tilgang**.

- **Reisemål**: search for an address and pick a result, then choose which travel modes to show. Pick a street address where you can: stations and car-free squares often have no car route.
- **Reisetidspunkt**: public transport times are for arriving by this time on the next weekday. Car, walk and bike times assume no traffic.
- **Lån**: egenkapital, interest rate, loan term, annuity or serial loan, termingebyr, and two optional adjustments:
  - add 2.5 % dokumentavgift to the loan for selveier listings
  - subtract the 22 % interest tax deduction
- **Fordeling**: split the monthly cost between several people. Each split has a name, a percentage and an optional max per month. The splits must add up to 100 % before they are shown on the cards.
  - Over its max, a split turns red with a warning icon. Hover it to see by how much.
  - Close to its max, a split turns orange. "Oransje fra" sets what counts as close (default 90 % of the max).

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
