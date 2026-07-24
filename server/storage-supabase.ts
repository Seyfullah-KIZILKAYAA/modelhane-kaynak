import type { Model, InsertModel, UpdateModel } from "@shared/schema";
import type { IStorage } from "./storage";
import { getSupabase, friendlySupabaseError } from "./supabase";

/** Supabase satırını (snake_case) uygulama Model tipine (camelCase) çevirir. */
function rowToModel(r: any): Model {
  return {
    id: r.id,
    grup: r.grup,
    modelKodu: r.model_kodu,
    kategori: r.kategori,
    renk: r.renk ?? "",
    adet: r.adet,
    termin: r.termin,
    girenKisi: r.giren_kisi,
    durum: r.durum,
    numuneDurum: r.numune_durum,
    numuneSebep: r.numune_sebep,
    numuneCinsi: r.numune_cinsi,
    kumasDurum: r.kumas_durum,
    kumasHazirTarih: r.kumas_hazir_tarih,
    kumasNot: r.kumas_not,
    siraNo: r.sira_no,
    // BIGINT sürücüden string gelebilir; Model.createdAt number bekliyor.
    createdAt: Number(r.created_at),
  } as Model;
}

/** Model alanlarını (camelCase) Supabase kolonlarına (snake_case) çevirir. */
function modelToRow(m: Partial<UpdateModel>): Record<string, any> {
  const row: Record<string, any> = {};
  if (m.grup !== undefined) row.grup = m.grup;
  if (m.modelKodu !== undefined) row.model_kodu = m.modelKodu;
  if (m.kategori !== undefined) row.kategori = m.kategori;
  if ((m as any).renk !== undefined) row.renk = (m as any).renk;
  if (m.adet !== undefined) row.adet = m.adet;
  if (m.termin !== undefined) row.termin = m.termin;
  if (m.girenKisi !== undefined) row.giren_kisi = m.girenKisi;
  if (m.durum !== undefined) row.durum = m.durum;
  if (m.numuneDurum !== undefined) row.numune_durum = m.numuneDurum;
  if (m.numuneSebep !== undefined) row.numune_sebep = m.numuneSebep;
  if (m.numuneCinsi !== undefined) row.numune_cinsi = m.numuneCinsi;
  if (m.kumasDurum !== undefined) row.kumas_durum = m.kumasDurum;
  if (m.kumasHazirTarih !== undefined) row.kumas_hazir_tarih = m.kumasHazirTarih;
  if (m.kumasNot !== undefined) row.kumas_not = m.kumasNot;
  return row;
}

/** Supabase hatasını atar; çağıranlar tek tek kontrol etmesin diye ortak yardımcı. */
function throwIf(error: any): void {
  if (error) throw new Error(friendlySupabaseError(error));
}

export class SupabaseStorage implements IStorage {
  async getModels(): Promise<Model[]> {
    const { data, error } = await getSupabase()
      .from("models")
      .select("*")
      // Son eklenen en üstte: yeniden eskiye. Aynı ms'de eklenenler için id tie-breaker.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    throwIf(error);
    return (data ?? []).map(rowToModel);
  }

  async createModel(m: InsertModel): Promise<Model> {
    const { data, error } = await getSupabase()
      .from("models")
      .insert({
        grup: m.grup,
        model_kodu: m.modelKodu,
        kategori: m.kategori,
        renk: (m as any).renk ?? "",
        adet: m.adet,
        termin: m.termin,
        giren_kisi: m.girenKisi,
        durum: "Beklemede",
        numune_durum: (m as any).numuneDurum ?? "Bekliyor",
        numune_sebep: (m as any).numuneSebep ?? "",
        numune_cinsi: (m as any).numuneCinsi ?? "Belirtilmedi",
        kumas_durum: (m as any).kumasDurum ?? "Belirtilmedi",
        kumas_hazir_tarih: (m as any).kumasHazirTarih ?? "",
        kumas_not: (m as any).kumasNot ?? "",
        sira_no: null,
        created_at: Date.now(),
      })
      .select()
      .single();
    throwIf(error);
    return rowToModel(data);
  }

  /** Ortak UPDATE yardımcısı. Satır yoksa undefined döner. */
  private async patch(id: number, row: Record<string, any>): Promise<Model | undefined> {
    const { data, error } = await getSupabase()
      .from("models")
      .update(row)
      .eq("id", id)
      .select()
      .maybeSingle();
    throwIf(error);
    return data ? rowToModel(data) : undefined;
  }

  async updateStatus(id: number, durum: string): Promise<Model | undefined> {
    return this.patch(id, { durum });
  }

  async updateSira(id: number, siraNo: number | null): Promise<Model | undefined> {
    return this.patch(id, { sira_no: siraNo });
  }

  async updateNumune(
    id: number,
    numuneDurum: string,
    numuneSebep: string,
  ): Promise<Model | undefined> {
    return this.patch(id, { numune_durum: numuneDurum, numune_sebep: numuneSebep });
  }

  async updateNumuneCinsi(id: number, numuneCinsi: string): Promise<Model | undefined> {
    return this.patch(id, { numune_cinsi: numuneCinsi });
  }

  async updateKumas(
    id: number,
    kumasDurum: string,
    kumasHazirTarih: string,
    kumasNot: string,
  ): Promise<Model | undefined> {
    return this.patch(id, {
      kumas_durum: kumasDurum,
      kumas_hazir_tarih: kumasHazirTarih,
      kumas_not: kumasNot,
    });
  }

  async updateModel(id: number, m: UpdateModel): Promise<Model | undefined> {
    return this.patch(id, modelToRow(m));
  }

  async deleteModel(id: number): Promise<boolean> {
    const { data, error } = await getSupabase()
      .from("models")
      .delete()
      .eq("id", id)
      .select("id");
    throwIf(error);
    return (data?.length ?? 0) > 0;
  }
}
