import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
import { GROUPS, CATEGORIES, DIGER_KATEGORI, STATUSES, NUMUNE_CINSLERI, NUMUNE_DURUMLARI, KUMAS_ASAMALARI } from "@shared/schema";
import type { Model } from "@shared/schema";
import { durumRenk, trTarih, kalanGun, terminRenk, numuneRenk, kumasRenk } from "@/lib/helpers";
import {
  Plus, Package, CheckCircle2, XCircle, Layers, Trash2,
  User, Tag, Hash, CalendarDays, UserCircle, Shirt, Scissors,
  Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, RefreshCw,
  AlertCircle, RotateCcw, Check, ChevronDown, ChevronUp, MessageSquare, Edit
} from "lucide-react";



export default function ModelGiris({ isYonetici, grup: sabitGrup }: { isYonetici: boolean; grup: string | null }) {
  const { toast } = useToast();
  const { data: models = [], isLoading } = useQuery<Model[]>({ queryKey: ["/api/models"] });

  const [grup, setGrup] = useState(sabitGrup ?? "");
  const [modelKodu, setModelKodu] = useState("");
  const [kategori, setKategori] = useState("");
  // "Diğer" seçildiğinde elle yazılan kategori adı
  const [kategoriDiger, setKategoriDiger] = useState("");
  const kategoriDegeri = kategori === DIGER_KATEGORI ? kategoriDiger.trim() : kategori;
  const [adet, setAdet] = useState("");
  const [termin, setTermin] = useState("");
  const [girenKisi, setGirenKisi] = useState("");
  const [numuneCinsi, setNumuneCinsi] = useState("Belirtilmedi");
  // Yeni model eklerken kumaş aşaması
  const [yeniKumas, setYeniKumas] = useState("Belirtilmedi");
  const [yeniKumasTarih, setYeniKumasTarih] = useState("");

  // Veritabanı ve yerel hafızadaki geçmiş isimler (açılır menü için)
  const gecmisIsimler = useMemo(() => {
    const set = new Set<string>();
    try {
      const localHist = JSON.parse(localStorage.getItem("giren_kisi_gecmis") || "[]");
      if (Array.isArray(localHist)) {
        localHist.forEach((n) => typeof n === "string" && n.trim() && set.add(n.trim()));
      }
    } catch {}

    models.forEach((m) => {
      if (m.girenKisi && m.girenKisi.trim()) {
        set.add(m.girenKisi.trim());
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [models]);

  function kaydetGirenKisiGecmis(isim: string) {
    if (!isim.trim()) return;
    try {
      const list: string[] = JSON.parse(localStorage.getItem("giren_kisi_gecmis") || "[]");
      const set = new Set(list);
      set.add(isim.trim());
      localStorage.setItem("giren_kisi_gecmis", JSON.stringify(Array.from(set)));
    } catch {}
  }

  // Termin hızlı seçim
  const terminHizliSec = (gun: number) => {
    const d = new Date();
    d.setDate(d.getDate() + gun);
    setTermin(d.toISOString().split("T")[0]);
  };

  const terminAySonu = () => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setTermin(lastDay.toISOString().split("T")[0]);
  };

  // Model Kodu mükerrer kontrolü
  const ayniModel = modelKodu.trim() !== "" && models.some(m => m.modelKodu.toLowerCase() === modelKodu.trim().toLowerCase());

  // Zorunlu alanların takibi
  const zorunluAlanlar = [
    { key: "grup", label: "Grup", dolumu: !!grup },
    { key: "modelKodu", label: "Model Kodu", dolumu: !!modelKodu.trim() },
    { key: "kategori", label: "Kategori", dolumu: !!kategoriDegeri },
    { key: "adet", label: "Adet", dolumu: !!adet && Number(adet) > 0 },
    { key: "termin", label: "Termin Tarihi", dolumu: !!termin },
    { key: "girenKisi", label: "Giren Kişi", dolumu: !!girenKisi.trim() },
  ];
  const tamamlananSayisi = zorunluAlanlar.filter(a => a.dolumu).length;
  const eksikAlanlar = zorunluAlanlar.filter(a => !a.dolumu).map(a => a.label);

  const formuSifirla = () => {
    if (!grupKilitli) setGrup("");
    setModelKodu("");
    setKategori("");
    setKategoriDiger("");
    setAdet("");
    setTermin("");
    setNumuneCinsi("Belirtilmedi");
    setYeniKumas("Belirtilmedi");
    setYeniKumasTarih("");
  };

  // Numune Onaylandı & Reddedildi dialog state
  const [okModel, setOkModel] = useState<Model | null>(null);
  const [okSebep, setOkSebep] = useState("");
  const [notOkModel, setNotOkModel] = useState<Model | null>(null);
  const [sebep, setSebep] = useState("");

  // Genişleyen numune sebebi/açıklaması takibi
  const [acikAciklamaIds, setAcikAciklamaIds] = useState<Record<number, boolean>>({});

  function toggleAciklama(id: number) {
    setAcikAciklamaIds(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Kumaş durumu dialog
  const [kumasModel, setKumasModel] = useState<Model | null>(null);
  const [kAsama, setKAsama] = useState("Belirtilmedi");
  const [kTarih, setKTarih] = useState("");
  const [kNot, setKNot] = useState("");

  // Silme onay dialog
  const [silModel, setSilModel] = useState<Model | null>(null);

  // Tüm Verileri Düzenleme
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);
  const [editModel, setEditModel] = useState<Model | null>(null);
  // Düzenleme dialogundaki tüm alanların taslak hali
  const [eForm, setEForm] = useState({
    grup: "", modelKodu: "", kategori: "", adet: "", termin: "", girenKisi: "",
    durum: "Beklemede", numuneCinsi: "Belirtilmedi", numuneDurum: "Bekliyor",
    numuneSebep: "", kumasDurum: "Belirtilmedi", kumasHazirTarih: "", kumasNot: "",
  });
  // Düzenlemede "Diğer" seçilince elle yazılan kategori
  const [eKategoriDiger, setEKategoriDiger] = useState("");
  const eKategoriDegeri = eForm.kategori === DIGER_KATEGORI ? eKategoriDiger.trim() : eForm.kategori;

  function duzenlemeAc(m: Model) {
    // Listede olmayan (elle yazılmış) kategoriler "Diğer" + serbest metin olarak açılır
    const listede = (CATEGORIES as readonly string[]).includes(m.kategori);
    setEKategoriDiger(listede ? "" : m.kategori);
    setEForm({
      grup: m.grup,
      modelKodu: m.modelKodu,
      kategori: listede ? m.kategori : DIGER_KATEGORI,
      adet: String(m.adet),
      termin: m.termin,
      girenKisi: m.girenKisi,
      durum: m.durum,
      numuneCinsi: m.numuneCinsi ?? "Belirtilmedi",
      numuneDurum: m.numuneDurum ?? "Bekliyor",
      numuneSebep: m.numuneSebep ?? "",
      kumasDurum: m.kumasDurum ?? "Belirtilmedi",
      kumasHazirTarih: m.kumasHazirTarih ?? "",
      kumasNot: m.kumasNot ?? "",
    });
    setEditModel(m);
  }

  const eDegis = (k: keyof typeof eForm) => (v: string) => setEForm(p => ({ ...p, [k]: v }));

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

  // Sabit liste + "Diğer" ile elle yazılmış kategoriler (kayıtlardan toplanır)
  const filtreKategorileri = useMemo(() => {
    const set = new Set<string>(CATEGORIES as readonly string[]);
    models.forEach((m) => m.kategori?.trim() && set.add(m.kategori.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [models]);

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
        grup, modelKodu, kategori: kategoriDegeri, adet: Number(adet), termin, girenKisi, numuneCinsi,
        kumasDurum: yeniKumas, kumasHazirTarih: yeniKumasTarih, kumasNot: "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Model eklendi", description: `${modelKodu} başarıyla kaydedildi.` });
      if (girenKisi.trim()) {
        kaydetGirenKisiGecmis(girenKisi.trim());
      }
      setModelKodu(""); setKategori(""); setKategoriDiger(""); setAdet(""); setTermin(""); setNumuneCinsi("Belirtilmedi");
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
      setOkModel(null); setOkSebep("");
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

  const tumVeriGuncelle = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) =>
      apiRequest("PATCH", `/api/models/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Başarılı", description: "Model başarıyla güncellendi." });
      setEditModel(null);
    },
    onError: (e: Error) => {
      toast({ title: "Hata", description: e.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    }
  });

  const grupKilitli = !isYonetici && !!sabitGrup;
  const gecerli = grup && modelKodu && kategoriDegeri && adet && termin && girenKisi;

  function numuneOkAc(m: Model) {
    setOkModel(m);
    setOkSebep(m.numuneDurum === "Numune Onaylandı" ? (m.numuneSebep ?? "") : "");
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
    <div className="w-full max-w-[98%] mx-auto p-3 md:p-5 space-y-6">
      {/* ───── Giriş Formu ───── */}
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-card/90 border-l-4 border-l-primary">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2.5 text-xl">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span>Yeni Model Girişi</span>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">Modelhane sistemine yeni model verilerini tanımlayın</p>
              </div>
            </CardTitle>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isYonetici && (
                <Button
                  size="sm"
                  variant={duzenlemeModu ? "default" : "outline"}
                  onClick={() => setDuzenlemeModu(!duzenlemeModu)}
                  className="h-7 text-xs"
                  title="Listedeki tüm model verilerini düzenlemeyi aç/kapat"
                  data-testid="button-duzenleme-modu-ust"
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  {duzenlemeModu ? "Düzenlemeyi Bitir" : "Tüm Verileri Düzenle"}
                </Button>
              )}
              <Badge variant={tamamlananSayisi === 6 ? "default" : "outline"} className={`text-xs px-2.5 py-1 ${tamamlananSayisi === 6 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-amber-600 border-amber-300 dark:text-amber-400"}`}>
                {tamamlananSayisi === 6 ? (
                  <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> 6/6 Tüm Alanlar Dolu</span>
                ) : (
                  <span>{tamamlananSayisi} / 6 Zorunlu Alan Dolu</span>
                )}
              </Badge>
              {(modelKodu || kategori || adet || termin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={formuSifirla}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  title="Formu temizle"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Temizle
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-6 space-y-6">
          {/* 1. Ürün Bilgileri */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
              <Tag className="w-3.5 h-3.5 text-primary" /> 1. Ürün Bilgileri
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary/70" /> Grup <span className="text-red-500 font-bold">*</span>
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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary/70" /> Model Kodu / Adı <span className="text-red-500 font-bold">*</span>
                  </label>
                  {modelKodu && (
                    <button
                      type="button"
                      onClick={() => setModelKodu(modelKodu.toUpperCase())}
                      className="text-[10px] text-muted-foreground hover:text-primary underline"
                    >
                      BÜYÜK HARF
                    </button>
                  )}
                </div>
                <Input
                  value={modelKodu}
                  onChange={(e) => setModelKodu(e.target.value)}
                  placeholder="Örn: GM-1001"
                  className={ayniModel ? "border-amber-500 focus-visible:ring-amber-500" : ""}
                  data-testid="input-modelkodu"
                />
                {ayniModel && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> Bu model kodu mevcut listede var!
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-primary/70" /> Ürün Kategorisi <span className="text-red-500 font-bold">*</span>
                </label>
                <Select value={kategori} onValueChange={(v) => { setKategori(v); if (v !== DIGER_KATEGORI) setKategoriDiger(""); }}>
                  <SelectTrigger data-testid="select-kategori"><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {kategori === DIGER_KATEGORI && (
                  <Input
                    value={kategoriDiger}
                    onChange={(e) => setKategoriDiger(e.target.value)}
                    placeholder="Kategori adını yazın"
                    autoFocus
                    data-testid="input-kategori-diger"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-primary/70" /> Adet <span className="text-red-500 font-bold">*</span>
                </label>
                <Input type="number" min="1" value={adet} onChange={(e) => setAdet(e.target.value)} placeholder="Örn: 250" data-testid="input-adet" />
              </div>
            </div>
          </div>

          {/* 2. Tarih & Kişi Bilgileri */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-primary" /> 2. Tarih & Giriş Yapan
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-primary/70" /> Termin Tarihi <span className="text-red-500 font-bold">*</span>
                </label>
                <Input type="date" value={termin} onChange={(e) => setTermin(e.target.value)} data-testid="input-termin" />
                <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground mr-0.5">Hızlı:</span>
                  <button type="button" onClick={() => terminHizliSec(7)} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary/15 hover:text-primary transition-colors font-medium">
                    +7 Gün
                  </button>
                  <button type="button" onClick={() => terminHizliSec(14)} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary/15 hover:text-primary transition-colors font-medium">
                    +14 Gün
                  </button>
                  <button type="button" onClick={() => terminHizliSec(21)} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary/15 hover:text-primary transition-colors font-medium">
                    +21 Gün
                  </button>
                  <button type="button" onClick={() => terminHizliSec(30)} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary/15 hover:text-primary transition-colors font-medium">
                    +30 Gün
                  </button>
                  <button type="button" onClick={terminAySonu} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary/15 hover:text-primary transition-colors font-medium">
                    Ay Sonu
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-primary/70" /> Giren Kişi <span className="text-red-500 font-bold">*</span>
                </label>
                <Input
                  list="giren-kisi-list"
                  value={girenKisi}
                  onChange={(e) => setGirenKisi(e.target.value)}
                  placeholder="Adınızı girin veya seçin..."
                  data-testid="input-giren"
                  autoComplete="off"
                />
                <datalist id="giren-kisi-list">
                  {gecmisIsimler.map((isim) => (
                    <option key={isim} value={isim} />
                  ))}
                </datalist>
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

          {/* 3. Kumaş Bilgileri */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> 3. Kumaş Durumu (Opsiyonel)
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

          {/* Alt Aksiyon Çubuğu */}
          <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t">
            <div className="text-xs text-muted-foreground">
              {!gecerli ? (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Zorunlu alanlar tamamlanmalı: <strong className="font-semibold">{eksikAlanlar.join(", ")}</strong>
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Modeli kaydetmek için buton aktif.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(modelKodu || kategori || adet || termin) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={formuSifirla}
                  className="h-10 text-xs px-4"
                >
                  Formu Temizle
                </Button>
              )}
              <Button
                className={`h-10 px-6 text-sm font-semibold shadow-md transition-all duration-200 ${
                  gecerli
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    : "bg-primary"
                }`}
                onClick={() => ekle.mutate()}
                disabled={!gecerli || ekle.isPending}
                data-testid="button-ekle"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {ekle.isPending ? "Ekleniyor..." : "Modeli Kaydet"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───── Girilen Modeller Listesi ───── */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2.5 text-xl">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              Girilen Modeller
              <Badge variant="secondary" className="ml-2 text-xs font-bold px-2.5 py-0.5">
                {filtrelerAktif ? `${filteredModels.length} / ${models.length}` : models.length}
              </Badge>
            </CardTitle>
            {isYonetici && (
              <Button size="sm" variant={duzenlemeModu ? "default" : "outline"} onClick={() => setDuzenlemeModu(!duzenlemeModu)} className="h-8">
                <Edit className="w-3.5 h-3.5 mr-1.5" />
                {duzenlemeModu ? "Düzenlemeyi Bitir" : "Tüm Verileri Düzenle"}
              </Button>
            )}
          </div>

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
                    {filtreKategorileri.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                    <SelectItem value="Numune Onaylandı">Numune Onaylandı</SelectItem>
                    <SelectItem value="Numune Reddedildi">Numune Reddedildi</SelectItem>
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
              {/* ── Masaüstü Tablo Görünümü (Sabit Başlıklı Tek Tablo) ── */}
              <div className="hidden lg:block overflow-auto max-h-[68vh] border-b">
                <table className="w-full text-xs min-w-full border-collapse">
                  <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur border-b border-primary/10 shadow-xs">
                    <tr className="text-left">
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/95">Grup</th>
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/95 max-w-[140px]">Model</th>
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/95">Kategori</th>
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-right whitespace-nowrap bg-muted/95">Adet</th>
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/95">Termin</th>
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/95">Giren</th>
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/95">Durum</th>
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/95">Kumaş</th>
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/95">Numune Cinsi</th>
                      <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/95">Numune Durumu</th>
                      {isYonetici && duzenlemeModu && (
                        <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-center w-[40px] whitespace-nowrap bg-muted/95">Düzenle</th>
                      )}
                      {isYonetici && (
                        <th className="py-2.5 px-2 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground text-center w-[40px] whitespace-nowrap bg-muted/95">Sil</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sayfaModelleri.map((m, idx) => {
                      const g = kalanGun(m.termin);
                      return (
                        <tr
                          key={m.id}
                          className={`border-b transition-colors duration-150 hover:bg-primary/5 align-middle ${
                            idx % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                          }`}
                          data-testid={`row-model-${m.id}`}
                        >
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5">{m.grup}</Badge>
                          </td>
                          <td
                            className="py-1.5 px-2 font-bold text-foreground text-xs max-w-[140px]"
                            title={`${m.modelKodu} (Seçip kopyalayabilir veya tıklayarak kopyalayabilirsiniz)`}
                            onCopy={(e) => {
                              e.clipboardData.setData("text/plain", m.modelKodu);
                              e.preventDefault();
                            }}
                          >
                            <div
                              className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[140px] select-all cursor-pointer hover:text-primary transition-colors"
                              onClick={() => {
                                navigator.clipboard.writeText(m.modelKodu);
                                toast({ title: "Kopyalandı", description: `${m.modelKodu} panoya kopyalandı.` });
                              }}
                            >
                              {m.modelKodu}
                            </div>
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap text-[11px] text-muted-foreground">{m.kategori}</td>
                          <td className="py-1.5 px-2 text-right font-semibold tabular-nums whitespace-nowrap text-xs">{m.adet.toLocaleString("tr-TR")}</td>
                          <td className={`py-1.5 px-2 tabular-nums whitespace-nowrap text-xs ${terminRenk(g, m.durum)}`}>
                            <span className="font-semibold">{trTarih(m.termin)}</span>
                            {g !== null && m.durum !== "Tamamlandı" && (
                              <span className="block text-[10px] opacity-80 font-normal">
                                {g < 0 ? `${Math.abs(g)} gün geçti` : g === 0 ? "Bugün" : `${g} gün kaldı`}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap text-xs">{m.girenKisi}</td>
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            <Select value={m.durum} onValueChange={(v) => durumGuncelle.mutate({ id: m.id, durum: v })}>
                              <SelectTrigger className={`h-6 text-[11px] w-[115px] font-medium px-2 ${durumRenk(m.durum)}`} data-testid={`select-durum-${m.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${kumasRenk(m.kumasDurum)}`}>
                                {m.kumasDurum === "Belirtilmedi" ? "—" : m.kumasDurum}
                              </Badge>
                              <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => kumasAc(m)} title="Kumaş Detayı Düzenle">
                                <Layers className="w-3 h-3" />
                              </Button>
                            </div>
                            {m.kumasHazirTarih && (
                              <span className="block text-[9px] text-muted-foreground mt-0.5">Hazır: {trTarih(m.kumasHazirTarih)}</span>
                            )}
                            {m.kumasNot && (
                              <span className="block text-[10px] text-muted-foreground/90 mt-0.5 max-w-[160px] truncate" title={m.kumasNot}>
                                Not: {m.kumasNot}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            <Select value={m.numuneCinsi} onValueChange={(v) => numuneCinsiGuncelle.mutate({ id: m.id, numuneCinsi: v })}>
                              <SelectTrigger className="h-6 text-[11px] w-[115px] px-2" data-testid={`select-numune-cinsi-${m.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {NUMUNE_CINSLERI.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex flex-col gap-1 min-w-[160px]">
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${numuneRenk(m.numuneDurum)}`}>
                                  {m.numuneDurum}
                                </Badge>
                                <div className="flex items-center gap-0.5">
                                  <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                    onClick={() => numuneOkAc(m)} data-testid={`button-numune-ok-${m.id}`}>
                                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> {m.numuneDurum === "Numune Onaylandı" ? "Not" : "Onay"}
                                  </Button>
                                  {m.numuneDurum !== "Numune Reddedildi" && (
                                    <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                      onClick={() => numuneNotOkAc(m)} data-testid={`button-numune-notok-${m.id}`}>
                                      <XCircle className="w-3 h-3 mr-0.5" /> Red
                                    </Button>
                                  )}
                                  {m.numuneDurum !== "Bekliyor" && (
                                    <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] text-muted-foreground hover:bg-muted"
                                      onClick={() => numuneSifirla(m)} data-testid={`button-numune-sifirla-${m.id}`}>
                                      Sıfırla
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Açıklama / Sebep Metni (Tıklayınca Genişler) */}
                              {m.numuneSebep && (
                                acikAciklamaIds[m.id] ? (
                                  <div
                                    onClick={() => toggleAciklama(m.id)}
                                    className={`p-1.5 rounded border text-[10px] cursor-pointer shadow-xs transition-all ${
                                      m.numuneDurum === "Numune Onaylandı"
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/50 text-emerald-900 dark:text-emerald-200"
                                        : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700/50 text-red-900 dark:text-red-200"
                                    }`}
                                    title="Daraltmak için tıklayın"
                                  >
                                    <div className="flex items-center justify-between font-semibold text-[10px] mb-0.5">
                                      <span className="flex items-center gap-1">
                                        <MessageSquare className="w-3 h-3" />
                                        {m.numuneDurum === "Numune Onaylandı" ? "Onay Açıklaması:" : "Reddedilme Sebebi:"}
                                      </span>
                                      <ChevronUp className="w-3 h-3 opacity-70" />
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-[10px] leading-tight">
                                      {m.numuneSebep}
                                    </p>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => toggleAciklama(m.id)}
                                    className={`text-[10px] cursor-pointer font-medium flex items-center gap-1 transition-colors group ${
                                      m.numuneDurum === "Numune Onaylandı"
                                        ? "text-emerald-700 dark:text-emerald-400 hover:text-emerald-900"
                                        : "text-red-600 dark:text-red-400 hover:text-red-900"
                                    }`}
                                    title="Tüm açıklamayı görmek için tıklayın"
                                  >
                                    <span className="truncate max-w-[150px] group-hover:underline">
                                      {m.numuneDurum === "Numune Onaylandı" ? "Açıklama: " : "Sebep: "}{m.numuneSebep}
                                    </span>
                                    <ChevronDown className="w-3 h-3 shrink-0 opacity-70 group-hover:opacity-100" />
                                  </div>
                                )
                              )}
                            </div>
                          </td>
                          {isYonetici && duzenlemeModu && (
                            <td className="py-1.5 px-2 text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => duzenlemeAc(m)}
                                title="Tüm Verileri Düzenle"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            </td>
                          )}
                          {/* Silme butonu — sadece yöneticiye göster */}
                          {isYonetici && (
                            <td className="py-1.5 px-2 text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                                onClick={() => setSilModel(m)}
                                data-testid={`button-sil-${m.id}`}
                                title="Modeli Sil"
                              >
                                <Trash2 className="w-3 h-3" />
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
                          <div className="flex flex-col gap-1 shrink-0">
                            {duzenlemeModu && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => duzenlemeAc(m)}
                                title="Tüm Verileri Düzenle"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                              onClick={() => setSilModel(m)}
                              data-testid={`button-sil-mobile-${m.id}`}
                              title="Modeli Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
                          <Badge variant="outline" className={kumasRenk(m.kumasDurum)}>
                            {m.kumasDurum === "Belirtilmedi" ? "—" : m.kumasDurum}
                          </Badge>
                          {m.kumasHazirTarih && (
                            <span className="block text-xs text-muted-foreground">Hazır: {trTarih(m.kumasHazirTarih)}</span>
                          )}
                          {m.kumasNot && (
                            <span className="block text-xs text-muted-foreground/90 italic mt-0.5">Not: {m.kumasNot}</span>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-muted-foreground block mb-1">Numune Cinsi</span>
                          <Select value={m.numuneCinsi} onValueChange={(v) => numuneCinsiGuncelle.mutate({ id: m.id, numuneCinsi: v })}>
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {NUMUNE_CINSLERI.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Mobil Aksiyon Barı */}
                      <div className="flex items-center gap-1.5 pt-2 mt-2 border-t flex-wrap">
                        <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => kumasAc(m)}>
                          <Layers className="w-3.5 h-3.5 mr-1" /> Kumaş Düzenle
                        </Button>
                        
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10" onClick={() => numuneOkAc(m)}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {m.numuneDurum === "Numune Onaylandı" ? "Onay Notu" : "Onayla"}
                        </Button>
                        {m.numuneDurum !== "Numune Reddedildi" && (
                          <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => numuneNotOkAc(m)}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reddet
                          </Button>
                        )}
                        {m.numuneDurum !== "Bekliyor" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => numuneSifirla(m)}>
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Genişletilebilir Açıklama / Sebep Metni (Mobil) */}
                      {m.numuneSebep && (
                        acikAciklamaIds[m.id] ? (
                          <div
                            onClick={() => toggleAciklama(m.id)}
                            className={`p-2.5 rounded-md border text-xs cursor-pointer transition-all ${
                              m.numuneDurum === "Numune Onaylandı"
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/50 text-emerald-900 dark:text-emerald-200"
                                : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700/50 text-red-900 dark:text-red-200"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold text-xs mb-1">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {m.numuneDurum === "Numune Onaylandı" ? "Onay Açıklaması:" : "Reddedilme Sebebi:"}
                              </span>
                              <ChevronUp className="w-4 h-4 opacity-70" />
                            </div>
                            <p className="whitespace-pre-wrap break-words leading-relaxed text-xs">
                              {m.numuneSebep}
                            </p>
                          </div>
                        ) : (
                          <div
                            onClick={() => toggleAciklama(m.id)}
                            className={`text-xs cursor-pointer p-2 rounded-md border flex items-center justify-between font-medium transition-colors ${
                              m.numuneDurum === "Numune Onaylandı"
                                ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                                : "bg-red-50/60 dark:bg-red-950/20 border-red-200 text-red-800 dark:text-red-300"
                            }`}
                          >
                            <span className="truncate pr-2">
                              {m.numuneDurum === "Numune Onaylandı" ? "Açıklama: " : "Sebep: "}{m.numuneSebep}
                            </span>
                            <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                          </div>
                        )
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

      {/* ───── Numune Onaylandı açıklama dialog ───── */}
      <Dialog open={!!okModel} onOpenChange={(o) => { if (!o) { setOkModel(null); setOkSebep(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5 text-green-600" /> Numune Onayla — Açıklama (Opsiyonel)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{okModel?.modelKodu}</span> modeli için onay açıklaması veya not yazabilirsiniz (isteğe bağlıdır).
            </p>
            <Textarea
              value={okSebep}
              onChange={(e) => setOkSebep(e.target.value)}
              rows={3}
              placeholder="Örn: Ölçüler tuttu, kalıp onaylandı, seri üretime uygundur..."
              data-testid="input-numune-ok-aciklama"
            />
            <p className="text-[11px] text-muted-foreground/80">
              * Açıklama girmek zorunlu değildir. Boş bırakarak da onaylayabilirsiniz.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOkModel(null); setOkSebep(""); }}>Vazgeç</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={numuneGuncelle.isPending}
              onClick={() => okModel && numuneGuncelle.mutate({ id: okModel.id, numuneDurum: "Numune Onaylandı", numuneSebep: okSebep.trim() })}
              data-testid="button-numune-ok-kaydet"
            >
              {numuneGuncelle.isPending ? "Kaydediliyor..." : "Onayla ve Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───── Numune Reddedildi sebep dialog ───── */}
      <Dialog open={!!notOkModel} onOpenChange={(o) => { if (!o) { setNotOkModel(null); setSebep(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" /> Numune Reddedildi — Sebep
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
              onClick={() => notOkModel && numuneGuncelle.mutate({ id: notOkModel.id, numuneDurum: "Numune Reddedildi", numuneSebep: sebep.trim() })}
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

      {/* ───── Modeli Düzenle Dialog ───── */}
      <Dialog open={!!editModel} onOpenChange={(o) => { if (!o) setEditModel(null); }}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" /> Tüm Verileri Düzenle
            </DialogTitle>
            <DialogDescription>
              {editModel?.modelKodu} — modelin tüm alanlarını tek ekrandan güncelleyin.
            </DialogDescription>
          </DialogHeader>
          {editModel && (
            <form onSubmit={(e) => {
              e.preventDefault();
              tumVeriGuncelle.mutate({
                id: editModel.id,
                data: {
                  grup: eForm.grup,
                  modelKodu: eForm.modelKodu.trim(),
                  kategori: eKategoriDegeri,
                  adet: Number(eForm.adet),
                  termin: eForm.termin,
                  girenKisi: eForm.girenKisi.trim(),
                  durum: eForm.durum,
                  numuneCinsi: eForm.numuneCinsi,
                  numuneDurum: eForm.numuneDurum,
                  // Bekliyor durumunda sebep/açıklama anlamını yitirir.
                  numuneSebep: eForm.numuneDurum === "Bekliyor" ? "" : eForm.numuneSebep.trim(),
                  kumasDurum: eForm.kumasDurum,
                  kumasHazirTarih: eForm.kumasHazirTarih,
                  kumasNot: eForm.kumasNot.trim(),
                }
              });
            }} className="space-y-5 pt-2">
              {/* 1. Ürün Bilgileri */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                  <Tag className="w-3.5 h-3.5" /> Ürün Bilgileri
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Grup</label>
                    <Select value={eForm.grup} onValueChange={eDegis("grup")}>
                      <SelectTrigger data-testid="edit-grup"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Model Kodu / Adı</label>
                    <Input value={eForm.modelKodu} onChange={(e) => eDegis("modelKodu")(e.target.value)} required data-testid="edit-modelkodu" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Kategori</label>
                    <Select value={eForm.kategori} onValueChange={(v) => { eDegis("kategori")(v); if (v !== DIGER_KATEGORI) setEKategoriDiger(""); }}>
                      <SelectTrigger data-testid="edit-kategori"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {eForm.kategori === DIGER_KATEGORI && (
                      <Input
                        value={eKategoriDiger}
                        onChange={(e) => setEKategoriDiger(e.target.value)}
                        placeholder="Kategori adını yazın"
                        required
                        data-testid="edit-kategori-diger"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Adet</label>
                    <Input type="number" min="1" value={eForm.adet} onChange={(e) => eDegis("adet")(e.target.value)} required data-testid="edit-adet" />
                  </div>
                </div>
              </div>

              {/* 2. Tarih, Kişi & Durum */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> Tarih, Kişi & Durum
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Termin Tarihi</label>
                    <Input type="date" value={eForm.termin} onChange={(e) => eDegis("termin")(e.target.value)} required data-testid="edit-termin" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Giren Kişi</label>
                    <Input list="giren-kisi-list" value={eForm.girenKisi} onChange={(e) => eDegis("girenKisi")(e.target.value)} required autoComplete="off" data-testid="edit-giren" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Üretim Durumu</label>
                    <Select value={eForm.durum} onValueChange={eDegis("durum")}>
                      <SelectTrigger data-testid="edit-durum"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 3. Numune */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                  <Scissors className="w-3.5 h-3.5" /> Numune
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Numune Cinsi</label>
                    <Select value={eForm.numuneCinsi} onValueChange={eDegis("numuneCinsi")}>
                      <SelectTrigger data-testid="edit-numune-cinsi"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NUMUNE_CINSLERI.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Numune Durumu</label>
                    <Select value={eForm.numuneDurum} onValueChange={eDegis("numuneDurum")}>
                      <SelectTrigger data-testid="edit-numune-durum"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NUMUNE_DURUMLARI.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {eForm.numuneDurum !== "Bekliyor" && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {eForm.numuneDurum === "Numune Onaylandı" ? "Onay Açıklaması" : "Reddedilme Sebebi"}
                    </label>
                    <Textarea
                      value={eForm.numuneSebep}
                      onChange={(e) => eDegis("numuneSebep")(e.target.value)}
                      rows={2}
                      placeholder="Örn: Ölçü tutmadı, kumaş rengi farklı..."
                      data-testid="edit-numune-sebep"
                    />
                  </div>
                )}
              </div>

              {/* 4. Kumaş */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 border-b pb-1.5">
                  <Layers className="w-3.5 h-3.5" /> Kumaş
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Kumaş Durumu</label>
                    <Select value={eForm.kumasDurum} onValueChange={eDegis("kumasDurum")}>
                      <SelectTrigger data-testid="edit-kumas-durum"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KUMAS_ASAMALARI.map((a) => <SelectItem key={a} value={a}>{a === "Belirtilmedi" ? "— Belirtilmedi" : a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Kumaş Hazır Tarihi</label>
                    <Input type="date" value={eForm.kumasHazirTarih} onChange={(e) => eDegis("kumasHazirTarih")(e.target.value)} data-testid="edit-kumas-tarih" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Kumaş Notu</label>
                  <Textarea
                    value={eForm.kumasNot}
                    onChange={(e) => eDegis("kumasNot")(e.target.value)}
                    rows={2}
                    placeholder="Örn: Boyahaneden yarın gelecek, 2 top eksik..."
                    data-testid="edit-kumas-not"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditModel(null)}>Vazgeç</Button>
                <Button
                  type="submit"
                  disabled={tumVeriGuncelle.isPending || !eForm.modelKodu.trim() || !eForm.girenKisi.trim() || Number(eForm.adet) <= 0}
                  data-testid="edit-kaydet"
                >
                  {tumVeriGuncelle.isPending ? "Kaydediliyor..." : "Tümünü Kaydet"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
