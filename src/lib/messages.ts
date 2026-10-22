import type { Coordinates, Place, TravelResult } from "./entur";
import type { Mode, Vertical } from "./settings";

export type TravelTimes = Record<string, Partial<Record<Mode, TravelResult>>>;

export type Message =
  | { type: "travelTimes"; coordinates: Coordinates; vertical: Vertical }
  | { type: "geocode"; text: string }
  | { type: "openOptions" };

export const requestTravelTimes = (coordinates: Coordinates, vertical: Vertical): Promise<TravelTimes> =>
  browser.runtime.sendMessage({ type: "travelTimes", coordinates, vertical } satisfies Message);

export const requestGeocode = (text: string): Promise<Place[]> =>
  browser.runtime.sendMessage({ type: "geocode", text } satisfies Message);

export const requestOpenOptions = (): Promise<void> =>
  browser.runtime.sendMessage({ type: "openOptions" } satisfies Message);
