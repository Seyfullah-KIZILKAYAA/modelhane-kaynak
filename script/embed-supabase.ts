/**
 * Bu makinedeki mevcut Supabase bağlantı bilgilerini
 * server/embedded-config.ts içine gömer.
 *
 * Anahtar config.json'da makineye bağlı bir anahtarla şifreli tutulduğu için
 * bu betik yalnızca bilgilerin girili olduğu makinede çalışır.
 *
 * Kullanım:  npx tsx script/embed-supabase.ts
 *
 * Anahtar değiştiğinde (Supabase panelinden reset) tekrar çalıştırıp yeni
 * sürüm yayınlayın.
 */
import fs from "node:fs";
import { getConfig } from "../server/config";

const c = getConfig();

if (!c.supabase.url || !c.supabase.key) {
  console.error(
    "Bu makinede Supabase bilgileri yok. Önce ayarlar ekranından girin.",
  );
  process.exit(1);
}

const p = "server/embedded-config.ts";
const before = fs.readFileSync(p, "utf8");

const after = before.replace(
  /(EMBEDDED_SUPABASE: EmbeddedSupabase = \{)[\s\S]*?(\n\};)/,
  (_m, open: string, close: string) =>
    open +
    "\n  url: " +
    JSON.stringify(c.supabase.url) +
    "," +
    "\n  key: " +
    JSON.stringify(c.supabase.key) +
    "," +
    close,
);

if (after === before) {
  console.error("EMBEDDED_SUPABASE bloğu bulunamadı — dosya değişmiş olabilir.");
  process.exit(1);
}

fs.writeFileSync(p, after, "utf8");
console.log(`Gömüldü: ${c.supabase.url} (anahtar ${c.supabase.key.length} karakter)`);
