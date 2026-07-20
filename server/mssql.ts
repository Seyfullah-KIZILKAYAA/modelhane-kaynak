import sql from "mssql";
import { getConfig } from "./config";

/**
 * VMware üzerindeki SQL Server bağlantısı.
 *
 * Lazy başlatılır: modül import edilirken DEĞİL, ilk sorguda havuz oluşturulur.
 * Böylece bağlantı bilgileri eksikken bile sunucu ayağa kalkar ve ayarlar
 * ekranından durum görüntülenebilir.
 */

let _pool: sql.ConnectionPool | null = null;
let _connecting: Promise<sql.ConnectionPool> | null = null;

export interface MssqlSettings {
  server: string;
  port: number;
  database: string;
  user: string;
  instanceName?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  configured: boolean;
}

/** Ayarlardan okunan bağlantı bilgileri (şifre hariç — o asla dışarı verilmez). */
export function getSettings(): MssqlSettings {
  const m = getConfig().mssql;
  return {
    server: m.server,
    port: m.port,
    database: m.database,
    user: m.user,
    instanceName: m.instanceName || undefined,
    encrypt: m.encrypt,
    trustServerCertificate: m.trustServerCertificate,
    configured: Boolean(m.server && m.user && m.password),
  };
}

function buildConfig(overrideDatabase?: string): sql.config {
  const m = getConfig().mssql;
  if (!m.server || !m.user || !m.password) {
    throw new Error(
      "SQL Server bağlantı bilgileri eksik. Ayarlar ekranından sunucu, kullanıcı ve şifre girin.",
    );
  }
  return {
    server: m.server,
    port: m.port,
    database: overrideDatabase ?? m.database,
    user: m.user,
    password: m.password,
    options: {
      encrypt: m.encrypt,
      trustServerCertificate: m.trustServerCertificate,
      ...(m.instanceName ? { instanceName: m.instanceName } : {}),
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 15_000,
    requestTimeout: 30_000,
  };
}

/** Paylaşılan bağlantı havuzunu döndürür; ilk çağrıda oluşturur. */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (_pool?.connected) return _pool;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    const pool = new sql.ConnectionPool(buildConfig());
    // Havuz koparsa bir sonraki çağrı yeniden bağlansın.
    pool.on("error", () => {
      _pool = null;
    });
    await pool.connect();
    _pool = pool;
    return pool;
  })();

  try {
    return await _connecting;
  } finally {
    _connecting = null;
  }
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.close().catch(() => {});
    _pool = null;
  }
}

export interface TestResult {
  ok: boolean;
  message: string;
  version?: string;
  database?: string;
  serverName?: string;
  models?: number;
}

/**
 * Ayarlar ekranındaki "Bağlantıyı Test Et" butonunun arkasındaki kontrol.
 * Hata mesajlarını kullanıcının anlayacağı Türkçe ipuçlarına çevirir.
 */
export async function testConnection(): Promise<TestResult> {
  const s = getSettings();
  if (!s.configured) {
    return {
      ok: false,
      message:
        "Bağlantı bilgileri girilmemiş. Aşağıdaki formu doldurup kaydedin.",
    };
  }

  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .query(
        "SELECT @@VERSION AS version, DB_NAME() AS db, @@SERVERNAME AS srv",
      );
    const row = r.recordset[0];

    // models tablosu henüz yoksa sorun değil — kurulum adımı eksik demektir.
    let models: number | undefined;
    try {
      const c = await pool
        .request()
        .query("SELECT COUNT(*) AS n FROM dbo.models");
      models = c.recordset[0].n;
    } catch {
      models = undefined;
    }

    return {
      ok: true,
      message:
        models === undefined
          ? "Bağlantı başarılı, ancak 'models' tablosu bulunamadı. Tabloları oluşturmanız gerekiyor."
          : "Bağlantı başarılı.",
      version: String(row.version).split("\n")[0].trim(),
      database: row.db,
      serverName: row.srv,
      models,
    };
  } catch (err: any) {
    return { ok: false, message: friendlyError(err) };
  }
}

/** mssql sürücüsünün ham hatalarını anlaşılır Türkçe açıklamaya çevirir. */
export function friendlyError(err: any): string {
  const raw = String(err?.message ?? err);
  const code = err?.code ?? err?.originalError?.code;

  if (code === "ELOGIN" || /Login failed/i.test(raw))
    return `Kullanıcı adı veya şifre hatalı. SQL Server'da "Mixed Mode" kimlik doğrulamanın açık olduğundan emin olun. (${raw})`;
  if (code === "ETIMEOUT" || /timeout/i.test(raw))
    return `Sunucuya ulaşılamadı (zaman aşımı). VM çalışıyor mu, 1433 portu güvenlik duvarında açık mı kontrol edin. (${raw})`;
  if (code === "ESOCKET" || /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/i.test(raw))
    return `Sunucuya bağlanılamadı. Adresi ve TCP/IP protokolünün SQL Server Configuration Manager'da etkin olduğunu kontrol edin. (${raw})`;
  if (/Cannot open database/i.test(raw))
    return `Veritabanı bulunamadı. Ayarlardaki "Veritabanını Oluştur" adımını çalıştırın. (${raw})`;
  if (/Invalid object name/i.test(raw))
    return `Tablo bulunamadı. Ayarlardaki "Tabloları Oluştur" adımını çalıştırın. (${raw})`;
  return raw;
}

export { sql };
