import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { getPool } from "../server/mssql";

async function main() {
  console.log("Connecting to MSSQL...");
  const pool = await getPool();
  const result = await pool.request().query("SELECT * FROM dbo.models ORDER BY id ASC");
  const mssqlModels = result.recordset;

  console.log(`Found ${mssqlModels.length} models in MSSQL.`);

  // Convert snake_case from DB to camelCase for the backup JSON format
  const mappedModels = mssqlModels.map((row) => ({
    id: row.id,
    grup: row.grup,
    modelKodu: row.model_kodu,
    kategori: row.kategori,
    adet: row.adet,
    termin: row.termin,
    girenKisi: row.giren_kisi,
    durum: row.durum,
    numuneDurum: row.numune_durum,
    numuneSebep: row.numune_sebep,
    numuneCinsi: row.numune_cinsi,
    kumasDurum: row.kumas_durum,
    kumasHazirTarih: row.kumas_hazir_tarih,
    kumasNot: row.kumas_not,
    siraNo: row.sira_no,
    createdAt: Number(row.created_at)
  }));

  const backupFilePath = path.join(process.cwd(), "yedek", "supabase-yedek-2026-07-20.json");
  
  console.log(`Writing to ${backupFilePath}...`);
  await fs.writeFile(backupFilePath, JSON.stringify(mappedModels, null, 2), "utf8");
  
  console.log("Backup file successfully updated.");
  process.exit(0);
}

main().catch(console.error);
