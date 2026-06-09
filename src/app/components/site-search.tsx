import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  FileText,
  Loader2,
  Plane,
  Route,
  Search,
  Sparkles,
  Users,
  X,
  Radio,
} from "lucide-react";
import { useLanguage } from "../context/language-context";

// ── Question detection ────────────────────────────────────────────────────────

const QUESTION_WORDS_RU = /^(какие|какой|какая|какое|есть|сколько|где|когда|как|что|кто|почему|зачем|можно|покажи|найди|расскажи|дай|перечисли|список)/;
const QUESTION_WORDS_EN = /^(what|which|how|where|when|is there|are there|show|find|tell|give|list|do you|does)/;

const isQuestion = (q: string): boolean => {
  const lower = q.toLowerCase().trim();
  return q.includes("?") || QUESTION_WORDS_RU.test(lower) || QUESTION_WORDS_EN.test(lower);
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = "fleet" | "route" | "airport" | "livery" | "staff" | "news" | "document";

interface SearchItem {
  id: string;
  category: Category;
  title: string;
  subtitle?: string;
  badge?: string;
  url: string;
  keywords: string;
}

// ── Module-level cache (survives re-renders, resets on page load) ─────────────

let indexCache: SearchItem[] | null = null;
let indexFetchPromise: Promise<SearchItem[]> | null = null;

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const safeGet = async (url: string, auth = false) => {
  try {
    const r = await fetch(url, auth ? { credentials: "include" } : undefined);
    if (!r.ok) return null;
    return r.json().catch(() => null);
  } catch {
    return null;
  }
};

const buildIndex = async (): Promise<SearchItem[]> => {
  const items: SearchItem[] = [];

  const [staffData, newsData, docsData, fleetData, routesData] = await Promise.all([
    safeGet("/api/public/staff"),
    safeGet("/api/public/news"),
    safeGet("/api/public/documents"),
    safeGet("/api/vamsys/fleet", true),
    safeGet("/api/vamsys/routes", true),
  ]);

  // Staff
  for (const m of Array.isArray(staffData?.staff) ? staffData.staff : []) {
    const name = String(m?.name || "").trim();
    if (!name) continue;
    items.push({
      id: `staff-${m.id}`,
      category: "staff",
      title: name,
      subtitle: String(m?.role || "").trim() || undefined,
      url: "/team",
      keywords: [name, m?.role, m?.username, m?.handle].filter(Boolean).join(" "),
    });
  }

  // News / activities
  for (const n of Array.isArray(newsData?.news) ? newsData.news : []) {
    const title = String(n?.title || n?.name || "").trim();
    if (!title) continue;
    items.push({
      id: `news-${n.id}`,
      category: "news",
      title,
      subtitle: String(n?.summary || n?.body || "").slice(0, 80).trim() || undefined,
      url: "/news",
      keywords: [title, n?.summary, n?.body].filter(Boolean).join(" "),
    });
  }

  // Documents
  for (const d of Array.isArray(docsData?.documents) ? docsData.documents : []) {
    const title = String(d?.title || d?.name || "").trim();
    if (!title) continue;
    items.push({
      id: `doc-${d.id || d.slug}`,
      category: "document",
      title,
      subtitle: String(d?.description || d?.summary || "").slice(0, 80).trim() || undefined,
      url: "/documents",
      keywords: [title, d?.description, d?.summary].filter(Boolean).join(" "),
    });
  }

  // Fleet — groups and individual aircraft
  const fleets: unknown[] = Array.isArray(fleetData?.fleets) ? fleetData.fleets : [];
  const airportSet = new Map<string, string>(); // ICAO → name

  for (const fleet of fleets) {
    if (!fleet || typeof fleet !== "object") continue;
    const f = fleet as Record<string, unknown>;
    const fleetName = String(f.name || "").trim();
    const fleetCode = String(f.code || "").trim();
    const airline = String(f.airline || f.airlineName || "").trim();
    if (!fleetName && !fleetCode) continue;

    items.push({
      id: `fleet-${f.id}`,
      category: "fleet",
      title: fleetName || fleetCode,
      subtitle: airline || undefined,
      badge: fleetCode || undefined,
      url: "/fleet",
      keywords: [fleetName, fleetCode, airline].filter(Boolean).join(" "),
    });

    // Individual aircraft
    const aircraft: unknown[] = Array.isArray(f.aircraft) ? (f.aircraft as unknown[]) : [];
    for (const ac of aircraft) {
      if (!ac || typeof ac !== "object") continue;
      const a = ac as Record<string, unknown>;
      const reg = String(a.registration || "").trim();
      const model = String(a.model || fleetName || "").trim();
      if (!reg) continue;

      items.push({
        id: `ac-${a.id || reg}`,
        category: "fleet",
        title: reg,
        subtitle: model || undefined,
        badge: fleetCode || undefined,
        url: "/fleet",
        keywords: [reg, model, fleetCode, airline].filter(Boolean).join(" "),
      });

      // Liveries from aircraft
      const liveries: unknown[] = Array.isArray(a.liveries)
        ? (a.liveries as unknown[])
        : [];
      for (const lv of liveries) {
        if (!lv || typeof lv !== "object") continue;
        const l = lv as Record<string, unknown>;
        const lvName = String(l.name || l.label || l.livery || "").trim();
        if (!lvName) continue;
        items.push({
          id: `livery-${a.id}-${l.id || lvName}`,
          category: "livery",
          title: lvName,
          subtitle: `${reg} · ${model}`,
          badge: fleetCode || undefined,
          url: String(l.url || l.downloadUrl || "/fleet"),
          keywords: [lvName, reg, model, fleetCode].filter(Boolean).join(" "),
        });
      }
    }
  }

  // Routes + airports
  const routes: unknown[] = Array.isArray(routesData?.routes) ? routesData.routes : [];
  for (const r of routes) {
    if (!r || typeof r !== "object") continue;
    const route = r as Record<string, unknown>;
    const from = String(route.fromCode || "").trim().toUpperCase();
    const to = String(route.toCode || "").trim().toUpperCase();
    const fromName = String(route.fromName || "").trim();
    const toName = String(route.toName || "").trim();
    const airline = String(route.airlineCode || "").trim();
    if (!from || !to) continue;

    items.push({
      id: `route-${route.id || `${from}-${to}`}`,
      category: "route",
      title: `${from} → ${to}`,
      subtitle: [fromName, toName].filter(Boolean).join(" → ") || undefined,
      badge: airline || undefined,
      url: "/routes",
      keywords: [from, to, fromName, toName, airline].filter(Boolean).join(" "),
    });

    if (from && !airportSet.has(from)) airportSet.set(from, fromName);
    if (to && !airportSet.has(to)) airportSet.set(to, toName);
  }

  for (const [code, name] of airportSet.entries()) {
    items.push({
      id: `airport-${code}`,
      category: "airport",
      title: code,
      subtitle: name || undefined,
      url: "/routes",
      keywords: [code, name].filter(Boolean).join(" "),
    });
  }

  return items;
};

const getIndex = (): Promise<SearchItem[]> => {
  if (indexCache) return Promise.resolve(indexCache);
  if (indexFetchPromise) return indexFetchPromise;
  indexFetchPromise = buildIndex().then((items) => {
    indexCache = items;
    indexFetchPromise = null;
    return items;
  });
  return indexFetchPromise;
};

// ── Search logic ──────────────────────────────────────────────────────────────

// Stop-words to strip before matching
const STOP_WORDS = new Set([
  "из", "в", "до", "от", "на", "по", "к", "за", "через",
  "какие", "какой", "есть", "есть", "все", "рейсы", "рейс",
  "маршруты", "маршрут", "полёты", "полёт", "самолёт",
  "from", "to", "the", "are", "is", "there", "any", "what",
  "flights", "routes", "which",
]);

interface ParsedQuery {
  fromTerm: string;   // text after "из" / "from"
  toTerm: string;     // text after "в"/"до" / "to"
  words: string[];    // remaining meaningful words
  raw: string;        // full lowercased query
}

const parseQuery = (q: string): ParsedQuery => {
  const lower = q.toLowerCase().trim();

  // "из X в Y" / "from X to Y"
  const fromToRu = lower.match(/из\s+(.+?)\s+(?:в|до)\s+(.+)/);
  const fromToEn = lower.match(/from\s+(.+?)\s+to\s+(.+)/);
  if (fromToRu) {
    return { fromTerm: fromToRu[1].trim(), toTerm: fromToRu[2].trim(), words: [], raw: lower };
  }
  if (fromToEn) {
    return { fromTerm: fromToEn[1].trim(), toTerm: fromToEn[2].trim(), words: [], raw: lower };
  }

  // "из X" / "from X"
  const fromRu = lower.match(/из\s+(\S+(?:\s+\S+)?)/);
  const fromEn = lower.match(/from\s+(\S+(?:\s+\S+)?)/);
  if (fromRu) return { fromTerm: fromRu[1].trim(), toTerm: "", words: [], raw: lower };
  if (fromEn) return { fromTerm: fromEn[1].trim(), toTerm: "", words: [], raw: lower };

  // "в X" / "до X" / "to X"
  const toRu = lower.match(/(?:^|\s)(?:в|до)\s+(\S+(?:\s+\S+)?)/);
  const toEn = lower.match(/to\s+(\S+(?:\s+\S+)?)/);
  if (toRu) return { fromTerm: "", toTerm: toRu[1].trim(), words: [], raw: lower };
  if (toEn) return { fromTerm: "", toTerm: toEn[1].trim(), words: [], raw: lower };

  // Plain keyword search — strip stop-words, keep meaningful terms
  const words = lower
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  return { fromTerm: "", toTerm: "", words, raw: lower };
};

// ── Template-based answer generator (no AI needed) ───────────────────────────

function generateAnswer(raw: string, q: ParsedQuery, results: SearchItem[], language: string): string | null {
  const ru = language === "ru";

  // Directional route queries
  if (q.fromTerm || q.toTerm) {
    const routes = results.filter((r) => r.category === "route");
    if (routes.length === 0) {
      return ru
        ? `Рейсов${q.fromTerm ? ` из ${q.fromTerm.toUpperCase()}` : ""}${q.toTerm ? ` в ${q.toTerm.toUpperCase()}` : ""} в расписании не найдено.`
        : `No flights${q.fromTerm ? ` from ${q.fromTerm.toUpperCase()}` : ""}${q.toTerm ? ` to ${q.toTerm.toUpperCase()}` : ""} found in the schedule.`;
    }
    if (q.fromTerm && !q.toTerm) {
      const dests = [...new Set(routes.map((r) => r.title.split("→")[1]?.trim()).filter(Boolean))].slice(0, 8);
      const more = routes.length > dests.length ? ` ${ru ? "и ещё" : "and"} ${routes.length - dests.length}` : "";
      return ru
        ? `Из ${q.fromTerm.toUpperCase()} есть рейсы в: ${dests.join(", ")}${more}.`
        : `From ${q.fromTerm.toUpperCase()} there are flights to: ${dests.join(", ")}${more}.`;
    }
    if (!q.fromTerm && q.toTerm) {
      const origins = [...new Set(routes.map((r) => r.title.split("→")[0]?.trim()).filter(Boolean))].slice(0, 8);
      const more = routes.length > origins.length ? ` ${ru ? "и ещё" : "and"} ${routes.length - origins.length}` : "";
      return ru
        ? `В ${q.toTerm.toUpperCase()} можно долететь из: ${origins.join(", ")}${more}.`
        : `To ${q.toTerm.toUpperCase()} you can fly from: ${origins.join(", ")}${more}.`;
    }
    const count = routes.length;
    return ru
      ? `Найдено ${count} рейс${count === 1 ? "" : count < 5 ? "а" : "ов"} из ${q.fromTerm!.toUpperCase()} в ${q.toTerm!.toUpperCase()}.`
      : `Found ${count} flight${count !== 1 ? "s" : ""} from ${q.fromTerm!.toUpperCase()} to ${q.toTerm!.toUpperCase()}.`;
  }

  const lower = raw.toLowerCase();

  // Join / registration
  if (/вступ|присоедин|регистр|как стать|начать летать/.test(lower) || /join|register|sign[\s-]?up|how to start/.test(lower)) {
    return ru
      ? "Чтобы вступить, открой страницу «Вступить» — регистрация через vAMSYS занимает пару минут. После этого тебе назначат каллсайн и откроется личный кабинет пилота."
      : "To join, go to the Join page — registration via vAMSYS takes a couple of minutes. You'll get a callsign and access to your pilot dashboard.";
  }

  // Fleet
  if (/флот|самолёт|воздушн|парк|fleet|aircraft|plane|airbus|boeing/.test(lower)) {
    const fleet = results.filter((r) => r.category === "fleet");
    const models = [...new Set(fleet.map((f) => f.subtitle).filter(Boolean))].slice(0, 5);
    if (models.length > 0) {
      return ru
        ? `В нашем парке: ${models.join(", ")}. Полный список — на странице «Флот».`
        : `Our fleet includes: ${models.join(", ")}. Full list on the Fleet page.`;
    }
    return ru ? "Подробности о флоте — на странице «Флот»." : "Fleet details are on the Fleet page.";
  }

  // Contact / support
  if (/контакт|связат|написать|пожаловат|support|contact|help/.test(lower)) {
    return ru
      ? "Для связи — тикет через раздел «Связаться», Discord или VK. Тикет — самый надёжный способ получить официальный ответ."
      : "Contact us via the ticket system, Discord, or VK. A ticket is the most reliable way to get an official response.";
  }

  // Staff / team
  if (/команда|персонал|руководств|кто управляет|кто такой|staff|team|who/.test(lower)) {
    const staff = results.filter((r) => r.category === "staff").slice(0, 4);
    if (staff.length > 0) {
      const names = staff.map((s) => (s.subtitle ? `${s.title} (${s.subtitle})` : s.title)).join(", ");
      return ru
        ? `Команда Nordwind Virtual: ${names}. Полный состав — на странице «Команда».`
        : `Nordwind Virtual team: ${names}. Full list on the Team page.`;
    }
    return ru ? "Состав команды — на странице «Команда»." : "The team is listed on the Team page.";
  }

  // Events / activities
  if (/событ|мероприят|ивент|event|activit/.test(lower)) {
    return ru
      ? "Актуальные события и мероприятия публикуются в разделе «Активности» и в нашем Discord."
      : "Current events are posted in the Activities section and in our Discord.";
  }

  // News
  if (/новост|news|последн/.test(lower)) {
    const news = results.filter((r) => r.category === "news").slice(0, 3);
    if (news.length > 0) {
      const titles = news.map((n) => `«${n.title}»`).join(", ");
      return ru
        ? `Последние новости: ${titles}. Все публикации — в разделе «Новости».`
        : `Recent news: ${titles}. All posts in the News section.`;
    }
    return ru ? "Новости — в одноимённом разделе." : "News are in the News section.";
  }

  // Documents / rules
  if (/документ|правил|устав|инструкц|document|rules|regulation/.test(lower)) {
    const docs = results.filter((r) => r.category === "document").slice(0, 3);
    if (docs.length > 0) {
      const titles = docs.map((d) => `«${d.title}»`).join(", ");
      return ru
        ? `Найденные документы: ${titles}. Все документы — в разделе «Документы».`
        : `Found: ${titles}. All documents in the Documents section.`;
    }
    return ru ? "Документы и правила — в разделе «Документы»." : "Documents are in the Documents section.";
  }

  // VATSIM
  if (/vatsim|ватсим/.test(lower)) {
    return ru
      ? "Nordwind Virtual работает на vAMSYS и поддерживает полёты в сети VATSIM. События VATSIM публикуются в разделе «Активности»."
      : "Nordwind Virtual runs on vAMSYS and supports VATSIM network flying. VATSIM events are posted in Activities.";
  }

  // Generic question with results
  if (isQuestion(raw) && results.length > 0) {
    const top = results.slice(0, 3).map((r) => r.title).join(", ");
    const count = results.length;
    return ru
      ? `Нашлось ${count} результат${count === 1 ? "" : count < 5 ? "а" : "ов"}. Самые подходящие: ${top}.`
      : `Found ${count} result${count !== 1 ? "s" : ""}. Most relevant: ${top}.`;
  }

  return null;
}

const textContains = (haystack: string, term: string): boolean => {
  if (!term) return false;
  // Check if any word in term has at least 3-char prefix match
  const termWords = term.split(/\s+/).filter(Boolean);
  return termWords.every((tw) =>
    tw.length <= 2 ? haystack.includes(tw) : haystack.includes(tw) || haystack.includes(tw.slice(0, tw.length - 1))
  );
};

const scoreItem = (item: SearchItem, parsed: ParsedQuery): number => {
  const h = item.keywords.toLowerCase();
  const t = item.title.toLowerCase();

  // Directional route queries
  if (parsed.fromTerm || parsed.toTerm) {
    if (item.category === "route") {
      const parts = t.split("→").map((s) => s.trim()); // ["SVO", "AER"]
      const sub = (item.subtitle || "").toLowerCase();
      const subParts = sub.split("→").map((s) => s.trim()); // ["Москва ...", "Сочи ..."]

      const fromMatch = parsed.fromTerm
        ? textContains(parts[0], parsed.fromTerm) || textContains(subParts[0] || "", parsed.fromTerm)
        : true;
      const toMatch = parsed.toTerm
        ? textContains(parts[1] || "", parsed.toTerm) || textContains(subParts[1] || "", parsed.toTerm)
        : true;

      if (fromMatch && toMatch) return 10;
      if (fromMatch || toMatch) return 5;
      return -1;
    }

    if (item.category === "airport") {
      const term = parsed.fromTerm || parsed.toTerm;
      if (textContains(h, term)) return 4;
      return -1;
    }

    // Other categories score low but stay visible
    const term = parsed.fromTerm || parsed.toTerm;
    if (textContains(h, term)) return 1;
    return -1;
  }

  // Plain keyword search — soft: each matching word adds score, no hard AND requirement
  if (parsed.words.length === 0) return 0;
  let score = 0;
  let matched = 0;
  for (const word of parsed.words) {
    if (h.includes(word)) {
      matched++;
      if (t.startsWith(word)) score += 4;
      else if (t.includes(word)) score += 2;
      else score += 1;
    } else {
      // Prefix fallback (min 3 chars): "боинг" matches "boeing" won't work but "737" matches "b737"
      const prefix = word.length >= 4 ? word.slice(0, -1) : word;
      if (h.includes(prefix)) { matched++; score += 1; }
    }
  }
  // Require at least half the words to match
  if (matched < Math.ceil(parsed.words.length / 2)) return -1;
  return score;
};

// ── Category metadata ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<Category, { label: string; labelEn: string; icon: React.ElementType }> = {
  fleet:    { label: "Флот",      labelEn: "Fleet",      icon: Plane },
  route:    { label: "Маршруты",  labelEn: "Routes",     icon: Route },
  airport:  { label: "Аэропорты", labelEn: "Airports",   icon: Radio },
  livery:   { label: "Ливреи",    labelEn: "Liveries",   icon: Plane },
  staff:    { label: "Персонал",  labelEn: "Staff",      icon: Users },
  news:     { label: "Новости",   labelEn: "News",       icon: BookOpen },
  document: { label: "Документы", labelEn: "Documents",  icon: FileText },
};

