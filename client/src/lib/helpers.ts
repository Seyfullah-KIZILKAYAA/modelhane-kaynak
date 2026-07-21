import type { Model } from "@shared/schema";

// Kalan gün hesabı (termin - bugün)
export function kalanGun(termin: string): number | null {
  if (!termin) return null;
  const t = new Date(termin + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

// Tarihi TR formatına çevir (GG.AA.YYYY)
export function trTarih(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Termine göre öneri sırası: en yakın termin = 1
// Tamamlananlar hariç, sadece aktif modeller sıralanır
export function terminOnerileri(models: Model[]): Map<number, number> {
  const aktif = models
    .filter((m) => m.durum !== "Tamamlandı" && m.termin)
    .sort((a, b) => {
      if (a.termin === b.termin) return a.createdAt - b.createdAt;
      return a.termin < b.termin ? -1 : 1;
    });
  const map = new Map<number, number>();
  aktif.forEach((m, i) => map.set(m.id, i + 1));
  return map;
}

// Durum renk sınıfları
export function durumRenk(durum: string): string {
  switch (durum) {
    case "Beklemede":
      return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30";
    case "Dikimde":
      return "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30";
    case "Tamamlandı":
      return "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 border-green-200 dark:border-green-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// Numune durumu renk
export function numuneRenk(durum: string): string {
  switch (durum) {
    case "Numune Onaylandı":
      return "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 border-green-200 dark:border-green-500/30";
    case "Numune Reddedildi":
      return "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300 border-red-200 dark:border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// Kumaş aşaması renk
export function kumasRenk(asama: string): string {
  switch (asama) {
    case "Hazır":
      return "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 border-green-200 dark:border-green-500/30";
    case "Konfeksiyon Rafta":
      return "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 border-teal-200 dark:border-teal-500/30";
    case "Boyahanede":
      return "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30";
    case "Sipariş Verildi":
      return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// Termin durumu renk (kalan güne göre)
export function terminRenk(gun: number | null, durum: string): string {
  if (gun === null || durum === "Tamamlandı") return "text-muted-foreground";
  if (gun < 0) return "text-red-600 dark:text-red-400 font-semibold";
  if (gun <= 7) return "text-orange-600 dark:text-orange-400 font-medium";
  return "text-foreground";
}
