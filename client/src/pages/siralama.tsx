import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Model } from "@shared/schema";
import { durumRenk, trTarih, kalanGun, terminRenk, terminOnerileri } from "@/lib/helpers";
import { ListOrdered, Wand2, Trash2 } from "lucide-react";

export default function Siralama() {
  const { toast } = useToast();
  const { data: models = [], isLoading } = useQuery<Model[]>({ queryKey: ["/api/models"] });

  const oneriMap = terminOnerileri(models);

  const siraGuncelle = useMutation({
    mutationFn: async ({ id, siraNo }: { id: number; siraNo: number | null }) =>
      apiRequest("PATCH", `/api/models/${id}/sira`, { siraNo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/models"] }),
  });

  const sil = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/models/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Model silindi" });
    },
  });

  // Termine göre otomatik sırala: öneri sırasını üretim sırasına kopyalar
  async function terminEsasliUygula() {
    const aktif = models.filter((m) => m.durum !== "Tamamlandı" && m.termin);
    for (const m of aktif) {
      const oneri = oneriMap.get(m.id) ?? null;
      await apiRequest("PATCH", `/api/models/${m.id}/sira`, { siraNo: oneri });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/models"] });
    toast({ title: "Termine göre sıralandı", description: "Üretim sırası en yakın terminden başlayarak atandı." });
  }

  // Görüntüleme sırası: önce üretim sırası verilmiş olanlar (artan), sonra sırasızlar
  const sirali = [...models].sort((a, b) => {
    const sa = a.siraNo ?? 99999;
    const sb = b.siraNo ?? 99999;
    if (sa !== sb) return sa - sb;
    return a.termin < b.termin ? -1 : a.termin > b.termin ? 1 : a.createdAt - b.createdAt;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListOrdered className="w-5 h-5 text-primary" /> Üretim Sıralama (Ana Yönetici)
          </CardTitle>
          <Button onClick={terminEsasliUygula} variant="default" size="sm" data-testid="button-oto-sirala">
            <Wand2 className="w-4 h-4 mr-1" /> Termine Göre Otomatik Sırala
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            "Üretim Sırası" kutusuna 1-2-3 yazarak dikim sırasını siz belirleyin. "Termine Göre Öneri"
            en yakın terminden başlayarak otomatik sıra önerir. Tamamlanan modeller öneriye dahil edilmez.
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
                    return (
                      <tr key={m.id} className="border-b hover:bg-accent/40" data-testid={`row-sira-${m.id}`}>
                        <td className="py-2 px-2">
                          <Input
                            type="number" min="1"
                            className="h-9 w-20 text-center font-bold"
                            value={m.siraNo ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              siraGuncelle.mutate({ id: m.id, siraNo: v === "" ? null : Number(v) });
                            }}
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
