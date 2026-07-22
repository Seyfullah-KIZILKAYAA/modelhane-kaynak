import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scissors, LayoutDashboard, PlusSquare, ListOrdered, LogOut, Moon, Sun, Route, Settings, Menu } from "lucide-react";
import Login from "@/pages/login";
import ModelGiris from "@/pages/model-giris";
import Siralama from "@/pages/siralama";
import Panel from "@/pages/panel";
import Durumum from "@/pages/durumum";
import Ayarlar from "@/pages/ayarlar";
import UpdateDialog from "@/components/update-dialog";

type Role = "kullanici" | "yonetici";
type Tab = "giris" | "siralama" | "panel" | "durumum" | "ayarlar";

import { useTheme } from "@/hooks/use-theme";

function Shell({ role, grup, onLogout }: { role: Role; grup: string | null; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>(role === "yonetici" ? "panel" : "giris");
  const [isOpen, setIsOpen] = useState(true);

  const navItems: { key: Tab; label: string; icon: any }[] = [
    ...(role === "yonetici" ? [{ key: "panel" as Tab, label: "Kontrol Paneli", icon: LayoutDashboard }] : []),
    { key: "giris", label: "Model Girişi", icon: PlusSquare },
    ...(role === "kullanici" ? [{ key: "durumum" as Tab, label: "Üretim Durumum", icon: Route }] : []),
    ...(role === "yonetici" ? [{ key: "siralama" as Tab, label: "Üretim Sıralama", icon: ListOrdered }] : []),
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sol Menü (Sidebar) */}
      <aside className={`flex flex-col border-r bg-card/80 backdrop-blur transition-all duration-300 ${isOpen ? "w-64" : "w-16"}`}>
        {/* Menü Üst - Logo ve Hamburger */}
        <div className="h-14 flex items-center justify-between px-3 border-b shrink-0">
          {isOpen && (
            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Scissors className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm md:text-base">Modelhane</span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className={!isOpen ? "mx-auto" : ""} data-testid="button-menu">
            <Menu className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Navigasyon Linkleri */}
        <div className="flex-1 py-4 flex flex-col gap-2 px-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((n) => (
            <button
              key={n.key}
              onClick={() => setTab(n.key)}
              title={!isOpen ? n.label : undefined}
              data-testid={`tab-${n.key}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                tab === n.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <n.icon className="w-5 h-5 shrink-0" />
              {isOpen && <span>{n.label}</span>}
            </button>
          ))}
        </div>
        
        {/* Menü Alt - Ayarlar, Tema, Çıkış */}
        <div className="p-2 border-t flex flex-col gap-2 shrink-0">
           {isOpen && (
             <div className="px-3 py-2 flex items-center gap-2 mb-1">
               <Badge variant="secondary" className="truncate">
                 {role === "yonetici" ? "Ana Yönetici" : grup ?? "Model Girişi"}
               </Badge>
             </div>
           )}
           <Button
             variant={tab === "ayarlar" ? "secondary" : "ghost"}
             className={`justify-start ${!isOpen ? "px-0 justify-center" : ""}`}
             onClick={() => setTab("ayarlar")}
             title="Ayarlar"
             data-testid="button-settings"
           >
             <Settings className="w-5 h-5 shrink-0" />
             {isOpen && <span className="ml-3">Ayarlar</span>}
           </Button>
           <Button variant="ghost" className={`justify-start ${!isOpen ? "px-0 justify-center text-red-500 hover:text-red-600" : "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"}`} onClick={onLogout} title="Çıkış" data-testid="button-logout">
            <LogOut className="w-5 h-5 shrink-0" />
            {isOpen && <span className="ml-3">Çıkış</span>}
           </Button>
        </div>
      </aside>

      {/* Ana İçerik Alanı */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/10 relative">
        <header className="h-14 border-b bg-card/80 backdrop-blur sticky top-0 z-30 flex items-center px-4 md:px-6 shrink-0">
           <h1 className="text-lg font-semibold">{navItems.find(n => n.key === tab)?.label || (tab === "ayarlar" ? "Ayarlar" : "")}</h1>
        </header>
        <div className="flex-1 overflow-auto">
          {tab === "panel" && role === "yonetici" && <Panel />}
          {tab === "giris" && <ModelGiris isYonetici={role === "yonetici"} grup={grup} />}
          {tab === "durumum" && role === "kullanici" && <Durumum grup={grup} />}
          {tab === "siralama" && role === "yonetici" && <Siralama />}
          {tab === "ayarlar" && <Ayarlar role={role} />}
        </div>
      </main>
    </div>
  );
}

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [grup, setGrup] = useState<string | null>(null);
  const [kontrol, setKontrol] = useState(true);

  // Tema kancasını en üstte çağırarak varsayılan temayı uygula
  useTheme();

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
        <UpdateDialog />
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
