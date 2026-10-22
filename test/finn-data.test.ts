import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectListings, listingFromAd } from "../src/lib/finn-data";
import { decodeTurboStream } from "../src/lib/turbo-stream";

const fixture = readFileSync(new URL("./fixtures/search.data.txt", import.meta.url), "utf8");
const adFixture = readFileSync(new URL("./fixtures/ad.data.txt", import.meta.url), "utf8");
const jobSearchFixture = JSON.parse(readFileSync(new URL("./fixtures/job-search.json", import.meta.url), "utf8"));

describe("decodeTurboStream", () => {
  it("rebuilds objects, arrays and sentinels", () => {
    const decoded = decodeTurboStream('[{"_1":2,"_3":4,"_5":-5},"name","Oslo","list",[2,6],"missing",42]');
    expect(decoded).toEqual({ name: "Oslo", list: ["Oslo", 42], missing: undefined });
  });

  it("keeps shared references", () => {
    const decoded = decodeTurboStream('[{"_1":2,"_3":2},"a",{"_4":5},"b","x",1]') as Record<string, unknown>;
    expect(decoded.a).toBe(decoded.b);
  });
});

describe("collectListings", () => {
  it("finds every listing in a finn.no search response", () => {
    const listings = collectListings(decodeTurboStream(fixture));
    expect(listings.size).toBe(5);
    expect(listings.get("478641147")).toEqual({
      id: "478641147",
      location: "Larviksgata 2, Oslo",
      coordinates: { lat: 59.94062, lon: 10.75832 },
      price: 7_350_000,
      totalPrice: 7_666_719,
      sharedCost: 5_557,
      ownerType: "Andel",
      priceIsFrom: false,
    });
  });

  it("uses the lowest price for project listings with a price range", () => {
    const listings = collectListings({
      docs: [{ ad_id: 1, coordinates: { lat: 59.9, lon: 10.8 }, price_range_suggestion: { amount_from: 3_650_000 } }],
    });
    expect(listings.get("1")).toMatchObject({ price: 3_650_000, priceIsFrom: true, sharedCost: undefined });
  });

  it("finds every job in a finn.no job search response", () => {
    const listings = collectListings(jobSearchFixture);
    expect(listings.size).toBe(50);
    expect(listings.get("478693710")).toMatchObject({
      id: "478693710",
      location: "Oslo - Grünerløkka - Sofienberg",
      coordinates: { lat: 59.92005, lon: 10.75139 },
      price: undefined,
    });
  });
});

describe("listingFromAd", () => {
  it("reads price, shared cost and coordinates from a finn.no ad response", () => {
    expect(listingFromAd(decodeTurboStream(adFixture), "454965049")).toEqual({
      id: "454965049",
      location: "Johannes Bruns gate 14B, Oslo",
      coordinates: { lat: 59.9289, lon: 10.7335 },
      price: 7_250_000,
      totalPrice: 7_251_390,
      sharedCost: 5_438,
      ownerType: "Andel",
    });
  });

  it("returns undefined for responses without an ad", () => {
    expect(listingFromAd(decodeTurboStream(fixture), "1")).toBeUndefined();
  });
});
