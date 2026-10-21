import { cacheGetMany, cachePrune, cacheSetMany } from "./lib/cache";
import { geocode, nextWeekdayAt, travelTimes, type Coordinates, type TravelQuery, type TravelResult } from "./lib/entur";
import type { Message, TravelTimes } from "./lib/messages";
import { isRoutable, loadSettings } from "./lib/settings";

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_REQUESTS = 3;

let active = 0;
const waiting: (() => void)[] = [];

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_REQUESTS) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

const point = ({ lat, lon }: Coordinates) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

async function getTravelTimes(origin: Coordinates): Promise<TravelTimes> {
  const settings = await loadSettings();
  const queries = settings.destinations.filter(isRoutable).flatMap((destination) =>
    destination.modes.map((mode) => ({
      destination,
      query: {
        key: `${mode}|${point(origin)}|${point(destination)}|${settings.arriveBy}`,
        to: destination,
        mode,
      } satisfies TravelQuery,
    })),
  );

  const results: Record<string, TravelResult> = Object.fromEntries(
    await cacheGetMany<TravelResult>(queries.map(({ query }) => query.key)),
  );
  const missing = queries.map(({ query }) => query).filter((query) => !results[query.key]);
  if (missing.length) {
    const fresh = await limited(() => travelTimes(origin, missing, nextWeekdayAt(settings.arriveBy)));
    await cacheSetMany(
      Object.fromEntries(Object.entries(fresh).filter(([, result]) => "seconds" in result)),
      CACHE_TTL_MS,
    );
    Object.assign(results, fresh);
  }

  const times: TravelTimes = {};
  for (const { destination, query } of queries) {
    times[destination.id] ??= {};
    times[destination.id][query.mode] = results[query.key];
  }
  return times;
}

browser.runtime.onMessage.addListener((message: Message) => {
  switch (message.type) {
    case "travelTimes":
      return getTravelTimes(message.origin);
    case "geocode":
      return limited(() => geocode(message.text));
    case "openOptions":
      return browser.runtime.openOptionsPage();
  }
});

browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install" && !(await loadSettings()).destinations.length) await browser.runtime.openOptionsPage();
});

browser.runtime.onStartup.addListener(() => cachePrune());
