import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { getConfig } from "./config";

/**
 * Oturum yönetimi ve API koruması.
 *
 * Önceden hiçbir /api/* ucu korumalı değildi — adresi bilen herkes veri
 * değiştirebiliyordu. Artık giriş yapılınca sunucu tarafında oturum açılır
 * ve uçlar role göre korunur.
 */

declare module "express-session" {
  interface SessionData {
    role?: "kullanici" | "yonetici";
    grup?: string | null;
    key?: string;
  }
}

const MemoryStore = createMemoryStore(session);

export function setupSession(app: Express): void {
  app.set("trust proxy", 1);
  app.use(
    session({
      secret: getConfig().sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 86_400_000 }), // günlük temizlik
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // Yerel ağda HTTP kullanıldığı için secure kapalı.
        secure: false,
        maxAge: 12 * 60 * 60 * 1000, // 12 saat
      },
    }),
  );
}

/** Giriş yapmış olmayı zorunlu kılar. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.role) {
    return res.status(401).json({ error: "Oturum açmanız gerekiyor." });
  }
  next();
}

/** Yönetici rolünü zorunlu kılar. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.role) {
    return res.status(401).json({ error: "Oturum açmanız gerekiyor." });
  }
  if (req.session.role !== "yonetici") {
    return res.status(403).json({ error: "Bu işlem için yönetici yetkisi gerekiyor." });
  }
  next();
}

/**
 * Kaba kuvvet denemelerine karşı basit hız sınırlayıcı.
 * IP başına pencere içinde sınırlı deneme hakkı verir.
 */
export function rateLimit(opts: { windowMs: number; max: number; message: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip ?? "bilinmeyen";
    const rec = hits.get(ip);

    if (!rec || now > rec.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    rec.count++;
    if (rec.count > opts.max) {
      const kalan = Math.ceil((rec.resetAt - now) / 1000);
      return res.status(429).json({ error: `${opts.message} (${kalan} saniye sonra tekrar deneyin)` });
    }

    // Biriken kayıtları ara sıra temizle.
    if (hits.size > 500) {
      hits.forEach((v, k) => {
        if (now > v.resetAt) hits.delete(k);
      });
    }

    next();
  };
}
