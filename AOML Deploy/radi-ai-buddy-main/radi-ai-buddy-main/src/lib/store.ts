import { useState, useEffect, useCallback, useRef } from "react";
import type { Language } from "./i18n";
import type { PredictionResult } from "./api";

export interface HistoryItem {
  id: string;
  timestamp: number;
  imageUrl: string;
  result: PredictionResult;
  symptoms?: string;
}

export function useLanguage() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("med-lang");
    return saved === "hi" || saved === "mr" ? saved : "en";
  });

  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("med-lang", lang);
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  return { language, changeLanguage };
}

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem("med-dark") === "true";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("med-dark", String(dark));
  }, [dark]);

  return { dark, toggleDark: () => setDark((d) => !d) };
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const ownedUrls = useRef(new Set<string>());
  useEffect(() => {
    localStorage.removeItem("med-history");
    const urls = ownedUrls.current;
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  const addToHistory = useCallback((item: Omit<HistoryItem, "id" | "timestamp">) => {
    ownedUrls.current.add(item.imageUrl);
    setHistory((prev) => {
      const next = [
        { ...item, id: crypto.randomUUID(), timestamp: Date.now() },
        ...prev,
      ].slice(0, 20);
      return next;
    });
  }, []);

  useEffect(() => {
    const retained = new Set(history.map(item => item.imageUrl));
    ownedUrls.current.forEach(url => {
      if (!retained.has(url)) { URL.revokeObjectURL(url); ownedUrls.current.delete(url); }
    });
  }, [history]);
  const clearHistory = useCallback(() => setHistory([]), []);
  return { history, addToHistory, clearHistory };
}
