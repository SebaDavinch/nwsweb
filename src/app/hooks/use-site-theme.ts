import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type SiteTheme = "light" | "dark";

const STORAGE_KEY = "nws.site.theme";

function readInitial(): SiteTheme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "dark" ? "dark" : "light";
}

let current: SiteTheme = readInitial();
const listeners = new Set<() => void>();

function applyThemeClass(t: SiteTheme) {
  if (t === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function setThemeStore(next: SiteTheme) {
  if (next === current) return;
  current = next;
  try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  applyThemeClass(next);
  listeners.forEach((l) => l());
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function toggleThemeAnimated(next: SiteTheme, origin?: { x: number; y: number }) {
  const start = (document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> };
  }).startViewTransition;

  if (typeof start !== "function" || prefersReducedMotion()) {
    setThemeStore(next);
    return;
  }

  const x = origin?.x ?? window.innerWidth - 60;
  const y = origin?.y ?? 34;
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  let transition;
  try {
    transition = start.call(document, () => {
      flushSync(() => setThemeStore(next));
    });
  } catch {
    setThemeStore(next);
    return;
  }

  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 480, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => { /* animation is optional */ });
}

export function useSiteTheme() {
  const [, force] = useState(0);

  useEffect(() => {
    applyThemeClass(current);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  return {
    theme: current,
    isDark: current === "dark",
    toggleAnimated: (origin?: { x: number; y: number }) =>
      toggleThemeAnimated(current === "dark" ? "light" : "dark", origin),
  };
}
