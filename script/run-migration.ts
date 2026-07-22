import "dotenv/config";
import { getPool, sql } from "../server/mssql";
import { getSupabase } from "../server/supabase";

// Bağlantı bilgileri ayarlardan (config.json / .env / gömülü varsayılan) gelir;
// anahtar kaynak koda yazılmaz — bu depo public.
const supabase = getSupabase();

async function main() {
  console.log("Connecting to Supabase and fetching models...");
  const { data: supabaseModels, error } = await supabase.from("models").select("*");
  if (error) {
    console.error("Supabase error:", error);
    process.exit(1);
  }
  
  console.log("Connecting to MSSQL...");
  const pool = await getPool();
  const result = await pool.request().query("SELECT * FROM dbo.models");
  const mssqlModels = result.recordset;

  // Find missing models using created_at
  const mssqlCreatedAtSet = new Set(mssqlModels.map(m => m.created_at.toString()));
  const missingInMssql = supabaseModels.filter(sm => !mssqlCreatedAtSet.has(sm.created_at.toString()));

  console.log(`Found ${missingInMssql.length} new records to migrate.`);

  if (missingInMssql.length === 0) {
    console.log("No new data to migrate. Exiting.");
    process.exit(0);
  }

  // Insert records one by one
  let inserted = 0;
  for (const m of missingInMssql) {
    try {
      const request = pool.request();
      request.input('grup', sql.NVarChar, m.grup);
      request.input('model_kodu', sql.NVarChar, m.model_kodu);
      request.input('kategori', sql.NVarChar, m.kategori);
      request.input('adet', sql.Int, m.adet);
      request.input('termin', sql.NVarChar, m.termin || '');
      request.input('giren_kisi', sql.NVarChar, m.giren_kisi || '');
      request.input('durum', sql.NVarChar, m.durum || 'Beklemede');
      request.input('numune_durum', sql.NVarChar, m.numune_durum || 'Bekliyor');
      request.input('numune_sebep', sql.NVarChar, m.numune_sebep || '');
      request.input('numune_cinsi', sql.NVarChar, m.numune_cinsi || 'Belirtilmedi');
      request.input('kumas_durum', sql.NVarChar, m.kumas_durum || 'Belirtilmedi');
      request.input('kumas_hazir_tarih', sql.NVarChar, m.kumas_hazir_tarih || '');
      request.input('kumas_not', sql.NVarChar, m.kumas_not || '');
      request.input('sira_no', sql.Int, m.sira_no === null ? null : m.sira_no);
      request.input('created_at', sql.BigInt, Number(m.created_at));

      await request.query(`
        INSERT INTO dbo.models (
          grup, model_kodu, kategori, adet, termin, giren_kisi, durum, 
          numune_durum, numune_sebep, numune_cinsi, kumas_durum, kumas_hazir_tarih, kumas_not, sira_no, created_at
        ) VALUES (
          @grup, @model_kodu, @kategori, @adet, @termin, @giren_kisi, @durum,
          @numune_durum, @numune_sebep, @numune_cinsi, @kumas_durum, @kumas_hazir_tarih, @kumas_not, @sira_no, @created_at
        )
      `);
      inserted++;
    } catch (err) {
      console.error(`Failed to insert model ${m.model_kodu}:`, err);
    }
  }

  console.log(`Successfully inserted ${inserted} records into MSSQL.`);
  process.exit(0);
}

main().catch(console.error);
