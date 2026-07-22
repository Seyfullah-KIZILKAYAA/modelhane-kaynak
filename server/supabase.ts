import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "./config";

/**
 * Supabase (PostgreSQL) bağlantısı.
 *
 * mssql.ts ile aynı deseni izler: lazy başlatılır, ayarlar değişince
 * resetClient() ile yeni istemci kurulur.
 */

let _client: SupabaseClient | null = null;
let _signature = "";

export interface SupabaseSettings {
  url: string;
  configured: boolean;
  keySet: boolean;
}

/** Ayarlardan okunan bağlantı bilgileri (anahtar hariç — asla dışarı verilmez). */
export function getSupabaseSettings(): SupabaseSettings {
  const s = getConfig().supabase;
  return {
    url: s.url,
    configured: Boolean(s.url && s.key),
    keySet: Boolean(s.key),
  };
}

/** Paylaşılan istemciyi döndürür; ayarlar değiştiyse yeniden kurar. */
export function getSupabase(): SupabaseClient {
  const s = getConfig().supabase;
  if (!s.url || !s.key) {
    throw new Error(
      "Supabase bağlantı bilgileri eksik. Ayarlar ekranından proje URL'i ve anahtarı girin.",
    );
  }

  // Ayarlar değiştiğinde eski istemci kullanılmasın.
  const sig = `${s.url}|${s.key}`;
  if (_client && _signature === sig) return _client;

  _client = createClient(s.url, s.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  _signature = sig;
  return _client;
}

export function resetSupabase(): void {
  _client = null;
  _signature = "";
}

export interface SupabaseTestResult {
  ok: boolean;
  message: string;
  models?: number;
}

/** Ayarlar ekranındaki "Bağlantıyı Test Et" karşılığı. */
export async function testSupabase(): Promise<SupabaseTestResult> {
  const s = getSupabaseSettings();
  if (!s.configured) {
    return {
      ok: false,
      message: "Supabase bilgileri girilmemiş. Formu doldurup kaydedin.",
    };
  }

  try {
    const { count, error } = await getSupabase()
      .from("models")
      .select("*", { count: "exact", head: true });

    if (error) return { ok: false, message: friendlySupabaseError(error) };
    return { ok: true, message: "Bağlantı başarılı.", models: count ?? 0 };
  } catch (err: any) {
    return { ok: false, message: friendlySupabaseError(err) };
  }
}

/** Supabase hatalarını anlaşılır Türkçe açıklamaya çevirir. */
export function friendlySupabaseError(err: any): string {
  const raw = String(err?.message ?? err);

  if (/Invalid API key|JWT|invalid signature/i.test(raw))
    return `Supabase anahtarı geçersiz. Proje ayarlarından doğru anahtarı kopyaladığınızdan emin olun. (${raw})`;
  if (/relation .* does not exist|Could not find the table/i.test(raw))
    return `"models" tablosu bulunamadı. Supabase projenizde tabloyu oluşturun. (${raw})`;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(raw))
    return `Supabase'e ulaşılamadı. İnternet bağlantınızı ve proje URL'ini kontrol edin. (${raw})`;
  if (/row-level security|permission denied/i.test(raw))
    return `Erişim reddedildi (RLS). service_role anahtarı kullandığınızdan veya tablo politikalarının izin verdiğinden emin olun. (${raw})`;
  return raw;
}
