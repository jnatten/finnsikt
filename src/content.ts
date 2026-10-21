import type { Coordinates, TravelResult } from "./lib/entur";
import { fetchListings, finnkode, listingFromCard, type Listing } from "./lib/finn-data";
import { formatDuration, formatKr, formatPct } from "./lib/format";
import { monthlyCost, splitCosts, type SplitCost } from "./lib/loan";
import { requestGeocode, requestOpenOptions, requestTravelTimes, type TravelTimes } from "./lib/messages";
import {
  isRoutable,
  loadSettings,
  MODE_NAMES,
  onSettingsChanged,
  splitsAddUp,
  type Mode,
  type Settings,
} from "./lib/settings";

const MODE_ICONS: Record<Mode, string> = { transit: "🚆", car: "🚗", foot: "🚶", bicycle: "🚲" };

interface Card {
  listing: Listing;
  travel: HTMLElement;
  cost: HTMLElement;
  travelRender: number;
}

const cards = new Map<HTMLElement, Card>();
const enhancing = new WeakSet<HTMLElement>();
const travelRequests = new Map<string, Promise<TravelTimes>>();
let settings: Settings;
let listingsUrl: string | undefined;
let listings: Promise<Map<string, Listing>>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function currentListings(): Promise<Map<string, Listing>> {
  if (location.href !== listingsUrl) {
    listingsUrl = location.href;
    listings = fetchListings(new URL(location.href)).catch((error) => {
      console.warn("[finn-finder] could not load listing data, falling back to card text", error);
      return new Map();
    });
  }
  return listings;
}

async function coordinatesFor(listing: Listing): Promise<Coordinates> {
  if (listing.coordinates) return listing.coordinates;
  if (!listing.location) throw new Error("Mangler adresse");
  const [place] = await requestGeocode(listing.location);
  if (!place) throw new Error(`Fant ikke «${listing.location}»`);
  listing.coordinates = place;
  return place;
}

function travelTimesFor(listing: Listing): Promise<TravelTimes> {
  let request = travelRequests.get(listing.id);
  if (!request) {
    request = coordinatesFor(listing).then(requestTravelTimes);
    travelRequests.set(listing.id, request);
    request.catch(() => travelRequests.delete(listing.id));
  }
  return request;
}

function renderCost(card: Card): void {
  const { listing, cost } = card;
  cost.replaceChildren();
  if (listing.price === undefined) {
    cost.append(el("span", "ff-muted", "Månedskostnad: –"));
    return;
  }
  const result = monthlyCost(listing.price, listing.sharedCost ?? 0, listing.ownerType, settings.loan);
  const from = listing.priceIsFrom ? "fra " : "";
  const main = el("div", "ff-amounts");
  main.append(el("strong", undefined, `${from}${formatKr(result.total)}/mnd`));
  if (splitsAddUp(settings.splits)) {
    for (const cost of splitCosts(result.total, settings.splits, settings.nearMaxPct)) main.append(splitChip(cost, from));
  }
  const shared = listing.sharedCost === undefined ? "felleskost. ukjent" : `felles ${formatKr(result.sharedCost)}`;
  const breakdown = el("div", "ff-muted", `lån ${formatKr(result.loanMonthly)} + ${shared}`);
  cost.title = `Lånebeløp ${formatKr(result.principal)} (prisantydning ${from}${formatKr(listing.price)})`;
  cost.append(main, breakdown);
}

function splitChip({ split, amount, status }: SplitCost, from: string): HTMLElement {
  const name = [split.label, formatPct(split.pct)].filter(Boolean).join(" ");
  const chip = el("span", `ff-split ff-split-${status}`, `${name}: ${from}${formatKr(amount)}`);
  if (split.maxMonthly) {
    const difference = formatKr(Math.abs(amount - split.maxMonthly));
    chip.title = `${difference} ${amount > split.maxMonthly ? "over" : "under"} maks (${formatKr(split.maxMonthly)}/mnd)`;
  }
  return chip;
}

function travelCell(mode: Mode, result: TravelResult | undefined): HTMLElement {
  const cell = el("span", "ff-time");
  if (!result) {
    cell.textContent = `${MODE_ICONS[mode]} …`;
  } else if ("error" in result) {
    cell.textContent = `${MODE_ICONS[mode]} –`;
    cell.title = `${MODE_NAMES[mode]}: ${result.error}`;
  } else {
    cell.textContent = `${MODE_ICONS[mode]} ${formatDuration(result.seconds)}`;
    cell.title = [MODE_NAMES[mode], result.summary].filter(Boolean).join(": ");
  }
  return cell;
}

function drawTravel(card: Card, times: TravelTimes | undefined, error?: string): void {
  const destinations = settings.destinations.filter(isRoutable);
  card.travel.replaceChildren();
  if (destinations.length === 0) {
    const button = el("button", "ff-link", "Legg til reisemål i innstillingene");
    button.type = "button";
    button.addEventListener("click", () => requestOpenOptions());
    card.travel.append(button);
    return;
  }
  for (const destination of destinations) {
    const row = el("div", "ff-row");
    row.append(el("span", "ff-label", destination.label || destination.address));
    const cells = el("span", "ff-times");
    for (const mode of destination.modes) {
      cells.append(travelCell(mode, error ? { error } : times?.[destination.id]?.[mode]));
    }
    row.append(cells);
    card.travel.append(row);
  }
}

async function renderTravel(card: Card): Promise<void> {
  const render = ++card.travelRender;
  drawTravel(card, undefined);
  if (!settings.destinations.some(isRoutable)) return;
  try {
    const times = await travelTimesFor(card.listing);
    if (render === card.travelRender) drawTravel(card, times);
  } catch (error) {
    if (render === card.travelRender) drawTravel(card, undefined, error instanceof Error ? error.message : String(error));
  }
}

function enhance(article: HTMLElement, data: Map<string, Listing>): void {
  const id = finnkode(article);
  if (!id) return;
  const listing = data.get(id) ?? listingFromCard(article, id);
  const panel = el("div", "ff-panel col-span-2");
  const card: Card = { listing, travel: el("div", "ff-travel"), cost: el("div", "ff-cost"), travelRender: 0 };
  panel.append(card.travel, card.cost);
  (article.querySelector("h2")?.parentElement ?? article).append(panel);
  cards.set(article, card);
  renderCost(card);
  void renderTravel(card);
}

async function scan(): Promise<void> {
  for (const article of cards.keys()) if (!article.isConnected) cards.delete(article);
  if (!location.pathname.endsWith("/search.html")) return;
  const articles = [...document.querySelectorAll<HTMLElement>("article.sf-search-ad")].filter(
    (article) => !enhancing.has(article) && !article.querySelector(".ff-panel"),
  );
  if (!articles.length) return;
  for (const article of articles) enhancing.add(article);
  const data = await currentListings();
  for (const article of articles) {
    enhancing.delete(article);
    enhance(article, data);
  }
}

let scheduled: number | undefined;
function scheduleScan(): void {
  clearTimeout(scheduled);
  scheduled = window.setTimeout(() => void scan(), 150);
}

async function main(): Promise<void> {
  settings = await loadSettings();
  onSettingsChanged((next, previous) => {
    settings = next;
    const travelChanged =
      JSON.stringify(next.destinations) !== JSON.stringify(previous.destinations) ||
      next.arriveBy !== previous.arriveBy;
    if (travelChanged) travelRequests.clear();
    for (const card of cards.values()) {
      renderCost(card);
      if (travelChanged) void renderTravel(card);
    }
  });
  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
  await scan();
}

void main();
