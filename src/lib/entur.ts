import type { Mode } from "./settings";

const JOURNEY_PLANNER = "https://api.entur.io/journey-planner/v3/graphql";
const GEOCODER = "https://api.entur.io/geocoder/v1/autocomplete";
const HEADERS = { "ET-Client-Name": "finnfinder-browserextension" };
const TRIPS_PER_REQUEST = 6;

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Place extends Coordinates {
  label: string;
}

export interface TravelQuery {
  key: string;
  to: Coordinates;
  mode: Mode;
}

export type TravelResult = { seconds: number; summary?: string } | { error: string };

interface Leg {
  mode: string;
  duration: number;
  line: { publicCode: string | null } | null;
}

interface Trip {
  tripPatterns: { duration: number; legs: Leg[] }[];
  routingErrors: { code: string; description: string }[];
}

const LEG_NAMES: Record<string, string> = {
  bus: "Buss",
  coach: "Buss",
  tram: "Trikk",
  metro: "T-bane",
  rail: "Tog",
  water: "Båt",
  air: "Fly",
};

export async function geocode(text: string, size = 5): Promise<Place[]> {
  const url = new URL(GEOCODER);
  url.search = new URLSearchParams({ text, size: String(size), lang: "no" }).toString();
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`Entur geocoder: ${response.status}`);
  const body: {
    features: { geometry: { coordinates: [number, number] }; properties: { label: string } }[];
  } = await response.json();
  return body.features.map((feature) => ({
    label: feature.properties.label,
    lon: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
  }));
}

export function nextWeekdayAt(time: string, now = new Date()): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

const place = ({ lat, lon }: Coordinates) => `{coordinates: {latitude: ${lat}, longitude: ${lon}}}`;

function tripField(alias: string, from: Coordinates, query: TravelQuery, arriveBy: Date): string {
  const selection = "{ tripPatterns { duration legs { mode duration line { publicCode } } } routingErrors { code description } }";
  const args =
    query.mode === "transit"
      ? `dateTime: ${JSON.stringify(arriveBy.toISOString())}, arriveBy: true, numTripPatterns: 3`
      : `modes: {directMode: ${query.mode}, transportModes: []}, numTripPatterns: 1`;
  return `${alias}: trip(from: ${place(from)}, to: ${place(query.to)}, ${args}) ${selection}`;
}

function summarize(legs: Leg[]): string {
  const rides = legs
    .filter((leg) => leg.mode !== "foot")
    .map((leg) => [LEG_NAMES[leg.mode] ?? leg.mode, leg.line?.publicCode].filter(Boolean).join(" "));
  const walkMinutes = Math.round(
    legs.filter((leg) => leg.mode === "foot").reduce((sum, leg) => sum + leg.duration, 0) / 60,
  );
  return [rides.join(" → "), walkMinutes > 0 ? `${walkMinutes} min gange` : ""].filter(Boolean).join(" · ");
}

function toResult(trip: Trip | null, mode: Mode): TravelResult {
  const best = trip?.tripPatterns.reduce<Trip["tripPatterns"][number] | undefined>(
    (min, pattern) => (!min || pattern.duration < min.duration ? pattern : min),
    undefined,
  );
  if (!best) {
    const error = trip?.routingErrors[0];
    return {
      error:
        error?.code === "noDirectModeConnection"
          ? "Fant ingen rute – velg gjerne en gateadresse som reisemål"
          : (error?.description ?? "Fant ingen rute"),
    };
  }
  if (mode === "transit") return { seconds: best.duration, summary: summarize(best.legs) };
  if (mode === "car") return { seconds: best.duration, summary: "Uten trafikk" };
  return { seconds: best.duration };
}

async function requestTrips(
  from: Coordinates,
  queries: TravelQuery[],
  arriveBy: Date,
): Promise<Record<string, TravelResult>> {
  const fields = queries.map((query, i) => tripField(`q${i}`, from, query, arriveBy));
  const response = await fetch(JOURNEY_PLANNER, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ query: `{ ${fields.join("\n")} }` }),
  });
  if (!response.ok) throw new Error(`Entur: ${response.status}`);
  const body: { data?: Record<string, Trip | null>; errors?: { message: string }[] } = await response.json();
  if (!body.data) throw new Error(body.errors?.[0]?.message ?? "Entur: tomt svar");
  return Object.fromEntries(queries.map((query, i) => [query.key, toResult(body.data![`q${i}`], query.mode)]));
}

export async function travelTimes(
  from: Coordinates,
  queries: TravelQuery[],
  arriveBy: Date,
): Promise<Record<string, TravelResult>> {
  const chunks: TravelQuery[][] = [];
  for (let i = 0; i < queries.length; i += TRIPS_PER_REQUEST) chunks.push(queries.slice(i, i + TRIPS_PER_REQUEST));
  const results = await Promise.all(chunks.map((chunk) => requestTrips(from, chunk, arriveBy)));
  return Object.assign({}, ...results);
}
