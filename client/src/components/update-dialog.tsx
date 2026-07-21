import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Download, RefreshCw, AlertCircle } from "lucide-react";

// preload.cjs üzerinden açığa çıkan Electron API tipi.
interface ElectronUpdater {
  onUpdateAvailable: (cb: (info: { version: string; releaseNotes: string }) => void) => void;
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => void;
  onDownloadProgress: (cb: (progress: { percent: number; transferred: number; total: number }) => void) => void;
  onUpdateError: (cb: (message: string) => void) => void;
  startDownload: () => void;
  installAndRestart: () => void;
}

declare global {
  interface Window {
    electronUpdater?: ElectronUpdater;
  }
}

type Stage = "idle" | "available" | "downloading" | "ready" | "error";

export default function UpdateDialog() {
  const [stage, setStage] = useState<Stage>("idle");
  const [version, setVersion] = useState("");
  const [percent, setPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const updater = window.electronUpdater;
    // Electron dışında çalışıyorsa (tarayıcı) hiçbir şey yapma.
    if (!updater) return;

    updater.onUpdateAvailable((info) => {
      setVersion(info.version);
      setStage("available");
    });

    updater.onDownloadProgress((progress) => {
      setPercent(progress.percent);
      setStage("downloading");
    });

    updater.onUpdateDownloaded(() => {
      setStage("ready");
    });

    updater.onUpdateError((message) => {
      setErrorMsg(message);
      setStage("error");
    });
  }, []);

  const handleDownload = () => {
    window.electronUpdater?.startDownload();
    setStage("downloading");
    setPercent(0);
  };

  const handleInstall = () => {
    window.electronUpdater?.installAndRestart();
  };

  const handleDismiss = () => {
    setStage("idle");
  };

  const isOpen = stage !== "idle";

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md" data-testid="update-dialog">
        {/* ─── Güncelleme Mevcut ─── */}
        {stage === "available" && (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <AlertDialogTitle>Güncelleme Mevcut</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                Yeni bir sürüm mevcut:{" "}
                <span className="font-semibold text-foreground">v{version}</span>.
                Uygulamayı şimdi güncellemek ister misiniz?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDismiss} data-testid="update-cancel">
                İptal
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDownload} data-testid="update-download">
                <Download className="w-4 h-4 mr-1" /> Güncelle
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}

        {/* ─── İndirme Devam Ediyor ─── */}
        {stage === "downloading" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Güncelleme İndiriliyor…</AlertDialogTitle>
              <AlertDialogDescription>
                Lütfen bekleyin. İndirme tamamlandığında uygulama yeniden başlatılacak.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 space-y-2">
              <Progress value={percent} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">%{percent}</p>
            </div>
          </>
        )}

        {/* ─── İndirme Tamamlandı ─── */}
        {stage === "ready" && (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-green-600" />
                </div>
                <AlertDialogTitle>Güncelleme Hazır</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                Güncelleme başarıyla indirildi. Uygulamayı yeniden başlatarak{" "}
                <span className="font-semibold text-foreground">v{version}</span>{" "}
                sürümüne geçebilirsiniz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDismiss} data-testid="update-later">
                Sonra
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleInstall} data-testid="update-install">
                <RefreshCw className="w-4 h-4 mr-1" /> Yeniden Başlat
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}

        {/* ─── Hata ─── */}
        {stage === "error" && (
          <>
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <AlertDialogTitle>Güncelleme Hatası</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                Güncelleme sırasında bir hata oluştu: {errorMsg}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleDismiss} data-testid="update-error-close">
                Tamam
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
