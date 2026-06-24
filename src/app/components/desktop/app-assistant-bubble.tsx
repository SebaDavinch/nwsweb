import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, Bot, User as UserIcon, X } from "lucide-react";
import { useLanguage } from "../../context/language-context";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/**
 * Плавающий ИИ-ассистент (кружок в правом нижнем углу, как на сайте) для приложения.
 * Использует настоящий бэкенд /api/pilot/assistant (xAI). Плавает поверх всех режимов.
 */
export function AppAssistantBubble() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const suggestions = [
    tr("Как создать букинг?", "How do I book a flight?"),
    tr("Как завершить полёт в Pegasus?", "How to complete a flight in Pegasus?"),
    tr("Где посмотреть мою статистику?", "Where can I see my stats?"),
  ];

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    const history = messages.slice(-8);
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/pilot/assistant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });
      const payload = (await res.json().catch(() => null)) as { answer?: string; error?: string } | null;
      const answer =
        res.ok && payload?.answer
          ? payload.answer
          : payload?.error === "AI not configured"
            ? tr("ИИ-ассистент не настроен на сервере.", "AI assistant is not configured on the server.")
            : tr("Не удалось получить ответ, попробуйте позже.", "Couldn't get a response, try again later.");
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: tr("Ошибка сети.", "Network error.") }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Плавающая кнопка (над нижним статус-баром) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-10 right-5 z-50 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl focus:outline-none"
        aria-label={tr("ИИ-ассистент", "AI assistant")}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {/* Панель чата */}
      {open ? (
        <div className="fixed bottom-24 right-5 z-50 flex h-[460px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900">
          {/* Шапка */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{tr("ИИ-ассистент", "AI Assistant")}</div>
              <div className="text-[11px] text-white/70">{tr("Помощь по ВАК и приложению", "Help with the VA and the app")}</div>
            </div>
          </div>

          {/* Сообщения */}
          <div ref={scrollRef} className="nws-scroll-hover flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Bot className="h-9 w-9 text-zinc-300 dark:text-zinc-600" />
                <div className="text-sm text-zinc-400">{tr("Спросите что угодно о Nordwind Virtual", "Ask anything about Nordwind Virtual")}</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      m.role === "user" ? "bg-red-500 text-white" : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
                    }`}
                  >
                    {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </div>
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                      m.role === "user" ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {busy ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("Думаю…", "Thinking…")}
              </div>
            ) : null}
          </div>

          {/* Ввод */}
          <div className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-white/10">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={tr("Спросите ассистента…", "Ask the assistant…")}
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-violet-500/50 focus:outline-none dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={!input.trim() || busy}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
