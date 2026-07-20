import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

interface DbStatus {
  configPath: string;
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

export default function Ayarlar() {
  const [busy, setBusy] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, refetch } = useQuery<DbStatus>({ queryKey: ["/api/db/status"] });
  const { data: pwData, refetch: refetchPw } = useQuery<{
    entries: PasswordEntry[];
    recoveryPinSet: boolean;
  }>({ queryKey: ["/api/passwords"] });

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
  }, [data?.settings.server, data?.settings.user, data?.settings.database]);

  // --- Şifre değiştirme formu ---
  const [pwForm, setPwForm] = useState({ key: "", yeni: "", yeniTekrar: "", mevcut: "" });
  const [pinForm, setPinForm] = useState({ pin: "", pinTekrar: "", mevcut: "" });

  async function calistir(ad: string, method: string, url: string, body?: any) {
    setBusy(ad);
    setSonuc(null);
    try {
      const res = await apiRequest(method, url, body);
      const r = await res.json();
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
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Veritabanı özeti */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">SQL Server</p>
              <Badge variant={baglanti?.ok ? "default" : "secondary"}>
                {baglanti?.ok ? "bağlı" : "bağlı değil"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {baglanti?.ok
                ? `${s?.server}:${s?.port} — "${s?.database}" veritabanında ${setup?.modelCount ?? 0} kayıt.`
                : "Aşağıdaki formdan bağlantı bilgilerini girin."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bağlantı formu */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4" /> Veritabanı Bağlantısı
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

      <Sonuc v={sonuc} />

      {data?.configPath && (
        <p className="text-xs text-muted-foreground break-all">
          Ayar dosyası: {data.configPath}
        </p>
      )}
    </div>
  );
}
