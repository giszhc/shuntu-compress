#!/usr/bin/env node
// Reproducible patch for an electron-builder / @electron/get incompatibility.
//
// Symptom: `pnpm dist:mac:universal` (or any multi-arch build that triggers a secondary-arch
// Electron binary download) fails with:
//   TypeError: Cannot read properties of undefined (reading 'ReadWrite')
//   at resolveCacheMode (app-builder-lib/out/util/electronGet.js)
//
// Root cause: electron-builder 26.x's electronGet.js reads `get_1.ElectronDownloadCacheMode`,
// but the @electron/get copy it resolves to (3.0.0, nested under app-builder-lib) does NOT export
// that symbol. The top-level @electron/get (5.x, pulled in by `electron`) renamed the enum, so
// neither copy exposes `ElectronDownloadCacheMode` under that name.
//
// Fix: inject a local `CacheMode` fallback (ReadWrite=0, ReadOnly=1, WriteOnly=2, Bypass=3) and
// route all usages through it. This is version-agnostic and idempotent.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, "../node_modules/app-builder-lib/out/util/electronGet.js");

if (!existsSync(target)) {
  console.log("[patch] app-builder-lib not installed yet; skipping ElectronDownloadCacheMode patch.");
  process.exit(0);
}

let src = readFileSync(target, "utf8");

if (src.includes("const CacheMode = (get_1 && get_1.ElectronDownloadCacheMode)")) {
  console.log("[patch] ElectronDownloadCacheMode patch already applied; skipping.");
  process.exit(0);
}

if (!src.includes("get_1.ElectronDownloadCacheMode")) {
  console.log("[patch] no ElectronDownloadCacheMode usage found; nothing to patch.");
  process.exit(0);
}

const anchor = 'const cacheState_1 = require("./cacheState");';
if (!src.includes(anchor)) {
  console.error("[patch] injection anchor not found; aborting to avoid corrupting the file.");
  process.exit(1);
}

const injected =
  anchor +
  "\n" +
  "// `ElectronDownloadCacheMode` is only exported by some @electron/get versions. Provide literal\n" +
  "// fallback values (ReadWrite=0, ReadOnly=1, WriteOnly=2, Bypass=3) so universal/multi-arch\n" +
  "// downloads don't crash when the resolved @electron/get copy omits the export.\n" +
  "const CacheMode = (get_1 && get_1.ElectronDownloadCacheMode) || { ReadWrite: 0, ReadOnly: 1, WriteOnly: 2, Bypass: 3 };";

src = src.replace(anchor, injected);
src = src.split("get_1.ElectronDownloadCacheMode").join("CacheMode");

writeFileSync(target, src, "utf8");
console.log("[patch] Applied ElectronDownloadCacheMode fallback patch to app-builder-lib.");
