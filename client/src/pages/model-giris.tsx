import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { GROUPS, CATEGORIES, STATUSES, NUMUNE_CINSLERI, KUMAS_ASAMALARI } from "@shared/schema";
import type { Model } from "@shared/schema";
import { durumRenk, trTarih, kalanGun, terminRenk, numuneRenk, kumasRenk } from "@/lib/helpers";
import { Plus, Package, CheckCircle2, XCircle, Layers } from "lucide-react";

export default function ModelGiris({ isYonetici, grup: sabitGrup }: { isYonetici: boolean; grup: string | null }) {
  const { toast } = useToast();
  const { data: models = [], isLoading } = useQuery<Model[]>({ queryKey: ["/api/models"] });

  const [grup, setGrup] = useState(sabitGrup ?? "");
  const [modelKodu, setModelKodu] = useState("");
  const [kategori, setKategori] = useState("");
  const [adet, setAdet] = useState("");
  const [termin, setTermin] = useState("");
  const [girenKisi, setGirenKisi] = useState("");
  const [numuneCinsi, setNumuneCinsi] = useState("Belirtilmedi");
  // Yeni model eklerken kumaş aşaması
  const [yeniKumas, setYeniKumas] = useState("Belirtilmedi");
  const [yeniKumasTarih, setYeniKumasTarih] = useState("");

  // Numune NOT OK sebep dialog
  const [notOkModel, setNotOkModel] = useState<Model | null>(null);
  const [sebep, setSebep] = useState("");

  // Kumaş durumu dialog
  const [kumasModel, setKumasModel] = useState<Model | null>(null);
  const [kAsama, setKAsama] = useState("Belirtilmedi");
  const [kTarih, setKTarih] = useState("");
  const [kNot, setKNot] = useState("");

  const ekle = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/models", {
        grup, modelKodu, kategori, adet: Number(adet), termin, girenKisi, numuneCinsi,
        kumasDurum: yeniKumas, kumasHazirTarih: yeniKumasTarih, kumasNot: "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Model eklendi", description: `${modelKodu} başarıyla kaydedildi.` });
      setModelKodu(""); setKategori(""); setAdet(""); setTermin(""); setNumuneCinsi("Belirtilmedi");
      setYeniKumas("Belirtilmedi"); setYeniKumasTarih("");
    },
    onError: (e: Error) => {
      toast({ title: "Hata", description: e.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const durumGuncelle = useMutation({
    mutationFn: async ({ id, durum }: { id: number; durum: string }) =>
      apiRequest("PATCH", `/api/models/${id}/status`, { durum }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/models"] }),
  });

  const numuneGuncelle = useMutation({
    mutationFn: async ({ id, numuneDurum, numuneSebep }: { id: number; numuneDurum: string; numuneSebep: string }) =>
      apiRequest("PATCH", `/api/models/${id}/numune`, { numuneDurum, numuneSebep }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setNotOkModel(null); setSebep("");
    },
  });

  const numuneCinsiGuncelle = useMutation({
    mutationFn: async ({ id, numuneCinsi }: { id: number; numuneCinsi: string }) =>
      apiRequest("PATCH", `/api/models/${id}/numune-cinsi`, { numuneCinsi }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/models"] }),
  });

  const kumasGuncelle = useMutation({
    mutationFn: async ({ id, kumasDurum, kumasHazirTarih, kumasNot }: { id: number; kumasDurum: string; kumasHazirTarih: string; kumasNot: string }) =>
      apiRequest("PATCH", `/api/models/${id}/kumas`, { kumasDurum, kumasHazirTarih, kumasNot }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setKumasModel(null); setKAsama("Belirtilmedi"); setKTarih(""); setKNot("");
    },
  });

  const grupKilitli = !isYonetici && !!sabitGrup;
  const gecerli = grup && modelKodu && kategori && adet && termin && girenKisi;

  function numuneOK(m: Model) {
    numuneGuncelle.mutate({ id: m.id, numuneDurum: "Numune OK", numuneSebep: "" });
  }
  function numuneNotOkAc(m: Model) {
    setNotOkModel(m);
    setSebep(m.numuneSebep ?? "");
  }
  function numuneSifirla(m: Model) {
    numuneGuncelle.mutate({ id: m.id, numuneDurum: "Bekliyor", numuneSebep: "" });
  }
  function kumasAc(m: Model) {
    setKumasModel(m);
    setKAsama(m.kumasDurum ?? "Belirtilmedi");
    setKTarih(m.kumasHazirTarih ?? "");
    setKNot(m.kumasNot ?? "");
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Giriş formu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5 text-primary" /> Yeni Model Girişi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Grup</label>
              {grupKilitli ? (
                <Input value={grup} disabled className="font-medium" data-testid="input-grup-sabit" />
              ) : (
                <Select value={grup} onValueChange={setGrup}>
                  <SelectTrigger data-testid="select-grup"><SelectValue placeholder="Grup seçin" /></SelectTrigger>
                  <SelectContent>
                    {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Model Kodu / Adı</label>
              <Input value={modelKodu} onChange={(e) => setModelKodu(e.target.value)} placeholder="Örn: GM-1001" data-testid="input-modelkodu" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ürün Kategorisi</label>
              <Select value={kategori} onValueChange={setKategori}>
                <SelectTrigger data-testid="select-kategori"><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Adet</label>
              <Input type="number" min="1" value={adet} onChange={(e) => setAdet(e.target.value)} placeholder="Örn: 250" data-testid="input-adet" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Termin Tarihi</label>
              <Input type="date" value={termin} onChange={(e) => setTermin(e.target.value)} data-testid="input-termin" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Giren Kişi</label>
              <Input value={girenKisi} onChange={(e) => setGirenKisi(e.target.value)} placeholder="Adınız" data-testid="input-giren" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Numune Cinsi</label>
              <Select value={numuneCinsi} onValueChange={setNumuneCinsi}>
                <SelectTrigger data-testid="select-numune-cinsi"><SelectValue placeholder="Numune cinsi seçin" /></SelectTrigger>
                <SelectContent>
                  {NUMUNE_CINSLERI.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1"><Layers className="w-4 h-4 text-primary" /> Kumaş Durumu</label>
              <Select value={yeniKumas} onValueChange={setYeniKumas}>
                <SelectTrigger data-testid="select-yeni-kumas"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KUMAS_ASAMALARI.map((a) => <SelectItem key={a} value={a}>{a === "Belirtilmedi" ? "— Belirtilmedi" : a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {yeniKumas !== "Belirtilmedi" && yeniKumas !== "Hazır" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Kumaş Ne Zaman Hazır? (opsiyonel)</label>
                <Input type="date" value={yeniKumasTarih} onChange={(e) => setYeniKumasTarih(e.target.value)} data-testid="input-yeni-kumas-tarih" />
              </div>
            )}
          </div>
          <Button className="mt-4" onClick={() => ekle.mutate()} disabled={!gecerli || ekle.isPending} data-testid="button-ekle">
            {ekle.isPending ? "Ekleniyor..." : "Modeli Ekle"}
          </Button>
        </CardContent>
      </Card>

      {/* Girilen modeller listesi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5 text-primary" /> Girilen Modeller
            <Badge variant="secondary" className="ml-2">{models.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Yükleniyor...</p>
          ) : models.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Henüz model girilmedi. Yukarıdan ilk modeli ekleyin.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium">Grup</th>
                    <th className="py-2 px-2 font-medium">Model</th>
                    <th className="py-2 px-2 font-medium">Kategori</th>
                    <th className="py-2 px-2 font-medium text-right">Adet</th>
                    <th className="py-2 px-2 font-medium">Termin</th>
                    <th className="py-2 px-2 font-medium">Giren</th>
                    <th className="py-2 px-2 font-medium">Durum</th>
                    <th className="py-2 px-2 font-medium">Kumaş Durumu</th>
                    <th className="py-2 px-2 font-medium">Numune Cinsi</th>
                    <th className="py-2 px-2 font-medium">Numune Durumu</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => {
                    const g = kalanGun(m.termin);
                    return (
                      <tr key={m.id} className="border-b hover:bg-accent/40 align-top" data-testid={`row-model-${m.id}`}>
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
                        <td className="py-2 px-2 text-muted-foreground">{m.girenKisi}</td>
                        <td className="py-2 px-2">
                          <Select value={m.durum} onValueChange={(v) => durumGuncelle.mutate({ id: m.id, durum: v })}>
                            <SelectTrigger className="h-8 w-auto border-0 p-0 focus:ring-0" data-testid={`select-durum-${m.id}`}>
                              <Badge variant="outline" className={durumRenk(m.durum)}>{m.durum}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Kumaş durumu */}
                        <td className="py-2 px-2 min-w-[170px]">
                          <div className="flex flex-col gap-1.5 items-start">
                            <Badge variant="outline" className={kumasRenk(m.kumasDurum)} data-testid={`badge-kumas-${m.id}`}>
                              {m.kumasDurum === "Belirtilmedi" ? "—" : m.kumasDurum}
                            </Badge>
                            {m.kumasHazirTarih && (
                              <span className="text-xs text-muted-foreground">
                                Hazır: {trTarih(m.kumasHazirTarih)}
                              </span>
                            )}
                            {m.kumasNot && (
                              <span className="text-xs text-muted-foreground max-w-[200px]">{m.kumasNot}</span>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-primary"
                              onClick={() => kumasAc(m)} data-testid={`button-kumas-${m.id}`}>
                              <Layers className="w-4 h-4 mr-1" /> Düzenle
                            </Button>
                          </div>
                        </td>
                        {/* Numune cinsi */}
                        <td className="py-2 px-2 min-w-[150px]">
                          <Select value={m.numuneCinsi} onValueChange={(v) => numuneCinsiGuncelle.mutate({ id: m.id, numuneCinsi: v })}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-numune-cinsi-${m.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {NUMUNE_CINSLERI.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Numune durumu */}
                        <td className="py-2 px-2 min-w-[210px]">
                          <div className="flex flex-col gap-1.5">
                            <Badge variant="outline" className={numuneRenk(m.numuneDurum)} data-testid={`badge-numune-${m.id}`}>
                              {m.numuneDurum}
                            </Badge>
                            {m.numuneDurum === "Numune NOT OK" && m.numuneSebep && (
                              <span className="text-xs text-red-600 dark:text-red-400 max-w-[240px]">
                                Sebep: {m.numuneSebep}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10"
                                onClick={() => numuneOK(m)} data-testid={`button-numune-ok-${m.id}`}>
                                <CheckCircle2 className="w-4 h-4 mr-1" /> OK
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                onClick={() => numuneNotOkAc(m)} data-testid={`button-numune-notok-${m.id}`}>
                                <XCircle className="w-4 h-4 mr-1" /> NOT OK
                              </Button>
                              {m.numuneDurum !== "Bekliyor" && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground"
                                  onClick={() => numuneSifirla(m)} data-testid={`button-numune-sifirla-${m.id}`}>
                                  Sıfırla
                                </Button>
                              )}
                            </div>
                          </div>
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

      {/* Numune NOT OK sebep dialog */}
      <Dialog open={!!notOkModel} onOpenChange={(o) => { if (!o) { setNotOkModel(null); setSebep(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" /> Numune NOT OK — Sebep
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{notOkModel?.modelKodu}</span> için numunenin neden onaylanmadığını yazın.
            </p>
            <Textarea value={sebep} onChange={(e) => setSebep(e.target.value)} rows={3}
              placeholder="Örn: Ölçü tutmadı, kumaş rengi farklı, baskı hatası..." data-testid="input-numune-sebep" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNotOkModel(null); setSebep(""); }}>Vazgeç</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!sebep.trim() || numuneGuncelle.isPending}
              onClick={() => notOkModel && numuneGuncelle.mutate({ id: notOkModel.id, numuneDurum: "Numune NOT OK", numuneSebep: sebep.trim() })}
              data-testid="button-numune-kaydet"
            >
              {numuneGuncelle.isPending ? "Kaydediliyor..." : "STOP Olarak Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kumaş durumu dialog */}
      <Dialog open={!!kumasModel} onOpenChange={(o) => { if (!o) { setKumasModel(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Kumaş Durumu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{kumasModel?.modelKodu}</span> için kumaşın hangi aşamada olduğunu seçin.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Aşama</label>
              <Select value={kAsama} onValueChange={setKAsama}>
                <SelectTrigger data-testid="select-kumas-asama"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KUMAS_ASAMALARI.map((a) => <SelectItem key={a} value={a}>{a === "Belirtilmedi" ? "— Belirtilmedi" : a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ne Zaman Hazır Olacak? (opsiyonel)</label>
              <Input type="date" value={kTarih} onChange={(e) => setKTarih(e.target.value)} data-testid="input-kumas-tarih" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Not (opsiyonel)</label>
              <Textarea value={kNot} onChange={(e) => setKNot(e.target.value)} rows={2}
                placeholder="Örn: Boyahaneden yarın gelecek, 2 top eksik..." data-testid="input-kumas-not" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKumasModel(null)}>Vazgeç</Button>
            <Button
              disabled={kumasGuncelle.isPending}
              onClick={() => kumasModel && kumasGuncelle.mutate({ id: kumasModel.id, kumasDurum: kAsama, kumasHazirTarih: kTarih, kumasNot: kNot.trim() })}
              data-testid="button-kumas-kaydet"
            >
              {kumasGuncelle.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
