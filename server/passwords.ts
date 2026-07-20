import crypto from "node:crypto";
import { getPool, sql } from "./mssql";
import { getConfig, updateConfig } from "./config";

/**
 * Grup şifrelerinin yönetimi.
 *
 * Şifreler düz metin saklanmaz — scrypt ile hash'lenir (Node'un yerleşik
 * kripto modülü, ek bağımlılık yok). Hash formatı: scrypt:<tuz>:<özet>
 *
 * Şifreler app_passwords tablosunda tutulur. Tablo henüz oluşturulmamışsa
 * koda gömülü varsayılanlara düşer, böylece kurulum tamamlanmadan da
 * giriş yapılabilir.
 */

export interface PasswordEntry {
  key: string;
  role: "kullanici" | "yonetici";
  grup: string | null;
}

/** Tablolar kurulmadan önce geçerli olan varsayılan şifreler. */
const DEFAULTS: Record<string, { password: string; role: "kullanici" | "yonetici"; grup: string | null }> = {
  grimelange: { password: "grimelange2026", role: "kullanici", grup: "Grimelange" },
  ethiquet: { password: "ethiquet2026", role: "kullanici", grup: "Ethiquet" },
  urbanbeat: { password: "urbanbeat2026", role: "kullanici", grup: "Urban Beat" },
  ihracat: { password: "ihracat2026", role: "kullanici", grup: "İhracat" },
  yonetici: { password: "yonetici2026", role: "yonetici", grup: null },
};

/** Ekranda gösterilecek okunabilir adlar. */
export const KEY_LABELS: Record<string, string> = {
  grimelange: "Grimelange",
  ethiquet: "Ethiquet",
  urbanbeat: "Urban Beat",
  ihracat: "İhracat",
  yonetici: "Ana Yönetici",
};

// --- Hash --------------------------------------------------------------

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(plain.normalize("NFKC"), salt, 32);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = crypto.scryptSync(plain.normalize("NFKC"), salt, expected.length);
    // Zamanlama saldırılarına karşı sabit süreli karşılaştırma.
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// --- Depo --------------------------------------------------------------

/** app_passwords tablosu kullanılabilir mi? */
async function tableReady(): Promise<boolean> {
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .query("SELECT CASE WHEN OBJECT_ID('dbo.app_passwords','U') IS NULL THEN 0 ELSE 1 END AS x");
    return r.recordset[0].x === 1;
  } catch {
    return false;
  }
}

/**
 * Tablo boşsa varsayılan şifreleri yazar.
 * Böylece SQL Server'a geçildiğinde mevcut şifreler çalışmaya devam eder.
 */
export async function seedIfEmpty(): Promise<boolean> {
  if (!(await tableReady())) return false;
  const pool = await getPool();
  const c = await pool.request().query("SELECT COUNT(*) AS n FROM dbo.app_passwords");
  if (c.recordset[0].n > 0) return false;

  for (const [key, d] of Object.entries(DEFAULTS)) {
    await pool
      .request()
      .input("key", sql.NVarChar(50), key)
      .input("hash", sql.NVarChar(500), hashPassword(d.password))
      .input("role", sql.NVarChar(50), d.role)
      .input("grup", sql.NVarChar(100), d.grup)
      .input("updated_at", sql.BigInt, Date.now())
      .query(`
        INSERT INTO dbo.app_passwords ([key], password_hash, role, grup, updated_at)
        VALUES (@key, @hash, @role, @grup, @updated_at)
      `);
  }
  return true;
}

export interface LoginResult {
  role: "kullanici" | "yonetici";
  grup: string | null;
  key: string;
}

/** Girilen şifreyi doğrular; eşleşme yoksa null döner. */
export async function checkLogin(plain: string): Promise<LoginResult | null> {
  const pw = plain.trim();
  if (!pw) return null;

  if (await tableReady()) {
    await seedIfEmpty();
    const pool = await getPool();
    const r = await pool
      .request()
      .query("SELECT [key], password_hash, role, grup FROM dbo.app_passwords");
    for (const row of r.recordset) {
      if (verifyPassword(pw, row.password_hash)) {
        return { role: row.role, grup: row.grup, key: row.key };
      }
    }
    return null;
  }

  // Tablo yoksa varsayılanlara düş (kurulum tamamlanmadan giriş yapılabilsin).
  const lower = pw.toLowerCase();
  for (const [key, d] of Object.entries(DEFAULTS)) {
    if (lower === d.password) return { role: d.role, grup: d.grup, key };
  }
  return null;
}

/** Ayarlar ekranı için şifre listesi (hash'ler döndürülmez). */
export async function listEntries(): Promise<
  Array<PasswordEntry & { label: string; updatedAt: number | null; custom: boolean }>
> {
  const ready = await tableReady();

  if (!ready) {
    return Object.entries(DEFAULTS).map(([key, d]) => ({
      key,
      role: d.role,
      grup: d.grup,
      label: KEY_LABELS[key] ?? key,
      updatedAt: null,
      custom: false,
    }));
  }

  await seedIfEmpty();
  const pool = await getPool();
  const r = await pool
    .request()
    .query("SELECT [key], role, grup, updated_at, password_hash FROM dbo.app_passwords ORDER BY [key]");

  return r.recordset.map((row: any) => ({
    key: row.key,
    role: row.role,
    grup: row.grup,
    label: KEY_LABELS[row.key] ?? row.key,
    updatedAt: Number(row.updated_at),
    // Varsayılan şifre hâlâ geçerliyse "değiştirilmemiş" olarak işaretle.
    custom: !(
      DEFAULTS[row.key] && verifyPassword(DEFAULTS[row.key].password, row.password_hash)
    ),
  }));
}

/** Bir grubun şifresini değiştirir. */
export async function setPassword(key: string, newPassword: string): Promise<void> {
  if (!(await tableReady())) {
    throw new Error(
      "Şifre değiştirmek için SQL Server bağlantısı ve tabloların kurulu olması gerekir.",
    );
  }
  if (!DEFAULTS[key]) throw new Error("Geçersiz şifre anahtarı.");

  await seedIfEmpty();
  const pool = await getPool();
  const r = await pool
    .request()
    .input("key", sql.NVarChar(50), key)
    .input("hash", sql.NVarChar(500), hashPassword(newPassword))
    .input("updated_at", sql.BigInt, Date.now())
    .query(`
      UPDATE dbo.app_passwords
      SET password_hash = @hash, updated_at = @updated_at
      WHERE [key] = @key
    `);

  if ((r.rowsAffected[0] ?? 0) === 0) throw new Error("Şifre kaydı bulunamadı.");
}

// --- Kurtarma PIN'i ----------------------------------------------------

export function isRecoveryPinSet(): boolean {
  return Boolean(getConfig().recoveryPinHash);
}

export function setRecoveryPin(pin: string): void {
  updateConfig({ recoveryPinHash: hashPassword(pin) });
}

export function verifyRecoveryPin(pin: string): boolean {
  const hash = getConfig().recoveryPinHash;
  if (!hash) return false;
  return verifyPassword(pin.trim(), hash);
}
