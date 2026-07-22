import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { EMBEDDED_SUPABASE, hasEmbeddedSupabase } from "./embedded-config";

/**
 * Uygulama ayarlarının kalıcı deposu.
 *
 * Bağlantı bilgileri .env yerine burada tutulur; böylece uygulama başka bir
 * bilgisayara kurulduğunda kullanıcı hiç kod/dosya görmeden ayarlar ekranından
 * veritabanı bağlantısını yapabilir.
 *
 * Dosya konumu: %APPDATA%\ModelhanePlanlama\config.json (Windows)
 *               ~/.config/modelhane-planlama/config.json (diğer)
 * Kurulum klasörüne değil kullanıcı profiline yazılır — Program Files altında
 * yazma izni olmayabilir.
 *
 * Şifreler düz metin saklanmaz; makineye bağlı bir anahtarla AES-256-GCM ile
 * şifrelenir. Bu, dosyayı ele geçiren birinin şifreyi doğrudan okumasını
 * engeller. (Aynı makinede çalışan kod çözebilir — tam koruma değil, makul
 * bir koruma katmanıdır.)
 */

export interface MssqlConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  instanceName: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

export interface SupabaseConfig {
  url: string;
  /** service_role anahtarı — sunucu tarafında kalır, tarayıcıya asla gönderilmez. */
  key: string;
}

/** Aktif veri kaynağı. */
export type DbProvider = "mssql" | "supabase";

import { UserPermissions, DEFAULT_PERMISSIONS } from "@shared/schema";

export interface AppConfig {
  /** Uygulamanın hangi veritabanını kullanacağı. */
  dbProvider: DbProvider;
  mssql: MssqlConfig;
  supabase: SupabaseConfig;
  /** Yönetici şifresi unutulursa kullanılan kurtarma PIN'i (hash'li). */
  recoveryPinHash: string | null;
  /** Oturum çerezlerini imzalamak için üretilen gizli anahtar. */
  sessionSecret: string;
  /** Kullanıcı yetkileri (grup kullanıcıları için). */
  userPermissions?: UserPermissions;
}

const DEFAULTS: AppConfig = {
  // Yeni kurulumlar Supabase ile başlar; kurulum ekranında doğrudan görünür.
  // MSSQL'e geçmek isteyen ayarlar ekranından seçebilir.
  dbProvider: "supabase",
  supabase: {
    url: "",
    key: "",
  },
  mssql: {
    server: "",
    port: 1433,
    database: "modelhane",
    user: "",
    password: "",
    instanceName: "",
    encrypt: false,
    trustServerCertificate: true,
  },
  recoveryPinHash: null,
  sessionSecret: "",
  userPermissions: DEFAULT_PERMISSIONS,
};

function configDir(): string {
  if (process.platform === "win32") {
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, "ModelhanePlanlama");
  }
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "modelhane-planlama");
}

export function configPath(): string {
  return path.join(configDir(), "config.json");
}

// --- Şifreleme ---------------------------------------------------------

/**
 * Makineye bağlı şifreleme anahtarı.
 * Makine adı + kullanıcı adı + sabit tuzdan türetilir, böylece config.json
 * başka bir makineye kopyalansa bile şifre çözülemez.
 */
function machineKey(): Buffer {
  const material = `${os.hostname()}|${os.userInfo().username}|modelhane-planlama-v1`;
  return crypto.createHash("sha256").update(material).digest();
}

const ENC_PREFIX = "enc:v1:";

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", machineKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(stored: string): string {
  if (!stored) return "";
  // Eski/elle girilmiş düz metin değerler de kabul edilsin.
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  try {
    const raw = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", machineKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    // Anahtar değiştiyse (başka makine) çözülemez — boş dön, kullanıcı yeniden girsin.
    return "";
  }
}

// --- Okuma / yazma -----------------------------------------------------

let _cache: AppConfig | null = null;

