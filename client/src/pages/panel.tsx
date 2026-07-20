import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Model } from "@shared/schema";
import { GROUPS } from "@shared/schema";
import { kalanGun, trTarih, kumasRenk } from "@/lib/helpers";
import { Package, Clock, Scissors, CheckCircle2, AlertTriangle, Boxes, XCircle, FlaskConical, Layers } from "lucide-react";

function Kpi({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-tight" data-testid={`kpi-${label}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Panel() {
  const { data: models = [] } = useQuery<Model[]>({ queryKey: ["/api/models"] });

  const toplam = models.length;
  const beklemede = models.filter((m) => m.durum === "Beklemede").length;
  const dikimde = models.filter((m) => m.durum === "Dikimde").length;
  const tamamlandi = models.filter((m) => m.durum === "Tamamlandı").length;
  const toplamAdet = models.reduce((s, m) => s + m.adet, 0);
  const geciken = models.filter((m) => {
    const g = kalanGun(m.termin);
    return g !== null && g < 0 && m.durum !== "Tamamlandı";
  }).length;

  // Numune özeti
  const numuneOk = models.filter((m) => m.numuneDurum === "Numune OK").length;
  const numuneNotOk = models.filter((m) => m.numuneDurum === "Numune NOT OK");
  const numuneBekliyor = models.filter((m) => m.numuneDurum === "Bekliyor").length;

  // Kumaş özeti (aktif modeller üzerinden)
  const aktifModeller = models.filter((m) => m.durum !== "Tamamlandı");
  const kumasHazir = aktifModeller.filter((m) => m.kumasDurum === "Hazır").length;
  const kumasYolda = aktifModeller.filter((m) => m.kumasDurum === "Boyahanede" || m.kumasDurum === "Konfeksiyon Rafta" || m.kumasDurum === "Sipariş Verildi").length;
  const kumasBekleyen = aktifModeller
    .filter((m) => m.kumasDurum !== "Hazır" && m.kumasDurum !== "Belirtilmedi")
    .sort((a, b) => {
      if (a.kumasHazirTarih && b.kumasHazirTarih) return a.kumasHazirTarih < b.kumasHazirTarih ? -1 : 1;
      if (a.kumasHazirTarih) return -1;
      if (b.kumasHazirTarih) return 1;
      return 0;
    });

  const durumMax = Math.max(beklemede, dikimde, tamamlandi, 1);
  const durumlar = [
    { ad: "Beklemede", val: beklemede, renk: "bg-amber-400" },
    { ad: "Dikimde", val: dikimde, renk: "bg-blue-400" },
    { ad: "Tamamlandı", val: tamamlandi, renk: "bg-green-400" },
  ];

  const gruplar = GROUPS.map((g) => {
    const arr = models.filter((m) => m.grup === g);
    return {
      ad: g,
      sayi: arr.length,
      adet: arr.reduce((s, m) => s + m.adet, 0),
      tamam: arr.filter((m) => m.durum === "Tamamlandı").length,
    };
  });

  // Yaklaşan terminler (tamamlanmamış, en yakın 5)
  const yaklasan = [...models]
    .filter((m) => m.durum !== "Tamamlandı" && m.termin)
    .sort((a, b) => (a.termin < b.termin ? -1 : 1))
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Toplam Model" value={toplam} icon={Package} color="bg-primary/15 text-primary" />
        <Kpi label="Beklemede" value={beklemede} icon={Clock} color="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" />
        <Kpi label="Dikimde" value={dikimde} icon={Scissors} color="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" />
        <Kpi label="Tamamlandı" value={tamamlandi} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" />
        <Kpi label="Toplam Adet" value={toplamAdet.toLocaleString("tr-TR")} icon={Boxes} color="bg-primary/15 text-primary" />
        <Kpi label="Geciken" value={geciken} icon={AlertTriangle} color="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" />
      </div>

      {/* Numune özeti KPI */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Numune OK" value={numuneOk} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" />
        <Kpi label="Numune STOP (NOT OK)" value={numuneNotOk.length} icon={XCircle} color="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" />
        <Kpi label="Numune Bekliyor" value={numuneBekliyor} icon={FlaskConical} color="bg-muted text-muted-foreground" />
      </div>

      {/* Kumaş özeti KPI */}
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Kumaşı Hazır (aktif)" value={kumasHazir} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" />
        <Kpi label="Kumaşı Beklenen (aktif)" value={kumasYolda} icon={Layers} color="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" />
      </div>

      {/* Kumaşı beklenen modeller */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Kumaşı Beklenen Modeller
            <Badge variant="outline" className="ml-1">{kumasBekleyen.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {kumasBekleyen.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Bekleyen kumaş yok. Tüm aktif modellerin kumaşı hazır veya bilgi girilmedi.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium">Grup</th>
                    <th className="py-2 px-2 font-medium">Model</th>
                    <th className="py-2 px-2 font-medium">Kumaş Aşaması</th>
                    <th className="py-2 px-2 font-medium">Tahmini Hazır</th>
                    <th className="py-2 px-2 font-medium">Not</th>
                  </tr>
                </thead>
                <tbody>
                  {kumasBekleyen.map((m) => (
                    <tr key={m.id} className="border-b align-top" data-testid={`row-kumas-${m.id}`}>
                      <td className="py-2 px-2">{m.grup}</td>
                      <td className="py-2 px-2 font-medium">{m.modelKodu}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={kumasRenk(m.kumasDurum)}>{m.kumasDurum}</Badge>
                      </td>
                      <td className="py-2 px-2 tabular-nums">{m.kumasHazirTarih ? trTarih(m.kumasHazirTarih) : "—"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{m.kumasNot || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STOP olan modeller ve sebepleri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" /> Numune STOP Modeller ve Sebepleri
            <Badge variant="outline" className="ml-1">{numuneNotOk.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {numuneNotOk.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">STOP verilen numune yok. Tüm numuneler temiz.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium">Grup</th>
                    <th className="py-2 px-2 font-medium">Model</th>
                    <th className="py-2 px-2 font-medium">Kategori</th>
                    <th className="py-2 px-2 font-medium">STOP Sebebi</th>
                  </tr>
                </thead>
                <tbody>
                  {numuneNotOk.map((m) => (
                    <tr key={m.id} className="border-b align-top" data-testid={`row-stop-${m.id}`}>
                      <td className="py-2 px-2">{m.grup}</td>
                      <td className="py-2 px-2 font-medium">{m.modelKodu}</td>
                      <td className="py-2 px-2">{m.kategori}</td>
                      <td className="py-2 px-2 text-red-600 dark:text-red-400">{m.numuneSebep || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Durum dağılımı */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Durum Dağılımı</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {durumlar.map((d) => (
              <div key={d.ad}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{d.ad}</span>
                  <span className="font-semibold tabular-nums">{d.val}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${d.renk} rounded-full transition-all`} style={{ width: `${(d.val / durumMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Yaklaşan terminler */}
        <Card>
          <CardHeader><CardTitle className="text-lg">En Yakın Terminler</CardTitle></CardHeader>
          <CardContent>
            {yaklasan.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aktif model yok.</p>
            ) : (
              <div className="space-y-2">
                {yaklasan.map((m) => {
                  const g = kalanGun(m.termin);
                  return (
                    <div key={m.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <div>
                        <span className="font-medium">{m.modelKodu}</span>
                        <span className="text-muted-foreground ml-2">{m.kategori}</span>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums">{trTarih(m.termin)}</div>
                        <div className={`text-xs ${g !== null && g < 0 ? "text-red-600 dark:text-red-400" : g !== null && g <= 7 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
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

      {/* Gruplara göre dağılım */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Gruplara Göre Dağılım</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 px-2 font-medium">Grup</th>
                  <th className="py-2 px-2 font-medium text-right">Model Sayısı</th>
                  <th className="py-2 px-2 font-medium text-right">Toplam Adet</th>
                  <th className="py-2 px-2 font-medium text-right">Tamamlanan</th>
                </tr>
              </thead>
              <tbody>
                {gruplar.map((g) => (
                  <tr key={g.ad} className="border-b" data-testid={`row-grup-${g.ad}`}>
                    <td className="py-2 px-2 font-medium">{g.ad}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{g.sayi}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{g.adet.toLocaleString("tr-TR")}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{g.tamam}</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-accent/40">
                  <td className="py-2 px-2">TOPLAM</td>
                  <td className="py-2 px-2 text-right tabular-nums">{toplam}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{toplamAdet.toLocaleString("tr-TR")}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{tamamlandi}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
