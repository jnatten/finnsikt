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

export async function fetchListings(pageUrl: URL): Promise<Map<string, Listing>> {
  const response = await fetch(`${pageUrl.origin}${pageUrl.pathname}.data${pageUrl.search}`);
  if (!response.ok) throw new Error(`finn.no: ${response.status}`);
  return collectListings(decodeTurboStream(await response.text()));
}

const parseKr = (text: string | undefined): number | undefined => {
  const digits = text?.replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
};

export function finnkode(card: Element): string | undefined {
  const link = card.querySelector<HTMLAnchorElement>("a.sf-search-ad-link, a[href*='finnkode=']");
  if (!link) return undefined;
  return new URL(link.href, location.href).searchParams.get("finnkode") ?? (link.id || undefined);
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
