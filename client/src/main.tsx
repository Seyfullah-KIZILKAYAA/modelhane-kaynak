import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { globalHataYakalamaBaslat } from "./lib/hata-bildirimi";

// Yakalanmamış JS hatalarını ve Promise reddedilmelerini bildirim olarak göster.
globalHataYakalamaBaslat();

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
