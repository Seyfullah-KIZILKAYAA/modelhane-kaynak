/**
 * ÖRNEK DOSYA — server/embedded-config.ts için şablon.
 *
 * Gerçek dosya .gitignore'dadır; içinde Supabase bağlantı bilgileri durduğu
 * ve bu depo public olduğu için sürüm kontrolüne girmez.
 *
 * KURULUM (yeni bir geliştirme makinesinde)
 * -----------------------------------------
 *   1) Bu dosyayı kopyalayın:
 *        cp server/embedded-config.example.ts server/embedded-config.ts
 *   2) Uygulamayı açıp ayarlar ekranından Supabase bilgilerini girin,
 *      ardından değerleri otomatik gömmek için:
 *        npx tsx script/embed-supabase.ts
 *      (ya da aşağıdaki alanları elle doldurun)
 *
 * Bu adımlar yapılmazsa uygulama yine çalışır; sadece ilk açılışta
 * kullanıcıdan bağlantı bilgilerini ayarlar ekranından girmesi istenir.
 *
 * GÜVENLİK NOTU
 * -------------
 * Buraya Supabase "anon" (public) anahtarı yazılır — service_role DEĞİL.
 * service_role anahtarı RLS politikalarını bypass edip veritabanı üzerinde
 * tam yetki verdiği için derlenmiş uygulamaya gömülmemelidir.
 *
 * anon anahtarı gömülü olsa bile, exe'ye erişen biri onu çıkarabilir.
 * Verinin korunması Supabase tarafındaki RLS politikalarına bağlıdır —
 * politikalar gevşekse anahtarı ele geçiren biri veriyi okuyup değiştirebilir.
 *
 * Anahtar sızarsa: Supabase panelinden Settings → API üzerinden anahtarı
 * yenileyin, bu dosyayı güncelleyip yeni sürüm yayınlayın.
 */

export interface EmbeddedSupabase {
  url: string;
  key: string;
}

/**
 * Boş bırakılırsa gömülü varsayılan devre dışı kalır ve kullanıcıdan
 * ayarlar ekranından girmesi istenir.
 */
export const EMBEDDED_SUPABASE: EmbeddedSupabase = {
  url: "",
  key: "",
};

/** Gömülü bir bağlantı tanımlı mı? */
export function hasEmbeddedSupabase(): boolean {
  return Boolean(EMBEDDED_SUPABASE.url && EMBEDDED_SUPABASE.key);
}
