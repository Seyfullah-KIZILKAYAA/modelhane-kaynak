import type { Model, InsertModel } from "@shared/schema";
import type { IStorage } from "./storage";
import { getPool, sql } from "./mssql";

/** SQL Server satırını (snake_case) uygulama Model tipine (camelCase) çevirir. */
function rowToModel(r: any): Model {
  return {
    id: r.id,
    grup: r.grup,
    modelKodu: r.model_kodu,
    kategori: r.kategori,
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

const SELECT_COLS = `id, grup, model_kodu, kategori, adet, termin, giren_kisi,
  durum, numune_durum, numune_sebep, numune_cinsi, kumas_durum,
  kumas_hazir_tarih, kumas_not, sira_no, created_at`;

export class SqlServerStorage implements IStorage {
  async getModels(): Promise<Model[]> {
    const pool = await getPool();
    const r = await pool
      .request()
      // Son eklenen en üstte: yeniden eskiye. Aynı ms'de eklenenler için id tie-breaker.
      .query(`SELECT ${SELECT_COLS} FROM dbo.models ORDER BY created_at DESC, id DESC`);
    return r.recordset.map(rowToModel);
  }

  async createModel(m: InsertModel): Promise<Model> {
    const pool = await getPool();
    const r = await pool
      .request()
      .input("grup", sql.NVarChar(100), m.grup)
      .input("model_kodu", sql.NVarChar(200), m.modelKodu)
      .input("kategori", sql.NVarChar(100), m.kategori)
      .input("adet", sql.Int, m.adet)
      .input("termin", sql.NVarChar(20), m.termin)
      .input("giren_kisi", sql.NVarChar(200), m.girenKisi)
      .input("durum", sql.NVarChar(50), "Beklemede")
      .input("numune_durum", sql.NVarChar(50), (m as any).numuneDurum ?? "Bekliyor")
      .input("numune_sebep", sql.NVarChar(sql.MAX), (m as any).numuneSebep ?? "")
      .input("numune_cinsi", sql.NVarChar(100), (m as any).numuneCinsi ?? "Belirtilmedi")
      .input("kumas_durum", sql.NVarChar(100), (m as any).kumasDurum ?? "Belirtilmedi")
      .input("kumas_hazir_tarih", sql.NVarChar(20), (m as any).kumasHazirTarih ?? "")
      .input("kumas_not", sql.NVarChar(sql.MAX), (m as any).kumasNot ?? "")
      .input("created_at", sql.BigInt, Date.now())
      .query(`
        INSERT INTO dbo.models
          (grup, model_kodu, kategori, adet, termin, giren_kisi, durum,
           numune_durum, numune_sebep, numune_cinsi, kumas_durum,
           kumas_hazir_tarih, kumas_not, sira_no, created_at)
        OUTPUT ${SELECT_COLS.split(",").map((c) => "INSERTED." + c.trim()).join(", ")}
        VALUES
          (@grup, @model_kodu, @kategori, @adet, @termin, @giren_kisi, @durum,
           @numune_durum, @numune_sebep, @numune_cinsi, @kumas_durum,
           @kumas_hazir_tarih, @kumas_not, NULL, @created_at)
      `);
    return rowToModel(r.recordset[0]);
  }

  /** Ortak UPDATE ... OUTPUT yardımcısı. Satır yoksa undefined döner. */
  private async updateFields(
    id: number,
    fields: Array<{ col: string; type: any; value: any }>,
  ): Promise<Model | undefined> {
    const pool = await getPool();
    const req = pool.request().input("id", sql.Int, id);
    for (const f of fields) req.input(f.col, f.type, f.value);
    const setClause = fields.map((f) => `${f.col} = @${f.col}`).join(", ");
    const r = await req.query(`
      UPDATE dbo.models
      SET ${setClause}
      OUTPUT ${SELECT_COLS.split(",").map((c) => "INSERTED." + c.trim()).join(", ")}
      WHERE id = @id
    `);
    return r.recordset.length ? rowToModel(r.recordset[0]) : undefined;
  }

  async updateStatus(id: number, durum: string): Promise<Model | undefined> {
    return this.updateFields(id, [
      { col: "durum", type: sql.NVarChar(50), value: durum },
    ]);
  }

  async updateSira(id: number, siraNo: number | null): Promise<Model | undefined> {
    return this.updateFields(id, [
      { col: "sira_no", type: sql.Int, value: siraNo },
    ]);
  }

  async updateNumune(
    id: number,
    numuneDurum: string,
    numuneSebep: string,
  ): Promise<Model | undefined> {
    return this.updateFields(id, [
      { col: "numune_durum", type: sql.NVarChar(50), value: numuneDurum },
      { col: "numune_sebep", type: sql.NVarChar(sql.MAX), value: numuneSebep },
    ]);
  }

  async updateNumuneCinsi(id: number, numuneCinsi: string): Promise<Model | undefined> {
    return this.updateFields(id, [
      { col: "numune_cinsi", type: sql.NVarChar(100), value: numuneCinsi },
    ]);
  }

  async updateKumas(
    id: number,
    kumasDurum: string,
    kumasHazirTarih: string,
    kumasNot: string,
  ): Promise<Model | undefined> {
    return this.updateFields(id, [
      { col: "kumas_durum", type: sql.NVarChar(100), value: kumasDurum },
      { col: "kumas_hazir_tarih", type: sql.NVarChar(20), value: kumasHazirTarih },
      { col: "kumas_not", type: sql.NVarChar(sql.MAX), value: kumasNot },
    ]);
  }

  async deleteModel(id: number): Promise<boolean> {
    const pool = await getPool();
    const r = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM dbo.models WHERE id = @id");
    return (r.rowsAffected[0] ?? 0) > 0;
  }
}
