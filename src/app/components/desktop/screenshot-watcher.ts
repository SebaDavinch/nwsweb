import { isTauri } from "./use-tauri";

const FOLDER_KEY = "nws.screenshot.folder";
const SEEN_KEY = "nws.screenshot.seen";
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;

export function getWatchFolder(): string {
  try {
    return window.localStorage.getItem(FOLDER_KEY) || "";
  } catch {
    return "";
  }
}
export function setWatchFolder(path: string) {
  try {
    window.localStorage.setItem(FOLDER_KEY, path);
  } catch {
    /* ignore */
  }
}

function getSeen(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveSeen(seen: Set<string>) {
  try {
    // держим хвост, чтобы список не рос бесконечно
    const arr = Array.from(seen).slice(-2000);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

/** Открыть системный диалог выбора папки (только в Tauri). Возвращает путь или "". */
export async function pickFolder(): Promise<string> {
  if (!isTauri()) return "";
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false });
    return typeof selected === "string" ? selected : "";
  } catch {
    return "";
  }
}

async function uploadDataUrl(fileName: string, dataUrl: string, mimeType: string) {
  await fetch("/api/pilot/social-gallery/media", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: dataUrl,
      mimeType,
      fileName,
      title: fileName.replace(/\.[^.]+$/, ""),
    }),
  }).catch(() => null);
}

function mimeFromName(name: string): string {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.webp$/i.test(name)) return "image/webp";
  return "image/jpeg";
}

function toDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Запускает наблюдение за папкой скриншотов: при появлении нового файла-картинки
 * читает его и загружает в пользовательскую галерею. Возвращает функцию остановки.
 * Работает только в Tauri (нужен доступ к ФС). onNew — колбэк для тоста/подсказки.
 */
export async function startScreenshotWatch(
  folder: string,
  onNew?: (fileName: string) => void
): Promise<() => void> {
  if (!isTauri() || !folder) return () => {};
  try {
    const { watchImmediate, readFile, readDir } = await import("@tauri-apps/plugin-fs");
    const seen = getSeen();

    // помечаем существующие файлы как уже виденные, чтобы не заливать всю папку
    try {
      const entries = await readDir(folder);
      for (const e of entries) {
        if (e.isFile && IMAGE_RE.test(e.name)) seen.add(`${folder}/${e.name}`);
      }
      saveSeen(seen);
    } catch {
      /* ignore */
    }

    const handle = async (paths: string[]) => {
      for (const full of paths) {
        const name = full.split(/[\\/]/).pop() || "";
        if (!IMAGE_RE.test(name) || seen.has(full)) continue;
        seen.add(full);
        saveSeen(seen);
        try {
          // небольшая пауза, чтобы файл успел дозаписаться
          await new Promise((r) => setTimeout(r, 600));
          const bytes = await readFile(full);
          const mime = mimeFromName(name);
          await uploadDataUrl(name, toDataUrl(bytes, mime), mime);
          onNew?.(name);
        } catch {
          /* ignore */
        }
      }
    };

    const unwatch = await watchImmediate(
      folder,
      (event) => {
        const paths = Array.isArray((event as { paths?: string[] }).paths)
          ? (event as { paths: string[] }).paths
          : [];
        void handle(paths);
      },
      { recursive: false }
    );
    return unwatch;
  } catch {
    return () => {};
  }
}

export function isWatchSupported(): boolean {
  return isTauri();
}

export interface FolderImage {
  path: string;
  name: string;
}

/** Список картинок в папке (последние сверху по имени). Только Tauri. */
export async function listFolderImages(folder: string, limit = 40): Promise<FolderImage[]> {
  if (!isTauri() || !folder) return [];
  try {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const entries = await readDir(folder);
    return entries
      .filter((e) => e.isFile && IMAGE_RE.test(e.name))
      .map((e) => ({ path: `${folder}/${e.name}`, name: e.name }))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** Прочитать файл-картинку как data URL (для превью и загрузки). Только Tauri. */
export async function readImageAsDataUrl(path: string): Promise<{ dataUrl: string; mime: string; name: string } | null> {
  if (!isTauri() || !path) return null;
  try {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const name = path.split(/[\\/]/).pop() || "image";
    const mime = mimeFromName(name);
    const bytes = await readFile(path);
    return { dataUrl: toDataUrl(bytes, mime), mime, name };
  } catch {
    return null;
  }
}
