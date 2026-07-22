import { getPool, sql, friendlyError } from "./mssql";
import { getConfig } from "./config";

/**
 * Veritabanı ve tablo kurulumu.
 * Ayarlar ekranındaki "Veritabanını Oluştur" / "Tabloları Oluştur" adımları
 * bu fonksiyonları çağırır. Hepsi tekrar çalıştırılabilir (idempotent).
 */

/**
 * Hedef veritabanını oluşturur.
 * master'a bağlanır çünkü hedef veritabanı henüz yok olabilir.
 */
export async function ensureDatabase(): Promise<{ created: boolean; name: string }> {
  const m = getConfig().mssql;
  const name = m.database;

  // Veritabanı adı parametre olarak bağlanamaz (DDL), o yüzden beyaz liste ile doğrula.
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name)) {
    throw new Error(
      `Geçersiz veritabanı adı: "${name}". Sadece harf, rakam ve alt çizgi kullanın.`,
    );
  }

  const { ConnectionPool } = sql;
  const master = new ConnectionPool({
    server: m.server,
    port: m.port,
    database: "master",
    user: m.user,
    password: m.password,
    options: {
      encrypt: m.encrypt,
      trustServerCertificate: m.trustServerCertificate,
      ...(m.instanceName ? { instanceName: m.instanceName } : {}),
    },
    connectionTimeout: 15_000,
  });

  try {
    await master.connect();
    const exists = await master
      .request()
      .input("n", sql.NVarChar, name)
      .query("SELECT 1 AS x FROM sys.databases WHERE name = @n");

    if (exists.recordset.length > 0) return { created: false, name };

    await master.request().query(`CREATE DATABASE [${name}]`);
    return { created: true, name };
  } catch (err) {
    throw new Error(friendlyError(err));
  } finally {
    await master.close().catch(() => {});
  }
}

/** models + app_passwords tablolarını oluşturur (varsa dokunmaz). */
export async function ensureTables(): Promise<{ models: boolean; passwords: boolean }> {
  const pool = await getPool();

  const before = await pool.request().query(`
    SELECT
      CASE WHEN OBJECT_ID('dbo.models', 'U')        IS NULL THEN 0 ELSE 1 END AS m,
      CASE WHEN OBJECT_ID('dbo.app_passwords', 'U') IS NULL THEN 0 ELSE 1 END AS p
  `);
  const hadModels = before.recordset[0].m === 1;
  const hadPasswords = before.recordset[0].p === 1;

  // Sütun adları snake_case; storage katmanı camelCase'e çevirir.
  await pool.request().query(`
    IF OBJECT_ID('dbo.models', 'U') IS NULL
    CREATE TABLE dbo.models (
      id                 INT IDENTITY(1,1) PRIMARY KEY,
      grup               NVARCHAR(100)  NOT NULL,
      model_kodu         NVARCHAR(200)  NOT NULL,
      kategori           NVARCHAR(100)  NOT NULL,
      adet               INT            NOT NULL,
      termin             NVARCHAR(20)   NOT NULL DEFAULT '',
      giren_kisi         NVARCHAR(200)  NOT NULL DEFAULT '',
      durum              NVARCHAR(50)   NOT NULL DEFAULT 'Beklemede',
      numune_durum       NVARCHAR(50)   NOT NULL DEFAULT 'Bekliyor',
      numune_sebep       NVARCHAR(MAX)  NOT NULL DEFAULT '',
      numune_cinsi       NVARCHAR(100)  NOT NULL DEFAULT 'Belirtilmedi',
      kumas_durum        NVARCHAR(100)  NOT NULL DEFAULT 'Belirtilmedi',
      kumas_hazir_tarih  NVARCHAR(20)   NOT NULL DEFAULT '',
      kumas_not          NVARCHAR(MAX)  NOT NULL DEFAULT '',
      sira_no            INT            NULL,
      created_at         BIGINT         NOT NULL
    )
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_models_created_at' AND object_id = OBJECT_ID('dbo.models'))
    CREATE INDEX IX_models_created_at ON dbo.models (created_at)
  `);

  // Grup şifreleri. Şifreler düz metin DEĞİL, scrypt ile hash'lenmiş saklanır.
  await pool.request().query(`
    IF OBJECT_ID('dbo.app_passwords', 'U') IS NULL
    CREATE TABLE dbo.app_passwords (
      [key]          NVARCHAR(50)  NOT NULL PRIMARY KEY,
      password_hash  NVARCHAR(500) NOT NULL,
      role           NVARCHAR(50)  NOT NULL,
      grup           NVARCHAR(100) NULL,
      updated_at     BIGINT        NOT NULL
    )
  `);

  // Genel uygulama ve kullanıcı yetki ayarları tablosu
  await pool.request().query(`
    IF OBJECT_ID('dbo.app_settings', 'U') IS NULL
    CREATE TABLE dbo.app_settings (
      [key]          NVARCHAR(100) NOT NULL PRIMARY KEY,
      value          NVARCHAR(MAX) NOT NULL,
      updated_at     BIGINT        NOT NULL
    )
  `);

  return { models: !hadModels, passwords: !hadPasswords };
}

export interface SetupStatus {
  databaseExists: boolean;
  modelsTable: boolean;
  passwordsTable: boolean;
  modelCount: number | null;
}

/** Ayarlar ekranında kurulum adımlarının hangisinin tamamlandığını gösterir. */
export async function getSetupStatus(): Promise<SetupStatus> {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT
      CASE WHEN OBJECT_ID('dbo.models', 'U')        IS NULL THEN 0 ELSE 1 END AS m,
      CASE WHEN OBJECT_ID('dbo.app_passwords', 'U') IS NULL THEN 0 ELSE 1 END AS p
  `);
  const modelsTable = r.recordset[0].m === 1;
  const passwordsTable = r.recordset[0].p === 1;

  let modelCount: number | null = null;
  if (modelsTable) {
    const c = await pool.request().query("SELECT COUNT(*) AS n FROM dbo.models");
    modelCount = c.recordset[0].n;
  }

  return { databaseExists: true, modelsTable, passwordsTable, modelCount };
}
