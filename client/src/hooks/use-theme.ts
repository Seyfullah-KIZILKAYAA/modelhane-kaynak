import { useState, useEffect } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored) return stored === "dark";
      return false; // Default to light mode
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.add("light");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Handle global synchronization
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem("theme");
      setIsDark(stored === "dark");
    };
    const handleCustomEvent = (e: CustomEvent) => {
      setIsDark(e.detail === "dark");
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("theme-change", handleCustomEvent as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("theme-change", handleCustomEvent as EventListener);
    };
  }, []);

  const setTheme = (dark: boolean) => {
    setIsDark(dark);
    window.dispatchEvent(new CustomEvent("theme-change", { detail: dark ? "dark" : "light" }));
  };

  return { isDark, setTheme };
}
