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

export interface Settings {
  destinations: Destination[];
  arriveBy: string;
  loan: LoanSettings;
  splitPct: number;
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
  splitPct: 100,
};

const KEY = "settings";

function withDefaults(stored: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    loan: { ...DEFAULT_SETTINGS.loan, ...stored?.loan },
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
