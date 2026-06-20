import { useEffect, useRef, useState } from "react";
import { Bot, Headphones, Send, Sparkles, X } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
  isTyping?: boolean;
}

export function AiSearchWidget() {
  const { language } = useLanguage();
  const ru = language === "ru";
  const tr = (ruStr: string, en: string) => (ru ? ruStr : en);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: tr(
            "Привет! Спрашивай про флот, маршруты, вступление, события или как с нами связаться.",
            "Hi! Ask me about fleet, routes, how to join, events, or how to contact us."
          ),
        },
      ]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const typingMsg: Message = { role: "assistant", content: "...", isTyping: true };

    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setInput("");
    setLoading(true);

    const history = [
      ...messages.filter((m) => !m.isTyping),
      userMsg,
    ].map((m) => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, lang: ru ? "ru" : "en" }),
      });

      const data = await resp.json().catch(() => ({}));

      const reply: string = data?.reply || tr(
        "Не удалось получить ответ. Попробуй ещё раз или обратись в поддержку.",
        "Failed to get a response. Try again or contact support."
      );

      setMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { role: "assistant", content: reply },
      ]);

      if (data?.escalate) {
        setEscalated(true);
        setTicketNumber(data?.ticketNumber ?? null);
      }
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        {
          role: "assistant",
          content: tr(
            "Произошла ошибка. Попробуй снова или создай тикет в разделе «Связаться».",
            "An error occurred. Please try again or create a ticket in the Contact section."
          ),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const requestOperator = () => {
    send(tr("Хочу поговорить с живым оператором", "I want to speak with a live operator"));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#E31E24] text-white shadow-lg transition-all hover:bg-[#c41a20] hover:scale-105 focus:outline-none"
        aria-label={tr("Помощник", "Assistant")}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 bg-[#E31E24] px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Nordwind Помощник</div>
              <div className="text-[11px] text-white/70">{tr("AI-ассистент виртуальной авиакомпании", "VA AI assistant")}</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex max-h-[380px] flex-col gap-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#E31E24] text-white"
                      : msg.isTyping
                        ? "border border-gray-100 bg-gray-50 text-gray-400 animate-pulse"
                        : "border border-gray-100 bg-gray-50 text-gray-800"
                  }`}
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {msg.isTyping ? (
                    <span className="tracking-widest">···</span>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {/* Escalation success */}
            {escalated && (
              <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                {ticketNumber
                  ? tr(`Тикет #${ticketNumber} создан — оператор скоро ответит.`, `Ticket #${ticketNumber} created — an operator will respond shortly.`)
                  : tr("Запрос передан оператору. Ожидайте ответа.", "Request forwarded to an operator. Please wait.")}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Operator button */}
          {!escalated && messages.length > 1 && (
            <div className="border-t border-gray-100 px-3 pt-2 pb-0">
              <button
                type="button"
                onClick={requestOperator}
                disabled={loading}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-gray-400 transition hover:text-[#E31E24] disabled:opacity-40"
              >
                <Headphones className="h-3.5 w-3.5" />
                {tr("Соединить с оператором", "Connect with an operator")}
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 p-3">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tr("Задай вопрос...", "Ask a question...")}
                className="flex-1 text-sm"
                disabled={loading || escalated}
              />
              <Button
                type="button"
                size="icon"
                onClick={() => void send()}
                disabled={!input.trim() || loading || escalated}
                className="shrink-0 bg-[#E31E24] hover:bg-[#c41a20]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
