"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const KEY = "staybattle:theme";

function readInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  try {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  } catch {}
  return "dark";
}

function applyToHtml(theme: Theme, animate = false) {
  if (typeof document === "undefined") return;
  if (animate) {
    // Temporarily enable global color/background/border transitions so the
    // swap eases instead of flashing. CSS scopes the transition to elements
    // under `.theme-transitioning` only — we remove the class once the
    // animation has had time to play.
    document.documentElement.classList.add("theme-transitioning");
    window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning");
    }, 450);
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function useTheme(): {
  theme: Theme;
  ready: boolean;
  toggle: () => void;
  set: (t: Theme) => void;
} {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = readInitial();
    setTheme(initial);
    applyToHtml(initial);
    setReady(true);

    // Stay in sync across tabs.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      const v = e.newValue === "light" ? "light" : "dark";
      setTheme(v);
      applyToHtml(v);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = (t: Theme) => {
    setTheme(t);
    applyToHtml(t, true);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  };

  const toggle = () => set(theme === "dark" ? "light" : "dark");

  return { theme, ready, toggle, set };
}
