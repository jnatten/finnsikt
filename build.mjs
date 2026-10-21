import * as esbuild from "esbuild";
import { cpSync, watch } from "node:fs";
import { spawn } from "node:child_process";

const args = new Set(process.argv.slice(2));
const firefox = process.env.FIREFOX_BIN ?? "/Applications/Zen.app/Contents/MacOS/zen";
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

if (args.has("--watch")) {
  await ctx.watch();
  watch("static", { recursive: true }, copyStatic);
  if (args.has("--run")) {
    spawn(
      "web-ext",
      ["run", "--source-dir", "dist", `--firefox=${firefox}`, `--start-url=${startUrl}`],
      { stdio: "inherit", shell: true },
    );
  }
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
