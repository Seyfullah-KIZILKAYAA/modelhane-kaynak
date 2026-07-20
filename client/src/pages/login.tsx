import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Scissors, Lock, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";

type Role = "kullanici" | "yonetici";

export default function Login({ onLogin }: { onLogin: (role: Role, grup: string | null) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Şifre kurtarma ekranı
  const [kurtarma, setKurtarma] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/login", { password });
      const data = await res.json();
      onLogin(data.role as Role, data.grup ?? null);
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      // Hız sınırı mesajını olduğu gibi göster, diğerlerinde genel mesaj ver.
      setError(msg.includes("429") ? msg.replace(/^\d+:\s*/, "") : "Şifre hatalı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Scissors className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl font-bold">Modelhane Planlama</CardTitle>
          <p className="text-sm text-muted-foreground">
            Termin esaslı model girişi ve üretim planlama sistemi
          </p>
        </CardHeader>

        <CardContent>
          {kurtarma ? (
            <Kurtarma onGeri={() => setKurtarma(false)} />
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Giriş Şifresi
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Şifrenizi girin"
                    data-testid="input-password"
                    autoFocus
                  />
                  {error && (
                    <p className="text-sm text-red-600 dark:text-red-400" data-testid="text-error">
                      {error}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !password}
                  data-testid="button-login"
                >
                  {loading ? "Kontrol ediliyor..." : "Giriş Yap"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setKurtarma(true)}
                className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                data-testid="link-forgot"
              >
                Şifremi unuttum
              </button>

              <div className="mt-6 pt-4 border-t text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Her grubun kendi şifresi vardır:</p>
                <p>• Grimelange • Ethiquet • Urban Beat • İhracat</p>
                <p>• Ana Yönetici → planlama + tüm kontroller</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Kurtarma PIN'i ile yönetici şifresini sıfırlama. */
function Kurtarma({ onGeri }: { onGeri: () => void }) {
  const [pin, setPin] = useState("");
  const [yeni, setYeni] = useState("");
  const [yeniTekrar, setYeniTekrar] = useState("");
  const [mesaj, setMesaj] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function sifirla(e: React.FormEvent) {
    e.preventDefault();
    setMesaj(null);

    if (yeni.length < 6) return setMesaj({ ok: false, text: "Yeni şifre en az 6 karakter olmalı." });
    if (yeni !== yeniTekrar) return setMesaj({ ok: false, text: "Şifreler eşleşmiyor." });

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/recovery/reset", { pin, newPassword: yeni });
      const r = await res.json();
      setMesaj({ ok: true, text: r.message ?? "Şifre sıfırlandı." });
      setPin("");
      setYeni("");
      setYeniTekrar("");
    } catch (err: any) {
      setMesaj({ ok: false, text: String(err?.message ?? "").replace(/^\d+:\s*/, "") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pt-2 space-y-4">
      <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-2">
        <p className="font-medium flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" /> Yönetici şifresi sıfırlama
        </p>
        <p className="text-muted-foreground text-xs">
          Yalnızca <strong>yönetici</strong> şifresi sıfırlanabilir ve bunun için kurtarma PIN'i
          gerekir. Grup şifrenizi unuttuysanız yöneticinize başvurun — ayarlar ekranından
          değiştirebilir.
        </p>
      </div>

      <form onSubmit={sifirla} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Kurtarma PIN'i</label>
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="6-12 haneli PIN"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Yeni yönetici şifresi</label>
          <Input type="password" value={yeni} onChange={(e) => setYeni(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Yeni şifre (tekrar)</label>
          <Input type="password" value={yeniTekrar} onChange={(e) => setYeniTekrar(e.target.value)} />
        </div>

        {mesaj && (
          <div
            className={`flex items-start gap-2 p-2.5 rounded-lg text-sm border ${
              mesaj.ok ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
            }`}
          >
            {mesaj.ok && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
            <p className="break-words">{mesaj.text}</p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading || !pin || !yeni}>
          {loading ? "Sıfırlanıyor..." : "Şifreyi Sıfırla"}
        </Button>
      </form>

      <button
        type="button"
        onClick={onGeri}
        className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Giriş ekranına dön
      </button>
    </div>
  );
}
