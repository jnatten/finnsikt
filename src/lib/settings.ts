export type Mode = "transit" | "car" | "foot" | "bicycle";

export const MODES: Mode[] = ["transit", "car", "foot", "bicycle"];

export const MODE_NAMES: Record<Mode, string> = { transit: "Kollektiv", car: "Bil", foot: "Gange", bicycle: "Sykkel" };

export interface Destination {
  id: string;
  label: string;
  address: string;
  lat?: number;
  lon?: number;
  modes: Mode[];
}

export const isRoutable = (destination: Destination): destination is Destination & { lat: number; lon: number } =>
  typeof destination.lat === "number" && typeof destination.lon === "number" && destination.modes.length > 0;

export interface LoanSettings {
  equity: number;
  interestPct: number;
  years: number;
  type: "annuity" | "serial";
  monthlyFee: number;
  includeDocumentFee: boolean;
  taxDeduction: boolean;
}

export interface Split {
  id: string;
  label: string;
  pct: number;
  maxMonthly?: number;
}

export const splitTotal = (splits: Split[]) => splits.reduce((sum, split) => sum + split.pct, 0);

export const splitsAddUp = (splits: Split[]) => splits.length > 0 && Math.abs(splitTotal(splits) - 100) < 0.01;

export interface Settings {
  destinations: Destination[];
  arriveBy: string;
  loan: LoanSettings;
  splits: Split[];
  nearMaxPct: number;
}

export const DEFAULT_SETTINGS: Settings = {
  destinations: [],
  arriveBy: "08:30",
  loan: {
    equity: 500_000,
    interestPct: 5,
    years: 30,
    type: "annuity",
    monthlyFee: 50,
    includeDocumentFee: true,
    taxDeduction: false,
  },
  splits: [],
  nearMaxPct: 90,
};

const KEY = "settings";

type StoredSettings = Partial<Settings> & { splitPct?: number };

const legacySplits = (splitPct: number | undefined): Split[] =>
  splitPct !== undefined && splitPct < 100
    ? [
        { id: "legacy-1", label: "", pct: splitPct },
        { id: "legacy-2", label: "", pct: 100 - splitPct },
      ]
    : [];

export function withDefaults(stored: StoredSettings | undefined): Settings {
  const { splitPct, ...rest } = stored ?? {};
  const defaults = structuredClone(DEFAULT_SETTINGS);
  return {
    ...defaults,
    splits: legacySplits(splitPct),
    ...rest,
    loan: { ...defaults.loan, ...rest.loan },
  };
}

export async function loadSettings(): Promise<Settings> {
  return withDefaults((await browser.storage.sync.get(KEY))[KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set({ [KEY]: settings });
}

export function onSettingsChanged(callback: (settings: Settings, previous: Settings) => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[KEY]) return;
    callback(withDefaults(changes[KEY].newValue), withDefaults(changes[KEY].oldValue));
  });
}
