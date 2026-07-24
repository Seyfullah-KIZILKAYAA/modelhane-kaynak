import {
  QueryClient,
  QueryCache,
  MutationCache,
  QueryFunction,
  focusManager,
} from "@tanstack/react-query";
import { hataBildir } from "./hata-bildirimi";

/**
 * Tüm veri erişimi Express sunucusu üzerinden gider.
 *
 * NOT: Daha önce bu dosya /api/* çağrılarını yakalayıp veritabanına doğrudan
 * tarayıcıdan bağlanıyordu; bu, giriş şifrelerinin istemci paketinde açıkta
 * kalmasına yol açıyordu. Artık şifreler ve veritabanı erişimi yalnızca
 * sunucuda.
 */

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  let message = `${res.status}: ${res.statusText}`;
  try {
    const body = await res.json();
    if (body?.error) message = `${res.status}: ${body.error}`;
    else if (body?.message) message = `${res.status}: ${body.message}`;
  } catch {
    // Gövde JSON değilse durum kodu mesajı yeterli.
  }
  throw new Error(message);
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/");
    const res = await fetch(url, { credentials: "include" });

    if (on401 === "returnNull" && res.status === 401) {
      return null as any;
    }

    await throwIfNotOk(res);
    return (await res.json()) as any;
  };

/**
 * Pencere gizliyken (simge durumuna küçültülmüş / arka planda) otomatik
 * yenilemeyi durdurur.
 *
 * React Query'nin kendi odak yönetimi Electron'da her zaman doğru sinyal
 * almadığı için document.visibilityState'i doğrudan dinliyoruz. Amaç boşuna
 * istek atmamak: Supabase ücretsiz planında istek sayısı sınırsız ama aylık
 * 5 GB veri transferi (egress) kotası var; kimsenin bakmadığı bir pencerenin
 * düzenli veri çekmesi bu kotayı hızla tüketir.
 *
 * Pencere yeniden görünür olduğunda refetchOnWindowFocus devreye girip
 * veriyi anında tazeler — yani gecikme yaşanmaz.
 */
function isWindowVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

/**
 * Sunucudan gelen değişiklik bildirimlerini dinler (SSE).
 *
 * Sunucu, Supabase Realtime üzerinden "models" tablosunu izler ve gerçekten
 * bir değişiklik olduğunda buraya sinyal gönderir. Böylece saniyede bir veri
 * çekmeye gerek kalmaz: boştayken hiç istek gitmez, değişiklik olduğunda ise
 * güncelleme anında gelir.
 *
 * Bağlantı kurulamazsa (sunucu yeni başlıyor, ağ koptu) EventSource kendi
 * kendine yeniden dener; ayrıca aşağıdaki yedek tazeleme aralığı devreye
 * girer, yani en kötü durumda eski davranışa düşülür.
 */
let eventsBaglandi = false;
let source: EventSource | null = null;

/**
 * Akışı başlatır. Giriş yapıldıktan SONRA çağrılmalıdır: /api/events oturum
 * ister, giriş ekranındayken açılırsa 401 alıp boşuna yeniden bağlanır durur.
 */
export function degisiklikAkisiniBaslat(): void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") return;
  if (source) return; // Zaten bağlı.

  const es = new EventSource("/api/events", { withCredentials: true });
  source = es;

  es.addEventListener("ready", () => {
    eventsBaglandi = true;
  });

  es.addEventListener("models", () => {
    // Yalnızca gerçekten değişiklik olduğunda veri çekilir.
    queryClient.invalidateQueries({ queryKey: ["/api/models"] });
  });

  es.onerror = () => {
    // Kopan bağlantıda yedek tazeleme aralığına geri dönülür; EventSource
    // yeniden bağlanınca "ready" olayı tekrar gelir ve akış devam eder.
    eventsBaglandi = false;
  };
}

/** Çıkışta akışı kapatır — oturumu olmayan bir bağlantı açık kalmasın. */
export function degisiklikAkisiniDurdur(): void {
  source?.close();
  source = null;
  eventsBaglandi = false;
}

/**
 * Yedek tazeleme aralığı.
 *
 * Değişiklik akışı çalışıyorsa veri çekmeye gerek yoktur (false). Akış
 * kopmuşsa veya Supabase panelinde "models" tablosu için Realtime açılmamışsa
 * 30 saniyede bir tazelenir — eski 5 saniyelik polling'e göre altıda bir
 * trafik, ama veri yine de bayatlamaz.
 */
function yedekTazelemeAraligi(): number | false {
  if (!isWindowVisible()) return false;
  return eventsBaglandi ? false : 30_000;
}

// Görünürlük değişimini React Query'ye bildir. Bu olmadan pencere yeniden
// açıldığında interval'in yeniden değerlendirilmesi gecikebiliyor; odak
// bildirimi hem interval'i geri başlatır hem de refetchOnWindowFocus'u tetikler.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    focusManager.setFocused(isWindowVisible());
  });
}

/**
 * API/veritabanı hatalarını bildirim olarak gösterir.
 *
 * 401 (oturum süresi doldu) normal bir akıştır — kullanıcı yeniden giriş
 * ekranına döner — bu yüzden onu uyarı olarak göstermeyiz.
 */
function apiHatasiniBildir(hata: unknown): void {
  const mesaj = hata instanceof Error ? hata.message : String(hata);
  if (mesaj.startsWith("401")) return;
  hataBildir(hata, "api");
}

export const queryClient = new QueryClient({
  // Veri çekme (query) hataları: sunucu/veritabanı erişimi başarısız olunca.
  queryCache: new QueryCache({
    onError: (hata) => apiHatasiniBildir(hata),
  }),
  // Yazma (mutation) hataları: kaydet/güncelle/sil isteği başarısız olunca.
  // Bileşenler kendi onError'ında özel mesaj gösterse de, hiç göstermeyen
  // işlemlerin sessizce yutulmaması için burada da yakalarız.
  mutationCache: new MutationCache({
    onError: (hata) => apiHatasiniBildir(hata),
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Senkronizasyon artık sunucudan gelen değişiklik bildirimleriyle olur;
      // bu aralık yalnızca bildirim akışı çalışmadığında devreye giren yedektir.
      // Pencere gizliyse durur (false döndürmek interval'i askıya alır).
      refetchInterval: yedekTazelemeAraligi,
      refetchIntervalInBackground: false, // Arka planda interval çalışmasın
      refetchOnWindowFocus: true, // Uygulama penceresine odaklanıldığında anında güncelle
      // Değişiklik bildirimi geldiğinde veri gerçekten yeniden çekilmeli.
      // Bir bekleme süresi bırakılırsa arka arkaya gelen iki değişiklikten
      // ikincisi yutulabilir; bildirimler zaten seyrek olduğu için 0 uygun.
      staleTime: 0,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
