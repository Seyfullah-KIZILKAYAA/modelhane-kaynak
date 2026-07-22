import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Model } from "@shared/schema";
import { durumRenk, trTarih, kalanGun, terminRenk, terminOnerileri } from "@/lib/helpers";
import { ListOrdered, Wand2, Trash2, Save, RotateCcw, Loader2 } from "lucide-react";

export default function Siralama() {
  const { toast } = useToast();
  const { data: models = [], isLoading } = useQuery<Model[]>({ queryKey: ["/api/models"] });

  const oneriMap = terminOnerileri(models);

  // Yerel sıralama haritası (model.id -> siraNo)
  const [localSiraMap, setLocalSiraMap] = useState<Record<number, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [degisiklikVar, setDegisiklikVar] = useState(false);

  // Veritabanından gelen veriler değiştiğinde (veya sayfa açıldığında) yerel haritayı doldur
  useEffect(() => {
    if (models.length > 0 && !degisiklikVar) {
      const initialMap: Record<number, number | null> = {};
      models.forEach((m) => {
        initialMap[m.id] = m.siraNo;
      });
      setLocalSiraMap(initialMap);
    }
  }, [models]);

  const sil = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/models/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Model silindi" });
    },
  });

  const handleInputChange = (id: number, valStr: string) => {
    const newVal = valStr === "" ? null : Number(valStr);
    setLocalSiraMap((prev) => ({
      ...prev,
      [id]: newVal,
    }));
    setDegisiklikVar(true);
  };

  // Termine göre otomatik sırala: öneri sırasını yerel haritaya yansıtır (henüz kaydetmez)
  function terminEsasliUygula() {
    const aktif = models.filter((m) => m.durum !== "Tamamlandı" && m.termin);
    const newMap = { ...localSiraMap };
    for (const m of aktif) {
      const oneri = oneriMap.get(m.id) ?? null;
      newMap[m.id] = oneri;
    }
    setLocalSiraMap(newMap);
    setDegisiklikVar(true);
    toast({
      title: "Termine göre sıralandı",
      description: "Sıralama önerisi yansıtıldı. Veritabanına kaydetmek için 'Sıralamayı Kaydet' butonuna tıklayın.",
    });
  }

  // Değişiklikleri sıfırla
  function degisiklikleriSifirla() {
    const resetMap: Record<number, number | null> = {};
    models.forEach((m) => {
      resetMap[m.id] = m.siraNo;
    });
    setLocalSiraMap(resetMap);
    setDegisiklikVar(false);
    toast({ description: "Değişiklikler sıfırlandı." });
  }

  // Tüm sıralama değişikliklerini veritabanına kaydet
  async function siraKaydet() {
    setSaving(true);
    try {
      const promises = Object.entries(localSiraMap).map(([idStr, val]) => {
        const id = Number(idStr);
        const originalModel = models.find((m) => m.id === id);
        if (originalModel && originalModel.siraNo !== val) {
          return apiRequest("PATCH", `/api/models/${id}/sira`, { siraNo: val });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      await queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setDegisiklikVar(false);
      toast({
        title: "Sıralama Kaydedildi",
        description: "Üretim sıralaması veritabanına başarıyla kaydedildi.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Sıralama kaydedilirken hata oluştu: " + (err?.message ?? String(err)),
      });
    } finally {
      setSaving(false);
    }
  }

  // Görüntüleme sırası: yerel haritadaki sıraya göre
  const sirali = [...models].sort((a, b) => {
    const sa = (localSiraMap[a.id] !== undefined ? localSiraMap[a.id] : a.siraNo) ?? 99999;
    const sb = (localSiraMap[b.id] !== undefined ? localSiraMap[b.id] : b.siraNo) ?? 99999;
    if (sa !== sb) return sa - sb;
    return a.termin < b.termin ? -1 : a.termin > b.termin ? 1 : a.createdAt - b.createdAt;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListOrdered className="w-5 h-5 text-primary" /> Üretim Sıralama (Ana Yönetici)
            </CardTitle>
            {degisiklikVar && (
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                Kaydedilmemiş Değişiklikler Var
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {degisiklikVar && (
              <Button onClick={degisiklikleriSifirla} variant="ghost" size="sm" disabled={saving}>
                <RotateCcw className="w-4 h-4 mr-1" /> Sıfırla
              </Button>
            )}
            <Button onClick={terminEsasliUygula} variant="outline" size="sm" disabled={saving} data-testid="button-oto-sirala">
              <Wand2 className="w-4 h-4 mr-1 text-primary" /> Termine Göre Otomatik Sırala
            </Button>
            <Button
              onClick={siraKaydet}
              disabled={saving || !degisiklikVar}
              variant="default"
              size="sm"
              className={degisiklikVar ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md animate-pulse" : ""}
              data-testid="button-sira-kaydet"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              Sıralamayı Kaydet
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            "Üretim Sırası" kutularına sıra numarası verin veya otomatik sıralayın. Değişikliklerin sisteme yansıması için <strong className="text-foreground">"Sıralamayı Kaydet"</strong> butonuna basın.
          </p>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Yükleniyor...</p>
          ) : models.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Henüz model girilmedi.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium w-28">Üretim Sırası</th>
                    <th className="py-2 px-2 font-medium">Grup</th>
                    <th className="py-2 px-2 font-medium">Model</th>
                    <th className="py-2 px-2 font-medium">Kategori</th>
                    <th className="py-2 px-2 font-medium text-right">Adet</th>
                    <th className="py-2 px-2 font-medium">Termin</th>
                    <th className="py-2 px-2 font-medium text-center">Termine Göre Öneri</th>
                    <th className="py-2 px-2 font-medium">Durum</th>
                    <th className="py-2 px-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sirali.map((m) => {
                    const g = kalanGun(m.termin);
                    const oneri = oneriMap.get(m.id);
                    const currentSira = localSiraMap[m.id] !== undefined ? localSiraMap[m.id] : m.siraNo;
                    return (
                      <tr key={m.id} className="border-b hover:bg-accent/40" data-testid={`row-sira-${m.id}`}>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            min="1"
                            className="h-9 w-20 text-center font-bold"
                            value={currentSira ?? ""}
                            onChange={(e) => handleInputChange(m.id, e.target.value)}
                            data-testid={`input-sira-${m.id}`}
                          />
                        </td>
                        <td className="py-2 px-2">{m.grup}</td>
                        <td className="py-2 px-2 font-medium">{m.modelKodu}</td>
                        <td className="py-2 px-2">{m.kategori}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{m.adet.toLocaleString("tr-TR")}</td>
                        <td className={`py-2 px-2 tabular-nums ${terminRenk(g, m.durum)}`}>
                          {trTarih(m.termin)}
                          {g !== null && m.durum !== "Tamamlandı" && (
                            <span className="block text-xs opacity-80">
                              {g < 0 ? `${Math.abs(g)} gün geçti` : g === 0 ? "Bugün" : `${g} gün kaldı`}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {oneri ? (
                            <Badge variant="outline" className="border-primary/40 text-primary font-semibold">{oneri}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={durumRenk(m.durum)}>{m.durum}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            onClick={() => sil.mutate(m.id)} data-testid={`button-sil-${m.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
