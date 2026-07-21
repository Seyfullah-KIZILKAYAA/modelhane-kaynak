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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { GROUPS, CATEGORIES, STATUSES, NUMUNE_CINSLERI, KUMAS_ASAMALARI } from "@shared/schema";
import type { Model } from "@shared/schema";
import { durumRenk, trTarih, kalanGun, terminRenk, numuneRenk, kumasRenk } from "@/lib/helpers";
import {
  Plus, Package, CheckCircle2, XCircle, Layers, Trash2,
  User, Tag, Hash, CalendarDays, UserCircle, Shirt, Scissors,
  Search, SlidersHorizontal, X, ChevronLeft, ChevronRight,
} from "lucide-react";

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

  // Silme onay dialog
  const [silModel, setSilModel] = useState<Model | null>(null);

  // Filtreleme
  const [fArama, setFArama] = useState("");
  const [fGrup, setFGrup] = useState("__all__");
  const [fKategori, setFKategori] = useState("__all__");
  const [fDurum, setFDurum] = useState("__all__");
  const [fNumune, setFNumune] = useState("__all__");

  // Sayfalama durumu
  const [sayfa, setSayfa] = useState(1);
  const [sayfaBoyu, setSayfaBoyu] = useState(20);

  // Filtre her değiştiğinde başa dön, yoksa kullanıcı boş bir sayfada kalır.
  function filtreDegisti<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setSayfa(1); };
  }

  const filtrelerAktif = fArama || fGrup !== "__all__" || fKategori !== "__all__" || fDurum !== "__all__" || fNumune !== "__all__";

  const filteredModels = models.filter((m) => {
    if (fArama) {
      const q = fArama.toLowerCase();
      if (!m.modelKodu.toLowerCase().includes(q) && !m.girenKisi.toLowerCase().includes(q) && !m.grup.toLowerCase().includes(q)) return false;
    }
    if (fGrup !== "__all__" && m.grup !== fGrup) return false;
    if (fKategori !== "__all__" && m.kategori !== fKategori) return false;
    if (fDurum !== "__all__" && m.durum !== fDurum) return false;
    if (fNumune !== "__all__" && m.numuneDurum !== fNumune) return false;
    return true;
  });

  function filtreleriTemizle() {
    setFArama(""); setFGrup("__all__"); setFKategori("__all__"); setFDurum("__all__"); setFNumune("__all__");
  }

  // ── Sayfalama ──
  const toplamSayfa = Math.max(1, Math.ceil(filteredModels.length / sayfaBoyu));
  // Filtre daraldığında mevcut sayfa listenin dışında kalabilir; son sayfaya sabitle.
  const gecerliSayfa = Math.min(sayfa, toplamSayfa);
  const basIndex = (gecerliSayfa - 1) * sayfaBoyu;
  const sayfaModelleri = filteredModels.slice(basIndex, basIndex + sayfaBoyu);

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

  const sil = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/models/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Model silindi", description: `${silModel?.modelKodu ?? "Model"} başarıyla silindi.` });
      setSilModel(null);
    },
    onError: (e: Error) => {
      toast({ title: "Silme başarısız", description: e.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
      setSilModel(null);
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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
      {/* ───── Giriş Formu ───── */}
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2.5 text-xl">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            Yeni Model Girişi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 pb-6">
          {/* Ürün Bilgileri */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Ürün Bilgileri
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary/70" /> Grup
                </label>
                {grupKilitli ? (
                  <Input value={grup} disabled className="font-medium bg-muted/50" data-testid="input-grup-sabit" />
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
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary/70" /> Model Kodu / Adı
                </label>
                <Input value={modelKodu} onChange={(e) => setModelKodu(e.target.value)} placeholder="Örn: GM-1001" data-testid="input-modelkodu" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-primary/70" /> Ürün Kategorisi
                </label>
                <Select value={kategori} onValueChange={setKategori}>
                  <SelectTrigger data-testid="select-kategori"><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-primary/70" /> Adet
                </label>
                <Input type="number" min="1" value={adet} onChange={(e) => setAdet(e.target.value)} placeholder="Örn: 250" data-testid="input-adet" />
              </div>
            </div>
          </div>

          {/* Tarih & Kişi */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Tarih & Kişi Bilgileri
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-primary/70" /> Termin Tarihi
                </label>
                <Input type="date" value={termin} onChange={(e) => setTermin(e.target.value)} data-testid="input-termin" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-primary/70" /> Giren Kişi
                </label>
                <Input value={girenKisi} onChange={(e) => setGirenKisi(e.target.value)} placeholder="Adınız" data-testid="input-giren" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-primary/70" /> Numune Cinsi
                </label>
                <Select value={numuneCinsi} onValueChange={setNumuneCinsi}>
                  <SelectTrigger data-testid="select-numune-cinsi"><SelectValue placeholder="Numune cinsi seçin" /></SelectTrigger>
                  <SelectContent>
                    {NUMUNE_CINSLERI.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Kumaş Bilgileri */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Kumaş Bilgileri
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary/70" /> Kumaş Durumu
                </label>
                <Select value={yeniKumas} onValueChange={setYeniKumas}>
                  <SelectTrigger data-testid="select-yeni-kumas"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KUMAS_ASAMALARI.map((a) => <SelectItem key={a} value={a}>{a === "Belirtilmedi" ? "— Belirtilmedi" : a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {yeniKumas !== "Belirtilmedi" && yeniKumas !== "Hazır" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-primary/70" /> Kumaş Ne Zaman Hazır? (opsiyonel)
                  </label>
                  <Input type="date" value={yeniKumasTarih} onChange={(e) => setYeniKumasTarih(e.target.value)} data-testid="input-yeni-kumas-tarih" />
                </div>
              )}
            </div>
          </div>

          <Button
            className="mt-2 px-6 h-11 text-sm font-semibold bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary/75 shadow-md hover:shadow-lg transition-all duration-200"
            onClick={() => ekle.mutate()}
            disabled={!gecerli || ekle.isPending}
            data-testid="button-ekle"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {ekle.isPending ? "Ekleniyor..." : "Modeli Ekle"}
          </Button>
        </CardContent>
      </Card>

      {/* ───── Girilen Modeller Listesi ───── */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2.5 text-xl">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            Girilen Modeller
            <Badge variant="secondary" className="ml-2 text-xs font-bold px-2.5 py-0.5">
              {filtrelerAktif ? `${filteredModels.length} / ${models.length}` : models.length}
            </Badge>
          </CardTitle>

          {/* ── Filtre Barı ── */}
          {models.length > 0 && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filtrele
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {/* Arama */}
                <div className="relative col-span-2 sm:col-span-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={fArama}
                    onChange={(e) => { setFArama(e.target.value); setSayfa(1); }}
                    placeholder="Ara (model, kişi, grup)"
                    className="pl-8 h-8 text-xs"
                    data-testid="filter-arama"
                  />
                </div>
                {/* Grup */}
                <Select value={fGrup} onValueChange={filtreDegisti(setFGrup)}>
                  <SelectTrigger className="h-8 text-xs" data-testid="filter-grup">
                    <SelectValue placeholder="Grup" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tüm Gruplar</SelectItem>
                    {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* Kategori */}
                <Select value={fKategori} onValueChange={filtreDegisti(setFKategori)}>
                  <SelectTrigger className="h-8 text-xs" data-testid="filter-kategori">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tüm Kategoriler</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* Durum */}
                <Select value={fDurum} onValueChange={filtreDegisti(setFDurum)}>
                  <SelectTrigger className="h-8 text-xs" data-testid="filter-durum">
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tüm Durumlar</SelectItem>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* Numune Durumu */}
                <Select value={fNumune} onValueChange={filtreDegisti(setFNumune)}>
                  <SelectTrigger className="h-8 text-xs" data-testid="filter-numune">
                    <SelectValue placeholder="Numune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tüm Numune Durumları</SelectItem>
                    <SelectItem value="Bekliyor">Bekliyor</SelectItem>
                    <SelectItem value="Numune OK">Numune OK</SelectItem>
                    <SelectItem value="Numune NOT OK">Numune NOT OK</SelectItem>
                  </SelectContent>
                </Select>
                {/* Temizle */}
                {filtrelerAktif && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={filtreleriTemizle}
                    data-testid="filter-temizle"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Temizle
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Yükleniyor...</p>
              </div>
            </div>
          ) : models.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Package className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">Henüz model girilmedi.</p>
              <p className="text-muted-foreground/60 text-xs">Yukarıdan ilk modeli ekleyin.</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Search className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">Filtreye uygun model bulunamadı.</p>
              <Button variant="outline" size="sm" className="text-xs" onClick={filtreleriTemizle}>
                <X className="w-3.5 h-3.5 mr-1" /> Filtreleri Temizle
              </Button>
            </div>
          ) : (
            <>
              {/* ── Masaüstü Tablo Görünümü ── */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-primary/10 bg-muted/30 text-left">
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Grup</th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Model</th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Kategori</th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Adet</th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Termin</th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Giren</th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Durum</th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Kumaş</th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Numune Cinsi</th>
                      <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Numune Durumu</th>
                      {isYonetici && (
                        <th className="py-3 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[60px]">İşlem</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sayfaModelleri.map((m, idx) => {
                      const g = kalanGun(m.termin);
                      return (
                        <tr
                          key={m.id}
                          className={`border-b transition-colors duration-150 hover:bg-primary/5 align-top ${
                            idx % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                          }`}
                          data-testid={`row-model-${m.id}`}
                        >
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-xs font-medium">{m.grup}</Badge>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-foreground">{m.modelKodu}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{m.kategori}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-medium">{m.adet.toLocaleString("tr-TR")}</td>
                          <td className={`py-2.5 px-3 tabular-nums ${terminRenk(g, m.durum)}`}>
                            {trTarih(m.termin)}
                            {g !== null && m.durum !== "Tamamlandı" && (
                              <span className="block text-xs opacity-80">
                                {g < 0 ? `${Math.abs(g)} gün geçti` : g === 0 ? "Bugün" : `${g} gün kaldı`}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{m.girenKisi}</td>
                          <td className="py-2.5 px-3">
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
                          <td className="py-2.5 px-3 min-w-[170px]">
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
                          <td className="py-2.5 px-3 min-w-[150px]">
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
                          <td className="py-2.5 px-3 min-w-[210px]">
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
                          {/* Silme butonu — sadece yöneticiye göster */}
                          {isYonetici && (
                            <td className="py-2.5 px-3">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                                onClick={() => setSilModel(m)}
                                data-testid={`button-sil-${m.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Mobil Kart Görünümü ── */}
              <div className="lg:hidden divide-y">
                {sayfaModelleri.map((m) => {
                  const g = kalanGun(m.termin);
                  return (
                    <div key={m.id} className="p-4 space-y-3 hover:bg-muted/20 transition-colors" data-testid={`card-model-${m.id}`}>
                      {/* Kart başlığı */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base">{m.modelKodu}</span>
                            <Badge variant="outline" className="text-xs">{m.grup}</Badge>
                            <Badge variant="outline" className={`text-xs ${durumRenk(m.durum)}`}>{m.durum}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{m.kategori} · {m.adet.toLocaleString("tr-TR")} adet</p>
                        </div>
                        {isYonetici && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                            onClick={() => setSilModel(m)}
                            data-testid={`button-sil-mobile-${m.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {/* Detay satırları */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground block">Termin</span>
                          <span className={`font-medium tabular-nums ${terminRenk(g, m.durum)}`}>
                            {trTarih(m.termin)}
                            {g !== null && m.durum !== "Tamamlandı" && (
                              <span className="block text-xs opacity-80">
                                {g < 0 ? `${Math.abs(g)} gün geçti` : g === 0 ? "Bugün" : `${g} gün kaldı`}
                              </span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Giren</span>
                          <span className="text-muted-foreground">{m.girenKisi}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Kumaş</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={`text-xs ${kumasRenk(m.kumasDurum)}`}>
                              {m.kumasDurum === "Belirtilmedi" ? "—" : m.kumasDurum}
                            </Badge>
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs text-primary"
                              onClick={() => kumasAc(m)}>
                              Düzenle
                            </Button>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Numune Cinsi</span>
                          <Select value={m.numuneCinsi} onValueChange={(v) => numuneCinsiGuncelle.mutate({ id: m.id, numuneCinsi: v })}>
                            <SelectTrigger className="h-7 text-xs w-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {NUMUNE_CINSLERI.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Durum ve numune aksiyonları */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={m.durum} onValueChange={(v) => durumGuncelle.mutate({ id: m.id, durum: v })}>
                          <SelectTrigger className="h-7 w-auto border-0 p-0 focus:ring-0">
                            <Badge variant="outline" className={durumRenk(m.durum)}>{m.durum}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="flex-1" />
                        <Badge variant="outline" className={numuneRenk(m.numuneDurum)}>{m.numuneDurum}</Badge>
                        <Button size="sm" variant="ghost" className="h-7 px-1.5 text-green-700 dark:text-green-400"
                          onClick={() => numuneOK(m)}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-1.5 text-red-700 dark:text-red-400"
                          onClick={() => numuneNotOkAc(m)}>
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                        {m.numuneDurum !== "Bekliyor" && (
                          <Button size="sm" variant="ghost" className="h-7 px-1.5 text-xs text-muted-foreground"
                            onClick={() => numuneSifirla(m)}>
                            Sıfırla
                          </Button>
                        )}
                      </div>

                      {/* NOT OK sebebi */}
                      {m.numuneDurum === "Numune NOT OK" && m.numuneSebep && (
                        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-md px-2.5 py-1.5">
                          Sebep: {m.numuneSebep}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Sayfalama Çubuğu ── */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Sayfa başına</span>
                  <Select
                    value={String(sayfaBoyu)}
                    onValueChange={(v) => { setSayfaBoyu(Number(v)); setSayfa(1); }}
                  >
                    <SelectTrigger className="h-8 w-[70px] text-xs" data-testid="sayfa-boyu">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[20, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="tabular-nums">
                    {basIndex + 1}-{basIndex + sayfaModelleri.length} / {filteredModels.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="sm" className="h-8 text-xs"
                    disabled={gecerliSayfa <= 1}
                    onClick={() => setSayfa(gecerliSayfa - 1)}
                    data-testid="sayfa-onceki"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Önceki
                  </Button>
                  <span className="px-2 text-xs text-muted-foreground tabular-nums" data-testid="sayfa-bilgi">
                    {gecerliSayfa} / {toplamSayfa}
                  </span>
                  <Button
                    variant="outline" size="sm" className="h-8 text-xs"
                    disabled={gecerliSayfa >= toplamSayfa}
                    onClick={() => setSayfa(gecerliSayfa + 1)}
                    data-testid="sayfa-sonraki"
                  >
                    Sonraki <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ───── Silme Onay Dialog ───── */}
      <Dialog open={!!silModel} onOpenChange={(o) => { if (!o) setSilModel(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Modeli Sil
            </DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Devam etmek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4">
              <p className="text-sm">
                <span className="font-bold text-foreground">{silModel?.modelKodu}</span>
                <span className="text-muted-foreground"> — {silModel?.grup} · {silModel?.kategori}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {silModel?.adet.toLocaleString("tr-TR")} adet · Termin: {silModel ? trTarih(silModel.termin) : ""}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSilModel(null)}>Vazgeç</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={sil.isPending}
              onClick={() => silModel && sil.mutate(silModel.id)}
              data-testid="button-sil-onayla"
            >
              {sil.isPending ? "Siliniyor..." : "Evet, Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───── Numune NOT OK sebep dialog ───── */}
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

      {/* ───── Kumaş durumu dialog ───── */}
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
