import { QueryClient, QueryFunction, focusManager } from "@tanstack/react-query";

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
 * 5 saniyede bir veri çekmesi bu kotayı hızla tüketir.
 *
 * Pencere yeniden görünür olduğunda refetchOnWindowFocus devreye girip
 * veriyi anında tazeler — yani gecikme yaşanmaz.
 */
function isWindowVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

// Görünürlük değişimini React Query'ye bildir. Bu olmadan pencere yeniden
// açıldığında interval'in yeniden değerlendirilmesi gecikebiliyor; odak
// bildirimi hem interval'i geri başlatır hem de refetchOnWindowFocus'u tetikler.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    focusManager.setFocused(isWindowVisible());
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Tüm bilgisayarlar arasında 5 saniyede bir otomatik senkronizasyon.
      // Pencere gizliyse durur (false döndürmek interval'i askıya alır).
      refetchInterval: () => (isWindowVisible() ? 5000 : false),
      refetchIntervalInBackground: false, // Arka planda interval çalışmasın
      refetchOnWindowFocus: true, // Uygulama penceresine odaklanıldığında anında güncelle
      staleTime: 3000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
