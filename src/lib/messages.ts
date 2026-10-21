import type { Coordinates, Place, TravelResult } from "./entur";
import type { Mode } from "./settings";

export type TravelTimes = Record<string, Partial<Record<Mode, TravelResult>>>;

export type Message =
  | { type: "travelTimes"; origin: Coordinates }
  | { type: "geocode"; text: string }
  | { type: "openOptions" };

export const requestTravelTimes = (origin: Coordinates): Promise<TravelTimes> =>
  browser.runtime.sendMessage({ type: "travelTimes", origin } satisfies Message);

export const requestGeocode = (text: string): Promise<Place[]> =>
  browser.runtime.sendMessage({ type: "geocode", text } satisfies Message);

export const requestOpenOptions = (): Promise<void> =>
  browser.runtime.sendMessage({ type: "openOptions" } satisfies Message);
