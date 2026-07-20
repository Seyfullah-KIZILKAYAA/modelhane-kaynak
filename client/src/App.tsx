import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scissors, LayoutDashboard, PlusSquare, ListOrdered, LogOut, Moon, Sun, Route, Settings } from "lucide-react";
import Login from "@/pages/login";
import ModelGiris from "@/pages/model-giris";
import Siralama from "@/pages/siralama";
import Panel from "@/pages/panel";
import Durumum from "@/pages/durumum";
import Ayarlar from "@/pages/ayarlar";

type Role = "kullanici" | "yonetici";
type Tab = "giris" | "siralama" | "panel" | "durumum" | "ayarlar";

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, setDark };
}

function Shell({ role, grup, onLogout }: { role: Role; grup: string | null; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>(role === "yonetici" ? "panel" : "giris");
  const { dark, setDark } = useDarkMode();

  const navItems: { key: Tab; label: string; icon: any }[] = [
    ...(role === "yonetici" ? [{ key: "panel" as Tab, label: "Kontrol Paneli", icon: LayoutDashboard }] : []),
    { key: "giris", label: "Model Girişi", icon: PlusSquare },
    ...(role === "kullanici" ? [{ key: "durumum" as Tab, label: "Üretim Durumum", icon: Route }] : []),
    ...(role === "yonetici" ? [{ key: "siralama" as Tab, label: "Üretim Sıralama", icon: ListOrdered }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Üst bar */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Scissors className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm md:text-base">Modelhane Planlama</span>
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
              {role === "yonetici" ? "Ana Yönetici" : grup ?? "Model Girişi"}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {role === "yonetici" && (
              <Button
                variant={tab === "ayarlar" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setTab("ayarlar")}
                title="Ayarlar"
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} data-testid="button-theme">
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout} data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-1" /> Çıkış
            </Button>
          </div>
        </div>
        {/* Sekmeler */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {navItems.map((n) => (
            <button
              key={n.key}
              onClick={() => setTab(n.key)}
              data-testid={`tab-${n.key}`}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === n.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <n.icon className="w-4 h-4" /> {n.label}
            </button>
          ))}
        </div>
      </header>

      <main>
        {tab === "panel" && role === "yonetici" && <Panel />}
        {tab === "giris" && <ModelGiris isYonetici={role === "yonetici"} grup={grup} />}
        {tab === "durumum" && role === "kullanici" && <Durumum grup={grup} />}
        {tab === "siralama" && role === "yonetici" && <Siralama />}
        {tab === "ayarlar" && role === "yonetici" && <Ayarlar />}
      </main>
    </div>
  );
}

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [grup, setGrup] = useState<string | null>(null);
  const [kontrol, setKontrol] = useState(true);

  // Sayfa yenilendiğinde sunucudaki oturumu geri yükle.
  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.role) {
          setRole(d.role as Role);
          setGrup(d.grup ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setKontrol(false));
  }, []);

  const handleLogin = (r: Role, g: string | null) => {
    setRole(r);
    setGrup(g);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {
      // Sunucuya ulaşılamasa da yerel oturumu kapat.
    }
    // Önceki kullanıcının verisi ekranda kalmasın.
    queryClient.clear();
    setRole(null);
    setGrup(null);
  };

  if (kontrol) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {role ? (
          <Shell role={role} grup={grup} onLogout={handleLogout} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
