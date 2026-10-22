import type { Coordinates } from "./entur";
import { decodeTurboStream } from "./turbo-stream";

export interface Listing {
  id: string;
  location?: string;
  coordinates?: Coordinates;
  price?: number;
  priceIsFrom?: boolean;
  totalPrice?: number;
  sharedCost?: number;
  ownerType?: string;
}

type Doc = Record<string, unknown>;

const amount = (value: unknown): number | undefined => {
  const n = (value as { amount?: unknown } | undefined)?.amount;
  return typeof n === "number" ? n : undefined;
};

function toListing(doc: Doc): Listing {
  const coordinates = doc.coordinates as { lat?: unknown; lon?: unknown } | undefined;
  const price = amount(doc.price_suggestion);
  const fromPrice = (doc.price_range_suggestion as { amount_from?: unknown } | undefined)?.amount_from;
  return {
    id: String(doc.ad_id),
    location: typeof doc.location === "string" ? doc.location : undefined,
    coordinates:
      typeof coordinates?.lat === "number" && typeof coordinates?.lon === "number"
        ? { lat: coordinates.lat, lon: coordinates.lon }
        : undefined,
    price: price ?? (typeof fromPrice === "number" ? fromPrice : undefined),
    priceIsFrom: price === undefined && typeof fromPrice === "number",
    totalPrice: amount(doc.price_total),
    sharedCost: amount(doc.price_shared_cost),
    ownerType: typeof doc.owner_type_description === "string" ? doc.owner_type_description.trim() : undefined,
  };
}

export function collectListings(root: unknown): Map<string, Listing> {
  const listings = new Map<string, Listing>();
  const seen = new Set<unknown>();
  const visit = (value: unknown) => {
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const doc = value as Doc;
    const isListing =
      (typeof doc.ad_id === "number" || typeof doc.ad_id === "string") &&
      ("coordinates" in doc || "price_suggestion" in doc || "price_range_suggestion" in doc);
    if (isListing && !listings.has(String(doc.ad_id))) listings.set(String(doc.ad_id), toListing(doc));
    Object.values(doc).forEach(visit);
  };
  visit(root);
  return listings;
}

interface AdData {
  price?: { suggestion?: number; total?: number };
  sharedCost?: { amount?: number };
  ownershipType?: string;
  location?: { streetAddress?: string; postalName?: string; position?: { lat?: number; lng?: number } };
}

export function listingFromAd(root: unknown, id: string): Listing | undefined {
  const routes = Object.values((root ?? {}) as Record<string, { data?: { objectData?: { ad?: AdData } } }>);
  const ad = routes.map((route) => route?.data?.objectData?.ad).find(Boolean);
  if (!ad) return undefined;
  const { lat, lng } = ad.location?.position ?? {};
  return {
    id,
    location: [ad.location?.streetAddress, ad.location?.postalName].filter(Boolean).join(", ") || undefined,
    coordinates: typeof lat === "number" && typeof lng === "number" ? { lat, lon: lng } : undefined,
    price: ad.price?.suggestion,
    totalPrice: ad.price?.total,
    sharedCost: ad.sharedCost?.amount,
    ownerType: ad.ownershipType?.trim(),
  };
}

export async function fetchPageData(pageUrl: URL): Promise<unknown> {
  const response = await fetch(`${pageUrl.origin}${pageUrl.pathname}.data${pageUrl.search}`);
  if (!response.ok) throw new Error(`finn.no: ${response.status}`);
  return decodeTurboStream(await response.text());
}

export async function fetchJobSearchData(pageUrl: URL): Promise<unknown> {
  const response = await fetch(
    `${pageUrl.origin}/job/job-search-page/api/unified-search/SEARCH_ID_JOB_FULLTIME${pageUrl.search}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`finn.no: ${response.status}`);
  return response.json();
}

const parseKr = (text: string | undefined): number | undefined => {
  const digits = text?.replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
};

export function finnkode(card: Element): string | undefined {
  const link = card.querySelector<HTMLAnchorElement>("a.sf-search-ad-link, a.job-card-link, a[href*='finnkode=']");
  if (!link) return undefined;
  const url = new URL(link.href, location.href);
  return url.searchParams.get("finnkode") ?? url.pathname.match(/\/(\d+)$/)?.[1] ?? (link.id || undefined);
}

export function listingFromCard(card: Element, id: string): Listing {
  const text = card.textContent ?? "";
  const priceSpan = [...card.querySelectorAll("span")].find((span) =>
    /^[\d\s  ]+kr$/.test(span.textContent?.trim() ?? ""),
  );
  return {
    id,
    location: card.querySelector(".sf-realestate-location")?.textContent?.trim() || undefined,
    price: parseKr(priceSpan?.textContent ?? undefined),
    totalPrice: parseKr(text.match(/Totalpris:\s*([\d\s  ]+)kr/)?.[1]),
    sharedCost: parseKr(text.match(/Fellesutg\.:\s*([\d\s  ]+)kr/)?.[1]),
    ownerType: text.match(/\b(Selveier|Andel|Aksje|Obligasjon)\b/)?.[1],
  };
}

export function listingFromAdPage(page: ParentNode, id: string): Listing {
  const text = (selector: string) => page.querySelector(selector)?.textContent?.trim() || undefined;
  return {
    id,
    location: text('[data-testid="object-address"]'),
    price: parseKr(text('[data-testid="pricing-incicative-price"] span:last-child')),
    totalPrice: parseKr(text('[data-testid="pricing-total-price"] dd')),
    sharedCost: parseKr(text('[data-testid="pricing-common-monthly-cost"] dd')),
    ownerType: text('[data-testid="info-ownership-type"] dd'),
  };
}

export function listingFromJobCard(card: Element, id: string): Listing {
  return { id, location: card.querySelector(".job-card__pills li span")?.textContent?.trim() || undefined };
}

export function listingFromJobAdPage(page: ParentNode, id: string): Listing {
  const map = page.querySelector<HTMLAnchorElement>(`a[href*="/map?adId=${id}"]`);
  const params = map ? new URL(map.href).searchParams : undefined;
  const lat = Number(params?.get("lat") ?? NaN);
  const lon = Number(params?.get("lon") ?? NaN);
  const place = [...page.querySelectorAll("li")].find((item) => item.firstElementChild?.textContent?.trim() === "Sted:");
  return {
    id,
    location: map?.textContent?.trim() || place?.textContent?.replace(/^\s*Sted:/, "").trim() || undefined,
    coordinates: Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined,
  };
}
