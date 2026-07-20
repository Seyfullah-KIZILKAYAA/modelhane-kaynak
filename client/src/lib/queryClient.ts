import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
