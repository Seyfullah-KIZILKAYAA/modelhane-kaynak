import { z } from "zod";

// Sabit gruplar ve kategoriler
export const GROUPS = [
  "Grimelange",
  "Ethiquet",
  "Urban Beat",
  "İhracat",
] as const;

// Numune durumu
export const NUMUNE_DURUMLARI = ["Bekliyor", "Numune Onaylandı", "Numune Reddedildi"] as const;

// Numune cinsi
export const NUMUNE_CINSLERI = [
  "Belirtilmedi",
  "Fit Numune",
  "PPS Numune",
  "Çekim Numunesi",
  "Beden Seti",
  "Gold Seal",
  "Salt / Yıkama Numunesi",
  "Onay Numunesi",
  "Satış Numunesi",
  "Test Numunesi",
  "Koleksiyon Numunesi",
  "Diğer",
] as const;

// Kumaş aşaması
export const KUMAS_ASAMALARI = [
  "Belirtilmedi",
  "Sipariş Verildi",
  "Boyahanede",
  "Konfeksiyon Rafta",
  "Hazır",
] as const;

export const CATEGORIES = [
  "Sweatshirt",
  "T-shirt",
  "Hoodie / Kapüşonlu",
  "Eşofman Altı",
  "Şort",
  "Polo Yaka",
  "Elbise",
  "Etek",
  "Ceket",
  "Yelek",
  "Body / Zıbın",
  "Alt Üst Takım",
  "Diğer",
] as const;

export const STATUSES = ["Beklemede", "Dikimde", "Tamamlandı"] as const;

// Model tipi (SQL Server dbo.models tablosu ile eşleşir)
export interface Model {
  id: number;
  grup: string;
  modelKodu: string;
  kategori: string;
  adet: number;
  termin: string; // ISO tarih YYYY-MM-DD
  girenKisi: string;
  durum: string;
  numuneDurum: string; // Bekliyor / Numune Onaylandı / Numune Reddedildi
  numuneSebep: string; // Reddedildi sebebi
  numuneCinsi: string; // Fit / PPS / Çekim / Beden Seti / Gold Seal ...
  kumasDurum: string; // Sipariş / Boyahanede / Konfeksiyon Rafta / Hazır
  kumasHazirTarih: string; // ISO tarih YYYY-MM-DD
  kumasNot: string; // serbest not
  siraNo: number | null; // yönetici üretim sırası (null = atanmadı)
  createdAt: number;
}

// Yeni model ekleme şeması (kullanıcının girdiği alanlar)
export const insertModelSchema = z.object({
  grup: z.enum(GROUPS),
  kategori: z.enum(CATEGORIES),
  adet: z.number().int().positive("Adet 0'dan büyük olmalı"),
  termin: z.string().min(1, "Termin tarihi gerekli"),
  modelKodu: z.string().min(1, "Model kodu gerekli"),
  girenKisi: z.string().min(1, "Giren kişi gerekli"),
  numuneCinsi: z.enum(NUMUNE_CINSLERI).default("Belirtilmedi"),
  kumasDurum: z.enum(KUMAS_ASAMALARI).default("Belirtilmedi"),
  kumasHazirTarih: z.string().default(""),
  kumasNot: z.string().default(""),
});

export type InsertModel = z.infer<typeof insertModelSchema>;

// Güncelleme şemaları
export const updateStatusSchema = z.object({
  durum: z.enum(STATUSES),
});

export const updateSiraSchema = z.object({
  siraNo: z.number().int().nullable(),
});

export const updateNumuneSchema = z.object({
  numuneDurum: z.enum(NUMUNE_DURUMLARI),
  numuneSebep: z.string().default(""),
});

export const updateNumuneCinsiSchema = z.object({
  numuneCinsi: z.enum(NUMUNE_CINSLERI),
});

export const updateKumasSchema = z.object({
  kumasDurum: z.enum(KUMAS_ASAMALARI),
  kumasHazirTarih: z.string().default(""),
  kumasNot: z.string().default(""),
});

export const updateModelSchema = z.object({
  grup: z.string().min(1),
  kategori: z.string().min(1),
  adet: z.number().int().positive(),
  termin: z.string().min(1),
  modelKodu: z.string().min(1),
  girenKisi: z.string().min(1),
  durum: z.enum(STATUSES),
  numuneCinsi: z.enum(NUMUNE_CINSLERI),
  numuneDurum: z.enum(NUMUNE_DURUMLARI),
  numuneSebep: z.string().default(""),
  kumasDurum: z.enum(KUMAS_ASAMALARI),
  kumasHazirTarih: z.string().default(""),
  kumasNot: z.string().default(""),
});
export type UpdateModel = z.infer<typeof updateModelSchema>;

// --- Kimlik (basit rol tabanlı şifre) ---
export const loginSchema = z.object({
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// --- Kullanıcı Ayar & Sayfa Yetkileri ---
export interface UserPermissions {
  userCanAccessTheme: boolean;
  userCanAccessDb: boolean;
  userCanAccessSecurity: boolean;
  userCanDeleteModels: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  userCanAccessTheme: true,
  userCanAccessDb: false,
  userCanAccessSecurity: false,
  userCanDeleteModels: false,
};

export const updatePermissionsSchema = z.object({
  userCanAccessTheme: z.boolean().default(true),
  userCanAccessDb: z.boolean().default(false),
  userCanAccessSecurity: z.boolean().default(false),
  userCanDeleteModels: z.boolean().default(false),
});

