import type { Express, Response } from "express";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getConfig } from "./config";
import { getSupabase } from "./supabase";
import { requireAuth } from "./auth";

/**
 * Değişiklik bildirimi köprüsü: Supabase Realtime -> tarayıcı (SSE).
 *
 * Neden bu tasarım?
 * Eskiden her pencere 5 saniyede bir /api/models'a soruyordu. 9 bilgisayar x
 * 8 saat = günde yarım milyon istek ve Supabase ücretsiz planındaki 5 GB aylık
 * veri transferi (egress) kotasını kat kat aşan bir trafik demekti.
 *
 * Artık sunucu, "models" tablosunu Supabase Realtime ile tek bir WebSocket
 * üzerinden dinler. Gerçekten bir INSERT/UPDATE/DELETE olduğunda bağlı
 * pencerelere "yenile" sinyali gönderir; onlar da yalnızca o an veri çeker.
 * Boşta hiç istek gitmez.
 *
 * Supabase anahtarı tarayıcıya verilmediği için abonelik burada, sunucuda
 * kurulur — service_role anahtarı sunucuda kalmalıdır.
 *
 * ÖNEMLİ — KURULUM ADIMI:
 * "models" tablosunun Supabase'de Realtime yayınına ekli olması gerekir.
 * Supabase panelinde SQL Editor'de bir kez şunu çalıştırın:
 *
 *     alter publication supabase_realtime add table public.models;
 *
 * (Aynı işlem Database -> Replication ekranından da yapılabilir.)
 *
 * Bu yapılmazsa kanal "SUBSCRIBED" der ama hiçbir olay gelmez — abonelik
 * kurulmuş sayılır, yalnızca tablo yayında olmadığı için sessiz kalır. O
 * durumda bilgisayarlar arası senkronizasyon istemcideki 30 saniyelik yedek
 * tazelemeye düşer; uygulama çalışır, sadece güncellemeler anlık olmaz.
 */

/** Bağlı tarayıcı pencereleri. */
const clients = new Set<Response>();

// index.ts'teki log'u içe aktarmak döngüsel bağımlılık yaratıyor
// (index -> routes -> realtime -> index); aynı biçimi burada üretiyoruz.
function log(message: string): void {
  console.log(`[realtime] ${message}`);
}

let channel: RealtimeChannel | null = null;

/** Bağlı tüm pencerelere tek satırlık bir SSE olayı yollar. */
function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  // forEach kullanılıyor: projenin TypeScript hedefi Set üzerinde for...of'a
  // izin vermiyor (downlevelIteration kapalı).
  clients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      // Kopmuş bağlantı; "close" olayı zaten temizleyecek.
    }
  });
}

/**
 * "models" tablosuna abone olur. Zaten abone olunmuşsa hiçbir şey yapmaz.
 * Ayarlar değişince stopRealtime() ile kapatılıp yeniden çağrılır.
 */
export function startRealtime(): void {
  if (channel) return;
  if (getConfig().dbProvider !== "supabase") return;

  let client;
  try {
    client = getSupabase();
  } catch {
    // Bağlantı bilgileri henüz girilmemiş; ayarlar kaydedilince yeniden denenir.
    return;
  }

  channel = client
    .channel("models-degisiklik")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "models" },
      (payload) => {
        broadcast("models", { type: payload.eventType });
      },
    )
    .subscribe((status) => {
      log(`Supabase Realtime durumu: ${status}`);
      // Bağlantı koptuysa istemci kendi kendine yeniden dener; yine de
      // pencerelere haber verelim ki ekrandaki veri bayatlamasın.
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        broadcast("models", { type: "reconnect" });
      }
    });
}

/** Aboneliği kapatır (ayarlar değiştiğinde veya MSSQL'e geçildiğinde). */
export function stopRealtime(): void {
  if (!channel) return;
  try {
    channel.unsubscribe();
  } catch {
    // Kapanış hatası önemli değil.
  }
  channel = null;
}

/** Ayarlar değişince aboneliği yeni bağlantıyla kurar. */
export function restartRealtime(): void {
  stopRealtime();
  startRealtime();
}

/**
 * Sunucu bir yazma işlemi yaptığında pencereleri hemen uyarır.
 *
 * Realtime olayı zaten gelecek; ama bu çağrı gecikmeyi sıfırlar ve tablo için
 * Realtime açılmamışsa tek güvence olarak kalır. Aynı değişiklik için iki
 * sinyal gelmesi zararsız: istemci tarafında React Query aynı anda gelen
 * tazeleme isteklerini tekilleştirir.
 */
export function notifyModelsChanged(): void {
  broadcast("models", { type: "local" });
}

export function registerRealtimeRoutes(app: Express): void {
  // --- Değişiklik akışı (SSE) ---
  app.get("/api/events", requireAuth, (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Bazı ara katmanlar SSE'yi tamponlar; bu başlık onu kapatır.
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    // Bağlantı kurulduğunu bildir; istemci böylece polling'i kapatabilir.
    res.write(`event: ready\ndata: {}\n\n`);

    clients.add(res);

    // Boşta kalan bağlantıyı vekil sunucular/işletim sistemi kapatabiliyor;
    // 25 saniyede bir yorum satırı göndermek bağlantıyı canlı tutar. Bu bir
    // veri isteği değildir, egress'e etkisi ihmal edilebilir.
    const keepAlive = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(keepAlive);
      }
    }, 25_000);

    req.on("close", () => {
      clearInterval(keepAlive);
      clients.delete(res);
    });
  });
}
