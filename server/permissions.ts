import { getPool, sql } from "./mssql";
import { getConfig, updateConfig } from "./config";
import { UserPermissions, DEFAULT_PERMISSIONS } from "@shared/schema";

export async function getPermissions(): Promise<UserPermissions> {
  // 1. Önce veritabanından (dbo.app_settings) okumayı dene
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("key", sql.NVarChar, "user_permissions")
      .query("SELECT value FROM dbo.app_settings WHERE [key] = @key");

    if (result.recordset.length > 0) {
      const parsed = JSON.parse(result.recordset[0].value);
      return { ...DEFAULT_PERMISSIONS, ...parsed };
    }
  } catch {
    // Veritabanına bağlanılamadıysa veya tablo henüz yoksa config.json'a düş
  }

  // 2. config.json oku
  const cfg = getConfig();
  if (cfg.userPermissions) {
    return { ...DEFAULT_PERMISSIONS, ...cfg.userPermissions };
  }

  return DEFAULT_PERMISSIONS;
}

export async function savePermissions(permissions: UserPermissions): Promise<UserPermissions> {
  const merged: UserPermissions = { ...DEFAULT_PERMISSIONS, ...permissions };

  // 1. Yerel config.json dosyasını güncelle
  updateConfig({ userPermissions: merged });

  // 2. Veritabanı bağlıysa dbo.app_settings tablosuna kaydet
  try {
    const pool = await getPool();
    const now = Date.now();
    const valJson = JSON.stringify(merged);

    await pool.request()
      .input("key", sql.NVarChar, "user_permissions")
      .input("val", sql.NVarChar, valJson)
      .input("now", sql.BigInt, now)
      .query(`
        IF EXISTS (SELECT 1 FROM dbo.app_settings WHERE [key] = @key)
          UPDATE dbo.app_settings SET value = @val, updated_at = @now WHERE [key] = @key
        ELSE
          INSERT INTO dbo.app_settings ([key], value, updated_at) VALUES (@key, @val, @now)
      `);
  } catch {
    // Veritabanı tablosu henüz yoksa sorun etme, yerel config güncellendi
  }

  return merged;
}
