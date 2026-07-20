import type { Model, InsertModel } from '@shared/schema';

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
  deleteModel(id: number): Promise<boolean>;
}

let _storage: IStorage | null = null;

/** SQL Server storage örneğini döndürür (ilk çağrıda oluşturur). */
async function activeStorage(): Promise<IStorage> {
  if (!_storage) {
    const { SqlServerStorage } = await import("./storage-mssql");
    _storage = new SqlServerStorage();
  }
  return _storage;
}

export const storage: IStorage = {
  getModels: async () => (await activeStorage()).getModels(),
  createModel: async (m) => (await activeStorage()).createModel(m),
  updateStatus: async (id, durum) => (await activeStorage()).updateStatus(id, durum),
  updateSira: async (id, siraNo) => (await activeStorage()).updateSira(id, siraNo),
  updateNumune: async (id, d, s) => (await activeStorage()).updateNumune(id, d, s),
  updateNumuneCinsi: async (id, c) => (await activeStorage()).updateNumuneCinsi(id, c),
  updateKumas: async (id, d, t, n) => (await activeStorage()).updateKumas(id, d, t, n),
  deleteModel: async (id) => (await activeStorage()).deleteModel(id),
};
