import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Send, Hash, Wifi, WifiOff, Trash2, Shield, Flag, Plus, Smile, X, MessageCircle } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { useChat, type ChatMessage } from "./use-chat";
import { useChatRooms, type CustomEmoji } from "./use-chat-rooms";
import { notify } from "./notify";
import { getNotificationsEnabled, getMentionNotifEnabled } from "./app-settings";

// Быстрые реакции + набор для пикера композера.
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "✈️", "🔥"];
const UNICODE_EMOJIS = [
  "😀", "😂", "😅", "😊", "😍", "😎", "🤔", "😴",
  "👍", "👎", "👏", "🙏", "💪", "🔥", "✨", "🎉",
  "✈️", "🛫", "🛬", "🗺️", "🌍", "⛅", "🌧️", "❄️",
  "❤️", "💯", "✅", "❌", "⚠️", "🚀", "⭐", "🏆",
];

function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function fmtTime(ts: string, locale: string): string {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

// Рендер одного эмодзи (кастомный :name: → картинка, иначе текст).
function renderEmoji(token: string, emojis: CustomEmoji[]) {
  const m = /^:([a-z0-9_]+):$/.exec(token);
  const custom = m ? emojis.find((e) => e.name === m[1]) : null;
  if (custom) return <img src={custom.url} alt={token} className="inline-block h-4 w-4 align-middle" />;
  return <span>{token}</span>;
}

// Рендер текста сообщения: кастомные :name: эмодзи и подсветка @упоминаний.
function renderText(text: string, emojis: CustomEmoji[]) {
  const byName = new Map(emojis.map((e) => [e.name, e.url]));
  const parts = String(text).split(/(:[a-z0-9_]+:|@[A-Za-z0-9_.-]{2,40})/g);
  return parts.map((part, i) => {
    const emojiMatch = /^:([a-z0-9_]+):$/.exec(part);
    if (emojiMatch && byName.has(emojiMatch[1])) {
      return <img key={i} src={byName.get(emojiMatch[1])} alt={part} title={part} className="inline-block h-5 w-5 -mt-0.5 align-middle" />;
    }
    if (/^@[A-Za-z0-9_.-]{2,40}$/.test(part)) {
      return (
        <span key={i} className="rounded bg-red-500/15 px-0.5 font-semibold text-red-500 dark:text-red-400">
          {part}
        </span>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function MessageRow({
  msg,
  mine,
  locale,
  emojis,
  myKey,
  canModerate,
  onDelete,
  onReport,
  onReact,
}: {
  msg: ChatMessage;
  mine: boolean;
  locale: string;
  emojis: CustomEmoji[];
  myKey: string;
  canModerate?: boolean;
  onDelete?: (id: string) => void;
  onReport?: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
}) {
  const [picker, setPicker] = useState(false);
  const reactions = msg.reactions || {};
  const reactionEntries = Object.entries(reactions).filter(([, keys]) => keys.length > 0);

  return (
    <div className={`group flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
        {msg.avatar ? <img src={msg.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : initials(msg.name)}
      </div>
      <div className={`max-w-[78%] ${mine ? "items-end text-right" : ""}`}>
        <div className={`flex items-center gap-2 ${mine ? "flex-row-reverse" : ""}`}>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{mine ? "" : msg.name}</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{fmtTime(msg.ts, locale)}</span>
        </div>
        <div
          className={[
            "mt-0.5 inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm",
            mine ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
          ].join(" ")}
        >
          {renderText(msg.text, emojis)}
        </div>

        {/* Реакции */}
        {reactionEntries.length > 0 ? (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
            {reactionEntries.map(([emoji, keys]) => {
              const reacted = keys.includes(myKey);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(msg.id, emoji)}
                  className={[
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                    reacted
                      ? "border-red-300 bg-red-50 text-red-600 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300",
                  ].join(" ")}
                >
                  {renderEmoji(emoji, emojis)}
                  <span className="tabular-nums">{keys.length}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Действия при наведении */}
      <div className="relative flex items-center gap-0.5 self-center opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setPicker((v) => !v)}
          className="rounded p-1 text-zinc-400 hover:text-amber-500"
          title="Реакция"
        >
          <Smile className="h-3.5 w-3.5" />
        </button>
        {!mine && onReport ? (
          <button type="button" onClick={() => onReport(msg.id)} className="rounded p-1 text-zinc-400 hover:text-amber-500" title="Пожаловаться">
            <Flag className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {canModerate && onDelete ? (
          <button type="button" onClick={() => onDelete(msg.id)} className="rounded p-1 text-zinc-400 hover:text-red-500" title="Удалить">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {picker ? (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPicker(false)} />
            <div className="absolute bottom-7 right-0 z-20 flex gap-1 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-zinc-900">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onReact(msg.id, e);
                    setPicker(false);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-zinc-100 dark:hover:bg-white/5"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const { pilot } = useAuth();
  const { rooms, emojis, openDm } = useChatRooms();

  const [room, setRoom] = useState("general");
  const [showEmoji, setShowEmoji] = useState(false);

  const myKey = useMemo(() => String(pilot?.callsign || "").trim().toLowerCase(), [pilot?.callsign]);

  // Только Общий и личные переписки (пользовательские комнаты не используем).
  const dmRooms = useMemo(() => rooms.filter((r) => r.dm), [rooms]);

  const handleIncoming = (msg: ChatMessage) => {
    if (!myKey) return;
    if (String(msg.username || "").toLowerCase() === myKey) return;
    const mentioned = (msg.mentions || []).map((m) => m.toLowerCase()).includes(myKey);
    if (mentioned && getNotificationsEnabled() && getMentionNotifEnabled()) {
      void notify(tr("Вас упомянули в чате", "You were mentioned"), `${msg.name}: ${msg.text.slice(0, 120)}`);
    }
  };

  const { messages, status, isModerator, error, sendMessage, deleteMessage, reportMessage, reactMessage } = useChat(room, {
    onIncoming: handleIncoming,
  });
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (room !== "general" && !rooms.some((r) => r.id === room)) setRoom("general");
  }, [rooms, room]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const activeRoom = rooms.find((r) => r.id === room);
  const title = room === "general" ? tr("Общий", "General") : activeRoom?.name || tr("Личные", "Direct");

  const handleReport = (id: string) => {
    if (reported.has(id)) return;
    const reason = window.prompt(tr("Причина жалобы (необязательно):", "Report reason (optional):")) ?? "";
    reportMessage(id, reason);
    setReported((prev) => new Set(prev).add(id));
  };

  const isMine = (m: ChatMessage) =>
    (m.pilotId !== null && String(m.pilotId) === String(pilot?.id)) ||
    (!!m.username && !!pilot?.callsign && m.username === pilot.callsign);

  const handleSend = () => {
    if (sendMessage(draft)) setDraft("");
  };

  const insertEmoji = (token: string) => {
    setDraft((prev) => (prev ? `${prev} ${token}` : token).trimStart());
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleNewDm = async () => {
    const username = window.prompt(tr("Ник пилота (vAMSYS username):", "Pilot username (vAMSYS):"))?.trim();
    if (!username) return;
    const id = await openDm(username);
    if (id) setRoom(id);
    else window.alert(tr("Не удалось открыть личную переписку", "Could not open direct message"));
  };

  return (
    <div className="relative flex h-full overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/5 dark:bg-zinc-900">
      {/* Список: Общий + Личные */}
      <div className="flex w-48 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-white/5 dark:bg-zinc-950/40">
        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={() => setRoom("general")}
            className={[
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              room === "general"
                ? "bg-red-500 text-white"
                : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
            ].join(" ")}
          >
            <Hash className="h-4 w-4 shrink-0" />
            <span className="truncate">{tr("Общий", "General")}</span>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between px-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {tr("Личные", "Direct")}
          </span>
          <button
            type="button"
            onClick={handleNewDm}
            title={tr("Новое сообщение", "New message")}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-100"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="nws-scroll-hover flex-1 overflow-y-auto px-2 pb-2 pt-1">
          {dmRooms.length === 0 ? (
            <div className="px-2 py-2 text-xs text-zinc-400 dark:text-zinc-600">{tr("Нет переписок", "No conversations")}</div>
          ) : (
            dmRooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoom(r.id)}
                className={[
                  "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  room === r.id
                    ? "bg-red-500 text-white"
                    : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
                ].join(" ")}
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">{r.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Лента + ввод */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-white/5">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {activeRoom?.dm ? <MessageCircle className="h-3.5 w-3.5 text-zinc-400" /> : <Hash className="h-3.5 w-3.5 text-zinc-400" />}
            {title}
            {isModerator ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <Shield className="h-3 w-3" />
                {tr("модератор", "moderator")}
              </span>
            ) : null}
          </span>
          <StatusBadge status={status} tr={tr} />
        </header>

        <div ref={scrollRef} className="nws-scroll-hover flex-1 space-y-3 overflow-y-auto p-4">
          {error === "forbidden_room" ? (
            <div className="flex h-full items-center justify-center text-sm text-red-500">
              {tr("Нет доступа к этой переписке", "No access to this conversation")}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400 dark:text-zinc-600">
              {tr("Сообщений пока нет — начните беседу", "No messages yet — say hello")}
            </div>
          ) : (
            messages.map((m) => (
              <MessageRow
                key={m.id}
                msg={m}
                mine={isMine(m)}
                locale={locale}
                emojis={emojis}
                myKey={myKey}
                canModerate={isModerator}
                onDelete={deleteMessage}
                onReport={reported.has(m.id) ? undefined : handleReport}
                onReact={reactMessage}
              />
            ))
          )}
        </div>

        <div className="relative flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-white/5">
          {showEmoji ? <EmojiPicker emojis={emojis} onPick={insertEmoji} onClose={() => setShowEmoji(false)} tr={tr} /> : null}
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/5 dark:hover:text-zinc-200"
            title={tr("Эмодзи", "Emoji")}
          >
            <Smile className="h-5 w-5" />
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={tr("Написать сообщение…  @ник, :эмодзи:", "Type a message…  @nick, :emoji:")}
            maxLength={2000}
            className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-red-500/50 focus:outline-none dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || status !== "open"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, tr }: { status: "connecting" | "open" | "closed"; tr: (ru: string, en: string) => string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        status === "open"
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          : status === "connecting"
            ? "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
            : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400"
      }`}
    >
      {status === "open" ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {tr("В сети", "Online")}
        </>
      ) : status === "connecting" ? (
        <>
          <Wifi className="h-3.5 w-3.5" />
          {tr("Подключение…", "Connecting…")}
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          {tr("Отключено", "Offline")}
        </>
      )}
    </span>
  );
}

function EmojiPicker({
  emojis,
  onPick,
  onClose,
  tr,
}: {
  emojis: CustomEmoji[];
  onPick: (token: string) => void;
  onClose: () => void;
  tr: (ru: string, en: string) => string;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute bottom-16 left-3 z-20 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-zinc-900">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{tr("Эмодзи", "Emoji")}</div>
        <div className="grid grid-cols-8 gap-1">
          {UNICODE_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onPick(e)}
              className="flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              {e}
            </button>
          ))}
        </div>
        {emojis.length ? (
          <>
            <div className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{tr("Кастомные", "Custom")}</div>
            <div className="grid grid-cols-8 gap-1">
              {emojis.map((e) => (
                <button
                  key={e.name}
                  type="button"
                  onClick={() => onPick(`:${e.name}:`)}
                  title={`:${e.name}:`}
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-white/5"
                >
                  <img src={e.url} alt={e.name} className="h-5 w-5 object-contain" />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
