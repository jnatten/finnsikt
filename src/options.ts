import { geocode } from "./lib/entur";
import { formatPct } from "./lib/format";
import {
  isRoutable,
  loadSettings,
  MODE_NAMES,
  MODES,
  saveSettings,
  splitsAddUp,
  splitTotal,
  type Destination,
  type LoanSettings,
  type Settings,
  type Split,
} from "./lib/settings";

const HOST_PERMISSIONS = { origins: ["https://www.finn.no/*", "https://api.entur.io/*"] };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings;
let saveTimer: number | undefined;

function save(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    await saveSettings(settings);
    const status = $("status");
    status.textContent = "Lagret";
    window.setTimeout(() => (status.textContent = ""), 1500);
  }, 300);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element, props);
  return element;
}

function destinationEditor(destination: Destination): HTMLElement {
  const fieldset = el("fieldset");

  const label = el("input", { type: "text", value: destination.label, placeholder: "F.eks. Jobb" });
  label.addEventListener("input", () => {
    destination.label = label.value;
    save();
  });

  const search = el("input", { type: "text", value: destination.address, placeholder: "Adresse eller sted" });
  const searchButton = el("button", { type: "button", textContent: "Søk" });
  const remove = el("button", { type: "button", textContent: "Fjern" });
  const place = el("div", {
    className: "place",
    textContent: isRoutable({ ...destination, modes: MODES })
      ? `📍 ${destination.address}`
      : "Ingen adresse valgt – søk og velg et treff.",
  });
  const results = el("div", { className: "results" });

  const runSearch = async () => {
    results.replaceChildren(el("span", { className: "place", textContent: "Søker…" }));
    try {
      const places = await geocode(search.value);
      results.replaceChildren(
        ...places.map((p) => {
          const option = el("button", { type: "button", textContent: p.label });
          option.addEventListener("click", () => {
            Object.assign(destination, { address: p.label, lat: p.lat, lon: p.lon });
            if (!destination.label) destination.label = p.label.split(",")[0];
            save();
            renderDestinations();
          });
          return option;
        }),
      );
      if (!places.length) results.replaceChildren(el("span", { className: "place", textContent: "Ingen treff." }));
    } catch (error) {
      results.replaceChildren(el("span", { className: "place", textContent: `Feil: ${error}` }));
    }
  };
  searchButton.addEventListener("click", runSearch);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void runSearch();
  });

  remove.addEventListener("click", () => {
    settings.destinations = settings.destinations.filter((d) => d !== destination);
    save();
    renderDestinations();
  });

  const nameLabel = el("label", { textContent: "Navn" });
  nameLabel.append(label);
  const addressLabel = el("label", { textContent: "Adresse" });
  addressLabel.append(search);
  const row = el("div", { className: "row" });
  row.append(nameLabel, addressLabel, searchButton, remove);

  const modes = el("div", { className: "modes" });
  for (const mode of MODES) {
    const checkbox = el("input", { type: "checkbox", checked: destination.modes.includes(mode) });
    checkbox.addEventListener("change", () => {
      destination.modes = MODES.filter((m) => (m === mode ? checkbox.checked : destination.modes.includes(m)));
      save();
    });
    const modeLabel = el("label", { className: "inline" });
    modeLabel.append(checkbox, MODE_NAMES[mode]);
    modes.append(modeLabel);
  }

  fieldset.append(row, place, results, modes);
  return fieldset;
}

function renderDestinations(): void {
  $("destinations").replaceChildren(...settings.destinations.map(destinationEditor));
}

function labelled(text: string, input: HTMLElement): HTMLLabelElement {
  const label = el("label", { textContent: text });
  label.append(input);
  return label;
}

