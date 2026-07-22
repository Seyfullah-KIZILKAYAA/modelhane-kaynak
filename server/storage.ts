import type { Model, InsertModel, UpdateModel } from '@shared/schema';
import { getConfig, type DbProvider } from './config';

/**
 * Veri erişim arayüzü.
 *
 * Tek veri kaynağı: VMware üzerindeki SQL Server.
 * (Supabase kaldırıldı — veriler SQL Server'a aktarıldıktan sonra
 *  kullanımdan çıkarıldı.)
 */
export interface IStorage {
  getModels(): Promise<Model[]>;
  createModel(m: InsertModel): Promise<Model>;
  updateStatus(id: number, durum: string): Promise<Model | undefined>;
  updateSira(id: number, siraNo: number | null): Promise<Model | undefined>;
  updateNumune(id: number, numuneDurum: string, numuneSebep: string): Promise<Model | undefined>;
  updateNumuneCinsi(id: number, numuneCinsi: string): Promise<Model | undefined>;
  updateKumas(id: number, kumasDurum: string, kumasHazirTarih: string, kumasNot: string): Promise<Model | undefined>;
  updateModel(id: number, m: UpdateModel): Promise<Model | undefined>;
  deleteModel(id: number): Promise<boolean>;
}

let _storage: IStorage | null = null;
let _storageProvider: DbProvider | null = null;

/**
 * Ayarlarda seçili veri kaynağının storage örneğini döndürür.
 * Seçim değiştiğinde örnek yeniden kurulur, böylece uygulamayı yeniden
 * başlatmadan veritabanı değiştirilebilir.
 */
async function activeStorage(): Promise<IStorage> {
  const provider = getConfig().dbProvider;
  if (_storage && _storageProvider === provider) return _storage;

  if (provider === "supabase") {
    const { SupabaseStorage } = await import("./storage-supabase");
    _storage = new SupabaseStorage();
  } else {
    const { SqlServerStorage } = await import("./storage-mssql");
    _storage = new SqlServerStorage();
  }
  _storageProvider = provider;
  return _storage;
}

/** Belirli bir sağlayıcının storage örneğini döndürür (aktarım için). */
export async function storageFor(provider: DbProvider): Promise<IStorage> {
  if (provider === "supabase") {
    const { SupabaseStorage } = await import("./storage-supabase");
    return new SupabaseStorage();
  }
  const { SqlServerStorage } = await import("./storage-mssql");
  return new SqlServerStorage();
}

/** Ayarlar değiştiğinde önbelleklenen örneği düşürür. */
export function resetStorage(): void {
  _storage = null;
  _storageProvider = null;
}

export const storage: IStorage = {
  getModels: async () => (await activeStorage()).getModels(),
  createModel: async (m) => (await activeStorage()).createModel(m),
  updateStatus: async (id, durum) => (await activeStorage()).updateStatus(id, durum),
  updateSira: async (id, siraNo) => (await activeStorage()).updateSira(id, siraNo),
  updateNumune: async (id, d, s) => (await activeStorage()).updateNumune(id, d, s),
  updateNumuneCinsi: async (id, c) => (await activeStorage()).updateNumuneCinsi(id, c),
  updateKumas: async (id, d, t, n) => (await activeStorage()).updateKumas(id, d, t, n),
  updateModel: async (id, m) => (await activeStorage()).updateModel(id, m),
  deleteModel: async (id) => (await activeStorage()).deleteModel(id),
};
