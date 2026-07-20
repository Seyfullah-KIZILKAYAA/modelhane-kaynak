import type { Express } from "express";
import { z } from "zod";
import { getSettings, testConnection, closePool, friendlyError } from "./mssql";
import { ensureDatabase, ensureTables, getSetupStatus } from "./mssql-schema";
import { getConfig, updateConfig, configPath } from "./config";
import { requireAdmin, rateLimit } from "./auth";
import {
  listEntries,
  setPassword,
  checkLogin,
  isRecoveryPinSet,
  setRecoveryPin,
  verifyRecoveryPin,
  seedIfEmpty,
} from "./passwords";

const connectionSchema = z.object({
  server: z.string().min(1, "Sunucu adresi gerekli"),
  port: z.number().int().min(1).max(65535).default(1433),
  database: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,62}$/, "Geçersiz veritabanı adı"),
  user: z.string().min(1, "Kullanıcı adı gerekli"),
  // Boş bırakılırsa mevcut şifre korunur.
  password: z.string().default(""),
  instanceName: z.string().default(""),
  encrypt: z.boolean().default(false),
  trustServerCertificate: z.boolean().default(true),
});

export function registerDbRoutes(app: Express): void {
  // Bu bölümdeki tüm uçlar yönetici yetkisi ister — kurtarma uçları hariç
  // (onlar aşağıda ayrıca tanımlanır, çünkü giriş yapılamadığında kullanılır).

  // --- Bağlantı ayarları + durum (şifre asla döndürülmez) ---
  app.get("/api/db/status", requireAdmin, async (_req, res) => {
    const s = getSettings();
    const cfg = getConfig();

    const payload: any = {
      configPath: configPath(),
      settings: {
        server: s.server,
        port: s.port,
        database: s.database,
        user: s.user,
        instanceName: s.instanceName ?? "",
        encrypt: s.encrypt,
        trustServerCertificate: s.trustServerCertificate,
        configured: s.configured,
        passwordSet: Boolean(cfg.mssql.password),
      },
      recoveryPinSet: isRecoveryPinSet(),
    };

    if (!s.configured) {
      payload.connection = {
        ok: false,
        message: "SQL Server bağlantı bilgileri girilmemiş. Formu doldurup kaydedin.",
      };
      return res.json(payload);
    }

    payload.connection = await testConnection();
    if (payload.connection.ok) {
      try {
        payload.setup = await getSetupStatus();
      } catch {
        // Kurulum durumu okunamazsa bağlantı bilgisi yine de dönsün.
      }
    }
    res.json(payload);
  });

  // --- Bağlantı bilgilerini kaydet ---
  app.post("/api/db/connection", requireAdmin, async (req, res) => {
    const parsed = connectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: parsed.error.errors[0]?.message ?? "Geçersiz veri" });
    }
    const d = parsed.data;
    const current = getConfig();

    // Şifre alanı boşsa mevcut şifreyi koru (form onu göstermiyor).
    const password = d.password ? d.password : current.mssql.password;

    updateConfig({
      mssql: {
        server: d.server.trim(),
        port: d.port,
        database: d.database.trim(),
        user: d.user.trim(),
        password,
        instanceName: d.instanceName.trim(),
        encrypt: d.encrypt,
        trustServerCertificate: d.trustServerCertificate,
      },
    });

    // Yeni bilgilerle bağlanabilmek için eski havuzu kapat.
    await closePool();
    const test = await testConnection();
    res.json({ ok: true, message: "Bağlantı bilgileri kaydedildi.", connection: test });
  });

  // --- Bağlantıyı test et ---
  app.post("/api/db/test", requireAdmin, async (_req, res) => {
    await closePool();
    res.json(await testConnection());
  });

  // --- Veritabanını oluştur ---
  app.post("/api/db/setup/database", requireAdmin, async (_req, res) => {
    try {
      const r = await ensureDatabase();
      res.json({
        ok: true,
        message: r.created
          ? `"${r.name}" veritabanı oluşturuldu.`
          : `"${r.name}" veritabanı zaten mevcut.`,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: friendlyError(err) });
    }
  });

  // --- Tabloları oluştur ---
  app.post("/api/db/setup/tables", requireAdmin, async (_req, res) => {
    try {
      const r = await ensureTables();
      await seedIfEmpty();
      const created = [r.models ? "models" : null, r.passwords ? "app_passwords" : null].filter(Boolean);
      res.json({
        ok: true,
        message: created.length ? `Oluşturuldu: ${created.join(", ")}.` : "Tablolar zaten mevcut.",
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: friendlyError(err) });
    }
  });

  // ===================== ŞİFRE YÖNETİMİ =====================

  // --- Şifre listesi (hash döndürülmez) ---
  app.get("/api/passwords", requireAdmin, async (_req, res) => {
    try {
      res.json({ entries: await listEntries(), recoveryPinSet: isRecoveryPinSet() });
    } catch (err: any) {
      res.status(500).json({ error: friendlyError(err) });
    }
  });

  // --- Şifre değiştir ---
  app.post("/api/passwords/change", requireAdmin, async (req, res) => {
    const schema = z.object({
      key: z.string().min(1),
      newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalı"),
      // Yönetici şifresini değiştirirken mevcut şifre doğrulanır.
      currentPassword: z.string().default(""),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: parsed.error.errors[0]?.message ?? "Geçersiz veri" });
    }
    const { key, newPassword, currentPassword } = parsed.data;

    // Yönetici şifresi kritik: değiştirmek için mevcut şifre şart.
    if (key === "yonetici") {
      const check = await checkLogin(currentPassword);
      if (!check || check.role !== "yonetici") {
        return res.status(401).json({ ok: false, message: "Mevcut yönetici şifresi hatalı." });
      }
    }

    try {
      await setPassword(key, newPassword);
      res.json({ ok: true, message: "Şifre güncellendi." });
    } catch (err: any) {
      res.status(400).json({ ok: false, message: err?.message ?? String(err) });
    }
  });

  // --- Kurtarma PIN'i belirle / değiştir ---
  app.post("/api/passwords/recovery-pin", requireAdmin, async (req, res) => {
    const schema = z.object({
      pin: z.string().regex(/^\d{6,12}$/, "PIN 6-12 haneli rakam olmalı"),
      currentPassword: z.string().min(1, "Yönetici şifresi gerekli"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: parsed.error.errors[0]?.message ?? "Geçersiz veri" });
    }

    const check = await checkLogin(parsed.data.currentPassword);
    if (!check || check.role !== "yonetici") {
      return res.status(401).json({ ok: false, message: "Yönetici şifresi hatalı." });
    }

    setRecoveryPin(parsed.data.pin);
    res.json({ ok: true, message: "Kurtarma PIN'i kaydedildi. Güvenli bir yerde saklayın." });
  });

  // ===================== KURTARMA (giriş yapmadan) =====================
  // Bu uçlar yönetici şifresi unutulduğunda kullanılır, bu yüzden
  // requireAdmin YOKTUR. Kaba kuvvete karşı sıkı hız sınırı uygulanır.

  app.get("/api/recovery/status", (_req, res) => {
    res.json({ pinSet: isRecoveryPinSet() });
  });

  app.post(
    "/api/recovery/reset",
    rateLimit({ windowMs: 15 * 60_000, max: 5, message: "Çok fazla hatalı PIN denemesi." }),
    async (req, res) => {
      const schema = z.object({
        pin: z.string().min(1, "PIN gerekli"),
        newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalı"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0]?.message ?? "Geçersiz veri" });
      }

      if (!isRecoveryPinSet()) {
        return res.status(400).json({
          ok: false,
          message: "Kurtarma PIN'i tanımlanmamış. Yönetici ayarlar ekranından PIN belirlemelidir.",
        });
      }
      if (!verifyRecoveryPin(parsed.data.pin)) {
        return res.status(401).json({ ok: false, message: "PIN hatalı." });
      }

      try {
        await setPassword("yonetici", parsed.data.newPassword);
        res.json({ ok: true, message: "Yönetici şifresi sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz." });
      } catch (err: any) {
        res.status(400).json({ ok: false, message: err?.message ?? String(err) });
      }
    },
  );
}