function readFile(): AppConfig {
  const p = configPath();
  if (!fs.existsSync(p)) return structuredClone(DEFAULTS);
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return {
      ...DEFAULTS,
      ...raw,
      // Eski config.json'larda bu alanlar yok; varsayılana düşülmeli.
      // (...raw yayılımı eksik/null değerlerle DEFAULTS'u ezebiliyor.)
      //
      // Daha önce açıkça bir seçim yapılmışsa ona saygı gösterilir; alan hiç
      // yoksa (eski kurulum) DEFAULTS devreye girer. Bilinmeyen bir değer
      // gelirse de varsayılana düşülür.
      dbProvider:
        raw.dbProvider === "supabase" || raw.dbProvider === "mssql"
          ? raw.dbProvider
          : DEFAULTS.dbProvider,
      mssql: { ...DEFAULTS.mssql, ...(raw.mssql ?? {}) },
      supabase: { ...DEFAULTS.supabase, ...(raw.supabase ?? {}) },
    };
  } catch {
    // Bozuk dosya uygulamayı kilitlemesin.
    return structuredClone(DEFAULTS);
  }
}

/**
 * Ayarları döndürür (şifre çözülmüş halde).
 * .env değerleri hâlâ desteklenir ve config.json boşsa devreye girer —
 * böylece mevcut kurulum bozulmaz.
 */
export function getConfig(): AppConfig {
  if (!_cache) {
    _cache = readFile();

    // İlk çalıştırmada oturum anahtarı üret ve kalıcı yaz.
    if (!_cache.sessionSecret) {
      _cache.sessionSecret = crypto.randomBytes(32).toString("hex");
      writeConfig(_cache);
    }
  }

  const c = structuredClone(_cache);
  c.mssql.password = decryptSecret(c.mssql.password);
  c.supabase.key = decryptSecret(c.supabase.key);

  // Supabase bilgileri config'te yoksa .env'e düş.
  if (!c.supabase.url && process.env.SUPABASE_URL) {
    c.supabase.url = process.env.SUPABASE_URL;
    c.supabase.key = process.env.SUPABASE_KEY || "";
  }

  // Hâlâ boşsa uygulamaya gömülü varsayılana düş. Böylece yeni bir bilgisayara
  // kurulduğunda kullanıcı hiçbir bilgi girmeden doğrudan bağlanır.
  // (Paketlenmiş exe'de .env bulunmadığı için bu katman gerekli.)
  if (!c.supabase.url && hasEmbeddedSupabase()) {
    c.supabase.url = EMBEDDED_SUPABASE.url;
    c.supabase.key = EMBEDDED_SUPABASE.key;
  }

  // config.json boşsa .env'e düş (geriye dönük uyumluluk).
  if (!c.mssql.server && process.env.MSSQL_SERVER) {
    c.mssql.server = process.env.MSSQL_SERVER;
    c.mssql.port = parseInt(process.env.MSSQL_PORT || "1433", 10);
    c.mssql.database = process.env.MSSQL_DATABASE || c.mssql.database;
    c.mssql.user = process.env.MSSQL_USER || "";
    c.mssql.password = process.env.MSSQL_PASSWORD || "";
    c.mssql.instanceName = process.env.MSSQL_INSTANCE || "";
    c.mssql.encrypt = process.env.MSSQL_ENCRYPT === "true";
    c.mssql.trustServerCertificate = process.env.MSSQL_TRUST_CERT !== "false";
  }
  return c;
}

/** Ayarları diske yazar (şifre şifrelenerek). */
export function writeConfig(next: AppConfig): void {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });

  const toStore: AppConfig = {
    ...next,
    mssql: {
      ...next.mssql,
      password: next.mssql.password.startsWith(ENC_PREFIX)
        ? next.mssql.password
        : encryptSecret(next.mssql.password),
    },
    supabase: {
      ...next.supabase,
      key: next.supabase.key.startsWith(ENC_PREFIX)
        ? next.supabase.key
        : encryptSecret(next.supabase.key),
    },
  };

  fs.writeFileSync(configPath(), JSON.stringify(toStore, null, 2), "utf8");
  _cache = toStore;
}

/** Ayarların bir kısmını günceller. */
export function updateConfig(patch: Partial<AppConfig>): AppConfig {
  const current = _cache ? structuredClone(_cache) : readFile();
  const next: AppConfig = {
    ...current,
    ...patch,
    mssql: { ...current.mssql, ...(patch.mssql ?? {}) },
    supabase: { ...current.supabase, ...(patch.supabase ?? {}) },
  };
  writeConfig(next);
  return getConfig();
}

/** Testlerde / yeniden yüklemede önbelleği temizler. */
export function reloadConfig(): void {
  _cache = null;
}
