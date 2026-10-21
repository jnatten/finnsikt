import * as esbuild from "esbuild";
import { cpSync, mkdirSync, watch } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const BROWSERS = {
  zen: "/Applications/Zen.app/Contents/MacOS/zen",
  twilight: "/Applications/Twilight.app/Contents/MacOS/zen",
  firefox: "/Applications/Firefox.app/Contents/MacOS/firefox",
};

const { values: args } = parseArgs({
  options: {
    watch: { type: "boolean", default: false },
    run: { type: "boolean", default: false },
    persist: { type: "boolean", default: false },
    browser: { type: "string", default: "zen" },
  },
});
if (!(args.browser in BROWSERS)) throw new Error(`Unknown --browser ${args.browser}, use ${Object.keys(BROWSERS).join("/")}`);

const startUrl =
  "https://www.finn.no/realestate/homes/search.html?location=1.20061.20513&location=1.20061.20509&location=1.20061.20510&min_bedrooms=2&facilities=23&price_collective_to=8000000&sort=PRICE_ASC&area_from=70";

const copyStatic = () => cpSync("static", "dist", { recursive: true });

const ctx = await esbuild.context({
  entryPoints: ["src/content.ts", "src/background.ts", "src/options.ts"],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "firefox142",
  logLevel: "info",
});

copyStatic();

if (args.watch) {
  await ctx.watch();
  watch("static", { recursive: true }, copyStatic);
  if (args.run) {
    const runArgs = ["run", "--source-dir", "dist", `--firefox=${BROWSERS[args.browser]}`, `--start-url=${startUrl}`];
    if (args.persist) {
      const profile = resolve(".web-ext-profile", args.browser);
      mkdirSync(profile, { recursive: true });
      runArgs.push(`--firefox-profile=${profile}`, "--keep-profile-changes");
    }
    spawn("web-ext", runArgs, { stdio: "inherit" });
  }
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