function splitEditor(split: Split): HTMLElement {
  const name = el("input", { type: "text", value: split.label, placeholder: "F.eks. Kari" });
  name.addEventListener("input", () => {
    split.label = name.value;
    save();
  });

  const pct = el("input", { type: "number", min: "0", max: "100", step: "any", value: String(split.pct) });
  pct.addEventListener("input", () => {
    if (pct.value === "" || !pct.checkValidity()) return;
    split.pct = pct.valueAsNumber;
    renderSplitSum();
    save();
  });

  const max = el("input", { type: "number", min: "0", step: "100", placeholder: "Ingen", value: String(split.maxMonthly ?? "") });
  max.addEventListener("input", () => {
    if (!max.checkValidity()) return;
    split.maxMonthly = max.value === "" ? undefined : max.valueAsNumber;
    save();
  });

  const remove = el("button", { type: "button", textContent: "Fjern" });
  remove.addEventListener("click", () => {
    settings.splits = settings.splits.filter((s) => s !== split);
    save();
    renderSplits();
  });

  const fieldset = el("fieldset");
  const row = el("div", { className: "row" });
  row.append(labelled("Navn", name), labelled("Andel (%)", pct), labelled("Maks (kr/mnd)", max), remove);
  fieldset.append(row);
  return fieldset;
}

function renderSplitSum(): void {
  const sum = $("split-sum");
  const total = splitTotal(settings.splits);
  const valid = settings.splits.length === 0 || splitsAddUp(settings.splits);
  sum.className = valid ? "place" : "place error";
  sum.textContent =
    settings.splits.length === 0
      ? "Ingen fordeling – bare totalen vises."
      : valid
        ? `Sum: ${formatPct(total)}`
        : `Sum: ${formatPct(total)} – må bli 100 % før fordelingen vises`;
}

function renderSplits(): void {
  $("splits").replaceChildren(...settings.splits.map(splitEditor));
  renderSplitSum();
}

function bindNumber(id: string, get: () => number, set: (value: number) => void): void {
  const input = $<HTMLInputElement>(id);
  input.value = String(get());
  input.addEventListener("input", () => {
    if (input.value === "" || !input.checkValidity()) return;
    set(input.valueAsNumber);
    save();
  });
}

function bindCheckbox(id: "includeDocumentFee" | "taxDeduction"): void {
  const input = $<HTMLInputElement>(id);
  input.checked = settings.loan[id];
  input.addEventListener("change", () => {
    settings.loan[id] = input.checked;
    save();
  });
}

async function checkPermissions(): Promise<void> {
  const granted = await browser.permissions.contains(HOST_PERMISSIONS);
  $("permissions").hidden = granted;
}

async function main(): Promise<void> {
  settings = await loadSettings();

  renderDestinations();
  $("add-destination").addEventListener("click", () => {
    settings.destinations.push({
      id: crypto.randomUUID(),
      label: "",
      address: "",
      modes: ["transit", "car", "foot"],
    });
    save();
    renderDestinations();
  });

  const arriveBy = $<HTMLInputElement>("arriveBy");
  arriveBy.value = settings.arriveBy;
  arriveBy.addEventListener("change", () => {
    if (!arriveBy.value) return;
    settings.arriveBy = arriveBy.value;
    save();
  });

  for (const key of ["equity", "interestPct", "years", "monthlyFee"] as const) {
    bindNumber(key, () => settings.loan[key], (value) => (settings.loan[key] = value));
  }
  bindNumber("nearMaxPct", () => settings.nearMaxPct, (value) => (settings.nearMaxPct = value));

  renderSplits();
  $("add-split").addEventListener("click", () => {
    settings.splits.push({ id: crypto.randomUUID(), label: "", pct: Math.max(0, 100 - splitTotal(settings.splits)) });
    save();
    renderSplits();
  });
  (["includeDocumentFee", "taxDeduction"] as const).forEach(bindCheckbox);

  const type = $<HTMLSelectElement>("type");
  type.value = settings.loan.type;
  type.addEventListener("change", () => {
    settings.loan.type = type.value as LoanSettings["type"];
    save();
  });

  $("grant").addEventListener("click", async () => {
    await browser.permissions.request(HOST_PERMISSIONS);
    await checkPermissions();
  });
  await checkPermissions();
}

void main();
