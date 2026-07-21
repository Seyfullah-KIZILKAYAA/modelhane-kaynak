import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Model } from "@shared/schema";
import { GROUPS } from "@shared/schema";
import { kalanGun, trTarih, kumasRenk, durumRenk } from "@/lib/helpers";
import {
  Package, Clock, Scissors, CheckCircle2, AlertTriangle, Boxes,
  XCircle, FlaskConical, Layers, CalendarDays, Users,
} from "lucide-react";

/* ─── KPI Kartı ─── */
function Kpi({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums leading-tight" data-testid={`kpi-${label}`}>{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Panel() {
  const { data: models = [] } = useQuery<Model[]>({ queryKey: ["/api/models"] });

  // ── Temel metrikler ──
  const toplam = models.length;
  const beklemede = models.filter((m) => m.durum === "Beklemede").length;
  const dikimde = models.filter((m) => m.durum === "Dikimde").length;
  const tamamlandi = models.filter((m) => m.durum === "Tamamlandı").length;
  const toplamAdet = models.reduce((s, m) => s + m.adet, 0);
  const geciken = models.filter((m) => {
    const g = kalanGun(m.termin);
    return g !== null && g < 0 && m.durum !== "Tamamlandı";
  }).length;

  // ── Numune özeti ──
  const numuneOk = models.filter((m) => m.numuneDurum === "Numune OK").length;
  const numuneNotOk = models.filter((m) => m.numuneDurum === "Numune NOT OK");
  const numuneBekliyor = models.filter((m) => m.numuneDurum === "Bekliyor").length;

  // ── Kumaş özeti (aktif modeller) ──
  const aktifModeller = models.filter((m) => m.durum !== "Tamamlandı");
  const kumasHazir = aktifModeller.filter((m) => m.kumasDurum === "Hazır").length;
  const kumasYolda = aktifModeller.filter((m) =>
    m.kumasDurum === "Boyahanede" || m.kumasDurum === "Konfeksiyon Rafta" || m.kumasDurum === "Sipariş Verildi"
  ).length;
  const kumasBekleyen = aktifModeller
    .filter((m) => m.kumasDurum !== "Hazır" && m.kumasDurum !== "Belirtilmedi")
    .sort((a, b) => {
      if (a.kumasHazirTarih && b.kumasHazirTarih) return a.kumasHazirTarih < b.kumasHazirTarih ? -1 : 1;
      if (a.kumasHazirTarih) return -1;
      if (b.kumasHazirTarih) return 1;
      return 0;
    });

  // ── Grup özeti ──
  const gruplar = GROUPS.map((g) => {
    const arr = models.filter((m) => m.grup === g);
    return {
      ad: g,
      sayi: arr.length,
      adet: arr.reduce((s, m) => s + m.adet, 0),
      tamam: arr.filter((m) => m.durum === "Tamamlandı").length,
    };
  });

  // ── Yaklaşan terminler (en yakın 5) ──
  const yaklasan = [...models]
    .filter((m) => m.durum !== "Tamamlandı" && m.termin)
    .sort((a, b) => (a.termin < b.termin ? -1 : 1))
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

      {/* ───── Üretim Durumu KPI ───── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Üretim Durumu
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Toplam Model" value={toplam} icon={Package} color="bg-primary/15 text-primary" />
          <Kpi label="Beklemede" value={beklemede} icon={Clock} color="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" />
          <Kpi label="Dikimde" value={dikimde} icon={Scissors} color="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" />
          <Kpi label="Tamamlandı" value={tamamlandi} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" />
          <Kpi label="Toplam Adet" value={toplamAdet.toLocaleString("tr-TR")} icon={Boxes} color="bg-primary/15 text-primary" />
          <Kpi label="Geciken" value={geciken} icon={AlertTriangle} color="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" />
        </div>
      </div>

      {/* ───── Numune & Kumaş KPI ───── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" /> Numune & Kumaş Özeti
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi label="Numune OK" value={numuneOk} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" />
          <Kpi label="Numune STOP" value={numuneNotOk.length} icon={XCircle} color="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" />
          <Kpi label="Numune Bekliyor" value={numuneBekliyor} icon={FlaskConical} color="bg-muted text-muted-foreground" />
          <Kpi label="Kumaş Hazır" value={kumasHazir} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" />
          <Kpi label="Kumaş Beklenen" value={kumasYolda} icon={Layers} color="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" />
        </div>
      </div>

      {/* ───── Gruplara Göre Dağılım + Yaklaşan Terminler yan yana ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Grup Dağılımı */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/8 to-transparent pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Gruplara Göre
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Grup</th>
                  <th className="py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Model</th>
                  <th className="py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Adet</th>
                  <th className="py-2.5 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Tamam</th>
                </tr>
              </thead>
              <tbody>
                {gruplar.map((g, i) => (
                  <tr key={g.ad} className={`border-b transition-colors hover:bg-primary/5 ${i % 2 !== 0 ? "bg-muted/20" : ""}`} data-testid={`row-grup-${g.ad}`}>
                    <td className="py-2.5 px-4 font-medium">{g.ad}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{g.sayi}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{g.adet.toLocaleString("tr-TR")}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span className="text-green-700 dark:text-green-400">{g.tamam}</span>
                      <span className="text-muted-foreground">/{g.sayi}</span>
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold bg-muted/40">
                  <td className="py-2.5 px-4">TOPLAM</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{toplam}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{toplamAdet.toLocaleString("tr-TR")}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">
                    <span className="text-green-700 dark:text-green-400">{tamamlandi}</span>
                    <span className="text-muted-foreground">/{toplam}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Yaklaşan Terminler */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/8 to-transparent pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> En Yakın Terminler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {yaklasan.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aktif model yok.</p>
            ) : (
              <div className="space-y-2.5">
                {yaklasan.map((m) => {
                  const g = kalanGun(m.termin);
                  return (
                    <div key={m.id} className="flex items-center justify-between text-sm border-b pb-2.5 last:border-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold">{m.modelKodu}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{m.kategori}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{m.grup}</Badge>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${durumRenk(m.durum)}`}>{m.durum}</Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="tabular-nums font-medium">{trTarih(m.termin)}</div>
                        <div className={`text-xs ${g !== null && g < 0 ? "text-red-600 dark:text-red-400 font-semibold" : g !== null && g <= 7 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
                          {g === null ? "" : g < 0 ? `${Math.abs(g)} gün geçti` : g === 0 ? "Bugün" : `${g} gün kaldı`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ───── Kumaşı Beklenen + STOP Modeller yan yana ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Kumaşı Beklenen */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500/8 to-transparent pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Kumaşı Beklenen
              <Badge variant="secondary" className="text-xs ml-1">{kumasBekleyen.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kumasBekleyen.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Tüm aktif modellerin kumaşı hazır veya bilgi girilmedi.</p>
            ) : (
              <div className="space-y-2.5">
                {kumasBekleyen.map((m) => (
                  <div key={m.id} className="flex items-start justify-between text-sm border-b pb-2.5 last:border-0 last:pb-0 gap-3" data-testid={`row-kumas-${m.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{m.modelKodu}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${kumasRenk(m.kumasDurum)}`}>{m.kumasDurum}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.grup}</p>
                      {m.kumasNot && <p className="text-xs text-muted-foreground/80 mt-0.5 italic">{m.kumasNot}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {m.kumasHazirTarih ? (
                        <span className="text-xs tabular-nums font-medium">{trTarih(m.kumasHazirTarih)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* STOP Modeller */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-red-500/8 to-transparent pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" /> Numune STOP
              <Badge variant="secondary" className="text-xs ml-1">{numuneNotOk.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {numuneNotOk.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">STOP verilen numune yok.</p>
            ) : (
              <div className="space-y-2.5">
                {numuneNotOk.map((m) => (
                  <div key={m.id} className="border-b pb-2.5 last:border-0 last:pb-0" data-testid={`row-stop-${m.id}`}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{m.modelKodu}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{m.grup}</Badge>
                      <span className="text-muted-foreground text-xs">{m.kategori}</span>
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 bg-red-50 dark:bg-red-500/10 rounded px-2 py-1">
                      {m.numuneSebep || "Sebep belirtilmedi"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
