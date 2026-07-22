import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import {
  Database,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Table2,
  ArrowRightLeft,
  ShieldCheck,
  Loader2,
  KeyRound,
  Save,
  Lock,
  Moon,
  Sun,
  Palette,
  Users,
  Trash2
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { UserPermissions, DEFAULT_PERMISSIONS } from "@shared/schema";

type DbProvider = "mssql" | "supabase";

const SAGLAYICI_ADI: Record<DbProvider, string> = {
  mssql: "SQL Server",
  supabase: "Supabase",
};

interface TransferOnizleme {
  kaynak: DbProvider;
  hedef: DbProvider;
  kaynakToplam: number;
  hedefToplam: number;
  aktarilacak: number;
  atlanacak: number;
  ornekler: Array<{ modelKodu: string; grup: string; termin: string; adet: number }>;
}

interface TransferSonuc extends TransferOnizleme {
  aktarilan: number;
  hatalar: Array<{ modelKodu: string; hata: string }>;
}

interface DbStatus {
  configPath: string;
  dbProvider: DbProvider;
  supabase: { url: string; configured: boolean; keySet: boolean };
  supabaseConnection: { ok: boolean; message: string; models?: number };
  settings: {
    server: string;
    port: number;
    database: string;
    user: string;
    instanceName: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
    configured: boolean;
    passwordSet: boolean;
  };
  recoveryPinSet: boolean;
  connection: { ok: boolean; message: string; version?: string; models?: number };
  setup?: { modelsTable: boolean; passwordsTable: boolean; modelCount: number | null };
}

interface PasswordEntry {
  key: string;
  label: string;
  role: string;
  grup: string | null;
  updatedAt: number | null;
  custom: boolean;
}

function TemaToggle() {
  const { isDark, setTheme } = useTheme();
  return (
    <Button variant="outline" onClick={() => setTheme(!isDark)}>
      {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
      {isDark ? "Açık Tema" : "Koyu Tema"}
    </Button>
  );
}

function Sonuc({ v }: { v: { ok: boolean; text: string } | null }) {
  if (!v) return null;
  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
        v.ok ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
      }`}
    >
      {v.ok ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
      )}
      <p className="break-words">{v.text}</p>
    </div>
  );
}

function Alan({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Ayarlar({ role = "yonetici" }: { role?: "yonetici" | "kullanici" }) {
  const isYonetici = role === "yonetici";
  const [activeTab, setActiveTab] = useState<"gorunum" | "veritabani" | "guvenlik">("gorunum");
  const [busy, setBusy] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, refetch } = useQuery<DbStatus>({
    queryKey: ["/api/db/status"],
    enabled: isYonetici,
  });
  const { data: pwData, refetch: refetchPw } = useQuery<{
    entries: PasswordEntry[];
    recoveryPinSet: boolean;
  }>({
    queryKey: ["/api/passwords"],
    enabled: isYonetici,
  });

  // --- Bağlantı formu ---
  const [form, setForm] = useState({
    server: "",
    port: 1433,
    database: "modelhane",
    user: "",
    password: "",
    instanceName: "",
  });

  // Sunucudan gelen ayarları forma doldur (şifre hariç — o hiç gönderilmez).
  useEffect(() => {
    if (data?.settings) {
      setForm({
        server: data.settings.server,
        port: data.settings.port,
        database: data.settings.database,
        user: data.settings.user,
        password: "",
        instanceName: data.settings.instanceName ?? "",
      });
    }
  }, [data?.settings?.server, data?.settings?.user, data?.settings?.database]);

  // --- Supabase bağlantı formu ---
  const [sbForm, setSbForm] = useState({ url: "", key: "" });

  useEffect(() => {
    if (data?.supabase) {
      setSbForm({ url: data.supabase.url ?? "", key: "" });
    }
  }, [data?.supabase?.url]);

  // --- Veri aktarımı ---
  const [transferKaynak, setTransferKaynak] = useState<DbProvider>("supabase");
  const [onizleme, setOnizleme] = useState<TransferOnizleme | null>(null);
  const [transferSonuc, setTransferSonuc] = useState<TransferSonuc | null>(null);
  const transferHedef: DbProvider = transferKaynak === "mssql" ? "supabase" : "mssql";

  // --- Şifre değiştirme formu ---
  const [pwForm, setPwForm] = useState({ key: "", yeni: "", yeniTekrar: "", mevcut: "" });
  const [pinForm, setPinForm] = useState({ pin: "", pinTekrar: "", mevcut: "" });

  async function calistir(ad: string, method: string, url: string, body?: any) {
    setBusy(ad);
    setSonuc(null);
    try {
      const res = await apiRequest(method, url, body);
      let r: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        r = await res.json();
      } else {
        r = { ok: true, message: "İşlem yapıldı." };
      }
      const ok = r.ok !== false;
      setSonuc({ ok, text: r.message ?? "Tamamlandı." });
      await Promise.all([refetch(), refetchPw()]);
      return { ok, r };
    } catch (err: any) {
      setSonuc({ ok: false, text: err?.message ?? String(err) });
      return { ok: false, r: null };
    } finally {
      setBusy(null);
    }
  }

  async function kaydetBaglanti() {
    if (!form.server.trim() || !form.user.trim()) {
      setSonuc({ ok: false, text: "Sunucu adresi ve kullanıcı adı zorunludur." });
      return;
    }
    if (!data?.settings.passwordSet && !form.password) {
      setSonuc({ ok: false, text: "İlk kayıtta şifre girmeniz gerekir." });
      return;
    }
    const { ok, r } = await calistir("kaydet", "POST", "/api/db/connection", {
      ...form,
      port: Number(form.port) || 1433,
      encrypt: false,
      trustServerCertificate: true,
    });
    if (ok) {
      setForm((f) => ({ ...f, password: "" }));
      const c = r?.connection;
      setSonuc({
        ok: Boolean(c?.ok),
        text: c?.ok ? "Bağlantı bilgileri kaydedildi ve bağlantı başarılı." : `Kaydedildi ancak bağlanılamadı: ${c?.message}`,
      });
    }
  }

  async function saglayiciSec(provider: DbProvider) {
    if (provider === data?.dbProvider) return;
    const { ok } = await calistir("provider", "POST", "/api/db/provider", { provider });
    if (ok) {
      // Model listesi yeni kaynaktan çekilsin.
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
    }
  }

  async function kaydetSupabase() {
    if (!sbForm.url.trim()) {
      setSonuc({ ok: false, text: "Supabase proje URL'i zorunludur." });
      return;
    }
    if (!data?.supabase?.keySet && !sbForm.key.trim()) {
      setSonuc({ ok: false, text: "İlk kayıtta Supabase anahtarı girmeniz gerekir." });
      return;
    }
    const { ok, r } = await calistir("sb-kaydet", "POST", "/api/db/supabase", {
      url: sbForm.url.trim(),
      key: sbForm.key.trim(),
    });
    if (ok) {
      setSbForm((f) => ({ ...f, key: "" }));
      const c = r?.connection;
      setSonuc({
        ok: Boolean(c?.ok),
        text: c?.ok
          ? `Supabase bağlantısı başarılı. ${c.models ?? 0} kayıt bulundu.`
          : `Kaydedildi ancak bağlanılamadı: ${c?.message}`,
      });
    }
  }

  async function transferOnizle() {
    setTransferSonuc(null);
    setOnizleme(null);
    const { ok, r } = await calistir("onizle", "POST", "/api/db/transfer/preview", {
      kaynak: transferKaynak,
      hedef: transferHedef,
    });
    if (ok && r?.onizleme) {
      const o: TransferOnizleme = r.onizleme;
      setOnizleme(o);
      setSonuc({
        ok: true,
        text: o.aktarilacak === 0
          ? `Aktarılacak yeni kayıt yok — ${SAGLAYICI_ADI[transferHedef]} zaten güncel.`
          : `${o.aktarilacak} kayıt aktarılacak, ${o.atlanacak} kayıt zaten mevcut olduğu için atlanacak.`,
      });
    }
  }

  async function transferCalistir() {
    const { ok, r } = await calistir("transfer", "POST", "/api/db/transfer/run", {
      kaynak: transferKaynak,
      hedef: transferHedef,
    });
    if (r?.sonuc) {
      setTransferSonuc(r.sonuc);
      setOnizleme(null);
    }
    if (ok) {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
    }
  }

  async function sifreDegistir() {
    if (!pwForm.key) return setSonuc({ ok: false, text: "Değiştirilecek şifreyi seçin." });
    if (pwForm.yeni.length < 6) return setSonuc({ ok: false, text: "Yeni şifre en az 6 karakter olmalı." });
    if (pwForm.yeni !== pwForm.yeniTekrar) return setSonuc({ ok: false, text: "Yeni şifreler eşleşmiyor." });
    if (pwForm.key === "yonetici" && !pwForm.mevcut)
      return setSonuc({ ok: false, text: "Yönetici şifresini değiştirmek için mevcut şifreyi girin." });

    const { ok } = await calistir("sifre", "POST", "/api/passwords/change", {
      key: pwForm.key,
      newPassword: pwForm.yeni,
      currentPassword: pwForm.mevcut,
    });
    if (ok) setPwForm({ key: "", yeni: "", yeniTekrar: "", mevcut: "" });
  }

  async function pinKaydet() {
    if (!/^\d{6,12}$/.test(pinForm.pin))
      return setSonuc({ ok: false, text: "PIN 6-12 haneli rakamlardan oluşmalı." });
    if (pinForm.pin !== pinForm.pinTekrar)
      return setSonuc({ ok: false, text: "PIN'ler eşleşmiyor." });
    if (!pinForm.mevcut) return setSonuc({ ok: false, text: "Yönetici şifrenizi girin." });

    const { ok } = await calistir("pin", "POST", "/api/passwords/recovery-pin", {
      pin: pinForm.pin,
      currentPassword: pinForm.mevcut,
    });
    if (ok) setPinForm({ pin: "", pinTekrar: "", mevcut: "" });
  }

  // Yönetici haricindeki grup kullanıcıları şimdilik sadece Görünüm (Tema Değiştirme) seçeneğini görür
  if (!isYonetici) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-transparent">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Görünüm Ayarları
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Koyu Tema (Dark Mode)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uygulama arayüzünün karanlık veya açık görünümünü değiştirir.
                </p>
              </div>
              <TemaToggle />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        Yükleniyor...
      </div>
    );
  }

  const s = data?.settings;
  const baglanti = data?.connection;
  const setup = data?.setup;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* Ayarlar Sekmeleri (Yönetici) */}
      <div className="flex bg-muted/50 p-1 rounded-lg gap-1">
        <button
          onClick={() => setActiveTab("gorunum")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === "gorunum" ? "bg-background shadow text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette className="w-4 h-4" /> Görünüm
        </button>
        <button
          onClick={() => setActiveTab("veritabani")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === "veritabani" ? "bg-background shadow text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Database className="w-4 h-4" /> Veritabanı
        </button>
        <button
          onClick={() => setActiveTab("guvenlik")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === "guvenlik" ? "bg-background shadow text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Güvenlik
        </button>
      </div>

      <div className="space-y-5">
      {activeTab === "gorunum" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="w-4 h-4" /> Görünüm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Koyu Tema (Dark Mode)</p>
                <p className="text-sm text-muted-foreground">
                  Uygulama arayüzünün karanlık veya açık olmasını sağlar.
                </p>
              </div>
              <TemaToggle />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "veritabani" && (
      <>
        {/* ── Veritabanı Seçimi ── */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Veritabanı Seç
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Uygulamanın verileri hangi kaynaktan okuyup yazacağını belirler.
              Değişiklik anında geçerli olur.
            </p>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {(["mssql", "supabase"] as DbProvider[]).map((p) => {
              const aktif = data?.dbProvider === p;
              const durum = p === "mssql" ? baglanti : data?.supabaseConnection;
              const kayit = p === "mssql" ? setup?.modelCount : data?.supabaseConnection?.models;
              return (
                <button
                  key={p}
                  onClick={() => saglayiciSec(p)}
                  disabled={busy !== null || aktif}
                  className={`text-left p-4 rounded-xl border-2 transition-all disabled:cursor-default ${
                    aktif
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-muted/40"
                  }`}
                  data-testid={`provider-${p}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold flex items-center gap-2">
                      {p === "mssql" ? <Server className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                      {SAGLAYICI_ADI[p]}
                    </span>
                    {aktif ? (
                      <Badge className="bg-primary text-primary-foreground text-[10px]">AKTİF</Badge>
                    ) : busy === "provider" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">seçmek için tıklayın</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {durum?.ok ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        <span className="text-muted-foreground">
                          Bağlı{typeof kayit === "number" ? ` — ${kayit} kayıt` : ""}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span className="text-muted-foreground">Bağlantı yok</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                    {p === "mssql"
                      ? "Yerel ağdaki sunucu — dışarıdan erişilemez."
                      : "Bulut — internet olan her yerden erişilir."}
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* ── Veri Aktarımı ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" /> Verileri Aktar
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Bir veritabanındaki kayıtları diğerine kopyalar. Hedefte zaten bulunan
              kayıtlar atlanır — aynı veri iki kez girilmez.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Yön seçimi */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[120px] p-3 rounded-lg border bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Kaynak</p>
                <p className="font-semibold text-sm">{SAGLAYICI_ADI[transferKaynak]}</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                title="Yönü ters çevir"
                onClick={() => {
                  setTransferKaynak(transferHedef);
                  setOnizleme(null);
                  setTransferSonuc(null);
                }}
                disabled={busy !== null}
                data-testid="transfer-yon-degistir"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-[120px] p-3 rounded-lg border bg-primary/5 border-primary/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Hedef</p>
                <p className="font-semibold text-sm">{SAGLAYICI_ADI[transferHedef]}</p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={transferOnizle} disabled={busy !== null} data-testid="transfer-onizle">
                {busy === "onizle" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Kontrol Et
              </Button>
              <Button
                onClick={transferCalistir}
                disabled={busy !== null || !onizleme || onizleme.aktarilacak === 0}
                data-testid="transfer-calistir"
              >
                {busy === "transfer" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                )}
                {onizleme ? `${onizleme.aktarilacak} Kaydı Aktar` : "Aktarımı Başlat"}
              </Button>
            </div>

            {!onizleme && !transferSonuc && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                Aktarımdan önce "Kontrol Et" ile ne aktarılacağını görün. Kontrol hiçbir
                veriyi değiştirmez.
              </p>
            )}

            {/* Önizleme sonucu */}
            {onizleme && (
              <div className="rounded-lg border p-3 space-y-2.5 bg-muted/20">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold tabular-nums">{onizleme.kaynakToplam}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kaynakta</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums">{onizleme.hedefToplam}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hedefte</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums text-emerald-600">{onizleme.aktarilacak}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Aktarılacak</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums text-muted-foreground">{onizleme.atlanacak}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Atlanacak</p>
                  </div>
                </div>

                {onizleme.ornekler.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium mb-1.5">
                      Aktarılacak kayıtlar
                      {onizleme.aktarilacak > onizleme.ornekler.length &&
                        ` (ilk ${onizleme.ornekler.length} tanesi)`}
                      :
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {onizleme.ornekler.map((o, i) => (
                        <div key={i} className="text-xs flex items-center gap-2 py-0.5">
                          <span className="font-medium">{o.modelKodu}</span>
                          <span className="text-muted-foreground">
                            {o.grup} · {o.adet} adet · {o.termin}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aktarım sonucu */}
            {transferSonuc && (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  {transferSonuc.aktarilan} kayıt {SAGLAYICI_ADI[transferSonuc.hedef]}'a aktarıldı
                </p>
                <p className="text-xs text-muted-foreground">
                  {transferSonuc.atlanacak} kayıt hedefte zaten mevcut olduğu için atlandı.
                </p>
                {transferSonuc.hatalar.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-red-600 mb-1">
                      {transferSonuc.hatalar.length} kayıt aktarılamadı:
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {transferSonuc.hatalar.map((h, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground">
                          <span className="font-medium">{h.modelKodu}</span> — {h.hata}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Supabase Bağlantısı ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Supabase Bağlantısı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Alan label="Proje URL'i" hint="Supabase panelinde Project Settings → API bölümünde">
                <Input
                  value={sbForm.url}
                  onChange={(e) => setSbForm({ ...sbForm, url: e.target.value })}
                  placeholder="https://xxxxx.supabase.co"
                  data-testid="input-supabase-url"
                />
              </Alan>
              <Alan
                label="Servis Anahtarı (service_role)"
                hint={data?.supabase?.keySet ? "Değiştirmeyecekseniz boş bırakın" : "Zorunlu — bu anahtar tarayıcıya gönderilmez"}
              >
                <Input
                  type="password"
                  value={sbForm.key}
                  onChange={(e) => setSbForm({ ...sbForm, key: e.target.value })}
                  placeholder={data?.supabase?.keySet ? "•••••••• (kayıtlı)" : "eyJhbGci..."}
                  data-testid="input-supabase-key"
                />
              </Alan>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={kaydetSupabase} disabled={busy !== null}>
                {busy === "sb-kaydet" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                Kaydet ve Bağlan
              </Button>
              <Button
                variant="outline"
                onClick={() => calistir("sb-test", "POST", "/api/db/supabase/test")}
                disabled={busy !== null || !data?.supabase?.configured}
              >
                {busy === "sb-test" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Bağlantıyı Test Et
              </Button>
            </div>

            {data?.supabaseConnection && (
              <div
                className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
                  data.supabaseConnection.ok
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/30"
                }`}
              >
                {data.supabaseConnection.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="font-medium">
                    {data.supabaseConnection.ok ? "Bağlantı başarılı" : "Bağlanamadı"}
                  </p>
                  <p className="text-muted-foreground break-words mt-0.5">
                    {data.supabaseConnection.message}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Bağlantı formu */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4" /> SQL Server Bağlantısı
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <Alan label="Sunucu adresi" hint="Örn. 192.168.1.50 veya SUNUCU-ADI">
              <Input
                value={form.server}
                onChange={(e) => setForm({ ...form, server: e.target.value })}
                placeholder="192.168.1.50"
              />
            </Alan>
            <Alan label="Port">
              <Input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
              />
            </Alan>
            <Alan label="Veritabanı adı">
              <Input
                value={form.database}
                onChange={(e) => setForm({ ...form, database: e.target.value })}
              />
            </Alan>
            <Alan label="Instance" hint="Örn. SQLEXPRESS — yoksa boş bırakın">
              <Input
                value={form.instanceName}
                onChange={(e) => setForm({ ...form, instanceName: e.target.value })}
                placeholder="(boş)"
              />
            </Alan>
            <Alan label="Kullanıcı adı">
              <Input
                value={form.user}
                onChange={(e) => setForm({ ...form, user: e.target.value })}
                placeholder="sa"
              />
            </Alan>
            <Alan
              label="Şifre"
              hint={s?.passwordSet ? "Değiştirmeyecekseniz boş bırakın" : "Zorunlu"}
            >
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={s?.passwordSet ? "•••••••• (kayıtlı)" : "Şifre girin"}
              />
            </Alan>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={kaydetBaglanti} disabled={busy !== null}>
              {busy === "kaydet" ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Kaydet ve Bağlan
            </Button>
            <Button
              variant="outline"
              onClick={() => calistir("test", "POST", "/api/db/test")}
              disabled={busy !== null || !s?.configured}
            >
              {busy === "test" ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Bağlantıyı Test Et
            </Button>
          </div>

          {baglanti && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
                baglanti.ok ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
              }`}
            >
              {baglanti.ok ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="font-medium">{baglanti.ok ? "Bağlantı başarılı" : "Bağlanamadı"}</p>
                <p className="text-muted-foreground break-words mt-0.5">{baglanti.message}</p>
                {baglanti.version && (
                  <p className="text-xs text-muted-foreground mt-1">{baglanti.version}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kurulum adımları */}
      {s?.configured && baglanti?.ok && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Table2 className="w-4 h-4" /> Kurulum
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">Veritabanını Oluştur</p>
                <p className="text-xs text-muted-foreground">"{s.database}" veritabanını açar.</p>
              </div>
              <Button size="sm" variant="outline" disabled={busy !== null}
                onClick={() => calistir("db", "POST", "/api/db/setup/database")}>
                {busy === "db" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Oluştur"}
              </Button>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">Tabloları Oluştur</p>
                <p className="text-xs text-muted-foreground">
                  {setup?.modelsTable && setup?.passwordsTable ? "Tablolar hazır." : "models ve app_passwords."}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={busy !== null}
                onClick={() => calistir("tables", "POST", "/api/db/setup/tables")}>
                {busy === "tables" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Oluştur"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      </>
      )}

      {activeTab === "guvenlik" && (
      <>
        {/* Şifre yönetimi */}
        <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Şifre Yönetimi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!setup?.passwordsTable ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Şifreleri değiştirmek için SQL Server bağlantısı kurulu ve tablolar oluşturulmuş
                olmalıdır. Şu an varsayılan şifreler geçerli.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                {pwData?.entries.map((e) => (
                  <div key={e.key} className="flex items-center justify-between py-1.5 text-sm border-b last:border-b-0">
                    <div>
                      <span className="font-medium">{e.label}</span>
                      {e.role === "yonetici" && (
                        <Badge variant="secondary" className="ml-2 text-xs">yönetici</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {e.custom ? "değiştirilmiş" : "varsayılan şifre"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 space-y-3">
                <Alan label="Şifresi değiştirilecek grup">
                  <select
                    className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={pwForm.key}
                    onChange={(e) => setPwForm({ ...pwForm, key: e.target.value })}
                  >
                    <option value="">Seçin...</option>
                    {pwData?.entries.map((e) => (
                      <option key={e.key} value={e.key}>{e.label}</option>
                    ))}
                  </select>
                </Alan>

                {pwForm.key === "yonetici" && (
                  <Alan label="Mevcut yönetici şifresi">
                    <Input
                      type="password"
                      value={pwForm.mevcut}
                      onChange={(e) => setPwForm({ ...pwForm, mevcut: e.target.value })}
                    />
                  </Alan>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <Alan label="Yeni şifre" hint="En az 6 karakter">
                    <Input
                      type="password"
                      value={pwForm.yeni}
                      onChange={(e) => setPwForm({ ...pwForm, yeni: e.target.value })}
                    />
                  </Alan>
                  <Alan label="Yeni şifre (tekrar)">
                    <Input
                      type="password"
                      value={pwForm.yeniTekrar}
                      onChange={(e) => setPwForm({ ...pwForm, yeniTekrar: e.target.value })}
                    />
                  </Alan>
                </div>

                <Button onClick={sifreDegistir} disabled={busy !== null || !pwForm.key}>
                  {busy === "sifre" ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Şifreyi Değiştir
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Kurtarma PIN'i */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Kurtarma PIN'i
            {data?.recoveryPinSet && (
              <Badge variant="secondary" className="ml-1">tanımlı</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Yönetici şifresi unutulursa, giriş ekranındaki "Şifremi unuttum" bağlantısından bu PIN
            ile yeni şifre belirlenebilir. PIN'i güvenli bir yerde saklayın.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <Alan label="PIN" hint="6-12 haneli rakam">
              <Input
                type="password"
                inputMode="numeric"
                value={pinForm.pin}
                onChange={(e) => setPinForm({ ...pinForm, pin: e.target.value })}
              />
            </Alan>
            <Alan label="PIN (tekrar)">
              <Input
                type="password"
                inputMode="numeric"
                value={pinForm.pinTekrar}
                onChange={(e) => setPinForm({ ...pinForm, pinTekrar: e.target.value })}
              />
            </Alan>
          </div>
          <Alan label="Yönetici şifreniz">
            <Input
              type="password"
              value={pinForm.mevcut}
              onChange={(e) => setPinForm({ ...pinForm, mevcut: e.target.value })}
            />
          </Alan>
          <Button onClick={pinKaydet} disabled={busy !== null}>
            {busy === "pin" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            {data?.recoveryPinSet ? "PIN'i Değiştir" : "PIN Belirle"}
          </Button>
          </CardContent>
        </Card>
      </>
      )}
      </div>

      <Sonuc v={sonuc} />

      {data?.configPath && (
        <p className="text-xs text-muted-foreground break-all">
          Ayar dosyası: {data.configPath}
        </p>
      )}
    </div>
  );
}
