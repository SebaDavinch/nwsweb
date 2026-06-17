import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type AppTheme = "light" | "dark";

const STORAGE_KEY = "nws.app.theme";

function readInitial(): AppTheme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

// Простой внешний стор — чтобы все потребители (оболочка, настройки, онбординг)
// видели одно состояние темы и синхронно перерисовывались.
let current: AppTheme = readInitial();
const listeners = new Set<() => void>();

function setThemeStore(next: AppTheme) {
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Красивое переключение темы: круговой reveal новой темы из точки клика
 * через View Transitions API (поддержка в WebView2/Chromium). Fallback — обычное переключение.
 */
function toggleThemeAnimated(next: AppTheme, origin?: { x: number; y: number }) {
  const start = (document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> };
  }).startViewTransition;
  if (typeof start !== "function" || prefersReducedMotion()) {
    setThemeStore(next);
    return;
  }
  const x = origin?.x ?? window.innerWidth - 40;
  const y = origin?.y ?? 24;
  // максимальный радиус до самого дальнего угла экрана
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  let transition;
  try {
    transition = start.call(document, () => {
      // синхронный коммит React, чтобы VT снял корректный «после»-снимок
      flushSync(() => setThemeStore(next));
    });
  } catch {
    // Если View Transition не запустился — просто меняем тему без анимации.
    setThemeStore(next);
    return;
  }

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
        },
        {
          duration: 480,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    })
    .catch(() => {
      /* анимация необязательна */
    });
}

/**
 * Тема десктоп-приложения (светлая/тёмная). Класс `dark` вешается на корневой
 * контейнер AppShell, поэтому `dark:`-варианты Tailwind работают только внутри
 * приложения. Состояние общее для всех вызовов хука.
 */
export function useAppTheme() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return {
    theme: current,
    isDark: current === "dark",
    setTheme: (t: AppTheme) => setThemeStore(t),
    toggle: () => setThemeStore(current === "dark" ? "light" : "dark"),
    /** Анимированное переключение с круговым reveal из точки клика (origin). */
    toggleAnimated: (origin?: { x: number; y: number }) =>
      toggleThemeAnimated(current === "dark" ? "light" : "dark", origin),
  };
}
