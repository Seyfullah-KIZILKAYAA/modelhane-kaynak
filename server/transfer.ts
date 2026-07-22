import type { Model } from "@shared/schema";
import type { DbProvider } from "./config";
import { storageFor } from "./storage";

/**
 * İki veritabanı arasında model aktarımı.
 *
 * Aktarım her zaman "eksikleri tamamla" mantığıyla çalışır: hedefte zaten
 * bulunan kayıtlar atlanır, sadece eksik olanlar yazılır. Böylece aktarım
 * birden çok kez çalıştırılsa da veri çoğalmaz.
 */

/**
 * Bir kaydın kimliği. Aynı model kodu + termin aynı işi temsil eder.
 * Veritabanı id'leri iki tarafta bağımsız arttığı için kimlik olarak
 * kullanılamaz; içerik tabanlı bir anahtar gerekir.
 */
function kayitAnahtari(m: Model): string {
  return `${m.modelKodu.trim().toLocaleLowerCase("tr")}|${(m.termin ?? "").trim()}`;
}

export interface TransferOnizleme {
  kaynak: DbProvider;
  hedef: DbProvider;
  kaynakToplam: number;
  hedefToplam: number;
  /** Hedefte olmayan, aktarılacak kayıt sayısı. */
  aktarilacak: number;
  /** Hedefte zaten bulunan, atlanacak kayıt sayısı. */
  atlanacak: number;
  /** Kullanıcıya gösterilecek örnekler (ilk 50). */
  ornekler: Array<{ modelKodu: string; grup: string; termin: string; adet: number }>;
}

export interface TransferSonuc extends TransferOnizleme {
  aktarilan: number;
  hatalar: Array<{ modelKodu: string; hata: string }>;
}

/** Kaynaktaki kayıtlardan hedefte olmayanları bulur. */
async function farkHesapla(kaynak: DbProvider, hedef: DbProvider) {
  if (kaynak === hedef) {
    throw new Error("Kaynak ve hedef veritabanı aynı olamaz.");
  }

  const [kaynakStorage, hedefStorage] = await Promise.all([
    storageFor(kaynak),
    storageFor(hedef),
  ]);

  const [kaynakModeller, hedefModeller] = await Promise.all([
    kaynakStorage.getModels(),
    hedefStorage.getModels(),
  ]);

  const mevcut = new Set(hedefModeller.map(kayitAnahtari));

  // Kaynağın kendi içinde de mükerrer olabilir; aynı anahtarı iki kez yazmayalım.
  const gorulen = new Set<string>();
  const eksik: Model[] = [];
  for (const m of kaynakModeller) {
    const anahtar = kayitAnahtari(m);
    if (mevcut.has(anahtar) || gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    eksik.push(m);
  }

  return { kaynakStorage, hedefStorage, kaynakModeller, hedefModeller, eksik };
}

/** Aktarımı yapmadan ne olacağını raporlar. */
export async function transferOnizle(
  kaynak: DbProvider,
  hedef: DbProvider,
): Promise<TransferOnizleme> {
  const { kaynakModeller, hedefModeller, eksik } = await farkHesapla(kaynak, hedef);

  return {
    kaynak,
    hedef,
    kaynakToplam: kaynakModeller.length,
    hedefToplam: hedefModeller.length,
    aktarilacak: eksik.length,
    atlanacak: kaynakModeller.length - eksik.length,
    ornekler: eksik.slice(0, 50).map((m) => ({
      modelKodu: m.modelKodu,
      grup: m.grup,
      termin: m.termin,
      adet: m.adet,
    })),
  };
}

/** Eksik kayıtları hedefe yazar. Hedefte olanlara dokunmaz. */
export async function transferYap(
  kaynak: DbProvider,
  hedef: DbProvider,
): Promise<TransferSonuc> {
  const { kaynakModeller, hedefModeller, hedefStorage, eksik } = await farkHesapla(
    kaynak,
    hedef,
  );

  let aktarilan = 0;
  const hatalar: Array<{ modelKodu: string; hata: string }> = [];

  for (const m of eksik) {
    try {
      // createModel durum/numune/kumaş alanlarını da kabul ediyor; kayıt
      // olduğu gibi taşınsın diye hepsini geçiriyoruz.
      const olusan = await hedefStorage.createModel({
        grup: m.grup,
        modelKodu: m.modelKodu,
        kategori: m.kategori,
        adet: m.adet,
        termin: m.termin,
        girenKisi: m.girenKisi,
        numuneDurum: m.numuneDurum,
        numuneSebep: m.numuneSebep ?? "",
        numuneCinsi: m.numuneCinsi ?? "Belirtilmedi",
        kumasDurum: m.kumasDurum ?? "Belirtilmedi",
        kumasHazirTarih: m.kumasHazirTarih ?? "",
        kumasNot: m.kumasNot ?? "",
      } as any);

      // createModel durumu her zaman "Beklemede" yazar; gerçek durumu geri koy.
      if (m.durum && m.durum !== olusan.durum) {
        await hedefStorage.updateStatus(olusan.id, m.durum);
      }

      aktarilan++;
    } catch (err: any) {
      hatalar.push({ modelKodu: m.modelKodu, hata: String(err?.message ?? err) });
    }
  }

  return {
    kaynak,
    hedef,
    kaynakToplam: kaynakModeller.length,
    hedefToplam: hedefModeller.length,
    aktarilacak: eksik.length,
    atlanacak: kaynakModeller.length - eksik.length,
    ornekler: eksik.slice(0, 50).map((m) => ({
      modelKodu: m.modelKodu,
      grup: m.grup,
      termin: m.termin,
      adet: m.adet,
    })),
    aktarilan,
    hatalar,
  };
}
