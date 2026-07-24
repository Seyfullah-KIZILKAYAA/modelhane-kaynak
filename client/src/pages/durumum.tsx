import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Model } from "@shared/schema";
import { durumRenk, numuneRenk, trTarih, kalanGun, terminRenk } from "@/lib/helpers";
import { ListOrdered, Scissors, CheckCircle2, Hourglass, AlertCircle, Layers, FlaskConical } from "lucide-react";

export default function Durumum({ grup }: { grup: string | null }) {
  const { data: models = [], isLoading } = useQuery<Model[]>({ queryKey: ["/api/models"] });

  // Tüm aktif modeller üretim sırasına göre (yöneticinin verdiği siraNo esas; yoksa termin)
  const tumSirali = [...models]
    .filter((m) => m.durum !== "Tamamlandı")
    .sort((a, b) => {
      const sa = a.siraNo ?? 9999;
      const sb = b.siraNo ?? 9999;
      if (sa !== sb) return sa - sb;
      // sıra atanmamışsa termine göre
      if (a.termin !== b.termin) return a.termin < b.termin ? -1 : 1;
      return a.createdAt - b.createdAt;
    });

  // Genel kuyrukta her modelin gerçek pozisyonu (1,2,3...)
  const pozisyon = new Map<number, number>();
  tumSirali.forEach((m, i) => pozisyon.set(m.id, i + 1));

  // Bu grubun modelleri
  const benim = grup ? models.filter((m) => m.grup === grup) : models;
  const benimAktif = benim.filter((m) => m.durum !== "Tamamlandı");
  const benimTamam = benim.filter((m) => m.durum === "Tamamlandı");

  // Bu grubun aktif modellerini üretim sırasına göre göster
  const benimSirali = [...benimAktif].sort(
    (a, b) => (pozisyon.get(a.id) ?? 9999) - (pozisyon.get(b.id) ?? 9999)
  );

  const siraVerilenSayisi = tumSirali.filter((m) => m.siraNo != null).length;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Bilgi kutusu */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <ListOrdered className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">Üretim Sıranız</p>
            <p className="text-sm text-muted-foreground">
              Aşağıda modelleriniz, ana yöneticinin belirlediği modelhane üretim sırasına göre listelenir.
              "Modelhane Sırası" numarası kaçıncı sırada dikileceğinizi, "Önünüzdeki model" ise
              sizden önce kaç model olduğunu gösterir.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Aktif modeller */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scissors className="w-5 h-5 text-primary" /> Bekleyen / Dikimdeki Modelleriniz
            <Badge variant="secondary" className="ml-1">{benimAktif.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Yükleniyor...</p>
          ) : benimSirali.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Aktif modeliniz yok. "Model Girişi" sekmesinden model ekleyebilirsiniz.
            </p>
          ) : (
            <div className="space-y-3">
              {benimSirali.map((m) => {
                const poz = pozisyon.get(m.id);
                const oncesinde = poz ? poz - 1 : null;
                const siraAtandi = m.siraNo != null;
                const g = kalanGun(m.termin);
                return (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3 hover:bg-accent/40"
                    data-testid={`durum-card-${m.id}`}
                  >
                    {/* Sıra rozeti */}
                    <div className="flex items-center gap-3 sm:w-40 shrink-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-lg shrink-0 ${
                          siraAtandi
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground text-sm"
                        }`}
                        data-testid={`sira-${m.id}`}
                      >
                        {siraAtandi ? m.siraNo : "?"}
                      </div>
                      <div className="text-xs text-muted-foreground leading-tight">
                        {siraAtandi ? (
                          <>
                            <span className="block font-medium text-foreground">Modelhane Sırası</span>
                            {oncesinde === 0
                              ? "Sıradaki ilk model!"
                              : `Önünüzde ${oncesinde} model var`}
                          </>
                        ) : (
                          "Henüz sıra verilmedi"
                        )}
                      </div>
                    </div>

                    {/* Model bilgi */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{m.modelKodu}</span>
                        <span className="text-sm text-muted-foreground">{m.kategori}{m.renk?.trim() ? ` · ${m.renk}` : ""}</span>
                        <span className="text-sm text-muted-foreground tabular-nums">· {m.adet.toLocaleString("tr-TR")} adet</span>
                      </div>
                      <div className={`text-sm tabular-nums mt-0.5 ${terminRenk(g, m.durum)}`}>
                        Termin: {trTarih(m.termin)}
                        {g !== null && (
                          <span className="ml-1">
                            ({g < 0 ? `${Math.abs(g)} gün geçti` : g === 0 ? "bugün" : `${g} gün kaldı`})
                          </span>
                        )}
                      </div>
                      {/* Kumaş + numune cinsi */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Layers className="w-3.5 h-3.5" /> Kumaş:
                          <span className={`font-medium ${m.kumasDurum === "Hazır" ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                            {m.kumasDurum === "Belirtilmedi" ? "Bilgi yok" : m.kumasDurum}
                          </span>
                          {m.kumasHazirTarih && m.kumasDurum !== "Hazır" && (
                            <span className="text-muted-foreground">(hazır: {trTarih(m.kumasHazirTarih)})</span>
                          )}
                        </span>
                        {m.numuneCinsi && m.numuneCinsi !== "Belirtilmedi" && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <FlaskConical className="w-3.5 h-3.5" /> Numune: <span className="font-medium text-foreground">{m.numuneCinsi}</span>
                          </span>
                        )}
                      </div>
                      {m.kumasNot && (
                        <div className="text-xs text-muted-foreground mt-0.5">Kumaş notu: {m.kumasNot}</div>
                      )}
                    </div>

                    {/* Durumlar */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Badge variant="outline" className={durumRenk(m.durum)}>
                        {m.durum === "Dikimde" && <Scissors className="w-3 h-3 mr-1" />}
                        {m.durum === "Beklemede" && <Hourglass className="w-3 h-3 mr-1" />}
                        {m.durum}
                      </Badge>
                      {m.numuneDurum !== "Bekliyor" && (
                        <Badge variant="outline" className={numuneRenk(m.numuneDurum)}>
                          {m.numuneDurum}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {benimSirali.some((m) => m.siraNo == null) && (
            <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              "?" işaretli modeller için ana yönetici henüz üretim sırası vermedi.
              {siraVerilenSayisi > 0 && ` Şu ana kadar ${siraVerilenSayisi} modele sıra verildi.`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tamamlananlar */}
      {benimTamam.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" /> Tamamlanan / Gönderilen Modeller
              <Badge variant="secondary" className="ml-1">{benimTamam.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {benimTamam.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0" data-testid={`tamam-${m.id}`}>
                  <div>
                    <span className="font-medium">{m.modelKodu}</span>
                    <span className="text-muted-foreground ml-2">{m.kategori}{m.renk?.trim() ? ` · ${m.renk}` : ""} · {m.adet.toLocaleString("tr-TR")} adet</span>
                  </div>
                  <Badge variant="outline" className={durumRenk(m.durum)}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> {m.durum}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
