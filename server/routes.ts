import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from "./storage";
import { registerDbRoutes } from "./routes-db";
import { setupSession, requireAuth, requireAdmin, rateLimit } from "./auth";
import { checkLogin } from "./passwords";
import { insertModelSchema, updateStatusSchema, updateSiraSchema, updateNumuneSchema, updateNumuneCinsiSchema, updateKumasSchema, loginSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Oturum altyapısı — diğer tüm uçlardan önce kurulmalı.
  setupSession(app);

  // Veritabanı bağlantısı / kurulum / aktarım / şifre yönetimi uçları
  registerDbRoutes(app);

  // --- Giriş: şifreye göre rol döner ve oturum açar ---
  app.post(
    "/api/login",
    rateLimit({ windowMs: 5 * 60_000, max: 10, message: "Çok fazla hatalı deneme." }),
    async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Geçersiz istek" });

      const found = await checkLogin(parsed.data.password);
      if (!found) return res.status(401).json({ error: "Şifre hatalı" });

      // Oturum sabitleme (session fixation) saldırısına karşı kimliği yenile.
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: "Oturum açılamadı" });
        req.session.role = found.role;
        req.session.grup = found.grup;
        req.session.key = found.key;
        req.session.save(() => res.json({ role: found.role, grup: found.grup }));
      });
    },
  );

  // --- Oturumu kapat ---
  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // --- Mevcut oturum bilgisi (sayfa yenilendiğinde kullanılır) ---
  app.get("/api/me", (req, res) => {
    if (!req.session?.role) return res.status(401).json({ error: "Oturum yok" });
    res.json({ role: req.session.role, grup: req.session.grup ?? null });
  });

  // Bundan sonraki tüm model uçları giriş yapılmasını gerektirir.
  app.use("/api/models", requireAuth);

  // --- Modelleri listele ---
  app.get("/api/models", async (_req, res) => {
    const list = await storage.getModels();
    res.json(list);
  });

  // --- Yeni model ekle ---
  app.post("/api/models", async (req, res) => {
    const parsed = insertModelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Geçersiz veri" });
    }
    const created = await storage.createModel(parsed.data);
    res.status(201).json(created);
  });

  // --- Durum güncelle ---
  app.patch("/api/models/:id/status", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Geçersiz durum" });
    const updated = await storage.updateStatus(id, parsed.data.durum);
    if (!updated) return res.status(404).json({ error: "Model bulunamadı" });
    res.json(updated);
  });

  // --- Üretim sırası güncelle (yönetici) ---
  app.patch("/api/models/:id/sira", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateSiraSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Geçersiz sıra" });
    const updated = await storage.updateSira(id, parsed.data.siraNo);
    if (!updated) return res.status(404).json({ error: "Model bulunamadı" });
    res.json(updated);
  });

  // --- Numune durumu güncelle ---
  app.patch("/api/models/:id/numune", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateNumuneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Geçersiz numune verisi" });
    const updated = await storage.updateNumune(id, parsed.data.numuneDurum, parsed.data.numuneSebep);
    if (!updated) return res.status(404).json({ error: "Model bulunamadı" });
    res.json(updated);
  });

  // --- Numune cinsi güncelle ---
  app.patch("/api/models/:id/numune-cinsi", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateNumuneCinsiSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Geçersiz numune cinsi" });
    const updated = await storage.updateNumuneCinsi(id, parsed.data.numuneCinsi);
    if (!updated) return res.status(404).json({ error: "Model bulunamadı" });
    res.json(updated);
  });

  // --- Kumaş durumu güncelle ---
  app.patch("/api/models/:id/kumas", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateKumasSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Geçersiz kumaş verisi" });
    const updated = await storage.updateKumas(id, parsed.data.kumasDurum, parsed.data.kumasHazirTarih, parsed.data.kumasNot);
    if (!updated) return res.status(404).json({ error: "Model bulunamadı" });
    res.json(updated);
  });

  // --- Model sil (yönetici) ---
  app.delete("/api/models/:id", requireAdmin, async (req, res) => {
    const ok = await storage.deleteModel(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: "Model bulunamadı" });
    res.json({ success: true });
  });

  return httpServer;
}
