/**
 * Paketleme kontrolü — "Cannot find module" hatalarını build öncesi yakalar.
 *
 * package.json > build.files listesi node_modules'ü kapatıp gerekli paketleri
 * tek tek ekliyor. script/build.ts ise bağımlılıkların bir kısmını esbuild ile
 * bundle'a gömüyor, kalanını "external" bırakıyor. External kalan bir paket
 * files listesine yazılmazsa exe derlenir ama çalışma anında patlar.
 *
 * Bu betik tahmin yürütmez: derlenmiş dist/index.cjs dosyasındaki gerçek
 * require() çağrılarını okur ve her birinin files listesinde karşılığı
 * olduğunu doğrular.
 *
 * Kullanım:  npm run build  (önce)
 *            npx tsx script/check-bundle-deps.ts
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { isBuiltin } from "node:module";

const require = createRequire(import.meta.url);
const BUILT = "dist/index.cjs";

if (!fs.existsSync(BUILT)) {
  console.error(`${BUILT} yok — önce "npm run build" çalıştırın.`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const src = fs.readFileSync(BUILT, "utf8");

/** Derlenmiş sunucunun node_modules'ten yüklediği paketler. */
const externals = new Set<string>();
for (const m of src.matchAll(/require\(\s*["']([^"'.][^"']*)["']\s*\)/g)) {
  const spec = m[1];
  if (isBuiltin(spec)) continue;
  const parts = spec.split("/");
  externals.add(spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
}

/** Bir paketin tüm geçişli bağımlılıkları — onlar da kopyalanmalı. */
function collect(name: string, seen: Set<string>): void {
  if (seen.has(name)) return;
  let p: string;
  try {
    p = require.resolve(`${name}/package.json`, { paths: [process.cwd()] });
  } catch {
    return; // Kurulu değil (opsiyonel / platforma özel) — atla.
  }
  seen.add(name);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const d of Object.keys(j.dependencies ?? {})) collect(d, seen);
}

const needed = new Set<string>();
for (const e of externals) collect(e, needed);

// files listesindeki "node_modules/X/**/*" desenlerinden paket adlarını çıkar.
const included = new Set<string>();
for (const f of (pkg.build?.files ?? []) as string[]) {
  if (f.startsWith("!")) continue;
  const m = f.match(/^node_modules\/((?:@[^/]+\/)?[^/*]+)/);
  if (m) included.add(m[1]);
}

/** "node_modules/@scope/**" tüm scope'u kapsar. */
function isIncluded(name: string): boolean {
  if (included.has(name)) return true;
  return name.startsWith("@") && included.has(name.split("/")[0]);
}

const missing = [...needed].filter((n) => !isIncluded(n)).sort();

console.log(
  `Sunucunun harici bagimliliklari: ${[...externals].sort().join(", ")}`,
);
console.log(`Gecisli toplam: ${needed.size} paket`);

if (missing.length === 0) {
  console.log("\nTamam — hepsi package.json > build.files listesinde.");
  process.exit(0);
}

console.error(`\nEKSIK ${missing.length} paket — exe "Cannot find module" verir:\n`);
for (const m of missing) console.error(`      "node_modules/${m}/**/*",`);
console.error("\nBu satirlari package.json > build.files icine ekleyin.");
process.exit(1);
