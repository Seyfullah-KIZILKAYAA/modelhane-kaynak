import "dotenv/config";
import { getPool } from "../server/mssql";
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
  
  console.log(`Found ${supabaseModels.length} models in Supabase.`);
  
  console.log("Connecting to MSSQL...");
  const pool = await getPool();
  const result = await pool.request().query("SELECT * FROM dbo.models");
  const mssqlModels = result.recordset;
  console.log(`Found ${mssqlModels.length} models in MSSQL.`);

  // Create a Set of created_at from MSSQL to find missing ones
  const mssqlCreatedAtSet = new Set(mssqlModels.map(m => m.created_at.toString()));
  
  const missingInMssql = supabaseModels.filter(sm => {
    return !mssqlCreatedAtSet.has(sm.created_at.toString());
  });

  console.log(`Found ${missingInMssql.length} models in Supabase that are NOT in MSSQL.`);
  
  if (missingInMssql.length > 0) {
    console.log("Sample of missing data:", JSON.stringify(missingInMssql.slice(0, 2), null, 2));
  }

  process.exit(0);
}

main().catch(console.error);
