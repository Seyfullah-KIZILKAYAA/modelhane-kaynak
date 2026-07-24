import { toast } from "@/hooks/use-toast";

/**
 * Uygulama hatalarını kullanıcıya bildirim (toast) olarak gösterir.
 *
 * Amaç: Bir bilgisayarda bir şey ters gittiğinde (uygulama çökmesi, sunucu
 * hatası, veritabanı bağlantısı kopması) o hatanın sessizce yutulmayıp
 * ekranın sağ altında görünür bir bildirim olarak çıkması. Bildirim YALNIZCA
 * hatanın oluştuğu bilgisayarda gösterilir; başka makineye gönderilmez ve
 * sunucuya kaydedilmez.
 *
 * Bu dosya React ağacının dışından da çağrılabilir: toast() global bir
 * fonksiyondur, bu yüzden window.onerror gibi olay dinleyicilerinden doğrudan
 * kullanılabilir.
 */

type HataTuru = "js" | "api" | "veritabani";

/** Aynı hatanın saniyede onlarca kez tekrar tetiklenip ekranı doldurmasını
 *  önlemek için son gösterilen mesajları kısa süre hatırlarız. */
const sonMesajlar = new Map<string, number>();
const TEKRAR_ARALIGI_MS = 4000;

function yakinZamandaGosterildi(anahtar: string): boolean {
  const simdi = Date.now();
  const oncekiZaman = sonMesajlar.get(anahtar);
  if (oncekiZaman !== undefined && simdi - oncekiZaman < TEKRAR_ARALIGI_MS) {
    return true;
  }
  sonMesajlar.set(anahtar, simdi);
  // Haritanın sınırsız büyümesini engelle.
  if (sonMesajlar.size > 50) {
    const enEski = sonMesajlar.keys().next().value;
    if (enEski !== undefined) sonMesajlar.delete(enEski);
  }
  return false;
}

/** Ham hata nesnesinden okunabilir bir metin çıkarır. */
function mesajCikar(hata: unknown): string {
  if (hata instanceof Error) return hata.message;
  if (typeof hata === "string") return hata;
  try {
    return JSON.stringify(hata);
  } catch {
    return "Bilinmeyen hata";
  }
}

/** Mesajın bir veritabanı/bağlantı hatası olup olmadığını sezer. */
function veritabaniHatasiMi(mesaj: string): boolean {
  const m = mesaj.toLowerCase();
  return (
    m.includes("veritaban") ||
    m.includes("database") ||
    m.includes("bağlan") ||
    m.includes("connect") ||
    m.includes("econnrefused") ||
    m.includes("timeout") ||
    m.includes("supabase") ||
    m.includes("mssql") ||
    m.includes("503") ||
    m.includes("failed to fetch") || // sunucuya hiç ulaşılamadı
    m.includes("networkerror")
  );
}

const BASLIKLAR: Record<HataTuru, string> = {
  js: "Uygulama hatası",
  api: "İşlem başarısız",
  veritabani: "Bağlantı hatası",
};

/**
 * Bir hatayı bildirim olarak gösterir.
 *
 * @param hata  Yakalanan hata (Error, metin ya da herhangi bir değer).
 * @param tur   Kaynağı; başlığı ve mesajı buna göre biçimlendiririz.
 */
export function hataBildir(hata: unknown, tur: HataTuru = "js"): void {
  const ham = mesajCikar(hata);
  if (!ham) return;

  // Tür açıkça API dese bile mesaj bağlantı kokuyorsa "veritabani" gösterelim;
  // kullanıcı için "Bağlantı hatası" başlığı daha anlaşılır.
  const gercekTur: HataTuru =
    tur !== "js" && veritabaniHatasiMi(ham) ? "veritabani" : tur;

  const anahtar = `${gercekTur}:${ham}`;
  if (yakinZamandaGosterildi(anahtar)) return;

  let aciklama = ham;
  if (gercekTur === "veritabani") {
    aciklama =
      "Sunucuya veya veritabanına ulaşılamadı. İnternet/ağ bağlantınızı " +
      "kontrol edin. Sorun sürerse yöneticiye bildirin.\n\n" +
      `Ayrıntı: ${ham}`;
  }

  toast({
    variant: "destructive",
    title: BASLIKLAR[gercekTur],
    description: aciklama,
  });
}

/**
 * Tarayıcı düzeyindeki yakalanmamış hataları dinlemeye başlar.
 *
 * Uygulama açılışında bir kez çağrılır (main.tsx). İki kaynağı yakalar:
 *  - window "error": senkron JS hataları (bileşen render'ı dışı çökmeler).
 *  - "unhandledrejection": beklemede kalmış (await edilmemiş) Promise hataları.
 */
export function globalHataYakalamaBaslat(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (olay) => {
    // Kaynak yükleme hataları (ör. bir resmin gelmemesi) mesaj taşımaz;
    // kullanıcıyı gereksiz uyarmayalım.
    if (!olay.message) return;
    hataBildir(olay.error ?? olay.message, "js");
  });

  window.addEventListener("unhandledrejection", (olay) => {
    hataBildir(olay.reason, "js");
  });
}