const CATEGORY_ORDER: Category[] = ["fleet", "route", "airport", "livery", "staff", "news", "document"];
const MAX_PER_CATEGORY = 6;

// ── Component ─────────────────────────────────────────────────────────────────

interface SiteSearchProps {
  open: boolean;
  onClose: () => void;
}

export function SiteSearch({ open, onClose }: SiteSearchProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load index when first opened
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    setTimeout(() => inputRef.current?.focus(), 30);

    if (indexCache) {
      setIndex(indexCache);
      return;
    }
    setIsLoading(true);
    getIndex().then((items) => {
      setIndex(items);
      setIsLoading(false);
    });
  }, [open]);


  // Search results
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    const parsed = parseQuery(q);

    // For directional queries, show routes first regardless of category order
    const categoryOrder: Category[] = (parsed.fromTerm || parsed.toTerm)
      ? ["route", "airport", "fleet", "livery", "staff", "news", "document"]
      : CATEGORY_ORDER;

    const scored = index
      .map((item) => ({ item, score: scoreItem(item, parsed) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);

    const grouped = new Map<Category, SearchItem[]>();
    for (const { item } of scored) {
      const bucket = grouped.get(item.category) ?? [];
      if (bucket.length < MAX_PER_CATEGORY) {
        bucket.push(item);
        grouped.set(item.category, bucket);
      }
    }

    const flat: SearchItem[] = [];
    for (const cat of categoryOrder) {
      const bucket = grouped.get(cat);
      if (bucket?.length) flat.push(...bucket);
    }
    return flat;
  }, [query, index]);

  // Template-based smart answer (instant, no API)
  const smartAnswer = useMemo(() => {
    const q = query.trim();
    if (!q || !isQuestion(q)) return null;
    return generateAnswer(q, parseQuery(q), results, language);
  }, [query, results, language]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(0);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const go = useCallback(
    (item: SearchItem) => {
      onClose();
      if (item.category === "livery" && item.url.startsWith("http")) {
        window.open(item.url, "_blank", "noopener");
      } else {
        navigate(item.url);
      }
    },
    [navigate, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      go(results[activeIdx]);
    }
  };

  if (!open) return null;

  // Group results by category for section headers
  const sections: { category: Category; items: SearchItem[] }[] = [];
  for (const item of results) {
    const last = sections[sections.length - 1];
    if (last?.category === item.category) {
      last.items.push(item);
    } else {
      sections.push({ category: item.category, items: [item] });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          {isLoading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gray-400" />
          ) : (
            <Search className="h-5 w-5 shrink-0 text-gray-400" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tr(
              "Поиск или вопрос — «какие рейсы из Сочи?», «B738», «SVO»...",
              "Search or ask — «flights from Sochi?», «B738», «SVO»..."
            )}
            className="flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Smart answer panel */}
        {smartAnswer && (
          <div className="border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-red-500">
              <Sparkles className="h-3.5 w-3.5" />
              {tr("Ответ", "Answer")}
            </div>
            <p className="text-sm leading-relaxed text-gray-800">{smartAnswer}</p>
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto">
          {query.trim() === "" ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">
              {tr(
                "Введи запрос — маршрут, регистрацию, аэропорт, имя...",
                "Type a query — route, registration, airport, name..."
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {["рейсы из Сочи?", "как вступить?", "ближайшие события?", "как связаться?", "B738"].map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => setQuery(hint)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">
              {tr("Ничего не найдено", "Nothing found")}
            </div>
          ) : (
            <div className="py-2">
              {sections.map((section) => {
                const meta = CATEGORY_META[section.category];
                const Icon = meta.icon;
                return (
                  <div key={section.category}>
                    <div className="flex items-center gap-2 px-4 py-1.5">
                      <Icon className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        {language === "ru" ? meta.label : meta.labelEn}
                      </span>
                    </div>
                    {section.items.map((item) => {
                      const globalIdx = results.indexOf(item);
                      const isActive = globalIdx === activeIdx;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-idx={globalIdx}
                          onClick={() => go(item)}
                          onMouseEnter={() => setActiveIdx(globalIdx)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive ? "bg-gray-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-gray-900">
                                {item.title}
                              </span>
                              {item.badge ? (
                                <span className="shrink-0 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                                  {item.badge}
                                </span>
                              ) : null}
                            </div>
                            {item.subtitle ? (
                              <div className="truncate text-xs text-gray-400">{item.subtitle}</div>
                            ) : null}
                          </div>
                          {isActive ? (
                            <span className="shrink-0 text-[10px] text-gray-400">↵</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <span>↑↓ {tr("навигация", "navigate")}</span>
            <span>↵ {tr("перейти", "open")}</span>
            <span>Esc {tr("закрыть", "close")}</span>
          </div>
          <span>{tr(`${index.length} элементов в индексе`, `${index.length} items indexed`)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Trigger hook (Ctrl+K) ─────────────────────────────────────────────────────

export function useSiteSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}
